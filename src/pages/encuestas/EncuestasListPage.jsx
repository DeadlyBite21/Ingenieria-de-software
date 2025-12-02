// src/pages/EncuestasListPage.jsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import { PlusCircleFill, EyeFill } from 'react-bootstrap-icons';

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
      // Este es el endpoint que creamos en api.js
      const data = await apiFetch('/api/encuestas');
      setEncuestas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Gestión de Encuestas</h1>
        {(isAdmin || isProfesor) && (
          <Button as={Link} to="/dashboard/encuestas/crear" variant="primary">
            <PlusCircleFill className="me-2" />
            Crear Encuesta
          </Button>
        )}
      </div>

      {loading && <div className="text-center my-5"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">Error: {error}</Alert>}

      {!loading && !error && (
        <Card>
          <Card.Header>{encuestas.length} Encuestas encontradas</Card.Header>
          <Card.Body>
            {encuestas.length === 0 ? (
              <p className="text-muted text-center">
                {isProfesor ? "No has creado ninguna encuesta." : "No hay encuestas para mostrar."}
              </p>
            ) : (
              encuestas.map(enc => (
                  <div key={enc.id} className="d-flex justify-content-between align-items-center p-3 border rounded mb-2">
                      <div>
                          <h5 className="mb-0">{enc.titulo}</h5>
                          <small className="text-muted">
                              Curso: {enc.nombre_curso} (ID: {enc.id_curso})
                          </small>
                      </div>
                      <div>
                          <Badge bg={enc.estado === 'publicada' ? 'success' : 'secondary'} className="me-3">
                              {enc.estado}
                          </Badge>
                          
                          {/* --- LÓGICA DE ACCIÓN: PROFESOR VE RESULTADOS, ALUMNO RESPONDE --- */}
                          {(isAdmin || isProfesor || isPsicologo) ? (
                              // Profesor/Admin: Ver resultados
                              <Button 
                                  as={Link} // Cambiar a Link
                                  to={`/dashboard/encuestas/resultados/${enc.id}`} // NUEVA RUTA
                                  variant="outline-info" 
                                  size="sm" 
                                  className="ms-3"
                              >
                                  <EyeFill className="me-1" /> Ver Resultados
                              </Button>
                          ) : (
                              // Alumno: Responder
                              <Button as={Link} to={`/dashboard/encuestas/responder/${enc.id}`} variant="success" size="sm" className="ms-3">
                                  Responder Encuesta
                              </Button>
                          )}  
                      </div>
                  </div>
              ))
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}