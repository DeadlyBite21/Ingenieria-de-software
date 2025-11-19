import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import { PlusCircleFill, CalendarEvent, EyeFill } from 'react-bootstrap-icons';

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/citas')
      .then(data => setCitas(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getEstadoBadge = (estado) => {
    switch(estado) {
      case 'realizada': return 'success';
      case 'cancelada': return 'danger';
      default: return 'warning';
    }
  };

  if (loading) return <div className="text-center p-5"><Spinner animation="border"/></div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1><CalendarEvent className="me-2" />Mis Citas</h1>
        {user.rol !== 2 && ( // Alumnos no crean citas
          <Button as={Link} to="/dashboard/citas/crear" variant="primary">
            <PlusCircleFill className="me-2" /> Nueva Cita
          </Button>
        )}
      </div>

      <Card>
        <Table hover responsive className="m-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Fecha / Hora</th>
              <th>{user.rol === 2 ? 'Citado por' : 'Alumno'}</th>
              <th>Motivo</th>
              <th>Lugar</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {citas.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-4">No tienes citas programadas.</td></tr>
            ) : (
              citas.map(cita => (
                <tr key={cita.id}>
                  <td>
                    {new Date(cita.fecha_hora).toLocaleDateString()}<br/>
                    <small className="text-muted">{new Date(cita.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                  </td>
                  <td>
                    {user.rol === 2 ? cita.nombre_profesor : cita.nombre_alumno}
                  </td>
                  <td>{cita.motivo}</td>
                  <td>{cita.lugar || '-'}</td>
                  <td><Badge bg={getEstadoBadge(cita.estado)}>{cita.estado}</Badge></td>
                  <td>
                    <Button as={Link} to={`/dashboard/citas/${cita.id}`} size="sm" variant="outline-info">
                      <EyeFill />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}