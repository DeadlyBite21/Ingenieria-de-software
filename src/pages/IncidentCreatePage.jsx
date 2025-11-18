// src/pages/IncidentCreatePage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Date picker
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
    alumnos: [],      // alumnos en array
    fechaHora: null     // nueva fecha y hora del incidente manualmente
  });

  const [cursos, setCursos] = useState([]);
  const [alumnosDisponibles, setAlumnosDisponibles] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isEditing = Boolean(id);

  // Cargar cursos y alumnos disponibles para el formulario
  // Cargar solo cursos para el formulario
  useEffect(() => {
    const loadData = async () => {
      try {
        const cursosData = await apiFetch('/api/cursos');
        setCursos(cursosData);
      } catch (err) {
        console.error('Error cargando cursos', err);
      }
    };

    loadData();
  }, []);

  // Cargar usuarios (profes y alumnos) según el curso seleccionado
  useEffect(() => {
    const loadUsuariosCurso = async () => {
      // Si no hay curso seleccionado, limpiamos la lista
      if (!formData.idCurso) {
        setAlumnosDisponibles([]);
        return;
      }

      try {
        const usuariosData = await apiFetch(`/api/cursos/${formData.idCurso}/usuarios`);
        // Solo profesor (1) y alumno (2)
        const alumnosYProfes = usuariosData.filter(u => u.rol === 1 || u.rol === 2);
        setAlumnosDisponibles(alumnosYProfes);
      } catch (err) {
        console.error('Error cargando usuarios del curso', err);
        setAlumnosDisponibles([]);
      }
    };

    loadUsuariosCurso();
  }, [formData.idCurso]);


  // Si estamos editando, cargar los datos del incidente
  useEffect(() => {
    if (isEditing) {
      setLoading(true);
      apiFetch(`/api/incidentes/${id}`)
        .then(data => {
          const fechaISO = data.fecha || null;
          const fechaDate = fechaISO ? new Date(fechaISO) : null;

          setFormData(prev => ({
            ...prev,
            idCurso: data.id_curso ?? '',
            tipo: data.tipo ?? 'académico',
            severidad: data.severidad ?? 'baja',
            descripcion: data.descripcion ?? '',
            lugar: data.lugar ?? '',
            alumnos: data.alumnos || [],
            fechaHora: fechaDate      // Date o null
          }));
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isEditing]);


  const handleChange = (e) => {
    const { name, value, multiple, selectedOptions } = e.target;

    if (multiple) {
      const values = Array.from(selectedOptions).map(opt => opt.value);
      setFormData(prev => ({ ...prev, [name]: values }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      alumnos: (formData.alumnos || [])
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0),
      // el backend espera "fecha"
      fecha: formData.fechaHora
        ? new Date(formData.fechaHora).toISOString()
        : null
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
                <Form.Group controlId="idCursoSelect" className="mt-2">
                  <Form.Label>Seleccionar curso</Form.Label>
                  <Form.Select
                    value={formData.idCurso}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, idCurso: e.target.value }))
                    }
                    disabled={loading || cursos.length === 0}
                  >
                    <option value="">Selecciona un curso...</option>
                    {cursos.map(curso => (
                      <option key={curso.id} value={curso.id}>
                        {curso.nombre} (ID: {curso.id})
                      </option>
                    ))}
                  </Form.Select>
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

              <div className="col-md-4">
                <Form.Group controlId="fechaHora">
                  <Form.Label>Fecha y hora del incidente*</Form.Label>
                  <DatePicker
                    selected={formData.fechaHora}
                    onChange={(date) =>
                      setFormData(prev => ({ ...prev, fechaHora: date }))
                    }
                    showTimeSelect
                    timeIntervals={15}              // cada 15 minutos
                    dateFormat="dd/MM/yyyy HH:mm"
                    placeholderText="Selecciona fecha y hora"
                    className="form-control"        // para que se vea como un input de Bootstrap
                    disabled={loading}
                  />
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
                  <Form.Label>Alumnos involucrados (Opcional)</Form.Label>
                  <Form.Select
                    name="alumnos"
                    multiple
                    value={formData.alumnos}
                    onChange={handleChange}
                    disabled={loading || alumnosDisponibles.length === 0}
                  >
                    {alumnosDisponibles.map(usuario => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombre} (ID: {usuario.id}, {usuario.rol === 1 ? 'Profesor' : 'Alumno'})
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Usa Ctrl (o Cmd en Mac) para seleccionar varios alumnos.
                  </Form.Text>
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