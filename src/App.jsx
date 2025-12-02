import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import DashboardRouter from './components/dashboard/DashboardRouter';
import ProtectedRoute from './components/common/ProtectedRoute';

// --- NUEVO IMPORT ---
import LandingPage from './pages/LandingPage'; 

import DashboardLayout from "./components/dashboard/DashboardLayout";
import IncidentsPage from "./pages/incidents/IncidentsPage";
import IncidentCreatePage from "./pages/incidents/IncidentCreatePage";
import IncidentDetailPage from "./pages/incidents/IncidentDetailPage";
import RecoverPassword from './pages/auth/RecoverPassword';
import ResetPassword from './pages/auth/ResetPassword';
import EncuestasListPage from "./pages/encuestas/EncuestasListPage";
import CrearEncuestaPage from "./pages/encuestas/CrearEncuestaPage";
import CitasListPage from "./pages/citas/CitasListPage";
import CitasCreatePage from "./pages/citas/CitasCreatePage";
import CitasDetailPage from "./pages/citas/CitasDetailPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import ResponderEncuestaPage from "./pages/ResponderEncuestaPage";
import ResultadosEncuestaPage from "./pages/ResultadosEncuestaPage";

// El componente Home (demo de Vite) sigue igual
function Home() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
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
              Muestra la Landing Page. 
              Usamos PublicRoute para que si ya está logueado, vaya al Dashboard.
          */}
          <Route 
            path="/" 
            element={
              <PublicRoute>
                <LandingPage />
              </PublicRoute>
            } 
          />

          {/* RUTA DE LOGIN */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* --- RUTAS DE RECUPERACIÓN --- */}
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

          {/* Dejamos la demo de Home en otra ruta por si la necesitas */}
          <Route path="/home-demo" element={<Home />} />

          {/* RUTAS PROTEGIDAS */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          {/* GESTIÓN DE USUARIOS (Solo Admin) */}
          <Route
            path="/dashboard/usuarios"
            element={
              <ProtectedRoute requiredRole={0}>
                <DashboardLayout>
                  <UserManagementPage />
                </DashboardLayout>
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
          
          {/* INCIDENTES */}
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

          {/* ENCUESTAS */}
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

          {/* CITAS */}
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