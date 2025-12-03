import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import { PlusCircleFill, CalendarEvent, EyeFill } from 'react-bootstrap-icons';

export default function CitasListPage() {
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [psicologos, setPsicologos] = useState({});
  const [alumnos, setAlumnos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const puedeCrear = user && (user.rol === 0 || user.rol === 2 || user.rol === 3);

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

  if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

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

      <Card>
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
    </div>
  );
}
