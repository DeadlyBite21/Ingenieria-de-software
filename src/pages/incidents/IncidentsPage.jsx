// src/pages/IncidentsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// --- Importaciones de React Bootstrap ---
import {
  Modal,
  Button,
  Table,
  Form,
  FloatingLabel,
  Badge,
  Toast,
  ToastContainer,
  Row,
  Col,
  Spinner,
  Accordion
} from 'react-bootstrap';

// --- Iconos ---
import {
  EyeFill,
  PencilSquare,
  PlusCircleFill,
  FunnelFill,
  ExclamationTriangleFill,
  CheckCircleFill,
  XCircleFill,
  ClockHistory,
  JournalPlus,
  PersonFill
} from 'react-bootstrap-icons';

// --- Date Picker ---
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function IncidentsPage() {
  const { isAdmin, isProfesor } = useAuth();
  const [incidentes, setIncidentes] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Estados de Modals ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // --- Estados de Edición / Historial ---
  const [isEditing, setIsEditing] = useState(false); // True si estamos en modo "Ver historial / Agregar suceso"
  const [editingId, setEditingId] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Data del incidente original para mostrar en el acordeón
  const [originalIncidentData, setOriginalIncidentData] = useState(null);
  // Controla si mostramos el formulario para agregar nuevo suceso
  const [showNewEventForm, setShowNewEventForm] = useState(false);

  const [detallesAlumnos, setDetallesAlumnos] = useState([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);

  // --- Estados del Formulario ---
  const [formData, setFormData] = useState({
    idCurso: '',
    tipo: 'académico',
    severidad: 'baja',
    estado: 'abierto',
    descripcion: '',
    lugar: '',
    alumnos: [],
    fechaHora: new Date()
  });
  const [alumnosDisponibles, setAlumnosDisponibles] = useState([]);

  // --- Filtros y Paginación ---
  const [filters, setFilters] = useState({ estado: '', idCurso: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  // --- Toast ---
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', variant: 'success' });

  // Cargar Incidentes
  const loadIncidentes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      if (filters.estado) params.append('estado', filters.estado);
      if (filters.idCurso) params.append('idCurso', filters.idCurso);

      const response = await apiFetch(`/api/incidentes?${params.toString()}`);
      setIncidentes(response.data);
      setPagination(prev => ({ ...prev, total: response.total, page: response.page }));
    } catch (err) {
      showToast('Error al cargar incidentes: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    const loadCursos = async () => {
      try {
        const data = await apiFetch('/api/cursos');
        setCursos(data);
      } catch (err) { console.error(err); }
    };
    loadCursos();
  }, []);

  useEffect(() => {
    loadIncidentes();
  }, [loadIncidentes]);

  useEffect(() => {
    const loadUsuariosCurso = async () => {
      if (!formData.idCurso) {
        setAlumnosDisponibles([]);
        return;
      }
      try {
        const usuariosData = await apiFetch(`/api/cursos/${formData.idCurso}/usuarios`);
        const alumnosYProfes = usuariosData.filter(u => u.rol === 1 || u.rol === 2);
        setAlumnosDisponibles(alumnosYProfes);
      } catch (err) {
        setAlumnosDisponibles([]);
      }
    };
    loadUsuariosCurso();
  }, [formData.idCurso]);

  const showToast = (message, variant = 'success') => {
    setToastConfig({ show: true, message, variant });
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const fetchAlumnosDetalle = async (incident) => {
    setLoadingDetalles(true);
    setDetallesAlumnos([]);
    if (!incident.alumnos || incident.alumnos.length === 0) {
      setLoadingDetalles(false);
      return;
    }
    try {
      const usuariosCurso = await apiFetch(`/api/cursos/${incident.id_curso}/usuarios`);
      const involucrados = usuariosCurso.filter(u => incident.alumnos.includes(u.id));
      setDetallesAlumnos(involucrados);
    } catch (err) {
      showToast("No se pudieron cargar los alumnos", "warning");
    } finally {
      setLoadingDetalles(false);
    }
  };

  // --- Handlers de Apertura ---

  // Abrir para CREAR nuevo incidente
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setOriginalIncidentData(null);
    setShowNewEventForm(true); // Siempre visible al crear
    setFormData({
      idCurso: '', tipo: 'académico', severidad: 'baja', estado: 'abierto', descripcion: '', lugar: '', alumnos: [], fechaHora: new Date()
    });
    setShowCreateModal(true);
  };

  // Abrir para VER HISTORIAL / AGREGAR SUCESO
  const handleOpenEdit = (incidente) => {
    setIsEditing(true);
    setEditingId(incidente.id);
    setOriginalIncidentData(incidente);
    setShowNewEventForm(false); // Oculto al inicio, muestra solo acordeón

    // Pre-cargamos el form con la data actual para facilitar la "continuación"
    setFormData({
      idCurso: incidente.id_curso,
      tipo: incidente.tipo, // Mantiene el tipo anterior por defecto
      severidad: incidente.severidad, // Mantiene severidad
      estado: incidente.estado, // Mantiene estado
      descripcion: '', // Descripción vacía para el nuevo suceso
      lugar: incidente.lugar || '',
      alumnos: incidente.alumnos || [],
      fechaHora: new Date() // Fecha actual para el nuevo suceso
    });
    setShowCreateModal(true);
  };

  const handleOpenDetail = (incidente) => {
    setSelectedIncident(incidente);
    setShowDetailModal(true);
    fetchAlumnosDetalle(incidente);
  };

  const handleFormChange = (e) => {
    const { name, value, multiple, selectedOptions } = e.target;
    if (multiple) {
      const values = Array.from(selectedOptions).map(opt => opt.value);
      setFormData(prev => ({ ...prev, [name]: values }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    if (!formData.idCurso) return showToast('Debes seleccionar un curso', 'warning');
    if (formData.descripcion.length < 5) return showToast('Describe el suceso detalladamente', 'warning');
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);

    try {
      if (isEditing) {
        // --- MODO AGREGAR SUCESO (PATCH) ---
        const payloadUpdate = {
          nuevoSuceso: {
            descripcion: formData.descripcion,
            tipo: formData.tipo,
            severidad: formData.severidad,
            estado: formData.estado,
            lugar: formData.lugar,
            fecha: formData.fechaHora ? formData.fechaHora.toISOString() : new Date().toISOString()
          }
        };

        await apiFetch(`/api/incidentes/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payloadUpdate)
        });
        showToast('Nuevo suceso registrado en la bitácora', 'success');

      } else {
        // --- MODO CREAR (POST) ---
        const payloadCreate = {
          idCurso: parseInt(formData.idCurso),
          tipo: formData.tipo,
          severidad: formData.severidad,
          estado: formData.estado,
          descripcion: formData.descripcion,
          lugar: formData.lugar || null,
          alumnos: (formData.alumnos || []).map(id => parseInt(id)),
          fecha: formData.fechaHora ? formData.fechaHora.toISOString() : null
        };

        await apiFetch('/api/incidentes', {
          method: 'POST',
          body: JSON.stringify(payloadCreate)
        });
        showToast('Incidente reportado exitosamente', 'success');
      }

      setShowCreateModal(false);
      loadIncidentes();
    } catch (err) {
      showToast('Error: ' + err.message, 'danger');
    }
  };

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'abierto': return 'danger';
      case 'en-progreso': return 'warning';
      case 'cerrado': return 'success';
      default: return 'secondary';
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const btnNavyStyle = { backgroundColor: '#03102f', borderColor: '#03102f', color: 'white' };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          GESTIÓN DE INCIDENTES
        </h1>
        <div className="d-flex gap-2">
          <button onClick={() => setShowFilterModal(true)} className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold" style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}>
            <FunnelFill size={18} /> Filtrar
          </button>
          {(isAdmin || isProfesor) && (
            <button onClick={handleOpenCreate} className="btn btn-outline-dark d-flex align-items-center gap-2 fw-bold" style={{ borderRadius: '50px', padding: '0.5rem 1.2rem', borderWidth: '2px' }}>
              <PlusCircleFill size={20} /> Reportar Incidente
            </button>
          )}
        </div>
      </div>
      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {/* Tabla */}
      {!loading && (
        <>
          <div className="table-responsive bg-white border rounded shadow-sm">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Curso</th>
                  <th>Tipo</th>
                  <th>Severidad</th>
                  <th>Estado</th>
                  <th>Última Actualización</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {incidentes.length > 0 ? (
                  incidentes.map(inc => (
                    <tr key={inc.id}>
                      <td>{inc.id}</td>
                      <td>ID: {inc.id_curso}</td>
                      <td>{inc.tipo}</td>
                      <td>{inc.severidad}</td>
                      <td><Badge bg={getStatusBadge(inc.estado)}>{inc.estado}</Badge></td>
                      <td>{inc.actualizado_en ? new Date(inc.actualizado_en).toLocaleDateString() : new Date(inc.fecha).toLocaleDateString()}</td>
                      <td className="text-center">
                        <Button size="sm" className="me-2" style={btnNavyStyle} onClick={() => handleOpenDetail(inc)} title="Ver Detalle">
                          <EyeFill />
                        </Button>
                        {(isAdmin || isProfesor) && (
                          <Button size="sm" style={btnNavyStyle} onClick={() => handleOpenEdit(inc)} title="Ver Historial / Agregar">
                            <ClockHistory />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" className="text-center p-4 text-muted">No hay incidentes.</td></tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="text-muted">Página {pagination.page} de {totalPages}</span>
            {/* Paginación simplificada para brevedad */}
          </div>
        </>
      )}

      {/* 1. Modal Filtros (Código igual) */}
      <Modal show={showFilterModal} onHide={() => setShowFilterModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Filtrar Incidentes</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            {/* ...Selectores de filtro... */}
            <FloatingLabel controlId="filterEstado" label="Estado" className="mb-3">
              <Form.Select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })}>
                <option value="">Todos</option>
                <option value="abierto">Abierto</option>
                <option value="cerrado">Cerrado</option>
              </Form.Select>
            </FloatingLabel>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => { loadIncidentes(); setShowFilterModal(false); }}>Aplicar</Button>
        </Modal.Footer>
      </Modal>

      {/* 2. MODAL GESTIÓN (Crear / Ver Historial / Agregar Suceso) */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered backdrop="static" size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fw-bold">
            {isEditing ? `Historial Incidente #${originalIncidentData?.id}` : 'Reportar Nuevo Incidente'}
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handlePreSubmit}>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>

            {/* --- SECCIÓN HISTORIAL (ACORDEÓN) --- */}
            {isEditing && originalIncidentData && (
              <div className="mb-4">
                <h5 className="mb-3 text-muted"><ClockHistory className="me-2" />Línea de Tiempo</h5>
                <Accordion defaultActiveKey={['0']} alwaysOpen>

                  {/* Reporte Original (Siempre al final o principio según gusto, aquí lo ponemos primero) */}
                  <Accordion.Item eventKey="0">
                    <Accordion.Header>
                      <strong>Reporte Original - {new Date(originalIncidentData.fecha).toLocaleString()}</strong>
                      <Badge bg="secondary" className="ms-2">Inicio</Badge>
                    </Accordion.Header>
                    <Accordion.Body className="bg-light">
                      <Row className="small mb-2 text-muted">
                        <Col><strong>Tipo:</strong> {originalIncidentData.tipo}</Col>
                        <Col><strong>Lugar:</strong> {originalIncidentData.lugar}</Col>
                      </Row>
                      <div className="p-2 bg-white border rounded">
                        {originalIncidentData.descripcion}
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>

                  {/* Historial de Actualizaciones (Si existen) */}
                  {originalIncidentData.historial && originalIncidentData.historial.map((suceso, idx) => (
                    <Accordion.Item eventKey={String(idx + 1)} key={idx}>
                      <Accordion.Header>
                        <strong>Actualización - {new Date(suceso.fecha).toLocaleString()}</strong>
                        <Badge bg={getStatusBadge(suceso.estado)} className="ms-2">{suceso.estado}</Badge>
                      </Accordion.Header>
                      <Accordion.Body className="bg-light">
                        <p className="small text-muted mb-1">Reportado por: {suceso.reportado_por || 'Desconocido'}</p>
                        <div className="p-2 bg-white border rounded">
                          {suceso.descripcion}
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            )}

            {/* --- BOTÓN PARA MOSTRAR FORMULARIO (Solo en modo edición) --- */}
            {isEditing && !showNewEventForm && (
              <div className="text-center py-3 border-top">
                <p className="text-muted">¿Deseas agregar una nueva actualización a este caso?</p>
                <Button variant="primary" onClick={() => setShowNewEventForm(true)}>
                  <JournalPlus className="me-2" /> Agregar Nuevo Suceso
                </Button>
              </div>
            )}

            {/* --- FORMULARIO (Visible si es Nuevo o si se activó "Agregar Suceso") --- */}
            {(showNewEventForm || !isEditing) && (
              <div className={`mt-3 ${isEditing ? 'border-top pt-3 animate-fade-in' : ''}`}>
                {isEditing && <h5 className="text-primary mb-3">Nuevo Suceso / Actualización</h5>}

                <Row className="g-3">
                  {/* Curso solo editable al crear de cero */}
                  <Col md={6}>
                    <FloatingLabel controlId="idCurso" label="Curso">
                      <Form.Select name="idCurso" value={formData.idCurso} onChange={handleFormChange} disabled={isEditing} required>
                        <option value="">Selecciona...</option>
                        {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </Form.Select>
                    </FloatingLabel>
                  </Col>

                  <Col md={6}>
                    <FloatingLabel controlId="estado" label="Estado Actual">
                      <Form.Select name="estado" value={formData.estado} onChange={handleFormChange} required>
                        <option value="abierto">Abierto</option>
                        <option value="en-progreso">En Progreso</option>
                        <option value="cerrado">Cerrado</option>
                      </Form.Select>
                    </FloatingLabel>
                  </Col>

                  <Col md={6}>
                    <FloatingLabel controlId="tipo" label="Tipo">
                      <Form.Select name="tipo" value={formData.tipo} onChange={handleFormChange}>
                        <option value="académico">Académico</option>
                        <option value="conductual">Conductual</option>
                        <option value="infraestructura">Infraestructura</option>
                      </Form.Select>
                    </FloatingLabel>
                  </Col>

                  <Col md={6}>
                    {/* Fecha del nuevo suceso */}
                    <div className="form-floating h-100">
                      <DatePicker
                        selected={formData.fechaHora}
                        onChange={(date) => setFormData({ ...formData, fechaHora: date })}
                        showTimeSelect
                        dateFormat="dd/MM/yyyy HH:mm"
                        className="form-control pt-3"
                      />
                      <label style={{ opacity: 0.65, transform: 'scale(0.85) translateY(-0.5rem) translateX(0.15rem)', position: 'absolute', top: 0 }}>Fecha Suceso</label>
                    </div>
                  </Col>

                  <Col xs={12}>
                    <FloatingLabel controlId="descripcion" label={isEditing ? "Detalle de la actualización" : "Descripción del incidente"}>
                      <Form.Control as="textarea" name="descripcion" value={formData.descripcion} onChange={handleFormChange} style={{ height: '100px' }} required />
                    </FloatingLabel>
                  </Col>

                  {/* Alumnos solo editable al crear de cero (para simplificar historial) */}
                  {!isEditing && (
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="text-muted small">Alumnos involucrados</Form.Label>
                        <Form.Select name="alumnos" multiple value={formData.alumnos} onChange={handleFormChange} style={{ minHeight: '80px' }}>
                          {alumnosDisponibles.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  )}
                </Row>
              </div>
            )}

          </Modal.Body>

          {/* Footer solo si hay formulario activo */}
          {(showNewEventForm || !isEditing) && (
            <Modal.Footer>
              <Button variant="outline-danger" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button variant="success" type="submit">{isEditing ? 'Guardar Actualización' : 'Registrar Incidente'}</Button>
            </Modal.Footer>
          )}
        </Form>
      </Modal>

      {/* 3. Confirmación */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold">Confirmar</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="fs-5">¿Confirmas guardar {isEditing ? 'este nuevo suceso' : 'este incidente'}?</p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirmSubmit}>Sí, Guardar</Button>
        </Modal.Footer>
      </Modal>

      {/* 4. Detalle (Solo lectura con nombres) */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>Detalle Completo</Modal.Title></Modal.Header>
        <Modal.Body>
          {/* Reutilizamos lógica del historial aquí si quisiéramos, pero por ahora muestra el estado actual */}
          {selectedIncident && (
            <div className="p-2">
              <h5 className="text-primary mb-3">Estado Actual</h5>
              <p><strong>Descripción actual:</strong> {selectedIncident.descripcion}</p>
              <hr />
              <h6>Alumnos:</h6>
              {loadingDetalles ? <Spinner size="sm" /> : (
                <ul>{detallesAlumnos.map(a => <li key={a.id}>{a.nombre} - {a.rut}</li>)}</ul>
              )}
              {/* Aquí también podríamos pintar el historial si queremos ver todo en detalle */}
            </div>
          )}
        </Modal.Body>
      </Modal>

      <ToastContainer position="bottom-end" className="p-3">
        <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={4000} autohide bg={toastConfig.variant}>
          <Toast.Body className="text-white">{toastConfig.message}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}