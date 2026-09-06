import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { AuthProvider } from './AuthProvider';
import Login from './Login';
import Registro from './Registro';
import RutaPrivada, { RutaAdmin } from './RutaPrivada';
import Dashboard from './Dashboard';
import FormularioConductor from './FormularioConductor';
import AdminConductores from './AdminConductores';
import AdminLogs from './AdminLogs';
import PerfilConductorPagina from './PerfilConductorPagina';

const LoginConNavegacion = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { iniciarSesion } = useContext(AuthContext);
  // Si volviste acá después de registrarte desde la pestaña "Conducir", lo
  // recordamos para (a) seguir mostrando esa pestaña y (b) mandarte directo
  // al formulario de conductor en vez del dashboard genérico al loguearte.
  const intent = location.state?.intent;
  return (
    <Login
      vistaInicial={intent === 'conductor' ? 'conducir' : undefined}
      irARegistro={(nuevoIntent) => navigate('/registro', { state: { intent: nuevoIntent } })}
      onLoginSuccess={(token) => {
        iniciarSesion(token);
        navigate(intent === 'conductor' ? '/registro-conductor' : '/dashboard');
      }}
    />
  );
};

const RegistroConNavegacion = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const intent = location.state?.intent;
  return <Registro irALogin={() => navigate('/login', { state: { intent } })} />;
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
            <Route path="/conductor/:driverId" element={<PerfilConductorPagina />} />
          </Route>

          {/* Rutas Privadas — solo ADMIN */}
          <Route element={<RutaAdmin />}>
            <Route path="/admin/conductores" element={<AdminConductores />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;