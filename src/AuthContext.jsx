import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

// Función para decodificar el payload del JWT sin librerías externas
const decodeJWT = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [usuario, setUsuario] = useState(null);

  // Cada vez que el token cambia, obtenemos el perfil completo del backend
  useEffect(() => {
    if (token) {
      fetch('http://127.0.0.1:8000/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Token inválido');
          return res.json();
        })
        .then(data => setUsuario(data))
        .catch(() => {
          // Si el token es inválido, cerramos sesión
          cerrarSesion();
        });
    } else {
      setUsuario(null);
    }
  }, [token]);

  const iniciarSesion = (nuevoToken) => {
    localStorage.setItem('token', nuevoToken);
    setToken(nuevoToken);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ token, usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
};