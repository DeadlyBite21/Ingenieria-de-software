import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useParams, Link } from 'react-router-dom';

import { ArrowLeft, BarChartFill, CardList } from 'react-bootstrap-icons';
import { Card, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';

// Componente para visualizar preguntas de escala
function EscalaResultados({ data }) {
    const total = data.reduce((sum, item) => sum + item.total, 0);
    const maxCount = data.reduce((max, item) => Math.max(max, item.total), 0);
    const getPorcentaje = (count) => total === 0 ? 0 : ((count / total) * 100).toFixed(0);

    return (
        <div className="mt-3">
            {data.map(item => (
                <div key={item.valor} className="d-flex align-items-center mb-2">
                    <div style={{ width: '40px', fontWeight: 'bold' }}>{item.valor}:</div>
                    <div className="flex-grow-1 position-relative me-3">
                        <div style={{
                            width: `${(item.total / maxCount) * 100}%`,
                            backgroundColor: '#007bff',
                            height: '25px',
                            borderRadius: '4px'
                        }}></div>
                        <span style={{ 
                            position: 'absolute', 
                            left: '5px', 
                            top: '2px', 
                            color: 'white',
                            fontSize: '0.8rem' 
                        }}>
                            {item.total} ({getPorcentaje(item.total)}%)
                        </span>
                    </div>
                </div>
            ))}
            {total === 0 && <Alert variant="warning" className="mt-2">Aún no hay respuestas de escala.</Alert>}
            <p className="text-muted mt-2">Total de respuestas: {total}</p>
        </div>
    );
}

// Componente para visualizar preguntas de texto libre
function TextoResultados({ data }) {
    return (
        <ListGroup className="mt-3">
            {data.length === 0 ? (
                <ListGroup.Item className="text-muted">Aún no hay respuestas de texto.</ListGroup.Item>
            ) : (
                data.map((texto, index) => (
                    <ListGroup.Item key={index} className="py-2 px-3 small">
                        "{texto}"
                    </ListGroup.Item>
                ))
            )}
        </ListGroup>
    );
}


export default function ResultadosEncuestaPage() {
    const { id } = useParams();
    const [encuestaData, setEncuestaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiFetch(`/api/encuestas/${id}/resultados`)
            .then(setEncuestaData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="text-center mt-5"><Spinner animation="border"/></div>;
    if (error) return <Alert variant="danger" className="mt-4">Error al cargar resultados: {error}</Alert>;
    if (!encuestaData) return <Alert variant="warning" className="mt-4">Resultados no encontrados.</Alert>;

    const { encuesta, resultados } = encuestaData;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Link to="/dashboard/encuestas" className="btn btn-outline-secondary mb-3">
                <ArrowLeft className="me-2" /> Volver a Encuestas
            </Link>

            <Card className="mb-4">
                <Card.Header className="bg-primary text-white">
                    <h2>Resultados: {encuesta.titulo}</h2>
                </Card.Header>
                <Card.Body>
                    <p>{encuesta.descripcion}</p>
                </Card.Body>
            </Card>

            {resultados.map(res => (
                <Card key={res.idPregunta} className="mb-3">
                    <Card.Header className="d-flex align-items-center">
                        {res.tipo === 'escala_1_5' ? <BarChartFill className="me-2" /> : <CardList className="me-2" />}
                        <span className="fw-bold">{res.texto}</span>
                        <Badge bg="secondary" className="ms-3">
                            {res.tipo === 'escala_1_5' ? 'Escala 1-5' : 'Texto Libre'}
                        </Badge>
                    </Card.Header>
                    <Card.Body>
                        {res.tipo === 'escala_1_5' ? (
                            <EscalaResultados data={res.data} />
                        ) : (
                            <TextoResultados data={res.data} />
                        )}
                    </Card.Body>
                </Card>
            ))}
            
            {resultados.length === 0 && (
                <Alert variant="info" className="mt-4">
                    Esta encuesta no tiene preguntas o las respuestas aún no han sido procesadas.
                </Alert>
            )}
        </div>
    );
}