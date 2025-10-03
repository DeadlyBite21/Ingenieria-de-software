import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../backend/api";

export default function CoursesPage() {
  const [me, setMe] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const profile = await apiFetch("/api/me");
        setMe(profile);
        const list = await apiFetch("/api/courses");
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

  const rolLabel = me?.rol === 0 ? "Administrador" : me?.rol === 1 ? "Profesor" : "Alumno";

  return (
    <div style={{ padding: 24 }}>
      <h1>Menú principal</h1>
      <p>
        Bienvenido <strong>{me?.nombre}</strong> — Rol: <em>{rolLabel}</em>
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
                <Link to={`/courses/${c.id}`} style={{ textDecoration: "none" }}>
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
