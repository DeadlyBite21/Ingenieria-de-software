// add-test-users.js - Script para agregar usuarios de prueba adicionales
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addTestUsers() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    // Encriptar contraseña de prueba
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Usuarios de prueba para agregar
    const testUsers = [
      { rut: '12345678-9', nombre: 'Admin Usuario', correo: 'admin@test.com', rol: 0 },
      { rut: '98765432-1', nombre: 'Profesor Juan', correo: 'profesor@test.com', rol: 1 },
      { rut: '11111111-1', nombre: 'Estudiante María', correo: 'estudiante@test.com', rol: 2 }
    ];

    for (const user of testUsers) {
      try {
        // Intentar insertar usuario (si no existe)
        await client.query(
          `INSERT INTO usuarios (rut, nombre, correo, contrasena, rol) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (rut) DO NOTHING`,
          [user.rut, user.nombre, user.correo, hashedPassword, user.rol]
        );
        console.log(`✅ Usuario ${user.nombre} (${user.rut}) - ${user.rol === 0 ? 'Admin' : user.rol === 1 ? 'Profesor' : 'Estudiante'}`);
      } catch (err) {
        console.log(`ℹ️ Usuario ${user.rut} ya existe`);
      }
    }

    // Cursos de prueba
    const testCourses = [
      'Matemáticas Básicas',
      'Programación en JavaScript', 
      'Historia Universal',
      'Física General',
      'Química Orgánica'
    ];

    for (const courseName of testCourses) {
      try {
        await client.query(
          `INSERT INTO cursos (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
          [courseName]
        );
        console.log(`✅ Curso: ${courseName}`);
      } catch (err) {
        console.log(`ℹ️ Curso ${courseName} ya existe`);
      }
    }

    // Mostrar usuarios actuales
    const users = await client.query('SELECT rut, nombre, rol FROM usuarios ORDER BY rol, nombre');
    console.log('\n👥 Usuarios en la base de datos:');
    users.rows.forEach(user => {
      const rolText = user.rol === 0 ? 'Administrador' : user.rol === 1 ? 'Profesor' : 'Estudiante';
      console.log(`   • ${user.nombre} (${user.rut}) - ${rolText}`);
    });

    // Mostrar cursos actuales  
    const courses = await client.query('SELECT nombre FROM cursos ORDER BY nombre');
    console.log('\n📚 Cursos en la base de datos:');
    courses.rows.forEach(course => {
      console.log(`   • ${course.nombre}`);
    });

    client.release();
    
    console.log('\n🎉 Datos de prueba configurados!');
    console.log('\n🔑 Credenciales para probar:');
    console.log('   👨‍💼 Admin: RUT 12345678-9, contraseña: admin123');
    console.log('   👨‍🏫 Profesor: RUT 98765432-1, contraseña: admin123');
    console.log('   👨‍🎓 Estudiante: RUT 11111111-1, contraseña: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addTestUsers();