/**
 * Skeleton.jsx — HU15 Mejoras de interfaz
 * Componente de pantalla de carga animada para Turify
 */

const pulseStyle = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .sk {
    background: linear-gradient(90deg, var(--t-linea) 25%, var(--t-niebla-2) 50%, var(--t-linea) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
  }
  .sk-dark {
    background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
  }
`;

// ── Bloque genérico ──
export const SkeletonBlock = ({ width = '100%', height = 16, dark = false, style = {} }) => (
  <>
    <style>{pulseStyle}</style>
    <div
      className={dark ? 'sk-dark' : 'sk'}
      style={{ width, height, ...style }}
    />
  </>
);

// ── Tarjeta de solicitud de viaje (Radar del conductor) ──
export const SkeletonTarjetaViaje = ({ dark = false }) => {
  const bg = dark ? 'rgba(255,255,255,0.04)' : '#fff';
  const border = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--t-linea)';

  return (
    <>
      <style>{pulseStyle}</style>
      <div style={{ border, borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: bg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 14, width: '70%', marginBottom: 6 }} />
            <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 13, width: '55%' }} />
          </div>
          <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 22, width: 80, borderRadius: 20 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 12, width: 120 }} />
          <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 12, width: 80 }} />
        </div>
        <div className={dark ? 'sk-dark' : 'sk'} style={{ height: 34, width: '100%', borderRadius: 8 }} />
      </div>
    </>
  );
};

// ── Tarjeta de viaje confirmado (Dashboard pasajero) ──
export const SkeletonTarjetaConfirmado = () => (
  <>
    <style>{pulseStyle}</style>
    <div style={{ border: '1px solid var(--t-linea)', borderRadius: 12, padding: 16, marginBottom: 12, backgroundColor: 'var(--t-papel)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="sk" style={{ height: 12, width: 80 }} />
        <div className="sk" style={{ height: 20, width: 90, borderRadius: 20 }} />
      </div>
      <div className="sk" style={{ height: 15, width: '80%', marginBottom: 6 }} />
      <div className="sk" style={{ height: 13, width: '60%', marginBottom: 4 }} />
      <div className="sk" style={{ height: 12, width: '50%', marginBottom: 12 }} />
      <div style={{ backgroundColor: 'var(--t-niebla)', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sk" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ height: 13, width: '60%', marginBottom: 5 }} />
          <div className="sk" style={{ height: 11, width: '40%' }} />
        </div>
      </div>
    </div>
  </>
);

// ── Pantalla de carga inicial del Dashboard ──
export const SkeletonDashboard = () => (
  <>
    <style>{pulseStyle}</style>
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'var(--t-monte)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 99999,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      {/* Logo animado */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '3px solid rgba(34,197,94,0.2)',
          borderTop: '3px solid var(--t-ruta)',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: 'var(--t-ruta)', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: "'Syne', sans-serif" }}>
          Turify
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0' }}>
          Cargando tu sesión...
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  </>
);

// ── Mensaje de error de conexión ──
export const ErrorConexion = ({ onReintentar }) => (
  <div style={{
    position: 'fixed', inset: 0,
    backgroundColor: 'var(--t-monte)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99999,
    fontFamily: "'DM Sans', sans-serif",
    padding: 24,
  }}>
    <div style={{
      backgroundColor: 'var(--t-monte-alto)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 16,
      padding: '40px 48px',
      textAlign: 'center',
      maxWidth: 420,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--t-alerta-suave)', border: '1px solid var(--t-alerta-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--t-alerta-texto)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 13a10 10 0 0 1 4-2.4M19 13a10 10 0 0 0-7.5-2.9" /><path d="M2 9.5A15 15 0 0 1 6.5 6.7M22 9.5a15 15 0 0 0-9-3.4" /><path d="M12 20h.01" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 10px', color: 'var(--t-musgo)', fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>
        Sin conexión al servidor
      </h2>
      <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
        No se pudo conectar con el backend de Turify. Verifica que el servidor esté activo e intenta de nuevo.
      </p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          style={{
            background: 'linear-gradient(135deg, var(--t-ruta), var(--t-ruta))',
            border: 'none', borderRadius: 9,
            color: 'var(--t-monte)', fontWeight: 700,
            fontSize: 14, padding: '12px 28px',
            cursor: 'pointer', fontFamily: "'Syne', sans-serif",
            boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
          }}>
          Reintentar
        </button>
      )}
    </div>
  </div>
);

export default { SkeletonBlock, SkeletonTarjetaViaje, SkeletonTarjetaConfirmado, SkeletonDashboard, ErrorConexion };