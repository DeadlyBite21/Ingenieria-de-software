import { Router } from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import pkg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const router = Router();

// ================== DB CONNECTION ==================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================== JWT MIDDLEWARE ==================
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

// ================== RUTAS BASE ==================
router.get("/", (req, res) => {
  res.send("API conectada a Neon 🚀");
});

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
  const { rut, contrasena } = req.body;
  if (!rut || !contrasena) return res.status(400).json({ error: "Falta rut o contraseña" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut = $1", [rut]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    let validPassword = false;

    if (usuario.contrasena?.startsWith?.("$2b$")) {
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
      message: "Inicio de sesión exitoso 🚀",
      usuario: {
        id: usuario.id,
        rut: usuario.rut,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      },
      token
    });
  } catch {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== USUARIOS ==================
router.get("/usuarios", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM usuarios ORDER BY id");
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/usuarios/crear", authenticateToken, async (req, res) => {
  const { rol, rut, nombre, correo, contraseña } = req.body;
  if (req.user.rol !== 0) return res.status(403).json({ error: "Solo admin puede crear usuarios" });

  try {
    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const r = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [rol, rut, nombre, correo, hashedPassword]
    );
    res.status(201).json(r.rows[0]);
  } catch {
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// ================== CURSOS ==================
router.post("/cursos/crear", authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: "Solo admin puede crear cursos" });

  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta nombre" });

  try {
    const r = await pool.query("INSERT INTO cursos (nombre) VALUES ($1) RETURNING *", [nombre]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Curso ya existe" });
    res.status(500).json({ error: "Error al crear curso" });
  }
});

router.get("/cursos", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM cursos ORDER BY id");
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

router.post("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, async (req, res) => {
  if (req.user.rol !== 0) return res.status(403).json({ error: "Solo admin puede asignar" });

  const { cursoId, usuarioId } = req.params;

  try {
    const user = await pool.query("SELECT * FROM usuarios WHERE id = $1", [usuarioId]);
    if (!user.rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.rows[0].rol !== 2) return res.status(400).json({ error: "Solo rol=2 puede asignarse" });

    const r = await pool.query(
      "INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1,$2) RETURNING *",
      [usuarioId, cursoId]
    );
    res.json(r.rows[0]);
  } catch {
    res.status(500).json({ error: "Error al asignar usuario" });
  }
});

// ================== INCIDENTES ==================
function assertIncidentePayload(body) {
  const errors = [];
  const required = ["idCurso", "tipo", "severidad", "descripcion"];
  for (const k of required) if (!body[k]) errors.push(`Falta ${k}`);
  if ((body.descripcion || "").length < 10) errors.push("Descripción mínima 10 chars");
  if (errors.length) {
    const e = new Error("Payload inválido");
    e.code = 400;
    e.details = errors;
    throw e;
  }
}

// Crear incidente
router.post("/incidentes", authenticateToken, async (req, res) => {
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

    const r = await pool.query(
      `INSERT INTO incidentes
        (alumnos,id_curso,tipo,severidad,descripcion,lugar,fecha,participantes,medidas,adjuntos,estado,creado_por,creado_en,actualizado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING *`,
      [
        JSON.stringify(alumnos), idCurso, tipo, severidad, descripcion, lugar,
        fecha, JSON.stringify(participantes), JSON.stringify(medidas),
        JSON.stringify(adjuntos), estado, req.user.id
      ]
    );

    res.json({ message: "Incidente creado ✅", data: r.rows[0] });
  } catch (e) {
    res.status(e.code || 500).json({ error: e.message, details: e.details });
  }
});

// Listar incidentes
router.get("/incidentes", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM incidentes ORDER BY fecha DESC");
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: "Error al listar incidentes" });
  }
});

// Detalle incidente
router.get("/incidentes/:id", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM incidentes WHERE id = $1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(r.rows[0]);
  } catch {
    res.status(500).json({ error: "Error al obtener incidente" });
  }
});

// Actualizar incidente
router.patch("/incidentes/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const keys = Object.keys(updates);

    if (!keys.length) return res.status(400).json({ error: "Nada para actualizar" });

    const set = keys.map((key, i) => `${key} = $${i + 1}`).join(",");
    const values = [...Object.values(updates), id];

    const r = await pool.query(
      `UPDATE incidentes SET ${set}, actualizado_en = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      values
    );

    if (!r.rows.length) return res.status(404).json({ error: "No encontrado" });

    res.json({ message: "Incidente actualizado ✅", data: r.rows[0] });
  } catch {
    res.status(500).json({ error: "Error al actualizar" });
  }
});

export default router;
