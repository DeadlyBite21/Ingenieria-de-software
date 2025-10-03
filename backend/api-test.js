require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Datos en memoria para la prueba (temporal)
let usuarios = [
  {
    id: 1,
    rut: '12345678-9',
    nombre: 'Admin Usuario',
    correo: 'admin@test.com',
    contrasena: '$2b$10$X8FQZt7ZQXQs1oWqN7qE8uJyQVkN1oTjNQ8zMwV3LQu6M4V3n4V3n', // password: admin123
    rol: 0 // Administrador
  },
  {
    id: 2,
    rut: '98765432-1',
    nombre: 'Profesor Juan',
    correo: 'profesor@test.com',
    contrasena: '$2b$10$X8FQZt7ZQXQs1oWqN7qE8uJyQVkN1oTjNQ8zMwV3LQu6M4V3n4V3n', // password: admin123
    rol: 1 // Profesor
  },
  {
    id: 3,
    rut: '11111111-1',
    nombre: 'Estudiante María',
    correo: 'estudiante@test.com',
    contrasena: '$2b$10$X8FQZt7ZQXQs1oWqN7qE8uJyQVkN1oTjNQ8zMwV3LQu6M4V3n4V3n', // password: admin123
    rol: 2 // Estudiante
  }
];

let cursos = [
  { id: 1, nombre: 'Matemáticas Básicas' },
  { id: 2, nombre: 'Programación en JavaScript' },
  { id: 3, nombre: 'Historia Universal' }
];

let nextUserId = 4;
let nextCursoId = 4;

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
  res.send('API funcionando 🚀 - Modo de prueba en memoria');
});

// RUTA: Inicio de sesión
app.post('/api/login', async (req, res) => {
  const { rut, contrasena } = req.body;

  try {
    // Buscar usuario por RUT
    const usuario = usuarios.find(u => u.rut === rut);

    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Para la prueba, acepta tanto la contraseña hasheada como "admin123"
    let validPassword = false;
    if (contrasena === 'admin123') {
      validPassword = true;
    } else {
      validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Generar token JWT
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

// RUTA: Obtener perfil del usuario autenticado
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const usuario = usuarios.find(u => u.id === req.user.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { contrasena, ...usuarioSinPassword } = usuario;
    res.json(usuarioSinPassword);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// RUTA: obtener todos los usuarios
app.get('/api/usuarios', authenticateToken, async (req, res) => {
  try {
    const usuariosSinPassword = usuarios.map(({ contrasena, ...usuario }) => usuario);
    res.json(usuariosSinPassword);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en la consulta' });
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
    // Verificar si el RUT ya existe
    const existeUsuario = usuarios.find(u => u.rut === rut);
    if (existeUsuario) {
      return res.status(400).json({ error: 'El RUT ya está registrado' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    
    const nuevoUsuario = {
      id: nextUserId++,
      rol,
      rut,
      nombre,
      correo,
      contrasena: hashedPassword
    };

    usuarios.push(nuevoUsuario);
    
    const { contrasena: _, ...usuarioSinPassword } = nuevoUsuario;
    res.json(usuarioSinPassword);
  } catch (err) {
    console.error('Error en la query:', err);
    res.status(500).json({ error: 'Error al insertar usuario' });
  }
});

// Crear curso (solo administradores)
app.post('/api/cursos/crear', authenticateToken, async (req, res) => {
  const { nombre } = req.body;

  // Verificar que quien hace la petición es administrador
  if(req.user.rol !== 0){
    return res.status(403).json({ error: 'Solo los administradores pueden crear cursos' });
  }

  try {
    // Verificar si el curso ya existe
    const existeCurso = cursos.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (existeCurso) {
      return res.status(400).json({ error: 'El curso ya existe' });
    }

    const nuevoCurso = {
      id: nextCursoId++,
      nombre
    };

    cursos.push(nuevoCurso);

    res.status(201).json({
      message: 'Curso creado con éxito 🚀',
      curso: nuevoCurso
    });
  } catch (err) {
    console.error('Error al crear curso:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener todos los cursos (usuarios autenticados)
app.get('/api/cursos', authenticateToken, async (req, res) => {
  try {
    res.json(cursos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📁 Modo de prueba - datos en memoria`);
  console.log(`🔑 Usuarios de prueba:`);
  console.log(`   👨‍💼 Admin: RUT 12345678-9, contraseña: admin123`);
  console.log(`   👨‍🏫 Profesor: RUT 98765432-1, contraseña: admin123`);
  console.log(`   👨‍🎓 Estudiante: RUT 11111111-1, contraseña: admin123`);
});