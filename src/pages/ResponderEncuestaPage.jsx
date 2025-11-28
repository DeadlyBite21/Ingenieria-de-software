import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useNavigate, useParams, Link } from 'react-router-dom';

import { ArrowLeft } from 'react-bootstrap-icons';
import { Form, Button, Card, Alert, Spinner, ListGroup } from 'react-bootstrap';

// Componente para una pregunta individual
function Pregunta({ pregunta, index, onChange, respuestaInicial }) {
    const [valor, setValor] = useState(respuestaInicial || (pregunta.tipo_pregunta === 'escala_1_5' ? 0 : ''));

    const handleChange = useCallback((e) => {
        let nuevoValor = e.target.value;
        if (pregunta.tipo_pregunta === 'escala_1_5') {
            nuevoValor = parseInt(nuevoValor);
        }
        setValor(nuevoValor);
        onChange(pregunta.id, nuevoValor);
    }, [pregunta.id, onChange]);

    return (
        <ListGroup.Item>
            <div className="d-flex justify-content-between">
                <p className="fw-bold mb-1">{index + 1}. {pregunta.texto}</p>
            </div>
            
            {pregunta.tipo_pregunta === 'escala_1_5' ? (
                <div className="d-flex justify-content-between align-items-center mt-2">
                    <Form.Label className="me-3 mb-0">Escala (1-5):</Form.Label>
                    <div className="d-flex gap-3">
                        {[1, 2, 3, 4, 5].map(n => (
                            <Form.Check
                                key={n}
                                type="radio"
                                label={n}
                                name={`pregunta-${pregunta.id}`}
                                value={n}
                                checked={valor === n}
                                onChange={handleChange}
                                required
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Escribe tu respuesta aquí..."
                    value={valor}
                    onChange={handleChange}
                    required
                />
            )}
        </ListGroup.Item>
    );
}


export default function ResponderEncuestaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [encuesta, setEncuesta] = useState(null);
    const [respuestas, setRespuestas] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Cargar encuesta y preguntas
    useEffect(() => {
        apiFetch(`/api/encuestas/${id}`)
            .then(data => {
                setEncuesta(data);
                // Inicializar respuestas si no ha respondido
                if (!data.yaRespondio) {
                    const initialRespuestas = data.preguntas.reduce((acc, p) => {
                        acc[p.id] = p.tipo_pregunta === 'escala_1_5' ? 0 : '';
                        return acc;
                    }, {});
                    setRespuestas(initialRespuestas);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAnswerChange = useCallback((preguntaId, valor) => {
        setRespuestas(prev => ({
            ...prev,
            [preguntaId]: valor
        }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        // Formatear respuestas para el backend
        const respuestasFormateadas = Object.entries(respuestas)
            .map(([id, valor]) => ({
                idPregunta: parseInt(id),
                valor: valor 
            }))
            .filter(r => r.valor !== 0 && r.valor !== ''); // Filtrar vacías o no contestadas

        try {
            await apiFetch(`/api/encuestas/${id}/respuestas`, {
                method: 'POST',
                body: JSON.stringify({ respuestas: respuestasFormateadas })
            });
            alert('Encuesta enviada con éxito. ¡Gracias!');
            navigate('/dashboard/encuestas');
        } catch (err) {
            setError(err.message || "Error al enviar la encuesta.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center mt-5"><Spinner animation="border"/></div>;
    if (error) return <Alert variant="danger" className="mt-4">{error}</Alert>;
    if (!encuesta) return <Alert variant="warning" className="mt-4">Encuesta no encontrada.</Alert>;
    
    // Si ya respondió, mostrar mensaje
    if (encuesta.yaRespondio) {
        return (
            <Card className="mt-5 mx-auto" style={{ maxWidth: '700px' }}>
                <Card.Header className="bg-success text-white">Encuesta Finalizada</Card.Header>
                <Card.Body>
                    <Alert variant="success">
                        ✅ ¡Ya has respondido la encuesta **{encuesta.titulo}**!
                    </Alert>
                    <p>Gracias por tu participación.</p>
                    <Link to="/dashboard/encuestas" className="btn btn-outline-secondary">
                        <ArrowLeft /> Volver a Encuestas
                    </Link>
                </Card.Body>
            </Card>
        );
    }


    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <Link to="/dashboard/encuestas" className="btn btn-outline-secondary mb-3">
                <ArrowLeft className="me-2" /> Volver a Encuestas
            </Link>

            <Card>
                <Card.Header>
                    <h2 className="mb-1">{encuesta.titulo}</h2>
                    <p className="text-muted mb-0">Curso: {encuesta.nombre_curso}</p>
                </Card.Header>
                <Card.Body>
                    <p>{encuesta.descripcion}</p>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <ListGroup variant="flush">
                            {encuesta.preguntas.map((pregunta, index) => (
                                <Pregunta
                                    key={pregunta.id}
                                    pregunta={pregunta}
                                    index={index}
                                    onChange={handleAnswerChange}
                                />
                            ))}
                        </ListGroup>

                        {error && <Alert variant="danger" className="mt-4">{error}</Alert>}
                        
                        <div className="d-grid mt-4">
                            <Button type="submit" variant="success" size="lg" disabled={submitting}>
                                {submitting ? (
                                    <Spinner as="span" animation="border" size="sm" />
                                ) : (
                                    'Finalizar y Enviar Encuesta'
                                )}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
}