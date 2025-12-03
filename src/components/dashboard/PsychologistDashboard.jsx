import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';

// --- Imports para Calendario ---
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// --- Bootstrap ---
import { Modal, Button, Card, Badge, Spinner } from 'react-bootstrap';
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

export default function PsychologistDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [eventos, setEventos] = useState([]);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [selectedCita, setSelectedCita] = useState(null);

    useEffect(() => {
        loadAgenda();
    }, []);

    const loadAgenda = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/api/citas');

            // Transformar datos para BigCalendar
            const citasFormateadas = data.map(cita => ({
                ...cita,
                title: `${cita.pacienteNombre || 'Alumno'}`,
                start: new Date(cita.start),
                end: new Date(cita.end),
                resource: cita // Guardamos toda la info original aquí (incluido el estado)
            }));

            setEventos(citasFormateadas);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DE COLORES ---
    // Verde si está confirmada, Gris si es solicitud/pendiente
    const eventStyleGetter = (event) => {
        const estado = event.resource.estado;
        let backgroundColor = '#6c757d'; // GRIS por defecto

        // Aceptamos 'confirmada' o 'aceptado' para ponerlo en verde
        if (estado === 'confirmada' || estado === 'aceptado') {
            backgroundColor = '#198754'; // VERDE
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
            // 1. Llamada a la API PATCH para guardar en base de datos
            await apiFetch(`/api/citas/${selectedCita.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: 'confirmada' })
            });

            // 2. Actualizar estado local para ver el cambio de color inmediatamente (Gris -> Verde)
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

    // --- ACCIÓN REAGENDAR ---
    const handleReagendarCita = () => {
        alert("Funcionalidad para reagendar (editar fecha/hora) en proceso.");
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
    if (error) return <div className="p-4 text-danger">Error: {error}</div>;

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif' }}>AGENDA SEMANAL</h1>
                    <p className="text-muted m-0">Hola {user?.nombre}, gestiona tus solicitudes.</p>
                </div>
                {/* Botón para crear cita manualmente si es necesario */}
                <Button variant="outline-primary" as={Link} to="/dashboard/citas/crear" className="fw-bold shadow-sm rounded-pill px-4">
                    <CalendarEvent className="me-2" /> Agendar Cita
                </Button>
            </div>

            {/* Calendario */}
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

            {/* Modal de Detalle / Confirmación */}
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

                            {/* Título y Estado */}
                            <div className="border-bottom pb-3 mb-2">
                                <h4 className="fw-bold mb-1 text-dark">{selectedCita.titulo}</h4>
                                {selectedCita.resource.estado === 'confirmada'
                                    ? <Badge bg="success" className="me-2 px-3 py-2 rounded-pill">Confirmada</Badge>
                                    : <Badge bg="secondary" className="me-2 px-3 py-2 rounded-pill">Solicitud Pendiente</Badge>
                                }
                                <span className="text-muted small ms-2">ID: {selectedCita.id}</span>
                            </div>

                            {/* Información del Alumno */}
                            <div className="d-flex align-items-center p-3 bg-light rounded-3">
                                <Person size={24} className="text-primary me-3" />
                                <div>
                                    <small className="text-uppercase fw-bold text-muted" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>ALUMNO</small>
                                    <div className="fs-5 fw-bold text-dark">{selectedCita.pacienteNombre}</div>
                                </div>
                            </div>

                            {/* Fecha y Hora */}
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
                                    <div className="d-flex align-items-center mb-2 text-secondary fw-bold small text-uppercase">
                                        <TextLeft className="me-2" /> Motivo / Notas
                                    </div>
                                    <p className="mb-0 text-dark bg-light p-3 rounded-3 border-start border-4 border-primary" style={{ fontStyle: 'italic' }}>
                                        "{selectedCita.notas}"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>

                {/* Footer con Botones */}
                <Modal.Footer className="justify-content-between">
                    <div className="d-flex gap-2 w-100">
                        {/* Botón Reagendar */}
                        <Button variant="warning" onClick={handleReagendarCita} className="flex-fill text-white fw-bold">
                            <CalendarRange className="me-2" /> Reagendar
                        </Button>

                        {/* Botón Confirmar (Solo visible si NO está confirmada) */}
                        {selectedCita?.resource.estado !== 'confirmada' && (
                            <Button variant="success" onClick={handleConfirmarCita} className="flex-fill fw-bold">
                                <CheckCircleFill className="me-2" /> Confirmar
                            </Button>
                        )}
                    </div>

                    {/* Botón Ver Ficha Completa */}
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