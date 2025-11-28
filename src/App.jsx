import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login'; // Importamos la página de Login
import DashboardRouter from './components/DashboardRouter';
import ProtectedRoute from './components/ProtectedRoute';

import DashboardLayout from "./components/DashboardLayout"; // Necesario para las rutas
import IncidentsPage from "./pages/IncidentsPage";
import IncidentCreatePage from "./pages/IncidentCreatePage";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import RecoverPassword from './pages/RecoverPassword';
import ResetPassword from './pages/ResetPassword';
import EncuestasListPage from "./pages/EncuestasListPage";
import CrearEncuestaPage from "./pages/CrearEncuestaPage";
import CitasListPage from "./pages/CitasListPage";
import CitasCreatePage from "./pages/CitasCreatePage";
import CitasDetailPage from "./pages/CitasDetailPage";
import ResponderEncuestaPage from "./pages/ResponderEncuestaPage";
import ResultadosEncuestaPage from "./pages/ResultadosEncuestaPage";

// El componente Home (demo de Vite) sigue igual
function Home() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        {/* ... (Tu código de Home existente) ... */}
      </div>
      <h1>Vite + React</h1>
      {/* ... (Tu código de Home existente) ... */}
    </>
  );
}

// Componente para rutas públicas
// Si el usuario ya está logueado, lo redirige al dashboard
function PublicRoute({ children }) {
    const { user } = useAuth();
    return user ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* RUTA PRINCIPAL: 
            Redirige automáticamente a /login 
          */}
          <Route path="/" element={<Navigate to="/login" />} />
          
          {/* RUTA DE LOGIN: 
            Usa la nueva página de Login y la protege con PublicRoute 
          */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          {/* --- RUTAS DE RECUPERACIÓN AÑADIDAS --- */}
          <Route 
            path="/recover-password" 
            element={
              <PublicRoute>
                <RecoverPassword />
              </PublicRoute>
            } 
          />
          <Route 
            path="/reset-password" 
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            } 
          />
          {/* --- FIN DE RUTAS AÑADIDAS --- */}
          
          {/* Dejamos la demo de Home en otra ruta por si la necesitas */}
          <Route path="/home-demo" element={<Home />} />
          
          {/* RUTAS PROTEGIDAS 
          */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/courses/:id" 
            element={
              <ProtectedRoute>
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
                    ← Volver al Dashboard
                  </button>
                </div>
              </ProtectedRoute>
            } 
          />
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
          
          {/* Crear Incidente */}
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

          {/* Editar Incidente */}
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

          {/* Detalle de Incidente */}
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

          <Route 
            path="/dashboard/encuestas/responder/:id" 
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ResponderEncuestaPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/dashboard/encuestas/resultados/:id" 
            element={
              <ProtectedRoute requiredRole={[0, 1]}> {/* Solo Admin (0) y Profesor (1) */}
                <DashboardLayout>
                  <ResultadosEncuestaPage />
                </DashboardLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/dashboard/citas" 
            element={
              <ProtectedRoute>
                <DashboardLayout><CitasListPage /></DashboardLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/citas/crear" 
            element={
              <ProtectedRoute>
                <DashboardLayout><CitasCreatePage /></DashboardLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/citas/:id" 
            element={
              <ProtectedRoute>
                <DashboardLayout><CitasDetailPage /></DashboardLayout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;