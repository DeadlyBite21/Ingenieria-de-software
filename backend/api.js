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

// ================== RUTAS PÚBLICAS Y AUTH ==================

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
  // Simulación de envío de correo
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });
  res.json({ message: "Correo de recuperación enviado (simulado)" });
});

router.post("/reset-password", async (req, res) => {
  const { token, nuevaContrasena } = req.body;
  // Lógica simplificada
  try {
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
    // Aquí deberías validar el token real, por ahora actualizamos si el token es válido
    // Nota: Esto requiere implementación completa de tokens de recuperación
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
    // Desvincular incidentes u otros datos si es necesario
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

// ================== CURSOS ==================

router.get("/cursos", authenticateToken, async (req, res) => {
  try {
    // Si es admin, ve todos. Si es profe/alumno, ve los asignados.
    if (req.user.rol === 0) {
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
  try {
    await pool.query("DELETE FROM curso_usuarios WHERE curso_id = $1", [id]);
    await pool.query("DELETE FROM cursos WHERE id = $1", [id]);
    res.json({ message: "Curso eliminado" });
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar curso" });
  }
});

router.get("/cursos/:cursoId/usuarios", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId } = req.params;
  try {
    const result = await pool.query(
      "SELECT u.id, u.nombre, u.rut, u.rol FROM usuarios u JOIN curso_usuarios cu ON u.id = cu.usuario_id WHERE cu.curso_id = $1",
      [cursoId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/cursos/:cursoId/usuarios/:usuarioId", authenticateToken, isAdmin, async (req, res) => {
  const { cursoId, usuarioId } = req.params;
  try {
    await pool.query("INSERT INTO curso_usuarios (usuario_id, curso_id) VALUES ($1, $2)", [usuarioId, cursoId]);
    res.json({ message: "Usuario asignado" });
  } catch (e) {
    res.status(500).json({ error: "Error al asignar" });
  }
});

// ================== INCIDENTES ==================

router.get('/incidentes', authenticateToken, async (req, res) => {
  try {
    // Lógica básica de listado, expandir filtros según necesidad
    const result = await pool.query("SELECT * FROM incidentes ORDER BY fecha DESC");
    res.json({ data: result.rows, total: result.rowCount });
  } catch (e) {
    res.status(500).json({ error: "Error al listar incidentes" });
  }
});

router.post('/incidentes', authenticateToken, async (req, res) => {
  const { idCurso, tipo, severidad, descripcion, lugar, fecha, alumnos } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO incidentes (id_curso, tipo, severidad, descripcion, lugar, fecha, alumnos, estado, creado_por, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'abierto', $8, NOW()) RETURNING *`,
      [idCurso, tipo, severidad, descripcion, lugar, fecha, JSON.stringify(alumnos), req.user.id]
    );
    res.status(201).json({ message: "Incidente creado", data: result.rows[0] });
  } catch (e) {
    console.error(e);
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

router.patch('/incidentes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  // Implementación simplificada para agregar historial o cambiar estado
  // En producción deberías manejar los campos dinámicamente o usar JSONB para historial
  res.json({ message: "Actualización de incidente simulada" });
});

// ================== ENCUESTAS (Restauradas) ==================

router.get('/encuestas', authenticateToken, async (req, res) => {
  try {
    let query = `SELECT e.*, c.nombre as nombre_curso 
                 FROM encuestas e JOIN cursos c ON e.id_curso = c.id
                 ORDER BY e.fecha_creacion DESC`;
    // Filtrar si es profesor o alumno según tus reglas de negocio
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/encuestas', authenticateToken, async (req, res) => {
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

    // Verificar si ya respondió
    const resp = await pool.query(
      "SELECT 1 FROM respuestas r JOIN preguntas p ON r.id_pregunta = p.id WHERE p.id_encuesta = $1 AND r.id_usuario = $2 LIMIT 1",
      [id, req.user.id]
    );

    res.json({ ...enc.rows[0], preguntas: pregs.rows, yaRespondio: resp.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener encuesta" });
  }
});

router.post('/encuestas/:id/respuestas', authenticateToken, async (req, res) => {
  const { respuestas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of respuestas) {
      // Determinar si es escala o texto
      // Simplificado: asume que el frontend manda el valor correcto en el campo correcto o ajusta aquí
      const valorEscala = typeof r.valor === 'number' ? r.valor : null;
      const valorTexto = typeof r.valor === 'string' ? r.valor : null;

      await client.query(
        "INSERT INTO respuestas (id_pregunta, id_usuario, valor_escala, valor_texto) VALUES ($1, $2, $3, $4)",
        [r.idPregunta, req.user.id, valorEscala, valorTexto]
      );
    }
    await client.query('COMMIT');
    res.json({ message: "Respuestas guardadas" });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Error al guardar respuestas" });
  } finally {
    client.release();
  }
});

router.get('/encuestas/:id/resultados', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const enc = await pool.query("SELECT titulo, descripcion FROM encuestas WHERE id = $1", [id]);
    const pregs = await pool.query("SELECT * FROM preguntas WHERE id_encuesta = $1 ORDER BY orden", [id]);

    const resultados = [];
    for (const p of pregs.rows) {
      let data = [];
      if (p.tipo_pregunta === 'escala_1_5') {
        const r = await pool.query(
          "SELECT valor_escala as valor, COUNT(*) as total FROM respuestas WHERE id_pregunta = $1 GROUP BY valor_escala",
          [p.id]
        );
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

// ================== PSICÓLOGO & CITAS (SOLUCIONES) ==================

// 1. Obtener lista de psicólogos
router.get('/psicologos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE rol = 3 ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener psicólogos" });
  }
});

// 2. LISTA DE ALUMNOS (Ruta que faltaba y causaba error 404 en sidebar)
router.get('/psicologos/mis-alumnos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, rut, nombre, correo FROM usuarios WHERE rol = 2 ORDER BY nombre ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error alumnos:", err);
    res.status(500).json({ error: "Error al cargar alumnos" });
  }
});

// 3. DISPONIBILIDAD (Bloques 40 min para el alumno)
router.get('/psicologos/:id/disponibilidad', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "Falta la fecha" });

  try {
    const query = `
      SELECT fecha_hora_inicio, fecha_hora_fin 
      FROM citas 
      WHERE psicologo_id = $1 AND date(fecha_hora_inicio) = $2 AND estado != 'cancelada'
    `;
    const citasExistentes = await pool.query(query, [id, fecha]);

    const slots = [];
    const duracionMinutos = 40;
    let horaActual = new Date(`${fecha}T09:00:00`);
    const horaFinDia = new Date(`${fecha}T18:00:00`);

    while (horaActual < horaFinDia) {
      const finBloque = new Date(horaActual.getTime() + duracionMinutos * 60000);
      const horaCheck = horaActual.getHours();
      // Break almuerzo 13:00 - 14:00
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

// 4. GET CITAS (Inteligente para todos los roles)
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
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// 5. GET DETALLE CITA
router.get('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
         c.id, c.titulo AS motivo, c.fecha_hora_inicio AS fecha_hora, c.fecha_hora_fin,
         c.lugar, c.estado, c.notas,
         pac.nombre AS nombre_alumno, pac.rut AS rut_alumno,
         psi.nombre AS nombre_profesor
       FROM citas c
       LEFT JOIN usuarios pac ON c.paciente_id = pac.id
       LEFT JOIN usuarios psi ON c.psicologo_id = psi.id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// 6. CREAR CITA
router.post('/citas/crear', authenticateToken, async (req, res) => {
  const { titulo, start, end, notas, nombre_paciente, psicologo_id: psiIdBody } = req.body;
  let psicologo_id, paciente_id;

  // Psicólogo creando cita
  if (req.user.rol === 3) {
    psicologo_id = req.user.id;
    if (!nombre_paciente) return res.status(400).json({ error: 'Falta nombre_paciente' });
    const pacienteRes = await pool.query("SELECT id FROM usuarios WHERE nombre = $1 AND rol = 2", [nombre_paciente]);
    if (pacienteRes.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    paciente_id = pacienteRes.rows[0].id;

    // Alumno solicitando cita
  } else if (req.user.rol === 2) {
    paciente_id = req.user.id;
    if (!psiIdBody) return res.status(400).json({ error: 'Falta seleccionar psicólogo' });
    psicologo_id = psiIdBody;
  } else {
    // Admin u otro
    return res.status(403).json({ error: 'Permiso denegado para crear citas' });
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
    res.status(500).json({ error: 'Error al crear cita' });
  }
});

// 7. ACTUALIZAR CITA (PATCH) - La ruta que fallaba antes
router.patch('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
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

// 8. BORRAR CITA
router.delete('/citas/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM citas WHERE id = $1', [id]);
    res.json({ message: 'Cita eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

export default router;