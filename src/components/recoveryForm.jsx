import { useState } from "react";
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { EnvelopeFill } from 'react-bootstrap-icons';

function RecoveryForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/recover-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el correo");
      setMsg({ type: "success", text: data.message || "Correo enviado correctamente" });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="text-start">
      <Form.Group className="mb-3" controlId="formBasicEmail">
        <Form.Label>Correo electrónico</Form.Label>
        <div className="input-group">
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="ejemplo@correo.com"
          />
          <span className="input-group-text">
            <EnvelopeFill className="text-muted" />
          </span>
        </div>
      </Form.Group>
      <div className="d-grid mb-3">
        <Button variant="light" type="submit" className="btn-custom-light" disabled={loading}>
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              <span className="ms-2">Enviando...</span>
            </>
          ) : (
            "Enviar instrucciones"
          )}
        </Button>
      </div>
      {msg && (
        <Alert variant={msg.type === "success" ? "success" : "danger"} className="mt-3 text-center">
          {msg.text}
        </Alert>
      )}
    </Form>
  );
}

export default RecoveryForm;
