import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './AuthContext'; // <-- Importamos el contexto
import Login from './Login';
import Registro from './Registro';
import RutaPrivada from './RutaPrivada';
import Dashboard from './Dashboard';

// === WRAPPERS DE NAVEGACIÓN ===
const LoginConNavegacion = () => {
  const navigate = useNavigate();
  const { iniciarSesion } = useContext(AuthContext); // Sacamos la función del estado global

  return (
    <Login 
      irARegistro={() => navigate('/registro')} 
      // Cuando el login sea exitoso en el componente, recibimos el token aquí
      onLoginSuccess={(token) => {
        iniciarSesion(token); // Actualizamos el estado global
        navigate('/dashboard'); // Y redirigimos
      }} 
    />
  );
};

const RegistroConNavegacion = () => {
  const navigate = useNavigate();
  return (
    <Registro 
      irALogin={() => navigate('/login')} 
    />
  );
};

// === COMPONENTE PRINCIPAL ===
function App() {
  return (
    // Envolvemos TODO con el AuthProvider para que el estado sea global
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginConNavegacion />} />
          <Route path="/registro" element={<RegistroConNavegacion />} />

          {/* Rutas Privadas (Protegidas) */}
          <Route element={<RutaPrivada />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;