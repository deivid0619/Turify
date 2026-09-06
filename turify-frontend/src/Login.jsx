import API_BASE_URL from './api';
import { useState, useEffect, useRef } from 'react';
import { T, EstilosBase, Boton, Rotulo, TableroRuta, IconAlerta, IconOjo, IconOjoTachado,
         LogoWordmark, LogoMonograma, LogoBifurcacion } from './diseno';

// Logo en uso. Alternativas: LogoMonograma | LogoBifurcacion
const LOGO = LogoWordmark;

// Copy del panel izquierdo — cambia según la pestaña activa, para que el mensaje
// siempre hable de lo que la persona está mirando (pasajero, conductor o marca).
const COPY_POR_VISTA = {
  // Alternativas si querés probar otra: la idea es nombrar el vacío que Turify llena,
  // sin sonar peleador. Otras que funcionan igual de bien:
  //   <>Tu ruta existe,<br /><span>aunque no esté en el mapa.</span></>
  //   <>Hasta la última<br /><span>vereda de Antioquia.</span></>
  //   <>Que salir de la vereda<br /><span>no sea una odisea.</span></>
  viajar:   { frase: <>Movilidad para<br /><span>toda Antioquia.</span></> },
  conducir: { frase: <>Caminos que otros<br /><span>no recorren.</span></> },
  quienes:  { frase: <>Hasta la última<br /><span>vereda de Antioquia.</span></> },
};
// Rutas reales de Antioquia que rotan en el tablero de la izquierda.
const RUTAS = [
  ['Palmitas', 'Medellín'],
  ['Santa Elena', 'Rionegro'],
  ['El Retiro', 'La Ceja'],
  ['Urrao', 'Concordia'],
  ['San Vicente', 'Guarne'],
  ['Támesis', 'Jericó'],
];

// ─────────────────────────────────────────────────────────────────────────────
//  TABLERO DE RUTA EN VIVO — el elemento firma. Una sola ruta, grande y legible,
//  que se releva cada pocos segundos con un fundido corto. Se cambia la ruta,
//  no cada letra. Respeta prefers-reduced-motion (se queda en la primera).
// ─────────────────────────────────────────────────────────────────────────────
const TableroEnVivo = () => {
  const [indice, setIndice] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndice((i) => (i + 1) % RUTAS.length);
        setVisible(true);
      }, 260);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const [origen, destino] = RUTAS[indice];

  return (
    <div style={{ maxWidth: '680px' }}>
      <TableroRuta origen={origen} destino={destino} oscuro size={19}
        style={{ opacity: visible ? 1 : 0, transition: 'opacity .26s ease' }} />
      <div style={{
        marginTop: '18px', fontFamily: T.dato, fontSize: '11px',
        letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(234,242,236,.42)',
      }}>
        412 rutas activas en Antioquia
      </div>
    </div>
  );
};

