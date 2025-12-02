import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { apiFetch } from '../../utils/api';
import StudentPsychologistList from './StudentPsychologistList';
import CreateAppointmentModal from '../citas/CreateAppointmentModal';

moment.locale('es');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function PsychologistDashboard() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for Drag & Drop Modal
    const [showModal, setShowModal] = useState(false);
    const [draggedStudent, setDraggedStudent] = useState(null);
    const [dropSlot, setDropSlot] = useState(null);
    const [creating, setCreating] = useState(false);

    const fetchEvents = () => {
        apiFetch("/api/citas")
            .then((data) => {
                const mappedEvents = data.map(cita => ({
                    id: cita.id,
                    title: `${cita.nombre_alumno || 'Alumno'} - ${cita.estado || 'Sin estado'}`,
                    start: new Date(cita.fecha_hora),
                    end: new Date(new Date(cita.fecha_hora).getTime() + 60 * 60 * 1000),
                    resource: cita
                }));
                setEvents(mappedEvents);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const onDropFromOutside = ({ start, end, allDay }) => {
        if (draggedStudent) {
            setDropSlot({ start, end });
            setShowModal(true);
        }
    };

    const handleConfirmAppointment = async ({ title, notes, start, end, studentId }) => {
        setCreating(true);
        try {
            await apiFetch('/api/citas/crear', {
                method: 'POST',
                body: JSON.stringify({
                    id_alumno: studentId,
                    id_psicologo: user.id,
                    fecha_hora_inicio: start,
                    fecha_hora_fin: end,
                    motivo: notes || title,
                    password: '' // Psychologist creating appointment doesn't need student password
                })
            });
            setShowModal(false);
            setDraggedStudent(null);
            fetchEvents(); // Refresh calendar
            alert('Cita creada exitosamente');
        } catch (error) {
            console.error(error);
            alert('Error al crear la cita: ' + error.message);
        } finally {
            setCreating(false);
        }
    };

    const eventStyleGetter = (event) => {
        let backgroundColor = '#3174ad';
        if (event.resource.estado === 'realizada' || event.resource.estado === 'cerrado') backgroundColor = '#28a745';
        if (event.resource.estado === 'cancelada') backgroundColor = '#dc3545';
        if (event.resource.estado === 'pendiente' || event.resource.estado === 'abiertos') backgroundColor = '#ffc107';
        if (event.resource.estado === 'en progreso') backgroundColor = '#17a2b8';

        return {
            style: {
                backgroundColor,
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        };
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
                    AGENDA SEMANAL
                </h1>
            </div>

            <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

            {/* Pass setDraggedStudent to capture the student being dragged */}
            <StudentPsychologistList onDragStart={setDraggedStudent} />

            <div style={{ height: '600px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <DnDCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    defaultView="week"
                    views={['week', 'day', 'agenda']}
                    step={30}
                    timeslots={2}
                    min={new Date(0, 0, 0, 8, 0, 0)}
                    max={new Date(0, 0, 0, 19, 0, 0)}
                    eventPropGetter={eventStyleGetter}

                    // Drag and Drop Props
                    draggableAccessor={() => true} // Allow existing events to be dragged (optional)
                    onDropFromOutside={onDropFromOutside}
                    onDragOverFromOutside={(e) => e.preventDefault()} // Necessary to allow dropping
                    dragFromOutsideItem={() => {
                        return {
                            title: draggedStudent ? draggedStudent.nombre : 'Nuevo Evento',
                            duration: 60
                        };
                    }}
                    resizable
                    onEventDrop={({ event, start, end }) => {
                        // Handle moving existing events if desired (future)
                        console.log('Moved event', event, start, end);
                    }}

                    messages={{
                        next: "Siguiente",
                        previous: "Anterior",
                        today: "Hoy",
                        month: "Mes",
                        week: "Semana",
                        day: "Día",
                        agenda: "Agenda",
                        date: "Fecha",
                        time: "Hora",
                        event: "Evento",
                        noEventsInRange: "No hay citas en este rango."
                    }}
                />
            </div>

            {/* Modal for creating appointment */}
            <CreateAppointmentModal
                show={showModal}
                onHide={() => setShowModal(false)}
                onConfirm={handleConfirmAppointment}
                loading={creating}
                student={draggedStudent}
                start={dropSlot?.start}
                end={dropSlot?.end}
            />
        </div>
    );
}