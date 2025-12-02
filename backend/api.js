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

    if (usuario.contrasena?.startsWith?.('$2b$')) {
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
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

router.get("/usuarios", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

router.post("/usuarios/crear", authenticateToken, isAdmin, async (req, res) => {
  const { rol, rut, nombre, correo, contrasena } = req.body;
  if (![0, 1, 2, 3].includes(rol) || !rut || !nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Faltan datos o el rol es inválido" });
  }
  if (contrasena.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  const specialCharRegex = /[%&\$#@!]/;
  if (!specialCharRegex.test(contrasena)) {
    return res.status(400).json({ error: "La contraseña debe contener al menos un carácter especial (%&$#@!)" });
  }

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING id, rut, nombre, correo, rol",
      [rol, rut, nombre, correo, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
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

router.delete("/usuarios/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  if (parseInt(req.user.id, 10) === parseInt(id, 10)) {
    return res.status(400).json({ error: "No puedes eliminarte a ti mismo." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM curso_usuarios WHERE usuario_id = $1", [id]);
    await client.query("UPDATE incidentes SET creado_por = NULL WHERE creado_por = $1", [id]);
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

router.post("/usuarios/cambiar-contraseña", authenticateToken, isAdmin, async (req, res) => {
  const { id, nuevaContraseña } = req.body;
  if (!id || !nuevaContraseña) return res.status(400).json({ error: "Faltan datos" });

  try {
    const hashedPassword = await bcrypt.hash(nuevaContraseña, 10);
    const result = await pool.query(
      "UPDATE usuarios SET contrasena = $1 WHERE id = $2 RETURNING id, rut, nombre",
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

router.get("/cursos", authenticateToken, async (req, res) => {
  try {
    if (req.user.rol === 0) {
      const result = await pool.query("SELECT * FROM cursos ORDER BY id");
      return res.json(result.rows);
    }

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

router.delete("/cursos/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM curso_usuarios WHERE curso_id = $1", [id]);
    await client.query("DELETE FROM incidentes WHERE id_curso = $1", [id]);
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

router.post("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  try {
    const userCheck = await pool.query("SELECT * FROM usuarios WHERE id = $1", [usuarioId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    const usuario = userCheck.rows[0];
    if (usuario.rol === 0) {
      return res.status(400).json({ error: "Los Administradores no se asignan a cursos" });
    }
    if (usuario.rol === 3) {
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

function assertIncidentePayload(body) {
  const errors = [];
  const required = ["idCurso", "tipo", "severidad", "descripcion"];
  for (const k of required) if (!body[k]) errors.push(`Falta ${k}`);
  if ((body.descripcion || "").length < 10) errors.push("La descripción debe tener al menos 10 caracteres");
  if (errors.length) { const e = new Error("Payload inválido"); e.code = 400; e.details = errors; throw e; }
}

router.post('/incidentes', authenticateToken, async (req, res) => {
  try {
    assertIncidentePayload(req.body);
    const {
      alumnos = [],
      idCurso,
      tipo,
      severidad,
      descripcion,
      lugar = null,
      fecha = new Date().toISOString(),
      participantes = [],
      medidas = [],
      adjuntos = [],
      estado = "abierto"
    } = req.body;

    if (req.user?.rol === 1) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, idCurso]
      );
      if (check.rowCount === 0) {
        return res.status(403).json({ error: "No puedes registrar incidentes en un curso que no te corresponde." });
      }
    }
    if (req.user?.rol === 2) {
      return res.status(403).json({ error: "No tienes permisos para crear incidentes." });
    }

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

router.get('/incidentes', authenticateToken, async (req, res) => {
  try {
    const { idCurso, idAlumno, estado, from, to, page = 1, limit = 10 } = req.query;

    const where = [];
    const values = [];
    let i = 1;

    if (idCurso) { where.push(`id_curso = $${i++}`); values.push(+idCurso); }
    if (estado) { where.push(`estado = $${i++}`); values.push(estado); }
    if (idAlumno) { where.push(`alumnos @> $${i++}::jsonb`); values.push(JSON.stringify([+idAlumno])); }
    if (from) { where.push(`fecha >= $${i++}`); values.push(new Date(from)); }
    if (to) { where.push(`fecha <= $${i++}`); values.push(new Date(to)); }

    if (req.user?.rol === 1) {
      where.push(`id_curso IN (SELECT curso_id FROM curso_usuarios WHERE usuario_id = $${i++})`);
      values.push(req.user.id);
    }
    if (req.user?.rol === 2) {
      where.push(`alumnos @> $${i++}::jsonb`);
      values.push(JSON.stringify([req.user.id]));
    }

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

router.get('/incidentes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM incidentes WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "No encontrado" });

    const incidente = r.rows[0];

    if (req.user?.rol === 1) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, incidente.id_curso]
      );
      if (check.rowCount === 0) return res.status(403).json({ error: "Sin permisos" });
    }

    if (req.user?.rol === 2) {
      const esInvolucrado = (incidente.alumnos || []).includes(req.user.id);
      if (!esInvolucrado) {
        return res.status(403).json({ error: "Sin permisos" });
      }
    }

    res.json(incidente);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/incidentes/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.rol === 2) {
      return res.status(403).json({ error: "No tienes permisos para editar incidentes." });
    }

    const { id } = req.params;

    const map = {
      idCurso: "id_curso",
      tipo: "tipo",
      severidad: "severidad",
      descripcion: "descripcion",
      lugar: "lugar",
      fecha: "fecha",
      estado: "estado",
      alumnos: "alumnos",
      participantes: "participantes",
      medidas: "medidas",
      adjuntos: "adjuntos"
    };

    const sets = [];
    const values = [];
    let i = 1;

    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) {
        if (["alumnos", "participantes", "medidas", "adjuntos"].includes(k)) {
          sets.push(`${col} = $${i++}::jsonb`);
          values.push(JSON.stringify(req.body[k]));
        } else {
          sets.push(`${col} = $${i++}`);
          values.push(req.body[k]);
        }
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

    if (req.user?.rol === 1) {
      const check = await pool.query(`SELECT id_curso FROM incidentes WHERE id = $1`, [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: "No encontrado" });
      const belongs = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [req.user.id, check.rows[0].id_curso]
      );
      if (belongs.rowCount === 0) return res.status(403).json({ error: "Sin permisos" });
    }

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

    res.json({ message: "Correo de recuperación enviado correctamente" });

  } catch (err) {
    console.error("Error en /recover-password:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

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

// ================== ENCUESTAS ==================

router.get('/encuestas', authenticateToken, async (req, res) => {
  try {
    let query;
    const values = [];

    if (req.user.rol === 0) {
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               ORDER BY e.fecha_creacion DESC`;
    } else if (req.user.rol === 1) {
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               WHERE e.creado_por = $1
               ORDER BY e.fecha_creacion DESC`;
      values.push(req.user.id);
    } else {
      query = `SELECT e.*, c.nombre as nombre_curso 
               FROM encuestas e
               JOIN cursos c ON e.id_curso = c.id
               WHERE e.estado = 'publicada' AND e.id_curso IN (
                 SELECT curso_id FROM curso_usuarios WHERE usuario_id = $1
               )
               ORDER BY e.fecha_creacion DESC`;
      values.push(req.user.id);
    }

    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/encuestas', authenticateToken, async (req, res) => {
  if (req.user.rol === 2) {
    return res.status(403).json({ error: "No tienes permisos para crear encuestas." });
  }

  const { idCurso, titulo, descripcion, preguntas } = req.body;

  if (!idCurso || !titulo || !preguntas || preguntas.length === 0) {
    return res.status(400).json({ error: "Faltan datos (idCurso, titulo, preguntas)" });
  }

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

    const encuestaRes = await client.query(
      `INSERT INTO encuestas (id_curso, creado_por, titulo, descripcion, estado)
       VALUES ($1, $2, $3, $4, 'publicada')
       RETURNING id`,
      [idCurso, req.user.id, titulo, descripcion]
    );

    const idEncuesta = encuestaRes.rows[0].id;

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

router.get('/encuestas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    const [encuestaRes, preguntasRes] = await Promise.all([
      pool.query(`SELECT e.*, c.nombre as nombre_curso FROM encuestas e JOIN cursos c ON e.id_curso = c.id WHERE e.id = $1`, [id]),
      pool.query(`SELECT p.id, p.texto, p.tipo_pregunta FROM preguntas p WHERE p.id_encuesta = $1 ORDER BY p.orden`, [id])
    ]);

    if (encuestaRes.rows.length === 0) return res.status(404).json({ error: "Encuesta no encontrada." });

    const encuesta = encuestaRes.rows[0];

    if (encuesta.estado !== 'publicada' && req.user.rol === 2) {
      return res.status(403).json({ error: "La encuesta no está disponible." });
    }

    if (req.user.rol === 2) {
      const asignadoRes = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2`,
        [usuarioId, encuesta.id_curso]
      );
      if (asignadoRes.rowCount === 0) {
        return res.status(403).json({ error: "No tienes permiso para ver esta encuesta." });
      }
    }

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

router.post('/encuestas/:id/respuestas', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { respuestas } = req.body;
  const usuarioId = req.user.id;

  if (req.user.rol !== 2) {
    return res.status(403).json({ error: "Solo los alumnos pueden responder encuestas." });
  }

  if (!respuestas || respuestas.length === 0) {
    return res.status(400).json({ error: "No se recibieron respuestas." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      if (!tipo) continue;

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
    if (e.code === '23505') {
      return res.status(400).json({ error: "Ya has respondido esta encuesta." });
    }
    console.error("Error al guardar respuestas:", e);
    res.status(500).json({ error: "Error en el servidor al guardar respuestas." });
  } finally {
    client.release();
  }
});

router.get('/encuestas/:id/resultados', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    const encuestaRes = await pool.query(
      `SELECT id, titulo, descripcion, creado_por FROM encuestas WHERE id = $1`, [id]
    );
    if (encuestaRes.rows.length === 0) {
      return res.status(404).json({ error: "Encuesta no encontrada." });
    }
    const encuesta = encuestaRes.rows[0];

    const usuarioRol = req.user.rol;
    const isCreador = encuesta.creado_por === usuarioId;

    if (usuarioRol === 2) {
      return res.status(403).json({ error: "Solo el personal docente/administrativo puede ver resultados." });
    }
    if (usuarioRol === 1 && !isCreador) {
      return res.status(403).json({ error: "No tienes permiso para ver resultados de esta encuesta." });
    }

    const preguntasRes = await pool.query(
      `SELECT id, texto, tipo_pregunta FROM preguntas WHERE id_encuesta = $1 ORDER BY orden`, [id]
    );
    const preguntas = preguntasRes.rows;

    const resultados = [];

    for (const pregunta of preguntas) {
      let data;

      if (pregunta.tipo_pregunta === 'escala_1_5') {
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

router.get('/psicologos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, correo FROM usuarios WHERE rol = 3 ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener psicólogos" });
  }
});

router.get('/citas', authenticateToken, async (req, res) => {
  let psicologo_id;

  if (req.user.rol === 2) {
    if (!req.query.psicologo_id) {
      return res.status(400).json({ error: 'Debe especificar un psicologo_id' });
    }
    psicologo_id = req.query.psicologo_id;
  } else if (req.user.rol === 3) {
    psicologo_id = req.user.id;
  } else if (req.user.rol === 0) {
    psicologo_id = req.query.psicologo_id || req.user.id;
  } else {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         c.id, 
         c.titulo, 
         c.fecha_hora_inicio AS "start", 
         c.fecha_hora_fin AS "end", 
         c.notas,
         c.estado,  
         c.lugar,
         u.nombre AS "pacienteNombre",
         u.correo AS "pacienteCorreo"
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

router.post('/citas/crear', authenticateToken, async (req, res) => {
  const { titulo, start, end, notas } = req.body;
  let psicologo_id;
  let paciente_id;

  if (req.user.rol === 3) {
    psicologo_id = req.user.id;
    const { nombre_paciente } = req.body;
    if (!nombre_paciente) return res.status(400).json({ error: 'Falta nombre_paciente' });

    const pacienteResult = await pool.query(
      "SELECT id FROM usuarios WHERE nombre ILIKE $1 AND rol = 2",
      [nombre_paciente]
    );
    if (pacienteResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
    paciente_id = pacienteResult.rows[0].id;
  }
  else if (req.user.rol === 2) {
    paciente_id = req.user.id;
    if (!req.body.psicologo_id) return res.status(400).json({ error: 'Falta seleccionar psicólogo' });
    psicologo_id = req.body.psicologo_id;
  }
  else {
    return res.status(403).json({ error: 'Permiso denegado' });
  }

  if (!titulo || !start || !end) {
    return res.status(400).json({ error: 'Faltan datos de la cita' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO citas (psicologo_id, paciente_id, titulo, fecha_hora_inicio, fecha_hora_fin, notas) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *, fecha_hora_inicio AS "start", fecha_hora_fin AS "end"`,
      [psicologo_id, paciente_id, titulo, start, end, notas || '']
    );
    res.status(201).json({ message: "Cita agendada con éxito 🚀", cita: result.rows[0] });
  } catch (err) {
    if (err.code === '23P01' || err.code === '40P01') {
      return res.status(409).json({ error: "El horario seleccionado ya está ocupado." });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cita' });
  }
});
router.get('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
         c.id, 
         c.titulo AS motivo,           -- Alias para que el front lo lea como "motivo"
         c.fecha_hora_inicio AS fecha_hora, -- Alias para "fecha_hora"
         c.fecha_hora_fin,
         c.lugar,
         c.estado,
         c.notas,
         pac.nombre AS nombre_alumno,
         pac.rut AS rut_alumno,
         psi.nombre AS nombre_profesor
       FROM citas c
       LEFT JOIN usuarios pac ON c.paciente_id = pac.id
       LEFT JOIN usuarios psi ON c.psicologo_id = psi.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // Verificación de permisos (opcional pero recomendada)
    const cita = result.rows[0];
    const userId = req.user.id;
    const userRol = req.user.rol;

    // Solo el psicólogo de la cita, el paciente o el admin pueden verla
    // (Aquí asumimos que si eres Rol 3 eres el psicólogo, Rol 2 paciente, Rol 0 admin)
    // Puedes ajustar esta lógica si necesitas más restricción.

    res.json(cita);

  } catch (err) {
    console.error('Error al obtener detalle de cita:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});
// Actualizar una cita (Confirmar, Reagendar, etc.)
router.patch('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado, start, end } = req.body;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (estado) {
      fields.push(`estado = $${idx++}`);
      values.push(estado);
    }
    if (start) {
      fields.push(`fecha_hora_inicio = $${idx++}`);
      values.push(start);
    }
    if (end) {
      fields.push(`fecha_hora_fin = $${idx++}`);
      values.push(end);
    }

    if (fields.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

    values.push(id);
    const query = `UPDATE citas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) return res.status(404).json({ error: "Cita no encontrada" });

    res.json({ message: "Cita actualizada", cita: result.rows[0] });
  } catch (err) {
    console.error("Error al actualizar cita:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

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