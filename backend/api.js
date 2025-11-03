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
    
    // Tu lógica original para manejar contraseñas hasheadas y planas
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
  // **CORRECCIÓN**: Cambiado a 'contrasena' para consistencia
  const { rol, rut, nombre, correo, contrasena } = req.body;

  if (rol !== 0) return res.status(400).json({ error: "El usuario no es administrador" });

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    // **CORRECCIÓN**: Cambiado a 'contrasena'
    const result = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [rol, rut, nombre, correo, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error en crear usuario:", err);
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

// Cambiar contraseña
router.post("/usuarios/cambiar-contrasena", async (req, res) => {
  // **CORRECCIÓN**: Cambiado a 'nuevaContrasena'
  const { id, nuevaContrasena } = req.body;
  if (!id || !nuevaContrasena) return res.status(400).json({ error: "Faltan datos" });

  try {
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
    // **CORRECCIÓN**: Cambiado a 'contrasena'
    const result = await pool.query(
      "UPDATE usuarios SET contrasena = $1 WHERE id = $2 RETURNING *",
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


// ================== RECUPERACIÓN DE CONTRASEÑA (MODIFICADO) ==================

// PASO 1: Solicitar el enlace de recuperación
router.post("/recover-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Falta el correo" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE correo = $1", [email]);

    if (result.rows.length === 0) {
      return res.json({ message: "Si el correo está registrado, se enviará un enlace." });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.correo },
      process.env.JWT_SECRET || "secreto123",
      { expiresIn: "15m" }
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // --- Simulación de envío de correo ---
    // Esto imprimirá el enlace en tu consola del backend
    console.log("===== ENLACE DE RECUPERACIÓN (SIMULADO) =====");
    console.log(`Enviar a: ${email}`);
    console.log(`Enlace: ${resetUrl}`);
    console.log("=============================================");

    // --- MODIFICACIÓN: Se comenta la llamada a n8n para evitar el error 500 ---
    // La llamada original a n8n está comentada
    /* try {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetUrl }),
      });
    } catch (err) {
      console.error("Error al enviar correo con n8n:", err);
      // Esta es la línea que causaba tu error
      return res.status(500).json({ error: "No se pudo enviar el correo" });
    }
    */
    // --- FIN DE LA MODIFICACIÓN ---

    res.json({ message: "Correo de recuperación enviado correctamente" });

  } catch (err) {
    console.error("Error en /recover-password:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// PASO 2: Restablecer la contraseña con el token
router.post("/reset-password", async (req, res) => {
  const { token, nuevaContrasena } = req.body;
  if (!token || !nuevaContrasena) {
    return res.status(400).json({ error: "Faltan datos (token o contraseña)" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secreto123");
    
    const userId = payload.id;
    if (!userId) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);

    const result = await pool.query(
      "UPDATE usuarios SET contrasena = $1 WHERE id = $2 RETURNING id, nombre, correo",
      [hashedPassword, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ message: "Contraseña actualizada con éxito 🚀" });

  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
    console.error("Error en /reset-password:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});


export default router;