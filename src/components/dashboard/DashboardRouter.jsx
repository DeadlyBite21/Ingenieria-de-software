// src/components/DashboardRouter.jsx
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import PsychologistDashboard from './PsychologistDashboard'; // Nuevo dashboard
import DashboardLayout from './DashboardLayout';

export default function DashboardRouter() {
  const { user } = useAuth();

  // 1. Admin (Rol 0)
  if (user?.rol === 0) {
    return (
      <DashboardLayout>
        <AdminDashboard />
      </DashboardLayout>
    );
  }

  // 2. Psicólogo (Rol 3)
  if (user?.rol === 3) {
    return (
      <DashboardLayout>
        <PsychologistDashboard />
      </DashboardLayout>
    );
  }

  // 3. Profesores (Rol 1) y Alumnos (Rol 2)
  return (
    <DashboardLayout>
      <UserDashboard />
    </DashboardLayout>
  );
}