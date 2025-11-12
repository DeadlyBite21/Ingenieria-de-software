import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, NavLink } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import { 
  BoxArrowRight, 
  HouseDoorFill, 
  ExclamationOctagonFill, 
  ClipboardCheck,
  PeopleFill,
  BoxFill // Icono para el "logo"
} from 'react-bootstrap-icons';
import './DashboardLayout.css'; // Importamos los estilos actualizados

export default function DashboardLayout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('dashboard-active');
    return () => {
      document.body.classList.remove('dashboard-active');
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRolText = (rol) => {
    switch (rol) {
      case 0: return 'Administrador';
      case 1: return 'Profesor';
      case 2: return 'Alumno';
      default: return 'Usuario';
    }
  };

  // Genera un avatar con las iniciales
  const getAvatar = () => {
    return user?.nombre?.charAt(0).toUpperCase() || '?';
  };

  return (
    <div className="dashboard-layout">
      {/* --- Menú Lateral (Sidebar) --- */}
      <nav className="sidebar">
        
        {/* 1. Logo/Título Superior */}
        <div className="sidebar-logo">
          <BoxFill size={30} className="me-2" />
          <span>Mi Plataforma</span>
        </div>

        {/* 2. Menú de Navegación */}
        <div className="sidebar-menu">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => "sidebar-nav-link" + (isActive ? " active" : "")}
            end // 'end' asegura que solo esté activo en /dashboard exacto
          >
            <HouseDoorFill size={20} />
            <span>Inicio</span>
          </NavLink>
          
          <NavLink 
            to="/dashboard/incidentes" 
            className={({ isActive }) => "sidebar-nav-link" + (isActive ? " active" : "")}
          >
            <ExclamationOctagonFill size={20} />
            <span>Incidentes</span>
          </NavLink>
          
          <NavLink 
            to="/dashboard/encuestas" 
            className={({ isActive }) => "sidebar-nav-link" + (isActive ? " active" : "")}
          >
            <ClipboardCheck size={20} />
            <span>Encuestas</span>
          </NavLink>

          {/* --- ENLACE SOLO PARA ADMIN --- */}
          {isAdmin && (
            <NavLink 
              to="/dashboard/gestion-usuarios" 
              className={({ isActive }) => "sidebar-nav-link" + (isActive ? " active" : "")}
            >
              <PeopleFill size={20} />
              <span>Gestión Usuarios</span>
            </NavLink>
          )}
        </div>

        {/* 3. Footer del Sidebar (Perfil y Logout) */}
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="profile-avatar">
              {getAvatar()}
            </div>
            <div className="profile-info">
              <div className="profile-name">{user?.nombre}</div>
              <div className="profile-email">{user?.correo}</div>
            </div>
          </div>
          
          <div className="sidebar-logout">
            <Button 
              variant="danger" 
              className="btn-logout"
              onClick={handleLogout}
            >
              <BoxArrowRight size={20} className="me-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </nav>

      {/* --- Contenido Principal --- */}
      <main className="dashboard-content">
        {children} 
      </main>
    </div>
  );
}