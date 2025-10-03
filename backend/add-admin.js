// add-admin.js - Script para agregar un usuario administrador
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addAdmin() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    // Verificar si ya existe un administrador
    const adminCheck = await client.query('SELECT COUNT(*) FROM usuarios WHERE rol = 0');
    const adminCount = parseInt(adminCheck.rows[0].count);

    if (adminCount > 0) {
      console.log(`ℹ️ Ya existen ${adminCount} administradores en la base de datos`);
    } else {
      // Crear administrador
      const adminPassword = 'admin123';
      
      const adminUser = {
        rut: '11111111-1',
        nombre: 'Administrador Sistema',
        correo: 'admin@sistema.com',
        contrasena: adminPassword, // Sin hashear para que funcione con tu sistema actual
        rol: 0
      };

      await client.query(
        'INSERT INTO usuarios (rut, nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4, $5)',
        [adminUser.rut, adminUser.nombre, adminUser.correo, adminUser.contrasena, adminUser.rol]
      );
      
      console.log('✅ Usuario administrador creado exitosamente!');
    }

    // Mostrar todos los usuarios actuales
    const users = await client.query('SELECT rut, nombre, rol FROM usuarios ORDER BY rol, nombre');
    console.log('\n👥 Usuarios actuales:');
    users.rows.forEach(user => {
      const rolText = user.rol === 0 ? 'Administrador' : user.rol === 1 ? 'Profesor' : 'Estudiante';
      console.log(`   • ${user.nombre} (${user.rut}) - ${rolText}`);
    });

    client.release();
    
    console.log('\n🔑 Credenciales de administrador:');
    console.log('   👨‍💼 Admin: RUT 11111111-1, contraseña: admin123');
    console.log('\n🎯 Con este usuario puedes:');
    console.log('   • Crear y eliminar usuarios');
    console.log('   • Crear y eliminar cursos');
    console.log('   • Asignar usuarios a cursos');
    console.log('   • Ver panel de administrador completo');
    
  } catch (error) {
    if (error.code === '23505') {
      console.log('ℹ️ El administrador ya existe');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await pool.end();
  }
}

addAdmin();