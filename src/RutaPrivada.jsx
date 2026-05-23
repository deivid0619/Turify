import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const RutaPrivada = () => {
  const { token } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export const RutaAdmin = () => {
  const { token, usuario } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  // Mientras usuario carga, no redirigir
  if (!usuario) return null;
  if (usuario.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export default RutaPrivada;