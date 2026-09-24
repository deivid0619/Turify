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

  // Extraída del efecto para poder llamarla también "a demanda" — por ejemplo,
  // cuando el frontend se entera de que el rol del usuario cambió del lado del
  // backend (ej. un admin aprobó sus documentos de conductor) y hay que traer
  // el usuario de nuevo sin esperar a un logout/login o un F5.
  function cargarUsuario(tok) {
    if (!tok) { setUsuario(null); return Promise.resolve(null); }
    return fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${tok}`,
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then(res => {
        if (res.status === 401) { cerrarSesion(); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => { if (data) setUsuario(data); return data; })
      .catch(() => { if (tokenEstaExpirado(tok)) cerrarSesion(); return null; });
  }

  useEffect(() => {
    cargarUsuario(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function refrescarUsuario() {
    return cargarUsuario(token);
  }

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
    <AuthContext.Provider value={{ token, usuario, iniciarSesion, cerrarSesion, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}