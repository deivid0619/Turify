import { useState } from 'react';
import { T } from './diseno';

// ─────────────────────────────────────────────────────────────────────────────
//  Aviso de cookies. Turify no usa cookies de publicidad ni de analítica: solo
//  el almacenamiento del navegador para la sesión y el tema, y servicios de
//  Google necesarios para entrar, la seguridad y el mapa. Por eso es un aviso
//  informativo y no pide elegir. Si algún día se agrega analítica, esto tiene
//  que pasar a pedir consentimiento ANTES de cargarla.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'turify-aviso-cookies';
const VERSION = '2026-09-28';

const leer = () => {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
};

const AvisoCookies = () => {
  const [visible, setVisible] = useState(() => leer() !== VERSION);
  if (!visible) return null;

  const cerrar = () => {
    try { localStorage.setItem(CLAVE, VERSION); } catch { /* sin almacenamiento: se vuelve a mostrar */ }
    setVisible(false);
  };

  return (
    <div role="region" aria-label="Aviso de cookies"
      style={{ position: 'fixed', left: '16px', right: '16px', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 8000, display: 'flex', justifyContent: 'center', pointerEvents: 'none', fontFamily: T.ui }}>
      <div style={{ pointerEvents: 'auto', maxWidth: '720px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '12px 16px',
        alignItems: 'center', background: T.papel, border: `1px solid ${T.linea}`, borderRadius: T.rTarjeta,
        padding: '14px 16px', boxShadow: '0 12px 32px rgba(8,26,17,.18)' }}>
        <p style={{ flex: '1 1 320px', margin: 0, fontSize: '13px', lineHeight: 1.55, color: T.piedra }}>
          Turify usa el almacenamiento de tu navegador para mantener tu sesión y tus preferencias, y servicios de
          Google (inicio de sesión, verificación de seguridad, mapas y tipografías) que pueden usar sus propias
          cookies. <b style={{ color: T.tinta }}>No usamos cookies de publicidad ni de analítica.</b>{' '}
          <a href="/politicas#cookies" target="_blank" rel="opener" style={{ color: T.tinta }}>Política de cookies</a>
        </p>
        <button type="button" onClick={cerrar} className="t-foco"
          style={{ flexShrink: 0, background: T.tinta, color: T.papel, border: 'none', borderRadius: T.rControl,
            padding: '10px 16px', fontFamily: T.display, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          Entendido
        </button>
      </div>
    </div>
  );
};

export default AvisoCookies;
