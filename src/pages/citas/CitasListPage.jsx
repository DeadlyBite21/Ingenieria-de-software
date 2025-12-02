import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import { PlusCircleFill, EyeFill, CheckCircleFill, XCircleFill, PersonFill, CalendarEvent, ClockFill } from 'react-bootstrap-icons';
import PsychologistAvailabilityGrid from '../../components/citas/PsychologistAvailabilityGrid';
import ConfirmPasswordModal from '../../components/citas/ConfirmPasswordModal';

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Estados para Agendamiento (Solo Alumnos) ---
  const [psicologos, setPsicologos] = useState([]);
  const [selectedPsicologo, setSelectedPsicologo] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [password, setPassword] = useState('');
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
      .catch(err => {
        console.error(err);
        showToast('Error al cargar citas: ' + err.message, 'danger');
      })
      .finally(() => setLoading(false));
  };

  const loadPsicologos = () => {
    apiFetch('/api/psicologos')
      .then(data => setPsicologos(data))
      .catch(console.error);
  };

  const loadDisponibilidad = () => {
    setLoadingSlots(true);
    // Formato YYYY-MM-DD
    const fechaStr = selectedDate.toISOString().split('T')[0];
    apiFetch(`/api/psicologos/${selectedPsicologo}/disponibilidad?fecha=${fechaStr}`)
      .then(data => setSlots(data))
      .catch(err => {
        console.error(err);
        showToast('Error al cargar disponibilidad', 'danger');
      })
      .finally(() => setLoadingSlots(false));
  };

  const handleBooking = async () => {
    if (!selectedSlot || !selectedPsicologo || !password) return;

    setBookingLoading(true);
    try {
      await apiFetch('/api/citas/crear', {
        method: 'POST',
        body: JSON.stringify({
          psicologo_id: selectedPsicologo,
          titulo: 'Cita Reservada', // Título genérico o basado en motivo
          start: selectedSlot.start,
          end: selectedSlot.end,
          notas: motivo,
          password: password
        })
      });

      showToast('Cita agendada exitosamente 🚀', 'success');
      setShowConfirmModal(false);
      setPassword('');
      setMotivo('');
      setSelectedSlot(null);
      loadCitas(); // Recargar lista de citas
      loadDisponibilidad(); // Actualizar slots disponibles
    } catch (err) {
      showToast(err.message || 'Error al agendar cita', 'danger');
    } finally {
      setBookingLoading(false);
    }
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'realizada': return 'success';
      case 'cancelada': return 'danger';
      default: return 'warning';
    }
  };

  if (loading && citas.length === 0) return <div className="text-center p-5"><Spinner animation="border" /></div>;

  return (
    <div>
      {/* --- Header Estilizado --- */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          GESTIÓN DE CITAS
        </h1>
      </div>

      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {/* --- VISTA DE ALUMNO: AGENDAMIENTO --- */}
      {user.rol === 2 && (
        <Card className="mb-4 shadow-sm border-0" style={{ backgroundColor: '#f8f9fa' }}>
          <Card.Body>
            <h4 className="mb-4 fw-bold text-primary"><CalendarEvent className="me-2" />Agendar Nueva Hora</h4>

            <div className="row g-3">
              {/* 1. Elegir Psicólogo */}
              <div className="col-md-4">
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
              </div>

              {/* 2. Elegir Fecha */}
              <div className="col-md-4">
                <Form.Label className="fw-bold">2. Elige una Fecha</Form.Label>
                <div className="d-block">
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    className="form-control shadow-sm"
                    dateFormat="dd/MM/yyyy"
                    minDate={new Date()}
                    placeholderText="Selecciona fecha"
                  />
                </div>
              </div>
            </div>

            {/* 3. Disponibilidad (Slots) */}
            {selectedPsicologo && (
              <PsychologistAvailabilityGrid
                slots={slots}
                loading={loadingSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={(slot) => {
                  setSelectedSlot(slot);
                  setShowConfirmModal(true);
                }}
                selectedDate={selectedDate}
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

      {/* --- MODAL DE CONFIRMACIÓN --- */}
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

      {/* Toast de Notificaciones */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast onClose={() => setToastConfig({ ...toastConfig, show: false })} show={toastConfig.show} delay={3000} autohide bg={toastConfig.variant}>
          <Toast.Header>
            {toastConfig.variant === 'success' ? <CheckCircleFill className="text-success me-2" /> : <XCircleFill className="text-danger me-2" />}
            <strong className="me-auto">Sistema</strong>
            <small>Ahora</small>
          </Toast.Header>
          <Toast.Body className="text-white">
            {toastConfig.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}