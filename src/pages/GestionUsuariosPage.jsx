// src/pages/GestionUsuariosPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Importaciones de React Bootstrap
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { PlusCircleFill, Trash, Download } from 'react-bootstrap-icons';

export default function GestionUsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [courseUsers, setCourseUsers] = useState({});
  
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

  // Estados de filtros
  const [filtroRol, setFiltroRol] = useState('alumnos');
  const [filtroCurso, setFiltroCurso] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usuariosData, cursosData] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/cursos') // Los necesitamos para el filtro de "asignar"
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/usuarios/crear', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      
      setNewUser({ rol: '', rut: '', nombre: '', correo: '', contrasena: '' });
      setShowCreateUser(false);
      loadData();
      alert('Usuario creado exitosamente');
    } catch (err) {
      alert('Error al crear usuario: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario "${userName}"?`)) {
      try {
        await apiFetch(`/api/usuarios/${userId}`, {
          method: 'DELETE'
        });
        loadData();
        alert('Usuario eliminado exitosamente');
      } catch (err) {
        alert('Error al eliminar usuario: ' + err.message);
      }
    }
  };

  // Lógica de filtrado
  const usuariosFiltrados = usuarios.filter(u => {
    let pasaFiltroRol = false;
    if (filtroRol === 'todos') pasaFiltroRol = true;
    else if (filtroRol === 'alumnos' && u.rol === 2) pasaFiltroRol = true;
    else if (filtroRol === 'profesores' && u.rol === 1) pasaFiltroRol = true;
    else if (filtroRol === 'admins' && u.rol === 0) pasaFiltroRol = true;

    if (!pasaFiltroRol) return false;

    if (filtroRol === 'alumnos' && filtroCurso) {
      const usuariosDelCurso = courseUsers[filtroCurso] || [];
      return usuariosDelCurso.some(userInCourse => userInCourse.id === u.id);
    }
    
    return true;
  });

  const getFiltroBtnStyle = (tipo) => ({
    backgroundColor: filtroRol === tipo ? '#007bff' : '#f8f9fa',
    color: filtroRol === tipo ? 'white' : '#333',
    border: '1px solid #ddd',
  });

  const cambiarFiltroRol = (nuevoRol) => {
    setFiltroRol(nuevoRol);
    if (nuevoRol !== 'alumnos') {
      setFiltroCurso('');
    }
  };
  
  // --- NUEVA FUNCIÓN: Descargar CSV ---
  const handleDownloadCSV = () => {
    const headers = ["RUT", "Nombre", "Correo", "Rol"];
    
    const getRolText = (rol) => {
      switch (rol) {
        case 0: return 'Administrador';
        case 1: return 'Profesor';
        case 2: return 'Alumno';
        default: return 'Desconocido';
      }
    };

    // Escapar comas y comillas en los datos
    const escapeCSV = (str) => {
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = usuariosFiltrados.map(user => 
      [
        user.rut,
        escapeCSV(user.nombre),
        user.correo,
        getRolText(user.rol)
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'usuarios_filtrados.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-center my-5"><Spinner animation="border" /></div>;
  }
  
  if (error) {
    return <Alert variant="danger">Error al cargar datos: {error}</Alert>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Gestión de Usuarios</h1>
        <div>
          <Button 
            variant="outline-success" 
            className="me-2"
            onClick={handleDownloadCSV}
            disabled={usuariosFiltrados.length === 0}
          >
            <Download className="me-2" />
            Descargar CSV
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShowCreateUser(!showCreateUser)}
          >
            <PlusCircleFill className="me-2" />
            {showCreateUser ? 'Cancelar' : 'Crear Usuario'}
          </Button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showCreateUser && (
        <Card className="mb-4">
          <Card.Header>Crear Nuevo Usuario</Card.Header>
          <Card.Body>
            <Form onSubmit={handleCreateUser}>
              <div className="row g-3">
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>Rol*</Form.Label>
                    <Form.Select
                      value={newUser.rol}
                      onChange={(e) => setNewUser({...newUser, rol: parseInt(e.target.value)})}
                      required
                    >
                      <option value="">Seleccionar Rol</option>
                      <option value={0}>Administrador</option>
                      <option value={1}>Profesor</option>
                      <option value={2}>Alumno</option>
                    </Form.Select>
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>RUT*</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="RUT"
                      value={newUser.rut}
                      onChange={(e) => setNewUser({...newUser, rut: e.target.value})}
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group>
                    <Form.Label>Nombre Completo*</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Nombre completo"
                      value={newUser.nombre}
                      onChange={(e) => setNewUser({...newUser, nombre: e.target.value})}
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group>
                    <Form.Label>Correo*</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Correo electrónico"
                      value={newUser.correo}
                      onChange={(e) => setNewUser({...newUser, correo: e.target.value})}
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group>
                    <Form.Label>Contraseña*</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Contraseña"
                      value={newUser.contrasena}
                      onChange={(e) => setNewUser({...newUser, contrasena: e.target.value})}
                      required
                    />
                  </Form.Group>
                </div>
              </div>
              <div className="text-end mt-3">
                <Button type="submit" variant="success">
                  Guardar Usuario
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span className="me-3 fw-bold">Filtrar por Rol:</span>
              <Button size="sm" style={getFiltroBtnStyle('todos')} onClick={() => cambiarFiltroRol('todos')} className="me-1">
                Todos ({usuarios.length})
              </Button>
              <Button size="sm" style={getFiltroBtnStyle('alumnos')} onClick={() => cambiarFiltroRol('alumnos')} className="me-1">
                Alumnos ({usuarios.filter(u => u.rol === 2).length})
              </Button>
              <Button size="sm" style={getFiltroBtnStyle('profesores')} onClick={() => cambiarFiltroRol('profesores')} className="me-1">
                Profesores ({usuarios.filter(u => u.rol === 1).length})
              </Button>
              <Button size="sm" style={getFiltroBtnStyle('admins')} onClick={() => cambiarFiltroRol('admins')}>
                Admins ({usuarios.filter(u => u.rol === 0).length})
              </Button>
            </div>
            {filtroRol === 'alumnos' && (
              <div className="d-flex align-items-center" style={{ minWidth: '300px' }}>
                <Form.Label className="me-2 mb-0 fw-bold">Curso:</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtroCurso}
                  onChange={(e) => setFiltroCurso(e.target.value)}
                >
                  <option value="">Todos los Cursos</option>
                  {cursos.map(curso => (
                    <option key={curso.id} value={curso.id}>
                      {curso.nombre} (ID: {curso.id})
                    </option>
                  ))}
                </Form.Select>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Tabla de Usuarios */}
      <Card>
        <Card.Header>{usuariosFiltrados.length} usuarios encontrados</Card.Header>
        <Table striped bordered hover responsive className="m-0">
          <thead>
            <tr>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length > 0 ? (
              usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id}>
                  <td>{usuario.rut}</td>
                  <td>{usuario.nombre}</td>
                  <td>{usuario.correo}</td>
                  <td>
                    {usuario.rol === 0 ? 'Administrador' : usuario.rol === 1 ? 'Profesor' : 'Alumno'}
                  </td>
                  <td className="text-center">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteUser(usuario.id, usuario.nombre)}
                    >
                      <Trash />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center text-muted">
                  No hay usuarios que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}