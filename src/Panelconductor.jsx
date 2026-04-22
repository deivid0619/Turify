import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';

const BRAND_GREEN = '#16a34a';
const API_BASE_URL = 'http://127.0.0.1:8000';

const PanelConductor = () => {
  const { token, usuario } = useContext(AuthContext);

  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [precio, setPrecio] = useState('');
  const [enviandoOferta, setEnviandoOferta] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  const cargarSolicitudes = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!res.ok) throw new Error('Error al cargar solicitudes');
      const data = await res.json();
      setSolicitudes(data);
    } catch (err) {
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (token) cargarSolicitudes();
  }, [token]);

  const enviarOferta = async () => {
    if (!precio || isNaN(precio) || Number(precio) <= 0) {
      alert('Ingresa un precio válido mayor a 0.');
      return;
    }
    setEnviandoOferta(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${solicitudSeleccionada.request_id}/offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ offered_price: Number(precio) })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al enviar oferta');
      }

      setMensajeExito('¡Oferta enviada exitosamente!');
      setPrecio('');
      setSolicitudSeleccionada(null);
      setTimeout(() => setMensajeExito(''), 3000);
      cargarSolicitudes();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setEnviandoOferta(false);
    }
  };

  const formatearFecha = (fecha) => {
    try {
      return new Date(fecha).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
      border: '1px solid #e2e8f0'
    }}>
      {/* HEADER */}
      <div style={{
        background: `linear-gradient(135deg, ${BRAND_GREEN}, #15803d)`,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '700' }}>
            🚗 Panel del Conductor
          </h3>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
            Hola, {usuario?.full_name?.split(' ')[0] || 'Conductor'}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={cargarSolicitudes}
          disabled={cargando}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            color: '#fff',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          {cargando ? '⏳' : '🔄 Actualizar'}
        </motion.button>
      </div>

      {/* CONTENIDO */}
      <div style={{ padding: '16px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>

        {/* Mensaje de éxito */}
        <AnimatePresence>
          {mensajeExito && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                backgroundColor: '#f0fdf4',
                border: `1px solid ${BRAND_GREEN}`,
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                color: BRAND_GREEN,
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              ✅ {mensajeExito}
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL ENVIAR OFERTA */}
        <AnimatePresence>
          {solicitudSeleccionada && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                    📍 {solicitudSeleccionada.origin}
                  </p>
                  <p style={{ margin: '2px 0', fontWeight: '700', fontSize: '13px', color: BRAND_GREEN }}>
                    → {solicitudSeleccionada.destination}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                    🗓️ {formatearFecha(solicitudSeleccionada.departure_time)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    👥 {(solicitudSeleccionada.adults_count || 1) + (solicitudSeleccionada.children_count || 0)} pasajero(s)
                    {solicitudSeleccionada.has_pets ? ' · 🐾 Mascota' : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setSolicitudSeleccionada(null); setPrecio(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
                >×</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{
                    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                    color: '#64748b', fontSize: '14px', fontWeight: '700'
                  }}>$</span>
                  <input
                    type="number"
                    placeholder="Tu precio (COP)"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 24px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={enviarOferta}
                  disabled={enviandoOferta}
                  style={{
                    background: enviandoOferta ? '#9ca3af' : BRAND_GREEN,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: enviandoOferta ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {enviandoOferta ? '...' : 'Ofertar'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ESTADOS */}
        {cargando && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
            ⏳ Cargando solicitudes...
          </div>
        )}

        {!cargando && error && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626', fontSize: '13px' }}>
            ⚠️ {error}
            <br />
            <button onClick={cargarSolicitudes} style={{ marginTop: '8px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && solicitudes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
            <p style={{ margin: 0, fontSize: '13px' }}>No hay solicitudes pendientes en este momento.</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>Vuelve a revisar más tarde.</p>
          </div>
        )}

        {/* LISTA DE SOLICITUDES */}
        {!cargando && solicitudes.map((sol) => (
          <motion.div
            key={sol.request_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '12px',
              backgroundColor: solicitudSeleccionada?.request_id === sol.request_id ? '#f0fdf4' : '#fff',
              borderLeft: solicitudSeleccionada?.request_id === sol.request_id ? `3px solid ${BRAND_GREEN}` : '1px solid #e2e8f0',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                  📍 {sol.origin}
                </p>
                <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>
                  → {sol.destination}
                </p>
              </div>
              <span style={{
                fontSize: '10px',
                background: '#fef3c7',
                color: '#92400e',
                padding: '3px 8px',
                borderRadius: '20px',
                fontWeight: '700',
                marginLeft: '8px'
              }}>
                {sol.trip_type === 'ROUND_TRIP' ? '↩ Ida y vuelta' : '→ Solo ida'}
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px' }}>
              <span>🗓️ Salida: {formatearFecha(sol.departure_time)}</span>
              {sol.return_time && <span>🔙 Regreso: {formatearFecha(sol.return_time)}</span>}
              <span>👥 {(sol.adults_count || 1) + (sol.children_count || 0)} pasajero(s){sol.has_pets ? ' · 🐾 Mascota' : ''}</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSolicitudSeleccionada(solicitudSeleccionada?.request_id === sol.request_id ? null : sol);
                setPrecio('');
              }}
              style={{
                width: '100%',
                background: solicitudSeleccionada?.request_id === sol.request_id ? '#e2e8f0' : BRAND_GREEN,
                color: solicitudSeleccionada?.request_id === sol.request_id ? '#475569' : '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {solicitudSeleccionada?.request_id === sol.request_id ? 'Cancelar' : '💰 Hacer oferta'}
            </motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PanelConductor;