const Login = ({ irARegistro, onLoginSuccess, vistaInicial }) => {
  // Si venís de elegir "Conducir" antes de registrarte, al volver a esta
  // pantalla (a loguearte) seguimos mostrando esa pestaña, no la genérica.
  const [vista, setVista] = useState(vistaInicial || 'viajar'); // 'viajar' | 'conducir' | 'quienes'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorBackend, setErrorBackend] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [campoActivo, setCampoActivo] = useState(null);

  const isFormValid = formData.email.includes('@') && formData.password.length > 0;
  const copy = COPY_POR_VISTA[vista];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errorBackend) setErrorBackend('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorBackend('');
    const urlEncodedData = new URLSearchParams();
    urlEncodedData.append('username', formData.email);
    urlEncodedData.append('password', formData.password);
    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'ngrok-skip-browser-warning': 'true' },
        body: urlEncodedData
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        if (onLoginSuccess) onLoginSuccess(data.access_token);
      } else {
        const errorData = await response.json();
        setErrorBackend(errorData.detail || 'Correo o contraseña incorrectos.');
      }
    } catch {
      setErrorBackend('Error de conexión. Verifica que el backend esté activo.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Estilos de campo (compartidos entre correo y contraseña) ──
  const estiloCampo = (nombre) => ({
    width: '100%', padding: '12px 14px',
    background: campoActivo === nombre ? T.papel : 'var(--t-papel)',
    border: `1px solid ${campoActivo === nombre ? T.ruta : T.linea}`,
    boxShadow: campoActivo === nombre ? '0 0 0 3px rgba(22,163,74,.12)' : 'none',
    borderRadius: T.rControl, color: T.tinta, fontSize: '14px',
    fontFamily: T.ui, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .18s, box-shadow .18s, background .18s',
  });

  const estiloEtiqueta = { display: 'block', fontSize: '11.5px', fontWeight: 500, color: T.piedra, marginBottom: '6px' };

  return (
    <>
      <EstilosBase />
      <style>{`
        .login-raiz { display:flex; flex-direction:column; min-height:100vh; font-family:${T.ui}; background:${T.niebla}; }
        .login-cuerpo { flex:1; display:flex; min-height:0; }
        .login-izq { flex:1.6 1 0; min-width:0; position:relative; overflow:hidden; background:${T.monte};
                     padding:44px clamp(48px, 6vw, 84px); display:flex; flex-direction:column; gap:34px; }
        .login-izq__centro { flex:1; display:flex; flex-direction:column; justify-content:center;
                             gap:26px; position:relative; min-height:0; }
        .login-der { flex:0 0 400px; min-width:0; background:${T.papel}; display:flex; align-items:center;
                     justify-content:center; padding:48px 40px; border-left:1px solid ${T.linea}; }
        .login-forma { width:100%; max-width:340px; }
        .login-izq h1 span { color:${T.chiva}; }
        .login-pestana { font-family:${T.dato}; font-size:11px; font-weight:500; letter-spacing:.14em;
                         text-transform:uppercase; background:none; border:none; cursor:pointer;
                         padding:7px 0; color:rgba(234,242,236,.42); transition:color .18s;
                         border-bottom:1.5px solid transparent; }
        .login-pestana:hover { color:rgba(234,242,236,.8); }
        .login-pestana-on { color:#fff; border-bottom-color:${T.chiva}; }
        .login-enlace { background:none; border:none; padding:0; cursor:pointer;
                        color:${T.ruta}; font-weight:700; font-family:${T.ui}; font-size:13px; }
        .login-enlace:hover { color:${T.rutaHover}; }
        .login-punto { list-style:none; position:relative; padding-left:16px; font-size:13.5px;
                       color:${T.piedra}; line-height:1.6; margin-bottom:12px; }
        .login-punto::before { content:''; position:absolute; left:0; top:8px; width:5px; height:5px;
                               border-radius:50%; background:${T.ruta}; }
        @media (max-width: 900px) {
          .login-izq { display:none; }
          .login-der { flex:1; border-left:none; padding:40px 24px; }
        }
      `}</style>

      <div className="login-raiz">
        <div className="login-cuerpo">

          {/* ── Izquierda: monte + tablero ── */}
          <div className="login-izq">
            {/* Topografía de montaña — curvas de nivel, no una foto de stock */}
            <svg viewBox="0 0 400 440" preserveAspectRatio="none" aria-hidden="true"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}>
              <g fill="none" stroke="#86EFAC" strokeWidth="1">
                <path d="M-10 320 C 60 290, 130 350, 200 315 S 340 265, 410 300" />
                <path d="M-10 352 C 60 322, 130 384, 200 348 S 340 296, 410 332" />
                <path d="M-10 288 C 60 256, 130 318, 200 282 S 340 232, 410 268" />
                <path d="M-10 254 C 60 224, 130 284, 200 250 S 340 198, 410 236" />
                <path d="M-10 220 C 60 192, 130 250, 200 216 S 340 164, 410 202" />
                <path d="M-10 186 C 60 160, 130 216, 200 182 S 340 130, 410 168" />
              </g>
            </svg>

            {/* Cabecera: logo grande + navegación */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
              {/* Hay ancho de sobra: va el logo con nombre, no la marca compacta. */}
              <LOGO alto={24} oscuro />
              <nav style={{ display: 'flex', gap: '20px' }}>
                {[
                  { id: 'viajar', label: 'Viajar' },
                  { id: 'conducir', label: 'Conducir' },
                  { id: 'quienes', label: 'Quiénes somos' },
                ].map(p => (
                  <button key={p.id} type="button" onClick={() => setVista(p.id)}
                    className={`login-pestana t-foco ${vista === p.id ? 'login-pestana-on' : ''}`}>
                    {p.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Centro: la frase y el tablero, juntos y centrados vertical */}
            <div className="login-izq__centro">
              <h1 style={{
                fontFamily: T.display, fontWeight: 800, fontSize: 'clamp(34px, 4.2vw, 56px)',
                lineHeight: 1.14, letterSpacing: '-.02em', color: '#fff',
                margin: 0, maxWidth: '17ch',
              }}>
                {copy.frase}
              </h1>

              <TableroEnVivo />
            </div>

            <div style={{ position: 'relative', fontSize: '11.5px', color: 'rgba(234,242,236,.4)' }}>
              Transporte especial habilitado · © 2026 Turify
            </div>
          </div>

          {/* ── Derecha: papel + formulario ── */}
          <div className="login-der">
            {vista === 'viajar' && (
              <div className="login-forma">
                <Rotulo style={{ marginBottom: '12px' }}>Bienvenido de nuevo</Rotulo>
                <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: '28px', letterSpacing: '-.02em', color: T.tinta, margin: '0 0 6px' }}>
                  Entrar
                </h2>
                <p style={{ fontSize: '13.5px', color: T.piedra, margin: '0 0 26px' }}>
                  Entrá a tu cuenta para seguir con tus viajes.
                </p>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={estiloEtiqueta}>Correo</label>
                    <input type="email" name="email" placeholder="tu@correo.com"
                      value={formData.email} onChange={handleChange}
                      onFocus={() => setCampoActivo('email')} onBlur={() => setCampoActivo(null)}
                      style={estiloCampo('email')} disabled={isLoading} autoComplete="email" />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={estiloEtiqueta}>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} name="password"
                        placeholder="••••••••" value={formData.password} onChange={handleChange}
                        onFocus={() => setCampoActivo('password')} onBlur={() => setCampoActivo(null)}
                        style={{ ...estiloCampo('password'), paddingRight: '46px' }}
                        disabled={isLoading} autoComplete="current-password" />
                      <button type="button" className="t-foco" tabIndex={-1}
                        onClick={() => setShowPassword(p => !p)}
                        title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: T.piedraClara,
                          display: 'flex', padding: 0,
                        }}>
                        {showPassword ? <IconOjoTachado size={17} /> : <IconOjo size={17} />}
                      </button>
                    </div>
                  </div>

                  {errorBackend && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      background: T.alertaSuave, border: `1px solid ${T.alertaLinea}`,
                      borderRadius: T.rControl, padding: '10px 12px', marginBottom: '14px',
                      color: T.alertaTexto, fontSize: '12.5px',
                    }}>
                      <IconAlerta size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{errorBackend}</span>
                    </div>
                  )}

                  <Boton type="submit" ancho disabled={!isFormValid || isLoading}
                    variante={isFormValid && !isLoading ? 'primario' : 'inactivo'}
                    style={{ padding: '13px' }}>
                    {isLoading ? 'Entrando…' : 'Entrar'}
                  </Boton>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                  <span style={{ flex: 1, height: '1px', background: T.linea }} />
                  <span style={{ fontFamily: T.dato, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: T.piedraClara }}>o</span>
                  <span style={{ flex: 1, height: '1px', background: T.linea }} />
                </div>

                <Boton type="button" variante="fantasma" ancho onClick={() => irARegistro('pasajero')}>
                  Crear cuenta
                </Boton>
              </div>
            )}

            {vista === 'conducir' && (
              <div className="login-forma">
                <Rotulo style={{ marginBottom: '12px' }}>Trabajá con tu vehículo</Rotulo>
                <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: '28px', letterSpacing: '-.02em', color: T.tinta, margin: '0 0 6px' }}>
                  Conducí con Turify
                </h2>
                <p style={{ fontSize: '13.5px', color: T.piedra, margin: '0 0 22px' }}>
                  Vos decidís cuándo conducir y qué ofertas aceptar.
                </p>

                <ul style={{ margin: '0 0 26px', padding: 0 }}>
                  <li className="login-punto">
                    Cada viaje llega con un precio sugerido según la ruta y la distancia. Vos decidís si lo tomás o proponés otro.
                  </li>
                  <li className="login-punto">
                    Recibís solicitudes de tu zona, incluso en veredas y municipios pequeños.
                  </li>
                  <li className="login-punto">
                    Consultás tus ganancias por semana y por mes desde tu panel.
                  </li>
                </ul>

                <Boton type="button" ancho onClick={() => irARegistro('conductor')}>Crear cuenta y empezar</Boton>
                <p style={{ textAlign: 'center', fontSize: '13px', color: T.piedra, margin: '18px 0 0' }}>
                  ¿Ya tenés cuenta? <button type="button" className="login-enlace t-foco" onClick={() => setVista('viajar')}>Entrá acá</button>
                </p>
              </div>
            )}

            {vista === 'quienes' && (
              <div className="login-forma">
                <Rotulo style={{ marginBottom: '12px' }}>Nuestra misión</Rotulo>
                <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: '28px', letterSpacing: '-.02em', color: T.tinta, margin: '0 0 6px' }}>
                  Quiénes somos
                </h2>
                <p style={{ fontSize: '13.5px', color: T.piedra, margin: '0 0 22px' }}>
                  Turify nació en Antioquia para resolver algo concreto: llegar a donde el transporte
                  convencional no tiene cobertura.
                </p>

                <ul style={{ margin: '0 0 26px', padding: 0 }}>
                  <li className="login-punto">
                    Transporte especial y rural: fincas, veredas y cabeceras municipales.
                  </li>
                  <li className="login-punto">
                    Precios sugeridos de forma transparente según ruta y distancia, sin intermediarios ocultos.
                  </li>
                  <li className="login-punto">
                    Un equipo de Medellín construyendo movilidad para toda la región.
                  </li>
                </ul>

                <Boton type="button" variante="fantasma" ancho onClick={() => setVista('viajar')}>
                  Volver a entrar
                </Boton>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
