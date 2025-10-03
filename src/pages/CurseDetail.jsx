import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../backend/api";

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch(`/api/courses/${id}`);
        setCourse(c);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (err) return <div style={{ padding: 16, color: "tomato" }}>{err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <Link to="/">← Volver</Link>
      <h2>{course.nombre}</h2>
      <p>ID del curso: {course.id}</p>
    </div>
  );
}
