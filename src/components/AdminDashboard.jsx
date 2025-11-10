// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import { CollectionFill, PersonPlusFill, Trash } from 'react-bootstrap-icons';

export default function AdminDashboard() {
  const { user } = useAuth();
  // Mantenemos los 3 estados, ya que son necesarios para asignar usuarios a cursos
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [courseUsers, setCourseUsers] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para crear nuevo curso
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ nombre: '' });

  // Estados para gestión de asignaciones curso-usuario
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Seguimos cargando los 3, son necesarios para la lógica de asignación
      const [usuariosData, cursosData] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/cursos')
      ]);
      setUsuarios(usuariosData);
      setCursos(cursosData);
      
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

  // --- Handlers de Cursos y Asignaciones (Sin cambios) ---
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1><CollectionFill className="me-3" />Gestión de Cursos</h1>
        <div className="d-flex gap-2">
          <Button 
            variant="info"
            onClick={() => setShowCreateCourse(!showCreateCourse)}
          >
            {showCreateCourse ? 'Cancelar' : '📚 Crear Curso'}
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShowAssignUser(!showAssignUser)}
          >
            <PersonPlusFill className="me-2" />
            {showAssignUser ? 'Cancelar' : 'Asignar Usuario'}
          </Button>
        </div>
      </div>

      {showCreateCourse && (
        <Card className="mb-4">
          <Card.Body>
            <Form onSubmit={handleCreateCourse} className="d-flex gap-3">
              <Form.Control
                type="text"
                placeholder="Nombre del nuevo curso"
                value={newCourse.nombre}
                onChange={(e) => setNewCourse({...newCourse, nombre: e.target.value})}
                required
              />
              <Button type="submit">Crear Curso</Button>
            </Form>
          </Card.Body>
        </Card>
      )}

      {showAssignUser && (
        <Card className="mb-4">
          <Card.Header>Asignar Usuario a Curso</Card.Header>
          <Card.Body>
            <Form onSubmit={handleAssignUser}>
              <div className="row g-3 align-items-end">
                <div className="col-md-5">
                  <Form.Label>Curso:</Form.Label>
                  <Form.Select
                    value={selectedCourse?.id || ''}
                    onChange={(e) => {
                      const course = cursos.find(c => c.id === parseInt(e.target.value));
                      setSelectedCourse(course);
                    }}
                    required
                  >
                    <option value="">Seleccionar curso...</option>
                    {cursos.map((curso) => (
                      <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-5">
                  <Form.Label>Usuario:</Form.Label>
                  <Form.Select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar usuario...</option>
                    {usuarios
                      .filter(u => u.rol !== 0) // No asignar Admins
                      .map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombre} ({usuario.rol === 1 ? 'Profesor' : 'Alumno'})
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-2">
                  <Button type="submit" className="w-100">Asignar</Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {/* --- Lista de Cursos --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
        {cursos.map((curso) => (
          <Card key={curso.id}>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <Card.Title className="h5 mb-0">{curso.nombre} (ID: {curso.id})</Card.Title>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleDeleteCourse(curso.id, curso.nombre)}
              >
                <Trash />
              </Button>
            </Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <h6 className="mb-2">Usuarios asignados ({courseUsers[curso.id]?.length || 0}):</h6>
                {courseUsers[curso.id]?.length > 0 ? (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {courseUsers[curso.id].map((user) => (
                      <div key={user.id} className="d-flex justify-content-between align-items-center p-2 bg-light rounded mb-1">
                        <span>
                          {user.nombre} ({user.rol === 1 ? 'Prof' : 'Est'})
                        </span>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleUnassignUser(curso.id, user.id, user.nombre, curso.nombre)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted small fst-italic mb-0">
                    No hay usuarios asignados
                  </p>
                )}
              </ListGroup.Item>
            </ListGroup>
          </Card>
        ))}
      </div>
    </div>
  );
}