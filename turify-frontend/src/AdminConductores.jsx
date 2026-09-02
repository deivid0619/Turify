import { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

import API_BASE_URL from './api';
import {
  T, EstilosBase, Chip, Rotulo, LogoWordmark, BotonTema, useTema,
  IconReloj, IconVisto, IconEquis, IconClipboard, IconRecibo, IconGorro,
  IconPersona, IconOjo, IconAlerta, IconEscudo, IconTarjeta, IconLlave,
  IconDocumento, IconDescargar, IconSalir, IconRecargar,
} from './diseno';

const ETIQUETA_DOCUMENTO = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Revisión Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros (Contractual y Extracontractual)',
  'RUNT': 'RUNT (experiencia)',
};

const ICONO_DOCUMENTO = {
  'SOAT': IconEscudo,
  'Licencia de Conduccion': IconTarjeta,
  'Tarjeta de operacion': IconClipboard,
  'Tecnomecanica': IconLlave,
  'Seguros Contractual y extracontractual': IconRecibo,
  'RUNT': IconGorro,
};

// Cada tipo de documento tiene su icono; si llega uno desconocido, va el clip.
const IconoDocumento = ({ tipo, size = 17 }) => {
  const I = ICONO_DOCUMENTO[tipo] || IconClipboard;
  return <I size={size} />;
};

// Texto sobre el verde monte — el monte es oscuro en los dos temas, así que
// acá los claros van fijos, igual que en el panel del conductor.
const CLARO = '#EAF2EC';
const claro = (a) => `rgba(234,242,236,${a})`;
const SOBRE_MONTE = { fondo: 'rgba(255,255,255,0.07)', linea: T.monteLinea };

