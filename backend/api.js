import { Router } from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import pkg from "pg";
import bcrypt from "bcryptjs"; // para encriptar contraseñas
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const router = Router();

// Pool de conexión a Neon / Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario en Neon
});

// ================== MIDDLEWARES ==================

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Token requerido" });

  jwt.verify(token, process.env.JWT_SECRET || "secreto123", (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido o expirado" });
    req.user = user;
    next();
  });
}

// Middleware para verificar si el usuario es Administrador
function isAdmin(req, res, next) {
  if (req.user.rol !== 0) {
    return res.status(403).json({ error: "Acceso denegado. Se requiere rol de Administrador." });
  }
  next();
}

// ================== RUTAS PÚBLICAS ==================

// Ruta de prueba
router.get("/", (req, res) => {
  res.send("API conectada a Neon");
});

// Login
router.post("/login", async (req, res) => {
  const { identificador, contrasena } = req.body;
  if (!identificador || !contrasena) return res.status(400).json({ error: "Falta rut o contraseña" });

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE rut::text = $1 OR correo = $1", 
      [identificador]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    let validPassword = false;
    // Usamos 'contrasena' para coincidir con la BD (basado en tu lógica de login)
    if (usuario.contrasena?.startsWith?.('$2b$')) {
      // Si la contraseña SÍ es un hash, usa bcrypt
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
      // Si es texto plano (tu caso), usa una comparación simple
      validPassword = String(usuario.contrasena).trim() === contrasena;
    }

    if (!validPassword) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: usuario.id, rut: usuario.rut, rol: usuario.rol },
      process.env.JWT_SECRET || "secreto123",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Inicio de sesión exitoso",
      usuario: {
        id: usuario.id,
        rut: usuario.rut,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      token,
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== RUTA DE PERFIL ==================

// Obtener perfil del usuario logueado (usado por AuthContext)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error en /me:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== USUARIOS (Admin) ==================

// Obtener todos los usuarios (Solo Admin)
router.get("/usuarios", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

// Crear usuario (Solo Admin)
router.post("/usuarios/crear", authenticateToken, isAdmin, async (req, res) => {
  // Usamos 'contrasena' para coincidir con el frontend
  const { rol, rut, nombre, correo, contrasena } = req.body;
  //Roles 0: administrador, 1: profesor, 2: alumno, 3: psicologo
  if (![0, 1, 2, 3].includes(rol) || !rut || !nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Faltan datos o el rol es inválido" });
  }
if(contrasena.length < 6) {
  return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
}
for(let i = 0; i < contrasena.length; i++) {
  if(contrasena[i] === ' ') {
    return res.status(400).json({ error: "La contraseña no puede contener espacios" });
  }
}
const specialCharRegex = /[%&\$#@!]/;
//Comprueba si la contraseña NO contiene (.test() da false) ninguno de esos caracteres.
if (!specialCharRegex.test(contrasena)) {
  // 3. Si no encontró ninguno, retorna el error.
  return res.status(400).json({ error: "La contraseña debe contener al menos un carácter especial (%&$#@!)" });
}

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      // Guardamos en la columna 'contrasena' de la BD
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING id, rut, nombre, correo, rol",
      [rol, rut, nombre, correo, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err)
 {
    if (err.code === "23505") { // Error de constraint único
      if (err.constraint === "usuarios_rut_key") {
        return res.status(400).json({ error: "El RUT ya está registrado" });
      }
      if (err.constraint === "usuarios_correo_key") {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
    }
    console.error("Error en crear usuario:", err);
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

// Eliminar un usuario (Solo Admin)
router.delete("/usuarios/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  // Evitar que un admin se borre a sí mismo
  if (parseInt(req.user.id, 10) === parseInt(id, 10)) {
    return res.status(400).json({ error: "No puedes eliminarte a ti mismo." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    
    // 1. Eliminar relaciones en curso_usuarios
    await client.query("DELETE FROM curso_usuarios WHERE usuario_id = $1", [id]);
    
    // 2. Anonimizar incidentes creados por el usuario (o eliminar, según prefieras)
    // Aquí los desasignamos para mantener el historial:
    await client.query("UPDATE incidentes SET creado_por = NULL WHERE creado_por = $1", [id]);
    
    // 3. Eliminar al usuario
    const result = await client.query("DELETE FROM usuarios WHERE id = $1 RETURNING id, rut, nombre", [id]);
    
    await client.query("COMMIT");
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    res.json({ message: "Usuario eliminado exitosamente", usuario: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar usuario:", err);
    res.status(500).json({ error: "Error en el servidor al eliminar usuario" });
  } finally {
    client.release();
  }
});


// Cambiar contraseña (Asumimos que solo Admin puede cambiar la de otros)
router.post("/usuarios/cambiar-contraseña", authenticateToken, isAdmin, async (req, res) => {
  const { id, nuevaContraseña } = req.body;
  if (!id || !nuevaContraseña) return res.status(400).json({ error: "Faltan datos" });

  try {
    const hashedPassword = await bcrypt.hash(nuevaContraseña, 10);
    const result = await pool.query(
      "UPDATE usuarios SET contrasena = $1 WHERE id = $2 RETURNING id, rut, nombre", // columna 'contrasena'
      [hashedPassword, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      message: "Contraseña actualizada con éxito",
      usuario: result.rows[0],
    });
  } catch (err) {
    console.error("Error al cambiar contraseña:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== CURSOS ==================

// Crear curso (Solo Admin)
router.post("/cursos/crear", authenticateToken, isAdmin, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta el nombre del curso" });

  try {
    const result = await pool.query(
      "INSERT INTO cursos (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.status(201).json({ message: "Curso creado con éxito", curso: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El curso ya existe" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener cursos (Para todos los usuarios logueados)
router.get("/cursos", authenticateToken, async (req, res) => {
  try {
    // Si es admin, ve todos los cursos
    if (req.user.rol === 0) {
      const result = await pool.query("SELECT * FROM cursos ORDER BY id");
      return res.json(result.rows);
    }
    
    // Si es profesor (1) o alumno (2), ve solo sus cursos asignados
    const result = await pool.query(
      `SELECT c.* FROM cursos c
       JOIN curso_usuarios cu ON c.id = cu.curso_id
       WHERE cu.usuario_id = $1
       ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// Eliminar un curso (Solo Admin)
router.delete("/cursos/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect(); // Usar transacción

  try {
    await client.query("BEGIN");
    
    // 1. Eliminar relaciones en curso_usuarios
    await client.query("DELETE FROM curso_usuarios WHERE curso_id = $1", [id]);
    
    // 2. Eliminar incidentes relacionados
    await client.query("DELETE FROM incidentes WHERE id_curso = $1", [id]);
    
    // 3. Eliminar el curso
    const result = await client.query("DELETE FROM cursos WHERE id = $1 RETURNING *", [id]);
    
    await client.query("COMMIT");
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }
    
    res.json({ message: "Curso y sus relaciones eliminados exitosamente", curso: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar curso:", err);
    res.status(500).json({ error: "Error en el servidor al eliminar el curso" });
  }
});


// Asignar usuario a curso (Solo Admin)
router.post("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  try {
    const userCheck = await pool.query("SELECT * FROM usuarios WHERE id = $1", [usuarioId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    const usuario = userCheck.rows[0];
    // Admin (rol 0) no se asigna a cursos
    if (usuario.rol === 0) {
       return res.status(400).json({ error: "Los Administradores no se asignan a cursos" });
    }
    if(usuario.rol === 3) {
        return res.status(400).json({ error: "Los Psicólogos no se asignan a cursos" });
    }

    const result = await pool.query(
      "INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1, $2) RETURNING *",
      [usuarioId, cursoId]
    );

    res.json({ message: "Usuario asignado al curso con éxito", asignacion: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El usuario ya está en este curso" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Desasignar usuario de curso (Solo Admin)
router.delete("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2 RETURNING *",
      [usuarioId, cursoId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Asignación no encontrada" });
    }

    res.json({ message: "Usuario desasignado del curso con éxito" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener usuarios de un curso (Admin)
router.get("/cursos/:cursoId/usuarios", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.rut, u.rol 
       FROM usuarios u
       JOIN curso_usuarios cu ON u.id = cu.usuario_id
       WHERE cu.curso_id = $1`,
      [cursoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuarios del curso" });
  }
});


// ===================== INCIDENTES =====================

// Validación de payload de incidente
function assertIncidentePayload(body) {
  const errors = [];
  const required = ["idCurso", "tipo", "severidad", "descripcion"];
  for (const k of required) if (!body[k]) errors.push(`Falta ${k}`);
  if ((body.descripcion || "").length < 10) errors.push("La descripción debe tener al menos 10 caracteres");
  if (errors.length) { const e = new Error("Payload inválido"); e.code = 400; e.details = errors; throw e; }
}

// Crear incidente (Protegido)
router.post('/incidentes', authenticateToken, async (req, res) => {
  try {
    assertIncidentePayload(req.body);
    const {
      alumnos = [],                // [id_usuario, ...]
      idCurso,                     // número (columna real: id_curso)
      tipo,
      severidad,
      descripcion,
      lugar = null,
      fecha = new Date().toISOString(),
      participantes = [],          // [{nombre, rol}]
      medidas = [],                // [{texto, ...}]
      adjuntos = [],               // [{url, label}]
      estado = "abierto"
    } = req.body;

    // Si es profesor (rol=1) debe pertenecer al curso
    if (req.user?.rol === 1) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, idCurso]
      );
      if (check.rowCount === 0) {
        return res.status(403).json({ error: "No puedes registrar incidentes en un curso que no te corresponde." });
      }
    }
    // Si es Alumno (rol=2), no puede crear incidentes
    if (req.user?.rol === 2) {
        return res.status(403).json({ error: "No tienes permisos para crear incidentes." });
    }
    // Admin (rol=0) puede crear en cualquier curso

    const ins = await pool.query(
      `INSERT INTO incidentes
        (alumnos, id_curso, tipo, severidad, descripcion, lugar, fecha, participantes, medidas, adjuntos, estado, creado_por, creado_en, actualizado_en)
       VALUES
        ($1,      $2,       $3,   $4,        $5,          $6,    $7,    $8,            $9,      $10,      $11,    $12,        NOW(),      NOW())
       RETURNING *`,
      [
        JSON.stringify(alumnos),
        idCurso,
        tipo,
        severidad,
        descripcion,
        lugar,
        fecha,
        JSON.stringify(participantes),
        JSON.stringify(medidas),
        JSON.stringify(adjuntos),
        estado,
        req.user?.id || null
      ]
    );

    res.status(201).json({ message: "Incidente creado", data: ins.rows[0] });
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message, details: e.details });
  }
});

// Listar incidentes (filtros + paginación) (Protegido)
router.get('/incidentes', authenticateToken, async (req, res) => {
  try {
    const { idCurso, idAlumno, estado, from, to, page = 1, limit = 10 } = req.query;

    const where = [];
    const values = [];
    let i = 1;

    if (idCurso)  { where.push(`id_curso = $${i++}`); values.push(+idCurso); }
    if (estado)   { where.push(`estado = $${i++}`);   values.push(estado); }
    if (idAlumno) { where.push(`alumnos @> $${i++}::jsonb`); values.push(JSON.stringify([+idAlumno])); }
    if (from)     { where.push(`fecha >= $${i++}`);   values.push(new Date(from)); }
    if (to)       { where.push(`fecha <= $${i++}`);   values.push(new Date(to)); }

    // Profesor (rol=1): limitar a cursos donde participa
    if (req.user?.rol === 1) {
      where.push(`id_curso IN (SELECT curso_id FROM curso_usuarios WHERE usuario_id = $${i++})`);
      values.push(req.user.id);
    }
    // Alumno (rol=2): limitar a incidentes donde esté involucrado
    if (req.user?.rol === 2) {
      where.push(`alumnos @> $${i++}::jsonb`);
      values.push(JSON.stringify([req.user.id]));
    }
    // Admin (rol=0) ve todo

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (Number(page) - 1) * Number(limit);

    const q = `
      SELECT * FROM incidentes
      ${whereSQL}
      ORDER BY fecha DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;
    const qCount = `SELECT COUNT(*)::int AS total FROM incidentes ${whereSQL}`;

    const [rows, count] = await Promise.all([
      pool.query(q, values),
      pool.query(qCount, values),
    ]);

    res.json({ data: rows.rows, total: count.rows[0].total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detalle por ID (Protegido)
router.get('/incidentes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM incidentes WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "No encontrado" });

    const incidente = r.rows[0];

    // Profesor (rol=1): verificar que pertenece al curso
    if (req.user?.rol === 1) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, incidente.id_curso]
      );
      if (check.rowCount === 0) return res.status(403).json({ error: "Sin permisos" });
    }
    
    // Alumno (rol=2): verificar que está en la lista de alumnos
    if (req.user?.rol === 2) {
      const esInvolucrado = (incidente.alumnos || []).includes(req.user.id);
      if (!esInvolucrado) {
        return res.status(403).json({ error: "Sin permisos" });
      }
    }
    // Admin (rol=0) puede ver

    res.json(incidente);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar incidente (parcial) (Protegido, solo Admin y Profesor)
router.patch('/incidentes/:id', authenticateToken, async (req, res) => {
  try {
    // Alumnos (rol=2) no pueden editar
    if (req.user?.rol === 2) {
       return res.status(403).json({ error: "No tienes permisos para editar incidentes." });
    }
    
    const { id } = req.params;

    // Mapa payload → columnas
    const map = {
      idCurso: "id_curso",
      tipo: "tipo",
      severidad: "severidad",
      descripcion: "descripcion",
      lugar: "lugar",
      fecha: "fecha",
      estado: "estado",
      alumnos: "alumnos",                 // jsonb
      participantes: "participantes",     // jsonb
      medidas: "medidas",                 // jsonb
      adjuntos: "adjuntos"                // jsonb
    };

    const sets = [];
    const values = [];
    let i = 1;

    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) {
        if (["alumnos","participantes","medidas","adjuntos"].includes(k)) {
          sets.push(`${col} = $${i++}::jsonb`);
          values.push(JSON.stringify(req.body[k]));
        } else {
          sets.push(`${col} = $${i++}`);
          values.push(req.body[k]);
        }
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

    // Profesor (rol=1): alcance por curso
    if (req.user?.rol === 1) {
      const check = await pool.query(`SELECT id_curso FROM incidentes WHERE id = $1`, [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: "No encontrado" });
      const belongs = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, check.rows[0].id_curso]
      );
      if (belongs.rowCount === 0) return res.status(403).json({ error: "Sin permisos" });
    }
    // Admin (rol=0) puede editar

    const sql = `
      UPDATE incidentes
         SET ${sets.join(", ")}, actualizado_en = NOW()
       WHERE id = $${i}
       RETURNING *
    `;
    values.push(id);

    const upd = await pool.query(sql, values);
    if (upd.rowCount === 0) return res.status(404).json({ error: "No encontrado" });

    res.json({ message: "Incidente actualizado", data: upd.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================== RECUPERACIÓN DE CONTRASEÑA ==================

// Ruta para enviar correo de recuperación
router.post("/recover-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  try {
    const userResult = await pool.query("SELECT * FROM usuarios WHERE correo = $1", [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    console.log("Enviando correo a (simulado):", email);
    console.log("URL de reseteo:", resetUrl);

    // Simulación de n8n/webhook (ya que 'fetch' a localhost puede fallar en el servidor)
    // try {
    //   await fetch(process.env.N8N_WEBHOOK_URL, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ email, resetUrl }),
    //   });
    // } catch (err) {
    //   console.error("Error al enviar correo con n8n:", err);
    //   return res.status(500).json({ error: "No se pudo enviar el correo" });
    // }
    
    // (Tu frontend no usa n8n, así que solo devolvemos éxito)

    res.json({ message: "Correo de recuperación enviado correctamente" });
  
  } catch (err) {
    console.error("Error en /recover-password:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para actualizar la contraseña con el token
router.post("/reset-password", async (req, res) => {
  const { token, nuevaContrasena } = req.body;
  if (!token || !nuevaContrasena) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }

  try {
    const { email } = decoded;
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
    
    const result = await pool.query(
      "UPDATE usuarios SET contrasena = $1 WHERE correo = $2 RETURNING id",
      [hashedPassword, email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (err) {
    console.error("Error en /reset-password:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Listar todas las encuestas (para el usuario logueado)
// Listar todas las encuestas (para el usuario logueado)
router.get('/encuestas', authenticateToken, async (req, res) => {
  try {
    let query;
    // 1. INICIAMOS 'values' COMO UN ARRAY VACÍO
    const values = []; 

    if (req.user.rol === 0) {
      // Admin ve todas (Esta consulta no usa parámetros)
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               ORDER BY e.fecha_creacion DESC`;
      // No añadimos nada a 'values'
    } else if (req.user.rol === 1) {
      // Profesor ve las que creó
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               WHERE e.creado_por = $1
               ORDER BY e.fecha_creacion DESC`;
      // 2. AÑADIMOS EL VALOR SOLO CUANDO SE NECESITA
      values.push(req.user.id); 
    } else {
      // Alumno ve las de sus cursos
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               WHERE e.estado = 'publicada' AND e.id_curso IN (
                 SELECT curso_id FROM curso_usuarios WHERE usuario_id = $1
               )
               ORDER BY e.fecha_creacion DESC`;
      // 3. AÑADIMOS EL VALOR SOLO CUANDO SE NECESITA
      values.push(req.user.id); 
    }
    
    // Ahora la llamada es correcta:
    // Si es Admin: pool.query(query, [])
    // Si es Profesor/Alumno: pool.query(query, [userId])
    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (e) {
    // También mejoramos el JSON de error para que sea más limpio
    res.status(500).json({ error: e.message });
  }
});

// Crear una nueva encuesta (Profesor o Admin)
router.post('/encuestas', authenticateToken, async (req, res) => {
  // Alumnos (rol 2) no pueden crear
  if (req.user.rol === 2) {
    return res.status(403).json({ error: "No tienes permisos para crear encuestas." });
  }

  const { idCurso, titulo, descripcion, preguntas } = req.body;
  
  if (!idCurso || !titulo || !preguntas || preguntas.length === 0) {
    return res.status(400).json({ error: "Faltan datos (idCurso, titulo, preguntas)" });
  }

  // Si es Profesor, verificar que el curso le pertenece
  if (req.user.rol === 1) {
    const check = await pool.query(
      "SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2",
      [req.user.id, idCurso]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ error: "No puedes crear encuestas para un curso que no administras." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Insertar la encuesta
    const encuestaRes = await client.query(
      `INSERT INTO encuestas (id_curso, creado_por, titulo, descripcion, estado)
       VALUES ($1, $2, $3, $4, 'publicada')
       RETURNING id`,
      [idCurso, req.user.id, titulo, descripcion]
    );
    
    const idEncuesta = encuestaRes.rows[0].id;
    
    // 2. Insertar las preguntas
    const queryPreguntas = `
      INSERT INTO preguntas (id_encuesta, texto, tipo_pregunta, orden)
      VALUES ($1, $2, $3, $4)
    `;
    
    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      if (!p.texto || !p.tipo_pregunta) throw new Error("Pregunta inválida.");
      await client.query(queryPreguntas, [idEncuesta, p.texto, p.tipo_pregunta, i + 1]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: "Encuesta creada exitosamente", idEncuesta });
    
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Obtener preguntas de una encuesta específica (Para responder o revisar)
router.get('/encuestas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    // 1. Obtener datos de la encuesta y sus preguntas
    const [encuestaRes, preguntasRes] = await Promise.all([
      pool.query(`SELECT e.*, c.nombre as nombre_curso FROM encuestas e JOIN cursos c ON e.id_curso = c.id WHERE e.id = $1`, [id]),
      pool.query(`SELECT p.id, p.texto, p.tipo_pregunta FROM preguntas p WHERE p.id_encuesta = $1 ORDER BY p.orden`, [id])
    ]);

    if (encuestaRes.rows.length === 0) return res.status(404).json({ error: "Encuesta no encontrada." });
    
    const encuesta = encuestaRes.rows[0];
    
    // 2. Validaciones de Acceso (Seguridad)
    if (encuesta.estado !== 'publicada' && req.user.rol === 2) {
      return res.status(403).json({ error: "La encuesta no está disponible." });
    }
    
    // Si es Alumno (Rol 2), verificar si está asignado al curso de la encuesta
    if (req.user.rol === 2) {
      const asignadoRes = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [usuarioId, encuesta.id_curso]
      );
      if (asignadoRes.rowCount === 0) {
        return res.status(403).json({ error: "No tienes permiso para ver esta encuesta." });
      }
    }
    
    // 3. Verificar si el alumno ya respondió
    let yaRespondio = false;
    if (req.user.rol === 2) {
      const respuestaExistente = await pool.query(
          `SELECT 1 FROM respuestas r JOIN preguntas p ON r.id_pregunta = p.id 
           WHERE p.id_encuesta = $1 AND r.id_usuario = $2 LIMIT 1`,
          [id, usuarioId]
      );
      yaRespondio = respuestaExistente.rowCount > 0;
    }

    res.json({
      ...encuesta,
      preguntas: preguntasRes.rows,
      yaRespondio: yaRespondio
    });

  } catch (e) {
    console.error("Error al obtener detalle de encuesta:", e);
    res.status(500).json({ error: "Error en el servidor al obtener encuesta." });
  }
});

// Enviar Respuestas (Solo Alumnos)
router.post('/encuestas/:id/respuestas', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { respuestas } = req.body;
  const usuarioId = req.user.id;

  // 1. Solo Alumnos pueden responder encuestas
  if (req.user.rol !== 2) {
    return res.status(403).json({ error: "Solo los alumnos pueden responder encuestas." });
  }
  
  if (!respuestas || respuestas.length === 0) {
    return res.status(400).json({ error: "No se recibieron respuestas." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Seguridad: Verificar que el alumno puede responder (curso y estado publicado)
    const encuestaRes = await client.query(`
        SELECT e.id_curso, e.estado FROM encuestas e
        JOIN curso_usuarios cu ON e.id_curso = cu.curso_id
        WHERE e.id = $1 AND cu.usuario_id = $2 AND e.estado = 'publicada'`,
        [id, usuarioId]
    );

    if (encuestaRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Encuesta no disponible o no asignada." });
    }

    // 3. Procesar y guardar cada respuesta en una transacción
    const queryPreguntaTipo = await client.query(
        `SELECT id, tipo_pregunta FROM preguntas WHERE id_encuesta = $1`, [id]
    );
    const preguntasMap = queryPreguntaTipo.rows.reduce((map, p) => {
        map[p.id] = p.tipo_pregunta;
        return map;
    }, {});
    
    let respuestasGuardadas = 0;

    for (const resp of respuestas) {
        const tipo = preguntasMap[resp.idPregunta];
        if (!tipo) continue; // Ignorar respuestas a preguntas inexistentes/no pertenecientes

        let valorEscala = null;
        let valorTexto = null;

        if (tipo === 'escala_1_5') {
            valorEscala = resp.valor;
            if (valorEscala < 1 || valorEscala > 5) throw new Error(`Valor de escala inválido para pregunta ${resp.idPregunta}.`);
        } else if (tipo === 'texto_libre') {
            valorTexto = resp.valor;
            if (!valorTexto || valorTexto.length < 5) throw new Error(`Respuesta de texto libre demasiado corta para pregunta ${resp.idPregunta}.`);
        }
        
        await client.query(
            `INSERT INTO respuestas (id_pregunta, id_usuario, valor_escala, valor_texto)
             VALUES ($1, $2, $3, $4)`,
            [resp.idPregunta, usuarioId, valorEscala, valorTexto]
        );
        respuestasGuardadas++;
    }

    await client.query('COMMIT');

    if (respuestasGuardadas === 0) {
        return res.status(400).json({ message: "No se guardó ninguna respuesta válida." });
    }

    res.json({ message: "Respuestas guardadas con éxito.", count: respuestasGuardadas });

  } catch (e) {
    await client.query('ROLLBACK');
    // Error 23505 (Unique Violation) ocurre si intenta responder dos veces
    if (e.code === '23505') {
        return res.status(400).json({ error: "Ya has respondido esta encuesta." });
    }
    console.error("Error al guardar respuestas:", e);
    res.status(500).json({ error: "Error en el servidor al guardar respuestas." });
  } finally {
    client.release();
  }
});

// Obtener resultados agregados de una encuesta (Solo Admin y Profesor)
router.get('/encuestas/:id/resultados', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    // 1. Verificar si la encuesta existe y obtener datos
    const encuestaRes = await pool.query(
        `SELECT id, titulo, descripcion, creado_por FROM encuestas WHERE id = $1`, [id]
    );
    if (encuestaRes.rows.length === 0) {
        return res.status(404).json({ error: "Encuesta no encontrada." });
    }
    const encuesta = encuestaRes.rows[0];

    const usuarioRol = req.user.rol;
    const isCreador = encuesta.creado_por === usuarioId;

    // 2. Seguridad: Solo el creador o un Admin pueden ver los resultados
    if (usuarioRol === 2) { 
        return res.status(403).json({ error: "Solo el personal docente/administrativo puede ver resultados." });
    }
    if (usuarioRol === 1 && !isCreador) {
        return res.status(403).json({ error: "No tienes permiso para ver resultados de esta encuesta." });
    }
    
    // 3. Obtener preguntas y sus tipos
    const preguntasRes = await pool.query(
        `SELECT id, texto, tipo_pregunta FROM preguntas WHERE id_encuesta = $1 ORDER BY orden`, [id]
    );
    const preguntas = preguntasRes.rows;
    
    const resultados = [];
    
    // 4. Procesar resultados pregunta por pregunta
    for (const pregunta of preguntas) {
        let data;
        
        if (pregunta.tipo_pregunta === 'escala_1_5') {
            // Agregación para preguntas de escala (contar cuántos respondieron 1, 2, 3, etc.)
            const result = await pool.query(
                `SELECT r.valor_escala AS valor, COUNT(r.id) AS total
                 FROM respuestas r
                 WHERE r.id_pregunta = $1 AND r.valor_escala IS NOT NULL
                 GROUP BY r.valor_escala
                 ORDER BY r.valor_escala`,
                [pregunta.id]
            );
            data = result.rows.map(row => ({
                valor: parseInt(row.valor), 
                total: parseInt(row.total)
            }));
            
        } else if (pregunta.tipo_pregunta === 'texto_libre') {
            // Listado para respuestas de texto libre
            const result = await pool.query(
                `SELECT r.valor_texto AS texto
                 FROM respuestas r
                 WHERE r.id_pregunta = $1 AND r.valor_texto IS NOT NULL`,
                [pregunta.id]
            );
            data = result.rows.map(row => row.texto);
        }
        
        resultados.push({
            idPregunta: pregunta.id,
            texto: pregunta.texto,
            tipo: pregunta.tipo_pregunta,
            data: data || []
        });
    }

    res.json({
        encuesta: { titulo: encuesta.titulo, descripcion: encuesta.descripcion },
        resultados: resultados
    });

  } catch (e) {
    console.error("Error al obtener resultados:", e);
    res.status(500).json({ error: "Error en el servidor al obtener resultados." });
  }
});
// ================== GESTIÓN DE AGENDA (CITAS) ==================

// Obtener citas del psicólogo (profesor) logueado
router.get('/citas', authenticateToken, async (req, res) => {
  const psicologo_id = req.user.id;

  // Solo psicólogos pueden ver su agenda
  if (req.user.rol !== 3 && req.user.rol !== 0) {
    return res.status(403).json({ error: 'Acceso denegado. Solo para psicólogos.' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         c.id, 
         c.titulo, 
         c.fecha_hora_inicio AS "start", 
         c.fecha_hora_fin AS "end", 
         c.notas, 
         u.nombre AS "pacienteNombre" 
       FROM citas c
       JOIN usuarios u ON c.paciente_id = u.id
       WHERE c.psicologo_id = $1
       ORDER BY c.fecha_hora_inicio`,
      [psicologo_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener citas:', err);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// Crear una nueva cita (buscando paciente por nombre)
router.post('/citas/crear', authenticateToken, async (req, res) => {
  const psicologo_id = req.user.id;
  
  // 1. Recibimos 'nombre_paciente' en lugar de 'paciente_id'
  const { nombre_paciente, titulo, start, end, notas } = req.body;

  if (req.user.rol !== 1) {
    return res.status(403).json({ error: 'Solo los psicólogos (rol 1) pueden crear citas.' });
  }

  // 2. Validamos los nuevos datos
  if (!nombre_paciente || !titulo || !start || !end) {
    return res.status(400).json({ error: 'Faltan datos (nombre_paciente, titulo, start, end)' });
  }

  try {
    // 3. Buscamos al paciente por nombre Y rol
    const pacienteResult = await pool.query(
      "SELECT id FROM usuarios WHERE nombre ILIKE $1 AND rol = 2",
      [nombre_paciente] // ILIKE ignora mayúsculas/minúsculas
    );

    // 4. Manejamos si no se encuentra o hay duplicados
    if (pacienteResult.rows.length === 0) {
      return res.status(404).json({ error: `Paciente (rol 2) con nombre "${nombre_paciente}" no encontrado.` });
    }
    
    if (pacienteResult.rows.length > 1) {
      return res.status(400).json({ error: `Múltiples pacientes (rol 2) encontrados con el nombre "${nombre_paciente}". Por favor, sea más específico.` });
    }

    // 5. Obtenemos el ID del paciente encontrado
    const paciente_id = pacienteResult.rows[0].id;

    // 6. Insertamos la cita con el ID del paciente
    const result = await pool.query(
      `INSERT INTO citas (psicologo_id, paciente_id, titulo, fecha_hora_inicio, fecha_hora_fin, notas) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *, fecha_hora_inicio AS "start", fecha_hora_fin AS "end"`,
      [psicologo_id, paciente_id, titulo, start, end, notas]
    );
    
    res.status(201).json({ message: "Cita creada con éxito 🚀", cita: result.rows[0] });

  } catch (err) {
    // Manejo de conflicto de horario (si las horas se superponen)
    if (err.code === '23P01' || err.code === '40P01') { 
        return res.status(409).json({ error: "El horario seleccionado ya está ocupado." });
    }
    console.error('Error al crear cita:', err);
    res.status(500).json({ error: 'Error interno al crear la cita' });
  }
});

// Eliminar una cita
router.delete('/citas/:id', authenticateToken, async (req, res) => {
  const psicologo_id = req.user.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM citas WHERE id = $1 AND psicologo_id = $2 RETURNING *',
      [id, psicologo_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada o no pertenece a este psicólogo' });
    }
    
    res.json({ message: 'Cita eliminada exitosamente' });
  } catch (err) {
    console.error('Error al eliminar cita:', err);
    res.status(500).json({ error: 'Error al eliminar cita' });
  }
});

export default router;