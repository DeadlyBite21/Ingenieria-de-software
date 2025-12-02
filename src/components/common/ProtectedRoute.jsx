// src/components/common/ProtectedRoute.jsx
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.2rem'
      }}>
        Verificando autenticación...
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // --- CORRECCIÓN AQUÍ ---
  // Verificamos permisos soportando tanto un solo rol como un array de roles
  let tienePermiso = true;

  if (requiredRole !== null) {
    if (Array.isArray(requiredRole)) {
      // Si es un array (ej: [0, 1, 3]), verificamos si el rol del usuario está incluido
      tienePermiso = requiredRole.includes(user.rol);
    } else {
      // Si es un número único (ej: 0), verificamos igualdad estricta
      tienePermiso = user.rol === requiredRole;
    }
  }

  // Si no tiene permiso, mostramos la pantalla de Acceso Denegado
  if (!tienePermiso) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>
            🚫 Acceso Denegado
          </h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            No tienes permisos para acceder a esta sección.
          </p>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  // Si todo está bien, mostrar el contenido
  return children;
}