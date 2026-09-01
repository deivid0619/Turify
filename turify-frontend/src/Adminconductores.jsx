import { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

import API_BASE_URL from './api';
import { T, Icono, IconReloj, IconVisto, IconEquis, IconClipboard, IconRecibo, IconGorro, IconAuto } from './diseno';
const BRAND_GREEN = T.ruta;
const FOREST = T.monte;

const ETIQUETA_DOCUMENTO = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Revisión Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros (Contractual y Extracontractual)',
  'RUNT': 'RUNT (experiencia)',
};

const IconEscudo = (p) => <Icono {...p}><path d="M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6l-7-2.8Z" /><path d="M9 12l2.2 2.2L15.4 10" /></Icono>;
const IconLlave  = (p) => <Icono {...p}><circle cx="8.5" cy="12" r="3.6" /><path d="M12.1 12H20M17 12v3M20 12v2.4" /></Icono>;
const IconTarjeta = (p) => <Icono {...p}><rect x="3" y="6" width="18" height="12" rx="2.4" /><path d="M3 10h18M6.5 14h4" /></Icono>;

const ICONO_DOCUMENTO = {
  'SOAT': IconEscudo,
  'Licencia de Conduccion': IconTarjeta,
  'Tarjeta de operacion': IconClipboard,
  'Tecnomecanica': IconLlave,
  'Seguros Contractual y extracontractual': IconRecibo,
  'RUNT': IconGorro,
};
const BadgeEstado = ({ estado }) => {
  const config = {
    PENDING:  { bg: T.chivaSuave,  color: T.chivaTexto,  Ico: IconReloj, label: 'Pendiente' },
    APPROVED: { bg: T.musgo,       color: T.musgoTexto,  Ico: IconVisto, label: 'Aprobado' },
    REJECTED: { bg: T.alertaSuave, color: T.alertaTexto, Ico: IconEquis, label: 'Rechazado' },
  };
  const c = config[estado] || config.PENDING;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: c.bg, color: c.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
      <c.Ico size={12} />{c.label}
    </span>
  );
};

const esPDF = (url) => url?.toLowerCase().includes('.pdf');

// Convierte PDF de Cloudinary a imagen JPG de la primera página
// Funciona cambiando la extensión y asegurando image/upload
const getPDFcomoImagen = (url) => {
  if (!url) return url;
  // Asegurar que sea image/upload
  let u = url;
  if (u.includes('/raw/upload/')) {
    u = u.replace('/raw/upload/', '/image/upload/');
  }
  // Cambiar extensión .pdf a .jpg
  if (u.toLowerCase().endsWith('.pdf')) {
    u = u.slice(0, -4) + '.jpg';
  }
  return u;
};

const getUrlPreview = (url) => {
  if (!url) return url;
  if (url.includes('/raw/upload/') && esPDF(url)) {
    return url.replace('/raw/upload/', '/image/upload/');
  }
  return url;
};

const VisorPDF = ({ url, documentId, token }) => {
  const [error, setError] = useState(false);
  const urlImagen = getPDFcomoImagen(url);

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px', color: 'var(--t-piedra)' }}>
      <div style={{ fontSize: '32px' }}>📄</div>
      <p style={{ margin: 0, fontSize: '14px' }}>No se pudo mostrar la vista previa.</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600' }}>
        Descargar documento →
      </a>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', backgroundColor: '#525659', overflow: 'auto' }}>
      <img
        src={urlImagen}
        alt="Vista previa del documento"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', borderRadius: '4px' }}
        onError={() => setError(true)}
      />
    </div>
  );
};


