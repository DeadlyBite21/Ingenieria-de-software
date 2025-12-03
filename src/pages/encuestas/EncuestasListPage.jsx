// src/pages/encuestas/EncuestasListPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import { PlusCircleFill, EyeFill, ClipboardCheck } from 'react-bootstrap-icons';

export default function EncuestasListPage() {
  const { isAdmin, isProfesor, isPsicologo } = useAuth();
  const [encuestas, setEncuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEncuestas();
  }, []);

  const loadEncuestas = async () => {
    try {
      const data = await apiFetch('/api/encuestas');
      setEncuestas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ fontFamily: 'sans-serif' }}>
      {/* --- HEADER ESTILIZADO --- */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
            GESTIÓN DE ENCUESTAS
          </h1>
          <p className="text-muted m-0" style={{ fontFamily: 'sans-serif' }}>
            Revisa y administra las encuestas disponibles.
          </p>
        </div>

        {(isAdmin || isProfesor) && (
          <Button as={Link} to="/dashboard/encuestas/crear" variant="primary" className="fw-bold shadow-sm rounded-pill px-4" style={{ fontFamily: 'sans-serif' }}>
            <PlusCircleFill className="me-2" />
            Crear Encuesta
          </Button>
        )}
      </div>

      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {loading && <div className="text-center my-5"><Spinner animation="border" variant="primary" /></div>}
      {error && <Alert variant="danger" style={{ fontFamily: 'sans-serif' }}>Error: {error}</Alert>}

      {!loading && !error && (
        <Card className="shadow border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <Card.Header className="bg-white border-bottom py-3 px-4">
            <h5 className="fw-bold m-0 text-primary" style={{ fontFamily: 'sans-serif' }}>
              <ClipboardCheck className="me-2" />
              {encuestas.length} Encuestas encontradas
            </h5>
          </Card.Header>
          <Card.Body className="p-0">
            {encuestas.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-muted" style={{ fontFamily: 'sans-serif' }}>
                  {isProfesor ? "No has creado ninguna encuesta." : "No hay encuestas para mostrar."}
                </p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {encuestas.map(enc => (
                  <div key={enc.id} className="list-group-item p-4 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div>
                      <h5 className="mb-1 fw-bold text-dark" style={{ fontFamily: 'sans-serif' }}>{enc.titulo}</h5>
                      <p className="text-muted small mb-1" style={{ fontFamily: 'sans-serif' }}>
                        Curso: <strong className="text-dark">{enc.nombre_curso}</strong> (ID: {enc.id_curso})
                      </p>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                      <Badge bg={enc.estado === 'publicada' ? 'success' : 'secondary'} className="px-3 py-2 rounded-pill" style={{ fontFamily: 'sans-serif' }}>
                        {enc.estado.toUpperCase()}
                      </Badge>

                      {/* --- LÓGICA DE ACCIÓN --- */}
                      {(isAdmin || isProfesor || isPsicologo) ? (
                        <Button
                          as={Link}
                          to={`/dashboard/encuestas/resultados/${enc.id}`}
                          variant="outline-primary"
                          size="sm"
                          className="fw-bold rounded-pill px-3"
                          style={{ fontFamily: 'sans-serif' }}
                        >
                          <EyeFill className="me-2" /> Ver Resultados
                        </Button>
                      ) : (
                        <Button
                          as={Link}
                          to={`/dashboard/encuestas/responder/${enc.id}`}
                          variant="success"
                          size="sm"
                          className="fw-bold rounded-pill px-3"
                          style={{ fontFamily: 'sans-serif' }}
                        >
                          Responder Encuesta
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}