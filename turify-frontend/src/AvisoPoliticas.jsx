import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import API_BASE_URL from './api';
import { T, Boton, IconAlerta } from './diseno';

// ─────────────────────────────────────────────────────────────────────────────
//  Ley 1581 — quien creó su cuenta antes de la casilla de autorización, o antes
//  de un cambio en las políticas, las acepta aquí para seguir usando la app.
//  La prueba la guarda el backend (app/consentimiento.py).
// ─────────────────────────────────────────────────────────────────────────────

const cabeceras = (token) => ({ 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' });

const AvisoPoliticas = () => {
  const { token, cerrarSesion } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pendiente, setPendiente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const botonRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    let vigente = true;
    // Si la consulta falla (sin conexión), no se bloquea a nadie: se vuelve a
    // preguntar la próxima vez que abra la app.
    fetch(`${API_BASE_URL}/users/me/autorizacion-datos`, { headers: cabeceras(token) })
      .then(res => (res.ok ? res.json() : null))
      .then(datos => { if (vigente && datos) setPendiente(!datos.vigente); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [token]);

  useEffect(() => { if (pendiente) botonRef.current?.focus(); }, [pendiente]);

  if (!pendiente) return null;

  const aceptar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/autorizacion-datos`, { method: 'POST', headers: cabeceras(token) });
      if (!res.ok) throw new Error();
      setPendiente(false);
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const salir = () => { cerrarSesion(); navigate('/login'); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', background: 'rgba(8,26,17,0.62)', fontFamily: T.ui }}>
      <div role="dialog" aria-modal="true" aria-labelledby="aviso-politicas-titulo" aria-describedby="aviso-politicas-texto"
        style={{ width: '100%', maxWidth: '460px', maxHeight: '100%', overflowY: 'auto', background: T.papel,
          border: `1px solid ${T.linea}`, borderRadius: T.rTarjeta, padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        <h2 id="aviso-politicas-titulo" style={{ margin: '0 0 10px', fontFamily: T.display, fontWeight: 700, fontSize: '20px', color: T.tinta }}>
          Actualizamos los Términos y la Política de datos
        </h2>
        <div id="aviso-politicas-texto" style={{ fontSize: '14px', lineHeight: 1.6, color: T.piedra }}>
          <p style={{ margin: '0 0 10px' }}>
            Para seguir usando Turify necesitamos tu autorización para tratar tus datos personales, como lo pide
            la Ley 1581 de 2012. Ahí explicamos qué datos usamos, para qué, con quién los compartimos y cómo
            puedes consultarlos, corregirlos o pedir que los borremos.
          </p>
          <p style={{ margin: 0 }}>
            Léelos en{' '}
            <a href="/politicas" target="_blank" rel="opener" style={{ color: T.tinta }}>Términos, privacidad y demás políticas</a>.
          </p>
        </div>
        {error && (
          <p role="alert" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '14px 0 0', fontSize: '13px', color: T.alertaTexto }}>
            <IconAlerta size={14} style={{ flexShrink: 0, marginTop: '2px' }} />{error}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '18px' }}>
          <Boton ref={botonRef} onClick={aceptar} disabled={guardando} variante={guardando ? 'inactivo' : 'primario'} ancho>
            {guardando ? 'Guardando…' : 'Acepto los Términos y autorizo el tratamiento de mis datos'}
          </Boton>
          <Boton variante="fantasma" onClick={salir} ancho>No acepto, cerrar sesión</Boton>
        </div>
      </div>
    </div>
  );
};

export default AvisoPoliticas;
