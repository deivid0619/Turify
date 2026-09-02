import { useState, useEffect, useContext } from 'react';
const IconIdea    = (p) => <Icono {...p}><path d="M9.5 17.5h5M10.5 20.5h3" /><path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6H9.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" /></Icono>;
const IconEmpresa = (p) => <Icono {...p}><path d="M4 20.5V6.5l7-3v17M11 20.5h9V10l-9-3.2" /><path d="M14.5 12.5h2M14.5 16h2M7 10h1M7 13.5h1" /></Icono>;
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const BRAND_GREEN = 'var(--t-ruta)';
import API_BASE_URL from './api';
import { T, Icono, IconPersona, IconAuto, IconReloj, IconVisto, IconBandera, IconEquis,
         IconCalendario, IconClipboard, IconGorro, IconRecibo, IconAlerta, IconEstrella, TableroRuta } from './diseno';

const IconEscudo  = (p) => <Icono {...p}><path d="M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6l-7-2.8Z" /><path d="M9 12l2.2 2.2L15.4 10" /></Icono>;
const IconTarjeta = (p) => <Icono {...p}><rect x="3" y="6" width="18" height="12" rx="2.4" /><path d="M3 10h18M6.5 14h4" /></Icono>;
const IconLlave   = (p) => <Icono {...p}><circle cx="8.5" cy="12" r="3.6" /><path d="M12.1 12H20M17 12v3M20 12v2.4" /></Icono>;
const IconCandado = (p) => <Icono {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></Icono>;
const IconLapiz   = (p) => <Icono {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M15.5 6.5 17.5 8.5" /></Icono>;
const IconSalir   = (p) => <Icono {...p}><path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8l-4 4 4 4M6 12h9" /></Icono>;

const ICONO_DOC = {
  'SOAT': IconEscudo,
  'Licencia de Conduccion': IconTarjeta,
  'Tarjeta de operacion': IconClipboard,
  'Tecnomecanica': IconLlave,
  'Seguros Contractual y extracontractual': IconRecibo,
  'RUNT': IconGorro,
};
const LABEL_DOC = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros',
  'RUNT': 'RUNT (experiencia)',
};

const ESTADO_DOC = {
  PENDING:  { bg: T.chivaSuave,  color: T.chivaTexto,  Ico: IconReloj, label: 'Pendiente' },
  APPROVED: { bg: T.musgo,       color: T.musgoTexto,  Ico: IconVisto, label: 'Aprobado' },
  REJECTED: { bg: T.alertaSuave, color: T.alertaTexto, Ico: IconEquis, label: 'Rechazado' },
};
const ESTADO_VIAJE = {
  PENDING:   { color: T.chivaTexto,  Ico: IconReloj,   label: 'Buscando conductor' },
  ASSIGNED:  { color: T.musgoTexto,  Ico: IconVisto,   label: 'Confirmado' },
  COMPLETED: { color: T.cieloTexto,  Ico: IconBandera, label: 'Completado' },
  CANCELLED: { color: T.alertaTexto, Ico: IconEquis,   label: 'Cancelado' },
};
const PerfilDrawer = ({ abierto, onCerrar }) => {
  const { token, usuario, cerrarSesion } = useContext(AuthContext);
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [seccion, setSeccion] = useState('perfil');

  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [guardandoTelefono, setGuardandoTelefono] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState('');
  const [exitoPassword, setExitoPassword] = useState(false);

  // HU37 — Subida de RUNT (experiencia del conductor)
  const [mostrarFormRunt, setMostrarFormRunt] = useState(false);
  const [archivoRunt, setArchivoRunt] = useState(null);
  const [aniosExperiencia, setAniosExperiencia] = useState('');
  const [categoriasLicencia, setCategoriasLicencia] = useState('');
  const [subiendoRunt, setSubiendoRunt] = useState(false);
  const [errorRunt, setErrorRunt] = useState('');

  const cargarPerfil = async () => {
    if (!token) return;
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/profile`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setPerfil(data);
        setNuevoTelefono(data.phone_number || '');
      }
    } catch (e) {
      console.error('Error cargando perfil:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (abierto) cargarPerfil(); }, [abierto]);

  const guardarTelefono = async () => {
    if (!nuevoTelefono.trim()) return;
    setGuardandoTelefono(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/phone`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ phone_number: nuevoTelefono })
      });
      if (!res.ok) throw new Error();
      setPerfil(prev => ({ ...prev, phone_number: nuevoTelefono }));
      setEditandoTelefono(false);
    } catch { alert('Error al actualizar el teléfono.'); }
    finally { setGuardandoTelefono(false); }
  };

  const cambiarPassword = async () => {
    setErrorPassword(''); setExitoPassword(false);
    if (passwordForm.new !== passwordForm.confirm) { setErrorPassword('Las contraseñas nuevas no coinciden.'); return; }
    if (passwordForm.new.length < 8) { setErrorPassword('Mínimo 8 caracteres.'); return; }
    setGuardandoPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/password`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ current_password: passwordForm.current, new_password: passwordForm.new })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      setExitoPassword(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setExitoPassword(false), 3000);
    } catch (e) { setErrorPassword(e.message || 'Error al cambiar la contraseña.'); }
    finally { setGuardandoPassword(false); }
  };

  // HU37 — Subir el RUNT con los años de experiencia declarados
  const subirRunt = async () => {
    setErrorRunt('');
    if (!archivoRunt) { setErrorRunt('Selecciona el archivo de tu RUNT (PDF o imagen).'); return; }
    if (aniosExperiencia === '' || Number(aniosExperiencia) < 0) { setErrorRunt('Ingresa tus años de experiencia.'); return; }

    setSubiendoRunt(true);
    try {
      const formData = new FormData();
      formData.append('years_experience', aniosExperiencia);
      if (categoriasLicencia.trim()) formData.append('license_categories', categoriasLicencia.trim());
      formData.append('doc_runt', archivoRunt);

      const res = await fetch(`${API_BASE_URL}/drivers/upload-runt`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: formData
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'No se pudo enviar el RUNT.'); }

      setMostrarFormRunt(false);
      setArchivoRunt(null);
      setAniosExperiencia('');
      setCategoriasLicencia('');
      await cargarPerfil();
    } catch (e) {
      setErrorRunt(e.message || 'No se pudo enviar el RUNT.');
    } finally {
      setSubiendoRunt(false);
    }
  };

  const handleCerrarSesion = () => { cerrarSesion(); onCerrar(); navigate('/login'); };

  const formatearFecha = (f) => {
    try { return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return f; }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCerrar}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />

          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
            style={{ position: 'fixed', top: 0, right: 0, width: '460px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--t-papel)', zIndex: 2001, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

            {/* CABECERA — monte, igual que la entrada y el panel del conductor */}
            <div style={{ background: T.monte, padding: '24px 20px 0', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              <svg viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14 }}>
                <g fill="none" stroke="#86EFAC" strokeWidth="1">
                  <path d="M-10 120 C 60 96, 130 140, 200 116 S 340 84, 410 108" />
                  <path d="M-10 142 C 60 118, 130 162, 200 138 S 340 106, 410 130" />
                  <path d="M-10 98 C 60 76, 130 118, 200 94 S 340 62, 410 88" />
                </g>
              </svg>

              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', border: `1px solid ${T.monteLinea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'rgba(234,242,236,.65)' }}>
                    {perfil?.profile_photo_url
                      ? <img src={perfil.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <IconPersona size={24} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '17px', color: '#fff', fontFamily: T.display, letterSpacing: '-.01em' }}>
                      {perfil?.full_name || usuario?.full_name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(234,242,236,.6)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {perfil?.email || usuario?.email}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '7px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.monteLinea}`, color: 'rgba(234,242,236,.85)', borderRadius: '20px', padding: '2px 9px', fontSize: '11.5px', fontWeight: 700 }}>
                        {perfil?.role === 'DRIVER' ? <IconAuto size={12} /> : perfil?.role === 'ADMIN' ? <IconEscudo size={12} /> : <IconPersona size={12} />}
                        {perfil?.role === 'DRIVER' ? 'Conductor' : perfil?.role === 'ADMIN' ? 'Admin' : 'Pasajero'}
                      </span>
                      {perfil?.role === 'DRIVER' && perfil?.conductor_verificado && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(233,161,59,.14)', border: '1px solid rgba(233,161,59,.32)', color: T.chiva, borderRadius: '20px', padding: '2px 9px', fontSize: '11.5px', fontWeight: 700 }}>
                          <IconGorro size={12} />Verificado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={onCerrar} title="Cerrar" className="t-foco"
                  style={{ background: 'none', border: 'none', color: 'rgba(234,242,236,.55)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconEquis size={16} />
                </button>
              </div>

              {/* Pestañas: subrayado, no píldoras — se leen como navegación */}
              <div style={{ position: 'relative', display: 'flex', gap: '22px', marginTop: '18px' }}>
                {[
                  { id: 'perfil', label: 'Perfil', Ico: IconPersona },
                  { id: 'historial', label: perfil?.role === 'DRIVER' ? 'Mis documentos' : 'Historial', Ico: perfil?.role === 'DRIVER' ? IconClipboard : IconCalendario },
                  { id: 'seguridad', label: 'Seguridad', Ico: IconCandado },
                ].map(tab => {
                  const activa = seccion === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setSeccion(tab.id)} className="t-foco"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
                        borderBottom: `2px solid ${activa ? T.chiva : 'transparent'}`,
                        padding: '8px 0 10px', cursor: 'pointer',
                        fontFamily: T.dato, fontSize: '11.5px', fontWeight: 500,
                        letterSpacing: '.12em', textTransform: 'uppercase',
                        color: activa ? '#fff' : 'rgba(234,242,236,.42)', transition: 'color .18s',
                      }}>
                      <tab.Ico size={13} />{tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTENIDO */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cargando && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t-piedra)' }}>Cargando perfil…</div>}

              {/* PERFIL */}
              {!cargando && seccion === 'perfil' && perfil && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</label>
                    {editandoTelefono ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} style={inputStyle} placeholder="Número de teléfono" />
                        <button onClick={guardarTelefono} disabled={guardandoTelefono}
                          style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '0 14px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                          {guardandoTelefono ? '...' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditandoTelefono(false)}
                          style={{ background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: 'none', borderRadius: '8px', padding: '0 12px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><IconEquis size={13} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '10px 12px', backgroundColor: 'var(--t-niebla)', borderRadius: '8px', border: '1px solid var(--t-linea)' }}>
                        <span style={{ fontSize: '15px', color: 'var(--t-tinta)' }}>{perfil.phone_number}</span>
                        <button onClick={() => setEditandoTelefono(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: T.ruta, cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: T.ui }}><IconLapiz size={12} />Editar</button>
                      </div>
                    )}
                  </div>

                  {[
                    { label: 'Nombre completo', value: perfil.full_name },
                    { label: 'Correo electrónico', value: perfil.email },
                    perfil.age ? { label: 'Edad', value: `${perfil.age} años` } : null,
                  ].filter(Boolean).map((campo, i) => (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{campo.label}</label>
                      <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: 'var(--t-niebla)', borderRadius: '8px', border: '1px solid var(--t-linea)', fontSize: '15px', color: 'var(--t-piedra)' }}>{campo.value}</div>
                    </div>
                  ))}

                  {/* Calificaciones — las reciben pasajeros y conductores por igual,
                      así que esta sección ya no vive dentro del ramal de conductor. */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: T.piedra, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Tus calificaciones
                    </label>
                    {perfil.rating_count > 0 ? (
                      <>
                        <div style={{ marginTop: '7px', padding: '13px 15px', background: T.chivaSuave, borderRadius: T.rTarjeta, border: `1px solid ${T.chivaLinea}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'flex', color: T.chiva }}>
                            <IconEstrella size={26} style={{ fill: 'currentColor' }} />
                          </span>
                          <div>
                            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: '22px', color: T.chivaTexto, lineHeight: 1 }}>
                              {Number(perfil.rating_avg).toFixed(1)}
                              <span style={{ fontSize: '14px', fontWeight: 700, opacity: .6 }}> / 5</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: T.chivaTexto, opacity: .85, marginTop: '3px' }}>
                              {perfil.rating_count} calificaci{perfil.rating_count === 1 ? 'ón' : 'ones'}
                            </div>
                          </div>
                        </div>

                        {perfil.rating_comentarios?.length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            {perfil.rating_comentarios.map((c, i) => (
                              <div key={i} style={{ padding: '11px 13px', background: T.niebla, border: `1px solid ${T.linea}`, borderRadius: T.rControl, marginBottom: '7px' }}>
                                <div style={{ display: 'flex', gap: '2px', marginBottom: '5px', color: T.chiva }}>
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <IconEstrella key={n} size={12}
                                      style={{ fill: n <= c.score ? 'currentColor' : 'none', opacity: n <= c.score ? 1 : .3 }} />
                                  ))}
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: T.tinta, lineHeight: 1.5 }}>{c.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ marginTop: '7px', padding: '13px 15px', background: T.niebla, borderRadius: T.rTarjeta, border: `1px solid ${T.linea}`, fontSize: '13px', color: T.piedra, lineHeight: 1.5 }}>
                        Todavía no te han calificado. Al terminar un viaje, la otra persona puede dejarte una calificación.
                      </div>
                    )}
                  </div>

                  {perfil.role === 'DRIVER' && (
                    <>
                      {perfil.empresa_afiliada && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa afiliada</label>
                          <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: 'var(--t-niebla)', borderRadius: '8px', border: '1px solid var(--t-linea)', fontSize: '15px', color: T.tinta, display: 'flex', alignItems: 'center', gap: '8px' }}><IconEmpresa size={15} color={T.piedra} />{perfil.empresa_afiliada.name}</div>
                        </div>
                      )}
                      {perfil.vehiculo && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehículo</label>
                          <div style={{ marginTop: '6px', backgroundColor: 'var(--t-niebla)', borderRadius: '8px', border: '1px solid var(--t-linea)', overflow: 'hidden' }}>
                            {perfil.vehiculo.photo_url && <img src={perfil.vehiculo.photo_url} alt="vehículo" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
                            <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '15px', fontWeight: 700, color: T.tinta }}><IconAuto size={15} /><span style={{ fontFamily: T.dato, letterSpacing: '.08em' }}>{perfil.vehiculo.plate}</span></span>
                              <span style={{ fontSize: '14px', color: 'var(--t-piedra)' }}>{perfil.vehiculo.capacity} asientos</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {perfil.role === 'PASSENGER' && perfil.ofertas_activas !== undefined && (
                    <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'var(--t-musgo)', borderRadius: '8px', border: `1px solid ${BRAND_GREEN}` }}>
                      <p style={{ margin: 0, fontSize: '14px', color: BRAND_GREEN, fontWeight: '700' }}>
                        <IconVisto size={13} style={{ verticalAlign: '-2px', marginRight: '5px' }} />
                        Tenés <strong>{perfil.ofertas_activas}</strong> oferta{perfil.ofertas_activas !== 1 ? 's' : ''} activa{perfil.ofertas_activas !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* HISTORIAL / DOCUMENTOS */}
              {!cargando && seccion === 'historial' && perfil && (
                <div>
                  {perfil.role === 'PASSENGER' && (
                    <>
                      <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '700', color: 'var(--t-tinta)' }}>Historial de viajes</h3>
                      {(!perfil.historial_viajes || perfil.historial_viajes.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--t-piedra)' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: T.musgo, border: `1px solid ${T.musgoLinea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.musgoTexto }}>
                            <IconCalendario size={20} />
                          </div>
                          <p style={{ margin: 0, fontSize: '14px' }}>Aún no has solicitado viajes.</p>
                        </div>
                      )}
                      {perfil.historial_viajes?.map((v) => {
                        const est = ESTADO_VIAJE[v.status] || { color: 'var(--t-piedra)', label: v.status };
                        return (
                          <div key={v.request_id} style={{ border: `1px solid ${T.linea}`, borderRadius: T.rTarjeta, padding: '13px 14px', marginBottom: '10px', background: T.papel }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                              <span style={{ fontFamily: T.dato, fontSize: '11.5px', color: T.piedraClara }}>{formatearFecha(v.created_at)}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: est.color, whiteSpace: 'nowrap' }}>
                                {est.Ico && <est.Ico size={12} />}{est.label}
                              </span>
                            </div>
                            <TableroRuta origen={v.origin} destino={v.destination} size={10.5} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: T.piedra, marginTop: '8px' }}>
                              <IconCalendario size={12} />
                              {new Date(v.departure_time).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {perfil.role === 'DRIVER' && (
                    <>
                      <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '700', color: 'var(--t-tinta)' }}>Estado de documentos</h3>
                      {(!perfil.documentos || perfil.documentos.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--t-piedra)' }}><p style={{ margin: 0, fontSize: '14px' }}>No tienes documentos registrados.</p></div>
                      )}
                      {perfil.documentos?.map((doc) => {
                        const est = ESTADO_DOC[doc.verification_status] || ESTADO_DOC.PENDING;
                        return (
                          <div key={doc.document_id} style={{ border: '1px solid var(--t-linea)', borderRadius: '10px', padding: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ flexShrink: 0, display: 'flex', color: T.piedra }}>
                              {(() => { const I = ICONO_DOC[doc.document_type] || IconClipboard; return <I size={20} />; })()}
                            </span>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: 'var(--t-tinta)' }}>{LABEL_DOC[doc.document_type] || doc.document_type}</p>
                              {doc.document_type === 'RUNT' && doc.years_experience != null && (
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra)' }}>{doc.years_experience} años de experiencia declarados</p>
                              )}
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: est.bg, color: est.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <est.Ico size={12} />{est.label}
                            </span>
                          </div>
                        );
                      })}

                      {/* HU37 — Subida de RUNT (opcional, posterior al registro) */}
                      {(() => {
                        const runt = perfil.documentos?.find(d => d.document_type === 'RUNT');
                        const puedeSubir = !runt || runt.verification_status === 'REJECTED';
                        if (!puedeSubir) return null;

                        return (
                          <div style={{ marginTop: '16px', border: '1px dashed var(--t-linea)', borderRadius: '10px', padding: '14px' }}>
                            {!mostrarFormRunt ? (
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: T.tinta, display: 'flex', alignItems: 'center', gap: '6px' }}><IconGorro size={14} />¿Querés verificar tu experiencia?</p>
                                <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--t-piedra)' }}>Sube tu RUNT para obtener el badge de conductor verificado.</p>
                                <button onClick={() => setMostrarFormRunt(true)}
                                  style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                  {runt ? 'Volver a enviar RUNT' : 'Subir RUNT'}
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div style={{ backgroundColor: 'var(--t-niebla)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--t-linea)', marginBottom: '12px' }}>
                                  <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: '700', color: T.piedra, display: 'flex', alignItems: 'center', gap: '6px' }}><IconIdea size={12} />¿Cómo obtengo mi RUNT?</p>
                                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--t-piedra)', lineHeight: '1.6' }}>
                                    Descarga el "Extracto de conductor" en la página del RUNT (runt.gov.co), con tu número de cédula. Ahí aparece tu historial e infracciones como conductor.
                                  </p>
                                </div>

                                {errorRunt && <div style={{ backgroundColor: 'var(--t-alerta-suave)', border: '1px solid var(--t-alerta-linea)', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', color: 'var(--t-alerta-texto)', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}><IconAlerta size={13} />{errorRunt}</div>}

                                <div style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', display: 'block', marginBottom: '5px' }}>Años de experiencia</label>
                                  <input type="number" min="0" max="80" value={aniosExperiencia}
                                    onChange={e => setAniosExperiencia(e.target.value)}
                                    style={inputStyle} placeholder="Ej: 5" />
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', display: 'block', marginBottom: '5px' }}>Categorías de licencia (opcional)</label>
                                  <input value={categoriasLicencia} onChange={e => setCategoriasLicencia(e.target.value)}
                                    style={inputStyle} placeholder="Ej: C2, C3" />
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', display: 'block', marginBottom: '5px' }}>Archivo del RUNT (PDF, JPG o PNG)</label>
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={e => setArchivoRunt(e.target.files?.[0] || null)}
                                    style={{ fontSize: '13px' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={subirRunt} disabled={subiendoRunt}
                                    style={{ flex: 1, background: subiendoRunt ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '14px', cursor: subiendoRunt ? 'not-allowed' : 'pointer' }}>
                                    {subiendoRunt ? 'Enviando...' : 'Enviar RUNT'}
                                  </button>
                                  <button onClick={() => { setMostrarFormRunt(false); setErrorRunt(''); }}
                                    style={{ background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: 'none', borderRadius: '8px', padding: '10px 14px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* SEGURIDAD */}
              {!cargando && seccion === 'seguridad' && (
                <div>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--t-tinta)' }}>Cambiar contraseña</h3>
                  {exitoPassword && <div style={{ backgroundColor: 'var(--t-musgo)', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: BRAND_GREEN, fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}><IconVisto size={14} />Contraseña actualizada.</div>}
                  {errorPassword && <div style={{ backgroundColor: 'var(--t-alerta-suave)', border: '1px solid var(--t-alerta-linea)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: 'var(--t-alerta-texto)', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}><IconAlerta size={14} />{errorPassword}</div>}
                  {[
                    { label: 'Contraseña actual', key: 'current' },
                    { label: 'Nueva contraseña', key: 'new' },
                    { label: 'Confirmar nueva contraseña', key: 'confirm' },
                  ].map(campo => (
                    <div key={campo.key} style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--t-piedra)', display: 'block', marginBottom: '5px' }}>{campo.label}</label>
                      <input type="password" value={passwordForm[campo.key]}
                        onChange={e => { setErrorPassword(''); setPasswordForm(prev => ({ ...prev, [campo.key]: e.target.value })); }}
                        style={inputStyle} placeholder="••••••••" />
                    </div>
                  ))}
                  <button onClick={cambiarPassword} disabled={guardandoPassword}
                    style={{ width: '100%', background: guardandoPassword ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: guardandoPassword ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
                    {guardandoPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                  </button>
                </div>
              )}
            </div>

            {/* CERRAR SESIÓN */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--t-linea)', flexShrink: 0 }}>
              <button onClick={handleCerrarSesion}
                style={{ width: '100%', background: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
                <IconSalir size={15} />Cerrar sesión
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PerfilDrawer;