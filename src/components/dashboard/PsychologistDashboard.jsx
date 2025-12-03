import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';

// Imports de librerías
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Componentes
import PsychologistAvailabilityGrid from '../citas/PsychologistAvailabilityGrid';
import { Modal, Button, Card, Badge, Spinner, Form } from 'react-bootstrap';
import { 
    CalendarEvent, Clock, Person, TextLeft, GeoAltFill, 
    CheckCircleFill, CalendarRange, FileText, ArrowLeft 
} from 'react-bootstrap-icons';

const locales = { 'es': es };
const localizer = dateFnsLocalizer({
    format, parse, startOfWeek, getDay, locales,
});

const messages = {
    allDay: 'Todo el día', previous: 'Anterior', next: 'Siguiente', today: 'Hoy',
    month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha',
    time: 'Hora', event: 'Cita', noEventsInRange: 'No hay citas en este rango.',
};

export default function PsychologistDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [eventos, setEventos] = useState([]);

    // Estados
    const [showModal, setShowModal] = useState(false);
    const [selectedCita, setSelectedCita] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [newDate, setNewDate] = useState(new Date());
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [newSelectedSlot, setNewSelectedSlot] = useState(null);

    useEffect(() => { loadAgenda(); }, []);

    useEffect(() => {
        if (isRescheduling && selectedCita) loadDisponibilidad();
    }, [newDate, isRescheduling]);

    const loadAgenda = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/api/citas');
            // Convertimos las fechas de string a objetos Date para el calendario
            const citasFormateadas = data.map(cita => ({
                ...cita,
                title: `${cita.pacienteNombre || 'Alumno'}`,
                start: new Date(cita.start),
                end: new Date(cita.end),
                resource: cita
            }));
            setEventos(citasFormateadas);
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const loadDisponibilidad = () => {
        setLoadingSlots(true);
        setSlots([]);
        setNewSelectedSlot(null);
        
        // --- CORRECCIÓN CLAVE: Usar format de date-fns para asegurar la fecha local ---
        const fechaStr = format(newDate, 'yyyy-MM-dd'); 
        
        apiFetch(`/api/psicologos/${user.id}/disponibilidad?fecha=${fechaStr}`)
            .then(data => setSlots(data))
            .catch(err => console.error(err))
            .finally(() => setLoadingSlots(false));
    };

    const eventStyleGetter = (event) => {
        const estado = event.resource.estado;
        let backgroundColor = '#6c757d';
        if (estado === 'confirmada' || estado === 'aceptado') backgroundColor = '#198754';
        return { style: { backgroundColor, borderRadius: '6px', opacity: 0.9, color: 'white', border: 'none', display: 'block' } };
    };

    const handleSelectEvent = (event) => {
        setSelectedCita(event);
        setIsRescheduling(false);
        setNewSelectedSlot(null);
        setShowModal(true);
    };

    const handleConfirmarCita = async () => {
        if (!selectedCita) return;
        try {
            await apiFetch(`/api/citas/${selectedCita.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: 'confirmada' })
            });
            // Actualizar visualmente
            setEventos(prev => prev.map(ev => ev.id === selectedCita.id ? { ...ev, resource: { ...ev.resource, estado: 'confirmada' } } : ev));
            setShowModal(false);
            alert("¡Cita confirmada!");
        } catch (err) { alert(err.message); }
    };

    const handleSaveReschedule = async () => {
        if (!newSelectedSlot) return;
        try {
            // newSelectedSlot.start viene sin 'Z' (ej: "2023-10-25T15:00:00").
            // Al hacer new Date(string), el navegador asume Hora Local.
            // Al hacer JSON.stringify, se convierte a UTC correcto para la BD.
            const startObj = new Date(newSelectedSlot.start);
            const endObj = new Date(newSelectedSlot.end);

            await apiFetch(`/api/citas/${selectedCita.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    start: startObj, 
                    end: endObj,
                    estado: 'confirmada'
                })
            });

            alert("Cita reagendada exitosamente.");
            setShowModal(false);
            loadAgenda(); // Recargar para ver cambios
        } catch (err) {
            alert("Error al reagendar: " + err.message);
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

    return (
        <div className="fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif' }}>AGENDA SEMANAL</h1>
                    <p className="text-muted m-0">Hola {user?.nombre}, gestiona tus solicitudes.</p>
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

            <Modal show={showModal} onHide={() => setShowModal(false)} centered size={isRescheduling ? 'lg' : 'md'}>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="fw-bold text-primary d-flex align-items-center">
                        {isRescheduling ? 'Reagendar Cita' : 'Detalle de Cita'}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-4">
                    {!isRescheduling && selectedCita && (
                        <div className="d-flex flex-column gap-3">
                            <div className="border-bottom pb-3 mb-2">
                                <h4 className="fw-bold mb-1 text-dark">{selectedCita.titulo}</h4>
                                <Badge bg={selectedCita.resource.estado === 'confirmada' ? 'success' : 'secondary'}>
                                    {selectedCita.resource.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                                </Badge>
                            </div>
                            <div>
                                <strong>Alumno:</strong> {selectedCita.pacienteNombre}<br/>
                                <strong>Fecha:</strong> {format(selectedCita.start, 'EEEE d MMMM yyyy', { locale: es })}<br/>
                                <strong>Hora:</strong> {format(selectedCita.start, 'HH:mm')} - {format(selectedCita.end, 'HH:mm')}
                            </div>
                            {selectedCita.notas && (
                                <div className="bg-light p-2 rounded mt-2 fst-italic">"{selectedCita.notas}"</div>
                            )}
                        </div>
                    )}

                    {isRescheduling && (
                        <div className="row g-3">
                            <div className="col-md-5">
                                <Form.Label className="fw-bold">Nueva Fecha</Form.Label>
                                <DatePicker
                                    selected={newDate}
                                    onChange={setNewDate}
                                    className="form-control"
                                    dateFormat="dd/MM/yyyy"
                                    minDate={new Date()}
                                    inline
                                />
                            </div>
                            <div className="col-md-7">
                                <PsychologistAvailabilityGrid 
                                    slots={slots}
                                    loading={loadingSlots}
                                    selectedSlot={newSelectedSlot}
                                    onSelectSlot={setNewSelectedSlot}
                                    selectedDate={newDate}
                                />
                                {slots.length > 0 && (
                                    <small className="text-muted mt-2 d-block">
                                        * El horario de almuerzo (12:40 - 14:00) está bloqueado.
                                    </small>
                                )}
                            </div>
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer className="justify-content-between">
                    {!isRescheduling ? (
                        <div className="d-flex gap-2 w-100">
                            <Button variant="warning" onClick={() => setIsRescheduling(true)} className="flex-fill text-white fw-bold">
                                <CalendarRange className="me-2"/> Reagendar
                            </Button>
                            {selectedCita?.resource.estado !== 'confirmada' && (
                                <Button variant="success" onClick={handleConfirmarCita} className="flex-fill fw-bold">
                                    <CheckCircleFill className="me-2"/> Confirmar
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="d-flex gap-2 w-100 justify-content-end">
                            <Button variant="secondary" onClick={() => setIsRescheduling(false)}>Volver</Button>
                            <Button variant="primary" onClick={handleSaveReschedule} disabled={!newSelectedSlot}>
                                Confirmar Cambio
                            </Button>
                        </div>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
}