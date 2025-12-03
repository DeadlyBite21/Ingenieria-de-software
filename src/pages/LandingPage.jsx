import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';

import { 
  ExclamationOctagonFill, 
  CalendarHeartFill, 
  ClipboardDataFill, 
  BoxArrowInRight 
} from 'react-bootstrap-icons';

// IMPORTANTE: Ajusta esta ruta según donde creaste realmente el Logo
// Opción A: Si está en src/components/Logo.jsx
import Logo from '../components/Logo';
// Opción B: Si está en src/components/common/Logo.jsx
// import Logo from '../components/common/Logo';

import './LandingPage.css';

export default function LandingPage() {
  return (
    <>
      <Navbar className="landing-navbar" expand="lg" variant="dark">
        <Container>
          <Navbar.Brand as={Link} to="/" className="brand-logo">
            <Logo size={45} /> 
            <span className="ms-2">Convivio</span>
          </Navbar.Brand>
          <Nav className="ms-auto">
            <Button 
              as={Link} 
              to="/login" 
              variant="outline-light" 
              className="px-4 fw-bold rounded-pill"
            >
              Iniciar Sesión <BoxArrowInRight className="ms-2" />
            </Button>
          </Nav>
        </Container>
      </Navbar>

      <section className="hero-section">
        <Container>
          <Row className="align-items-center" style={{ minHeight: '80vh' }}>
            <Col lg={7}>
              <h1 className="hero-title">
                Gestión Escolar y Convivencia en un solo lugar
              </h1>
              <p className="hero-subtitle">
                Convivio conecta a estudiantes, profesores y administradores para crear un ambiente educativo seguro, organizado y participativo.
              </p>
              <div className="d-flex gap-3">
                <Button 
                  as={Link} 
                  to="/login" 
                  variant="primary" 
                  size="lg" 
                  className="px-5 rounded-pill fw-bold shadow"
                >
                  Ingresar a la Plataforma
                </Button>
              </div>
            </Col>
            <Col lg={5} className="d-none d-lg-flex justify-content-center">
              <div style={{ fontSize: '10rem', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.3))' }}>
                🏫
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="features-section">
        <Container>
          <div className="text-center mb-5">
            <h2 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>Nuestras Soluciones</h2>
            <p className="text-muted">Herramientas diseñadas para el bienestar de la comunidad educativa.</p>
          </div>

          <Row className="g-4">
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-incident">
                  <ExclamationOctagonFill />
                </div>
                <Card.Title className="fw-bold">Reporte de Incidentes</Card.Title>
                <Card.Text className="text-muted">
                  Sistema seguro para reportar y gestionar incidentes académicos o de conducta.
                </Card.Text>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-dates">
                  <CalendarHeartFill />
                </div>
                <Card.Title className="fw-bold">Apoyo Psicológico</Card.Title>
                <Card.Text className="text-muted">
                  Agenda digital integrada para solicitar horas con psicología de manera privada.
                </Card.Text>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-surveys">
                  <ClipboardDataFill />
                </div>
                <Card.Title className="fw-bold">Encuestas y Feedback</Card.Title>
                <Card.Text className="text-muted">
                  Herramientas para recolectar la opinión de la comunidad mediante encuestas.
                </Card.Text>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <footer className="landing-footer">
        <Container>
          <p className="mb-0">© 2024 Convivio. Todos los derechos reservados.</p>
        </Container>
      </footer>
    </>
  );
}