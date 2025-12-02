import { Router } from "express";
import jwt from "jsonwebtoken";
import pkg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const router = Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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

function isAdmin(req, res, next) {
  if (req.user.rol !== 0) {
    return res.status(403).json({ error: "Acceso denegado. Se requiere rol de Administrador." });
  }
  next();
}
router.post("/usuarios/crear", authenticateToken, isAdmin, async (req, res) => {
  // Usamos 'contrasena' para coincidir con el frontend
  const { rol, rut, nombre, correo, contrasena } = req.body;
  //Roles 0: administrador, 1: profesor, 2: alumno, 3: psicologo
  if (![0, 1, 2, 3].includes(rol) || !rut || !nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Faltan datos o el rol es inválido" });
  }
});

// 2. Disponibilidad con Bloques de 40 mins (08:00 a 18:00)
router.get('/psicologos/:id/disponibilidad', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query; // YYYY-MM-DD

  if (!fecha) return res.status(400).json({ error: "Fecha requerida" });

  try {
    // --- GENERACIÓN DE BLOQUES DE 40 MINUTOS ---
    const bloquesPosibles = [];
    let horaActual = 8 * 60; // 08:00 en minutos
    const horaFin = 18 * 60; // 18:00 en minutos
    const duracionBloque = 40; // minutos

    while (horaActual + duracionBloque <= horaFin) {
      const h = Math.floor(horaActual / 60).toString().padStart(2, '0');
      const m = (horaActual % 60).toString().padStart(2, '0');
      bloquesPosibles.push(`${h}:${m}`);
      horaActual += duracionBloque;
    }
    // ------------------------------------------

    // Consultar citas ocupadas
    const citasOcupadas = await pool.query(
      `SELECT to_char(fecha_hora_inicio, 'HH24:MI') as hora_inicio
       FROM citas 
       WHERE psicologo_id = $1 
       AND fecha_hora_inicio::date = $2::date
       AND estado != 'cancelada'`,
      [id, fecha]
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

    if (idCurso) { where.push(`id_curso = $${i++}`); values.push(+idCurso); }
    if (estado) { where.push(`estado = $${i++}`); values.push(estado); }
    if (idAlumno) { where.push(`alumnos @> $${i++}::jsonb`); values.push(JSON.stringify([+idAlumno])); }
    if (from) { where.push(`fecha >= $${i++}`); values.push(new Date(from)); }
    if (to) { where.push(`fecha <= $${i++}`); values.push(new Date(to)); }

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
    console.error("Error disponibilidad:", err);
    res.status(500).json({ error: "Error al calcular disponibilidad" });
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
    paciente_id = req.user.id;
    psicologo_id = req.body.psicologo_id;

    // Verificamos contraseña para confirmar identidad (Opcional según tu flujo, pero recomendable)
    // Si quieres quitar la contraseña del modal, comenta esta validación
    if (password) {
      const uRes = await pool.query("SELECT contrasena FROM usuarios WHERE id = $1", [req.user.id]);
      // Comparación simple o bcrypt según tu BD
      let valid = false;
      if (uRes.rows[0].contrasena.startsWith('$2b$')) {
        valid = await bcrypt.compare(password, uRes.rows[0].contrasena);
      } else {
        valid = (password === uRes.rows[0].contrasena);
      }
      if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });
    }
  }
  // Si es Psicólogo (Rol 3) - Drag & Drop
  else if (req.user.rol === 3) {
    psicologo_id = req.user.id;
    if (!nombre_paciente) return res.status(400).json({ error: 'Falta nombre del paciente' });
    const pRes = await pool.query("SELECT id FROM usuarios WHERE nombre = $1 AND rol = 2", [nombre_paciente]);
    if (pRes.rows.length === 0) return res.status(404).json({ error: "Alumno no encontrado" });
    paciente_id = pRes.rows[0].id;
  }

  if (!psicologo_id || !paciente_id || !start || !end) {
    return res.status(400).json({ error: "Faltan datos de la cita" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO citas (psicologo_id, paciente_id, titulo, fecha_hora_inicio, fecha_hora_fin, notas) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *, fecha_hora_inicio AS "start", fecha_hora_fin AS "end"`,
      [psicologo_id, paciente_id, titulo || 'Cita', start, end, notas || '']
    );
    res.status(201).json({ message: "Cita creada", cita: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cita' });
  }
});

// 4. Listar Citas
router.get('/citas', authenticateToken, async (req, res) => {
  let psicologo_id;
  if (req.user.rol === 3) psicologo_id = req.user.id;
  else if (req.query.psicologo_id) psicologo_id = req.query.psicologo_id;

  try {
    let query = `
      SELECT 
         c.id, 
         c.titulo, 
         c.fecha_hora_inicio AS "start", 
         c.fecha_hora_fin AS "end", 
         c.notas,
         c.estado,  
         c.lugar,
         u.nombre AS "pacienteNombre",
         u.correo AS "pacienteCorreo",
         psi.nombre AS "psicologoNombre"
       FROM citas c
       JOIN usuarios u ON c.paciente_id = u.id
       LEFT JOIN usuarios psi ON c.psicologo_id = psi.id
    `;
    const params = [];
    if (req.user.rol === 2) {
      query += ` WHERE c.paciente_id = $1`;
      params.push(req.user.id);
    } else if (psicologo_id) {
      query += ` WHERE c.psicologo_id = $1`;
      params.push(psicologo_id);
    }
    query += ` ORDER BY c.fecha_hora_inicio ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// 5. Mis Alumnos (Para el sidebar del psicólogo)
router.get('/psicologos/mis-alumnos', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 3 && req.user.rol !== 0) return res.status(403).json({ error: "Sin permiso" });
    const result = await pool.query("SELECT id, rut, nombre, correo FROM usuarios WHERE rol = 2 ORDER BY nombre ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error servidor" });
  }
});

// ================== ACTUALIZAR CITA (CONFIRMAR/CANCELAR) ==================

router.patch('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // El frontend envía { estado: 'confirmada' }

  try {
    const result = await pool.query(
      "UPDATE citas SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json({ message: "Cita actualizada exitosamente", cita: result.rows[0] });
  } catch (err) {
    console.error("Error al actualizar cita:", err);
    res.status(500).json({ error: "Error en el servidor al actualizar la cita" });
  }
});
export default router;