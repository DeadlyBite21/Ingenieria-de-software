// src/pages/CrearEncuestaPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useNavigate, Link } from 'react-router-dom';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import InputGroup from 'react-bootstrap/InputGroup';
import { ArrowLeft, Trash, PlusLg } from 'react-bootstrap-icons';

export default function CrearEncuestaPage() {
  const navigate = useNavigate();
  // Estados del formulario
  const [cursos, setCursos] = useState([]); // Cursos del profesor
  const [idCurso, setIdCurso] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [preguntas, setPreguntas] = useState([
    { texto: '', tipo_pregunta: 'escala_1_5' }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar los cursos que el profesor puede administrar
  useEffect(() => {
    // Reutilizamos el endpoint /api/cursos que ya filtra por rol
    apiFetch('/api/cursos')
      .then(data => {
        setCursos(data);
        // Si solo tiene un curso, seleccionarlo por defecto
        if (data.length === 1) {
          setIdCurso(data[0].id);
        }
      })
      .catch(err => setError(err.message));
  }, []);

  // --- Handlers para el formulario dinámico ---

  const handlePreguntaChange = (index, field, value) => {
    const nuevasPreguntas = [...preguntas];
    nuevasPreguntas[index][field] = value;
    setPreguntas(nuevasPreguntas);
  };

  const addPregunta = () => {
    setPreguntas([...preguntas, { texto: '', tipo_pregunta: 'escala_1_5' }]);
  };

  const removePregunta = (index) => {
    const nuevasPreguntas = preguntas.filter((_, i) => i !== index);
    setPreguntas(nuevasPreguntas);
  };

  // --- Handler para enviar ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validar
    if (preguntas.some(p => p.texto.trim() === '')) {
      setError("El texto de todas las preguntas es obligatorio.");
      setLoading(false);
      return;
    }

    try {
      await apiFetch('/api/encuestas', {
        method: 'POST',
        body: JSON.stringify({
          idCurso: parseInt(idCurso),
          titulo,
          descripcion,
          preguntas // El backend espera este array
        })
      });

      alert('Encuesta creada exitosamente.');
      navigate('/dashboard/encuestas'); // Redirigir a la lista

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <Link to="/dashboard/encuestas" className="btn btn-outline-secondary mb-3">
        <ArrowLeft className="me-2" />
        Volver a Encuestas
      </Link>

      <Card>
        <Card.Header>
          <Card.Title as="h2" className="m-0">
            Crear Nueva Encuesta
          </Card.Title>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            {/* --- Info General --- */}
            <Form.Group className="mb-3" controlId="tituloEncuesta">
              <Form.Label>Título de la Encuesta*</Form.Label>
              <Form.Control
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="idCursoEncuesta">
              <Form.Label>Curso*</Form.Label>
              <Form.Select
                value={idCurso}
                onChange={(e) => setIdCurso(e.target.value)}
                required
                disabled={loading || cursos.length === 0}
              >
                <option value="">
                  {cursos.length === 0 ? "Cargando cursos..." : "Selecciona un curso"}
                </option>
                {cursos.map(curso => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nombre} (ID: {curso.id})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3" controlId="descripcionEncuesta">
              <Form.Label>Descripción (Opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={loading}
                placeholder="Instrucciones para los alumnos..."
              />
            </Form.Group>

            <hr />

            {/* --- Preguntas Dinámicas --- */}
            <h4 className="mb-3">Preguntas</h4>

            {preguntas.map((pregunta, index) => (
              <Card key={index} className="mb-3 bg-light">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Form.Label className="mb-0 fw-bold">Pregunta {index + 1}</Form.Label>
                    {preguntas.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => removePregunta(index)}>
                        <Trash />
                      </Button>
                    )}
                  </div>

                  <InputGroup className="mb-2">
                    <InputGroup.Text>Texto:</InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Ej: El profesor explica con claridad"
                      value={pregunta.texto}
                      onChange={(e) => handlePreguntaChange(index, 'texto', e.target.value)}
                      required
                    />
                  </InputGroup>

                  <InputGroup>
                    <InputGroup.Text>Tipo:</InputGroup.Text>
                    <Form.Select
                      value={pregunta.tipo_pregunta}
                      onChange={(e) => handlePreguntaChange(index, 'tipo_pregunta', e.target.value)}
                    >
                      <option value="escala_1_5">Escala 1 a 5 (Muy en desacuerdo a Muy de acuerdo)</option>
                      <option value="texto_libre">Respuesta Abierta</option>
                    </Form.Select>
                  </InputGroup>
                </Card.Body>
              </Card>
            ))}

            <Button variant="outline-primary" onClick={addPregunta} disabled={loading} className="mb-3">
              <PlusLg className="me-2" />
              Añadir Pregunta
            </Button>

            {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

            <div className="text-end mt-4">
              <Button type="submit" variant="success" size="lg" disabled={loading || !idCurso}>
                {loading ? (
                  <Spinner as="span" animation="border" size="sm" />
                ) : (
                  'Publicar Encuesta'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}