import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import AvisoPoliticas from './AvisoPoliticas';

const RutaPrivada = () => {
  const { token } = useContext(AuthContext);
  if (!token) return <Navigate to="/login" replace />;
  // Ley 1581 — pide la autorización a las cuentas que todavía no la dieron.
  return <><Outlet /><AvisoPoliticas /></>;
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