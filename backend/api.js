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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Pool de conexión a Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario en Neon
});

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'secreto123', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send('API conectada a Neon 🚀');
});

// RUTA: Inicio de sesión
app.post('/api/login', async (req, res) => {
  const { rut, contrasena } = req.body;

  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE rut = $1", [rut]);

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];

    // Comparar contraseña - manejar tanto hasheadas como no hasheadas
    let validPassword = false;
    
    if (usuario.contrasena.startsWith('$2b$')) {
      // Si está hasheada con bcrypt
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    } else {
      // Si no está hasheada (texto plano)
      validPassword = usuario.contrasena === contrasena;
      console.log(`🔍 Login attempt - RUT: ${rut}, Password match: ${validPassword}`);
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
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

// RUTA: Obtener perfil del usuario autenticado
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, rut, nombre, correo, rol FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// RUTA: obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la consulta" });
  }
});

// RUTA: crear usuario (solo administradores)
app.post('/api/usuarios/crear', authenticateToken, async (req, res) => {
  const { rol, rut, nombre, correo, contrasena } = req.body;

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });
  }
  
  try {
    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    
    const result = await pool.query(
      'INSERT INTO usuarios (rol, rut, nombre, correo, contrasena) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [rol, rut, nombre, correo, hashedPassword]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      message: "Contraseña actualizada con éxito 🚀",
      usuario: result.rows[0],
    });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// RUTA: eliminar usuario (solo administradores)
app.delete('/api/usuarios/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ message: 'Usuario eliminado exitosamente', usuario: result.rows[0] });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Crear curso (solo administradores)
app.post('/api/cursos/crear', authenticateToken, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Falta el nombre del curso" });

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden crear cursos' });
  }

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

// Obtener todos los cursos (usuarios autenticados)
app.get('/api/cursos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cursos ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// Asignar usuario a un curso (solo administradores)
app.post('/api/cursos/:cursoId/usuarios/:usuarioId', authenticateToken, async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden asignar usuarios a cursos' });
  }

  try {
    // Verificar que el usuario existe
    const userCheck = await pool.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que el curso existe
    const courseCheck = await pool.query(
      'SELECT * FROM cursos WHERE id = $1',
      [cursoId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

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

// ================== RECUPERACIÓN DE CONTRASEÑA ==================

app.post("/recover-password", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Falta el email" });

  // Aquí deberías verificar que el email exista en tu DB
  const userExists = true;

  if (!userExists) return res.status(404).json({ error: "Usuario no encontrado" });

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

// Desasignar usuario de un curso (solo administradores)
app.delete('/api/cursos/:cursoId/usuarios/:usuarioId', authenticateToken, async (req, res) => {
  const { cursoId, usuarioId } = req.params;

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden desasignar usuarios de cursos' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM curso_usuarios WHERE usuario_id = $1 AND curso_id = $2 RETURNING *',
      [usuarioId, cursoId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }
    
    res.json({ message: 'Usuario desasignado del curso exitosamente' });
  } catch (err) {
    console.error('Error al desasignar usuario:', err);
    res.status(500).json({ error: 'Error al desasignar usuario' });
  }
});

// Obtener usuarios asignados a un curso
app.get('/api/cursos/:id/alumnos', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT u.id, u.rut, u.nombre, u.correo, u.rol 
      FROM usuarios u 
      INNER JOIN curso_usuarios cu ON u.id = cu.usuario_id 
      WHERE cu.curso_id = $1
      ORDER BY u.nombre
    `, [id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener alumnos del curso:', err);
    res.status(500).json({ error: 'Error al obtener alumnos del curso' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Frontend esperado en: http://localhost:5173`);
  console.log(`🌐 API disponible en: http://localhost:${PORT}`);
  console.log(`🔍 Prueba la API: http://localhost:${PORT}/api/usuarios`);
});
