import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

// --- Importaciones de React Bootstrap ---
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

// --- Importaciones de Iconos ---
import { HouseDoorFill, PersonVcard, LockFill } from 'react-bootstrap-icons';

function LoginForm() {
  const [identificador, setIdentificador] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Función auxiliar para validar formato de email
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // --- NUEVA VALIDACIÓN ---
    // Si el identificador contiene '@', asumimos que es un correo y lo validamos
    if (identificador.includes('@')) {
      if (!isValidEmail(identificador)) {
        setError("Por favor, ingresa un formato de correo válido (ej: usuario@dominio.com).");
        return;
      }
    }
    // ------------------------

    setLoading(true);
    try {
      await login(identificador, contrasena);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      // Mensaje de error genérico para seguridad
      setError("RUT o Contraseña incorrecta, por favor inténtalo de nuevo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="login-card-simple">
      <Card.Body>

        {/* CAMBIO DE VISUAL:
           Cambiamos 'text-start' por 'text-center' para centrar
           icono, título y subtítulo.
        */}
        <div className="text-center mb-4">
          <HouseDoorFill className="login-icon" />
          <h1 className="login-title">Bienvenido/a</h1>
          <p className="login-subtitle">Por favor ingresa tus datos.</p>
        </div>

        <Form onSubmit={handleSubmit} className="text-start">

          {/* Campo RUT / Correo */}
          <Form.Group className="mb-3" controlId="formBasicRut">
            <Form.Label>RUT o Correo</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
                disabled={loading}
                placeholder="ej: 12345678-9 o correo@escuela.cl"
              />
              <InputGroup.Text>
                <PersonVcard className="text-muted" />
              </InputGroup.Text>
            </InputGroup>
          </Form.Group>

          {/* Campo Contraseña */}
          <Form.Group className="mb-3" controlId="formBasicPassword">
            <Form.Label>Contraseña</Form.Label>
            <InputGroup>
              <Form.Control
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                disabled={loading}
              />
              <InputGroup.Text>
                <LockFill className="text-muted" />
              </InputGroup.Text>
            </InputGroup>
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-4">
            <a href="/recover-password" className="custom-link-purple">¿Olvidaste la contraseña?</a>
          </div>

          <div className="d-grid">
            <Button variant="light" type="submit" className="btn-custom-light" disabled={loading}>
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  <span className="ms-2">Ingresando...</span>
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </div>

          {error && <Alert variant="danger" className="mt-4 text-center">{error}</Alert>}

        </Form>
      </Card.Body>
    </Card>
  );
}

export default LoginForm;