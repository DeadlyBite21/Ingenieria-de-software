// backend/api.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();

// Configuración de CORS más específica
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Pool de conexión a Neon / Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // En Neon suele ser necesario SSL:
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

// Middleware de autenticación (JWT)
const authenticateToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, process.env.JWT_SECRET || 'secreto123', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user; // { id, rut, rol }
    next();
  });
};

// ========================= RUTAS BASE =========================

// RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send('API conectada a Postgres 🚀');
});

// Login
app.post('/api/login', async (req, res) => {
  const { rut, contrasena } = req.body;

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut = $1", [rut]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];

    // Comparar contraseña (soporta hash bcrypt o texto plano)
    let validPassword = false;
    if (usuario.contrasena?.startsWith?.('$2b$')) {
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
      validPassword = usuario.contrasena === contrasena;
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

// Perfil del usuario autenticado
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Obtener todos los usuarios
app.get('/api/usuarios', async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM usuarios ORDER BY id");
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

// Crear usuario (solo administradores)
app.post('/api/usuarios/crear', authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });

  const { rol, rut, nombre, correo, contrasena } = req.body;
  try {
    const hashed = await bcrypt.hash(contrasena, 10);
    const r = await pool.query(
      'INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [rol, rut, nombre, correo, hashed]
    );
    res.json({ message: "Usuario creado con éxito 🚀", usuario: r.rows[0] });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Eliminar usuario (solo administradores)
app.delete('/api/usuarios/:id', authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios' });

  try {
    const r = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado exitosamente', usuario: r.rows[0] });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Crear curso (solo administradores)
app.post('/api/cursos/crear', authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: 'Solo los administradores pueden crear cursos' });
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta el nombre del curso" });

  try {
    const r = await pool.query("INSERT INTO cursos (nombre) VALUES ($1) RETURNING *", [nombre]);
    res.status(201).json({ message: "Curso creado con éxito 🚀", curso: r.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El curso ya existe" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Obtener cursos (autenticados)
app.get('/api/cursos', authenticateToken, async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM cursos ORDER BY id");
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// Asignar usuario a curso (solo administradores)
app.post('/api/cursos/:cursoId/usuarios/:usuarioId', authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: 'Solo los administradores pueden asignar usuarios a cursos' });
  const { cursoId, usuarioId } = req.params;

  try {
    const u = await pool.query('SELECT 1 FROM usuarios WHERE id = $1', [usuarioId]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const c = await pool.query('SELECT 1 FROM cursos WHERE id = $1', [cursoId]);
    if (c.rowCount === 0) return res.status(404).json({ error: 'Curso no encontrado' });

    const r = await pool.query(
      "INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1, $2) RETURNING *",
      [usuarioId, cursoId]
    );

    res.json({ message: "Usuario asignado al curso con éxito 🚀", asignacion: r.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "El usuario ya está en este curso" });
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Desasignar usuario de curso (solo administradores)
app.delete('/api/cursos/:cursoId/usuarios/:usuarioId', authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: 'Solo los administradores pueden desasignar usuarios' });

  try {
    const r = await pool.query(
      'DELETE FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2 RETURNING *',
      [req.params.usuarioId, req.params.cursoId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Asignación no encontrada' });
    res.json({ message: 'Usuario desasignado del curso exitosamente' });
  } catch (err) {
    console.error('Error al desasignar usuario:', err);
    res.status(500).json({ error: 'Error al desasignar usuario' });
  }
});

// Obtener usuarios asignados a un curso
app.get('/api/cursos/:id/alumnos', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.rut, u.nombre, u.correo, u.rol 
      FROM usuarios u 
      INNER JOIN curso_usuarios cu ON u.id = cu.usuario_id 
      WHERE cu.curso_id = $1
      ORDER BY u.nombre
    `, [req.params.id]);
    res.json(r.rows);
  } catch (err) {
    console.error('Error al obtener alumnos del curso:', err);
    res.status(500).json({ error: 'Error al obtener alumnos del curso' });
  }
});

// Recuperación de contraseña (via webhook n8n)
app.post("/recover-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el email" });

  // TODO: validar que el email exista en la base
  const token = jwt.sign({ email }, process.env.JWT_SECRET || "secreto123", { expiresIn: "15m" });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, resetUrl }),
    });
    res.json({ message: "Correo de recuperación enviado correctamente" });
  } catch (err) {
    console.error("Error al enviar correo con n8n:", err);
    res.status(500).json({ error: "No se pudo enviar el correo" });
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
    if (req.user?.rol === 3) {
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
    if (req.user?.rol === 3) {
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
    if (req.user?.rol === 3) {
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

// ========================= ARRANQUE =========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Frontend esperado en: http://localhost:5173`);
  console.log(`🌐 API disponible en: http://localhost:${PORT}`);
  console.log(`🔍 Prueba la API: http://localhost:${PORT}/api/usuarios`);
});
