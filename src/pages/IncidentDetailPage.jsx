// src/pages/IncidentDetailPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useParams, Link } from 'react-router-dom';

// --- Importaciones de React Bootstrap ---
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import ListGroup from 'react-bootstrap/ListGroup';
import { ArrowLeft } from 'react-bootstrap-icons';

export default function IncidentDetailPage() {
  const { id } = useParams();
  const [incidente, setIncidente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/api/incidentes/${id}`)
      .then(data => setIncidente(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'abierto': return 'danger';
      case 'en-progreso': return 'warning';
      case 'cerrado': return 'success';
      default: return 'secondary';
    }
  };
  
  const renderJSON = (data) => {
    if (!data || data.length === 0) return <span className="text-muted">No aplica</span>;
    return <pre className="bg-light p-2 rounded small">{JSON.stringify(data, null, 2)}</pre>;
  };

  if (loading) {
    return <div className="text-center my-5"><Spinner animation="border" /></div>;
  }
  
  if (error) {
    return <Alert variant="danger">Error al cargar incidente: {error}</Alert>;
  }
  
  if (!incidente) {
    return <Alert variant="warning">No se encontró el incidente.</Alert>;
  }

  return (
    <div>
      <Link to="/dashboard/incidentes" className="btn btn-outline-secondary mb-3">
        <ArrowLeft className="me-2" />
        Volver a Incidentes
      </Link>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Card.Title as="h2" className="m-0">
            Detalle de Incidente (ID: {incidente.id})
          </Card.Title>
          <Badge bg={getStatusBadge(incidente.estado)} pill className="fs-6">
            {incidente.estado}
          </Badge>
        </Card.Header>
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-4">
              <strong>Tipo:</strong><br />
              {incidente.tipo}
            </div>
            <div className="col-md-4">
              <strong>Severidad:</strong><br />
              {incidente.severidad}
            </div>
            <div className="col-md-4">
              <strong>Fecha:</strong><br />
              {new Date(incidente.fecha).toLocaleString()}
            </div>
            <div className="col-md-6">
              <strong>Curso ID:</strong><br />
              {incidente.id_curso}
            </div>
            <div className="col-md-6">
              <strong>Lugar:</strong><br />
              {incidente.lugar || <span className="text-muted">No especificado</span>}
            </div>
            <div className="col-12">
              <strong>Descripción:</strong>
              <p className="bg-light p-3 rounded mt-1">{incidente.descripcion}</p>
            </div>
          </div>
        </Card.Body>
        <ListGroup variant="flush">
          <ListGroup.Item>
            <strong>Alumnos Involucrados (IDs):</strong>
            {renderJSON(incidente.alumnos)}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Otros Participantes:</strong>
            {renderJSON(incidente.participantes)}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Medidas Tomadas:</strong>
            {renderJSON(incidente.medidas)}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Reportado por (Usuario ID):</strong>
            <p className="mb-0">{incidente.creado_por || 'Sistema'}</p>
          </ListGroup.Item>
        </ListGroup>
      </Card>
    </div>
  );
}