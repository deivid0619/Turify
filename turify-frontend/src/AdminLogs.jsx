import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

import API_BASE_URL from './api';
const BRAND_GREEN = 'var(--t-ruta)';

const CONFIG_ACCION = {
  LOGIN:             { bg: 'var(--t-musgo)', color: 'var(--t-musgo-texto)', icono: '🔐', label: 'Login' },
  LOGIN_FAILED:      { bg: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', icono: '🚫', label: 'Login fallido' },
  REGISTER:          { bg: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', icono: '👤', label: 'Registro' },
  CREATE_TRIP:       { bg: 'var(--t-chiva-suave)', color: 'var(--t-chiva-texto)', icono: '🗺️', label: 'Viaje creado' },
  CREATE_OFFER:      { bg: '#f3e8ff', color: '#6b21a8', icono: '💰', label: 'Oferta enviada' },
  VERIFY_DOCUMENT:   { bg: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', icono: '📋', label: 'Doc. verificado' },
  REGISTER_DRIVER:   { bg: '#fdf4ff', color: '#7e22ce', icono: '🚗', label: 'Reg. conductor' },
};

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'LOGIN', label: '🔐 Login' },
  { value: 'LOGIN_FAILED', label: '🚫 Login fallido' },
  { value: 'REGISTER', label: '👤 Registro' },
  { value: 'CREATE_TRIP', label: '🗺️ Viajes' },
  { value: 'CREATE_OFFER', label: '💰 Ofertas' },
  { value: 'VERIFY_DOCUMENT', label: '📋 Verificaciones' },
];

const AdminLogs = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroAccion, setFiltroAccion] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargarLogs = async (accion = '') => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (accion) params.append('action', accion);

      const res = await fetch(`${API_BASE_URL}/admin/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (token) cargarLogs(filtroAccion); }, [token, filtroAccion]);

  const formatearFecha = (fecha) => {
    try {
      return new Date(fecha).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return fecha; }
  };

  const logsFiltrados = logs.filter(l => {
    if (!busqueda) return true;
    const texto = `${l.detail} ${l.action} ${l.ip_address} ${l.user_id}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  // Contadores por tipo
  const contadores = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--t-niebla-2)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* HEADER */}
      <header style={{ backgroundColor: 'var(--t-papel)', borderBottom: '1px solid var(--t-linea)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/admin/conductores')}
            style={{ background: 'none', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--t-piedra)', fontWeight: '600' }}>
            ← Panel Admin
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--t-tinta)' }}>Registro de Auditoría</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--t-piedra)' }}>Historial de acciones del sistema</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => cargarLogs(filtroAccion)}
          style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          🔄 Actualizar
        </motion.button>
      </header>

      <div style={{ padding: '24px 40px' }}>

        {/* TARJETAS RESUMEN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(CONFIG_ACCION).map(([accion, cfg]) => (
            <div key={accion}
              onClick={() => setFiltroAccion(filtroAccion === accion ? '' : accion)}
              style={{ backgroundColor: 'var(--t-papel)', borderRadius: '12px', padding: '14px', border: `1px solid ${filtroAccion === accion ? cfg.color : 'var(--t-linea)'}`, cursor: 'pointer', boxShadow: filtroAccion === accion ? `0 0 0 2px ${cfg.color}33` : 'none', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>{cfg.icono}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: cfg.color }}>{contadores[accion] || 0}</div>
              <div style={{ fontSize: '11px', color: 'var(--t-piedra)', marginTop: '2px' }}>{cfg.label}</div>
            </div>
          ))}
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div style={{ backgroundColor: 'var(--t-papel)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', border: '1px solid var(--t-linea)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Buscar en logs..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltroAccion(f.value)}
                style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s',
                  backgroundColor: filtroAccion === f.value ? 'var(--t-tinta)' : 'var(--t-niebla-2)',
                  color: filtroAccion === f.value ? '#fff' : 'var(--t-piedra)' }}>
                {f.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--t-piedra-clara)', marginLeft: 'auto' }}>
            {logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* TABLA DE LOGS */}
        <div style={{ backgroundColor: 'var(--t-papel)', borderRadius: '12px', border: '1px solid var(--t-linea)', overflow: 'hidden' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--t-piedra)' }}>⏳ Cargando logs...</div>
          ) : logsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--t-piedra)' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
              <p style={{ margin: 0 }}>No hay registros que mostrar.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--t-niebla)', borderBottom: '1px solid var(--t-linea)' }}>
                    {['ID', 'Acción', 'Usuario', 'Detalle', 'IP', 'Fecha'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: 'var(--t-piedra)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsFiltrados.map((log, i) => {
                    const cfg = CONFIG_ACCION[log.action] || { bg: 'var(--t-niebla-2)', color: 'var(--t-piedra)', icono: '📌', label: log.action };
                    return (
                      <tr key={log.log_id} style={{ borderBottom: '1px solid var(--t-niebla-2)', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--t-piedra-clara)', fontFamily: 'monospace' }}>#{log.log_id}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            {cfg.icono} {cfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--t-piedra)', fontFamily: 'monospace' }}>
                          {log.user_id ? `#${log.user_id}` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--t-tinta)', maxWidth: '300px' }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.detail}>
                            {log.detail || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--t-piedra)', fontFamily: 'monospace', fontSize: '12px' }}>
                          {log.ip_address || '—'}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--t-piedra)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {formatearFecha(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;