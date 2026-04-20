import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './AuthContext'; // Importamos el contexto
import Login from './Login';
import Registro from './Registro';
import RutaPrivada from './RutaPrivada';
import Dashboard from './Dashboard';
import FormularioConductor from './FormularioConductor'; // <--- 1. Importamos el nuevo componente

// === WRAPPERS DE NAVEGACIÓN ===
const LoginConNavegacion = () => {
  const navigate = useNavigate();
  const { iniciarSesion } = useContext(AuthContext); 

  return (
    <Login 
      irARegistro={() => navigate('/registro')} 
      onLoginSuccess={(token) => {
        iniciarSesion(token); 
        navigate('/dashboard'); 
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginConNavegacion />} />
          <Route path="/registro" element={<RegistroConNavegacion />} />

          {/* Rutas Privadas (Protegidas) */}
          <Route element={<RutaPrivada />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* 2. Agregamos la ruta para el formulario de conductor */}
            <Route path="/registro-conductor" element={<FormularioConductor />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;