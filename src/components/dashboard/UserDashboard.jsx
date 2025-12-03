import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Link } from 'react-router-dom';
import { Card, Spinner, Alert, Button } from 'react-bootstrap';
import { JournalBookmarkFill, CalendarEvent } from 'react-bootstrap-icons';

export default function UserDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursos, setCursos] = useState([]);

  useEffect(() => {
    // Si es psicólogo (Rol 3), NO debería estar viendo este dashboard de cursos,
    // pero por seguridad lo manejamos o dejamos que el router lo redirija.
    // Aquí cargamos solo cursos para Alumnos (2) y Profesores (1).
    if (user?.rol !== 3) {
      loadCursos();
    }
  }, [user]);

  const loadCursos = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/cursos');
      setCursos(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

  // Si por error entra un psicólogo aquí, le mostramos un botón para ir a su agenda
  if (user?.rol === 3) {
    return (
      <div className="text-center p-5">
        <h2>Vista de Cursos no disponible para Psicólogos</h2>
        <Link to="/dashboard/citas" className="btn btn-primary mt-3">Ir a mi Agenda</Link>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ fontFamily: 'sans-serif' }}>

      {/* 1. HEADER: Título limpio */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="fw-bold m-0" style={{ fontFamily: 'sans-serif', fontSize: '2.5rem', letterSpacing: '-1px' }}>
          MI DASHBOARD
        </h1>
        {/* Opcional: Mostrar el nombre discretamente a la derecha si quieres, o quitarlo del todo */}
        <span className="text-muted fw-bold" style={{ fontFamily: 'sans-serif' }}>
          {user?.nombre} ({user?.rol === 1 ? 'Profesor' : 'Alumno'})
        </span>
      </div>

      {/* 2. LÍNEA DIVISORIA NEGRA (Igual que en Citas/Incidentes) */}
      <hr style={{ borderTop: '4px solid black', opacity: 1, marginTop: '0', marginBottom: '2rem' }} />

      {error && <Alert variant="danger">Error: {error}</Alert>}

      {/* 3. GRID DE CURSOS (Solo Cursos) */}
      {cursos.length === 0 ? (
        <Alert variant="light" className="text-center py-5 shadow-sm border-0 rounded-3">
          <h4 className="fw-bold text-muted" style={{ fontFamily: 'sans-serif' }}>No tienes cursos asignados.</h4>
        </Alert>
      ) : (
        <div className="row g-4">
          {cursos.map((curso) => (
            <div key={curso.id} className="col-md-6 col-lg-4">
              <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px', transition: 'transform 0.2s' }}>
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3 text-primary">
                      <JournalBookmarkFill size={24} />
                    </div>
                    <h5 className="card-title fw-bold text-dark m-0" style={{ fontFamily: 'sans-serif' }}>
                      {curso.nombre}
                    </h5>
                  </div>

                  <div className="mt-auto">
                    <Link
                      to={`/dashboard/courses/${curso.id}`}
                      className="btn btn-outline-primary w-100 fw-bold rounded-pill"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      Ver Curso
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}