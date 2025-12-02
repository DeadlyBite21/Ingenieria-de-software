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

// ================== RUTAS ==================

router.get("/", (req, res) => res.send("API conectada a Neon"));

// Login
router.post("/login", async (req, res) => {
  const { identificador, contrasena } = req.body;
  if (!identificador || !contrasena) return res.status(400).json({ error: "Falta rut o contraseña" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut::text = $1 OR correo = $1", [identificador]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    let validPassword = false;
    if (usuario.contrasena?.startsWith?.('$2b$')) {
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
      validPassword = String(usuario.contrasena).trim() === contrasena;
    }

    if (!validPassword) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: usuario.id, rut: usuario.rut, rol: usuario.rol }, process.env.JWT_SECRET || "secreto123", { expiresIn: "1h" });

    res.json({
      message: "Inicio de sesión exitoso",
      usuario: { id: usuario.id, rut: usuario.rut, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1", [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// ... (Endpoints de Usuarios, Cursos, Incidentes se mantienen igual, omitidos por brevedad pero NO los borres) ...
// Puedes mantener el código anterior de usuarios/cursos/incidentes aquí.

// ================== CITAS Y DISPONIBILIDAD (LÓGICA NUEVA) ==================

// 1. Obtener Psicólogos
router.get('/psicologos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE rol = 3 ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener psicólogos" });
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

    const horasOcupadas = new Set(citasOcupadas.rows.map(r => r.hora_inicio));

    const slotsDisponibles = bloquesPosibles
      .filter(hora => !horasOcupadas.has(hora))
      .map(hora => {
        const start = new Date(`${fecha}T${hora}:00`);
        const end = new Date(start.getTime() + duracionBloque * 60 * 1000);
        return { start, end };
      });

    res.json(slotsDisponibles);

  } catch (err) {
    console.error("Error disponibilidad:", err);
    res.status(500).json({ error: "Error al calcular disponibilidad" });
  }
});

// 3. Crear Cita
router.post('/citas/crear', authenticateToken, async (req, res) => {
  const { titulo, start, end, notas, password, nombre_paciente } = req.body;
  let psicologo_id;
  let paciente_id;

  // Si es Alumno (Rol 2)
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