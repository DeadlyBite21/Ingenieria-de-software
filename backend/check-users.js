// check-users.js - Script para ver qué usuarios tienes en la base de datos
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    // Verificar usuarios existentes
    const users = await client.query('SELECT id, rut, nombre, correo, rol FROM usuarios ORDER BY rol, nombre');
    
    console.log('\n👥 Usuarios en tu base de datos:');
    if (users.rows.length === 0) {
      console.log('   ❌ No hay usuarios en la base de datos');
    } else {
      users.rows.forEach(user => {
        const rolText = user.rol === 0 ? 'Administrador' : user.rol === 1 ? 'Profesor' : 'Estudiante';
        console.log(`   • ${user.nombre} (RUT: ${user.rut}) - ${rolText}`);
        console.log(`     Email: ${user.correo}`);
        console.log('');
      });
    }
    
    // Verificar cursos existentes
    const courses = await client.query('SELECT id, nombre FROM cursos ORDER BY nombre');
    
    console.log('📚 Cursos en tu base de datos:');
    if (courses.rows.length === 0) {
      console.log('   ❌ No hay cursos en la base de datos');
    } else {
      courses.rows.forEach(course => {
        console.log(`   • ${course.nombre} (ID: ${course.id})`);
      });
    }
    
    client.release();
    
    console.log('\n💡 Para probar el login necesitas:');
    console.log('   1. El RUT de algún usuario existente');
    console.log('   2. La contraseña que usaste cuando creaste ese usuario');
    console.log('\n🌐 Puedes probar el login en: http://localhost:5173/login');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();