import API_BASE_URL from './api';
import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';

const decodeJWT = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const tokenEstaExpirado = (token) => {
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return false;
  return decoded.exp * 1000 < Date.now();
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [usuario, setUsuario] = useState(null);

  function cerrarSesion() {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
  }

  useEffect(() => {
    if (!token) { setUsuario(null); return; }
    fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then(res => {
        if (res.status === 401) { cerrarSesion(); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => { if (data) setUsuario(data); })
      .catch(() => { if (tokenEstaExpirado(token)) cerrarSesion(); });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const intervalo = setInterval(() => {
      if (tokenEstaExpirado(token)) cerrarSesion();
    }, 60000);
    return () => clearInterval(intervalo);
  }, [token]);

  function iniciarSesion(nuevoToken) {
    localStorage.setItem('token', nuevoToken);
    setToken(nuevoToken);
  }

  return (
    <AuthContext.Provider value={{ token, usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}
