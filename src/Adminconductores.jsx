import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://127.0.0.1:8000';
const BRAND_GREEN = '#16a34a';

const ETIQUETA_DOCUMENTO = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Revisión Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros (Contractual y Extracontractual)',
};

const BadgeEstado = ({ estado }) => {
  const config = {
    PENDING:  { bg: '#fef3c7', color: '#92400e', label: '⏳ Pendiente' },
    APPROVED: { bg: '#dcfce7', color: '#166534', label: '✅ Aprobado' },
    REJECTED: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' },
  };
  const c = config[estado] || config.PENDING;
  return (
    <span style={{ backgroundColor: c.bg, color: c.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
      {c.label}
    </span>
  );
};

const AdminConductores = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [conductores, setConductores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [procesando, setProcesando] = useState(null); // document_id en proceso
  const [alerta, setAlerta] = useState(null); // { tipo: 'exito'|'error', mensaje }

  const mostrarAlerta = (tipo, mensaje) => {
    setAlerta({ tipo, mensaje });
    setTimeout(() => setAlerta(null), 3500);
  };

  const cargarConductores = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drivers/pending`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error('No se pudieron cargar los conductores.');
      const data = await res.json();
      setConductores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (token) cargarConductores(); }, [token]);

  // Cuando se abre el modal de un conductor, sincronizamos con el estado actualizado
  useEffect(() => {
    if (conductorSeleccionado) {
      const actualizado = conductores.find(c => c.user_id === conductorSeleccionado.user_id);
      if (actualizado) setConductorSeleccionado(actualizado);
    }
  }, [conductores]);

  const verificarDocumento = async (documentId, nuevoEstado) => {
    setProcesando(documentId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/documents/${documentId}/verify`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ verification_status: nuevoEstado })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al verificar documento.');
      }
      const data = await res.json();
      mostrarAlerta('exito', data.message);

      // Actualizar estado local sin recargar todo
      setConductores(prev => prev.map(c => {
        if (!c.documents.some(d => d.document_id === documentId)) return c;
        return {
          ...c,
          documents: c.documents.map(d =>
            d.document_id === documentId ? { ...d, verification_status: nuevoEstado } : d
          )
        };
      }));
    } catch (err) {
      mostrarAlerta('error', err.message);
    } finally {
      setProcesando(null);
    }
  };

  const todosAprobados = (conductor) =>
    conductor.documents.every(d => d.verification_status === 'APPROVED');

  const contarPendientes = (conductor) =>
    conductor.documents.filter(d => d.verification_status === 'PENDING').length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            ← Dashboard
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Panel de Administración</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Verificación de documentos de conductores</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={cargarConductores}
          style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          🔄 Actualizar
        </motion.button>
      </header>

      {/* ALERTA GLOBAL */}
      <AnimatePresence>
        {alerta && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ margin: '16px 40px 0', padding: '12px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
              backgroundColor: alerta.tipo === 'exito' ? '#f0fdf4' : '#fee2e2',
              color: alerta.tipo === 'exito' ? BRAND_GREEN : '#991b1b',
              border: `1px solid ${alerta.tipo === 'exito' ? BRAND_GREEN : '#fca5a5'}` }}>
            {alerta.tipo === 'exito' ? '✅' : '⚠️'} {alerta.mensaje}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: '24px 40px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* LISTA DE CONDUCTORES */}
        <div style={{ flex: '0 0 380px' }}>
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
              Conductores pendientes
              {!cargando && <span style={{ marginLeft: '8px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 8px', fontSize: '12px' }}>{conductores.length}</span>}
            </h2>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>⏳ Cargando conductores...</div>
          )}

          {!cargando && error && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#dc2626', fontSize: '13px' }}>
              ⚠️ {error}
              <br />
              <button onClick={cargarConductores} style={{ marginTop: '10px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reintentar</button>
            </div>
          )}

          {!cargando && !error && conductores.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
              <p style={{ margin: 0, fontWeight: '700', color: '#1e293b' }}>Todo al día</p>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>No hay conductores con documentos pendientes.</p>
            </div>
          )}

          {!cargando && conductores.map((conductor) => {
            const pendientes = contarPendientes(conductor);
            const estaSeleccionado = conductorSeleccionado?.user_id === conductor.user_id;
            const aprobadoTotal = todosAprobados(conductor);

            return (
              <motion.div key={conductor.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setConductorSeleccionado(estaSeleccionado ? null : conductor)}
                style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', cursor: 'pointer', border: `1px solid ${estaSeleccionado ? BRAND_GREEN : '#e2e8f0'}`, boxShadow: estaSeleccionado ? `0 0 0 2px ${BRAND_GREEN}33` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Avatar */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {conductor.profile_photo_url
                      ? <img src={conductor.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '20px' }}>👤</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conductor.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conductor.email}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {aprobadoTotal
                      ? <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>✅ Completo</span>
                      : <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
                    }
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* PANEL DE DOCUMENTOS */}
        <div style={{ flex: 1 }}>
          <AnimatePresence mode="wait">
            {!conductorSeleccionado ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: '#1e293b' }}>Selecciona un conductor</p>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '13px' }}>Haz clic en un conductor de la lista para revisar sus documentos.</p>
              </motion.div>
            ) : (
              <motion.div key={conductorSeleccionado.user_id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

                {/* Header del conductor */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#f8fafc' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {conductorSeleccionado.profile_photo_url
                      ? <img src={conductorSeleccionado.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '24px' }}>👤</span>}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{conductorSeleccionado.full_name}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>{conductorSeleccionado.email} · {conductorSeleccionado.phone_number}</p>
                  </div>
                  {todosAprobados(conductorSeleccionado) && (
                    <div style={{ marginLeft: 'auto', background: '#dcfce7', color: '#166534', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px' }}>
                      ✅ Conductor habilitado
                    </div>
                  )}
                </div>

                {/* Lista de documentos */}
                <div style={{ padding: '20px 24px' }}>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Documentos ({conductorSeleccionado.documents.length})
                  </p>

                  {conductorSeleccionado.documents.map((doc, i) => (
                    <div key={doc.document_id}
                      style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: doc.verification_status === 'APPROVED' ? '#f0fdf4' : doc.verification_status === 'REJECTED' ? '#fff5f5' : '#fff' }}>

                      {/* Ícono tipo documento */}
                      <div style={{ fontSize: '22px', flexShrink: 0 }}>
                        {{ 'SOAT': '🛡️', 'Licencia de Conduccion': '🪪', 'Tarjeta de operacion': '📋', 'Tecnomecanica': '🔧', 'Seguros Contractual y extracontractual': '📄' }[doc.document_type] || '📁'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                          {ETIQUETA_DOCUMENTO[doc.document_type] || doc.document_type}
                        </p>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', display: 'inline-block', marginTop: '2px' }}>
                          Ver documento →
                        </a>
                      </div>

                      <BadgeEstado estado={doc.verification_status} />

                      {/* Botones aprobar/rechazar — solo si está PENDING */}
                      {doc.verification_status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => verificarDocumento(doc.document_id, 'APPROVED')}
                            disabled={procesando === doc.document_id}
                            style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '7px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                            {procesando === doc.document_id ? '...' : '✅ Aprobar'}
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => verificarDocumento(doc.document_id, 'REJECTED')}
                            disabled={procesando === doc.document_id}
                            style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '7px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                            {procesando === doc.document_id ? '...' : '❌ Rechazar'}
                          </motion.button>
                        </div>
                      )}

                      {/* Si ya fue revisado, opción de revertir */}
                      {doc.verification_status !== 'PENDING' && (
                        <button
                          onClick={() => verificarDocumento(doc.document_id, 'PENDING')}
                          style={{ background: 'none', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '7px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>
                          Revertir
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Resumen */}
                  <div style={{ marginTop: '20px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', gap: '20px' }}>
                    {['PENDING', 'APPROVED', 'REJECTED'].map(estado => {
                      const count = conductorSeleccionado.documents.filter(d => d.verification_status === estado).length;
                      const config = { PENDING: { color: '#92400e', label: 'Pendientes' }, APPROVED: { color: '#166534', label: 'Aprobados' }, REJECTED: { color: '#991b1b', label: 'Rechazados' } };
                      return (
                        <div key={estado} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: config[estado].color }}>{count}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{config[estado].label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminConductores;