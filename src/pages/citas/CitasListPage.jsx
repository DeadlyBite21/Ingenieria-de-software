import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

import { Button, Card, Table, Badge, Spinner, Toast, ToastContainer, Modal, Form, Row, Col } from 'react-bootstrap';
import { EyeFill, CheckCircleFill, XCircleFill, CalendarEvent, ClockFill, SendFill } from 'react-bootstrap-icons';

// Componente interno para la grilla de horarios
function PsychologistAvailabilityGrid({ slots, loading, selectedSlot, onSelectSlot }) {
  if (loading) return <div className="text-center py-3"><Spinner animation="border" size="sm" /> Buscando horas...</div>;

  if (slots.length === 0) return <div className="alert alert-warning mt-3">No hay horas disponibles para esta fecha.</div>;

  return (
    <div className="mt-4">
      <h5 className="fw-bold mb-3">3. Horarios Disponibles (40 min)</h5>
      <div className="d-flex flex-wrap gap-2">
        {slots.map((slot, idx) => {
          const horaInicio = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const horaFin = new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <Button
              key={idx}
              variant={selectedSlot === slot ? "primary" : "outline-primary"}
              onClick={() => onSelectSlot(slot)}
              className="d-flex align-items-center gap-2 px-3 py-2"
            >
              <ClockFill /> {horaInicio} - {horaFin}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Estados para Agendamiento ---
  const [psicologos, setPsicologos] = useState([]);
  const [selectedPsicologo, setSelectedPsicologo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Modal y Datos del Formulario
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Estado para Notificaciones (Toasts)
  const [toastConfig, setToastConfig] = useState({
    show: false,
    message: '',
    variant: 'success'
  });

  const showToast = (message, variant = 'success') => {
    setToastConfig({ show: true, message, variant });
  };

  useEffect(() => {
    loadCitas();
    if (user.rol === 2) {
      loadPsicologos();
    }
  }, [user.rol]);

  useEffect(() => {
    if (user.rol === 2 && selectedPsicologo && selectedDate) {
      loadDisponibilidad();
    }
  }, [selectedPsicologo, selectedDate, user.rol]);

  const loadCitas = () => {
    setLoading(true);
    apiFetch('/api/citas')
      .then(data => setCitas(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const loadPsicologos = () => {
    apiFetch('/api/psicologos').then(setPsicologos).catch(console.error);
  };

  const loadDisponibilidad = () => {
    setLoadingSlots(true);
    setSlots([]); // Limpiar anteriores
    const fechaStr = selectedDate.toISOString().split('T')[0];

    apiFetch(`/api/psicologos/${selectedPsicologo}/disponibilidad?fecha=${fechaStr}`)
      .then(data => setSlots(data))
      .catch(err => showToast('Error al cargar disponibilidad', 'danger'))
      .finally(() => setLoadingSlots(false));
  };

  // Al hacer clic en un bloque de hora
  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setMotivo(''); // Limpiar motivo anterior
    setShowModal(true); // Abrir modal
  };

  // Enviar Cita
  const handleBooking = async () => {
    if (!motivo.trim()) {
      showToast('Por favor, escribe una descripción de lo que sucede.', 'warning');
      return;
    }

    setBookingLoading(true);
    try {
      await apiFetch('/api/citas/crear', {
        method: 'POST',
        body: JSON.stringify({
          psicologo_id: selectedPsicologo,
          titulo: 'Solicitud Alumno',
          start: selectedSlot.start,
          end: selectedSlot.end,
          notas: motivo
        })
      });

      showToast('¡Cita enviada con éxito! Espera la confirmación.', 'success');
      setShowModal(false);
      setSelectedSlot(null);
      setMotivo('');
      loadCitas();
      loadDisponibilidad();
    } catch (err) {
      showToast(err.message || 'Error al agendar cita', 'danger');
    } finally {
      setBookingLoading(false);
    }
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'confirmada': return 'success';
      case 'realizada': return 'success';
      case 'cancelada': return 'danger';
      default: return 'warning';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          GESTIÓN DE CITAS
        </h1>
      </div>
      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {/* --- VISTA DE ALUMNO: AGENDAMIENTO --- */}
      {user.rol === 2 && (
        <Card className="mb-5 shadow-sm border-0" style={{ backgroundColor: '#f8f9fa' }}>
          <Card.Body className="p-4">
            <h4 className="mb-4 fw-bold text-primary"><CalendarEvent className="me-2" />Agendar Nueva Hora</h4>

            <Row className="g-3">
              <Col md={4}>
                <Form.Label className="fw-bold">1. Elige un Psicólogo</Form.Label>
                <Form.Select
                  value={selectedPsicologo}
                  onChange={(e) => setSelectedPsicologo(e.target.value)}
                  className="shadow-sm"
                >
                  <option value="">Seleccionar...</option>
                  {psicologos.map(psi => (
                    <option key={psi.id} value={psi.id}>{psi.nombre}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={4}>
                <Form.Label className="fw-bold">2. Elige una Fecha</Form.Label>
                <div className="d-block">
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    className="form-control shadow-sm w-100"
                    dateFormat="dd/MM/yyyy"
                    minDate={new Date()}
                    placeholderText="Selecciona fecha"
                  />
                </div>
              </Col>
            </Row>

            {/* Grilla de Disponibilidad */}
            {selectedPsicologo && (
              <PsychologistAvailabilityGrid
                slots={slots}
                loading={loadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSlotClick}
              />
            )}
          </Card.Body>
        </Card>
      )}

      {/* --- LISTA DE CITAS EXISTENTES --- */}
      <h4 className="mb-3 fw-bold">Mis Citas Agendadas</h4>
      <Card className="border rounded shadow-sm">
        <Table hover responsive className="m-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Fecha / Hora</th>
              <th>{user.rol === 2 ? 'Psicólogo' : 'Alumno'}</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {citas.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-4 text-muted">No tienes citas programadas.</td></tr>
            ) : (
              citas.map(cita => (
                <tr key={cita.id}>
                  <td>
                    {new Date(cita.start || cita.fecha_hora).toLocaleDateString()}<br />
                    <small className="text-muted">{new Date(cita.start || cita.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </td>
                  <td>
                    {user.rol === 2 ? (cita.psicologoNombre || 'Psicólogo') : (cita.pacienteNombre || 'Alumno')}
                  </td>
                  <td>{cita.notas || cita.titulo}</td>
                  <td><Badge bg={getEstadoBadge(cita.estado)}>{cita.estado || 'Pendiente'}</Badge></td>
                  <td>
                    <Button as={Link} to={`/dashboard/citas/${cita.id}`} size="sm" variant="outline-info" title="Ver detalle">
                      <EyeFill />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* --- MODAL ESPECÍFICO SOLICITADO --- */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>Solicitar Cita</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            Has seleccionado el horario: <strong>{selectedSlot && new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
          </p>
          <Form.Group>
            <Form.Label className="fw-bold">Cuéntanos brevemente qué te sucede:</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Describe aquí el motivo de tu consulta..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          {/* BOTÓN ROJO: CANCELAR */}
          <Button variant="danger" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>

          {/* BOTÓN VERDE: ENVIAR */}
          <Button variant="success" onClick={handleBooking} disabled={bookingLoading}>
            {bookingLoading ? <Spinner size="sm" animation="border" /> : <><SendFill className="me-2" />Enviar Solicitud</>}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast de Notificaciones */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={4000} autohide bg={toastConfig.variant}>
          <Toast.Header>
            {toastConfig.variant === 'success' ? <CheckCircleFill className="text-success me-2" /> : <XCircleFill className="text-danger me-2" />}
            <strong className="me-auto">Sistema</strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            {toastConfig.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}