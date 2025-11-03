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

// ================== RUTAS ==================

// Ruta de prueba
router.get("/", (req, res) => {
  res.send("API conectada a Neon 🚀");
});

// Login
router.post("/login", async (req, res) => {
  const { rut, contrasena } = req.body;
  if (!rut || !contrasena) return res.status(400).json({ error: "Falta rut o contraseña" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut = $1", [rut]);

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    let validPassword = false;
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
      message: "Inicio de sesión exitoso 🚀",
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

// Obtener todos los usuarios
router.get("/usuarios", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

// Crear usuario
router.post("/usuarios/crear", async (req, res) => {
  const { rol, rut, nombre, correo, contraseña } = req.body;

  if (rol !== 0) return res.status(400).json({ error: "El usuario no es administrador" });

  try {
    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contraseña) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [rol, rut, nombre, correo, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error en crear usuario:", err);
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

// Cambiar contraseña
router.post("/usuarios/cambiar-contraseña", async (req, res) => {
  const { id, nuevaContraseña } = req.body;
  if (!id || !nuevaContraseña) return res.status(400).json({ error: "Faltan datos" });

  try {
    const hashedPassword = await bcrypt.hash(nuevaContraseña, 10);
    const result = await pool.query(
      "UPDATE usuarios SET contraseña = $1 WHERE id = $2 RETURNING *",
      [hashedPassword, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      message: "Contraseña actualizada con éxito 🚀",
      usuario: result.rows[0],
    });
  } catch (err) {
    console.error("Error al cambiar contraseña:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== CURSOS ==================

// Crear curso
router.post("/cursos/crear", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta el nombre del curso" });

  try {
    const result = await pool.query(
      "INSERT INTO cursos (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.status(201).json({ message: "Curso creado con éxito 🚀", curso: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El curso ya existe" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener cursos
router.get("/cursos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cursos ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// Asignar usuario a curso
router.post("/cursos/:cursoId/usuarios/:usuarioId", async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  try {
    const userCheck = await pool.query("SELECT * FROM usuarios WHERE id = $1", [usuarioId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

    const usuario = userCheck.rows[0];
    if (usuario.rol !== 2) return res.status(400).json({ error: "Solo rol=2 puede asignarse a cursos" });

    const result = await pool.query(
      "INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1, $2) RETURNING *",
      [usuarioId, cursoId]
    );

    res.json({ message: "Usuario asignado al curso con éxito 🚀", asignacion: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El usuario ya está en este curso" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ===================== INCIDENTES (INTEGRADO AQUÍ) =====================

// Validación de payload de incidente
function assertIncidentePayload(body) {
  const errors = [];
  const required = ["idCurso", "tipo", "severidad", "descripcion"];
  for (const k of required) if (!body[k]) errors.push(`Falta ${k}`);
  if ((body.descripcion || "").length < 10) errors.push("La descripción debe tener al menos 10 caracteres");
  if (errors.length) { const e = new Error("Payload inválido"); e.code = 400; e.details = errors; throw e; }
}

// Crear incidente
app.post('/api/incidentes', authenticateToken, async (req, res) => {
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

    // Si es docente (rol=3) debe pertenecer al curso
    if (req.user?.rol === 1) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE id_usuario = $1 AND id_curso = $2`,
        [req.user.id, idCurso]
      );
      if (check.rowCount === 0) {
        return res.status(403).json({ error: "No puedes registrar incidentes en un curso que no te corresponde." });
      }
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

// Listar incidentes (filtros + paginación)
app.get('/api/incidentes', authenticateToken, async (req, res) => {
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

    // Docente: limitar a cursos donde participa
    if (req.user?.rol === 1) {
      where.push(`id_curso IN (SELECT id_curso FROM curso_usuarios WHERE id_usuario = $${i++})`);
      values.push(req.user.id);
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

// Detalle por ID
app.get('/api/incidentes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM incidentes WHERE id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "No encontrado" });

    // Docente: verificar que pertenece al curso
    if (req.user?.rol === 3) {
      const check = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE id_usuario = $1 AND id_curso = $2`,
        [req.user.id, r.rows[0].id_curso]
      );
      if (check.rowCount === 0) return res.status(403).json({ error: "Sin permisos" });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar incidente (parcial)
app.patch('/api/incidentes/:id', authenticateToken, async (req, res) => {
  try {
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

    // Docente: alcance por curso
    if (req.user?.rol === 1) {
      const check = await pool.query(`SELECT id_curso FROM incidentes WHERE id = $1`, [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: "No encontrado" });
      const belongs = await pool.query(
        `SELECT 1 FROM curso_usuarios WHERE id_usuario = $1 AND id_curso = $2`,
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

  const userExists = await User.findOne({ email });
  if (!userExists) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, resetUrl }),
    });
  } catch (err) {
    console.error("Error al enviar correo con n8n:", err);
    return res.status(500).json({ error: "No se pudo enviar el correo" });
  }

  res.json({ message: "Correo de recuperación enviado correctamente" });
});



export default router;
