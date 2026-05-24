import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { ToastContainer, useToast } from './Toast';
import { SkeletonTarjetaViaje } from './Skeleton';

const BRAND_GREEN = '#16a34a';
const API_BASE_URL = 'http://127.0.0.1:8000';

const PanelConductor = ({ onVerRuta }) => {
  const { token, usuario } = useContext(AuthContext);
  const { toasts, removeToast, toast } = useToast();

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
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotifPanel, setMostrarNotifPanel] = useState(false);

  // Filtros del radar
  const [filtros, setFiltros] = useState({ tipo: 'todos', pasajeros: 'todos', mascotas: false });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Notificaciones del conductor
  const cargarNotificaciones = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/notifications`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setNotificaciones(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    cargarNotificaciones();
    const intervalo = setInterval(cargarNotificaciones, 15000);
    return () => clearInterval(intervalo);
  }, [token]);

  const marcarLeida = async (notifId) => {
    try {
      await fetch(`${API_BASE_URL}/api/service-requests/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      setNotificaciones(prev => prev.map(n =>
        n.notification_id === notifId ? { ...n, is_read: true } : n
      ));
    } catch {}
  };

  const marcarTodasLeidas = () => {
    notificaciones.filter(n => !n.is_read).forEach(n => marcarLeida(n.notification_id));
  };

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

  // SCRUM-83: Cargar negociaciones activas cuando se cambia a esa pestaña
  const cargarOcupantes = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/passengers`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setOcupantesPorViaje(prev => ({ ...prev, [requestId]: data }));
      }
    } catch {}
  };

  const cargarViajesActivos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/driver/my-offers`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setViajesActivos(data);
      }
    } catch (e) {
      console.error('Error cargando ofertas activas:', e);
    }
  };

  useEffect(() => {
    if (token && pestanaActiva === 'activos') cargarViajesActivos();
  }, [token, pestanaActiva]);

  // SCRUM-82: Conductor responde a contraoferta
  const [resolviendoOferta, setResolviendoOferta] = useState(null);
  const [ocupantesPorViaje, setOcupantesPorViaje] = useState({});
  const [modalOcupantesId, setModalOcupantesId] = useState(null);
  const [gestionandoViaje, setGestionandoViaje] = useState(null); // request_id en proceso

  // HU17: Conductor inicia o finaliza el viaje
  const gestionarViaje = async (requestId, accion) => {
    setGestionandoViaje(requestId + accion);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/${accion}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      const data = await res.json();
      toast.success(data.message);
      cargarViajesActivos();
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setGestionandoViaje(null);
    }
  };

  const resolverContraoferta = async (offerId, action) => {
    setResolviendoOferta(offerId + action);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/offers/${offerId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ action })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      const data = await res.json();
      toast.success(data.message);
      cargarViajesActivos();
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setResolviendoOferta(null);
    }
  };

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

  const solicitudesFiltradas = solicitudes.filter(sol => {
    if (filtros.tipo !== 'todos' && sol.trip_type !== filtros.tipo) return false;
    const totalPax = (sol.adults_count || 1) + (sol.children_count || 0);
    if (filtros.pasajeros === '1') { if (totalPax !== 1) return false; }
    else if (filtros.pasajeros === '2-4') { if (totalPax < 2 || totalPax > 4) return false; }
    else if (filtros.pasajeros === '5+') { if (totalPax < 5) return false; }
    if (filtros.mascotas && !sol.has_pets) return false;
    return true;
  });
  const filtrosActivos = filtros.tipo !== 'todos' || filtros.pasajeros !== 'todos' || filtros.mascotas;

  return (
    <>
    <style>{`
      .fuec-input {
        width: 100%;
        padding: 9px 12px;
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: #f0fdf4 !important;
        font-size: 13px;
        font-family: 'DM Sans', sans-serif;
        box-sizing: border-box;
        outline: none;
        min-width: 0;
      }
      .fuec-input::placeholder { color: rgba(255,255,255,0.35) !important; }
      .fuec-input:focus { border-color: rgba(34,197,94,0.55) !important; background: rgba(34,197,94,0.08) !important; }
      .fuec-select {
        width: 100%;
        padding: 9px 6px;
        background: #0d1a0d !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: #f0fdf4 !important;
        font-size: 13px;
        outline: none;
        min-width: 0;
      }
      .fuec-select option { background: #0d1a0d; color: #f0fdf4; }
    `}</style>
    <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', fontFamily: 'Inter, sans-serif', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND_GREEN}, #15803d)`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '700' }}>🚗 Panel del Conductor</h3>
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Hola, {usuario?.full_name?.split(' ')[0] || 'Conductor'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Campana de notificaciones */}
            <div onClick={() => setMostrarNotifPanel(true)}
              style={{ position: 'relative', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '16px' }}>🔔</span>
              {notificaciones.filter(n => !n.is_read).length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #15803d' }}>
                  {notificaciones.filter(n => !n.is_read).length}
                </span>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={cargarSolicitudes} disabled={cargando}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              {cargando ? '⏳' : '🔄 Actualizar'}
            </motion.button>
          </div>
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
            {/* BARRA DE FILTROS */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mostrarFiltros ? '10px' : '0' }}>
                <button onClick={() => setMostrarFiltros(f => !f)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: filtrosActivos ? '#f0fdf4' : '#f8fafc', border: `1px solid ${filtrosActivos ? BRAND_GREEN : '#e2e8f0'}`, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: filtrosActivos ? BRAND_GREEN : '#475569', cursor: 'pointer' }}>
                  <span>⚙️</span> Filtros
                  {filtrosActivos && <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                </button>
                {filtrosActivos && (
                  <button onClick={() => setFiltros({ tipo: 'todos', pasajeros: 'todos', mascotas: false })}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              <AnimatePresence>
                {mostrarFiltros && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>

                    {/* Tipo de viaje */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de viaje</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: 'ONE_WAY', label: '→ Solo ida' }, { val: 'ROUND_TRIP', label: '↩ Ida y vuelta' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, tipo: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.tipo === op.val ? BRAND_GREEN : '#e2e8f0', color: filtros.tipo === op.val ? '#fff' : '#475569' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Pasajeros */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pasajeros</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: '1', label: '1 pasajero' }, { val: '2-4', label: '2–4' }, { val: '5+', label: '5 o más' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, pasajeros: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.pasajeros === op.val ? BRAND_GREEN : '#e2e8f0', color: filtros.pasajeros === op.val ? '#fff' : '#475569' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Mascotas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Solo con mascotas 🐾</p>
                      <div onClick={() => setFiltros(f => ({ ...f, mascotas: !f.mascotas }))}
                        style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: filtros.mascotas ? BRAND_GREEN : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: filtros.mascotas ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Contador de resultados filtrados */}
              {filtrosActivos && !cargando && (
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b' }}>
                  {solicitudesFiltradas.length} de {solicitudes.length} viaje(s) coinciden con tus filtros
                </p>
              )}
            </div>

            {cargando && (
              <>
                <SkeletonTarjetaViaje />
                <SkeletonTarjetaViaje />
                <SkeletonTarjetaViaje />
              </>
            )}
            {!cargando && error && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}<br />
                <button onClick={cargarSolicitudes} style={{ marginTop: '8px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reintentar</button>
              </div>
            )}
            {/* ESTADO VACÍO */}
            {!cargando && !error && solicitudes.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '36px 20px' }}>
                <svg width="110" height="90" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '14px', opacity: 0.75 }}>
                  <circle cx="55" cy="45" r="32" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="20" fill="none" stroke="#86efac" strokeWidth="1" strokeDasharray="4 3"/>
                  <circle cx="55" cy="45" r="8" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="3" fill="#16a34a"/>
                  <line x1="55" y1="13" x2="55" y2="7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="55" y1="77" x2="55" y2="83" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="23" y1="45" x2="17" y2="45" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="87" y1="45" x2="93" y2="45" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>Radar sin señal</p>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>No hay viajes en tu zona por ahora.<br/>Vuelve a verificar en un momento.</p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={cargarSolicitudes}
                  style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                  🔄 Verificar de nuevo
                </motion.button>
              </motion.div>
            )}
            {/* ESTADO VACÍO CUANDO HAY VIAJES PERO NINGUNO PASA FILTROS */}
            {!cargando && !error && solicitudes.length > 0 && solicitudesFiltradas.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>Sin resultados con estos filtros</p>
                <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px' }}>Hay {solicitudes.length} viaje(s) disponibles, pero ninguno coincide.</p>
                <button onClick={() => setFiltros({ tipo: 'todos', pasajeros: 'todos', mascotas: false })}
                  style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, borderRadius: '8px', padding: '7px 14px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                  Limpiar filtros
                </button>
              </motion.div>
            )}
            {/* TARJETAS */}
            {!cargando && solicitudesFiltradas.map((sol) => {
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
        {/* PESTAÑA MIS OFERTAS — SCRUM-83 y SCRUM-84 */}
        {pestanaActiva === 'activos' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={cargarViajesActivos}
                style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                🔄 Actualizar
              </button>
            </div>

            {viajesActivos.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Aún no has enviado ofertas</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Cuando hagas una oferta aparecerá aquí con su estado.</p>
              </motion.div>
            )}

            {viajesActivos.map((viaje) => {
              const esContraoferta = viaje.status === 'PASSENGER_COUNTER_OFFERED';
              const esAceptado = viaje.status === 'ACCEPTED';
              const esRechazado = viaje.status === 'REJECTED';

              const cfgEstado = {
                DRIVER_OFFERED:           { bg: '#fef3c7', color: '#92400e', label: '⏳ Esperando respuesta del pasajero' },
                PASSENGER_COUNTER_OFFERED:{ bg: '#dbeafe', color: '#1e40af', label: '🔄 Contraoferta recibida — ¡Responde!' },
                ACCEPTED:                 { bg: '#dcfce7', color: '#166534', label: '✅ Confirmado — Listo para iniciar' },
                REJECTED:                 { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' },
              };
              // Estado real del viaje (viene del trip_status)
              const cfgViaje = {
                ASSIGNED:    { bg: '#dcfce7', color: '#166534', label: '✅ Viaje confirmado' },
                IN_PROGRESS: { bg: '#dbeafe', color: '#1e40af', label: '🚗 Viaje en curso' },
                COMPLETED:   { bg: '#e0e7ff', color: '#3730a3', label: '🏁 Viaje completado' },
              };
              const estadoViaje = viaje.trip_status;
              const est = cfgEstado[viaje.status] || { bg: '#f1f5f9', color: '#475569', label: viaje.status };

              return (
                <motion.div key={viaje.offer_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: `1px solid ${esContraoferta ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', marginBottom: '12px',
                    boxShadow: esContraoferta ? '0 0 0 2px #3b82f633' : 'none', transition: 'all 0.2s' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {viaje.origin}</p>
                      <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>→ {viaje.destination}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>🗓️ {formatearFecha(viaje.departure_time)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: BRAND_GREEN }}>${Number(viaje.offered_price).toLocaleString()}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                        {esContraoferta ? 'Precio del pasajero' : 'Tu oferta'}
                      </p>
                    </div>
                  </div>

                  <span style={{ display: 'inline-block', backgroundColor: est.bg, color: est.color, borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', marginBottom: esContraoferta ? '10px' : '0' }}>
                    {est.label}
                  </span>

                  {/* SCRUM-84: Botones para responder contraoferta */}
                  {esContraoferta && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'ACCEPT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'ACCEPT'}
                        style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'ACCEPT' ? '...' : '✅ Aceptar precio'}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'REJECT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'REJECT'}
                        style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'REJECT' ? '...' : '❌ Rechazar'}
                      </motion.button>
                    </div>
                  )}

                  {/* HU17: Botones de gestión del viaje */}
                  {/* HU10: Botón ver ocupantes */}
                  {esAceptado && (estadoViaje === 'ASSIGNED' || estadoViaje === 'IN_PROGRESS') && (
                    <button
                      onClick={async () => {
                        await cargarOcupantes(viaje.request_id);
                        setModalOcupantesId(viaje.request_id);
                      }}
                      style={{ marginTop: '10px', width: '100%', padding: '9px', background: '#dcfce7', border: '1px solid #16a34a', borderRadius: '8px', color: '#14532d', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      👥 Ver ocupantes del viaje
                    </button>
                  )}

                  {esAceptado && estadoViaje === 'ASSIGNED' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                        🎉 Viaje confirmado — cuando recojas al pasajero, inicia el viaje
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'start')}
                        disabled={gestionandoViaje === viaje.request_id + 'start'}
                        style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'start' ? '...' : '🚗 Iniciar viaje'}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'IN_PROGRESS' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: '#dbeafe', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>
                        🚗 Viaje en curso — finaliza cuando llegues al destino
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'complete')}
                        disabled={gestionandoViaje === viaje.request_id + 'complete'}
                        style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'complete' ? '...' : '🏁 Finalizar viaje'}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'COMPLETED' && (
                    <div style={{ marginTop: '10px', backgroundColor: '#e0e7ff', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#3730a3', fontWeight: '600', textAlign: 'center' }}>
                      🏁 Viaje completado — ¡Buen trabajo!
                    </div>
                  )}
                </motion.div>
              );
            })}
          </>
        )}
      </div>
    </div>

      {/* PANEL NOTIFICACIONES CONDUCTOR */}
      <AnimatePresence>
        {mostrarNotifPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMostrarNotifPanel(false)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000 }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
              style={{ position: 'fixed', top: 0, right: 0, width: '360px', maxWidth: '100vw', height: '100vh', backgroundColor: '#fff', zIndex: 3001, boxShadow: '-5px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

              {/* Header notif */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>🔔 Notificaciones</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {notificaciones.filter(n => !n.is_read).length} sin leer
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {notificaciones.filter(n => !n.is_read).length > 0 && (
                    <button onClick={marcarTodasLeidas}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                      ✓ Leer todas
                    </button>
                  )}
                  <button onClick={() => setMostrarNotifPanel(false)}
                    style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>
              </div>

              {/* Lista notif */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {notificaciones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔕</div>
                    <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>Sin notificaciones</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Aquí verás cuando el pasajero responda.</p>
                  </div>
                )}
                {notificaciones.map((notif) => {
                  const cfg = {
                    NEW_OFFER:      { icono: '💰', color: '#7c3aed', bg: '#f5f3ff' },
                    COUNTER_OFFER:  { icono: '🔄', color: '#1d4ed8', bg: '#eff6ff' },
                    TRIP_ACCEPTED:  { icono: '✅', color: '#15803d', bg: '#f0fdf4' },
                    TRIP_REJECTED:  { icono: '❌', color: '#dc2626', bg: '#fef2f2' },
                    TRIP_STARTED:   { icono: '🚗', color: '#0369a1', bg: '#f0f9ff' },
                    TRIP_COMPLETED: { icono: '🏁', color: '#4f46e5', bg: '#eef2ff' },
                    SYSTEM:         { icono: '📢', color: '#64748b', bg: '#f8fafc' },
                  }[notif.type] || { icono: '📢', color: '#64748b', bg: '#f8fafc' };

                  return (
                    <div key={notif.notification_id}
                      onClick={() => !notif.is_read && marcarLeida(notif.notification_id)}
                      style={{ backgroundColor: notif.is_read ? '#fff' : cfg.bg, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', border: `1px solid ${notif.is_read ? '#e2e8f0' : cfg.color + '33'}`, cursor: notif.is_read ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{cfg.icono}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ margin: 0, fontWeight: notif.is_read ? '600' : '700', fontSize: '13px', color: notif.is_read ? '#475569' : '#1e293b' }}>
                              {notif.title}
                            </p>
                            {!notif.is_read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0, marginTop: '3px' }} />}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>{notif.message}</p>
                          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(notif.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL OCUPANTES FUEC — position fixed */}
      <AnimatePresence>
        {modalOcupantesId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalOcupantesId(null)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9000 }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ pointerEvents: 'all', width: '440px', maxWidth: '95vw', maxHeight: '80vh', backgroundColor: '#0f1a0f', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: BRAND_GREEN }}>Documento de viaje</p>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f0fdf4', fontFamily: "'Syne', sans-serif" }}>Ocupantes registrados</h3>
                </div>
                <button onClick={() => setModalOcupantesId(null)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '30px', height: '30px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {!ocupantesPorViaje[modalOcupantesId] || ocupantesPorViaje[modalOcupantesId].length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>El pasajero aún no ha registrado los ocupantes.</p>
                  </div>
                ) : (
                  ocupantesPorViaje[modalOcupantesId].map((oc, i) => (
                    <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#f0fdf4' }}>{oc.full_name}</p>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Ocupante {i + 1}</p>
                      </div>
                      <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: BRAND_GREEN }}>
                        {oc.document_type} {oc.document_number}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <button onClick={() => setModalOcupantesId(null)}
                  style={{ width: '100%', padding: '11px', background: `linear-gradient(135deg, ${BRAND_GREEN}, #16a34a)`, border: 'none', borderRadius: '9px', color: '#052e16', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
                  Cerrar
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default PanelConductor;
