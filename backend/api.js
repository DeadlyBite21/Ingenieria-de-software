require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');


const app = express();
app.use(cors());
app.use(express.json());

// Pool de conexión a Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Necesario en Neon
});

// RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send('API conectada a Neon 🚀');
});

// RUTA: Inicio de sesión
app.post('/api/login', async (req, res) => {
  const { rut, contraseña } = req.body;

  try {
    // Buscar usuario por RUT
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE rut = $1',
      [rut]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];

    // Comparar contraseña
    const validPassword = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // (Opcional) generar token JWT
    const token = jwt.sign(
      { id: usuario.id, rut: usuario.rut, rol: usuario.rol },
      process.env.JWT_SECRET || 'secreto123',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Inicio de sesión exitoso 🚀',
      usuario: {
        id: usuario.id,
        rut: usuario.rut,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      },
      token
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// RUTA: obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en la consulta' });
  }
});

// RUTA: crear usuario
app.post('/api/usuarios/crear', async (req, res) => {

  const { rol, rut, nombre, correo, contraseña } = req.body;

  if(rol !== 0){
    return res.status(400).json({ error: 'El usuario no es administrador' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (rol, rut, nombre, correo, contraseña) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [rol, rut, nombre, correo, contraseña]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en la query:', err);
    res.status(500).json({ error: 'Error al insertar usuario' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});