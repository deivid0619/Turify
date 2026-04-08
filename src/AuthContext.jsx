import { createContext, useState } from 'react';

// 1. Creamos el contexto
export const AuthContext = createContext();

// 2. Creamos el Proveedor que envolverá nuestra app
export const AuthProvider = ({ children }) => {
  // Inicializamos el estado leyendo el token que ya pueda existir
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  // Función global para iniciar sesión
  const iniciarSesion = (nuevoToken) => {
    localStorage.setItem('token', nuevoToken);
    setToken(nuevoToken);
  };

  // Función global para cerrar sesión
  const cerrarSesion = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
};