import { useState, useEffect, useContext } from 'react';
import { IconEstrella } from './diseno';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import API_BASE_URL from './api';

const FOREST = 'var(--t-monte)';
const GOLD = 'var(--t-chiva)';
const BRAND_GREEN = 'var(--t-ruta)';

// HU38 — Perfil público del conductor como página completa (no una tarjeta
// flotando sobre fondo gris): la cabecera ocupa todo el ancho como en cualquier
// página del sitio, y el contenido corre debajo en una columna editorial.
// Sin emojis decorativos — solo tipografía, iconos de trazo, y el
// dorado reservado para lo verificado.
const ETIQUETAS_COMODIDAD = [
  ['tiene_ac', 'Aire acondicionado'],
  ['tiene_wifi', 'WiFi'],
  ['tiene_bano', 'Baño'],
  ['tiene_musica', 'Música'],
  ['tiene_maletero_amplio', 'Maletero amplio'],
  ['tiene_sillas_bebe', 'Sillas para bebé'],
  ['tiene_sillas_reclinables', 'Sillas reclinables'],
  ['tiene_cargador_usb', 'Cargador USB'],
  ['tiene_tv', 'Televisor'],
  ['tiene_buen_audio', 'Buen audio'],
  ['acepta_mascotas', 'Acepta mascotas'],
];

const IconPersona = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" strokeLinecap="round" />
  </svg>
);

const IconCheck = ({ size = 14, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
    <path d="M4 12.5l5.5 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PerfilConductorPagina = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!token || !driverId) return;
    setCargando(true);
    setError(false);
    fetch(`${API_BASE_URL}/drivers/${driverId}/public-profile`, {
      headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
    })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setDatos)
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [token, driverId]);

  const volver = () => (window.opener ? window.close() : navigate('/dashboard'));

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--t-papel)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-piedra-clara)', fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '14px' }}>
        Cargando perfil…
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--t-papel)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif", gap: '18px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--t-tinta)' }}>No pudimos cargar este perfil.</p>
        <p style={{ margin: '-10px 0 0', color: 'var(--t-piedra)', fontSize: '13px' }}>Verifica tu conexión e intenta de nuevo.</p>
        <button onClick={volver} style={{ background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontSize: '13px', color: 'var(--t-tinta)', fontWeight: 600 }}>
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--t-papel)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');`}</style>

      {/* CABECERA — a todo el ancho, como el resto del sitio */}
      <div style={{
        position: 'relative', color: 'var(--t-musgo)',
        background: `radial-gradient(circle at 12% -20%, rgba(34,197,94,0.35), transparent 55%), linear-gradient(155deg, #0a3d1f, ${FOREST} 68%)`
      }}>
        <div style={{ maxWidth: '840px', margin: '0 auto', padding: '28px 32px 84px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '56px' }}>
            <button onClick={volver}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(240,253,244,0.25)', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: 'var(--t-musgo)', fontWeight: 600 }}>
              ← Volver
            </button>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', letterSpacing: '0.06em', color: 'rgba(240,253,244,0.85)' }}>TURIFY</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
              <div style={{ width: '104px', height: '104px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.12)', border: '3px solid rgba(240,253,244,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,253,244,0.7)', overflow: 'hidden' }}>
                {datos.profile_photo_url
                  ? <img src={datos.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <IconPersona size={42} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.1, fontFamily: "'Syne', sans-serif" }}>{datos.full_name}</div>
                {datos.vehiculo && (
                  <div style={{ fontSize: '14.5px', color: 'rgba(240,253,244,0.65)', marginTop: '8px' }}>
                    {datos.vehiculo.categoria} · Placa {datos.vehiculo.plate} · {datos.vehiculo.capacity} puestos
                  </div>
                )}
                {datos.rating_avg != null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '12px', fontSize: '15px', fontWeight: 700, color: 'var(--t-chiva-linea)' }}>
                    <IconEstrella size={15} style={{ fill: 'currentColor' }} />{Number(datos.rating_avg).toFixed(1)}
                    <span style={{ color: 'rgba(240,253,244,0.55)', fontWeight: 500 }}>· {datos.rating_count} calificaciones</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '13.5px', color: 'rgba(240,253,244,0.5)', marginTop: '12px' }}>Sin calificaciones aún</div>
                )}
              </div>
            </div>

            {datos.conductor_verificado && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(234,179,8,0.14)',
                border: '1px solid rgba(234,179,8,0.4)', borderRadius: '100px', padding: '10px 18px 10px 12px', flexShrink: 0
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: `radial-gradient(circle at 32% 28%, #fde047, ${GOLD} 55%, var(--t-chiva-texto) 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <IconCheck size={12} color="#3d2500" />
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--t-chiva-linea)' }}>Conductor verificado</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETALLE — columna editorial debajo de la cabecera */}
      <div style={{ maxWidth: '840px', margin: '-40px auto 0', padding: '0 32px 90px' }}>
        <div style={{ background: 'var(--t-papel)', borderRadius: '18px', boxShadow: '0 20px 50px rgba(5,46,22,0.1)', border: '1px solid var(--t-niebla-2)', padding: '44px 44px 8px' }}>

          {datos.empresa_afiliada && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid var(--t-niebla-2)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Empresa afiliada</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-tinta)' }}>{datos.empresa_afiliada.name}</span>
            </div>
          )}

          {datos.conductor_verificado && datos.years_experience != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid var(--t-niebla-2)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Experiencia verificada</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-tinta)' }}>{datos.years_experience} años</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: datos.vehiculo ? '1px solid var(--t-niebla-2)' : 'none' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Viajes completados</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-tinta)' }}>{datos.viajes_completados}</span>
          </div>

          {datos.vehiculo && (
            <div style={{ padding: '22px 0 30px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)', marginBottom: '14px' }}>Comodidades</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
                {ETIQUETAS_COMODIDAD.filter(([campo]) => datos.vehiculo[campo]).map(([campo, etiqueta]) => (
                  <span key={campo} style={{ fontSize: '13.5px', fontWeight: 600, padding: '8px 16px', borderRadius: '100px', background: 'var(--t-niebla)', border: '1px solid var(--t-linea)', color: 'var(--t-tinta)' }}>
                    {etiqueta}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {datos.conductor_verificado && (
          <div style={{ marginTop: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start', borderLeft: `3px solid ${GOLD}`, padding: '4px 0 4px 20px' }}>
            <div>
              <b style={{ display: 'block', fontSize: '14px', color: 'var(--t-tinta)', marginBottom: '4px' }}>Experiencia verificada por Turify</b>
              <span style={{ fontSize: '13.5px', color: 'var(--t-piedra)', lineHeight: 1.65 }}>El administrador confirmó los años de experiencia de este conductor a partir de su RUNT.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerfilConductorPagina;
