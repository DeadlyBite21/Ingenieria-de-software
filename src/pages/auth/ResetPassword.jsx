import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import InputGroup from 'react-bootstrap/InputGroup';
import { LockFill, ArrowLeft } from 'react-bootstrap-icons';
import './Login.css'; // Reutilizamos los estilos del Login

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // Añade la clase 'login-active' al body para el fondo
  useEffect(() => {
    document.body.classList.add('login-active');
    if (!token) {
      setError('Token no válido o expirado.');
    }
    return () => {
      document.body.classList.remove('login-active');
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Llamamos al NUEVO endpoint del backend
      const response = await apiFetch('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, nuevaContrasena: password }),
      });
      setSuccess(response.message || 'Contraseña actualizada con éxito.');
      setTimeout(() => navigate('/login'), 3000); // Redirige al login
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Container fluid className="login-container-page">
        <Card className="login-card-simple">
          <Card.Body>
            <Alert variant="danger" className="text-center">
              Token de recuperación inválido o no proporcionado.
            </Alert>
            <div className="text-center mt-4">
              <Link to="/login" className="custom-link-purple" style={{ fontSize: '0.9rem' }}>
                <ArrowLeft size={16} /> Volver a Inicio de Sesión
              </Link>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid className="login-container-page">
      <Card className="login-card-simple">
        <Card.Body>
          <div className="text-start mb-4">
            <h1 className="login-title">Restablecer Contraseña</h1>
            <p className="login-subtitle">Ingresa tu nueva contraseña.</p>
          </div>

          <Form onSubmit={handleSubmit} className="text-start">
            <Form.Group className="mb-3" controlId="formNewPassword">
              <Form.Label>Nueva Contraseña</Form.Label>
              <InputGroup>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || !!success}
                />
                <InputGroup.Text>
                  <LockFill className="text-muted" />
                </InputGroup.Text>
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formConfirmPassword">
              <Form.Label>Confirmar Contraseña</Form.Label>
              <InputGroup>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || !!success}
                />
                <InputGroup.Text>
                  <LockFill className="text-muted" />
                </InputGroup.Text>
              </InputGroup>
            </Form.Group>

            <div className="d-grid">
              <Button variant="light" type="submit" className="btn-custom-light" disabled={loading || !!success}>
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="ms-2">Actualizando...</span>
                  </>
                ) : (
                  "Actualizar Contraseña"
                )}
              </Button>
            </div>

            {error && <Alert variant="danger" className="mt-4 text-center">{error}</Alert>}
            {success && <Alert variant="success" className="mt-4 text-center">{success}</Alert>}
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}