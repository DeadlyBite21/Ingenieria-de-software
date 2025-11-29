// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// --- Importaciones de Bootstrap Components ---
import {
  Modal,
  Button,
  Form,
  FloatingLabel,
  Toast,
  ToastContainer
} from 'react-bootstrap';

// --- Importación de Iconos ---
import {
  InboxesFill,
  People,
  JournalPlus,
  PersonAdd,
  Trash,
  ExclamationTriangleFill, // Icono para la alerta de eliminar
  CheckCircleFill,         // Icono para éxito
  XCircleFill              // Icono para error
} from 'react-bootstrap-icons';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Estados de Modals (Formularios) ---
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Modal de confirmación

  // --- Estados de Datos de Formularios ---
  const [newCourse, setNewCourse] = useState({ nombre: '' });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [courseToDelete, setCourseToDelete] = useState(null); // Curso seleccionado para borrar

  const [courseUsers, setCourseUsers] = useState({});
  const [incidentCounts, setIncidentCounts] = useState({});

  // --- Estado para Notificaciones (Toasts) ---
  const [toastConfig, setToastConfig] = useState({
    show: false,
    message: '',
    variant: 'success' // 'success' (verde) o 'danger' (rojo)
  });

  useEffect(() => {
    loadData();
  }, []);

  // Función auxiliar para mostrar notificaciones
  const showToast = (message, variant = 'success') => {
    setToastConfig({ show: true, message, variant });
  };

  const loadData = async () => {
    try {
      const [usuariosData, cursosData] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/cursos')
      ]);
      setUsuarios(usuariosData);
      setCursos(cursosData);

      const courseUsersData = {};
      const incidentMockData = {};

      for (const curso of cursosData) {
        try {
          const users = await apiFetch(`/api/cursos/${curso.id}/usuarios`);
          courseUsersData[curso.id] = users;
        } catch (err) {
          courseUsersData[curso.id] = [];
        }
        incidentMockData[curso.id] = Math.floor(Math.random() * 20) + 1;
      }
      setCourseUsers(courseUsersData);
      setIncidentCounts(incidentMockData);

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
      showToast('¡Curso creado con éxito!', 'success'); // Notificación Verde
    } catch (err) {
      showToast('Error al crear curso: ' + err.message, 'danger'); // Notificación Roja
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedCourse) return showToast('Selecciona usuario y curso', 'danger');
    try {
      await apiFetch(`/api/cursos/${selectedCourse.id}/usuarios/${selectedUser}`, { method: 'POST' });
      setSelectedUser('');
      setShowAssignUser(false);
      loadData();
      showToast('Usuario asignado correctamente', 'success');
    } catch (err) {
      showToast('Error al asignar: ' + err.message, 'danger');
    }
  };

  // 1. Paso previo: Abrir modal de confirmación
  const requestDeleteCourse = (curso) => {
    setCourseToDelete(curso);
    setShowDeleteModal(true);
  };

  // 2. Acción real: Eliminar tras confirmar
  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;

    try {
      await apiFetch(`/api/cursos/${courseToDelete.id}`, { method: 'DELETE' });
      loadData();
      showToast(`Se eliminó el curso "${courseToDelete.nombre}" con éxito`, 'success');
    } catch (err) {
      showToast('Hubo un error inesperado al eliminar', 'danger');
    } finally {
      setShowDeleteModal(false);
      setCourseToDelete(null);
    }
  };

  if (loading) return <div className="p-4 text-center">Cargando dashboard...</div>;
  if (error) return <div className="p-4 text-danger">Error crítico: {error}</div>;

  return (
    <div>
      {/* --- Header Estilizado --- */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          GESTIÓN DE CURSOS
        </h1>

        <div className="d-flex gap-2">
          <button
            onClick={() => setShowCreateCourse(true)}
            className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold"
            style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}
          >
            <JournalPlus size={20} /> Crear Curso
          </button>

          <button
            onClick={() => setShowAssignUser(true)}
            className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold"
            style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}
          >
            <PersonAdd size={20} /> Asignar Usuario
          </button>
        </div>
      </div>

      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {/* --- GRID DE TARJETAS --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem'
      }}>
        {cursos.map((curso) => {
          const totalAlumnos = courseUsers[curso.id]?.filter(u => u.rol === 2).length || 0;
          const totalIncidentes = incidentCounts[curso.id] || 0;

          return (
            <div key={curso.id} style={{
              backgroundColor: '#6A6DA8',
              borderRadius: '12px',
              padding: '1.5rem',
              color: 'white',
              position: 'relative',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s'
            }}>
              {/* Botón eliminar llama a la función de confirmación */}
              <button
                onClick={() => requestDeleteCourse(curso)}
                className="btn btn-sm btn-link text-white position-absolute top-0 end-0 m-2 p-0"
                title="Eliminar curso"
                style={{ opacity: 0.6 }}
              >
                <Trash />
              </button>

              <h3 className="fw-bold mb-4" style={{ fontSize: '1.4rem' }}>
                {curso.nombre}
              </h3>

              <div className="d-flex justify-content-center gap-4">
                <div className="d-flex flex-column align-items-center">
                  <div style={{
                    width: '60px', height: '60px',
                    backgroundColor: '#D9D9D9',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#333', marginBottom: '5px'
                  }}>
                    <People size={28} />
                  </div>
                  <span className="fw-bold fs-5">{totalAlumnos}</span>
                </div>

                <div className="d-flex flex-column align-items-center">
                  <div style={{
                    width: '60px', height: '60px',
                    backgroundColor: '#D9D9D9',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#333', marginBottom: '5px'
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

      {/* ================= MODALES ================= */}

      {/* 1. Crear Curso */}
      <Modal show={showCreateCourse} onHide={() => setShowCreateCourse(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Creación de Curso</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateCourse}>
          <Modal.Body>
            <FloatingLabel controlId="floatingCourseName" label="Nombre del curso" className="mb-3">
              <Form.Control
                type="text" placeholder="Nombre"
                value={newCourse.nombre} onChange={(e) => setNewCourse({ ...newCourse, nombre: e.target.value })}
                required autoFocus
              />
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
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Asignar Usuario</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAssignUser}>
          <Modal.Body>
            <FloatingLabel controlId="floatingSelectCourse" label="Seleccionar Curso" className="mb-3">
              <Form.Select onChange={(e) => setSelectedCourse(cursos.find(c => c.id === parseInt(e.target.value)))} defaultValue="">
                <option value="" disabled>Elige un curso...</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Form.Select>
            </FloatingLabel>
            <FloatingLabel controlId="floatingSelectUser" label="Seleccionar Usuario">
              <Form.Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="">Elige un usuario...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.rol === 1 ? 'Profesor' : 'Alumno'})</option>
                ))}
              </Form.Select>
            </FloatingLabel>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-danger" onClick={() => setShowAssignUser(false)}>Cancelar</Button>
            <Button variant="success" type="submit">Asignar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* 3. MODAL DE CONFIRMACIÓN DE ELIMINAR (Nuevo) */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title className="fw-bold d-flex align-items-center gap-2">
            <ExclamationTriangleFill /> Confirmar Eliminación
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="fs-5">
            ¿Estás seguro de que quieres eliminar el curso <br />
            <strong>"{courseToDelete?.nombre}"</strong>?
          </p>
          <p className="text-muted small">Esta acción no se puede deshacer.</p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="px-4">
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDeleteCourse} className="px-4">
            Sí, Eliminar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ================= NOTIFICACIONES (TOASTS) ================= */}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          onClose={() => setToastConfig({ ...toastConfig, show: false })}
          show={toastConfig.show}
          delay={4000}
          autohide
          bg={toastConfig.variant}
        >
          <Toast.Header>
            {toastConfig.variant === 'success' ? <CheckCircleFill className="text-success me-2" /> : <XCircleFill className="text-danger me-2" />}
            <strong className="me-auto">Sistema</strong>
            <small>Ahora</small>
          </Toast.Header>
          <Toast.Body className={toastConfig.variant === 'dark' ? 'text-white' : 'text-white'}>
            {toastConfig.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

    </div>
  );
}