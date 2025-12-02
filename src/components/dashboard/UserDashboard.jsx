// src/components/dashboard/UserDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Modal, Button, Card, Badge, Spinner, Alert } from 'react-bootstrap';
import { CalendarEvent, Clock, Person, TextLeft, GeoAltFill, CheckCircleFill, CalendarRange, FileText } from 'react-bootstrap-icons';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const messages = {
  allDay: 'Todo el día',
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Cita',
  noEventsInRange: 'No hay citas en este rango.',
};

export default function UserDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cursos, setCursos] = useState([]);
  const [eventos, setEventos] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);

  useEffect(() => {
    if (user?.rol === 3) {
      loadAgendaPsicologo();
    } else {
      loadCursos();
    }
  }, [user]);

  const loadAgendaPsicologo = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/citas');

      const citasFormateadas = data.map(cita => ({
        ...cita,
        title: `${cita.pacienteNombre}`,
        start: new Date(cita.start),
        end: new Date(cita.end),
        resource: cita
      }));

      setEventos(citasFormateadas);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCursos = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/cursos');
      setCursos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE COLORES ---
  const eventStyleGetter = (event) => {
    const estado = event.resource.estado;
    let backgroundColor = '#6c757d'; // GRIS por defecto (pendiente/solicitada)

    if (estado === 'confirmada') {
      backgroundColor = '#198754'; // VERDE (confirmada)
    }

    const style = {
      backgroundColor: backgroundColor,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: 'none',
      display: 'block',
      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      fontSize: '0.85rem',
      padding: '4px 8px'
    };
    return { style };
  };

  const handleSelectEvent = (event) => {
    setSelectedCita(event);
    setShowModal(true);
  };

  // --- ACCIÓN CONFIRMAR ---
  const handleConfirmarCita = async () => {
    if (!selectedCita) return;
    try {
      await apiFetch(`/api/citas/${selectedCita.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'confirmada' })
      });

      // Actualizar localmente para ver el cambio a verde
      setEventos(prev => prev.map(ev =>
        ev.id === selectedCita.id
          ? { ...ev, resource: { ...ev.resource, estado: 'confirmada' } }
          : ev
      ));

      setShowModal(false);
      alert("¡Cita confirmada exitosamente!");
    } catch (err) {
      alert("Error al confirmar: " + err.message);
    }
  };

  // --- ACCIÓN REAGENDAR (Placeholder) ---
  const handleReagendarCita = () => {
    // Aquí iría la lógica para abrir un datepicker o redirigir a editar
    alert("Para reagendar, por favor ve a la ficha completa y edita el horario.");
  };

  if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

  // ================= VISTA PSICÓLOGO (ROL 3) =================
  if (user?.rol === 3) {
    return (
      <div className="fade-in">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif' }}>AGENDA SEMANAL</h1>
            <p className="text-muted m-0">Visualiza las solicitudes de tus alumnos</p>
          </div>
          <Button variant="outline-primary" as={Link} to="/dashboard/citas/crear" className="fw-bold shadow-sm rounded-pill px-4">
            <CalendarEvent className="me-2" /> Agendar Cita
          </Button>
        </div>

        <Card className="shadow border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          <Card.Body className="p-4" style={{ height: '75vh', backgroundColor: '#ffffff' }}>
            <Calendar
              localizer={localizer}
              events={eventos}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', fontFamily: 'inherit', fontWeight: '500' }}
              messages={messages}
              culture='es'
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day', 'agenda']}
              defaultView='week'
              min={new Date(0, 0, 0, 8, 0, 0)}
              max={new Date(0, 0, 0, 20, 0, 0)}
            />
          </Card.Body>
        </Card>

        {/* --- MODAL DE DETALLE MEJORADO --- */}
        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton style={{ background: '#f8f9fa', borderBottom: 'none' }}>
            <Modal.Title className="fw-bold text-primary d-flex align-items-center">
              <div className="bg-primary bg-opacity-10 p-2 rounded-circle me-2">
                <CalendarEvent size={20} />
              </div>
              Detalle de Cita
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 pt-2">
            {selectedCita && (
              <div className="d-flex flex-column gap-3">
                <div className="border-bottom pb-3 mb-2">
                  <h4 className="fw-bold mb-1 text-dark">{selectedCita.titulo}</h4>
                  {selectedCita.resource.estado === 'confirmada'
                    ? <Badge bg="success" className="me-2 px-3 py-2 rounded-pill">Confirmada</Badge>
                    : <Badge bg="secondary" className="me-2 px-3 py-2 rounded-pill">Pendiente / Solicitud</Badge>
                  }
                </div>

                <div className="d-flex align-items-center p-3 bg-light rounded-3">
                  <Person size={24} className="text-primary me-3" />
                  <div>
                    <small className="text-uppercase fw-bold text-muted" style={{ fontSize: '0.65rem' }}>ALUMNO</small>
                    <div className="fs-5 fw-bold text-dark">{selectedCita.pacienteNombre}</div>
                  </div>
                </div>

                <div className="d-flex align-items-center px-3">
                  <Clock size={22} className="text-muted me-3" />
                  <div>
                    <div className="fs-6 text-dark fw-medium">
                      {format(selectedCita.start, 'EEEE d MMMM', { locale: es })}
                    </div>
                    <div className="text-muted small">
                      {format(selectedCita.start, 'HH:mm')} - {format(selectedCita.end, 'HH:mm')} hrs
                    </div>
                  </div>
                </div>

                {selectedCita.lugar && (
                  <div className="d-flex align-items-center px-3">
                    <GeoAltFill size={20} className="text-muted me-3" />
                    <span className="text-dark">{selectedCita.lugar}</span>
                  </div>
                )}

                {selectedCita.notas && (
                  <div className="mt-2">
                    <div className="d-flex align-items-center mb-1 text-secondary fw-bold small text-uppercase">
                      <TextLeft className="me-2" /> Notas
                    </div>
                    <p className="mb-0 text-dark bg-light p-2 rounded small" style={{ fontStyle: 'italic' }}>
                      "{selectedCita.notas}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </Modal.Body>

          {/* --- FOOTER CON LAS 3 OPCIONES --- */}
          <Modal.Footer className="justify-content-between">
            <div className="d-flex gap-2 w-100">
              {/* 1. REAGENDAR */}
              <Button variant="warning" onClick={handleReagendarCita} className="flex-fill text-white fw-bold">
                <CalendarRange className="me-2" /> Reagendar
              </Button>

              {/* 2. CONFIRMAR (Solo si no está confirmada) */}
              {selectedCita?.resource.estado !== 'confirmada' && (
                <Button variant="success" onClick={handleConfirmarCita} className="flex-fill fw-bold">
                  <CheckCircleFill className="me-2" /> Confirmar
                </Button>
              )}
            </div>

            {/* 3. VER FICHA */}
            {selectedCita && (
              <Button
                as={Link}
                to={`/dashboard/citas/${selectedCita.id}`}
                variant="outline-primary"
                className="w-100 mt-2 border-0"
              >
                <FileText className="me-2" /> Ver Ficha Completa
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      </div>
    );
  }

  // ================= VISTA PROFESOR / ALUMNO (Sin cambios) =================
  const getRolText = () => (user?.rol === 1 ? 'Profesor' : 'Alumno');
  const getRolColor = () => (user?.rol === 1 ? '#28a745' : '#007bff');

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Mi Dashboard</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
          backgroundColor: '#ffffff', borderRadius: '12px', borderLeft: `5px solid ${getRolColor()}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '50%',
            backgroundColor: getRolColor(), display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'white',
            fontWeight: 'bold', fontSize: '1.2rem'
          }}>
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>¡Hola, {user?.nombre}!</h2>
            <p style={{ margin: 0, color: '#666' }}>
              <strong style={{ color: getRolColor() }}>{getRolText()}</strong> • RUT: {user?.rut}
            </p>
          </div>
        </div>
      </div>

      {cursos.length === 0 ? (
        <Alert variant="light" className="text-center py-5">
          <h4>No tienes cursos asignados.</h4>
        </Alert>
      ) : (
        <div className="row g-3">
          {cursos.map((curso) => (
            <div key={curso.id} className="col-md-6 col-lg-4">
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body>
                  <h5 className="card-title fw-bold text-dark">{curso.nombre}</h5>
                  <Link to={`/dashboard/courses/${curso.id}`} className="btn btn-outline-primary w-100 mt-2">
                    Ver Curso
                  </Link>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}