import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BRAND_GREEN = '#16a34a';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MINUTOS_DISPONIBLES = [0, 15, 30, 45];

// value / min / onChange usan el mismo formato "YYYY-MM-DDTHH:mm" que ya
// producía el <input type="datetime-local"> nativo, para no tener que tocar
// nada del resto del formulario (payload, validaciones, etc.).
const aPartesLocal = (valor) => {
  if (!valor) return null;
  const [fecha, hora] = valor.split('T');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = (hora || '00:00').split(':').map(Number);
  return { anio, mes: mes - 1, dia, hora: h, minuto: m };
};

const aValor = (anio, mes, dia, hora, minuto) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${anio}-${pad(mes + 1)}-${pad(dia)}T${pad(hora)}:${pad(minuto)}`;
};

const formatearBonito = (valor) => {
  const p = aPartesLocal(valor);
  if (!p) return null;
  const fecha = new Date(p.anio, p.mes, p.dia);
  const diaSemana = fecha.toLocaleDateString('es-CO', { weekday: 'short' });
  const pad = (n) => String(n).padStart(2, '0');
  return `${diaSemana[0].toUpperCase()}${diaSemana.slice(1)} ${p.dia} ${MESES[p.mes].slice(0, 3)} · ${pad(p.hora)}:${pad(p.minuto)}`;
};

const mismodDia = (a, b) => a && b && a.anio === b.anio && a.mes === b.mes && a.dia === b.dia;

// Redondea un objeto {anio,mes,dia,hora,minuto} hacia arriba al siguiente
// múltiplo de 15 minutos (para que el borrador inicial nunca caiga en un
// minuto que no está en MINUTOS_DISPONIBLES).
const redondearAMinutosValidos = (p) => {
  const totalMin = p.hora * 60 + p.minuto;
  const redondeado = Math.ceil(totalMin / 15) * 15;
  return { ...p, hora: Math.floor(redondeado / 60) % 24, minuto: redondeado % 60 };
};

/**
 * Selector de fecha y hora con calendario propio + confirmación explícita.
 * A diferencia del <input type="datetime-local"> nativo (que aplica el
 * cambio apenas se toca cualquier parte, sin forma de revisar antes), este
 * componente deja elegir día y hora libremente y solo confirma el valor
 * cuando el usuario presiona "Confirmar horario".
 */
export default function SelectorFechaHora({ label, value, onChange, min, placeholder = 'Elige fecha y hora', required = false, ancho }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  const minPartes = aPartesLocal(min) || (() => {
    const ahora = new Date();
    return { anio: ahora.getFullYear(), mes: ahora.getMonth(), dia: ahora.getDate(), hora: ahora.getHours(), minuto: ahora.getMinutes() };
  })();

  const valorInicial = () => {
    const p = aPartesLocal(value);
    if (p) return p;
    return redondearAMinutosValidos({ ...minPartes });
  };

  const [mesVisible, setMesVisible] = useState(() => valorInicial().mes);
  const [anioVisible, setAnioVisible] = useState(() => valorInicial().anio);
  const [borrador, setBorrador] = useState(() => valorInicial());

  useEffect(() => {
    if (!abierto) return;
    const inicial = valorInicial();
    setBorrador(inicial);
    setMesVisible(inicial.mes);
    setAnioVisible(inicial.anio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiAfuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrarSiAfuera);
    return () => document.removeEventListener('mousedown', cerrarSiAfuera);
  }, [abierto]);

  const primerDiaMes = new Date(anioVisible, mesVisible, 1);
  // getDay(): 0=domingo..6=sábado → lo pasamos a 0=lunes..6=domingo
  const offsetInicio = (primerDiaMes.getDay() + 6) % 7;
  const diasEnMes = new Date(anioVisible, mesVisible + 1, 0).getDate();
  const celdas = [...Array(offsetInicio).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

  const fechaMinima = new Date(minPartes.anio, minPartes.mes, minPartes.dia);
  const esDiaDeshabilitado = (dia) => new Date(anioVisible, mesVisible, dia) < fechaMinima;

  const esMesMinimo = anioVisible === minPartes.anio && mesVisible === minPartes.mes;
  const horaMinimaHoy = mismodDia(borrador, minPartes) ? minPartes.hora * 60 + minPartes.minuto : null;

  const cambiarMes = (delta) => {
    let m = mesVisible + delta, a = anioVisible;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    if (a < minPartes.anio || (a === minPartes.anio && m < minPartes.mes)) return; // no dejar ir antes del mes mínimo
    setMesVisible(m); setAnioVisible(a);
  };

  const elegirDia = (dia) => {
    if (esDiaDeshabilitado(dia)) return;
    setBorrador(prev => {
      const nuevo = { anio: anioVisible, mes: mesVisible, dia, hora: prev.hora, minuto: prev.minuto };
      // si el día elegido es el día mínimo y la hora quedó antes de la hora mínima, la subimos
      if (mismodDia(nuevo, minPartes) && nuevo.hora * 60 + nuevo.minuto < minPartes.hora * 60 + minPartes.minuto) {
        return redondearAMinutosValidos({ ...nuevo, hora: minPartes.hora, minuto: minPartes.minuto });
      }
      return nuevo;
    });
  };

  const confirmar = () => {
    onChange(aValor(borrador.anio, borrador.mes, borrador.dia, borrador.hora, borrador.minuto));
    setAbierto(false);
  };

  const bonito = formatearBonito(value);
  const fieldBoxStyle = { display: 'flex', alignItems: 'center', border: '1px solid #e8e4db', borderRadius: '12px', padding: '11px 14px', backgroundColor: '#fff', cursor: 'pointer' };
  const fieldLabelStyle = { fontSize: '10px', fontWeight: '700', color: '#8a8578', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' };

  return (
    <div ref={contenedorRef} style={{ position: 'relative', width: ancho || '100%' }}>
      <div style={{ ...fieldBoxStyle, flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => setAbierto(o => !o)}>
        {label && <div style={fieldLabelStyle}>{label}</div>}
        <div style={{ fontSize: '13px', color: bonito ? '#000' : '#888', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8578" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          {bonito || placeholder}
        </div>
        {/* input oculto solo para que el atributo required funcione con el submit del formulario */}
        <input type="text" value={value || ''} required={required} readOnly tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
      </div>

      <AnimatePresence>
        {abierto && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 2000, background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid #eee', padding: '16px', width: '290px' }}>

            {/* Encabezado mes/año */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button type="button" onClick={() => cambiarMes(-1)} disabled={esMesMinimo}
                style={{ border: 'none', background: 'none', cursor: esMesMinimo ? 'default' : 'pointer', color: esMesMinimo ? '#d4d4d4' : '#334155', fontSize: '16px', padding: '4px 8px' }}>‹</button>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{MESES[mesVisible]} {anioVisible}</span>
              <button type="button" onClick={() => cambiarMes(1)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#334155', fontSize: '16px', padding: '4px 8px' }}>›</button>
            </div>

            {/* Días de la semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#9ca3af' }}>{d}</div>
              ))}
            </div>

            {/* Grilla de días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '14px' }}>
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`vacio-${i}`} />;
                const deshabilitado = esDiaDeshabilitado(dia);
                const seleccionado = mismodDia(borrador, { anio: anioVisible, mes: mesVisible, dia });
                return (
                  <button key={dia} type="button" disabled={deshabilitado} onClick={() => elegirDia(dia)}
                    style={{
                      aspectRatio: '1', border: 'none', borderRadius: '8px', cursor: deshabilitado ? 'default' : 'pointer',
                      fontSize: '12px', fontWeight: seleccionado ? '700' : '500',
                      background: seleccionado ? BRAND_GREEN : 'transparent',
                      color: deshabilitado ? '#d4d4d4' : seleccionado ? '#fff' : '#334155',
                    }}>
                    {dia}
                  </button>
                );
              })}
            </div>

            {/* Selector de hora */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8578" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
              </svg>
              <select value={borrador.hora} onChange={e => setBorrador(prev => ({ ...prev, hora: Number(e.target.value) }))}
                style={{ flex: 1, padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
                {Array.from({ length: 24 }, (_, h) => h)
                  .filter(h => horaMinimaHoy === null || h * 60 + 45 >= horaMinimaHoy)
                  .map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
              </select>
              <span style={{ color: '#94a3b8', fontWeight: '700' }}>:</span>
              <select value={borrador.minuto} onChange={e => setBorrador(prev => ({ ...prev, minuto: Number(e.target.value) }))}
                style={{ flex: 1, padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
                {MINUTOS_DISPONIBLES
                  .filter(m => horaMinimaHoy === null || borrador.hora * 60 + m >= horaMinimaHoy)
                  .map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setAbierto(false)}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmar}
                style={{ flex: 1.4, padding: '9px', borderRadius: '8px', border: 'none', background: BRAND_GREEN, color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                Confirmar horario
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
