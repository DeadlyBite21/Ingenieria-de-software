// src/components/DashboardRouter.jsx
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import DashboardLayout from './DashboardLayout'; // <-- 1. Importa el nuevo layout

export default function DashboardRouter() {
  const { user } = useAuth();

  // 2. Envuelve el dashboard correspondiente con el Layout
  if (user?.rol === 0) {
    return (
      <DashboardLayout>
        <AdminDashboard /> 
      </DashboardLayout>
    );
  }

  // Para profesores (rol 1) y alumnos (rol 2)
  return (
    <DashboardLayout>
      <UserDashboard />
    </DashboardLayout>
  );
}