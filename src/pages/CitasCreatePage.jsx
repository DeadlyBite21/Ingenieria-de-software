import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'react-bootstrap-icons';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';

export default function CitasCreatePage() {
  const navigate = useNavigate();
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    idAlumno: '',
    fecha: '',
    hora: '',
    motivo: '',
    lugar: ''
  });

  // Cargar lista de usuarios (filtramos alumnos en el front o backend)
  useEffect(() => {
    apiFetch('/api/usuarios') // Asumiendo que este endpoint existe del paso anterior
      .then(data => {
        // Filtramos solo rol 2 (Alumnos)
        setAlumnos(data.filter(u => u.rol === 2));
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Combinar fecha y hora para ISO string
    const fechaHora = new Date(`${formData.fecha}T${formData.hora}`).toISOString();

    try {
      await apiFetch('/api/citas', {
        method: 'POST',
        body: JSON.stringify({
          idAlumno: formData.idAlumno,
          fechaHora: fechaHora,
          motivo: formData.motivo,
          lugar: formData.lugar
        })
      });
      navigate('/dashboard/citas');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <Link to="/dashboard/citas" className="btn btn-outline-secondary mb-3">
        <ArrowLeft className="me-2" /> Volver
      </Link>

      <Card className="mx-auto" style={{ maxWidth: '600px' }}>
        <Card.Header><h4>Agendar Nueva Cita</h4></Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Alumno</Form.Label>
              <Form.Select 
                value={formData.idAlumno}
                onChange={e => setFormData({...formData, idAlumno: e.target.value})}
                required
              >
                <option value="">Seleccione un alumno...</option>
                {alumnos.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.rut})</option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control 
                    type="date" 
                    required 
                    value={formData.fecha}
                    onChange={e => setFormData({...formData, fecha: e.target.value})}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Hora</Form.Label>
                  <Form.Control 
                    type="time" 
                    required 
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Motivo</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Ej: Revisión de notas, conducta..."
                required 
                value={formData.motivo}
                onChange={e => setFormData({...formData, motivo: e.target.value})}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Lugar (Opcional)</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="Ej: Sala 203"
                value={formData.lugar}
                onChange={e => setFormData({...formData, lugar: e.target.value})}
              />
            </Form.Group>

            <div className="d-grid">
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner size="sm" animation="border"/> : 'Guardar Cita'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}