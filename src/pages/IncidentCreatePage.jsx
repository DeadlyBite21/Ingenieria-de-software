// src/pages/IncidentCreatePage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// --- Importaciones de React Bootstrap ---
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { ArrowLeft } from 'react-bootstrap-icons';

export default function IncidentCreatePage() {
  const { id } = useParams(); // Para saber si estamos editando
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    idCurso: '',
    tipo: 'académico',
    severidad: 'baja',
    descripcion: '',
    lugar: '',
    // Campos JSON simplificados
    alumnos: '', // El usuario pondrá IDs separados por coma
    // 'participantes', 'medidas', 'adjuntos' los omitimos por simplicidad
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isEditing = Boolean(id);

  // Si estamos editando, cargar los datos del incidente
  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      apiFetch(`/api/incidentes/${id}`)
        .then(data => {
          setFormData({
            idCurso: data.id_curso || '',
            tipo: data.tipo || 'académico',
            severidad: data.severidad || 'baja',
            descripcion: data.descripcion || '',
            lugar: data.lugar || '',
            alumnos: (data.alumnos || []).join(', '), // Convertir array a string
          });
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Preparar el payload para la API
    const payload = {
      idCurso: parseInt(formData.idCurso),
      tipo: formData.tipo,
      severidad: formData.severidad,
      descripcion: formData.descripcion,
      lugar: formData.lugar || null,
      // Convertir string de IDs a array de números
      alumnos: formData.alumnos.split(',')
                  .map(id => parseInt(id.trim()))
                  .filter(id => !isNaN(id) && id > 0)
    };
    
    // Validar descripción
    if (payload.descripcion.length < 10) {
      setError("La descripción debe tener al menos 10 caracteres.");
      setLoading(false);
      return;
    }

    try {
      if (isEditing) {
        // --- Modo Edición (PATCH) ---
        // El backend/api.js permite actualizar campos parciales
        await apiFetch(`/api/incidentes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        // --- Modo Creación (POST) ---
        await apiFetch('/api/incidentes', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      
      alert(`Incidente ${isEditing ? 'actualizado' : 'creado'} exitosamente.`);
      navigate('/dashboard/incidentes'); // Redirigir a la lista

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  if (loading && isEditing) {
    return <div className="text-center my-5"><Spinner animation="border" /></div>;
  }

  return (
    <div>
      <Link to="/dashboard/incidentes" className="btn btn-outline-secondary mb-3">
        <ArrowLeft className="me-2" />
        Volver a Incidentes
      </Link>
      
      <Card>
        <Card.Header>
          <Card.Title as="h2" className="m-0">
            {isEditing ? 'Editar Incidente' : 'Reportar Nuevo Incidente'}
          </Card.Title>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* ID Curso */}
              <div className="col-md-4">
                <Form.Group controlId="idCurso">
                  <Form.Label>ID del Curso*</Form.Label>
                  <Form.Control 
                    type="number" 
                    name="idCurso"
                    value={formData.idCurso}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </Form.Group>
              </div>
              
              {/* Tipo */}
              <div className="col-md-4">
                <Form.Group controlId="tipo">
                  <Form.Label>Tipo de Incidente*</Form.Label>
                  <Form.Select 
                    name="tipo" 
                    value={formData.tipo}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  >
                    <option value="académico">Académico</option>
                    <option value="conductual">Conductual</option>
                    <option value="infraestructura">Infraestructura</option>
                    <option value="otro">Otro</option>
                  </Form.Select>
                </Form.Group>
              </div>

              {/* Severidad */}
              <div className="col-md-4">
                <Form.Group controlId="severidad">
                  <Form.Label>Severidad*</Form.Label>
                  <Form.Select 
                    name="severidad" 
                    value={formData.severidad}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="crítica">Crítica</option>
                  </Form.Select>
                </Form.Group>
              </div>

              {/* Lugar */}
              <div className="col-md-12">
                <Form.Group controlId="lugar">
                  <Form.Label>Lugar (Opcional)</Form.Label>
                  <Form.Control 
                    type="text" 
                    name="lugar"
                    placeholder="Ej: Sala 301, Patio central"
                    value={formData.lugar}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </Form.Group>
              </div>
              
              {/* Descripción */}
              <div className="col-md-12">
                <Form.Group controlId="descripcion">
                  <Form.Label>Descripción*</Form.Label>
                  <Form.Control 
                    as="textarea"
                    rows={4}
                    name="descripcion"
                    placeholder="Describe el incidente (mín. 10 caracteres)..."
                    value={formData.descripcion}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </Form.Group>
              </div>
              
              {/* Alumnos */}
              <div className="col-md-12">
                <Form.Group controlId="alumnos">
                  <Form.Label>IDs de Alumnos Involucrados (Opcional)</Form.Label>
                  <Form.Control 
                    type="text" 
                    name="alumnos"
                    placeholder="IDs separados por coma. Ej: 1, 5, 12"
                    value={formData.alumnos}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </Form.Group>
              </div>
            </div>

            {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

            <div className="text-end mt-4">
              <Button type="submit" variant="primary" size="lg" disabled={loading}>
                {loading ? (
                  <Spinner as="span" animation="border" size="sm" />
                ) : (
                  isEditing ? 'Actualizar Incidente' : 'Guardar Incidente'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}