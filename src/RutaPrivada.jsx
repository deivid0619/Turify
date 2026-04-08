import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const RutaPrivada = () => {
  // Consumimos el estado global
  const { token } = useContext(AuthContext);

  // Si no hay token en el estado global, lo mandamos al login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si hay token, lo dejamos pasar
  return <Outlet />;
};

export default RutaPrivada;