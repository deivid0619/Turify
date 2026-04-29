import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './AuthContext';

// Ruta protegida por token (cualquier usuario autenticado)
const RutaPrivada = () => {
  const { token } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Ruta protegida exclusivamente para ADMIN
export const RutaAdmin = () => {
  const { token, usuario } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  if (usuario && usuario.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export default RutaPrivada;