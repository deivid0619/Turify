import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';

const BRAND_GREEN = '#16a34a';
const API_BASE_URL = 'http://127.0.0.1:8000';

const PanelConductor = ({ onVerRuta }) => {
  const { token, usuario } = useContext(AuthContext);

  const [pestanaActiva, setPestanaActiva] = useState('radar');
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [solicitudModal, setSolicitudModal] = useState(null);
  const [precio, setPrecio] = useState('');
  const [enviandoOferta, setEnviandoOferta] = useState(false);
  const [alertaExito, setAlertaExito] = useState(false);
  const [errorPrecio, setErrorPrecio] = useState('');
  const [viajesActivos, setViajesActivos] = useState([]);
  const [tarjetaRutaId, setTarjetaRutaId] = useState(null);

  const cargarSolicitudes = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/pending`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSolicitudes(data);
    } catch {
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (token) cargarSolicitudes(); }, [token]);

  const validarPrecio = (val) => {
    if (!val || val === '') { setErrorPrecio('El precio no puede estar vacío.'); return false; }
    if (isNaN(val) || Number(val) <= 0) { setErrorPrecio('El precio debe ser mayor a 0.'); return false; }
    setErrorPrecio('');
    return true;
  };

  const enviarOferta = async () => {
    if (!validarPrecio(precio)) return;
    setEnviandoOferta(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${solicitudModal.request_id}/offers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ offered_price: Number(precio) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al enviar oferta');
      }
      setViajesActivos(prev => [...prev, {
        request_id: solicitudModal.request_id,
        origin: solicitudModal.origin,
        destination: solicitudModal.destination,
        departure_time: solicitudModal.departure_time,
        offered_price: Number(precio),
        estado: 'ESPERANDO'
      }]);
      setSolicitudModal(null);
      setPrecio('');
      setAlertaExito(true);
      setTimeout(() => setAlertaExito(false), 3500);
      cargarSolicitudes();
    } catch (err) {
      setErrorPrecio(err.message);
    } finally {
      setEnviandoOferta(false);
    }
  };

  const handleClickTarjeta = (sol) => {
    const esLaMisma = tarjetaRutaId === sol.request_id;
    setTarjetaRutaId(esLaMisma ? null : sol.request_id);
    if (!esLaMisma && onVerRuta) onVerRuta(sol.origin, sol.destination);
  };

  const formatearFecha = (f) => {
    try { return new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return f; }
  };

  const estadoConfig = (estado) => {
    const m = { ESPERANDO: { bg: '#fef3c7', color: '#92400e', label: '⏳ Esperando respuesta del pasajero' }, CONTRAOFERTA: { bg: '#dbeafe', color: '#1e40af', label: '🔄 Contraoferta recibida' }, RECHAZADO: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' }, ACEPTADO: { bg: '#dcfce7', color: '#166534', label: '✅ Aceptado' } };
    return m[estado] || { bg: '#f1f5f9', color: '#475569', label: estado };
  };

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', fontFamily: 'Inter, sans-serif', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND_GREEN}, #15803d)`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '700' }}>🚗 Panel del Conductor</h3>
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Hola, {usuario?.full_name?.split(' ')[0] || 'Conductor'}</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={cargarSolicitudes} disabled={cargando}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
            {cargando ? '⏳' : '🔄 Actualizar'}
          </motion.button>
        </div>
        {/* PESTAÑAS */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[{ id: 'radar', label: '📡 Radar', count: solicitudes.length }, { id: 'activos', label: '📋 Mis Ofertas', count: viajesActivos.length }].map(tab => (
            <button key={tab.id} onClick={() => setPestanaActiva(tab.id)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', transition: 'all 0.2s', backgroundColor: pestanaActiva === tab.id ? '#fff' : 'rgba(255,255,255,0.15)', color: pestanaActiva === tab.id ? BRAND_GREEN : '#fff' }}>
              {tab.label}
              {tab.count > 0 && <span style={{ background: pestanaActiva === tab.id ? BRAND_GREEN : 'rgba(255,255,255,0.4)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', marginLeft: '4px' }}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ALERTA ÉXITO */}
      <AnimatePresence>
        {alertaExito && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ margin: '12px 16px 0', backgroundColor: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '10px 14px', color: BRAND_GREEN, fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>
            ✅ ¡Oferta enviada al pasajero! Esperando su aceptación.
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL OFERTA */}
      <AnimatePresence>
        {solicitudModal && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ margin: '12px 16px 0', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {solicitudModal.origin}</p>
                <p style={{ margin: '2px 0', fontWeight: '700', fontSize: '13px', color: BRAND_GREEN }}>→ {solicitudModal.destination}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>👥 {(solicitudModal.adults_count || 1) + (solicitudModal.children_count || 0)} pasajero(s){solicitudModal.has_pets ? ' · 🐾' : ''}</p>
              </div>
              <button onClick={() => { setSolicitudModal(null); setPrecio(''); setErrorPrecio(''); }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>💰 ¿Cuánto cobrarías por este viaje?</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px', fontWeight: '700' }}>$</span>
                  <input type="number" placeholder="Ej: 45000" value={precio}
                    onChange={(e) => { setPrecio(e.target.value); if (errorPrecio) validarPrecio(e.target.value); }}
                    min="1" style={{ width: '100%', padding: '10px 12px 10px 26px', border: `1px solid ${errorPrecio ? '#ef4444' : '#cbd5e1'}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                {errorPrecio && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ef4444' }}>{errorPrecio}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={enviarOferta} disabled={enviandoOferta}
                style={{ background: enviandoOferta ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', fontSize: '13px', cursor: enviandoOferta ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {enviandoOferta ? '...' : 'Enviar'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTENIDO */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* PESTAÑA RADAR */}
        {pestanaActiva === 'radar' && (
          <>
            {cargando && <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>⏳ Cargando solicitudes...</div>}
            {!cargando && error && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}<br />
                <button onClick={cargarSolicitudes} style={{ marginTop: '8px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reintentar</button>
              </div>
            )}
            {/* ESTADO VACÍO AMIGABLE - SCRUM-75 */}
            {!cargando && !error && solicitudes.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Por ahora no hay viajes en tu zona</p>
                <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>Te avisaremos cuando haya nuevas solicitudes cerca de ti.</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={cargarSolicitudes}
                  style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  🔄 Verificar de nuevo
                </motion.button>
              </motion.div>
            )}
            {/* TARJETAS - SCRUM-75, SCRUM-76, SCRUM-77 */}
            {!cargando && solicitudes.map((sol) => {
              const estaSeleccionada = tarjetaRutaId === sol.request_id;
              return (
                <motion.div key={sol.request_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: `1px solid ${estaSeleccionada ? BRAND_GREEN : '#e2e8f0'}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: estaSeleccionada ? `0 0 0 2px ${BRAND_GREEN}33` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                  {/* Cuerpo clickeable → traza ruta SCRUM-77 */}
                  <div onClick={() => handleClickTarjeta(sol)} style={{ padding: '14px', cursor: 'pointer', backgroundColor: estaSeleccionada ? '#f0fdf4' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {sol.origin}</p>
                        <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>→ {sol.destination}</p>
                      </div>
                      <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '20px', fontWeight: '700', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                        {sol.trip_type === 'ROUND_TRIP' ? '↩ Ida y vuelta' : '→ Solo ida'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span>🗓️ {formatearFecha(sol.departure_time)}</span>
                      <span>👥 {(sol.adults_count || 1) + (sol.children_count || 0)} pasajero(s){sol.has_pets ? ' 🐾' : ''}</span>
                    </div>
                    {estaSeleccionada && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ marginTop: '8px', fontSize: '11px', color: BRAND_GREEN, fontWeight: '600' }}>
                        🗺️ Ruta trazada en el mapa — haz clic para ocultar
                      </motion.div>
                    )}
                  </div>
                  {/* Botón oferta - SCRUM-76 */}
                  <div style={{ padding: '0 14px 14px' }}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={(e) => { e.stopPropagation(); setSolicitudModal(sol); setPrecio(''); setErrorPrecio(''); }}
                      style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      💰 Hacer oferta
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </>
        )}

        {/* PESTAÑA VIAJES ACTIVOS - SCRUM-89 */}
        {pestanaActiva === 'activos' && (
          <>
            {viajesActivos.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Aún no has enviado ofertas</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Cuando hagas una oferta aparecerá aquí con su estado.</p>
              </motion.div>
            )}
            {viajesActivos.map((viaje, i) => {
              const est = estadoConfig(viaje.estado);
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {viaje.origin}</p>
                      <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>→ {viaje.destination}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>🗓️ {formatearFecha(viaje.departure_time)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: BRAND_GREEN }}>${Number(viaje.offered_price).toLocaleString()}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>Tu oferta</p>
                    </div>
                  </div>
                  <span style={{ display: 'inline-block', backgroundColor: est.bg, color: est.color, borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '700' }}>
                    {est.label}
                  </span>
                </motion.div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default PanelConductor;