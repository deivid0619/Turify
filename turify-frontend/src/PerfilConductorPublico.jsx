import { motion, AnimatePresence } from 'framer-motion';
import { T, IconPersona, IconEstrella, IconVisto, IconGorro, IconEmpresa,
         IconAire, IconWifi, IconBano, IconMusica, IconMaleta, IconBebe, IconMascota } from './diseno';

const FOREST = 'var(--t-monte)';
const GOLD = 'var(--t-chiva)';

// HU21 — Perfil público del conductor: el pasajero lo abre tocando el nombre/foto
// del conductor en una tarjeta de oferta. Formato "pase de abordar" (coherente con
// ser una app de transporte) — sello dorado para experiencia verificada, distinto
// del verde de "conectado/aprobado" que ya usa el resto de la app.
const ETIQUETAS_COMODIDAD = [
  ['tiene_ac', 'Aire acondicionado', IconAire],
  ['tiene_wifi', 'WiFi', IconWifi],
  ['tiene_bano', 'Baño', IconBano],
  ['tiene_musica', 'Música', IconMusica],
  ['tiene_maletero_amplio', 'Maletero amplio', IconMaleta],
  ['tiene_sillas_bebe', 'Sillas para bebé', IconBebe],
  ['acepta_mascotas', 'Acepta mascotas', IconMascota],
];

const PerfilConductorPublico = ({ abierto, cargando, datos, onCerrar }) => {
  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCerrar}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(5,14,5,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 4000 }} />

          <motion.div initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: 'tween', duration: 0.24 }}
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '480px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', zIndex: 4001, borderRadius: '26px', boxShadow: '0 30px 80px rgba(5,46,22,0.45)', backgroundColor: 'var(--t-papel)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

            {(cargando || !datos) ? (
              <div style={{ padding: '100px 20px', textAlign: 'center', color: 'var(--t-piedra)', fontSize: '16px' }}>⏳ Cargando perfil...</div>
            ) : (
              <div>
                {/* CABECERA — pase de abordar */}
                <div style={{
                  position: 'relative', padding: '36px 34px 54px', color: 'var(--t-musgo)',
                  background: `radial-gradient(circle at 15% -10%, rgba(34,197,94,0.35), transparent 55%), linear-gradient(155deg, #0a3d1f, ${FOREST} 65%)`
                }}>
                  <button onClick={onCerrar}
                    style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ×
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', letterSpacing: '0.06em', color: 'rgba(240,253,244,0.85)' }}>TURIFY</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,253,244,0.5)', border: '1px solid rgba(240,253,244,0.25)', borderRadius: '100px', padding: '5px 12px' }}>
                      Perfil de conductor
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '84px', height: '84px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.12)', border: '3px solid rgba(240,253,244,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', overflow: 'hidden' }}>
                      {datos.profile_photo_url
                        ? <img src={datos.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <IconPersona size={38} color="rgba(240,253,244,.7)" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '27px', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{datos.full_name}</div>
                      {datos.vehiculo && (
                        <div style={{ fontSize: '14.5px', color: 'rgba(240,253,244,0.65)', marginTop: '5px' }}>
                          {datos.vehiculo.categoria} · Placa {datos.vehiculo.plate} · {datos.vehiculo.capacity} puestos
                        </div>
                      )}
                      {datos.rating_avg != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '15px', fontWeight: 700, color: 'var(--t-chiva-linea)' }}>
                          <IconEstrella size={15} style={{ fill: 'currentColor' }} />{Number(datos.rating_avg).toFixed(1)}
                          <span style={{ color: 'rgba(240,253,244,0.55)', fontWeight: 500 }}>· {datos.rating_count} calificaciones</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', color: 'rgba(240,253,244,0.5)', marginTop: '10px' }}>Sin calificaciones aún</div>
                      )}
                    </div>
                  </div>

                  {datos.conductor_verificado && (
                    <div style={{
                      position: 'absolute', right: '30px', bottom: '-32px', width: '78px', height: '78px', borderRadius: '50%',
                      background: `radial-gradient(circle at 32% 28%, #fde047, ${GOLD} 55%, var(--t-chiva-texto) 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                      boxShadow: '0 10px 22px rgba(161,98,7,0.4), 0 0 0 5px #fff', transform: 'rotate(-11deg)', zIndex: 2
                    }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 800, lineHeight: 1.15, color: '#4a2c00', letterSpacing: '0.02em' }}>
                        <IconVisto size={19} color="#4a2c00" grosor={2.4} style={{ display: 'block', margin: '0 auto 1px' }} />VERIFI-<br />CADO
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '2px dashed var(--t-linea)' }} />

                {/* DETALLE */}
                <div style={{ padding: '48px 34px 34px' }}>
                  {datos.empresa_afiliada && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px dashed var(--t-linea)' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Empresa afiliada</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, color: T.tinta }}><IconEmpresa size={15} color={T.piedra} />{datos.empresa_afiliada.name}</span>
                    </div>
                  )}

                  {datos.conductor_verificado && datos.years_experience != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px dashed var(--t-linea)' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Experiencia verificada</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-tinta)' }}>{datos.years_experience} años</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>Viajes completados</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-tinta)' }}>{datos.viajes_completados}</span>
                  </div>

                  {datos.vehiculo && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
                      {ETIQUETAS_COMODIDAD.filter(([campo]) => datos.vehiculo[campo]).map(([campo, etiqueta, Ico]) => (
                        <span key={campo} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, padding: '6px 13px', borderRadius: '100px', background: 'var(--t-niebla)', border: '1px solid var(--t-linea)', color: 'var(--t-tinta)' }}>
                          <Ico size={13} />{etiqueta}
                        </span>
                      ))}
                    </div>
                  )}

                  {datos.conductor_verificado && (
                    <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'var(--t-chiva-suave)', border: '1px solid var(--t-chiva-linea)', borderRadius: '12px', padding: '15px 17px' }}>
                      <span style={{ display: 'flex', flexShrink: 0, color: T.chivaTexto }}><IconGorro size={19} /></span>
                      <div>
                        <b style={{ display: 'block', fontSize: '15px', color: 'var(--t-chiva-texto)', marginBottom: '3px' }}>Experiencia verificada por Turify</b>
                        <span style={{ fontSize: '13.5px', color: '#92702f', lineHeight: 1.55 }}>El administrador confirmó los años de experiencia de este conductor a partir de su RUNT.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PerfilConductorPublico;
