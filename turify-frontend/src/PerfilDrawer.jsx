import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const BRAND_GREEN = '#16a34a';
import API_BASE_URL from './api';

const ICONO_DOC = {
  'SOAT': '🛡️',
  'Licencia de Conduccion': '🪪',
  'Tarjeta de operacion': '📋',
  'Tecnomecanica': '🔧',
  'Seguros Contractual y extracontractual': '📄',
  'RUNT': '🎓',
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
  PENDING:  { bg: '#fef3c7', color: '#92400e', label: '⏳ Pendiente' },
  APPROVED: { bg: '#dcfce7', color: '#166534', label: '✅ Aprobado' },
  REJECTED: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' },
};

const ESTADO_VIAJE = {
  PENDING:   { color: '#ca8a04', label: '⏳ Buscando conductor' },
  ASSIGNED:  { color: BRAND_GREEN, label: '✅ Confirmado' },
  COMPLETED: { color: '#2563eb', label: '🏁 Completado' },
  CANCELLED: { color: '#dc2626', label: '❌ Cancelado' },
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

  // HU20 — Subida de RUNT (experiencia del conductor)
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

  // HU20 — Subir el RUNT con los años de experiencia declarados
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

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' };

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCerrar}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />

          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
            style={{ position: 'fixed', top: 0, right: 0, width: '400px', maxWidth: '100%', height: '100vh', backgroundColor: '#fff', zIndex: 2001, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

            {/* HEADER */}
            <div style={{ background: `linear-gradient(135deg, ${BRAND_GREEN}, #15803d)`, padding: '24px 20px 16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {perfil?.profile_photo_url
                      ? <img src={perfil.profile_photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '24px' }}>👤</span>}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: '#fff' }}>{perfil?.full_name || usuario?.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{perfil?.email || usuario?.email}</p>
                    <span style={{ display: 'inline-block', marginTop: '5px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>
                      {perfil?.role === 'DRIVER' ? '🚗 Conductor' : perfil?.role === 'ADMIN' ? '🛡️ Admin' : '👤 Pasajero'}
                    </span>
                    {perfil?.role === 'DRIVER' && perfil?.conductor_verificado && (
                      <span style={{ display: 'inline-block', marginTop: '5px', marginLeft: '6px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>
                        🎓 Experiencia verificada
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                {[
                  { id: 'perfil', label: '👤 Perfil' },
                  { id: 'historial', label: perfil?.role === 'DRIVER' ? '📋 Mis Docs' : '🗺️ Historial' },
                  { id: 'seguridad', label: '🔒 Seguridad' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setSeccion(tab.id)}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '11px', transition: 'all 0.2s',
                      backgroundColor: seccion === tab.id ? '#fff' : 'rgba(255,255,255,0.15)',
                      color: seccion === tab.id ? BRAND_GREEN : '#fff' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CONTENIDO */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cargando && <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>⏳ Cargando perfil...</div>}

              {/* PERFIL */}
              {!cargando && seccion === 'perfil' && perfil && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</label>
                    {editandoTelefono ? (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} style={inputStyle} placeholder="Número de teléfono" />
                        <button onClick={guardarTelefono} disabled={guardandoTelefono}
                          style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '0 14px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                          {guardandoTelefono ? '...' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditandoTelefono(false)}
                          style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', padding: '0 12px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '14px', color: '#1e293b' }}>{perfil.phone_number}</span>
                        <button onClick={() => setEditandoTelefono(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✏️ Editar</button>
                      </div>
                    )}
                  </div>

                  {[
                    { label: 'Nombre completo', value: perfil.full_name },
                    { label: 'Correo electrónico', value: perfil.email },
                    perfil.age ? { label: 'Edad', value: `${perfil.age} años` } : null,
                  ].filter(Boolean).map((campo, i) => (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{campo.label}</label>
                      <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#64748b' }}>{campo.value}</div>
                    </div>
                  ))}

                  {perfil.role === 'DRIVER' && (
                    <>
                      {perfil.rating_avg !== undefined && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calificación promedio</label>
                          <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: '#fefce8', borderRadius: '8px', border: '1px solid #fde047', fontSize: '14px', color: '#854d0e', fontWeight: '700' }}>⭐ {Number(perfil.rating_avg).toFixed(1)} / 5.0</div>
                        </div>
                      )}
                      {perfil.empresa_afiliada && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa afiliada</label>
                          <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#1e293b' }}>🏢 {perfil.empresa_afiliada.name}</div>
                        </div>
                      )}
                      {perfil.vehiculo && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehículo</label>
                          <div style={{ marginTop: '6px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            {perfil.vehiculo.photo_url && <img src={perfil.vehiculo.photo_url} alt="vehículo" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
                            <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>🚗 {perfil.vehiculo.plate}</span>
                              <span style={{ fontSize: '13px', color: '#64748b' }}>{perfil.vehiculo.capacity} asientos</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {perfil.role === 'PASSENGER' && perfil.ofertas_activas !== undefined && (
                    <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: `1px solid ${BRAND_GREEN}` }}>
                      <p style={{ margin: 0, fontSize: '13px', color: BRAND_GREEN, fontWeight: '700' }}>
                        🎉 Tienes <strong>{perfil.ofertas_activas}</strong> oferta{perfil.ofertas_activas !== 1 ? 's' : ''} activa{perfil.ofertas_activas !== 1 ? 's' : ''}
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
                      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Historial de viajes</h3>
                      {(!perfil.historial_viajes || perfil.historial_viajes.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗺️</div>
                          <p style={{ margin: 0, fontSize: '13px' }}>Aún no has solicitado viajes.</p>
                        </div>
                      )}
                      {perfil.historial_viajes?.map((v) => {
                        const est = ESTADO_VIAJE[v.status] || { color: '#64748b', label: v.status };
                        return (
                          <div key={v.request_id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatearFecha(v.created_at)}</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: est.color }}>{est.label}</span>
                            </div>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{v.origin} <span style={{ color: BRAND_GREEN }}>→</span> {v.destination}</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>🗓️ {new Date(v.departure_time).toLocaleDateString('es-CO')}</div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {perfil.role === 'DRIVER' && (
                    <>
                      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Estado de documentos</h3>
                      {(!perfil.documentos || perfil.documentos.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}><p style={{ margin: 0, fontSize: '13px' }}>No tienes documentos registrados.</p></div>
                      )}
                      {perfil.documentos?.map((doc) => {
                        const est = ESTADO_DOC[doc.verification_status] || ESTADO_DOC.PENDING;
                        return (
                          <div key={doc.document_id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '22px', flexShrink: 0 }}>{ICONO_DOC[doc.document_type] || '📁'}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{LABEL_DOC[doc.document_type] || doc.document_type}</p>
                              {doc.document_type === 'RUNT' && doc.years_experience != null && (
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{doc.years_experience} años de experiencia declarados</p>
                              )}
                            </div>
                            <span style={{ backgroundColor: est.bg, color: est.color, padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>{est.label}</span>
                          </div>
                        );
                      })}

                      {/* HU20 — Subida de RUNT (opcional, posterior al registro) */}
                      {(() => {
                        const runt = perfil.documentos?.find(d => d.document_type === 'RUNT');
                        const puedeSubir = !runt || runt.verification_status === 'REJECTED';
                        if (!puedeSubir) return null;

                        return (
                          <div style={{ marginTop: '16px', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px' }}>
                            {!mostrarFormRunt ? (
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>🎓 ¿Quieres verificar tu experiencia?</p>
                                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>Sube tu RUNT para obtener el badge de conductor verificado.</p>
                                <button onClick={() => setMostrarFormRunt(true)}
                                  style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                                  {runt ? 'Volver a enviar RUNT' : 'Subir RUNT'}
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>💡 ¿Cómo obtengo mi RUNT?</p>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
                                    Descarga el "Extracto de conductor" en la página del RUNT (runt.gov.co), con tu número de cédula. Ahí aparece tu historial e infracciones como conductor.
                                  </p>
                                </div>

                                {errorRunt && <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', color: '#991b1b', fontWeight: '600', fontSize: '12px' }}>⚠️ {errorRunt}</div>}

                                <div style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '5px' }}>Años de experiencia</label>
                                  <input type="number" min="0" max="80" value={aniosExperiencia}
                                    onChange={e => setAniosExperiencia(e.target.value)}
                                    style={inputStyle} placeholder="Ej: 5" />
                                </div>

                                <div style={{ marginBottom: '10px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '5px' }}>Categorías de licencia (opcional)</label>
                                  <input value={categoriasLicencia} onChange={e => setCategoriasLicencia(e.target.value)}
                                    style={inputStyle} placeholder="Ej: C2, C3" />
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '5px' }}>Archivo del RUNT (PDF, JPG o PNG)</label>
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={e => setArchivoRunt(e.target.files?.[0] || null)}
                                    style={{ fontSize: '12px' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={subirRunt} disabled={subiendoRunt}
                                    style={{ flex: 1, background: subiendoRunt ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: subiendoRunt ? 'not-allowed' : 'pointer' }}>
                                    {subiendoRunt ? 'Enviando...' : 'Enviar RUNT'}
                                  </button>
                                  <button onClick={() => { setMostrarFormRunt(false); setErrorRunt(''); }}
                                    style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', padding: '10px 14px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
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
                  <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Cambiar contraseña</h3>
                  {exitoPassword && <div style={{ backgroundColor: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: BRAND_GREEN, fontWeight: '600', fontSize: '13px' }}>✅ Contraseña actualizada correctamente.</div>}
                  {errorPassword && <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#991b1b', fontWeight: '600', fontSize: '13px' }}>⚠️ {errorPassword}</div>}
                  {[
                    { label: 'Contraseña actual', key: 'current' },
                    { label: 'Nueva contraseña', key: 'new' },
                    { label: 'Confirmar nueva contraseña', key: 'confirm' },
                  ].map(campo => (
                    <div key={campo.key} style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '5px' }}>{campo.label}</label>
                      <input type="password" value={passwordForm[campo.key]}
                        onChange={e => { setErrorPassword(''); setPasswordForm(prev => ({ ...prev, [campo.key]: e.target.value })); }}
                        style={inputStyle} placeholder="••••••••" />
                    </div>
                  ))}
                  <button onClick={cambiarPassword} disabled={guardandoPassword}
                    style={{ width: '100%', background: guardandoPassword ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: guardandoPassword ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
                    {guardandoPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                  </button>
                </div>
              )}
            </div>

            {/* CERRAR SESIÓN */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
              <button onClick={handleCerrarSesion}
                style={{ width: '100%', background: '#fee2e2', color: '#991b1b', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                🚪 Cerrar sesión
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PerfilDrawer;