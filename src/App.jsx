import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
// import LoginForm from './components/LoginForm'; // <-- Ya no importamos esto aquí
import Login from './pages/Login'; // <--- IMPORTAMOS LA PÁGINA DE LOGIN
import DashboardRouter from './components/DashboardRouter';
import ProtectedRoute from './components/ProtectedRoute';

import DashboardLayout from "./components/DashboardLayout"; // Necesario para las rutas
import IncidentsPage from "./pages/IncidentsPage";
import IncidentCreatePage from "./pages/IncidentCreatePage";
import IncidentDetailPage from "./pages/IncidentDetailPage";

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

// NUEVO: Componente para rutas públicas
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
          
          {/* Dejamos la demo de Home en otra ruta por si la necesitas */}
          <Route path="/home-demo" element={<Home />} />
          
          {/* RUTAS PROTEGIDAS (sin cambios) 
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
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;