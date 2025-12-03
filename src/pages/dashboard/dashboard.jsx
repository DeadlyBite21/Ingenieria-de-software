import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await apiFetch("/api/cursos");
        setCourses(list);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (err) return <div style={{ padding: 16, color: "tomato" }}>{err}</div>;

  const rolLabel =
    user?.rol === 0 ? "Administrador" :
    user?.rol === 1 ? "Profesor" :
    user?.rol === 3 ? "Psicólogo" :
    "Desconocido";


  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Dashboard</h1>
        <button onClick={logout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Cerrar Sesión
        </button>
      </div>
      <p>
        Hola <strong>{user?.nombre}</strong> — Rol: <em>{rolLabel}</em>
      </p>

      {courses.length === 0 ? (
        <p>No tienes cursos asignados.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {courses.map((c) => (
            <li key={c.id} style={{ border: "1px solid #444", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{c.nombre}</strong>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {c.id}</div>
                </div>
                <Link to={`/dashboard/courses/${c.id}`} style={{ textDecoration: "none" }}>
                  Ver curso →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
