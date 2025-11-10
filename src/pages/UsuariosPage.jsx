// src/pages/UsuariosPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';

// --- Importaciones de React Bootstrap ---
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { Download } from 'react-bootstrap-icons';

export default function UsuariosPage() {
  // Estados para datos
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [courseUsers, setCourseUsers] = useState({}); // { [cursoId]: [lista_de_usuarios] }
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados de filtros
  const [filtroRol, setFiltroRol] = useState('alumnos'); // Inicia en 'alumnos'
  const [filtroCurso, setFiltroCurso] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
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

  // Lógica de filtrado (memoizada para eficiencia)
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      let pasaFiltroRol = false;

      // Filtro de Rol
      if (filtroRol === 'todos') {
        pasaFiltroRol = true;
      } else if (filtroRol === 'alumnos' && u.rol === 2) {
        pasaFiltroRol = true;
      } else if (filtroRol === 'profesores' && u.rol === 1) {
        pasaFiltroRol = true;
      } else if (filtroRol === 'admins' && u.rol === 0) {
        pasaFiltroRol = true;
      }

      if (!pasaFiltroRol) return false;

      // Filtro de Curso (SOLO si el filtro de rol es 'alumnos' o 'profesores')
      if ((filtroRol === 'alumnos' || filtroRol === 'profesores') && filtroCurso) {
        const usuariosDelCurso = courseUsers[filtroCurso] || [];
        return usuariosDelCurso.some(userInCourse => userInCourse.id === u.id);
      }
      
      return true;
    });
  }, [usuarios, filtroRol, filtroCurso, courseUsers]);

  // Manejador para los botones de rol
  const cambiarFiltroRol = (nuevoRol) => {
    setFiltroRol(nuevoRol);
    // Limpiamos el filtro de curso si el rol no es alumno o profesor
    if (nuevoRol !== 'alumnos' && nuevoRol !== 'profesores') {
      setFiltroCurso('');
    }
  };

  // --- ¡NUEVA FUNCIÓN DE DESCARGA CSV! ---
  const handleDownloadCSV = () => {
    // 1. Filtrar solo alumnos (rol=2) y profesores (rol=1) de la lista ya filtrada
    const usuariosParaCSV = usuariosFiltrados.filter(
      u => u.rol === 1 || u.rol === 2
    );

    if (usuariosParaCSV.length === 0) {
      alert("No hay alumnos o profesores en la lista filtrada para descargar.");
      return;
    }

    // 2. Definir cabeceras
    const headers = ['RUT', 'Nombre', 'Correo', 'Rol'];
    
    // 3. Convertir datos a filas CSV
    const csvRows = [
      headers.join(','), // Cabecera
      ...usuariosParaCSV.map(u => {
        const rol = u.rol === 1 ? 'Profesor' : 'Alumno';
        // Envolvemos cada campo en comillas dobles para manejar comas en los nombres
        return `"${u.rut}","${u.nombre}","${u.correo}","${rol}"`;
      })
    ];

    // 4. Crear el contenido y el Blob
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 5. Crear enlace de descarga y simular clic
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generar nombre de archivo dinámico
    let fileName = `lista_${filtroRol}`;
    if (filtroCurso && (filtroRol === 'alumnos' || filtroRol === 'profesores')) {
      const nombreCurso = cursos.find(c => c.id == filtroCurso)?.nombre || `curso_${filtroCurso}`;
      fileName += `_${nombreCurso.replace(/ /g, '_')}`;
    }
    fileName += '.csv';

    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Renderizado ---
  
  if (loading) {
    return <div className="text-center my-5"><Spinner animation="border" /></div>;
  }
  if (error) {
    return <Alert variant="danger">Error al cargar datos: {error}</Alert>;
  }

  return (
    <div>
      <h1 className="mb-4">Gestión de Usuarios</h1>

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="m-0">Filtros</h5>
            <Button variant="success" onClick={handleDownloadCSV} disabled={loading}>
              <Download className="me-2" />
              Descargar CSV (Alumnos/Profes)
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Filtrar por Rol:</Form.Label>
              <div>
                {/* Usamos 'as="span"' para que los botones no recarguen la página */}
                <Button as="span" variant={filtroRol === 'todos' ? 'primary' : 'outline-secondary'} onClick={() => cambiarFiltroRol('todos')} className="me-2 mb-2">
                  Todos ({usuarios.length})
                </Button>
                <Button as="span" variant={filtroRol === 'alumnos' ? 'primary' : 'outline-secondary'} onClick={() => cambiarFiltroRol('alumnos')} className="me-2 mb-2">
                  Alumnos ({usuarios.filter(u => u.rol === 2).length})
                </Button>
                <Button as="span" variant={filtroRol === 'profesores' ? 'primary' : 'outline-secondary'} onClick={() => cambiarFiltroRol('profesores')} className="me-2 mb-2">
                  Profesores ({usuarios.filter(u => u.rol === 1).length})
                </Button>
                <Button as="span" variant={filtroRol === 'admins' ? 'primary' : 'outline-secondary'} onClick={() => cambiarFiltroRol('admins')} className="me-2 mb-2">
                  Admins ({usuarios.filter(u => u.rol === 0).length})
                </Button>
              </div>
            </Form.Group>

            {/* Dropdown de Cursos (Solo si 'alumnos' o 'profesores' está activo) */}
            {(filtroRol === 'alumnos' || filtroRol === 'profesores') && (
              <Form.Group>
                <Form.Label className="fw-bold">Filtrar por Curso:</Form.Label>
                <Form.Select
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
              </Form.Group>
            )}
          </Form>
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Header>
          Resultados ({usuariosFiltrados.length} usuarios)
        </Card.Header>
        <Table striped bordered hover responsive className="m-0">
          <thead>
            <tr>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center text-muted">
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