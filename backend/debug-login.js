// debug-login.js - Script para debuggear el proceso de login
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugLogin() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    // Obtener todos los usuarios con sus contraseñas
    const users = await client.query('SELECT id, rut, nombre, correo, contrasena, rol FROM usuarios ORDER BY id');
    
    console.log('\n👥 Usuarios en la base de datos:');
    users.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.nombre}`);
      console.log(`   RUT: ${user.rut}`);
      console.log(`   Email: ${user.correo}`);
      console.log(`   Rol: ${user.rol === 0 ? 'Administrador' : user.rol === 1 ? 'Profesor' : 'Estudiante'}`);
      console.log(`   Contraseña hasheada: ${user.contrasena.substring(0, 20)}...`);
      console.log(`   ¿Es hash bcrypt?: ${user.contrasena.startsWith('$2b$') ? 'SÍ' : 'NO'}`);
    });
    
    // Intentar login con los datos que tienes
    console.log('\n🔍 Probando logins...');
    
    const testLogins = [
      { rut: '12345678', password: 'test' },
      { rut: '12345678', password: 'password' },
      { rut: '12345678', password: '123456' },
      { rut: '213149628', password: 'test' },
      { rut: '213149628', password: 'password' },
      { rut: '213149628', password: '123456' }
    ];
    
    for (const test of testLogins) {
      const user = users.rows.find(u => u.rut === test.rut);
      if (user) {
        let isValid = false;
        
        // Si la contraseña no está hasheada, comparar directamente
        if (!user.contrasena.startsWith('$2b$')) {
          isValid = user.contrasena === test.password;
          console.log(`   ${test.rut} + "${test.password}": ${isValid ? '✅' : '❌'} (comparación directa)`);
        } else {
          // Si está hasheada, usar bcrypt
          isValid = await bcrypt.compare(test.password, user.contrasena);
          console.log(`   ${test.rut} + "${test.password}": ${isValid ? '✅' : '❌'} (bcrypt)`);
        }
      }
    }
    
    console.log('\n💡 Sugerencias:');
    console.log('1. Si las contraseñas NO empiezan con $2b$, no están hasheadas');
    console.log('2. Prueba con las contraseñas exactas que están en la base de datos');
    console.log('3. O actualiza las contraseñas a algo conocido');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugLogin();