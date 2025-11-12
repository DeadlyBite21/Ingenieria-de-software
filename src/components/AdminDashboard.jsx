// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// --- Importaciones de React Bootstrap ---
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import ListGroup from 'react-bootstrap/ListGroup';
import { Trash, PersonPlusFill, BookFill } from 'react-bootstrap-icons';


export default function AdminDashboard() {
  const { user } = useAuth();
  
  // MANTENEMOS usuarios, cursos y courseUsers
  // porque son necesarios para "Asignar Usuario"
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [courseUsers, setCourseUsers] = useState({}); // { [cursoId]: [lista_de_usuarios] }
  
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

  // loadData sigue igual, necesita toda la info para los dropdowns
  const loadData = async () => {
    try {
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

  // --- Handlers de CURSOS (sin cambios) ---
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
  // --- FIN de Handlers de Cursos ---

  if (loading) return <div className="text-center my-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="danger">Error: {error}</Alert>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Panel de Administrador</h1>
        <p className="text-muted mb-0">
          Gestiona los cursos y sus asignaciones.
        </p>
      </div>
      
      {/*
        --- SECCIÓN GESTIÓN DE USUARIOS ELIMINADA ---
        (Toda esa lógica ahora está en GestionUsuariosPage.jsx)
      */}

      {/* --- Sección de Cursos --- */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items: center">
            <h2 className="h4 mb-0">Gestión de Cursos</h2>
            <div className="d-flex gap-2">
              <Button 
                variant="outline-primary"
                onClick={() => setShowCreateCourse(!showCreateCourse)}
              >
                <BookFill className="me-2" />
                {showCreateCourse ? 'Cancelar' : 'Crear Curso'}
              </Button>
              <Button 
                variant="outline-secondary"
                onClick={() => setShowAssignUser(!showAssignUser)}
              >
                <PersonPlusFill className="me-2" />
                {showAssignUser ? 'Cancelar' : 'Asignar Usuario'}
              </Button>
            </div>
          </div>
        </Card.Header>
        
        <Card.Body>
          {showCreateCourse && (
            <Form onSubmit={handleCreateCourse} className="mb-3 p-3 bg-light rounded">
              <div className="d-flex gap-3">
                <Form.Control
                  type="text"
                  placeholder="Nombre del nuevo curso"
                  value={newCourse.nombre}
                  onChange={(e) => setNewCourse({...newCourse, nombre: e.target.value})}
                  required
                />
                <Button type="submit" variant="primary">
                  Guardar Curso
                </Button>
              </div>
            </Form>
          )}

          {showAssignUser && (
            <Form onSubmit={handleAssignUser} className="mb-3 p-3 bg-light rounded">
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
                    {/* Filtramos admins (rol 0) para que no se puedan asignar */
                    usuarios.filter(u => u.rol !== 0).map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombre} ({usuario.rol === 1 ? 'Profesor' : 'Alumno'})
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-2">
                  <Button type="submit" variant="primary" className="w-100">
                    Asignar
                  </Button>
                </div>
              </div>
            </Form>
          )}

          {/* Lista de Cursos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
            {cursos.map((curso) => (
              <Card key={curso.id} className="h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-0">{curso.nombre}</h5>
                    <small className="text-muted">ID: {curso.id}</small>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteCourse(curso.id, curso.nombre)}
                  >
                    <Trash />
                  </Button>
                </Card.Header>
                <ListGroup variant="flush" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <ListGroup.Item className="fw-bold bg-light">
                    Usuarios asignados ({courseUsers[curso.id]?.length || 0}):
                  </ListGroup.Item>
                  {courseUsers[curso.id]?.length > 0 ? (
                    courseUsers[curso.id].map((user) => (
                      <ListGroup.Item key={user.id} className="d-flex justify-content-between align-items-center py-2 px-3">
                        <small>
                          {user.nombre} ({user.rol === 1 ? 'Prof' : 'Est'})
                        </small>
                        <Button
                          variant="danger"
                          size="sm"
                          style={{'--bs-btn-padding-y': '.1rem', '--bs-btn-padding-x': '.3rem', '--bs-btn-font-size': '.7rem'}}
                          onClick={() => handleUnassignUser(curso.id, user.id, user.nombre, curso.nombre)}
                        >
                          ✕
                        </Button>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item className="text-muted text-center py-3">
                      <small>No hay usuarios asignados</small>
                    </ListGroup.Item>
                  )}
                </ListGroup>
              </Card>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}