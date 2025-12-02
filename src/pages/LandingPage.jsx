// src/pages/LandingPage.jsx
import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';

// Iconos
import { 
  ShieldCheck, 
  ExclamationOctagonFill, 
  CalendarHeartFill, 
  ClipboardDataFill, 
  BoxArrowInRight 
} from 'react-bootstrap-icons';

import './LandingPage.css';

export default function LandingPage() {
  return (
    <>
      {/* --- NAVBAR --- */}
      <Navbar className="landing-navbar" expand="lg" variant="dark">
        <Container>
          <Navbar.Brand as={Link} to="/" className="brand-logo">
            <ShieldCheck size={30} /> Convivio
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

      {/* --- HERO SECTION --- */}
      <section className="hero-section d-flex align-items-center">
        <Container>
          <Row className="align-items-center">
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
            <Col lg={5} className="d-none d-lg-block text-center">
              {/* Aquí podrías poner una imagen/vector SVG de una escuela o estudiantes */}
              <div style={{ fontSize: '15rem', opacity: 0.8 }}>🏫</div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section className="features-section">
        <Container>
          <div className="text-center mb-5">
            <h2 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>Nuestras Soluciones</h2>
            <p className="text-muted">Herramientas diseñadas para el bienestar de la comunidad educativa.</p>
          </div>

          <Row className="g-4">
            {/* Feature 1: Incidentes */}
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-incident">
                  <ExclamationOctagonFill />
                </div>
                <Card.Title className="fw-bold">Reporte de Incidentes</Card.Title>
                <Card.Text className="text-muted">
                  Sistema seguro para reportar y gestionar incidentes académicos o de conducta, permitiendo un seguimiento transparente por parte de los encargados.
                </Card.Text>
              </Card>
            </Col>

            {/* Feature 2: Citas */}
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-dates">
                  <CalendarHeartFill />
                </div>
                <Card.Title className="fw-bold">Apoyo Psicológico</Card.Title>
                <Card.Text className="text-muted">
                  Agenda digital integrada para que los estudiantes soliciten horas con el equipo de psicología y orientación de manera privada y sencilla.
                </Card.Text>
              </Card>
            </Col>

            {/* Feature 3: Encuestas */}
            <Col md={4}>
              <Card className="feature-card shadow-sm">
                <div className="feature-icon-wrapper icon-surveys">
                  <ClipboardDataFill />
                </div>
                <Card.Title className="fw-bold">Encuestas y Feedback</Card.Title>
                <Card.Text className="text-muted">
                  Herramientas para recolectar la opinión de la comunidad mediante encuestas dinámicas creadas por profesores y administradores.
                </Card.Text>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* --- FOOTER --- */}
      <footer className="landing-footer">
        <Container>
          <p className="mb-0">© 2024 Convivio. Todos los derechos reservados.</p>
          <small>Desarrollado para Ingeniería de Software</small>
        </Container>
      </footer>
    </>
  );
}