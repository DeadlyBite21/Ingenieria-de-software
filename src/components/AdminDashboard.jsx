// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]); // Se mantiene para el dropdown de asignar
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para crear nuevo curso
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ nombre: '' });

  // Estados para gestión de asignaciones curso-usuario
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [courseUsers, setCourseUsers] = useState({}); // { [cursoId]: [lista_de_usuarios] }

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

      // Cargar usuarios asignados a cada curso
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

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/cursos/crear', {
        method: 'POST',
        body: JSON.stringify(newCourse)
      });

      setNewCourse({ nombre: '' });
      setShowCreateCourse(false);
      loadData();
      alert('Curso creado exitosamente');
    } catch (err) {
      alert('Error al crear curso: ' + err.message);
    }
  };

  const handleDeleteCourse = async (courseId, courseName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el curso "${courseName}"?`)) {
      try {
        await apiFetch(`/api/cursos/${courseId}`, {
          method: 'DELETE'
        });
        loadData();
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
      loadData();
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
        loadData();
        alert('Usuario desasignado exitosamente');
      } catch (err) {
        alert('Error al desasignar usuario: ' + err.message);
      }
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <h1>Panel de Administrador</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Bienvenido <strong>{user?.nombre}</strong> - Gestiona los cursos del sistema
      </p>

      {/* --- Sección de Cursos --- */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Gestión de Cursos</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowCreateCourse(!showCreateCourse)}
              className="btn btn-info text-white"
            >
              {showCreateCourse ? 'Cancelar' : '📚 Crear Curso'}
            </button>
            <button
              onClick={() => setShowAssignUser(!showAssignUser)}
              className="btn btn-primary"
              style={{ backgroundColor: '#6f42c1', borderColor: '#6f42c1' }}
            >
              {showAssignUser ? 'Cancelar' : '👥 Asignar Usuario'}
            </button>
          </div>
        </div>

        {showCreateCourse && (
          <form onSubmit={handleCreateCourse} className="mb-4 p-3 bg-light rounded d-flex gap-2 align-items-center">
            <input
              type="text"
              placeholder="Nombre del curso"
              value={newCourse.nombre}
              onChange={(e) => setNewCourse({ ...newCourse, nombre: e.target.value })}
              required
              className="form-control"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              Crear Curso
            </button>
          </form>
        )}

        {showAssignUser && (
          <form onSubmit={handleAssignUser} className="mb-4 p-3 bg-light rounded row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label fw-bold">Curso:</label>
              <select
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const course = cursos.find(c => c.id === parseInt(e.target.value));
                  setSelectedCourse(course);
                }}
                required
                className="form-select"
              >
                <option value="">Seleccionar curso...</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                ))}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label fw-bold">Usuario:</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
                className="form-select"
              >
                <option value="">Seleccionar usuario...</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre} ({usuario.rut}) - {usuario.rol === 0 ? 'Admin' : usuario.rol === 1 ? 'Profesor' : 'Alumno'}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100">Asignar</button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
          {cursos.map((curso) => (
            <div key={curso.id} className="card p-3 shadow-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{curso.nombre}</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>ID: {curso.id}</p>
                </div>
                <button
                  onClick={() => handleDeleteCourse(curso.id, curso.nombre)}
                  className="btn btn-sm btn-outline-danger"
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
                      <div key={user.id} className="d-flex justify-content-between align-items-center p-1 mb-1 bg-light rounded small">
                        <span>
                          {user.nombre} ({user.rol === 0 ? 'Admin' : user.rol === 1 ? 'Prof' : 'Est'})
                        </span>
                        <button
                          onClick={() => handleUnassignUser(curso.id, user.id, user.nombre, curso.nombre)}
                          className="btn btn-sm text-danger p-0 border-0"
                          style={{ lineHeight: 1 }}
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