const ModalDocumento = ({ doc, onCerrar, token }) => {
  const urlOriginal = doc.file_url;
  const pdf = esPDF(urlOriginal);
  const urlPreview = getUrlPreview(urlOriginal);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCerrar}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        style={{ position: 'relative', backgroundColor: 'var(--t-papel)', borderRadius: '16px', overflow: 'hidden', width: '82vw', maxWidth: '960px', height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', backgroundColor: 'var(--t-tinta)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', color: T.piedra }}>
              {(() => { const I = ICONO_DOCUMENTO[doc.document_type] || IconClipboard; return <I size={17} />; })()}
            </span>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{ETIQUETA_DOCUMENTO[doc.document_type] || doc.document_type}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <a href={urlOriginal} target="_blank" rel="noopener noreferrer"
              style={{ background: '#3b82f6', color: '#fff', padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
              Descargar →
            </a>
            <button onClick={onCerrar}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {pdf ? (
            <VisorPDF url={urlPreview} documentId={doc.document_id} token={token} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', backgroundColor: 'var(--t-niebla-2)' }}>
              <img src={urlOriginal} alt="Documento" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};


const AdminConductores = () => {
  const { token, cerrarSesion } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCerrarSesion = () => { cerrarSesion(); navigate('/login'); };

  const [conductores, setConductores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  // HU21 — años de experiencia que el admin está editando por documento RUNT (document_id -> texto)
  const [experienciaEditada, setExperienciaEditada] = useState({});

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

  useEffect(() => {
    if (conductorSeleccionado) {
      const actualizado = conductores.find(c => c.user_id === conductorSeleccionado.user_id);
      if (actualizado) setConductorSeleccionado(actualizado);
    }
  }, [conductores]);

  const verificarDocumento = async (documentId, nuevoEstado, yearsExperience) => {
    setProcesando(documentId);
    try {
      const body = { verification_status: nuevoEstado };
      if (yearsExperience !== undefined && yearsExperience !== null && yearsExperience !== '') {
        body.years_experience = parseInt(yearsExperience, 10);
      }
      const res = await fetch(`${API_BASE_URL}/admin/documents/${documentId}/verify`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error al verificar.'); }
      const data = await res.json();
      mostrarAlerta('exito', data.message);

      setConductores(prev => prev.map(c => {
        if (!c.documents.some(d => d.document_id === documentId)) return c;
        return {
          ...c,
          conductor_verificado: c.documents.find(d => d.document_id === documentId)?.document_type === 'RUNT'
            ? nuevoEstado === 'APPROVED'
            : c.conductor_verificado,
          documents: c.documents.map(d =>
            d.document_id === documentId
              ? { ...d, verification_status: nuevoEstado, years_experience: body.years_experience ?? d.years_experience }
              : d
          )
        };
      }));
    } catch (err) {
      mostrarAlerta('error', err.message);
    } finally {
      setProcesando(null);
    }
  };

  // El RUNT es opcional y posterior al registro — no cuenta para "conductor habilitado"
  const todosAprobados = (conductor) =>
    conductor.documents.filter(d => d.document_type !== 'RUNT').every(d => d.verification_status === 'APPROVED');
  const contarPendientes = (conductor) => conductor.documents.filter(d => d.verification_status === 'PENDING').length;

  const totalPendientes = conductores.reduce((acc, c) => acc + contarPendientes(c), 0);
  const totalVerificados = conductores.filter(c => c.conductor_verificado).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--t-niebla-2)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');`}</style>

      {/* MODAL PREVIEW */}
      <AnimatePresence>
        {docPreview && <ModalDocumento doc={docPreview} onCerrar={() => setDocPreview(null)} token={token} />}
      </AnimatePresence>

      {/* BARRA SUPERIOR — mínima, el chrome de marca vive en el panel lateral. Este panel
          ES el punto de entrada del admin (no hay dashboard de pasajero de por medio),
          así que aquí van las acciones de cuenta en vez de un botón "volver". */}
      <header style={{ padding: '18px 32px 0', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => navigate('/admin/logs')}
          style={{ background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--t-piedra)', fontWeight: '600' }}>
          📋 Ver Logs
        </button>
        <button onClick={handleCerrarSesion}
          style={{ background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--t-alerta-texto)', fontWeight: '600' }}>
          🚪 Cerrar sesión
        </button>
      </header>

      {/* ALERTA */}
      <AnimatePresence>
        {alerta && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              margin: '16px 32px 0', padding: '12px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
              backgroundColor: alerta.tipo === 'exito' ? 'var(--t-musgo)' : 'var(--t-alerta-suave)',
              color: alerta.tipo === 'exito' ? BRAND_GREEN : 'var(--t-alerta-texto)',
              border: `1px solid ${alerta.tipo === 'exito' ? BRAND_GREEN : 'var(--t-alerta-linea)'}`
            }}>
            {alerta.tipo === 'exito' ? '✅' : '⚠️'} {alerta.mensaje}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHELL — sidebar forest + hoja clara, mismo patrón que el panel de conductor */}
      <div style={{ padding: '20px 32px 32px' }}>
        <div style={{ display: 'flex', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 10px 36px rgba(5,46,22,0.14)', minHeight: '640px' }}>

          {/* SIDEBAR */}
          <aside style={{ width: '330px', flexShrink: 0, background: FOREST, color: 'var(--t-musgo)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '22px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '18px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: 'var(--t-ruta)' }} />
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', color: 'rgba(240,253,244,0.9)' }}>TURIFY · ADMIN</span>
              </div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>Verificación</h1>
              <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'rgba(240,253,244,0.5)' }}>Documentos y experiencia de conductores</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '4px 20px 14px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <b style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#fde047' }}>{totalPendientes}</b>
                <span style={{ fontSize: '9.5px', color: 'rgba(240,253,244,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Docs pendientes</span>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <b style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#86efac' }}>{conductores.length}</b>
                <span style={{ fontSize: '9.5px', color: 'rgba(240,253,244,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En cola</span>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <b style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: 'var(--t-chiva-linea)' }}>{totalVerificados}</b>
                <span style={{ fontSize: '9.5px', color: 'rgba(240,253,244,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎓 Verificados</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
              {cargando && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(240,253,244,0.5)', fontSize: '13px' }}>⏳ Cargando...</div>}

              {!cargando && error && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--t-alerta-linea)', fontSize: '12.5px' }}>
                  ⚠️ {error}<br />
                  <button onClick={cargarConductores} style={{ marginTop: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: 'var(--t-musgo)', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    Reintentar
                  </button>
                </div>
              )}

              {!cargando && !error && conductores.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--t-musgo)', fontSize: '13px' }}>Todo al día</p>
                  <p style={{ margin: '4px 0 0', color: 'rgba(240,253,244,0.5)', fontSize: '12px' }}>No hay documentos pendientes.</p>
                </div>
              )}

              {!cargando && conductores.map((conductor) => {
                const pendientes = contarPendientes(conductor);
                const estaSeleccionado = conductorSeleccionado?.user_id === conductor.user_id;
                return (
                  <motion.div key={conductor.user_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => setConductorSeleccionado(estaSeleccionado ? null : conductor)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 10px', borderRadius: '11px',
                      cursor: 'pointer', marginBottom: '4px', transition: 'background .15s',
                      background: estaSeleccionado ? 'rgba(34,197,94,0.16)' : 'transparent',
                      border: estaSeleccionado ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent'
                    }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                      {conductor.profile_photo_url
                        ? <img src={conductor.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: 'var(--t-musgo)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {conductor.full_name}
                        {conductor.conductor_verificado && <span style={{ fontSize: '10px' }}>🎓</span>}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'rgba(240,253,244,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conductor.email}</p>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '100px',
                      background: pendientes > 0 ? 'rgba(250,204,21,0.18)' : 'rgba(34,197,94,0.2)',
                      color: pendientes > 0 ? '#fde047' : '#86efac'
                    }}>
                      {pendientes > 0 ? pendientes : '✓'}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={cargarConductores} disabled={cargando}
                style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(240,253,244,0.8)', padding: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                {cargando ? '···' : '🔄 Actualizar'}
              </motion.button>
            </div>
          </aside>

          {/* HOJA CLARA — detalle del conductor */}
          <div style={{ flex: 1, background: 'var(--t-papel)', padding: '30px 34px', overflowY: 'auto' }}>
            <AnimatePresence mode="wait">
              {!conductorSeleccionado ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ padding: '80px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: 'var(--t-tinta)' }}>Selecciona un conductor</p>
                  <p style={{ margin: '6px 0 0', color: 'var(--t-piedra)', fontSize: '13px' }}>Haz clic en un conductor de la lista para revisar sus documentos.</p>
                </motion.div>
              ) : (
                <motion.div key={conductorSeleccionado.user_id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>

                  {/* Header conductor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '22px', marginBottom: '22px', borderBottom: '1px solid var(--t-linea)' }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--t-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '24px' }}>
                      {conductorSeleccionado.profile_photo_url
                        ? <img src={conductorSeleccionado.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '👤'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: 'var(--t-tinta)' }}>{conductorSeleccionado.full_name}</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--t-piedra)' }}>{conductorSeleccionado.email} · {conductorSeleccionado.phone_number}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      {todosAprobados(conductorSeleccionado) && (
                        <span style={{ background: 'var(--t-musgo)', color: 'var(--t-musgo-texto)', padding: '7px 14px', borderRadius: '9px', fontWeight: '700', fontSize: '12px' }}>
                          ✅ Conductor habilitado
                        </span>
                      )}
                      {conductorSeleccionado.conductor_verificado && (
                        <span style={{ background: 'var(--t-chiva-suave)', color: 'var(--t-chiva-texto)', padding: '7px 14px', borderRadius: '9px', fontWeight: '700', fontSize: '12px' }}>
                          🎓 Experiencia verificada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lista documentos */}
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {conductorSeleccionado.documents.map((doc) => {
                      const esRunt = doc.document_type === 'RUNT';
                      return (
                        <div key={doc.document_id}
                          style={{
                            border: `1px solid ${esRunt ? 'var(--t-chiva-linea)' : 'var(--t-linea)'}`, borderRadius: '12px', padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: '14px',
                            background: esRunt
                              ? 'linear-gradient(135deg,#fffdf5,#fefce8)'
                              : (doc.verification_status === 'APPROVED' ? 'var(--t-musgo)' : doc.verification_status === 'REJECTED' ? '#fff5f5' : '#fff')
                          }}>

                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', background: esRunt ? 'var(--t-chiva-suave)' : 'var(--t-niebla)' }}>
                            {(() => { const I = ICONO_DOCUMENTO[doc.document_type] || IconClipboard; return <I size={17} />; })()}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '13.5px', color: 'var(--t-tinta)' }}>
                              {ETIQUETA_DOCUMENTO[doc.document_type] || doc.document_type}
                            </p>
                            <button
                              onClick={() => setDocPreview(doc)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', fontSize: '11.5px', cursor: 'pointer', fontWeight: '600', marginTop: '3px', textDecoration: 'underline' }}>
                              👁️ Ver documento
                            </button>
                            {esRunt && (
                              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label style={{ fontSize: '11px', color: '#92702f', fontWeight: '600' }}>Años de experiencia:</label>
                                <input
                                  type="number" min="0" max="80"
                                  disabled={doc.verification_status !== 'PENDING'}
                                  value={experienciaEditada[doc.document_id] ?? doc.years_experience ?? ''}
                                  onChange={e => setExperienciaEditada(prev => ({ ...prev, [doc.document_id]: e.target.value }))}
                                  style={{ width: '54px', padding: '4px 6px', border: '1px solid #fbbf24', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--t-chiva-texto)' }}
                                />
                              </div>
                            )}
                          </div>

                          <BadgeEstado estado={doc.verification_status} />

                          {doc.verification_status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              <motion.button whileTap={{ scale: 0.95 }}
                                onClick={() => verificarDocumento(doc.document_id, 'APPROVED', experienciaEditada[doc.document_id] ?? doc.years_experience)}
                                disabled={procesando === doc.document_id}
                                style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '7px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                                {procesando === doc.document_id ? '...' : '✅ Aprobar'}
                              </motion.button>
                              <motion.button whileTap={{ scale: 0.95 }}
                                onClick={() => verificarDocumento(doc.document_id, 'REJECTED')}
                                disabled={procesando === doc.document_id}
                                style={{ background: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', border: 'none', borderRadius: '7px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                                {procesando === doc.document_id ? '...' : '❌ Rechazar'}
                              </motion.button>
                            </div>
                          )}

                          {doc.verification_status !== 'PENDING' && (
                            <button onClick={() => verificarDocumento(doc.document_id, 'PENDING')}
                              style={{ background: 'none', border: '1px solid var(--t-linea)', color: 'var(--t-piedra)', borderRadius: '7px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>
                              Revertir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {conductorSeleccionado.documents.some(d => d.document_type === 'RUNT') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', padding: '12px 16px', background: 'var(--t-niebla)', border: '1px dashed var(--t-linea)', borderRadius: '10px', fontSize: '12px', color: 'var(--t-piedra)' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--t-chiva),#facc15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>🎓</span>
                      Al aprobar el RUNT, el conductor recibe el sello dorado en su perfil público y en sus ofertas — sin afectar su rol de conductor ya activo.
                    </div>
                  )}

                  {/* Resumen */}
                  <div style={{ marginTop: '20px', padding: '14px', backgroundColor: 'var(--t-niebla)', borderRadius: '10px', border: '1px solid var(--t-linea)', display: 'flex', gap: '24px' }}>
                    {['PENDING', 'APPROVED', 'REJECTED'].map(estado => {
                      const count = conductorSeleccionado.documents.filter(d => d.verification_status === estado).length;
                      const cfg = { PENDING: { color: 'var(--t-chiva-texto)', label: 'Pendientes' }, APPROVED: { color: 'var(--t-musgo-texto)', label: 'Aprobados' }, REJECTED: { color: 'var(--t-alerta-texto)', label: 'Rechazados' } };
                      return (
                        <div key={estado} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: cfg[estado].color }}>{count}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--t-piedra)' }}>{cfg[estado].label}</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConductores;