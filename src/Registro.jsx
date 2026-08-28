import API_BASE_URL from './api';
import { useState } from 'react';
import logoTurify from './logo.png';
import fondoImagen from './fondo.png';

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

  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  const isFormValid =
    formData.full_name.trim() !== '' &&
    formData.email.includes('@') &&
    isPasswordValid &&
    formData.confirmPassword === formData.password &&
    formData.password !== '';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errores[name]) setErrores({ ...errores, [name]: '' });
    if (errorBackend) setErrorBackend('');
  };

  const validarFormulario = () => {
    let erroresVisuales = {};
    if (!formData.full_name.trim()) erroresVisuales.full_name = 'El nombre es obligatorio.';
    if (!formData.email.includes('@')) erroresVisuales.email = 'Correo inválido.';
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
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setMensajeExito('¡Cuenta creada exitosamente! Redirigiendo al login...');
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

  const CheckItem = ({ ok, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: ok ? '#4ade80' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}>
      <span style={{ fontSize: '10px', width: '14px', height: '14px', borderRadius: '50%', border: `1.5px solid ${ok ? '#22c55e' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: ok ? 'rgba(34,197,94,0.15)' : 'transparent', transition: 'all 0.2s' }}>
        {ok ? '✓' : ''}
      </span>
      {label}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .reg-root {
          display: flex;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          background: #050e05;
        }

        .reg-left {
          flex: 0 0 380px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 44px;
          overflow: hidden;
        }

        .reg-left-bg {
          position: absolute;
          inset: 0;
          background-image: url(${fondoImagen});
          background-size: cover;
          background-position: center;
          filter: brightness(0.35) saturate(1.1);
        }

        .reg-left-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(5,14,5,0.4) 0%, rgba(5,14,5,0.9) 100%);
        }

        .reg-left-content { position: relative; z-index: 2; }
        .reg-logo { width: 150px; filter: drop-shadow(0 0 20px rgba(34,197,94,0.25)); }
        .reg-left-bottom { position: relative; z-index: 2; }

        .reg-left-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          line-height: 1.2;
          margin-bottom: 14px;
        }
        .reg-left-title span { color: #22c55e; }

        .reg-left-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          line-height: 1.65;
          font-weight: 300;
          margin-bottom: 28px;
        }

        .reg-steps { display: flex; flex-direction: column; gap: 14px; }

        .reg-step { display: flex; align-items: flex-start; gap: 12px; }

        .reg-step-num {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          color: #22c55e;
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }

        .reg-step-text { font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .reg-step-text strong { color: rgba(255,255,255,0.75); font-weight: 500; display: block; margin-bottom: 1px; }

        .reg-copy { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 32px; }

        .reg-right {
          flex: 1;
          background: #0a0f0a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 64px;
          border-left: 1px solid rgba(34,197,94,0.07);
          position: relative;
          overflow-y: auto;
        }

        .reg-right::before {
          content: '';
          position: absolute;
          bottom: -60px; left: -60px;
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .reg-form-wrap { width: 100%; max-width: 420px; position: relative; z-index: 1; }

        .reg-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.35);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          padding: 0;
          margin-bottom: 32px;
          transition: color 0.2s;
        }
        .reg-back-btn:hover { color: #22c55e; }

        .reg-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #22c55e;
          margin-bottom: 10px;
        }

        .reg-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #f0fdf4;
          margin-bottom: 6px;
          letter-spacing: -0.3px;
        }

        .reg-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 28px;
          font-weight: 300;
        }

        .reg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .reg-grid-full { grid-column: 1 / -1; }
        .reg-field { display: flex; flex-direction: column; }

        .reg-label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.4);
          margin-bottom: 6px;
          letter-spacing: 0.3px;
        }

        .reg-input-wrap { position: relative; }

        .reg-input {
          width: 100%;
          padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9px;
          color: #f0fdf4;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }

        .reg-input::placeholder { color: rgba(255,255,255,0.18); }

        .reg-input:focus {
          border-color: rgba(34,197,94,0.4);
          background: rgba(34,197,94,0.03);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.07);
        }

        .reg-input-error { border-color: rgba(239,68,68,0.4) !important; }
        .reg-input-pw { padding-right: 42px; }

        .reg-pw-toggle {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          font-size: 14px; padding: 0;
          transition: color 0.2s;
        }
        .reg-pw-toggle:hover { color: rgba(255,255,255,0.6); }

        .reg-field-error { font-size: 11px; color: #fca5a5; margin-top: 4px; }

        .reg-pw-checks { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; }

        .reg-btn {
          width: 100%;
          padding: 13px;
          border-radius: 9px;
          border: none;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          transition: all 0.2s;
          margin-top: 20px;
          cursor: pointer;
        }

        .reg-btn-active {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: #052e16;
          box-shadow: 0 4px 18px rgba(34,197,94,0.28);
        }
        .reg-btn-active:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(34,197,94,0.38); }
        .reg-btn-disabled { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.18); cursor: not-allowed; }

        .reg-login-link {
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          margin-top: 20px;
        }
        .reg-login-link a { color: #22c55e; font-weight: 600; cursor: pointer; text-decoration: none; transition: color 0.2s; }
        .reg-login-link a:hover { color: #4ade80; }

        .reg-loading-dots { display: inline-flex; gap: 4px; align-items: center; }
        .reg-loading-dots span { width: 5px; height: 5px; border-radius: 50%; background: #052e16; animation: bounce-r 1s infinite; }
        .reg-loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .reg-loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce-r { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

        @media (max-width: 768px) {
          .reg-left { display: none; }
          .reg-right { padding: 40px 28px; }
          .reg-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="reg-root">
        <div className="reg-left">
          <div className="reg-left-bg" />
          <div className="reg-left-overlay" />
          <div className="reg-left-content">
            <img src={logoTurify} alt="Turify" className="reg-logo" />
          </div>
          <div className="reg-left-bottom">
            <h2 className="reg-left-title">Únete a la red<br /><span>Turify.</span></h2>
            <p className="reg-left-desc">
              Gestiona tus viajes, negocia tarifas y conecta con conductores verificados en Medellín y su región.
            </p>
            <div className="reg-steps">
              <div className="reg-step">
                <div className="reg-step-num">1</div>
                <div className="reg-step-text"><strong>Crea tu cuenta</strong>Completa el formulario en menos de 2 minutos.</div>
              </div>
              <div className="reg-step">
                <div className="reg-step-num">2</div>
                <div className="reg-step-text"><strong>Publica tu viaje</strong>Define origen, destino y condiciones.</div>
              </div>
              <div className="reg-step">
                <div className="reg-step-num">3</div>
                <div className="reg-step-text"><strong>Negocia y viaja</strong>Acepta o contraoferta la tarifa que más te convenga.</div>
              </div>
            </div>
            <p className="reg-copy">© 2026 Turify Transport. All rights reserved.</p>
          </div>
        </div>

        <div className="reg-right">
          <div className="reg-form-wrap">
            <button className="reg-back-btn" onClick={irALogin}>← Volver al login</button>

            <p className="reg-eyebrow">Nuevo usuario</p>
            <h2 className="reg-title">Crear cuenta</h2>
            <p className="reg-subtitle">Completa tus datos para comenzar.</p>

            <form onSubmit={handleSubmit}>
              <div className="reg-grid">
                <div className="reg-field reg-grid-full">
                  <label className="reg-label">Nombre completo</label>
                  <div className="reg-input-wrap">
                    <input type="text" name="full_name" placeholder="Juan Pérez" value={formData.full_name}
                      onChange={handleChange} className={`reg-input ${errores.full_name ? 'reg-input-error' : ''}`} disabled={isLoading} />
                  </div>
                  {errores.full_name && <span className="reg-field-error">{errores.full_name}</span>}
                </div>

                <div className="reg-field">
                  <label className="reg-label">Correo electrónico</label>
                  <div className="reg-input-wrap">
                    <input type="email" name="email" placeholder="tu@correo.com" value={formData.email}
                      onChange={handleChange} className={`reg-input ${errores.email ? 'reg-input-error' : ''}`} disabled={isLoading} />
                  </div>
                  {errores.email && <span className="reg-field-error">{errores.email}</span>}
                </div>

                <div className="reg-field">
                  <label className="reg-label">Teléfono</label>
                  <div className="reg-input-wrap">
                    <input type="text" name="phone_number" placeholder="3001234567" value={formData.phone_number}
                      onChange={handleChange} className="reg-input" disabled={isLoading} />
                  </div>
                </div>

                <div className="reg-field">
                  <label className="reg-label">Contraseña</label>
                  <div className="reg-input-wrap">
                    <input type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••"
                      value={formData.password} onChange={handleChange}
                      className={`reg-input reg-input-pw ${errores.password ? 'reg-input-error' : ''}`} disabled={isLoading} />
                    <button type="button" className="reg-pw-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="reg-field">
                  <label className="reg-label">Confirmar contraseña</label>
                  <div className="reg-input-wrap">
                    <input type={showConfirm ? 'text' : 'password'} name="confirmPassword" placeholder="••••••••"
                      value={formData.confirmPassword} onChange={handleChange}
                      className={`reg-input reg-input-pw ${errores.confirmPassword ? 'reg-input-error' : ''}`} disabled={isLoading} />
                    <button type="button" className="reg-pw-toggle" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                      {showConfirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {errores.confirmPassword && <span className="reg-field-error">{errores.confirmPassword}</span>}
                </div>
              </div>

              {formData.password.length > 0 && (
                <div className="reg-pw-checks">
                  <CheckItem ok={hasMinLength} label="8+ caracteres" />
                  <CheckItem ok={hasUppercase} label="Mayúscula" />
                  <CheckItem ok={hasNumber} label="Número" />
                  <CheckItem ok={formData.confirmPassword === formData.password && formData.confirmPassword !== ''} label="Coinciden" />
                </div>
              )}

              <button type="submit" disabled={!isFormValid || isLoading}
                className={`reg-btn ${isFormValid && !isLoading ? 'reg-btn-active' : 'reg-btn-disabled'}`}>
                {isLoading ? <div className="reg-loading-dots"><span /><span /><span /></div> : 'Crear cuenta'}
              </button>

              {errorBackend && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '11px 14px', color: '#fca5a5', fontSize: '13px', marginTop: '12px' }}>
                  <span>⚠️</span> {errorBackend}
                </div>
              )}
              {mensajeExito && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '11px 14px', color: '#4ade80', fontSize: '13px', marginTop: '12px' }}>
                  <span>✅</span> {mensajeExito}
                </div>
              )}
            </form>

            <p className="reg-login-link">
              ¿Ya tienes cuenta?{' '}<a onClick={irALogin}>Inicia sesión</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Registro;