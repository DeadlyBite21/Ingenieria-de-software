import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import { BoxArrowRight, HouseDoorFill, ExclamationOctagonFill, ClipboardCheck } from 'react-bootstrap-icons';
import './DashboardLayout.css'; // Importamos los nuevos estilos

// Este componente "envolverá" a tus dashboards (Admin y User)
export default function DashboardLayout({ children }) {
  // Obtenemos el usuario y la función logout del contexto
  const { user, logout, isAdmin, isProfesor } = useAuth();
  const navigate = useNavigate();

  // Hook para añadir la clase al body y poner el fondo claro
  useEffect(() => {
    document.body.classList.add('dashboard-active');
    // Función de limpieza para cuando salgamos del dashboard
    return () => {
      document.body.classList.remove('dashboard-active');
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login'); // Redirigimos al login
  };

  // Función para obtener el texto del rol
  const getRolText = () => {
    switch (user?.rol) {
      case 0: return 'Administrador';
      case 1: return 'Profesor';
      case 2: return 'Alumno';
      default: return 'Usuario';
    }
  };

  return (
    <div className="dashboard-layout">
      {/* --- Menú Lateral (Sidebar) --- */}
      <nav className="sidebar">
        
        {/* 1. Perfil de Usuario (Nombre y Rol) */}
        <div className="sidebar-profile">
          <h2 className="profile-name">{user?.nombre}</h2>
          <p className="profile-role">{getRolText()}</p>
        </div>

        {/* 2. Menú (Aquí pondrás más botones en el futuro) */}
        <div className="sidebar-menu">
          <Link 
            to="/dashboard" 
            className="btn btn-link text-start text-white text-decoration-none d-flex align-items-center mb-1"
          >
            <HouseDoorFill className="me-2" /> Inicio
          </Link>
          <Link 
            to="/dashboard/incidentes" 
            className="btn btn-link text-start text-white text-decoration-none d-flex align-items-center"
          >
            <ExclamationOctagonFill className="me-2" /> Incidentes
          </Link>
          <Link 
              to="/dashboard/encuestas" 
              className="btn btn-link text-start text-white text-decoration-none d-flex align-items-center"
            >
              <ClipboardCheck className="me-2" /> Encuestas
            </Link>
        </div>

        {/* 3. Botón de Cerrar Sesión (al final) */}
        <div className="sidebar-logout">
          <Button 
            variant="danger" 
            className="btn-logout d-flex align-items-center justify-content-center"
            onClick={handleLogout}
          >
            <BoxArrowRight size={20} className="me-2" />
            Cerrar Sesión
          </Button>
        </div>
      </nav>

      {/* --- Contenido Principal --- */}
      <main className="dashboard-content">
        {/* Aquí se renderiza el componente hijo (AdminDashboard o UserDashboard) */}
        {children} 
      </main>
    </div>
  );
}