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

// === FUNCIÓN AUXILIAR PARA VERIFICAR SOLAPAMIENTO ===
const checkSolapamiento = async (psicologo_id, start, end, excludeCitaId = null) => {
  // Convertimos a objetos Date para asegurar comparación numérica
  const newStart = new Date(start);
  const newEnd = new Date(end);

  // Buscamos citas activas (no canceladas) de este psicólogo
  let query = `
    SELECT id, fecha_hora_inicio, fecha_hora_fin 
    FROM citas 
    WHERE psicologo_id = $1 
    AND estado != 'cancelada'
    AND (
      (fecha_hora_inicio < $3 AND fecha_hora_fin > $2) -- Lógica de intersección
    )
  `;
  const params = [psicologo_id, newStart.toISOString(), newEnd.toISOString()];

  if (excludeCitaId) {
    query += ` AND id != $4`;
    params.push(excludeCitaId);
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0; // Retorna true si hay conflicto
};

// ================== RUTAS PÚBLICAS ==================

router.get("/", (req, res) => res.send("API conectada a Neon 🚀"));

router.post("/login", async (req, res) => {
  const { identificador, contrasena } = req.body;
  if (!identificador || !contrasena) return res.status(400).json({ error: "Falta rut o contraseña" });

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut::text = $1 OR correo = $1", [identificador]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];

    // Verificar bloqueo
    if (usuario.bloqueado_hasta) {
      const ahora = new Date();
      const bloqueo = new Date(usuario.bloqueado_hasta);
      if (ahora < bloqueo) {
        const minutosRestantes = Math.ceil((bloqueo - ahora) / 60000);
        return res.status(403).json({ error: `Cuenta bloqueada. Intente en ${minutosRestantes} minutos.` });
      }
    }

    let validPassword = false;
    if (usuario.contrasena?.startsWith?.('$2b$')) {
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
      validPassword = String(usuario.contrasena).trim() === contrasena;
    }

    if (!validPassword) {
      const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;
      if (nuevosIntentos >= 3) {
        const tiempoBloqueo = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query("UPDATE usuarios SET intentos_fallidos = $1, bloqueado_hasta = $2 WHERE id = $3", [nuevosIntentos, tiempoBloqueo, usuario.id]);
        return res.status(403).json({ error: "Has excedido los 3 intentos. Cuenta bloqueada por 15 minutos." });
      } else {
        await pool.query("UPDATE usuarios SET intentos_fallidos = $1 WHERE id = $2", [nuevosIntentos, usuario.id]);
        return res.status(401).json({ error: `Contraseña incorrecta. Te quedan ${3 - nuevosIntentos} intentos.` });
      }
    }

    await pool.query("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1", [usuario.id]);

    const token = jwt.sign({ id: usuario.id, rut: usuario.rut, rol: usuario.rol }, process.env.JWT_SECRET || "secreto123", { expiresIn: "1h" });

    res.json({
      message: "Inicio de sesión exitoso",
      usuario: { id: usuario.id, rut: usuario.rut, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
      token,
    });
  } catch (err) {
    console.error("Error login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/recover-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });
  // Lógica de envío de correo simulada
  res.json({ message: "Correo de recuperación enviado (simulado)" });
});

router.post("/reset-password", async (req, res) => {
  const { token, nuevaContrasena } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
    // Aquí iría la validación real del token y actualización
    res.json({ message: "Contraseña actualizada (simulado)" });
  } catch (e) {
    res.status(500).json({ error: "Error al resetear password" });
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
  const { rol, rut, nombre, correo, contrasena } = req.body;

  // Rol: 0=Admin, 1=Profesor, 2=Alumno, 3=Psicólogo
  if (![0, 1, 2, 3].includes(rol) || !rut || !nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Faltan datos o rol inválido" });
  }
  if (contrasena.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  if (contrasena.includes(' ')) return res.status(400).json({ error: "La contraseña no puede contener espacios" });
  if (!/[%&\$#@!]/.test(contrasena)) return res.status(400).json({ error: "Falta un carácter especial (%&$#@!)" });

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING id, rut, nombre, correo, rol",
      [rol, rut, nombre, correo, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "RUT o Correo ya registrado" });
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

router.delete("/usuarios/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(req.user.id) === parseInt(id)) return res.status(400).json({ error: "No puedes eliminarte a ti mismo." });

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

// Conteo de alumnos por curso (Optimizado)
router.get('/cursos/conteo-alumnos', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Contamos solo usuarios con rol 2 (Alumnos) en cada curso
    const result = await pool.query(
      `SELECT cu.curso_id, COUNT(*)::int AS total 
       FROM curso_usuarios cu
       JOIN usuarios u ON cu.usuario_id = u.id
       WHERE u.rol = 2
       GROUP BY cu.curso_id`
    );
    const stats = {};
    result.rows.forEach(r => {
      stats[r.curso_id] = r.total;
    });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Listar alumnos (Admin o Psicólogo)
router.get("/alumnos", authenticateToken, async (req, res) => {
  // Solo admin (0) o psicólogo (3)
  if (req.user.rol !== 0 && req.user.rol !== 3) {
    return res.status(403).json({ error: "Sin permisos para ver alumnos" });
  }

  try {
    const result = await pool.query(
      "SELECT id, rut, nombre, correo FROM usuarios WHERE rol = 2 ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener alumnos:", err);
    res.status(500).json({ error: "Error al obtener alumnos" });
  }
});

// ================== CURSOS ==================

router.get("/cursos", authenticateToken, async (req, res) => {
  try {
    // Si es admin, ve todos los cursos
    if (req.user.rol === 0 || req.user.rol === 3) {
      const result = await pool.query("SELECT * FROM cursos ORDER BY id");
      return res.json(result.rows);
    }
    const result = await pool.query(
      `SELECT c.* FROM cursos c JOIN curso_usuarios cu ON c.id = cu.curso_id WHERE cu.usuario_id = $1 ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

router.post("/cursos/crear", authenticateToken, isAdmin, async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await pool.query("INSERT INTO cursos (nombre) VALUES ($1) RETURNING *", [nombre]);
    res.status(201).json({ message: "Curso creado", curso: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Error al crear curso" });
  }
});

router.delete("/cursos/:id", authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM curso_usuarios WHERE curso_id = $1", [id]);
    await client.query("DELETE FROM incidentes WHERE id_curso = $1", [id]);
    await client.query("DELETE FROM cursos WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.json({ message: "Curso eliminado" });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al eliminar curso" });
  } finally {
    client.release();
  }
});

router.post("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;
  try {
    const u = await pool.query("SELECT rol FROM usuarios WHERE id = $1", [usuarioId]);
    if (u.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    if (u.rows[0].rol === 0 || u.rows[0].rol === 3) return res.status(400).json({ error: "Rol no asignable a curso" });

    await pool.query("INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1, $2)", [usuarioId, cursoId]);
    res.json({ message: "Usuario asignado" });
  } catch (e) {
    res.status(500).json({ error: "Error al asignar" });
  }
});

router.delete("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;
  try {
    await pool.query("DELETE FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2", [usuarioId, cursoId]);
    res.json({ message: "Usuario desasignado" });
  } catch (e) {
    res.status(500).json({ error: "Error al desasignar" });
  }
});

// Obtener usuarios de un curso (Admin, Profesores y Psicólogos)
router.get("/cursos/:cursoId/usuarios", authenticateToken, async (req, res) => {
  const { cursoId } = req.params;
  // Permitimos Admin(0), Profesor(1), Psicólogo(3)
  if (![0, 1, 3].includes(req.user.rol)) return res.status(403).json({ error: "Acceso denegado." });

  try {
    if (req.user.rol === 1) {
      const check = await pool.query("SELECT 1 FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2", [req.user.id, cursoId]);
      if (check.rowCount === 0) return res.status(403).json({ error: "No tienes acceso a este curso." });
    }
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.rut, u.rol FROM usuarios u JOIN curso_usuarios cu ON u.id = cu.usuario_id WHERE cu.curso_id = $1`,
      [cursoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// ===================== INCIDENTES =====================

// --- NUEVO ENDPOINT: CONTEO (Debe ir ANTES de /incidentes/:id) ---
router.get('/incidentes/conteo', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_curso, COUNT(*)::int AS total FROM incidentes GROUP BY id_curso'
    );
    const stats = {};
    result.rows.forEach(r => {
      stats[r.id_curso] = r.total;
    });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// -------------------------------------------------------------

router.get('/incidentes', authenticateToken, async (req, res) => {
  try {
    const { idCurso, estado } = req.query;
    const values = [];
    let where = [];
    let i = 1;
    if (idCurso) { where.push(`id_curso = $${i++}`); values.push(idCurso); }
    if (estado) { where.push(`estado = $${i++}`); values.push(estado); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM incidentes ${whereSQL} ORDER BY fecha DESC`, values);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (e) {
    res.status(500).json({ error: "Error al listar incidentes" });
  }
});

router.post('/incidentes', authenticateToken, async (req, res) => {
  if (req.user.rol === 2) return res.status(403).json({ error: "Sin permisos" });
  const { idCurso, tipo, severidad, descripcion, lugar, fecha, alumnos } = req.body;
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

// ================== AGENDA PSICÓLOGO / CITAS ==================
// Gestión de citas entre alumnos (rol 2) y psicólogos (rol 3).

const ESTADOS_CITA = ["pendiente", "confirmada", "realizada", "cancelada"];

// Bloques válidos de lunes a viernes (colación 12:45–14:00 bloqueada)
const SLOTS_VALIDOS = [
  { inicio: "09:00", fin: "09:30" },
  { inicio: "09:45", fin: "10:15" },
  { inicio: "10:30", fin: "11:00" },
  { inicio: "11:15", fin: "11:45" },
  { inicio: "12:00", fin: "12:30" },

  { inicio: "14:00", fin: "14:30" },
  { inicio: "14:45", fin: "15:15" },
  { inicio: "15:30", fin: "16:00" },
  { inicio: "16:15", fin: "16:45" },
];

// ---------- Helper: validar que la cita caiga en un bloque válido ----------
function validarHorarioCita(inicio, fin) {
  if (!(inicio instanceof Date) || isNaN(inicio) || !(fin instanceof Date) || isNaN(fin)) {
    return "Fechas inválidas";
  }

  // Debe ser el mismo día
  if (
    inicio.getFullYear() !== fin.getFullYear() ||
    inicio.getMonth() !== fin.getMonth() ||
    inicio.getDate() !== fin.getDate()
  ) {
    return "La cita debe comenzar y terminar el mismo día";
  }

  // Solo lunes a viernes (1–5)
  const dia = inicio.getDay(); // 0=Domingo, 6=Sábado
  if (dia === 0 || dia === 6) {
    return "No se pueden agendar citas sábado ni domingo";
  }

  const pad = (n) => n.toString().padStart(2, "0");
  const inicioHM = `${pad(inicio.getHours())}:${pad(inicio.getMinutes())}`;
  const finHM = `${pad(fin.getHours())}:${pad(fin.getMinutes())}`;

  const esSlotValido = SLOTS_VALIDOS.some(
    (slot) => slot.inicio === inicioHM && slot.fin === finHM
  );

  if (!esSlotValido) {
    return "La cita debe coincidir exactamente con uno de los bloques disponibles";
  }

  return null; // OK
}

// ---------- GET /citas  (listar citas con filtros básicos) ----------
router.get("/citas", authenticateToken, async (req, res) => {
  if (req.user.rol === 1) {
    return res.status(403).json({ error: "Este rol no puede ver citas psicológicas" });
  }

  const { estado, from, to, idAlumno } = req.query;

  const where = [];
  const values = [];
  let i = 1;

  // Filtro por rol
  if (req.user.rol === 0) {
    // Admin: sin filtro especial
  } else if (req.user.rol === 3) {
    where.push(`psicologo_id = $${i++}`);
    values.push(req.user.id);
  } else if (req.user.rol === 2) {
    where.push(`paciente_id = $${i++}`);
    values.push(req.user.id);
  }

  // Filtros adicionales
  if (estado) {
    if (!ESTADOS_CITA.includes(estado)) {
      return res.status(400).json({ error: "Estado de cita inválido" });
    }
    where.push(`estado = $${i++}`);
    values.push(estado);
  }

  if (from) {
    where.push(`fecha_hora_inicio >= $${i++}`);
    values.push(new Date(from));
  }

  if (to) {
    where.push(`fecha_hora_inicio <= $${i++}`);
    values.push(new Date(to));
  }

  if (idAlumno && req.user.rol === 0) {
    where.push(`paciente_id = $${i++}`);
    values.push(Number(idAlumno));
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const q = `
      SELECT *
      FROM citas
      ${whereSQL}
      ORDER BY fecha_hora_inicio ASC
    `;
    const result = await pool.query(q, values);
    res.json(result.rows);
  } catch (e) {
    console.error("Error al listar citas:", e);
    res.status(500).json({ error: "Error en el servidor al listar citas" });
  }
});

// Crear una nueva cita (Alumno, Admin o Psicólogo)
router.post("/citas", authenticateToken, async (req, res) => {
  try {
    // Solo admin (0), alumno (2) y psicólogo (3) pueden agendar
    if (![0, 2, 3].includes(req.user.rol)) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para agendar citas." });
    }

    const {
      psicologoId,
      pacienteId,        // id del alumno (cuando agenda admin o psicólogo)
      fechaHoraInicio,
      fechaHoraFin,
      motivo,
      lugar,
    } = req.body;

    if (!psicologoId || !fechaHoraInicio || !fechaHoraFin) {
      return res.status(400).json({
        error:
          "psicologoId, fechaHoraInicio y fechaHoraFin son obligatorios.",
      });
    }

    const inicio = new Date(fechaHoraInicio);
    const fin = new Date(fechaHoraFin);

    // Validar que el horario calce con un bloque permitido
    const errorHorario = validarHorarioCita(inicio, fin);
    if (errorHorario) {
      return res.status(400).json({ error: errorHorario });
    }

    // Validar que el psicólogo exista y sea rol 3
    const psico = await pool.query(
      "SELECT id FROM usuarios WHERE id = $1 AND rol = 3",
      [psicologoId]
    );
    if (psico.rowCount === 0) {
      return res.status(400).json({ error: "Psicólogo inválido." });
    }

    // Determinar paciente:
    // - Alumno (2): siempre él mismo
    // - Admin (0) o Psicólogo (3): debe venir pacienteId en el body
    let idPaciente = req.user.id;
    if (req.user.rol === 0 || req.user.rol === 3) {
      if (!pacienteId) {
        return res.status(400).json({
          error:
            "pacienteId es obligatorio cuando agenda un administrador o un psicólogo.",
        });
      }
      idPaciente = Number(pacienteId);
    }

    // Verificar que el bloque no esté ocupado para ese psicólogo
    const choque = await pool.query(
      `SELECT 1
       FROM citas
       WHERE psicologo_id = $1
         AND fecha_hora_inicio < $3
         AND fecha_hora_fin > $2
         AND estado <> 'cancelada'`,
      [psicologoId, inicio, fin]
    );
    if (choque.rowCount > 0) {
      return res.status(409).json({ error: "Ese bloque ya está ocupado." });
    }

    // Crear la cita
    const result = await pool.query(
      `INSERT INTO citas
        (psicologo_id, paciente_id, fecha_hora_inicio, fecha_hora_fin, motivo, lugar, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
       RETURNING *`,
      [psicologoId, idPaciente, inicio, fin, motivo || null, lugar || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error("Error al crear cita:", e);
    res
      .status(500)
      .json({ error: "Error en el servidor al crear la cita." });
  }
});

// ---------- PATCH /citas/:id (estado / conclusión) ----------
router.patch("/citas/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado, conclusion } = req.body;

  if (req.user.rol !== 0 && req.user.rol !== 3) {
    return res.status(403).json({ error: "Solo admin o psicólogo pueden editar la cita" });
  }

  if (estado && !ESTADOS_CITA.includes(estado)) {
    return res.status(400).json({ error: "Estado de cita inválido" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE citas
      SET
        estado = COALESCE($2, estado),
        conclusion = COALESCE($3, conclusion)
      WHERE id = $1
      RETURNING *
      `,
      [id, estado || null, conclusion ?? null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (e) {
    console.error("Error al actualizar cita:", e);
    res.status(500).json({ error: "Error en el servidor al actualizar cita" });
  }
});


// ---------- GET /citas/disponibilidad  (slots del día para un psicólogo) ----------
router.get("/citas/disponibilidad", authenticateToken, async (req, res) => {
  const { psicologoId, fecha } = req.query;

  if (!psicologoId || !fecha) {
    return res.status(400).json({ error: "psicologoId y fecha son obligatorios" });
  }

  // Profesor no ve esto
  if (req.user.rol === 1) {
    return res.status(403).json({ error: "Este rol no puede ver disponibilidad" });
  }

  const SLOTS = [
    { id: "09:00-09:30", label: "09:00 - 09:30", inicio: "09:00", fin: "09:30" },
    { id: "09:45-10:15", label: "09:45 - 10:15", inicio: "09:45", fin: "10:15" },
    { id: "10:30-11:00", label: "10:30 - 11:00", inicio: "10:30", fin: "11:00" },
    { id: "11:15-11:45", label: "11:15 - 11:45", inicio: "11:15", fin: "11:45" },
    { id: "12:00-12:30", label: "12:00 - 12:30", inicio: "12:00", fin: "12:30" },
    { id: "14:00-14:30", label: "14:00 - 14:30", inicio: "14:00", fin: "14:30" },
    { id: "14:45-15:15", label: "14:45 - 15:15", inicio: "14:45", fin: "15:15" },
    { id: "15:30-16:00", label: "15:30 - 16:00", inicio: "15:30", fin: "16:00" },
    { id: "16:15-16:45", label: "16:15 - 16:45", inicio: "16:15", fin: "16:45" },
  ];

  try {
    const dayStart = new Date(`${fecha}T00:00:00`);
    const dayEnd   = new Date(`${fecha}T23:59:59.999`);

    const result = await pool.query(
      `
      SELECT fecha_hora_inicio, fecha_hora_fin, estado
      FROM citas
      WHERE psicologo_id = $1
        AND fecha_hora_inicio >= $2
        AND fecha_hora_inicio <= $3
        AND estado <> 'cancelada'
      `,
      [psicologoId, dayStart, dayEnd]
    );

    const citas = result.rows;

    const slotsConEstado = SLOTS.map((slot) => {
      const inicioSlot = new Date(`${fecha}T${slot.inicio}:00`);
      const finSlot = new Date(`${fecha}T${slot.fin}:00`);

      const ocupado = citas.some((c) => {
        const iniCita = new Date(c.fecha_hora_inicio);
        const finCita = new Date(c.fecha_hora_fin);
        return iniCita < finSlot && finCita > inicioSlot;
      });

      return {
        ...slot,
        disponible: !ocupado,
      };
    });

    res.json(slotsConEstado);
  } catch (e) {
    console.error("Error al obtener disponibilidad:", e);
    res.status(500).json({ error: "Error en el servidor al obtener disponibilidad" });
  }
});

// ---------- GET /citas/:id ----------
router.get("/citas/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM citas WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    const cita = result.rows[0];

    if (req.user.rol === 1) {
      return res.status(403).json({ error: "Este rol no puede ver citas" });
    }
    if (req.user.rol === 2 && cita.paciente_id !== req.user.id) {
      return res.status(403).json({ error: "No puedes ver esta cita" });
    }
    if (req.user.rol === 3 && cita.psicologo_id !== req.user.id) {
      return res.status(403).json({ error: "No puedes ver esta cita" });
    }

    res.json(cita);
  } catch (e) {
    console.error("Error al obtener cita:", e);
    res.status(500).json({ error: "Error en el servidor al obtener cita" });
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
      `INSERT INTO incidentes (id_curso, tipo, severidad, descripcion, lugar, fecha, alumnos, estado, creado_por, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'abierto', $8, NOW()) RETURNING *`,
      [idCurso, tipo, severidad, descripcion, lugar, fecha, JSON.stringify(alumnos), req.user.id]
    );
    res.status(201).json({ message: "Incidente creado", data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Error al crear incidente" });
  }
});

router.get('/incidentes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM incidentes WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener incidente" });
  }
});

// Actualizar incidente (Agregar suceso y cambiar estado)
router.patch('/incidentes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { nuevoSuceso } = req.body; // El frontend envía { nuevoSuceso: { ... } }

  // Validaciones de permiso
  if (req.user.rol === 2) {
    return res.status(403).json({ error: "No tienes permisos para editar incidentes." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Si viene un nuevo suceso, lo agregamos al historial Y actualizamos el estado general
    if (nuevoSuceso) {
      // Preparamos el objeto del suceso con datos de auditoría
      const sucesoData = {
        ...nuevoSuceso,
        fecha: new Date().toISOString(),
        reportado_por: req.user.nombre // Guardamos quién hizo la actualización
      };

      // Query compleja:
      // 1. COALESCE(historial, '[]'): Si es null, usa array vacío.
      // 2. || : Concatena el nuevo suceso al array jsonb.
      // 3. También actualizamos el 'estado' general del incidente al estado de este nuevo suceso.
      await client.query(
        `UPDATE incidentes
         SET 
            historial = COALESCE(historial, '[]'::jsonb) || $1::jsonb,
            estado = $2,
            actualizado_en = NOW()
         WHERE id = $3`,
        [JSON.stringify([sucesoData]), nuevoSuceso.estado, id]
      );

      await client.query('COMMIT');
      return res.json({ message: "Nuevo suceso registrado correctamente" });
    }

    // Si llegamos aquí, no se envió nada válido
    await client.query('ROLLBACK');
    res.status(400).json({ error: "No se enviaron datos para actualizar." });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error("Error en PATCH incidente:", e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ================== ENCUESTAS ==================

router.get('/encuestas', authenticateToken, async (req, res) => {
  try {
    let query, values = [];
    if ([0, 3].includes(req.user.rol)) {
      query = `SELECT e.*, c.nombre as nombre_curso FROM encuestas e JOIN cursos c ON e.id_curso = c.id ORDER BY e.fecha_creacion DESC`;
    } else if (req.user.rol === 1) {
      query = `SELECT e.*, c.nombre as nombre_curso FROM encuestas e JOIN cursos c ON e.id_curso = c.id WHERE e.creado_por = $1 ORDER BY e.fecha_creacion DESC`;
      values.push(req.user.id);
    } else {
      query = `SELECT e.*, c.nombre as nombre_curso FROM encuestas e JOIN cursos c ON e.id_curso = c.id WHERE e.estado = 'publicada' AND e.id_curso IN (SELECT curso_id FROM curso_usuarios WHERE usuario_id = $1) ORDER BY e.fecha_creacion DESC`;
      values.push(req.user.id);
    }
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/encuestas', authenticateToken, async (req, res) => {
  if (req.user.rol === 2) return res.status(403).json({ error: "Sin permisos" });
  const { idCurso, titulo, descripcion, preguntas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const encRes = await client.query(
      "INSERT INTO encuestas (id_curso, creado_por, titulo, descripcion, estado) VALUES ($1, $2, $3, $4, 'publicada') RETURNING id",
      [idCurso, req.user.id, titulo, descripcion]
    );
    const idEncuesta = encRes.rows[0].id;
    for (let i = 0; i < preguntas.length; i++) {
      await client.query(
        "INSERT INTO preguntas (id_encuesta, texto, tipo_pregunta, orden) VALUES ($1, $2, $3, $4)",
        [idEncuesta, preguntas[i].texto, preguntas[i].tipo_pregunta, i + 1]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: "Encuesta creada" });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Error al crear encuesta" });
  } finally {
    client.release();
  }
});

router.get('/encuestas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const enc = await pool.query("SELECT * FROM encuestas WHERE id = $1", [id]);
    if (enc.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    const pregs = await pool.query("SELECT * FROM preguntas WHERE id_encuesta = $1 ORDER BY orden", [id]);
    const resp = await pool.query("SELECT 1 FROM respuestas r JOIN preguntas p ON r.id_pregunta = p.id WHERE p.id_encuesta = $1 AND r.id_usuario = $2 LIMIT 1", [id, req.user.id]);
    res.json({ ...enc.rows[0], preguntas: pregs.rows, yaRespondio: resp.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener encuesta" });
  }
});

router.post('/encuestas/:id/respuestas', authenticateToken, async (req, res) => {
  if (req.user.rol !== 2) return res.status(403).json({ error: "Solo alumnos" });
  const { respuestas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of respuestas) {
      await client.query(
        "INSERT INTO respuestas (id_pregunta, id_usuario, valor_escala, valor_texto) VALUES ($1, $2, $3, $4)",
        [r.idPregunta, req.user.id, typeof r.valor === 'number' ? r.valor : null, typeof r.valor === 'string' ? r.valor : null]
      );
    }
    await client.query('COMMIT');
    res.json({ message: "Respuestas guardadas" });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Error al guardar" });
  } finally {
    client.release();
  }
});

router.get('/encuestas/:id/resultados', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (req.user.rol === 2) return res.status(403).json({ error: "Acceso denegado" });
  try {
    const enc = await pool.query("SELECT titulo, descripcion FROM encuestas WHERE id = $1", [id]);
    const pregs = await pool.query("SELECT * FROM preguntas WHERE id_encuesta = $1 ORDER BY orden", [id]);
    const resultados = [];
    for (const p of pregs.rows) {
      let data = [];
      if (p.tipo_pregunta === 'escala_1_5') {
        const r = await pool.query("SELECT valor_escala as valor, COUNT(*) as total FROM respuestas WHERE id_pregunta = $1 GROUP BY valor_escala", [p.id]);
        data = r.rows.map(row => ({ valor: parseInt(row.valor), total: parseInt(row.total) }));
      } else {
        const r = await pool.query("SELECT valor_texto as texto FROM respuestas WHERE id_pregunta = $1", [p.id]);
        data = r.rows.map(row => row.texto);
      }
      resultados.push({ idPregunta: p.id, texto: p.texto, tipo: p.tipo_pregunta, data });
    }
    res.json({ encuesta: enc.rows[0], resultados });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener resultados" });
  }
});

// ================== PSICÓLOGO & CITAS ==================

router.get('/psicologos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE rol = 3 ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener psicólogos" });
  }
});
// DEBUG: listar rutas cargadas en este router
router.get("/debug-rutas", (req, res) => {
  const rutas = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
      path: layer.route.path,
    }));

  res.json(rutas);
});
router.get('/psicologos/mis-alumnos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo FROM usuarios WHERE rol = 2 ORDER BY nombre ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar alumnos" });
  }
});

router.get('/psicologos/:id/disponibilidad', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query; // YYYY-MM-DD

  if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

  try {
    // 1. Citas ocupadas (convertimos a string para comparar texto vs texto y evitar líos de zona)
    const query = `
      SELECT to_char(fecha_hora_inicio, 'HH24:MI') as hora_inicio, 
             to_char(fecha_hora_fin, 'HH24:MI') as hora_fin
      FROM citas 
      WHERE psicologo_id = $1 
      AND to_char(fecha_hora_inicio, 'YYYY-MM-DD') = $2
      AND estado != 'cancelada'
    `;
    const citasExistentes = await pool.query(query, [id, fecha]);

    const slots = [];
    const duracionMinutos = 40;

    // Trabajamos con minutos desde medianoche para evitar objetos Date y zonas horarias
    const inicioDia = 9 * 60;  // 09:00 = 540 min
    const finDia = 18 * 60;    // 18:00 = 1080 min

    // Bloqueo Almuerzo: 12:40 (760 min) a 14:00 (840 min)
    const inicioAlmuerzo = 12 * 60 + 40;
    const finAlmuerzo = 14 * 60;

    let minutoActual = inicioDia;

    while (minutoActual + duracionMinutos <= finDia) {
      const minutoFin = minutoActual + duracionMinutos;

      // Verificar colisión con almuerzo
      // Se solapa si el bloque termina después de que empiece el almuerzo 
      // Y empieza antes de que termine
      const chocaAlmuerzo = (minutoActual < finAlmuerzo && minutoFin > inicioAlmuerzo);

      // Verificar colisión con citas DB
      const chocaCita = citasExistentes.rows.some(c => {
        const [hIni, mIni] = c.hora_inicio.split(':').map(Number);
        const [hFin, mFin] = c.hora_fin.split(':').map(Number);
        const citaInicioMin = hIni * 60 + mIni;
        const citaFinMin = hFin * 60 + mFin;

        return (minutoActual < citaFinMin && minutoFin > citaInicioMin);
      });

      if (!chocaAlmuerzo && !chocaCita) {
        // Formatear a HH:mm
        const hStart = Math.floor(minutoActual / 60).toString().padStart(2, '0');
        const mStart = (minutoActual % 60).toString().padStart(2, '0');
        const hEnd = Math.floor(minutoFin / 60).toString().padStart(2, '0');
        const mEnd = (minutoFin % 60).toString().padStart(2, '0');

        // Enviamos formato ISO SIN ZONA (T00:00:00) para que el front lo tome como local
        slots.push({
          start: `${fecha}T${hStart}:${mStart}:00`,
          end: `${fecha}T${hEnd}:${mEnd}:00`
        });
      }

      minutoActual = minutoFin;
    }

    res.json(slots);

  } catch (err) {
    console.error("Error disponibilidad:", err);
    res.status(500).json({ error: "Error al calcular horarios" });
  }
});

router.get('/citas', authenticateToken, async (req, res) => {
  try {
    let where = "", values = [];
    if (req.user.rol === 2) { where = "WHERE c.paciente_id = $1"; values.push(req.user.id); }
    else if (req.user.rol === 3) { where = "WHERE c.psicologo_id = $1"; values.push(req.user.id); }
    else if (req.user.rol === 0 && req.query.psicologo_id) { where = "WHERE c.psicologo_id = $1"; values.push(req.query.psicologo_id); }

    const query = `
      SELECT c.id, c.titulo, c.fecha_hora_inicio AS "start", c.fecha_hora_fin AS "end", c.notas, c.estado, c.lugar,
             pac.nombre AS "pacienteNombre", pac.correo AS "pacienteCorreo", psi.nombre AS "psicologoNombre"
      FROM citas c
      LEFT JOIN usuarios pac ON c.paciente_id = pac.id
      LEFT JOIN usuarios psi ON c.psicologo_id = psi.id
      ${where} ORDER BY c.fecha_hora_inicio ASC
    `;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener citas" });
  }
});

router.get('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.id, c.titulo AS motivo, c.fecha_hora_inicio AS fecha_hora, c.fecha_hora_fin, c.lugar, c.estado, c.notas,
              pac.nombre AS nombre_alumno, pac.rut AS rut_alumno, psi.nombre AS nombre_profesor
       FROM citas c LEFT JOIN usuarios pac ON c.paciente_id = pac.id LEFT JOIN usuarios psi ON c.psicologo_id = psi.id WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error servidor" });
  }
});

router.post('/citas/crear', authenticateToken, async (req, res) => {
  const { titulo, start, end, notas, nombre_paciente, paciente_id: pidBody, psicologo_id: psiIdBody } = req.body;
  let psicologo_id, paciente_id;

  // Lógica de roles (igual que antes)
  if (req.user.rol === 3) { // Psicólogo
    psicologo_id = req.user.id;
    if (pidBody) {
        paciente_id = pidBody;
    } else if (nombre_paciente) {
        const pacienteResult = await pool.query("SELECT id FROM usuarios WHERE nombre ILIKE $1 AND rol = 2", [nombre_paciente]);
        if (pacienteResult.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
        paciente_id = pacienteResult.rows[0].id;
    } else {
        return res.status(400).json({ error: 'Debe seleccionar un alumno.' });
    }
  } else if (req.user.rol === 2) { // Alumno
    paciente_id = req.user.id;
    psicologo_id = psiIdBody;
  } else {
    return res.status(403).json({ error: 'Permiso denegado' });
  }

  if (!titulo || !start || !end) return res.status(400).json({ error: 'Faltan datos de la cita' });

  try {
    // --- VALIDACIÓN DE DISPONIBILIDAD ---
    const ocupado = await checkSolapamiento(psicologo_id, start, end);
    if (ocupado) {
      return res.status(409).json({ error: "El horario seleccionado ya está ocupado por otra cita." });
    }
    // ------------------------------------

    const result = await pool.query(
      `INSERT INTO citas (psicologo_id, paciente_id, titulo, fecha_hora_inicio, fecha_hora_fin, notas, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmada') 
       RETURNING *, fecha_hora_inicio AS "start", fecha_hora_fin AS "end"`,
      [psicologo_id, paciente_id, titulo, start, end, notas || '']
    );
    
    res.status(201).json({ message: "Cita agendada con éxito 🚀", cita: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cita' });
  }
});


// 7. ACTUALIZAR CITA / REAGENDAR (Actualizado con validación de solapamiento)
router.patch('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado, start, end } = req.body;

  try {
    // Si se intenta cambiar la fecha (Reagendar), verificamos disponibilidad
    if (start && end) {
      // 1. Obtener el ID del psicólogo de la cita actual para verificar SU agenda
      const citaActual = await pool.query("SELECT psicologo_id FROM citas WHERE id = $1", [id]);
      if (citaActual.rows.length === 0) return res.status(404).json({ error: "Cita no encontrada" });
      
      const psicologo_id = citaActual.rows[0].psicologo_id;

      // 2. Verificar solapamiento (excluyendo esta misma cita ID)
      const ocupado = await checkSolapamiento(psicologo_id, start, end, id);
      if (ocupado) {
        return res.status(409).json({ error: "El nuevo horario seleccionado ya está ocupado." });
      }
    }

    // --- Procedemos con la actualización normal ---
    const fields = [];
    const values = [];
    let idx = 1;

    if (estado) { fields.push(`estado = $${idx++}`); values.push(estado); }
    if (start) { fields.push(`fecha_hora_inicio = $${idx++}`); values.push(start); }
    if (end) { fields.push(`fecha_hora_fin = $${idx++}`); values.push(end); }

    if (fields.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

    values.push(id);

    const query = `
        UPDATE citas c
        SET ${fields.join(', ')}
        FROM usuarios u
        WHERE c.id = $${idx} AND c.paciente_id = u.id
        RETURNING c.id, c.titulo, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado, c.notas, c.lugar, u.nombre as "pacienteNombre"
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) return res.status(404).json({ error: "No se pudo actualizar la cita" });

    const cita = result.rows[0];
    res.json({ 
        message: "Cita actualizada correctamente", 
        cita: {
            ...cita,
            start: cita.fecha_hora_inicio,
            end: cita.fecha_hora_fin
        }
    });

  } catch (err) {
    res.status(500).json({ error: "Error servidor" });
  }
});

router.delete('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM citas WHERE id = $1", [id]);
    res.json({ message: "Eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

export default router;