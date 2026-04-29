import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './AuthContext';
import Login from './Login';
import Registro from './Registro';
import RutaPrivada, { RutaAdmin } from './RutaPrivada';
import Dashboard from './Dashboard';
import FormularioConductor from './FormularioConductor';
import AdminConductores from './AdminConductores';

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
  return <Registro irALogin={() => navigate('/login')} />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginConNavegacion />} />
          <Route path="/registro" element={<RegistroConNavegacion />} />

          {/* Rutas Privadas — cualquier usuario autenticado */}
          <Route element={<RutaPrivada />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/registro-conductor" element={<FormularioConductor />} />
          </Route>

          {/* Rutas Privadas — solo ADMIN */}
          <Route element={<RutaAdmin />}>
            <Route path="/admin/conductores" element={<AdminConductores />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;