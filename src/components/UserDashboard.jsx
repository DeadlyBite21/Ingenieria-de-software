// src/components/UserDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { Link } from 'react-router-dom';

export default function UserDashboard() {
  const { user } = useAuth();
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCursos();
  }, []);

  const loadCursos = async () => {
    try {
      // Por ahora cargamos todos los cursos, pero esto debería filtrar según el usuario
      const cursosData = await apiFetch('/api/cursos');
      setCursos(cursosData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 16, color: 'red' }}>Error: {error}</div>;

  const getRolText = () => {
    switch (user?.rol) {
      case 1: return 'Profesor';
      case 2: return 'Alumno';
      default: return 'Usuario';
    }
  };

  const getRolColor = () => {
    switch (user?.rol) {
      case 1: return '#28a745'; // Verde para profesor
      case 2: return '#007bff'; // Azul para alumno
      default: return '#6c757d';
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1>Mi Dashboard</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: `3px solid ${getRolColor()}`
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: getRolColor(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}>
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#333' }}>¡Hola, {user?.nombre}!</h2>
            <p style={{ margin: 0, color: '#666' }}>
              <strong style={{ color: getRolColor() }}>{getRolText()}</strong> • RUT: {user?.rut}
            </p>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getRolColor() }}>
            {cursos.length}
          </div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>
            {user?.rol === 1 ? 'Cursos que enseñas' : 'Cursos disponibles'}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' }}>
            {user?.rol === 1 ? 'Prof' : 'Est'}
          </div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>
            Tu rol en el sistema
          </div>
        </div>
      </div>

      {/* Sección de Cursos */}
      <div>
        <h2 style={{ marginBottom: '1rem' }}>
          {user?.rol === 1 ? 'Mis Cursos' : 'Cursos Disponibles'}
        </h2>
        
        {cursos.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#666'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
            <h3>No hay cursos {user?.rol === 1 ? 'asignados' : 'disponibles'}</h3>
            <p>
              {user?.rol === 1 
                ? 'Contacta al administrador para que te asigne cursos.'
                : 'Contacta al administrador para inscribirte en cursos.'
              }
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {cursos.map((curso) => (
              <div key={curso.id} style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #e9ecef',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#333', fontSize: '1.2rem' }}>
                    {curso.nombre}
                  </h3>
                  <span style={{
                    backgroundColor: getRolColor(),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    ID: {curso.id}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
                  {user?.rol === 1 
                    ? 'Gestiona este curso y sus estudiantes'
                    : 'Accede al contenido y actividades del curso'
                  }
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link 
                    to={`/dashboard/courses/${curso.id}`} 
                    style={{
                      backgroundColor: getRolColor(),
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    {user?.rol === 1 ? 'Gestionar →' : 'Ver curso →'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acciones rápidas según el rol */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Acciones Rápidas</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user?.rol === 1 ? (
            <>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                📝 Crear Actividad
              </button>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                👥 Ver Estudiantes
              </button>
            </>
          ) : (
            <>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                📖 Mis Tareas
              </button>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                📊 Mis Calificaciones
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}