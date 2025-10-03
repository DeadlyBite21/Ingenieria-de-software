// src/components/DashboardRouter.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';

export default function DashboardRouter() {
  const { user } = useAuth();

  // Si es administrador (rol 0), mostrar AdminDashboard
  if (user?.rol === 0) {
    return <AdminDashboard />;
  }

  // Para profesores (rol 1) y alumnos (rol 2), mostrar UserDashboard
  return <UserDashboard />;
}