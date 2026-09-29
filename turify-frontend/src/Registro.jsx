import API_BASE_URL from './api';
import { useState } from 'react';
import { T, EstilosBase, Boton, Rotulo, TableroRuta, LogoWordmark, IconAlerta, IconVisto, IconOjo, IconOjoTachado, Resalte } from './diseno';

const Registro = ({ irALogin }) => {
  const [formData, setFormData] = useState({
    full_name: '', email: '', password: '', confirmPassword: '', phone_number: ''
  });
  const [errores, setErrores] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [errorBackend, setErrorBackend] = useState('');
  const [campoActivo, setCampoActivo] = useState(null);
  // Ley 1581 — autorización previa, expresa e informada. La casilla empieza
  // sin marcar y sin ella no se crea la cuenta (el backend también lo exige).
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);

  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  // Validaciones de formato (mismas reglas que valida el backend).
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const emailValido = RE_EMAIL.test(formData.email.trim());
  const telLimpio = formData.phone_number.replace(/[\s\-()]/g, '');
  const telValido = /^\+?\d{7,15}$/.test(telLimpio);
  const nombreValido = formData.full_name.trim().length >= 3 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]+$/.test(formData.full_name.trim());

  const isFormValid =
    nombreValido &&
    emailValido &&
    telValido &&
    isPasswordValid &&
    formData.confirmPassword === formData.password &&
    formData.password !== '' &&
    aceptaPoliticas;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errores[name]) setErrores({ ...errores, [name]: '' });
    if (errorBackend) setErrorBackend('');
  };

  // Antes, el mensaje de cada campo ("Correo inválido...", etc.) solo se
  // calculaba dentro de handleSubmit — pero el botón "Crear cuenta" está
  // deshabilitado mientras el formulario no sea válido, así que handleSubmit
  // nunca llegaba a correr y el usuario se quedaba sin ninguna pista de qué
  // estaba mal. Ahora, al salir de un campo (blur), se valida ESE campo en
  // el momento y se muestra su mensaje si corresponde.
  const handleBlur = (campo) => {
    setCampoActivo(null);
    const erroresEncontrados = validarFormulario();
    setErrores(prev => ({ ...prev, [campo]: erroresEncontrados[campo] || '' }));
  };

  const validarFormulario = () => {
    let erroresVisuales = {};
    if (!formData.full_name.trim()) erroresVisuales.full_name = 'El nombre es obligatorio.';
    else if (!nombreValido) erroresVisuales.full_name = 'Escribe tu nombre completo (solo letras).';
    if (!formData.email.trim()) erroresVisuales.email = 'El correo es obligatorio.';
    else if (!emailValido) erroresVisuales.email = 'Correo inválido (ej. nombre@correo.com).';
    if (!formData.phone_number.trim()) erroresVisuales.phone_number = 'El teléfono es obligatorio.';
    else if (!telValido) erroresVisuales.phone_number = 'Teléfono inválido: solo números (7 a 15 dígitos).';
    if (!isPasswordValid) erroresVisuales.password = 'La contraseña no cumple los requisitos.';
    if (formData.password !== formData.confirmPassword) erroresVisuales.confirmPassword = 'Las contraseñas no coinciden.';
    return erroresVisuales;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const erroresEncontrados = validarFormulario();
    if (Object.keys(erroresEncontrados).length > 0) { setErrores(erroresEncontrados); return; }
    setErrores({});
    setIsLoading(true);
    const { confirmPassword, ...payload } = formData;
    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ ...payload, acepta_politicas: aceptaPoliticas })
      });
      if (response.ok) {
        setMensajeExito('Tu cuenta quedó creada. Te llevamos al inicio de sesión…');
        setTimeout(() => irALogin(), 1800);
      } else {
        const errorData = await response.json();
        setErrorBackend(errorData.detail || 'Error en el registro. Inténtalo de nuevo.');
      }
    } catch {
      setErrorBackend('Error de conexión. Verifica que el backend esté activo.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Requisito de contraseña ──
  const Requisito = ({ ok, label }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px',
      color: ok ? T.musgoTexto : T.piedraClara, transition: 'color .2s',
    }}>
      <span style={{
        width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${ok ? T.ruta : T.linea}`,
        background: ok ? T.musgo : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .2s',
      }}>
        {ok && <IconVisto size={9} color={T.ruta} grosor={2.6} />}
      </span>
      {label}
    </div>
  );

  const estiloCampo = (nombre, hayError) => ({
    width: '100%', padding: '11px 14px',
    background: campoActivo === nombre ? T.papel : 'var(--t-papel)',
    border: `1px solid ${hayError ? T.alertaLinea : campoActivo === nombre ? T.ruta : T.linea}`,
    boxShadow: campoActivo === nombre && !hayError ? '0 0 0 3px rgba(22,163,74,.12)' : 'none',
    borderRadius: T.rControl, color: T.tinta, fontSize: '13.5px',
    fontFamily: T.ui, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .18s, box-shadow .18s, background .18s',
  });

  const estiloEtiqueta = { display: 'block', fontSize: '11.5px', fontWeight: 500, color: T.piedra, marginBottom: '6px' };
  const estiloErrorCampo = { fontSize: '11px', color: T.alertaTexto, marginTop: '4px', display: 'block' };
  const estiloAyudaCampo = { fontSize: '11px', color: T.piedraClara, marginTop: '4px', display: 'block' };

  const ojo = (visible, alternar) => (
    <button type="button" className="t-foco" onClick={alternar}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
      title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      style={{
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: T.piedraClara,
        display: 'flex', padding: 0,
      }}>
      {visible ? <IconOjoTachado size={16} /> : <IconOjo size={16} />}
    </button>
  );

  return (
    <>
      <EstilosBase />
      <style>{`
        .reg-raiz { display:flex; min-height:100vh; font-family:${T.ui}; background:${T.niebla}; }
        .reg-izq { flex:0 0 400px; position:relative; overflow:hidden; background:${T.monte};
                   padding:44px 44px; display:flex; flex-direction:column; justify-content:space-between; gap:32px; }
        .reg-der { flex:1; background:${T.papel}; display:flex; align-items:center; justify-content:center;
                   padding:48px 56px; border-left:1px solid ${T.linea}; overflow-y:auto; }
        .reg-forma { width:100%; max-width:430px; }
        .reg-rejilla { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .reg-completo { grid-column:1 / -1; }
        .reg-paso { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
        .reg-paso-n { width:24px; height:24px; border-radius:50%; flex-shrink:0; margin-top:1px;
                      background:rgba(22,163,74,.16); border:1px solid ${T.monteLinea};
                      color:#86EFAC; font-family:${T.dato}; font-size:11px; font-weight:600;
                      display:flex; align-items:center; justify-content:center; }
        .reg-paso-t { font-size:12.5px; color:rgba(234,242,236,.55); line-height:1.5; }
        .reg-paso-t strong { color:rgba(234,242,236,.9); font-weight:600; display:block; margin-bottom:1px; }
        .reg-volver { display:inline-flex; align-items:center; gap:6px; background:none; border:none;
                      color:${T.piedra}; font-size:13px; font-family:${T.ui}; cursor:pointer;
                      padding:0; margin-bottom:28px; transition:color .18s; }
        .reg-volver:hover { color:${T.ruta}; }
        .reg-enlace { background:none; border:none; padding:0; cursor:pointer; font-family:${T.ui};
                      color:${T.ruta}; font-weight:700; font-size:13px; }
        .reg-enlace:hover { color:${T.rutaHover}; }
        @media (max-width: 900px) {
          .reg-izq { display:none; }
          .reg-der { padding:36px 24px; border-left:none; }
          .reg-rejilla { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="reg-raiz">
        {/* ── Izquierda: monte ── */}
        <div className="reg-izq">
          <svg viewBox="0 0 400 440" preserveAspectRatio="none" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.16 }}>
            <g fill="none" stroke="#86EFAC" strokeWidth="1">
              <path d="M-10 330 C 60 300, 130 360, 200 325 S 340 275, 410 310" />
              <path d="M-10 362 C 60 332, 130 394, 200 358 S 340 306, 410 342" />
              <path d="M-10 298 C 60 266, 130 328, 200 292 S 340 242, 410 278" />
              <path d="M-10 264 C 60 234, 130 294, 200 260 S 340 208, 410 246" />
              <path d="M-10 230 C 60 202, 130 260, 200 226 S 340 174, 410 212" />
            </g>
          </svg>

          <span style={{ position: 'relative', alignSelf: 'flex-start' }}><LogoWordmark alto={14} oscuro /></span>

          <div style={{ position: 'relative' }}>
            <h2 style={{
              fontFamily: T.frase, fontWeight: 400, fontSize: '27px', lineHeight: 1.2,
              letterSpacing: '-.01em', color: '#fff', margin: '0 0 12px',
            }}>
              Sumate a la red<br /><Resalte sobreOscuro>Turify.</Resalte>
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(234,242,236,.55)', lineHeight: 1.6, margin: '0 0 22px' }}>
              Publicá tu viaje, negociá la tarifa y viajá con conductores verificados en Medellín y su región.
            </p>

            <TableroRuta origen="Vos" destino="Tu destino" oscuro size={11} style={{ marginBottom: '26px' }} />

            <div className="reg-paso">
              <div className="reg-paso-n">1</div>
              <div className="reg-paso-t"><strong>Creá tu cuenta</strong>Menos de dos minutos.</div>
            </div>
            <div className="reg-paso">
              <div className="reg-paso-n">2</div>
              <div className="reg-paso-t"><strong>Publicá tu viaje</strong>Origen, destino y condiciones.</div>
            </div>
            <div className="reg-paso">
              <div className="reg-paso-n">3</div>
              <div className="reg-paso-t"><strong>Elegí y viajá</strong>Aceptá la oferta que más te sirva o proponé otra.</div>
            </div>
          </div>

          <div style={{ position: 'relative', fontSize: '11.5px', color: 'rgba(234,242,236,.35)' }}>
            © 2026 Turify
          </div>
        </div>

        {/* ── Derecha: formulario ── */}
        <div className="reg-der">
          <div className="reg-forma">
            <button className="reg-volver t-foco" onClick={irALogin}>
              <span style={{ fontFamily: T.dato }}>←</span> Volver a entrar
            </button>

            <Rotulo style={{ marginBottom: '12px' }}>Nuevo usuario</Rotulo>
            <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: '27px', letterSpacing: '-.02em', color: T.tinta, margin: '0 0 6px' }}>
              Crear cuenta
            </h2>
            <p style={{ fontSize: '13.5px', color: T.piedra, margin: '0 0 26px' }}>
              Completá tus datos para empezar.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="reg-rejilla">
                <div className="reg-completo">
                  <label htmlFor="reg-nombre" style={estiloEtiqueta}>Nombre completo</label>
                  <input id="reg-nombre" type="text" name="full_name" placeholder="Juan Pérez" value={formData.full_name}
                    onChange={handleChange} onFocus={() => setCampoActivo('full_name')} onBlur={() => handleBlur('full_name')}
                    style={estiloCampo('full_name', errores.full_name)} disabled={isLoading} />
                  {errores.full_name
                    ? <span style={estiloErrorCampo}>{errores.full_name}</span>
                    : <span style={estiloAyudaCampo}>Solo letras y espacios, sin números.</span>}
                </div>

                <div>
                  <label htmlFor="reg-correo" style={estiloEtiqueta}>Correo</label>
                  <input id="reg-correo" type="email" name="email" placeholder="tu@correo.com" value={formData.email}
                    onChange={handleChange} onFocus={() => setCampoActivo('email')} onBlur={() => handleBlur('email')}
                    style={estiloCampo('email', errores.email)} disabled={isLoading} />
                  {errores.email && <span style={estiloErrorCampo}>{errores.email}</span>}
                </div>

                <div>
                  <label htmlFor="reg-telefono" style={estiloEtiqueta}>Teléfono</label>
                  <input id="reg-telefono" type="tel" inputMode="tel" name="phone_number" placeholder="3001234567" value={formData.phone_number}
                    onChange={(e) => handleChange({ target: { name: 'phone_number', value: e.target.value.replace(/[^0-9+\s()-]/g, '') } })}
                    onFocus={() => setCampoActivo('phone_number')} onBlur={() => handleBlur('phone_number')} maxLength={20}
                    style={{ ...estiloCampo('phone_number', errores.phone_number), fontFamily: T.dato, letterSpacing: '.06em' }} disabled={isLoading} />
                  {errores.phone_number && <span style={estiloErrorCampo}>{errores.phone_number}</span>}
                </div>

                <div>
                  <label htmlFor="reg-clave" style={estiloEtiqueta}>Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input id="reg-clave" type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••"
                      value={formData.password} onChange={handleChange}
                      onFocus={() => setCampoActivo('password')} onBlur={() => handleBlur('password')}
                      style={{ ...estiloCampo('password', errores.password), paddingRight: '44px' }} disabled={isLoading} />
                    {ojo(showPassword, () => setShowPassword(p => !p))}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-clave2" style={estiloEtiqueta}>Confirmar contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input id="reg-clave2" type={showConfirm ? 'text' : 'password'} name="confirmPassword" placeholder="••••••••"
                      value={formData.confirmPassword} onChange={handleChange}
                      onFocus={() => setCampoActivo('confirmPassword')} onBlur={() => handleBlur('confirmPassword')}
                      style={{ ...estiloCampo('confirmPassword', errores.confirmPassword), paddingRight: '44px' }} disabled={isLoading} />
                    {ojo(showConfirm, () => setShowConfirm(p => !p))}
                  </div>
                  {errores.confirmPassword && <span style={estiloErrorCampo}>{errores.confirmPassword}</span>}
                </div>
              </div>

              {formData.password.length > 0 && (
                <div style={{
                  display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '12px',
                  padding: '11px 13px', background: T.niebla, borderRadius: T.rControl,
                  border: `1px solid ${T.linea}`,
                }}>
                  <Requisito ok={hasMinLength} label="8+ caracteres" />
                  <Requisito ok={hasUppercase} label="Mayúscula" />
                  <Requisito ok={hasNumber} label="Número" />
                  <Requisito ok={formData.confirmPassword === formData.password && formData.confirmPassword !== ''} label="Coinciden" />
                </div>
              )}

              <label htmlFor="reg-acepta" style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '18px',
                fontSize: '12.5px', lineHeight: 1.5, color: T.piedra, cursor: 'pointer',
              }}>
                <input id="reg-acepta" type="checkbox" checked={aceptaPoliticas} disabled={isLoading}
                  onChange={e => { setAceptaPoliticas(e.target.checked); if (errorBackend) setErrorBackend(''); }}
                  style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--t-ruta)' }} />
                <span>
                  Acepto los{' '}
                  <a href="/politicas#terminos" target="_blank" rel="opener" style={{ color: T.tinta }}>Términos y Condiciones</a>{' '}
                  y autorizo a Turify a tratar mis datos personales según la{' '}
                  <a href="/politicas#datos" target="_blank" rel="opener" style={{ color: T.tinta }}>Política de Tratamiento de Datos</a>.
                </span>
              </label>

              <Boton type="submit" ancho disabled={!isFormValid || isLoading}
                variante={isFormValid && !isLoading ? 'primario' : 'inactivo'}
                style={{ marginTop: '16px', padding: '13px' }}>
                {isLoading ? 'Creando cuenta…' : 'Crear cuenta'}
              </Boton>

              {errorBackend && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px',
                  background: T.alertaSuave, border: `1px solid ${T.alertaLinea}`,
                  borderRadius: T.rControl, padding: '10px 12px', color: T.alertaTexto, fontSize: '12.5px',
                }}>
                  <IconAlerta size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{errorBackend}</span>
                </div>
              )}
              {mensajeExito && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px',
                  background: T.musgo, border: `1px solid ${T.musgoLinea}`,
                  borderRadius: T.rControl, padding: '10px 12px', color: T.musgoTexto, fontSize: '12.5px',
                }}>
                  <IconVisto size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{mensajeExito}</span>
                </div>
              )}
            </form>

            <p style={{ textAlign: 'center', fontSize: '13px', color: T.piedra, marginTop: '20px' }}>
              ¿Ya tenés cuenta? <button type="button" className="reg-enlace t-foco" onClick={irALogin}>Entrá acá</button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Registro;
