import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';

// Calendario y Fechas
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Componentes
import PsychologistAvailabilityGrid from '../citas/PsychologistAvailabilityGrid';
import { Modal, Button, Card, Badge, Spinner, Form, Row, Col } from 'react-bootstrap';
import { 
    CalendarEvent, Clock, Person, TextLeft, GeoAltFill, 
    CheckCircleFill, CalendarRange, FileText, ArrowLeft, PlusLg 
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
    const [students, setStudents] = useState([]); // Lista de alumnos para el select

    // --- ESTADOS MODALES ---
    const [showDetailModal, setShowDetailModal] = useState(false); // Ver/Reagendar
    const [showCreateModal, setShowCreateModal] = useState(false); // Crear Nueva

    // --- ESTADOS DETALLE / REAGENDAR ---
    const [selectedCita, setSelectedCita] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);
    
    // --- ESTADOS COMUNES (Selección de fecha/hora) ---
    const [targetDate, setTargetDate] = useState(new Date());
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);

    // --- ESTADOS SOLO PARA CREAR ---
    const [newCitaData, setNewCitaData] = useState({ studentId: '', notes: '' });


    useEffect(() => {
        loadAgenda();
        loadStudents();
    }, []);

    // Cargar disponibilidad cuando cambia la fecha (para ambos modales)
    useEffect(() => {
        if ((showCreateModal || isRescheduling) && targetDate) {
            loadDisponibilidad();
        }
    }, [targetDate, showCreateModal, isRescheduling]);

    const loadAgenda = async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/api/citas');
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

    const loadStudents = async () => {
        try {
            const data = await apiFetch('/api/psicologos/mis-alumnos');
            setStudents(data);
        } catch (e) { console.error("Error cargando alumnos", e); }
    };

    const loadDisponibilidad = () => {
        setLoadingSlots(true);
        setSlots([]);
        setSelectedSlot(null);
        
        const fechaStr = format(targetDate, 'yyyy-MM-dd'); 
        
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

    // --- HANDLERS DETALLE / REAGENDAR ---
    const handleSelectEvent = (event) => {
        setSelectedCita(event);
        setIsRescheduling(false);
        setTargetDate(new Date()); // Reset fecha
        setSelectedSlot(null);
        setShowDetailModal(true);
    };

    const handleConfirmarCita = async () => {
        if (!selectedCita) return;
        try {
            await apiFetch(`/api/citas/${selectedCita.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: 'confirmada' })
            });
            setEventos(prev => prev.map(ev => ev.id === selectedCita.id ? { ...ev, resource: { ...ev.resource, estado: 'confirmada' } } : ev));
            setShowDetailModal(false);
            alert("¡Cita confirmada!");
        } catch (err) { alert(err.message); }
    };

    const handleSaveReschedule = async () => {
        if (!selectedSlot) return;
        try {
            const startObj = new Date(selectedSlot.start);
            const endObj = new Date(selectedSlot.end);

            await apiFetch(`/api/citas/${selectedCita.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    start: startObj, end: endObj, estado: 'confirmada'
                })
            });
            alert("Cita reagendada exitosamente.");
            setShowDetailModal(false);
            loadAgenda();
        } catch (err) { alert("Error: " + err.message); }
    };

    // --- HANDLERS CREAR NUEVA CITA ---
    const handleOpenCreate = () => {
        setNewCitaData({ studentId: '', notes: '' });
        setTargetDate(new Date());
        setSelectedSlot(null);
        setShowCreateModal(true);
    };

    const handleCreateSubmit = async () => {
        if (!selectedSlot || !newCitaData.studentId) {
            alert("Debes seleccionar un alumno y un horario.");
            return;
        }
        try {
            const startObj = new Date(selectedSlot.start);
            const endObj = new Date(selectedSlot.end);

            await apiFetch('/api/citas/crear', {
                method: 'POST',
                body: JSON.stringify({
                    paciente_id: newCitaData.studentId, // Enviamos ID directo
                    titulo: 'Consulta Psicológica',
                    start: startObj,
                    end: endObj,
                    notas: newCitaData.notes
                })
            });

            alert("Cita agendada correctamente.");
            setShowCreateModal(false);
            loadAgenda();
        } catch (err) {
            alert("Error al crear cita: " + err.message);
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif' }}>AGENDA SEMANAL</h1>
                    <p className="text-muted m-0">Hola {user?.nombre}, gestiona tus solicitudes.</p>
                </div>
                <Button variant="primary" onClick={handleOpenCreate} className="fw-bold shadow-sm rounded-pill px-4">
                    <PlusLg className="me-2" /> Agendar Cita
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

            {/* ================= MODAL 1: DETALLE / REAGENDAR ================= */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered size={isRescheduling ? 'lg' : 'md'}>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="fw-bold text-primary d-flex align-items-center">
                        {isRescheduling ? 'Reagendar Cita' : 'Detalle de Cita'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {!isRescheduling && selectedCita ? (
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
                    ) : (
                        // Vista Reagendar (Selector Fecha/Hora)
                        <div className="row g-3">
                            <div className="col-md-5">
                                <Form.Label className="fw-bold">Nueva Fecha</Form.Label>
                                <DatePicker
                                    selected={targetDate}
                                    onChange={setTargetDate}
                                    className="form-control shadow-sm"
                                    dateFormat="dd/MM/yyyy"
                                    minDate={new Date()}
                                    inline
                                />
                            </div>
                            <div className="col-md-7">
                                <PsychologistAvailabilityGrid 
                                    slots={slots}
                                    loading={loadingSlots}
                                    selectedSlot={selectedSlot}
                                    onSelectSlot={setSelectedSlot}
                                    selectedDate={targetDate}
                                />
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
                            <Button variant="primary" onClick={handleSaveReschedule} disabled={!selectedSlot}>
                                Confirmar Cambio
                            </Button>
                        </div>
                    )}
                </Modal.Footer>
            </Modal>

            {/* ================= MODAL 2: CREAR NUEVA CITA ================= */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered size="lg" backdrop="static">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title className="fw-bold">Agendar Nueva Cita</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <Row className="g-3">
                        {/* Columna Izquierda: Datos del Alumno y Calendario */}
                        <Col md={5}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">1. Selecciona Alumno</Form.Label>
                                <Form.Select 
                                    value={newCitaData.studentId}
                                    onChange={(e) => setNewCitaData({...newCitaData, studentId: e.target.value})}
                                >
                                    <option value="">-- Elegir Alumno --</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre} ({s.rut})</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">2. Selecciona Fecha</Form.Label>
                                <DatePicker
                                    selected={targetDate}
                                    onChange={setTargetDate}
                                    className="form-control shadow-sm"
                                    dateFormat="dd/MM/yyyy"
                                    minDate={new Date()}
                                    inline
                                />
                            </Form.Group>
                        </Col>

                        {/* Columna Derecha: Horarios y Notas */}
                        <Col md={7}>
                            <PsychologistAvailabilityGrid 
                                slots={slots}
                                loading={loadingSlots}
                                selectedSlot={selectedSlot}
                                onSelectSlot={setSelectedSlot}
                                selectedDate={targetDate}
                            />
                            
                            <Form.Group className="mt-4">
                                <Form.Label className="fw-bold">4. Notas (Opcional)</Form.Label>
                                <Form.Control 
                                    as="textarea" 
                                    rows={2} 
                                    placeholder="Motivo de la cita..."
                                    value={newCitaData.notes}
                                    onChange={(e) => setNewCitaData({...newCitaData, notes: e.target.value})}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                    <Button variant="success" onClick={handleCreateSubmit} disabled={!selectedSlot || !newCitaData.studentId}>
                        Confirmar Cita
                    </Button>
                </Modal.Footer>
            </Modal>

        </div>
    );
}