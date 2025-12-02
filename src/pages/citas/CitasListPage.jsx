import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

import {
  Button, Card, Table, Badge, Spinner,
  Toast, ToastContainer, Form
} from 'react-bootstrap';
import {
  EyeFill, CalendarEvent
} from 'react-bootstrap-icons';

import PsychologistAvailabilityGrid from '../../components/citas/PsychologistAvailabilityGrid';
import ConfirmPasswordModal from '../../components/citas/ConfirmPasswordModal';

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Estados para Agendar ---
  const [psicologos, setPsicologos] = useState([]);
  const [selectedPsicologo, setSelectedPsicologo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [motivo, setMotivo] = useState(''); // Esto es la "Descripción"
  const [password, setPassword] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Toast
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    loadCitas();
    if (user.rol === 2) loadPsicologos();
  }, [user.rol]);

  useEffect(() => {
    if (user.rol === 2 && selectedPsicologo && selectedDate) {
      loadDisponibilidad();
    } else {
      setSlots([]);
    }
  }, [selectedPsicologo, selectedDate, user.rol]);

  const loadCitas = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/citas');
      setCitas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPsicologos = () => {
    apiFetch('/api/psicologos').then(setPsicologos).catch(console.error);
  };

  const loadDisponibilidad = () => {
    setLoadingSlots(true);
    const fechaStr = selectedDate.toISOString().split('T')[0];
    apiFetch(`/api/psicologos/${selectedPsicologo}/disponibilidad?fecha=${fechaStr}`)
      .then(setSlots)
      .catch(() => showToast('Error al cargar horarios', 'danger'))
      .finally(() => setLoadingSlots(false));
  };

  // --- ENVIAR CITA ---
  const handleBooking = async () => {
    // Si quieres quitar el requisito de password, elimina "!password" de aquí
    if (!selectedSlot || !selectedPsicologo) return;

    if (motivo.trim().length < 5) {
      showToast('Por favor escribe una descripción detallada.', 'warning');
      return;
    }

    setBookingLoading(true);
    try {
      await apiFetch('/api/citas/crear', {
        method: 'POST',
        body: JSON.stringify({
          psicologo_id: selectedPsicologo,
          titulo: 'Solicitud de Cita',
          start: selectedSlot.start,
          end: selectedSlot.end,
          notas: motivo, // Descripción
          password: password
        })
      });

      // ALERTA CONFIRMADA
      alert('¡Cita confirmada y enviada al psicólogo!');

      setShowConfirmModal(false);
      setPassword('');
      setMotivo('');
      setSelectedSlot(null);

      // ACTUALIZAR TABLA ABAJO
      loadCitas();
      loadDisponibilidad(); // Refrescar slots para que desaparezca el tomado

    } catch (err) {
      showToast(err.message || 'No se pudo agendar', 'danger');
    } finally {
      setBookingLoading(false);
    }
  };

  const showToast = (message, variant) => setToastConfig({ show: true, message, variant });

  const getEstadoBadge = (estado) => {
    if (estado === 'confirmada') return 'success';
    if (estado === 'cancelada') return 'danger';
    return 'warning';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontSize: '2.5rem' }}>GESTIÓN DE CITAS</h1>
      </div>
      <hr style={{ borderTop: '4px solid black', marginBottom: '2rem' }} />

      {/* --- AGENDAR --- */}
      {user.rol === 2 && (
        <Card className="mb-5 shadow-sm border-0 bg-light">
          <Card.Body className="p-4">
            <h4 className="mb-4 fw-bold text-primary"><CalendarEvent className="me-2" /> Agendar Nueva Hora</h4>

            <div className="row g-4">
              <div className="col-md-4">
                <Form.Label className="fw-bold text-muted small">1. ELIGE UN PSICÓLOGO</Form.Label>
                <Form.Select
                  value={selectedPsicologo}
                  onChange={(e) => setSelectedPsicologo(e.target.value)}
                  className="shadow-sm border-0 py-2"
                >
                  <option value="">Seleccionar...</option>
                  {psicologos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Form.Select>
              </div>

              <div className="col-md-4">
                <Form.Label className="fw-bold text-muted small">2. ELIGE UNA FECHA</Form.Label>
                <div>
                  <DatePicker
                    selected={selectedDate}
                    onChange={setSelectedDate}
                    className="form-control shadow-sm border-0 py-2 w-100"
                    dateFormat="dd/MM/yyyy"
                    minDate={new Date()}
                  />
                </div>
              </div>
            </div>

            {/* --- BLOQUES DE HORA (Ahora de 40 mins gracias al backend) --- */}
            {selectedPsicologo && (
              <div className="mt-4">
                <PsychologistAvailabilityGrid
                  slots={slots}
                  loading={loadingSlots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={(slot) => {
                    setSelectedSlot(slot);
                    setShowConfirmModal(true); // Abre el modal con descripción
                  }}
                  selectedDate={selectedDate}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* --- TABLA DE HORAS RESERVADAS --- */}
      <h4 className="fw-bold mb-3">Mis Citas Agendadas</h4>
      <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
        <Table hover responsive className="m-0 align-middle">
          <thead className="bg-light text-secondary small">
            <tr>
              <th className="py-3 ps-4">FECHA / HORA</th>
              <th>{user.rol === 2 ? 'PSICÓLOGO' : 'ALUMNO'}</th>
              <th>DESCRIPCIÓN</th>
              <th>ESTADO</th>
              <th>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center py-5"><Spinner animation="border" variant="primary" /></td></tr>
            ) : citas.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-5 text-muted">No tienes citas programadas.</td></tr>
            ) : (
              citas.map(cita => (
                <tr key={cita.id}>
                  <td className="ps-4 fw-bold">
                    {new Date(cita.start || cita.fecha_hora).toLocaleDateString()} <br />
                    <span className="fw-normal text-muted small">
                      {new Date(cita.start || cita.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td>{user.rol === 2 ? cita.psicologoNombre : cita.pacienteNombre}</td>
                  <td>{cita.notas || 'Sin descripción'}</td>
                  <td><Badge bg={getEstadoBadge(cita.estado)}>{cita.estado}</Badge></td>
                  <td>
                    <Button as={Link} to={`/dashboard/citas/${cita.id}`} variant="outline-primary" size="sm">
                      <EyeFill />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Modal Reutilizado (Asegúrate de que tenga campo 'motivo' y botones 'Confirmar/Cancelar') */}
      <ConfirmPasswordModal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        onConfirm={handleBooking}
        loading={bookingLoading}
        psicologoName={psicologos.find(p => p.id == selectedPsicologo)?.nombre}
        date={selectedDate}
        time={selectedSlot && new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        motivo={motivo}
        setMotivo={setMotivo}
        password={password}
        setPassword={setPassword}
      />

      <ToastContainer position="bottom-end" className="p-3">
        <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={3000} autohide bg={toastConfig.variant}>
          <Toast.Body className="text-white fw-bold">{toastConfig.message}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}