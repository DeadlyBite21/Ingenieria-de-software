import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

// --- Importaciones de Bootstrap ---
import {
  Modal, Button, Form, FloatingLabel, Toast, ToastContainer, Table, Spinner
} from 'react-bootstrap';

// --- Iconos ---
import {
  InboxesFill, People, JournalPlus, PersonAdd, Trash,
  ExclamationTriangleFill, CheckCircleFill, XCircleFill, Download
} from 'react-bootstrap-icons';

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Estados de Modals ---
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modal de Lista de Usuarios (Carga perezosa)
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [currentCourseUsers, setCurrentCourseUsers] = useState([]);
  const [currentCourseName, setCurrentCourseName] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // --- Estados de Datos ---
  const [newCourse, setNewCourse] = useState({ nombre: '' });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [courseToDelete, setCourseToDelete] = useState(null);

  // Conteos optimizados
  const [incidentCounts, setIncidentCounts] = useState({});
  const [studentCounts, setStudentCounts] = useState({}); // Nuevo estado para alumnos

  // --- Toast ---
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (message, variant = 'success') => {
    setToastConfig({ show: true, message, variant });
  };

  const loadData = async () => {
    try {
      // Carga paralela de datos ligeros
      const [usuariosData, cursosData, incidentesStats, alumnosStats] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/cursos'),
        apiFetch('/api/incidentes/conteo'),
        apiFetch('/api/cursos/conteo-alumnos') // Nuevo endpoint
      ]);

      setUsuarios(usuariosData);
      setCursos(cursosData);
      setIncidentCounts(incidentesStats);
      setStudentCounts(alumnosStats); // Guardamos conteo de alumnos

    } catch (err) {
      setError(err.message);
      showToast('Error al cargar datos: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/cursos/crear', { method: 'POST', body: JSON.stringify(newCourse) });
      setNewCourse({ nombre: '' });
      setShowCreateCourse(false);
      loadData();
      showToast('¡Curso creado con éxito!', 'success');
    } catch (err) {
      showToast('Error al crear curso: ' + err.message, 'danger');
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedCourse) return showToast('Selecciona usuario y curso', 'danger');
    try {
      await apiFetch(`/api/cursos/${selectedCourse.id}/usuarios/${selectedUser}`, { method: 'POST' });
      setSelectedUser('');
      setShowAssignUser(false);
      loadData(); // Actualizar contadores
      showToast('Usuario asignado correctamente', 'success');
    } catch (err) {
      showToast('Error al asignar: ' + err.message, 'danger');
    }
  };

  const requestDeleteCourse = (curso) => {
    setCourseToDelete(curso);
    setShowDeleteModal(true);
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      await apiFetch(`/api/cursos/${courseToDelete.id}`, { method: 'DELETE' });
      loadData();
      showToast(`Se eliminó el curso "${courseToDelete.nombre}" con éxito`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Hubo un error inesperado al eliminar', 'danger');
    } finally {
      setShowDeleteModal(false);
      setCourseToDelete(null);
    }
  };

  // NUEVO: Carga la lista de usuarios SOLO al hacer clic
  const handleOpenUserList = async (cursoId, cursoNombre) => {
    setCurrentCourseName(cursoNombre);
    setShowUserListModal(true);
    setLoadingUsers(true);
    setCurrentCourseUsers([]); // Limpiar lista anterior

    try {
      const users = await apiFetch(`/api/cursos/${cursoId}/usuarios`);
      // Ordenar: Profesor primero, luego alfabético
      const sortedUsers = users.sort((a, b) => {
        if (a.rol === 1 && b.rol !== 1) return -1;
        if (a.rol !== 1 && b.rol === 1) return 1;
        return a.nombre.localeCompare(b.nombre);
      });
      setCurrentCourseUsers(sortedUsers);
    } catch (err) {
      showToast("Error al cargar la lista de integrantes", "warning");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDownloadCSV = () => {
    if (currentCourseUsers.length === 0) return;
    const headers = ['RUT,Nombre,Mail,Rol'];
    const rows = currentCourseUsers.map(u => {
      let rolName = 'Otro';
      if (u.rol === 0) rolName = 'Administrador';
      else if (u.rol === 1) rolName = 'Profesor';
      else if (u.rol === 2) rolName = 'Alumno';
      else if (u.rol === 3) rolName = 'Psicólogo';
      return `"${u.rut}","${u.nombre}","${u.correo}","${rolName}"`;
    });

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Lista_${currentCourseName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-4 text-center">Cargando dashboard...</div>;
  if (error) return <div className="p-4 text-danger">Error crítico: {error}</div>;

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          GESTIÓN DE CURSOS
        </h1>
        <div className="d-flex gap-2">
          <button onClick={() => setShowCreateCourse(true)} className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold" style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}>
            <JournalPlus size={20} /> Crear Curso
          </button>
          <button onClick={() => setShowAssignUser(true)} className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold" style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}>
            <PersonAdd size={20} /> Asignar Usuario
          </button>
        </div>
      </div>
      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {/* Grid de Cursos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {cursos.map((curso) => {
          const totalAlumnos = studentCounts[curso.id] || 0;
          const totalIncidentes = incidentCounts[curso.id] || 0;

          return (
            <div key={curso.id} style={{
              backgroundColor: '#6A6DA8', borderRadius: '12px', padding: '1.5rem',
              color: 'white', position: 'relative', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s'
            }}>
              <button onClick={() => requestDeleteCourse(curso)} className="btn btn-sm btn-link text-white position-absolute top-0 end-0 m-2 p-0" title="Eliminar curso" style={{ opacity: 0.6 }}>
                <Trash />
              </button>

              <h3 className="fw-bold mb-4" style={{ fontSize: '1.4rem' }}>{curso.nombre}</h3>

              <div className="d-flex justify-content-center gap-4">
                {/* Botón Alumnos (Carga al hacer clic) */}
                <div className="d-flex flex-column align-items-center"
                  onClick={() => handleOpenUserList(curso.id, curso.nombre)}
                  style={{ cursor: 'pointer' }} title="Ver lista de integrantes">
                  <div style={{
                    width: '60px', height: '60px', backgroundColor: '#D9D9D9', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', marginBottom: '5px',
                    transition: 'transform 0.2s'
                  }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}>
                    <People size={28} />
                  </div>
                  <span className="fw-bold fs-5">{totalAlumnos}</span>
                </div>

                {/* Contador Incidentes */}
                <div className="d-flex flex-column align-items-center">
                  <div style={{
                    width: '60px', height: '60px', backgroundColor: '#D9D9D9', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', marginBottom: '5px'
                  }}>
                    <InboxesFill size={28} />
                  </div>
                  <span className="fw-bold fs-5">{totalIncidentes}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODALES --- */}

      {/* 1. Crear Curso */}
      <Modal show={showCreateCourse} onHide={() => setShowCreateCourse(false)} centered backdrop="static">
        <Modal.Header closeButton><Modal.Title className="fw-bold">Crear Curso</Modal.Title></Modal.Header>
        <Form onSubmit={handleCreateCourse}>
          <Modal.Body>
            <FloatingLabel controlId="floatingCourseName" label="Nombre del curso" className="mb-3">
              <Form.Control type="text" placeholder="Nombre" value={newCourse.nombre} onChange={(e) => setNewCourse({ ...newCourse, nombre: e.target.value })} required autoFocus />
            </FloatingLabel>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-danger" onClick={() => setShowCreateCourse(false)}>Cancelar</Button>
            <Button variant="success" type="submit">Aceptar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* 2. Asignar Usuario */}
      <Modal show={showAssignUser} onHide={() => setShowAssignUser(false)} centered backdrop="static">
        <Modal.Header closeButton><Modal.Title className="fw-bold">Asignar Usuario</Modal.Title></Modal.Header>
        <Form onSubmit={handleAssignUser}>
          <Modal.Body>
            <FloatingLabel controlId="floatingSelectCourse" label="Seleccionar Curso" className="mb-3">
              <Form.Select onChange={(e) => setSelectedCourse(cursos.find(c => c.id === parseInt(e.target.value)))} defaultValue="">
                <option value="" disabled>Elige un curso...</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Form.Select>
            </FloatingLabel>
            <FloatingLabel controlId="floatingSelectUser" label="Seleccionar Usuario">
              <Form.Select onChange={(e) => setSelectedUser(e.target.value)} defaultValue="">
                <option value="" disabled>Elige un usuario...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rut})</option>)}
              </Form.Select>
            </FloatingLabel>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-danger" onClick={() => setShowAssignUser(false)}>Cancelar</Button>
            <Button variant="success" type="submit">Asignar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* 3. Confirmar Eliminación */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white"><Modal.Title><ExclamationTriangleFill className="me-2" /> Confirmar Eliminación</Modal.Title></Modal.Header>
        <Modal.Body>¿Eliminar curso <strong>{courseToDelete?.nombre}</strong>? No se puede deshacer.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDeleteCourse}>Eliminar</Button>
        </Modal.Footer>
      </Modal>

      {/* 4. Lista de Usuarios (Modal Dinámico) */}
      <Modal show={showUserListModal} onHide={() => setShowUserListModal(false)} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Integrantes: {currentCourseName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingUsers ? (
            <div className="text-center py-4"><Spinner animation="border" /></div>
          ) : currentCourseUsers.length === 0 ? (
            <p className="text-center text-muted">No hay usuarios en este curso.</p>
          ) : (
            <Table striped bordered hover size="sm">
              <thead><tr><th>Nombre</th><th>Rol</th></tr></thead>
              <tbody>
                {currentCourseUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>
                      {u.rol === 1 ? <span className="badge bg-warning text-dark">Profesor</span> :
                        u.rol === 2 ? <span className="badge bg-primary">Alumno</span> : <span className="badge bg-secondary">Otro</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-dark" onClick={handleDownloadCSV} disabled={loadingUsers || currentCourseUsers.length === 0}>
            <Download className="me-2" /> Descargar Lista
          </Button>
          <Button variant="secondary" onClick={() => setShowUserListModal(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="bottom-end" className="p-3">
        <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={3000} autohide bg={toastConfig.variant}>
          <Toast.Header>
            {toastConfig.variant === 'success' ? <CheckCircleFill className="text-success me-2" /> : <XCircleFill className="text-danger me-2" />}
            <strong className="me-auto">Sistema</strong>
          </Toast.Header>
          <Toast.Body className="text-white">{toastConfig.message}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}