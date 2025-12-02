// src/pages/IncidentDetailPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
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

  // Additional states for related data if needed
  const [cursoNombre, setCursoNombre] = useState('');
  const [alumnosDetalle, setAlumnosDetalle] = useState([]);
  const [reportadoPor, setReportadoPor] = useState(null);

  useEffect(() => {
    apiFetch(`/api/incidentes/${id}`)
      .then(data => setIncidente(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!incidente) return;

    const loadRelated = async () => {
      try {
        // aquí usamos SOLO endpoints que sí existen en tu api.js
        const [cursosData, usuariosData] = await Promise.all([
          apiFetch('/api/cursos'),
          apiFetch('/api/usuarios')
        ]);

        // ---- Curso ----
        const cursoId = Number(incidente.id_curso);
        const curso = cursosData.find(c => Number(c.id) === cursoId);
        setCursoNombre(curso ? curso.nombre : `ID: ${incidente.id_curso}`);

        // ---- Usuario que reportó ----
        const creadorId =
          incidente.creado_por !== null && incidente.creado_por !== undefined
            ? Number(incidente.creado_por)
            : null;

        const creador = creadorId !== null
          ? usuariosData.find(u => Number(u.id) === creadorId)
          : null;

        if (creador) {
          setReportadoPor(creador);
        }

        // ---- Alumnos involucrados ----
        const alumnosIds = Array.isArray(incidente.alumnos) ? incidente.alumnos : [];
        const alumnosDet = alumnosIds.map(id => {
          const u = usuariosData.find(user => user.id === id);
          return {
            id,
            nombre: u ? u.nombre : `Usuario ID ${id}`,
          };
        });
        setAlumnosDetalle(alumnosDet);

      } catch (e) {
        console.error('Error cargando datos relacionados', e);
      }
    };

    loadRelated();
  }, [incidente]);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'abierto': return 'danger';
      case 'en-progreso': return 'warning';
      case 'cerrado': return 'success';
      default: return 'secondary';
    }
  };

  const renderAlumnos = (lista) => {
    if (!lista || lista.length === 0) {
      return <span className="text-muted">No aplica</span>;
    }

    return (
      <ul className="mb-0 ps-3">
        {lista.map(a => (
          <li key={a.id}>
            {a.nombre} (ID: {a.id})
          </li>
        ))}
      </ul>
    );
  };

  const renderList = (items) => {
    if (!items || items.length === 0) {
      return <span className="text-muted">No aplica</span>;
    }

    if (!Array.isArray(items)) {
      return <span>{String(items)}</span>;
    }

    return (
      <ul className="mb-0 ps-3">
        {items.map((item, idx) => (
          <li key={idx}>
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
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
              <strong>Curso:</strong><br />
              {cursoNombre || `ID: ${incidente.id_curso}`}
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
            <strong>Alumnos Involucrados:</strong>
            <div>{renderAlumnos(alumnosDetalle)}</div>
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Otros Participantes:</strong>
            {renderList(incidente.participantes)}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Medidas Tomadas:</strong>
            {renderList(incidente.medidas)}
          </ListGroup.Item>
          <ListGroup.Item>
            <strong>Reportado por:</strong>
            <p className="mb-0">
              {reportadoPor
                ? `${reportadoPor.nombre} (ID: ${reportadoPor.id})`
                : (incidente.creado_por || 'Sistema')}
            </p>
          </ListGroup.Item>
        </ListGroup>

      </Card>
    </div>
  );
}