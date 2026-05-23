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
    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
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
  const border = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';

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
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12, backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="sk" style={{ height: 12, width: 80 }} />
        <div className="sk" style={{ height: 20, width: 90, borderRadius: 20 }} />
      </div>
      <div className="sk" style={{ height: 15, width: '80%', marginBottom: 6 }} />
      <div className="sk" style={{ height: 13, width: '60%', marginBottom: 4 }} />
      <div className="sk" style={{ height: 12, width: '50%', marginBottom: 12 }} />
      <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
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
      backgroundColor: '#0a0f0a',
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
          borderTop: '3px solid #22c55e',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: '#22c55e', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: "'Syne', sans-serif" }}>
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
    backgroundColor: '#0a0f0a',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 99999,
    fontFamily: "'DM Sans', sans-serif",
    padding: 24,
  }}>
    <div style={{
      backgroundColor: '#0f1a0f',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 16,
      padding: '40px 48px',
      textAlign: 'center',
      maxWidth: 420,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
      <h2 style={{ margin: '0 0 10px', color: '#f0fdf4', fontSize: 20, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>
        Sin conexión al servidor
      </h2>
      <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
        No se pudo conectar con el backend de Turify. Verifica que el servidor esté activo e intenta de nuevo.
      </p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', borderRadius: 9,
            color: '#052e16', fontWeight: 700,
            fontSize: 14, padding: '12px 28px',
            cursor: 'pointer', fontFamily: "'Syne', sans-serif",
            boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
          }}>
          🔄 Reintentar
        </button>
      )}
    </div>
  </div>
);

export default { SkeletonBlock, SkeletonTarjetaViaje, SkeletonTarjetaConfirmado, SkeletonDashboard, ErrorConexion };
