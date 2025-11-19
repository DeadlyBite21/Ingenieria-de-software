import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Badge, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { ArrowLeft } from 'react-bootstrap-icons';

export default function CitasDetailPage() {
  const { id } = useParams();
  const [cita, setCita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/citas/${id}`)
      .then(setCita)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center mt-5"><Spinner animation="border"/></div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!cita) return <Alert variant="warning">Cita no encontrada</Alert>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <Link to="/dashboard/citas" className="btn btn-outline-secondary mb-3">
        <ArrowLeft className="me-2" /> Volver
      </Link>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="m-0">Detalle de Cita #{cita.id}</h4>
          <Badge bg="info">{cita.estado}</Badge>
        </Card.Header>
        <ListGroup variant="flush">
          <ListGroup.Item>
            <strong>Motivo:</strong> {cita.motivo}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Fecha y Hora:</strong> {new Date(cita.fecha_hora).toLocaleString()}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Lugar:</strong> {cita.lugar || 'No especificado'}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Alumno:</strong> {cita.nombre_alumno} (RUT: {cita.rut_alumno})
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Citado por:</strong> {cita.nombre_profesor}
          </ListGroup.Item>
        </ListGroup>
        <Card.Footer className="text-muted">
            Creado el: {new Date(cita.creado_en).toLocaleDateString()}
        </Card.Footer>
      </Card>
    </div>
  );
}