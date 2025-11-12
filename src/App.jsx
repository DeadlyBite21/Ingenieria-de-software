// src/App.jsx
import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import DashboardRouter from './components/DashboardRouter';
import ProtectedRoute from './components/ProtectedRoute';

import DashboardLayout from "./components/DashboardLayout";
import IncidentsPage from "./pages/IncidentsPage";
import IncidentCreatePage from "./pages/IncidentCreatePage";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import RecoverPassword from './pages/RecoverPassword';
import ResetPassword from './pages/ResetPassword';
import EncuestasListPage from "./pages/EncuestasListPage";
import CrearEncuestaPage from "./pages/CrearEncuestaPage";

// --- IMPORTAMOS LA NUEVA PÁGINA ---
import GestionUsuariosPage from "./pages/GestionUsuariosPage";


function Home() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  return (
    <>
      <div>{/* ... */}</div>
      <h1>Vite + React</h1>
      {/* ... */}
    </>
  );
}

function PublicRoute({ children }) {
    const { user } = useAuth();
    return user ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* RUTA PRINCIPAL */}
          <Route path="/" element={<Navigate to="/login" />} />
          
          {/* RUTA DE LOGIN */}
          <Route 
            path="/login" 
            element={<PublicRoute><Login /></PublicRoute>} 
          />
          
          {/* RUTAS DE RECUPERACIÓN */}
          <Route 
            path="/recover-password" 
            element={<PublicRoute><RecoverPassword /></PublicRoute>} 
          />
          <Route 
            path="/reset-password" 
            element={<PublicRoute><ResetPassword /></PublicRoute>} 
          />
          
          {/* Demo de Home */}
          <Route path="/home-demo" element={<Home />} />
          
          {/* RUTAS PROTEGIDAS */}
          
          {/* Dashboard Principal (Router) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } 
          />
          
          {/* --- RUTA AÑADIDA PARA GESTIÓN DE USUARIOS (SOLO ADMIN) --- */}
          <Route 
            path="/dashboard/gestion-usuarios" 
            element={
              // Usamos requiredRole={0} para bloquear a no-admins
              <ProtectedRoute requiredRole={0}>
                <DashboardLayout>
                  <GestionUsuariosPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />
          {/* --- FIN DE RUTA AÑADIDA --- */}

          {/* Detalle de Curso (Genérico) */}
          <Route 
            path="/dashboard/courses/:id" 
            element={
              <ProtectedRoute>
                {/* Este layout simple es temporal, puedes mejorarlo si quieres */}
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <h2>Detalle del Curso</h2>
                  <p>Esta página estará disponible próximamente...</p>
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
              </ProtectedRoute>
            } 
          />
          
          {/* Incidentes (Lista) */}
          <Route 
            path="/dashboard/incidentes" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <IncidentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />
          
          {/* Incidentes (Crear) */}
          <Route 
            path="/dashboard/incidentes/crear" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <IncidentCreatePage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          {/* Incidentes (Editar) */}
          <Route 
            path="/dashboard/incidentes/editar/:id" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <IncidentCreatePage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          {/* Incidentes (Detalle) */}
          <Route 
            path="/dashboard/incidentes/:id" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <IncidentDetailPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          {/* Encuestas (Lista) */}
          <Route 
            path="/dashboard/encuestas" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EncuestasListPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          {/* Encuestas (Crear) */}
          <Route 
            path="/dashboard/encuestas/crear" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CrearEncuestaPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;