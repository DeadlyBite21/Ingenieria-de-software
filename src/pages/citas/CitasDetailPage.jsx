import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, ListGroup, Spinner, Alert, Form } from 'react-bootstrap';
import { ArrowLeft } from 'react-bootstrap-icons';

const ESTADOS_CITA = ['pendiente', 'confirmada', 'realizada', 'cancelada'];

export default function CitasDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cita, setCita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editData, setEditData] = useState({ estado: '', conclusion: '' });

  const puedeEditar = user && (user.rol === 0 || user.rol === 3);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch(`/api/citas/${id}`);
        setCita(data);
        setEditData({
          estado: data.estado || 'pendiente',
          conclusion: data.conclusion || '',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    if (!puedeEditar) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        estado: editData.estado,
        conclusion: editData.conclusion,
      };

      await apiFetch(`/api/citas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setCita(prev => prev ? { ...prev, ...payload } : prev);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

  if (error && !cita) {
    return <Alert variant="danger" className="mt-3">{error}</Alert>;
  }

  if (!cita) {
    return <Alert variant="warning" className="mt-3">Cita no encontrada.</Alert>;
  }

  const inicio = new Date(cita.fecha_hora_inicio);
  const fin = new Date(cita.fecha_hora_fin);

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'confirmada': return 'info';
      case 'realizada': return 'success';
      case 'cancelada': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <div>
      <div className="mb-3">
        <Button as={Link} to="/dashboard/citas" variant="link">
          <ArrowLeft className="me-1" /> Volver a citas
        </Button>
      </div>

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h4>Detalle de la cita</h4>
            <Badge bg={getEstadoBadge(cita.estado)}>{cita.estado}</Badge>
          </div>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <ListGroup className="mb-4">
            <ListGroup.Item>
              <strong>Fecha:</strong> {inicio.toLocaleDateString()}
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>Horario:</strong>{' '}
              {inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
              {fin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>ID Alumno:</strong> {cita.paciente_id}
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>ID Psicólogo:</strong> {cita.psicologo_id}
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>Motivo:</strong> {cita.motivo}
            </ListGroup.Item>
            <ListGroup.Item>
              <strong>Conclusión:</strong> {cita.conclusion || 'Sin conclusión aún.'}
            </ListGroup.Item>
          </ListGroup>

          {puedeEditar && (
            <Form onSubmit={handleGuardarCambios}>
              <h5>Actualizar estado / conclusión</h5>

              <Form.Group className="mb-3">
                <Form.Label>Estado</Form.Label>
                <Form.Select
                  value={editData.estado}
                  onChange={e => setEditData({ ...editData, estado: e.target.value })}
                >
                  {ESTADOS_CITA.map(est => (
                    <option key={est} value={est}>{est}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Conclusión</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editData.conclusion}
                  onChange={e => setEditData({ ...editData, conclusion: e.target.value })}
                />
              </Form.Group>

              <div className="d-grid">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner size="sm" animation="border" /> : 'Guardar cambios'}
                </Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
