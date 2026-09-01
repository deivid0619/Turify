import { useState, useCallback, useEffect, useRef } from 'react';

// ── Tipos de toast ──
const CONFIG = {
  success: { bg: 'var(--t-musgo)', border: 'var(--t-ruta)', color: 'var(--t-musgo-texto)', icon: '✅', barColor: 'var(--t-ruta)' },
  error:   { bg: 'var(--t-alerta-suave)', border: '#C2410C', color: '#7f1d1d', icon: '❌', barColor: '#C2410C' },
  warning: { bg: 'var(--t-chiva-suave)', border: '#f59e0b', color: '#78350f', icon: '⚠️', barColor: '#f59e0b' },
  info:    { bg: 'var(--t-cielo-suave)', border: '#3b82f6', color: 'var(--t-cielo-texto)', icon: 'ℹ️', barColor: '#3b82f6' },
};

// ── Toast individual ──
const ToastItem = ({ id, type, message, duration, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const cfg = CONFIG[type] || CONFIG.info;
  const intervalRef = useRef(null);

  useEffect(() => {
    // Entrada
    requestAnimationFrame(() => setVisible(true));

    const step = 100 / (duration / 50);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(intervalRef.current); return 0; }
        return p - step;
      });
    }, 50);

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(id), 300);
    }, duration);

    return () => { clearTimeout(timer); clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
      backgroundColor: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderLeft: `4px solid ${cfg.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '8px',
      minWidth: '300px',
      maxWidth: '380px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
        <p style={{ margin: 0, fontSize: '13px', color: cfg.color, fontWeight: '500', lineHeight: '1.4', flex: 1 }}>
          {message}
        </p>
        <button
          onClick={() => { setVisible(false); setTimeout(() => onRemove(id), 300); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, opacity: 0.5, fontSize: '16px', padding: 0, flexShrink: 0, lineHeight: 1 }}>
          ×
        </button>
      </div>
      {/* Barra de progreso */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: '3px',
        width: `${progress}%`,
        backgroundColor: cfg.barColor,
        transition: 'width 0.05s linear',
        opacity: 0.6,
      }} />
    </div>
  );
};

// ── Contenedor de toasts ──
export const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: 'fixed',
    top: '80px',
    right: '20px',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    pointerEvents: 'none',
  }}>
    {toasts.map(t => (
      <div key={t.id} style={{ pointerEvents: 'all' }}>
        <ToastItem {...t} onRemove={onRemove} />
      </div>
    ))}
  </div>
);

// ── Hook para usar toasts ──
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur || 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
  };

  return { toasts, removeToast, toast };
};