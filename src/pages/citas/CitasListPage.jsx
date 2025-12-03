import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// --- Imports de Fecha ---
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns'; // Importante para formatear sin cambiar zona horaria

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
          // Mostramos la hora tal cual viene del backend (Wall Time)
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
      <div className="text-muted small mt-2">
         * Horario de almuerzo (12:40 - 14:00) bloqueado.
      </div>
    </div>
  );
}

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [alumnos, setAlumnos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const puedeCrear = user && (user.rol === 0 || user.rol === 2 || user.rol === 3);

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
    async function load() {
      try {
        const [citasData, psicologosData] = await Promise.all([
          apiFetch('/api/citas'),
          apiFetch('/api/psicologos'),
        ]);

        setCitas(citasData);
        setPsicologos(
          psicologosData.reduce((acc, p) => {
            acc[p.id] = p.nombre;
            return acc;
          }, {})
        );

        // Solo admin tiene acceso a /api/usuarios
        if (user?.rol === 0) {
          const usuarios = await apiFetch('/api/usuarios');
          const alumnosMap = {};
          usuarios
            .filter(u => u.rol === 2)
            .forEach(a => {
              alumnosMap[a.id] = a.nombre;
            });
          setAlumnos(alumnosMap);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'confirmada': return 'info';
      case 'realizada': return 'success';
      case 'cancelada': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1><CalendarEvent className="me-2" />Citas psicológicas</h1>
        {puedeCrear && (
          <Button as={Link} to="/dashboard/citas/crear" variant="primary">
            <PlusCircleFill className="me-2" /> Nueva cita
          </Button>
        )}
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
              <th>Conclusión</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan="6">
                  <div className="text-danger">{error}</div>
                </td>
              </tr>
            ) : citas.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">
                  No hay citas registradas.
                </td>
              </tr>
            ) : (
              citas.map(cita => {
                const inicio = new Date(cita.fecha_hora_inicio);
                const fin = new Date(cita.fecha_hora_fin);

                const nombrePsicologo = psicologos[cita.psicologo_id] || `Psicólogo #${cita.psicologo_id}`;
                const nombreAlumno =
                  alumnos[cita.paciente_id] || `Alumno #${cita.paciente_id}`;

                return (
                  <tr key={cita.id}>
                    <td>
                      {inicio.toLocaleDateString()}<br />
                      <small className="text-muted">
                        {inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {fin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </td>
                    <td>{user.rol === 2 ? nombrePsicologo : nombreAlumno}</td>
                    <td>{cita.motivo}</td>
                    <td>{cita.conclusion || '-'}</td>
                    <td><Badge bg={getEstadoBadge(cita.estado)}>{cita.estado}</Badge></td>
                    <td>
                      <Button
                        as={Link}
                        to={`/dashboard/citas/${cita.id}`}
                        size="sm"
                        variant="outline-info"
                      >
                        <EyeFill />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* --- MODAL DE SOLICITUD --- */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>Solicitar Cita</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            Horario seleccionado: <strong>{selectedSlot && new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
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
          <Button variant="danger" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={handleBooking} disabled={bookingLoading}>
            {bookingLoading ? <Spinner size="sm" animation="border" /> : <><SendFill className="me-2" />Enviar Solicitud</>}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast */}
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
