// setup-database.js - Script para configurar la base de datos
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    // Verificar conexión
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a Neon!');
    
    // Crear tabla usuarios si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        rut VARCHAR(12) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        correo VARCHAR(100) UNIQUE NOT NULL,
        contrasena VARCHAR(255) NOT NULL,
        rol INTEGER NOT NULL CHECK (rol IN (0, 1, 2)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla usuarios creada/verificada');

    // Crear tabla cursos si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS cursos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla cursos creada/verificada');

    // Crear tabla curso_usuarios si no existe (relación many-to-many)
    await client.query(`
      CREATE TABLE IF NOT EXISTS curso_usuarios (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(usuario_id, curso_id)
      )
    `);
    console.log('✅ Tabla curso_usuarios creada/verificada');

    // Verificar si ya existen usuarios
    const existingUsers = await client.query('SELECT COUNT(*) FROM usuarios');
    const userCount = parseInt(existingUsers.rows[0].count);

    if (userCount === 0) {
      console.log('🔄 Creando usuarios de prueba...');
      
      // Encriptar contraseña de prueba
      const hashedPassword = await bcrypt.hash('admin123', 10);

      // Insertar usuarios de prueba
      const users = [
        ['12345678-9', 'Admin Usuario', 'admin@test.com', hashedPassword, 0],
        ['98765432-1', 'Profesor Juan', 'profesor@test.com', hashedPassword, 1],
        ['11111111-1', 'Estudiante María', 'estudiante@test.com', hashedPassword, 2]
      ];

      for (const user of users) {
        await client.query(
          'INSERT INTO usuarios (rut, nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4, $5)',
          user
        );
      }
      console.log('✅ Usuarios de prueba creados');
    } else {
      console.log(`ℹ️ Ya existen ${userCount} usuarios en la base de datos`);
    }

    // Verificar si ya existen cursos
    const existingCourses = await client.query('SELECT COUNT(*) FROM cursos');
    const courseCount = parseInt(existingCourses.rows[0].count);

    if (courseCount === 0) {
      console.log('🔄 Creando cursos de prueba...');
      
      const courses = [
        ['Matemáticas Básicas', 'Curso introductorio de matemáticas'],
        ['Programación en JavaScript', 'Aprende JavaScript desde cero'],
        ['Historia Universal', 'Recorrido por la historia mundial']
      ];

      for (const course of courses) {
        await client.query(
          'INSERT INTO cursos (nombre, descripcion) VALUES ($1, $2)',
          course
        );
      }
      console.log('✅ Cursos de prueba creados');
    } else {
      console.log(`ℹ️ Ya existen ${courseCount} cursos en la base de datos`);
    }

    client.release();
    
    console.log('\n🎉 Base de datos configurada correctamente!');
    console.log('\n🔑 Credenciales de prueba:');
    console.log('   👨‍💼 Admin: RUT 12345678-9, contraseña: admin123');
    console.log('   👨‍🏫 Profesor: RUT 98765432-1, contraseña: admin123');
    console.log('   👨‍🎓 Estudiante: RUT 11111111-1, contraseña: admin123');
    
  } catch (error) {
    console.error('❌ Error configurando la base de datos:', error);
    console.error('\n💡 Asegúrate de que:');
    console.error('   1. Tu DATABASE_URL en .env es correcta');
    console.error('   2. Tu base de datos de Neon está activa');
    console.error('   3. Tienes permisos para crear tablas');
  } finally {
    await pool.end();
  }
}

setupDatabase();