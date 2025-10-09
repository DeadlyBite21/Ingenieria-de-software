// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para crear nuevo usuario
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    rol: '',
    rut: '',
    nombre: '',
    correo: '',
    contrasena: ''
  });

  // Estados para crear nuevo curso
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ nombre: '' });

  // Estados para gestión de asignaciones curso-usuario
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [courseUsers, setCourseUsers] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usuariosData, cursosData] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/cursos')
      ]);
      setUsuarios(usuariosData);
      setCursos(cursosData);
      
      // Cargar usuarios de cada curso
      const courseUsersData = {};
      for (const curso of cursosData) {
        try {
          const users = await apiFetch(`/api/cursos/${curso.id}/usuarios`);
          courseUsersData[curso.id] = users;
        } catch (err) {
          courseUsersData[curso.id] = [];
        }
      }
      setCourseUsers(courseUsersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/usuarios/crear', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      
      setNewUser({ rol: '', rut: '', nombre: '', correo: '', contrasena: '' });
      setShowCreateUser(false);
      loadData(); // Recargar datos
      alert('Usuario creado exitosamente');
    } catch (err) {
      alert('Error al crear usuario: ' + err.message);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/cursos/crear', {
        method: 'POST',
        body: JSON.stringify(newCourse)
      });
      
      setNewCourse({ nombre: '' });
      setShowCreateCourse(false);
      loadData(); // Recargar datos
      alert('Curso creado exitosamente');
    } catch (err) {
      alert('Error al crear curso: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario "${userName}"?`)) {
      try {
        await apiFetch(`/api/usuarios/${userId}`, {
          method: 'DELETE'
        });
        loadData(); // Recargar datos
        alert('Usuario eliminado exitosamente');
      } catch (err) {
        alert('Error al eliminar usuario: ' + err.message);
      }
    }
  };

  const handleDeleteCourse = async (courseId, courseName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el curso "${courseName}"?`)) {
      try {
        await apiFetch(`/api/cursos/${courseId}`, {
          method: 'DELETE'
        });
        loadData(); // Recargar datos
        alert('Curso eliminado exitosamente');
      } catch (err) {
        alert('Error al eliminar curso: ' + err.message);
      }
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedCourse) {
      alert('Selecciona un usuario y un curso');
      return;
    }

    try {
      await apiFetch(`/api/cursos/${selectedCourse.id}/usuarios/${selectedUser}`, {
        method: 'POST'
      });
      
      setSelectedUser('');
      setShowAssignUser(false);
      loadData(); // Recargar datos
      alert('Usuario asignado al curso exitosamente');
    } catch (err) {
      alert('Error al asignar usuario: ' + err.message);
    }
  };

  const handleUnassignUser = async (courseId, userId, userName, courseName) => {
    if (window.confirm(`¿Desasignar a "${userName}" del curso "${courseName}"?`)) {
      try {
        await apiFetch(`/api/cursos/${courseId}/usuarios/${userId}`, {
          method: 'DELETE'
        });
        loadData(); // Recargar datos
        alert('Usuario desasignado exitosamente');
      } catch (err) {
        alert('Error al desasignar usuario: ' + err.message);
      }
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Panel de Administrador</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Bienvenido <strong>{user?.nombre}</strong> - Gestiona usuarios y cursos del sistema
      </p>

      {/* Sección de Usuarios */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Gestión de Usuarios</h2>
          <button 
            onClick={() => setShowCreateUser(!showCreateUser)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showCreateUser ? 'Cancelar' : 'Crear Usuario'}
          </button>
        </div>

        {showCreateUser && (
          <form onSubmit={handleCreateUser} style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <select
              value={newUser.rol}
              onChange={(e) => setNewUser({...newUser, rol: parseInt(e.target.value)})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Seleccionar Rol</option>
              <option value={0}>Administrador</option>
              <option value={1}>Profesor</option>
              <option value={2}>Alumno</option>
            </select>
            <input
              type="text"
              placeholder="RUT"
              value={newUser.rut}
              onChange={(e) => setNewUser({...newUser, rut: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="text"
              placeholder="Nombre completo"
              value={newUser.nombre}
              onChange={(e) => setNewUser({...newUser, nombre: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={newUser.correo}
              onChange={(e) => setNewUser({...newUser, correo: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={newUser.contrasena}
              onChange={(e) => setNewUser({...newUser, contrasena: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <button type="submit" style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Crear Usuario
            </button>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>RUT</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Nombre</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Correo</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Rol</th>
                <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ddd' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{usuario.rut}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{usuario.nombre}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{usuario.correo}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    {usuario.rol === 0 ? 'Administrador' : usuario.rol === 1 ? 'Profesor' : 'Alumno'}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteUser(usuario.id, usuario.nombre)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección de Cursos */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Gestión de Cursos</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setShowCreateCourse(!showCreateCourse)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showCreateCourse ? 'Cancelar' : '📚 Crear Curso'}
            </button>
            <button 
              onClick={() => setShowAssignUser(!showAssignUser)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showAssignUser ? 'Cancelar' : '👥 Asignar Usuario'}
            </button>
          </div>
        </div>

        {showCreateCourse && (
          <form onSubmit={handleCreateCourse} style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Nombre del curso"
              value={newCourse.nombre}
              onChange={(e) => setNewCourse({...newCourse, nombre: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1 }}
            />
            <button type="submit" style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Crear Curso
            </button>
          </form>
        )}

        {showAssignUser && (
          <form onSubmit={handleAssignUser} style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Seleccionar Curso:
              </label>
              <select
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const course = cursos.find(c => c.id === parseInt(e.target.value));
                  setSelectedCourse(course);
                }}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Seleccionar curso...</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Seleccionar Usuario:
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Seleccionar usuario...</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre} ({usuario.rut}) - {usuario.rol === 0 ? 'Admin' : usuario.rol === 1 ? 'Profesor' : 'Alumno'}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Asignar
            </button>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
          {cursos.map((curso) => (
            <div key={curso.id} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '1rem',
              backgroundColor: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{curso.nombre}</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>ID: {curso.id}</p>
                </div>
                <button
                  onClick={() => handleDeleteCourse(curso.id, curso.nombre)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  🗑️
                </button>
              </div>
              
              {/* Lista de usuarios asignados */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
                  Usuarios asignados ({courseUsers[curso.id]?.length || 0}):
                </h4>
                {courseUsers[curso.id]?.length > 0 ? (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {courseUsers[curso.id].map((user) => (
                      <div key={user.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px',
                        backgroundColor: '#f8f9fa',
                        marginBottom: '4px',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        <span>
                          {user.nombre} ({user.rol === 0 ? 'Admin' : user.rol === 1 ? 'Prof' : 'Est'})
                        </span>
                        <button
                          onClick={() => handleUnassignUser(curso.id, user.id, user.nombre, curso.nombre)}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    No hay usuarios asignados
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}