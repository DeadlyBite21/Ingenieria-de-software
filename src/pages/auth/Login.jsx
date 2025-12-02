import { useEffect } from 'react';
import LoginForm from "../../components/auth/LoginForm";
import Container from 'react-bootstrap/Container';
import './Login.css'; // <--- Importante que importe el CSS

function Login() {

  // Este hook añade la clase al body
  useEffect(() => {
    document.body.classList.add('login-active');

    // Función de limpieza para quitar la clase
    return () => {
      document.body.classList.remove('login-active');
    };
  }, []); // El array vacío asegura que solo se ejecute una vez

  return (
    // El container centrará el LoginForm
    <Container fluid className="login-container-page">
      <LoginForm />
    </Container>
  );
}

export default Login;
