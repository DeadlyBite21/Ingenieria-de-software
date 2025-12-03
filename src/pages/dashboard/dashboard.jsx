import { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

moment.locale('es');
const localizer = momentLocalizer(moment);

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/citas")
      .then((data) => {
        const mappedEvents = data.map(cita => ({
          id: cita.id,
          title: `${cita.nombre_alumno || 'Alumno'} - ${cita.estado}`,
          start: new Date(cita.fecha_hora),
          end: new Date(new Date(cita.fecha_hora).getTime() + 60 * 60 * 1000), // Asumimos 1 hora de duración
          status: cita.estado,
          resource: cita
        }));
        setEvents(mappedEvents);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3174ad'; // Default (Azul)
    if (event.status === 'realizada' || event.status === 'cerrado') backgroundColor = '#28a745'; // Verde
    if (event.status === 'cancelada') backgroundColor = '#dc3545'; // Rojo
    if (event.status === 'pendiente' || event.status === 'abiertos') backgroundColor = '#ffc107'; // Amarillo
    if (event.status === 'en progreso') backgroundColor = '#17a2b8'; // Cyan

  const rolLabel =
    user?.rol === 0 ? "Administrador" :
    user?.rol === 1 ? "Profesor" :
    user?.rol === 3 ? "Psicólogo" :
    "Desconocido";


  return (
    <div style={{ height: '80vh', padding: '20px' }}>
      <h1 className="mb-4 fw-bold" style={{ fontFamily: 'sans-serif' }}>Calendario Semanal</h1>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        eventPropGetter={eventStyleGetter}
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
  );
}
}
