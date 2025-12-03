import { Router } from "express";
import jwt from "jsonwebtoken";
import pkg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const router = Router();

// Pool de conexión a Neon / Postgres
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

// ================== RUTAS PÚBLICAS ==================

router.get("/", (req, res) => {
  res.send("API conectada a Neon 🚀");
});

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

// ================== PERFIL ==================

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ================== USUARIOS ==================

router.get("/usuarios", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error en la consulta" });
  }
});

router.post("/usuarios/crear", authenticateToken, isAdmin, async (req, res) => {
  // ... (Lógica de creación existente)
  const { rol, rut, nombre, correo, contrasena } = req.body;
  // Validación básica omitida para brevedad, se mantiene igual
  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING id, rut, nombre, correo, rol",
      [rol, rut, nombre, correo, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

router.delete("/usuarios/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM curso_usuarios WHERE usuario_id = $1", [id]);
    await client.query("UPDATE incidentes SET creado_por = NULL WHERE creado_por = $1", [id]);
    const result = await client.query("DELETE FROM usuarios WHERE id = $1 RETURNING id", [id]);
    await client.query("COMMIT");
    if (result.rowCount === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al eliminar usuario" });
  } finally {
    client.release();
  }
});

// ================== PSICÓLOGOS ==================

router.get('/psicologos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE rol = 3 ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener psicólogos" });
  }
});

// LISTA DE ALUMNOS (Para el Sidebar del Psicólogo)
router.get('/psicologos/mis-alumnos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo FROM usuarios WHERE rol = 2 ORDER BY nombre ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener alumnos:", err);
    res.status(500).json({ error: "Error al cargar alumnos" });
  }
});

// DISPONIBILIDAD (Bloques 40 min)
router.get('/psicologos/:id/disponibilidad', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

  try {
    // Citas existentes
    const query = `
      SELECT fecha_hora_inicio, fecha_hora_fin 
      FROM citas 
      WHERE psicologo_id = $1 AND date(fecha_hora_inicio) = $2 AND estado != 'cancelada'
    `;
    const citasExistentes = await pool.query(query, [id, fecha]);

    // Generar bloques
    const slots = [];
    const duracionMinutos = 40;
    let horaActual = new Date(`${fecha}T09:00:00`);
    const horaFinDia = new Date(`${fecha}T18:00:00`);

    while (horaActual < horaFinDia) {
      const finBloque = new Date(horaActual.getTime() + duracionMinutos * 60000);
      const horaCheck = horaActual.getHours();
      // Break almuerzo 13-14
      if (horaCheck !== 13) {
        const isOccupied = citasExistentes.rows.some(cita => {
          const cIni = new Date(cita.fecha_hora_inicio);
          const cFin = new Date(cita.fecha_hora_fin);
          return (horaActual < cFin && finBloque > cIni);
        });
        if (!isOccupied) {
          slots.push({ start: horaActual.toISOString(), end: finBloque.toISOString() });
        }
      }
      horaActual = finBloque;
    }
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: "Error al calcular horarios" });
  }
});

// ================== CITAS ==================

// GET Citas (Inteligente)
router.get('/citas', authenticateToken, async (req, res) => {
  try {
    let whereClause = "";
    const values = [];

    if (req.user.rol === 2) { // Alumno
      whereClause = "WHERE c.paciente_id = $1";
      values.push(req.user.id);
    } else if (req.user.rol === 3) { // Psicólogo
      whereClause = "WHERE c.psicologo_id = $1";
      values.push(req.user.id);
    } else if (req.user.rol === 0) { // Admin
      if (req.query.psicologo_id) {
        whereClause = "WHERE c.psicologo_id = $1";
        values.push(req.query.psicologo_id);
      }
    }

    const query = `
      SELECT 
         c.id, 
         c.titulo, 
         c.fecha_hora_inicio AS "start", 
         c.fecha_hora_fin AS "end",
         c.notas,
         c.estado,  
         c.lugar,
         pac.nombre AS "pacienteNombre",
         pac.correo AS "pacienteCorreo",
         psi.nombre AS "psicologoNombre"
       FROM citas c
       LEFT JOIN usuarios pac ON c.paciente_id = pac.id
       LEFT JOIN usuarios psi ON c.psicologo_id = psi.id
       ${whereClause}
       ORDER BY c.fecha_hora_inicio ASC
    `;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener citas:', err);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// CREAR Cita
router.post('/citas/crear', authenticateToken, async (req, res) => {
  const { titulo, start, end, notas, nombre_paciente } = req.body;
  let psicologo_id, paciente_id;

  // Si es psicólogo creando cita (desde Dashboard)
  if (req.user.rol === 3) {
    psicologo_id = req.user.id;
    if (!nombre_paciente) return res.status(400).json({ error: 'Falta nombre_paciente' });
    const pacienteRes = await pool.query("SELECT id FROM usuarios WHERE nombre = $1 AND rol = 2", [nombre_paciente]);
    if (pacienteRes.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    paciente_id = pacienteRes.rows[0].id;

    // Si es alumno solicitando cita
  } else if (req.user.rol === 2) {
    paciente_id = req.user.id;
    if (!req.body.psicologo_id) return res.status(400).json({ error: 'Falta seleccionar psicólogo' });
    psicologo_id = req.body.psicologo_id;
  } else {
    return res.status(403).json({ error: 'Permiso denegado' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO citas (psicologo_id, paciente_id, titulo, fecha_hora_inicio, fecha_hora_fin, notas, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente') 
       RETURNING *`,
      [psicologo_id, paciente_id, titulo, start, end, notas || '']
    );
    res.status(201).json({ message: "Cita agendada", cita: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cita' });
  }
});

// ACTUALIZAR Cita (Confirmar) - LA RUTA QUE FALTABA
router.patch('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    // Si solo enviamos estado
    if (estado) {
      const result = await pool.query(
        "UPDATE citas SET estado = $1 WHERE id = $2 RETURNING *",
        [estado, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Cita no encontrada" });
      return res.json({ message: "Cita actualizada", cita: result.rows[0] });
    }

    res.status(400).json({ error: "Nada para actualizar" });
  } catch (err) {
    console.error("Error update cita:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// BORRAR Cita
router.delete('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [id]);
    res.json({ message: 'Cita eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ================== OTROS (Cursos, Incidentes, Encuestas) ==================
// Se mantienen las rutas básicas de cursos si las necesitas...
router.get("/cursos", authenticateToken, async (req, res) => {
  const result = await pool.query("SELECT * FROM cursos ORDER BY id");
  res.json(result.rows);
});

router.get("/cursos/:id/usuarios", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    "SELECT u.id, u.nombre, u.rut, u.rol FROM usuarios u JOIN curso_usuarios cu ON u.id = cu.usuario_id WHERE cu.curso_id = $1",
    [id]
  );
  res.json(result.rows);
});

export default router;