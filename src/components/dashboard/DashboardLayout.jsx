import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  BoxArrowRight,
  HouseDoor,
  ExclamationOctagon,
  ClipboardCheck,
  CalendarEvent,
  People,
  Grid1x2Fill,
  PersonCircle
} from 'react-bootstrap-icons';
import './DashboardLayout.css';

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const getRolText = () => {
    switch (user?.rol) {
      case 0: return 'Administrador';
      case 1: return 'Profesor';
      case 2: return 'Alumno';
      default: return 'Usuario';
    }
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">

        {/* 1. Header / Logo Cambiado */}
        <div className="sidebar-header">
          <Grid1x2Fill className="app-logo" />
          <span className="app-name">Convivio</span>
        </div>

        {/* (Buscador eliminado aquí) */}

        {/* 2. Menú de Navegación */}
        <div className="sidebar-menu">

          <Link to="/dashboard" className={`sidebar-link ${isActive('/dashboard')}`}>
            <HouseDoor className="link-icon" />
            <span>Inicio</span>
          </Link>

          {/* Gestión (Solo Admin) */}
          {user?.rol === 0 && (
            <>
              <div className="menu-label">Administración</div>
              <Link to="/dashboard/usuarios" className={`sidebar-link ${isActive('/dashboard/usuarios')}`}>
                <People className="link-icon" />
                <span>Usuarios</span>
              </Link>
            </>
          )}

          <div className="menu-label">Aplicaciones</div>

          <Link to="/dashboard/incidentes" className={`sidebar-link ${isActive('/dashboard/incidentes')}`}>
            <ExclamationOctagon className="link-icon" />
            <span>Incidentes</span>
          </Link>

          <Link to="/dashboard/encuestas" className={`sidebar-link ${isActive('/dashboard/encuestas')}`}>
            <ClipboardCheck className="link-icon" />
            <span>Encuestas</span>
          </Link>

          <Link to="/dashboard/citas" className={`sidebar-link ${isActive('/dashboard/citas')}`}>
            <CalendarEvent className="link-icon" />
            <span>Citas</span>
          </Link>
        </div>

        {/* 3. Tarjeta de Usuario */}
        <div className="user-profile-card">
          <div className="user-avatar">
            {user?.nombre?.charAt(0).toUpperCase() || <PersonCircle />}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.nombre}</p>
            <p className="user-role">{getRolText()}</p>
          </div>
          <div
            className="logout-btn-icon"
            onClick={handleLogout}
            title="Cerrar Sesión"
          >
            <BoxArrowRight size={20} />
          </div>
        </div>

      </nav>

      <main className="dashboard-content">
        {children}
      </main>
    </div>
  );
}