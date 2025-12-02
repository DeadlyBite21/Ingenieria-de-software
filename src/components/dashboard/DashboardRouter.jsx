// src/components/dashboard/DashboardRouter.jsx
import { useAuth } from '../../context/AuthContext'; // <--- CORRECCIÓN: ../../
import AdminDashboard from './AdminDashboard';
import UserDashboard from './UserDashboard';
import PsychologistDashboard from './PsychologistDashboard'; // Asegúrate de tener este archivo en la misma carpeta
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

  // 3. Profesor (1) y Alumno (2)
  return (
    <DashboardLayout>
      <UserDashboard />
    </DashboardLayout>
  );
}