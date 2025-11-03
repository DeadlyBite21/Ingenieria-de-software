import { useState } from "react";
import { useAuth } from "../context/AuthContext";
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
  // --- Tu lógica existente (no se toca) ---
  const [rut, setRut] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(rut, contrasena);
      navigate("/dashboard");
    } catch (err) {
      
      // --- ¡ESTE ES EL CAMBIO! ---
      // En lugar de mostrar el error del servidor (err.message),
      // mostramos el mensaje genérico que solicitaste.
      setError("RUT o Contraseña incorrecta, por favor inténtalo de nuevo");
      
    } finally {
      setLoading(false);
    }
  };
  // --- Fin de la lógica ---

  return (
    // Card simple y centrada (usa la clase de Login.css)
    <Card className="login-card-simple">
      <Card.Body>
        
        {/* Icono y Título */}
        <div className="text-start mb-4">
          <HouseDoorFill className="login-icon" />
          <h1 className="login-title">Bienvenido/a</h1>
          <p className="login-subtitle">Por favor ingresa tus datos.</p>
        </div>

        {/* Formulario */}
        <Form onSubmit={handleSubmit} className="text-start">

          {/* Campo RUT */}
          <Form.Group className="mb-3" controlId="formBasicRut">
            <Form.Label>RUT</Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                required
                disabled={loading}
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

          {/* Opciones (Remember me / Forgot password) */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <Form.Check 
              type="checkbox"
              id="rememberCheck"
              label="Remember for 30 days"
              disabled={loading}
              className="form-check-label"
            />
            <link to="/recover-password" className="custom-link-purple">Forgot password?</link>
          </div>

          {/* Botón Login */}
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

          {/* Mensaje de Error (ahora mostrará tu nuevo mensaje) */}
          {error && <Alert variant="danger" className="mt-4 text-center">{error}</Alert>}

        </Form>
      </Card.Body>
    </Card>
  );
}

export default LoginForm;