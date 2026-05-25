import API_BASE_URL from './api';
import { useState } from 'react';
import logoTurify from './logo.png';
import fondoImagen from './fondo.png';

const Login = ({ irARegistro, onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorBackend, setErrorBackend] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isFormValid = formData.email.includes('@') && formData.password.length > 0;

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          display: flex;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          background: #050e05;
        }

        .login-left {
          flex: 1.1;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 80px;
          overflow: hidden;
        }

        .login-left-bg {
          position: absolute;
          inset: 0;
          background-image: url(${fondoImagen});
          background-size: cover;
          background-position: center;
          filter: brightness(0.45) saturate(1.2);
        }

        .login-left-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(5, 30, 5, 0.15) 0%,
            rgba(5, 14, 5, 0.75) 60%,
            rgba(5, 14, 5, 0.97) 100%
          );
        }

        .login-lines {
          position: absolute;
          top: 0; right: 0;
          width: 260px; height: 260px;
          border: 1px solid rgba(34,197,94,0.12);
          border-radius: 50%;
          transform: translate(40%, -40%);
        }
        .login-lines::before {
          content: '';
          position: absolute;
          inset: 24px;
          border: 1px solid rgba(34,197,94,0.08);
          border-radius: 50%;
        }
        .login-lines::after {
          content: '';
          position: absolute;
          inset: 48px;
          border: 1px solid rgba(34,197,94,0.06);
          border-radius: 50%;
        }

        .login-left-content { position: relative; z-index: 2; }

        .login-logo {
          width: 220px;
          margin-bottom: 36px;
          filter: drop-shadow(0 0 30px rgba(34,197,94,0.3));
        }

        .login-tagline {
          font-family: 'Syne', sans-serif;
          font-size: 44px;
          font-weight: 800;
          color: #fff;
          line-height: 1.15;
          margin-bottom: 18px;
          letter-spacing: -0.5px;
        }
        .login-tagline span { color: #22c55e; }

        .login-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          line-height: 1.7;
          max-width: 360px;
          font-weight: 300;
        }

        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 36px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 100px;
          padding: 7px 16px;
          font-size: 12px;
          color: #86efac;
          font-weight: 500;
          letter-spacing: 0.3px;
        }

        .login-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }

        .login-copy {
          position: absolute;
          bottom: 24px; left: 60px;
          font-size: 11px;
          color: rgba(255,255,255,0.22);
          z-index: 2;
        }

        .login-right {
          flex: 0 0 440px;
          background: #0a0f0a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 48px;
          border-left: 1px solid rgba(34,197,94,0.08);
          position: relative;
        }

        .login-right::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-form-wrap {
          width: 100%;
          max-width: 360px;
          position: relative;
          z-index: 1;
        }

        .login-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #22c55e;
          margin-bottom: 12px;
        }

        .login-title {
          font-family: 'Syne', sans-serif;
          font-size: 30px;
          font-weight: 800;
          color: #f0fdf4;
          margin-bottom: 8px;
          letter-spacing: -0.3px;
        }

        .login-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.38);
          margin-bottom: 36px;
          font-weight: 300;
        }

        .login-field { margin-bottom: 16px; }

        .login-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.45);
          margin-bottom: 7px;
          letter-spacing: 0.3px;
        }

        .login-input-wrap { position: relative; }

        .login-input {
          width: 100%;
          padding: 13px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          color: #f0fdf4;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }

        .login-input::placeholder { color: rgba(255,255,255,0.2); }

        .login-input:focus {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.04);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.08);
        }

        .login-input-pw { padding-right: 48px; }

        .pw-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          font-size: 16px;
          padding: 0;
          line-height: 1;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: rgba(255,255,255,0.65); }

        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 11px 14px;
          color: #fca5a5;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.2px;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .login-btn-active {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: #052e16;
          box-shadow: 0 4px 20px rgba(34,197,94,0.3);
        }
        .login-btn-active:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(34,197,94,0.4);
        }
        .login-btn-active:active { transform: translateY(0); }

        .login-btn-disabled {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.2);
          cursor: not-allowed;
        }

        .login-loading-dots {
          display: inline-flex;
          gap: 4px;
          align-items: center;
        }
        .login-loading-dots span {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #052e16;
          animation: bounce-dot 1s infinite;
        }
        .login-loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .login-loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 28px 0 24px;
        }
        .login-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }
        .login-divider-text {
          font-size: 12px;
          color: rgba(255,255,255,0.25);
        }

        .login-register-link {
          text-align: center;
          font-size: 14px;
          color: rgba(255,255,255,0.35);
        }
        .login-register-link a {
          color: #22c55e;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-register-link a:hover { color: #4ade80; }

        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right { flex: 1; border-left: none; }
        }
      `}</style>

      <div className="login-root">
        <div className="login-left">
          <div className="login-left-bg" />
          <div className="login-left-overlay" />
          <div className="login-lines" />
          <div className="login-left-content">
            <img src={logoTurify} alt="Turify" className="login-logo" />
            <h1 className="login-tagline">
              Tu viaje,<br />
              <span>tus condiciones.</span>
            </h1>
            <p className="login-desc">
              Conectamos pasajeros y conductores con tarifas justas, negociadas en tiempo real.
            </p>
            <div className="login-badge">
              <div className="login-badge-dot" />
              Sistema activo · Medellín y región
            </div>
          </div>
          <p className="login-copy">© 2026 Turify Transport. All rights reserved.</p>
        </div>

        <div className="login-right">
          <div className="login-form-wrap">
            <p className="login-eyebrow">Bienvenido de nuevo</p>
            <h2 className="login-title">Inicia sesión</h2>
            <p className="login-subtitle">Accede a tu cuenta para continuar.</p>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-label">Correo electrónico</label>
                <div className="login-input-wrap">
                  <input type="email" name="email" placeholder="tu@correo.com"
                    value={formData.email} onChange={handleChange}
                    className="login-input" disabled={isLoading} autoComplete="email" />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">Contraseña</label>
                <div className="login-input-wrap">
                  <input type={showPassword ? 'text' : 'password'} name="password"
                    placeholder="••••••••" value={formData.password} onChange={handleChange}
                    className="login-input login-input-pw" disabled={isLoading} autoComplete="current-password" />
                  <button type="button" className="pw-toggle"
                    onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {errorBackend && (
                <div className="login-error">
                  <span>⚠️</span> {errorBackend}
                </div>
              )}

              <button type="submit" disabled={!isFormValid || isLoading}
                className={`login-btn ${isFormValid && !isLoading ? 'login-btn-active' : 'login-btn-disabled'}`}>
                {isLoading ? (
                  <div className="login-loading-dots"><span /><span /><span /></div>
                ) : 'Ingresar'}
              </button>
            </form>

            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">¿nuevo aquí?</span>
              <div className="login-divider-line" />
            </div>

            <p className="login-register-link">
              ¿No tienes cuenta?{' '}
              <a onClick={irARegistro}>Regístrate gratis</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
