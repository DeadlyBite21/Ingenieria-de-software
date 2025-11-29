import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import InputGroup from 'react-bootstrap/InputGroup';
import { EnvelopeFill, ArrowLeft } from 'react-bootstrap-icons';
import './Login.css'; // Reutilizamos los estilos del Login

export default function RecoverPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Añade la clase 'login-active' al body para el fondo
  useEffect(() => {
    document.body.classList.add('login-active');
    return () => {
      document.body.classList.remove('login-active');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Usamos apiFetch para llamar al endpoint del backend
      const response = await apiFetch('/api/recover-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccess(response.message || 'Se ha enviado un correo con instrucciones.');
    } catch (err) {
      setError(err.message || 'Error al enviar el correo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="login-container-page">
      <Card className="login-card-simple">
        <Card.Body>
          <div className="text-start mb-4">
            <h1 className="login-title">Recuperar Contraseña</h1>
            <p className="login-subtitle">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          <Form onSubmit={handleSubmit} className="text-start">
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Correo Electrónico</Form.Label>
              <InputGroup>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  disabled={loading}
                />
                <InputGroup.Text>
                  <EnvelopeFill className="text-muted" />
                </InputGroup.Text>
              </InputGroup>
            </Form.Group>

            <div className="d-grid">
              <Button variant="light" type="submit" className="btn-custom-light" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    <span className="ms-2">Enviando...</span>
                  </>
                ) : (
                  "Enviar Enlace"
                )}
              </Button>
            </div>

            {error && <Alert variant="danger" className="mt-4 text-center">{error}</Alert>}
            {success && <Alert variant="success" className="mt-4 text-center">{success}</Alert>}

            <div className="text-center mt-4">
              <Link to="/login" className="custom-link-purple" style={{ fontSize: '0.9rem' }}>
                <ArrowLeft size={16} /> Volver a Inicio de Sesión
              </Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}