const BadgeEstado = ({ estado }) => {
  const config = {
    PENDING:  { tono: 'chiva',  Ico: IconReloj, label: 'Pendiente' },
    APPROVED: { tono: 'verde',  Ico: IconVisto, label: 'Aprobado' },
    REJECTED: { tono: 'alerta', Ico: IconEquis, label: 'Rechazado' },
  };
  const c = config[estado] || config.PENDING;
  return (
    <Chip tono={c.tono} style={{ padding: '4px 11px', fontSize: '12px', flexShrink: 0, whiteSpace: 'nowrap' }}>
      <c.Ico size={13} />{c.label}
    </Chip>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px', color: T.piedra, fontFamily: T.ui }}>
      <IconDocumento size={34} />
      <p style={{ margin: 0, fontSize: '15px' }}>No se pudo mostrar la vista previa.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="t-foco"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: T.cieloTexto, fontSize: '14px', fontWeight: 600 }}>
        <IconDescargar size={14} />Descargar el documento
      </a>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', backgroundColor: T.niebla2, overflow: 'auto' }}>
      <img
        src={urlImagen}
        alt="Vista previa del documento"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 4px 20px rgba(0,0,0,0.28)', borderRadius: T.rDato }}
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.ui }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCerrar}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        style={{ position: 'relative', backgroundColor: T.papel, borderRadius: '16px', overflow: 'hidden', width: '82vw', maxWidth: '960px', height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>

        {/* Cabecera del visor — monte, igual que el resto de las cabeceras */}
        <div style={{ padding: '14px 20px', backgroundColor: T.monte, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ display: 'flex', color: T.chiva }}>
              <IconoDocumento tipo={doc.document_type} />
            </span>
            <span style={{ color: CLARO, fontWeight: 700, fontSize: '15px', fontFamily: T.display, letterSpacing: '-.01em' }}>
              {ETIQUETA_DOCUMENTO[doc.document_type] || doc.document_type}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            <a href={urlOriginal} target="_blank" rel="noopener noreferrer" className="t-foco"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, color: claro(0.9), padding: '7px 14px', borderRadius: T.rControl, fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
              <IconDescargar size={14} />Descargar
            </a>
            <button onClick={onCerrar} title="Cerrar" aria-label="Cerrar" className="t-foco"
              style={{ background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, color: claro(0.9), width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconEquis size={15} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {pdf ? (
            <VisorPDF url={urlPreview} documentId={doc.document_id} token={token} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', backgroundColor: T.niebla2 }}>
              <img src={urlOriginal} alt="Documento" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Contador del panel lateral — el número es dato, va en monoespaciada.
const Contador = ({ valor, etiqueta, color, Ico }) => (
  <div style={{ flex: 1, background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, borderRadius: T.rControl, padding: '10px 8px', textAlign: 'center' }}>
    <b style={{ display: 'block', fontFamily: T.dato, fontSize: '19px', fontWeight: 600, color }}>{valor}</b>
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '3px', fontFamily: T.dato, fontSize: '11px', color: claro(0.55), textTransform: 'uppercase', letterSpacing: '.1em' }}>
      <Ico size={12} />{etiqueta}
    </span>
  </div>
);


const AdminConductores = () => {
  const { token, cerrarSesion } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tema, alternarTema] = useTema();

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

  // Botón de la cabecera oscura — mismo gesto para la bitácora y el cierre de sesión.
  const estiloAccion = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`,
    borderRadius: T.rControl, padding: '9px 14px', cursor: 'pointer',
    fontSize: '13.5px', fontFamily: T.ui, fontWeight: 600, color,
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.niebla2, fontFamily: T.ui }}>
      <EstilosBase />

      {/* MODAL PREVIEW */}
      <AnimatePresence>
        {docPreview && <ModalDocumento doc={docPreview} onCerrar={() => setDocPreview(null)} token={token} />}
      </AnimatePresence>

      {/* CABECERA OSCURA — este panel ES el punto de entrada del admin (no hay
          dashboard de pasajero de por medio), así que acá van la marca y las
          acciones de cuenta en vez de un botón "volver". */}
      <header style={{ background: T.monte, padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <LogoWordmark alto={13} oscuro />
          <Rotulo style={{ color: claro(0.5) }}>Panel de administración</Rotulo>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => navigate('/admin/logs')} className="t-foco" style={estiloAccion(claro(0.9))}>
            <IconClipboard size={15} />Ver la bitácora
          </button>
          <BotonTema tema={tema} alternar={alternarTema} compacto />
          <button onClick={handleCerrarSesion} className="t-foco" style={estiloAccion(T.chiva)}>
            <IconSalir size={15} />Cerrar sesión
          </button>
        </div>
      </header>

      {/* ALERTA */}
      <AnimatePresence>
        {alerta && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              margin: '16px 32px 0', padding: '12px 18px', borderRadius: T.rControl, fontWeight: 600, fontSize: '14px',
              backgroundColor: alerta.tipo === 'exito' ? T.musgo : T.alertaSuave,
              color: alerta.tipo === 'exito' ? T.musgoTexto : T.alertaTexto,
              border: `1px solid ${alerta.tipo === 'exito' ? T.musgoLinea : T.alertaLinea}`
            }}>
            {alerta.tipo === 'exito' ? <IconVisto size={16} /> : <IconAlerta size={16} />}
            {alerta.mensaje}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHELL — panel monte + hoja clara, mismo patrón que el panel del conductor */}
      <div style={{ padding: '20px 32px 32px' }}>
        <div style={{ display: 'flex', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 10px 36px rgba(5,46,22,0.14)', minHeight: '640px' }}>

          {/* PANEL LATERAL — la cola de verificación */}
          <aside style={{ width: '330px', flexShrink: 0, background: T.monte, color: CLARO, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '22px 20px 16px' }}>
              <Rotulo style={{ color: claro(0.45), marginBottom: '10px' }}>Cola de verificación</Rotulo>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, fontFamily: T.display, letterSpacing: '-.02em', color: CLARO }}>Verificación</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: claro(0.5) }}>Documentos y experiencia de conductores</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '4px 20px 14px' }}>
              <Contador valor={totalPendientes} etiqueta="Pendientes" color={T.chiva} Ico={IconReloj} />
              <Contador valor={conductores.length} etiqueta="En cola" color={CLARO} Ico={IconPersona} />
              <Contador valor={totalVerificados} etiqueta="Verificados" color={T.ruta} Ico={IconGorro} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
              {cargando && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '30px', color: claro(0.5), fontSize: '14px' }}>
                  <IconReloj size={15} />Cargando
                </div>
              )}

              {!cargando && error && (
                <div style={{ textAlign: 'center', padding: '20px', color: T.chiva, fontSize: '13.5px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <IconAlerta size={15} />{error}
                  </span>
                  <br />
                  <button onClick={cargarConductores} className="t-foco"
                    style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '7px', background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, color: claro(0.85), padding: '7px 14px', borderRadius: T.rControl, cursor: 'pointer', fontSize: '13px', fontFamily: T.ui, fontWeight: 600 }}>
                    <IconRecargar size={14} />Reintentar
                  </button>
                </div>
              )}

              {!cargando && !error && conductores.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <span style={{ display: 'inline-flex', color: T.ruta, marginBottom: '10px' }}><IconVisto size={26} /></span>
                  <p style={{ margin: 0, fontWeight: 800, color: CLARO, fontSize: '15px', fontFamily: T.display }}>Todo al día</p>
                  <p style={{ margin: '4px 0 0', color: claro(0.5), fontSize: '13px' }}>No hay documentos pendientes.</p>
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
                      background: estaSeleccionado ? `color-mix(in srgb, ${T.ruta} 16%, transparent)` : 'transparent',
                      border: `1px solid ${estaSeleccionado ? T.ruta : 'transparent'}`
                    }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: SOBRE_MONTE.fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: claro(0.6) }}>
                      {conductor.profile_photo_url
                        ? <img src={conductor.profile_photo_url} alt="Foto del conductor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <IconPersona size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: CLARO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {conductor.full_name}
                        {conductor.conductor_verificado && (
                          <span title="Experiencia verificada" style={{ display: 'inline-flex', color: T.chiva, flexShrink: 0 }}>
                            <IconGorro size={13} />
                          </span>
                        )}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: '12.5px', color: claro(0.45), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conductor.email}</p>
                    </div>
                    <span style={{
                      flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: T.dato, fontSize: '12px', fontWeight: 600, padding: '3px 9px', borderRadius: T.rChip,
                      background: `color-mix(in srgb, ${pendientes > 0 ? T.chiva : T.ruta} 18%, transparent)`,
                      color: pendientes > 0 ? T.chiva : T.ruta
                    }}>
                      {pendientes > 0 ? pendientes : <IconVisto size={13} />}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.monteLinea}` }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={cargarConductores} disabled={cargando} className="t-foco"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, borderRadius: T.rControl, color: claro(0.85), padding: '10px', cursor: cargando ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontFamily: T.ui, fontWeight: 700 }}>
                <IconRecargar size={15} />{cargando ? 'Actualizando' : 'Actualizar'}
              </motion.button>
            </div>
          </aside>

          {/* HOJA CLARA — detalle del conductor */}
          <div style={{ flex: 1, background: T.papel, padding: '30px 34px', overflowY: 'auto' }}>
            <AnimatePresence mode="wait">
              {!conductorSeleccionado ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ padding: '80px 20px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', color: T.piedraClara, marginBottom: '14px' }}><IconClipboard size={40} /></span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: T.tinta, fontFamily: T.display, letterSpacing: '-.01em' }}>Elegí un conductor</p>
                  <p style={{ margin: '6px 0 0', color: T.piedra, fontSize: '14px' }}>Tocá un conductor de la lista para revisar sus documentos.</p>
                </motion.div>
              ) : (
                <motion.div key={conductorSeleccionado.user_id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>

                  {/* Encabezado del conductor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '22px', marginBottom: '22px', borderBottom: `1px solid ${T.linea}` }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', background: T.niebla, border: `1px solid ${T.linea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.piedraClara }}>
                      {conductorSeleccionado.profile_photo_url
                        ? <img src={conductorSeleccionado.profile_photo_url} alt="Foto del conductor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <IconPersona size={26} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.tinta, fontFamily: T.display, letterSpacing: '-.02em' }}>{conductorSeleccionado.full_name}</h3>
                      <p style={{ margin: '3px 0 0', fontSize: '13.5px', color: T.piedra }}>
                        {conductorSeleccionado.email}
                        {' · '}
                        <span style={{ fontFamily: T.dato, letterSpacing: '.06em' }}>{conductorSeleccionado.phone_number}</span>
                      </p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      {todosAprobados(conductorSeleccionado) && (
                        <Chip tono="verde" style={{ padding: '7px 13px', fontSize: '12.5px' }}>
                          <IconVisto size={14} />Conductor habilitado
                        </Chip>
                      )}
                      {conductorSeleccionado.conductor_verificado && (
                        <Chip tono="chiva" style={{ padding: '7px 13px', fontSize: '12.5px' }}>
                          <IconGorro size={14} />Experiencia verificada
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Lista de documentos */}
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {conductorSeleccionado.documents.map((doc) => {
                      const esRunt = doc.document_type === 'RUNT';
                      return (
                        <div key={doc.document_id}
                          style={{
                            border: `1px solid ${esRunt ? T.chivaLinea : T.linea}`, borderRadius: T.rTarjeta, padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: '14px',
                            background: esRunt
                              ? T.chivaSuave
                              : (doc.verification_status === 'APPROVED' ? T.musgo : doc.verification_status === 'REJECTED' ? T.alertaSuave : T.papel)
                          }}>

                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: esRunt ? T.papel : T.niebla, border: `1px solid ${esRunt ? T.chivaLinea : T.linea}`, color: esRunt ? T.chivaTexto : T.piedra }}>
                            <IconoDocumento tipo={doc.document_type} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '14.5px', color: T.tinta }}>
                              {ETIQUETA_DOCUMENTO[doc.document_type] || doc.document_type}
                            </p>
                            <button
                              onClick={() => setDocPreview(doc)} className="t-foco"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, color: T.cieloTexto, fontSize: '13px', fontFamily: T.ui, cursor: 'pointer', fontWeight: 600, marginTop: '4px' }}>
                              <IconOjo size={14} />Ver el documento
                            </button>
                            {esRunt && (
                              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <label style={{ fontSize: '12.5px', color: T.chivaTexto, fontWeight: 600 }}>Años de experiencia</label>
                                <input
                                  type="number" min="0" max="80"
                                  disabled={doc.verification_status !== 'PENDING'}
                                  value={experienciaEditada[doc.document_id] ?? doc.years_experience ?? ''}
                                  onChange={e => setExperienciaEditada(prev => ({ ...prev, [doc.document_id]: e.target.value }))}
                                  className="t-foco"
                                  style={{ width: '58px', padding: '5px 6px', border: `1px solid ${T.chivaLinea}`, borderRadius: T.rDato, background: T.papel, fontSize: '13px', fontFamily: T.dato, textAlign: 'center', fontWeight: 600, color: T.chivaTexto, outline: 'none' }}
                                />
                              </div>
                            )}
                          </div>

                          <BadgeEstado estado={doc.verification_status} />

                          {doc.verification_status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              <motion.button whileTap={{ scale: 0.95 }} className="t-foco"
                                onClick={() => verificarDocumento(doc.document_id, 'APPROVED', experienciaEditada[doc.document_id] ?? doc.years_experience)}
                                disabled={procesando === doc.document_id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.ruta, color: '#fff', border: '1px solid transparent', borderRadius: T.rControl, padding: '8px 14px', fontFamily: T.ui, fontWeight: 700, fontSize: '13px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                                <IconVisto size={14} />{procesando === doc.document_id ? 'Guardando' : 'Aprobar'}
                              </motion.button>
                              <motion.button whileTap={{ scale: 0.95 }} className="t-foco"
                                onClick={() => verificarDocumento(doc.document_id, 'REJECTED')}
                                disabled={procesando === doc.document_id}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.alertaSuave, color: T.alertaTexto, border: `1px solid ${T.alertaLinea}`, borderRadius: T.rControl, padding: '8px 14px', fontFamily: T.ui, fontWeight: 700, fontSize: '13px', cursor: procesando === doc.document_id ? 'not-allowed' : 'pointer', opacity: procesando === doc.document_id ? 0.7 : 1 }}>
                                <IconEquis size={14} />{procesando === doc.document_id ? 'Guardando' : 'Rechazar'}
                              </motion.button>
                            </div>
                          )}

                          {doc.verification_status !== 'PENDING' && (
                            <button onClick={() => verificarDocumento(doc.document_id, 'PENDING')} className="t-foco"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: `1px solid ${T.linea}`, color: T.piedra, borderRadius: T.rControl, padding: '7px 12px', fontSize: '12.5px', fontFamily: T.ui, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                              <IconRecargar size={13} />Revertir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {conductorSeleccionado.documents.some(d => d.document_type === 'RUNT') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '16px', padding: '12px 16px', background: T.niebla, border: `1px dashed ${T.linea}`, borderRadius: T.rControl, fontSize: '13px', color: T.piedra }}>
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: T.chivaSuave, border: `1px solid ${T.chivaLinea}`, color: T.chivaTexto, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconGorro size={14} />
                      </span>
                      Al aprobar el RUNT, el conductor recibe el sello dorado en su perfil público y en sus ofertas — sin afectar su rol de conductor ya activo.
                    </div>
                  )}

                  {/* Resumen */}
                  <div style={{ marginTop: '20px', padding: '16px', backgroundColor: T.niebla, borderRadius: T.rControl, border: `1px solid ${T.linea}`, display: 'flex', gap: '28px' }}>
                    {['PENDING', 'APPROVED', 'REJECTED'].map(estado => {
                      const count = conductorSeleccionado.documents.filter(d => d.verification_status === estado).length;
                      const cfg = { PENDING: { color: T.chivaTexto, label: 'Pendientes' }, APPROVED: { color: T.musgoTexto, label: 'Aprobados' }, REJECTED: { color: T.alertaTexto, label: 'Rechazados' } };
                      return (
                        <div key={estado} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontFamily: T.dato, fontSize: '23px', fontWeight: 600, color: cfg[estado].color }}>{count}</p>
                          <Rotulo style={{ marginTop: '3px' }}>{cfg[estado].label}</Rotulo>
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
