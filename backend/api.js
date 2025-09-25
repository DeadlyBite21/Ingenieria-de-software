require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

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