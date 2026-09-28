import { useState, useEffect, useContext } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import {
  T, EstilosBase, Chip, Rotulo, Dato, Boton, LogoWordmark, BotonTema, useTema, TableroRuta,
  IconReloj, IconBandeja, IconRecargar, IconFlechaIzq, IconDocumento, IconVisto, IconEquis,
  IconPin, IconAlerta,
} from './diseno';
import { ToastContainer, useToast } from './Toast';
import { ModalDocumento } from './AdminConductores';
import { cop, cargarCuentasAdmin, verificarCuentaAdmin, cargarReclamosAdmin, resolverReclamoAdmin } from './pagos';

// ─────────────────────────────────────────────────────────────────────────────
//  Pagos — lo que solo puede decidir un administrador (ÉPICA 6):
//    · SCRUM-263 verificar que la cuenta del conductor esté a su nombre
//      (hasta entonces el pasajero no la ve).
//    · SCRUM-264 resolver los reclamos de pagos con la bitácora del viaje.
// ─────────────────────────────────────────────────────────────────────────────

const CLARO = '#EAF2EC';
const claro = (a) => `rgba(234,242,236,${a})`;
const SOBRE_MONTE = { fondo: 'rgba(255,255,255,0.07)', linea: T.monteLinea };

const FILTROS_CUENTAS = [
  { value: 'PENDIENTE_VERIFICACION', label: 'Por verificar' },
  { value: 'VERIFICADA', label: 'Verificadas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
  { value: 'TODAS', label: 'Todas' },
];
const FILTROS_RECLAMOS = [
  { value: 'ABIERTO', label: 'Abiertos' },
  { value: 'RESUELTO', label: 'Resueltos' },
  { value: 'TODOS', label: 'Todos' },
];

const ESTADO_CUENTA = {
  PENDIENTE_VERIFICACION: { tono: 'chiva', texto: 'Por verificar' },
  VERIFICADA: { tono: 'verde', texto: 'Verificada' },
  RECHAZADA: { tono: 'alerta', texto: 'Rechazada' },
};

// Estado del pago visto por el admin — neutro, sin "tú".
const ESTADO_PAGO = {
  PENDIENTE: 'Sin pagar',
  PAGO_REPORTADO: 'El pasajero dice que pagó',
  CONFIRMADO: 'Pagado',
  EN_RECLAMO: 'En reclamo',
  DEVOLUCION_PENDIENTE: 'Por devolver al pasajero',
  DEVOLUCION_REPORTADA: 'El conductor dice que lo devolvió',
  DEVUELTO: 'Devuelto',
  ANULADO: 'Anulado',
  RETENIDO: 'Retenido por Turify',
  LIBERADO: 'Entregado al conductor',
  REEMBOLSADO: 'Reembolsado',
};

const DECISION = {
  PAGO_CONFIRMADO: { label: 'El pago sí se hizo', ayuda: 'Queda como pagado.' },
  PAGO_PENDIENTE: { label: 'El pago no se hizo', ayuda: 'Vuelve a quedar por pagar.' },
  DEVOLUCION_PENDIENTE: { label: 'Hay que devolverlo', ayuda: 'El conductor debe devolvérselo al pasajero.' },
  DEVUELTO: { label: 'La devolución sí se hizo', ayuda: 'Queda como devuelto.' },
  ANULAR: { label: 'Ya no se debe', ayuda: 'El pago se anula.' },
  SIN_CAMBIOS: { label: 'Sin cambios en la plata', ayuda: 'Solo se cierra el reclamo con tu nota.' },
};

// Las decisiones que tienen sentido según lo que estaba pasando con el pago.
const opcionesDecision = (reclamo) => {
  if (!reclamo.pago) return ['SIN_CAMBIOS'];
  const base = reclamo.pago.estado === 'EN_RECLAMO' ? reclamo.pago_estado_previo : reclamo.pago.estado;
  if (base?.startsWith('DEVOLUCION')) return ['DEVUELTO', 'DEVOLUCION_PENDIENTE', 'ANULAR', 'SIN_CAMBIOS'];
  return ['PAGO_CONFIRMADO', 'PAGO_PENDIENTE', 'DEVOLUCION_PENDIENTE', 'ANULAR', 'SIN_CAMBIOS'];
};

const ayudaDecision = (clave, reclamo) => {
  if (clave === 'SIN_CAMBIOS' && reclamo.pago?.estado === 'EN_RECLAMO' && reclamo.pago_estado_previo) {
    return `Vuelve a como estaba: "${ESTADO_PAGO[reclamo.pago_estado_previo] || reclamo.pago_estado_previo}".`;
  }
  return DECISION[clave].ayuda;
};

// "Guatapé, Antioquia" -> "Guatapé": todo es Antioquia y así la ruta no se corta.
const municipio = (lugar) => (lugar || '').split(',')[0];

const fecha = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const tarjeta = {
  background: T.papel, border: `1px solid ${T.linea}`, borderRadius: T.rTarjeta,
  padding: 'clamp(16px,2.4vw,22px)', display: 'flex', flexDirection: 'column', gap: '16px',
};
const campoTexto = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: T.rControl,
  border: `1px solid ${T.linea}`, background: T.niebla, color: T.tinta, fontFamily: T.ui,
  fontSize: '14px', lineHeight: 1.45, resize: 'vertical',
};

// Etiqueta pequeña + valor, para los pares "dato: valor" de las tarjetas.
const Campo = ({ etiqueta, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
    <Rotulo>{etiqueta}</Rotulo>
    <div style={{ fontSize: '14.5px', color: T.tinta, overflowWrap: 'anywhere' }}>{children}</div>
  </div>
);

const Vacio = ({ texto }) => (
  <div style={{ ...tarjeta, alignItems: 'center', textAlign: 'center', padding: '48px 20px', color: T.piedra }}>
    <span style={{ display: 'inline-flex', color: T.piedraClara }}><IconBandeja size={34} /></span>
    <p style={{ margin: 0, fontSize: '14.5px' }}>{texto}</p>
  </div>
);


// ── Cuenta del conductor (SCRUM-263) ────────────────────────────────────────

const TarjetaCuenta = ({ cuenta, procesando, onVerificar, onVerDocumento }) => {
  const [rechazando, setRechazando] = useState(false);
  const [nota, setNota] = useState('');
  const estado = ESTADO_CUENTA[cuenta.estado] || { tono: 'neutro', texto: cuenta.estado };
  const pendiente = cuenta.estado === 'PENDIENTE_VERIFICACION';
  const idNota = `nota-rechazo-${cuenta.cuenta_id}`;

  return (
    <article style={tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: T.display, fontWeight: 700, fontSize: '17px', color: T.tinta }}>{cuenta.conductor_nombre}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.piedra, overflowWrap: 'anywhere' }}>
            {cuenta.conductor_email}{cuenta.conductor_telefono ? ` · ${cuenta.conductor_telefono}` : ''}
          </p>
        </div>
        <Chip tono={estado.tono} style={{ fontSize: '11.5px', padding: '4px 10px' }}>{estado.texto}</Chip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px 18px' }}>
        <Campo etiqueta="Titular de la cuenta">{cuenta.titular_nombre}</Campo>
        <Campo etiqueta="Cédula del titular"><Dato style={{ fontSize: '13.5px' }}>{cuenta.titular_documento}</Dato></Campo>
        <Campo etiqueta={cuenta.tipo_texto}><Dato style={{ fontSize: '13.5px' }}>{cuenta.numero}</Dato></Campo>
        <Campo etiqueta="Actualizada">{fecha(cuenta.actualizada_at)}</Campo>
      </div>

      {/* Lo que el admin compara: el titular contra la cédula que subió el conductor. */}
      <div style={{ background: T.niebla, border: `1px solid ${T.linea}`, borderRadius: T.rControl, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '13.5px', color: T.piedra, lineHeight: 1.5 }}>
          Revisa que el nombre y el número de la cédula coincidan con el titular de la cuenta.
        </p>
        {cuenta.cedula?.length ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cuenta.cedula.map(doc => (
              <Boton key={doc.document_id} variante="fantasma" onClick={() => onVerDocumento(doc)} style={{ padding: '8px 12px', background: T.papel }}>
                <IconDocumento size={15} />{doc.document_type === 'Cedula frente' ? 'Cédula (frente)' : 'Cédula (reverso)'}
              </Boton>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '13.5px', color: T.alertaTexto, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <IconAlerta size={15} />El conductor no ha subido la cédula. No la verifiques todavía.
          </p>
        )}
      </div>

      {cuenta.estado === 'RECHAZADA' && cuenta.nota_admin && (
        <p style={{ margin: 0, fontSize: '13.5px', color: T.alertaTexto }}>Motivo del rechazo: {cuenta.nota_admin}</p>
      )}

      {pendiente && !rechazando && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Boton onClick={() => onVerificar(cuenta, true)} disabled={procesando || !cuenta.cedula?.length}
            variante={procesando || !cuenta.cedula?.length ? 'inactivo' : 'primario'}>
            <IconVisto size={15} />{procesando ? 'Guardando' : 'Verificar cuenta'}
          </Boton>
          <Boton variante="peligro" onClick={() => setRechazando(true)} disabled={procesando}>
            <IconEquis size={15} />Rechazar
          </Boton>
        </div>
      )}

      {pendiente && rechazando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor={idNota} style={{ fontSize: '13.5px', color: T.tinta }}>
            Motivo del rechazo <span style={{ color: T.piedra }}>(el conductor lo ve para corregirla)</span>
          </label>
          <textarea id={idNota} rows={3} value={nota} onChange={e => setNota(e.target.value)} maxLength={500}
            placeholder="Ej.: el titular no coincide con la cédula" className="t-foco" style={campoTexto} />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Boton variante={nota.trim().length >= 5 && !procesando ? 'peligro' : 'inactivo'}
              disabled={nota.trim().length < 5 || procesando}
              onClick={() => onVerificar(cuenta, false, nota.trim())}>
              {procesando ? 'Guardando' : 'Rechazar cuenta'}
            </Boton>
            <Boton variante="fantasma" onClick={() => { setRechazando(false); setNota(''); }}>Cancelar</Boton>
          </div>
        </div>
      )}
    </article>
  );
};


// ── Reclamo (SCRUM-264) ─────────────────────────────────────────────────────

const Bitacora = ({ eventos }) => (
  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
    {eventos.map((e, i) => (
      <li key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px 12px', padding: '10px 0', borderTop: i ? `1px solid ${T.linea}` : 'none' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', color: T.tinta }}>
            <b style={{ fontWeight: 700 }}>{e.quien}</b> · {e.texto}{e.monto != null ? ` · ${cop(e.monto)}` : ''}
          </div>
          {e.detalle && <div style={{ fontSize: '12.5px', color: T.piedra, marginTop: '3px', overflowWrap: 'anywhere' }}>{e.detalle}</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', color: T.piedraClara, whiteSpace: 'nowrap' }}>
          {fecha(e.created_at)}
          {e.lat != null && e.lng != null && (
            <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" className="t-foco"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '3px', color: T.ruta, textDecoration: 'none' }}>
              <IconPin size={12} />Ver ubicación
            </a>
          )}
        </div>
      </li>
    ))}
  </ol>
);

const Persona = ({ rol, persona }) => (
  <Campo etiqueta={rol}>
    {persona ? (
      <>
        {persona.nombre}
        {persona.telefono && (
          <a href={`tel:${persona.telefono}`} className="t-foco" style={{ display: 'block', fontSize: '13px', color: T.ruta, textDecoration: 'none', marginTop: '2px' }}>
            {persona.telefono}
          </a>
        )}
      </>
    ) : '—'}
  </Campo>
);

const TarjetaReclamo = ({ reclamo, procesando, onResolver }) => {
  const [decision, setDecision] = useState(null);
  const [nota, setNota] = useState('');
  const [penalizar, setPenalizar] = useState(false);
  const [verBitacora, setVerBitacora] = useState(reclamo.estado === 'ABIERTO');
  const abierto = reclamo.estado === 'ABIERTO';
  const v = reclamo.viaje;
  const id = reclamo.reclamo_id;
  const listo = decision && nota.trim().length >= 5 && !procesando;

  return (
    <article style={tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          {v && <TableroRuta origen={municipio(v.origin)} destino={municipio(v.destination)} size={12} />}
          <span style={{ fontSize: '13px', color: T.piedra }}>
            Viaje #{v?.request_id} · {v?.trip_type === 'ROUND_TRIP' ? 'Ida y vuelta' : 'Solo ida'} · sale el {fecha(v?.departure_time)}
          </span>
        </div>
        <Chip tono={abierto ? 'alerta' : 'verde'} style={{ fontSize: '11.5px', padding: '4px 10px' }}>{abierto ? 'Abierto' : 'Resuelto'}</Chip>
      </div>

      {/* El motivo, con quién lo abrió y cuándo */}
      <div style={{ borderLeft: `3px solid ${abierto ? T.alerta : T.linea}`, paddingLeft: '14px' }}>
        <Rotulo>{reclamo.abierto_por_rol} · {reclamo.abierto_por || '—'} · {fecha(reclamo.created_at)}</Rotulo>
        <p style={{ margin: '6px 0 0', fontSize: '15px', color: T.tinta, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{reclamo.motivo}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '14px 18px' }}>
        {reclamo.pago ? (
          <Campo etiqueta={`Pago: ${reclamo.pago.etiqueta}`}>
            <b style={{ fontWeight: 700 }}>{cop(reclamo.pago.monto)}</b>
            <span style={{ display: 'block', fontSize: '13px', color: T.piedra, marginTop: '2px' }}>
              {ESTADO_PAGO[reclamo.pago.estado] || reclamo.pago.estado}
              {reclamo.pago.estado === 'EN_RECLAMO' && reclamo.pago_estado_previo
                ? ` (antes: ${(ESTADO_PAGO[reclamo.pago_estado_previo] || reclamo.pago_estado_previo).toLowerCase()})` : ''}
            </span>
          </Campo>
        ) : (
          <Campo etiqueta="Pago">Sobre el viaje, no sobre un pago</Campo>
        )}
        <Persona rol="Pasajero" persona={reclamo.pasajero} />
        <Persona rol="Conductor" persona={reclamo.conductor} />
      </div>

      <div>
        <button type="button" className="t-foco" aria-expanded={verBitacora} aria-controls={`bitacora-${id}`}
          onClick={() => setVerBitacora(x => !x)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.ruta, fontFamily: T.display, fontWeight: 700, fontSize: '13px' }}>
          {verBitacora ? 'Ocultar la bitácora del viaje' : `Ver la bitácora del viaje (${reclamo.bitacora.length})`}
        </button>
        {verBitacora && (
          <div id={`bitacora-${id}`} style={{ marginTop: '8px', background: T.niebla, border: `1px solid ${T.linea}`, borderRadius: T.rControl, padding: '2px 14px' }}>
            {reclamo.bitacora.length ? <Bitacora eventos={reclamo.bitacora} /> : <p style={{ fontSize: '13.5px', color: T.piedra }}>Sin eventos.</p>}
          </div>
        )}
      </div>

      {!abierto && (
        <div style={{ background: T.musgo, border: `1px solid ${T.musgoLinea}`, borderRadius: T.rControl, padding: '12px 14px', color: T.musgoTexto, fontSize: '13.5px', lineHeight: 1.5 }}>
          <b style={{ fontWeight: 700 }}>{DECISION[reclamo.decision]?.label || reclamo.decision}.</b> {reclamo.resolucion}
        </div>
      )}

      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `1px solid ${T.linea}`, paddingTop: '16px' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <legend style={{ padding: 0, marginBottom: '8px', fontFamily: T.display, fontWeight: 700, fontSize: '14px', color: T.tinta }}>¿Qué pasó con la plata?</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '8px' }}>
              {opcionesDecision(reclamo).map(clave => {
                const activa = decision === clave;
                return (
                  <label key={clave} htmlFor={`decision-${id}-${clave}`}
                    style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: T.rControl, cursor: 'pointer',
                      border: `1px solid ${activa ? T.ruta : T.linea}`, background: activa ? T.musgo : T.papel, transition: 'background .18s, border-color .18s' }}>
                    <input type="radio" id={`decision-${id}-${clave}`} name={`decision-${id}`} value={clave}
                      checked={activa} onChange={() => setDecision(clave)} style={{ marginTop: '3px', accentColor: 'var(--t-ruta)' }} />
                    <span>
                      <span style={{ display: 'block', fontSize: '14px', color: T.tinta }}>{DECISION[clave].label}</span>
                      <span style={{ display: 'block', fontSize: '12.5px', color: T.piedra, marginTop: '2px' }}>{ayudaDecision(clave, reclamo)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor={`nota-${id}`} style={{ fontSize: '13.5px', color: T.tinta }}>
              Nota <span style={{ color: T.piedra }}>(se la enviamos al pasajero y al conductor)</span>
            </label>
            <textarea id={`nota-${id}`} rows={3} value={nota} onChange={e => setNota(e.target.value)} maxLength={1000}
              placeholder="Ej.: el pasajero mostró el comprobante de Nequi" className="t-foco" style={campoTexto} />
          </div>

          {reclamo.conductor && (
            <label htmlFor={`penalizar-${id}`} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13.5px', color: T.tinta, cursor: 'pointer' }}>
              <input type="checkbox" id={`penalizar-${id}`} checked={penalizar} onChange={e => setPenalizar(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--t-alerta)' }} />
              <span>
                Contar como cancelación injustificada del conductor
                <span style={{ display: 'block', fontSize: '12.5px', color: T.piedra, marginTop: '2px' }}>Por ejemplo, si no volvió por el grupo. Baja su confiabilidad.</span>
              </span>
            </label>
          )}

          <div>
            <Boton variante={listo ? 'primario' : 'inactivo'} disabled={!listo}
              onClick={() => onResolver(reclamo, { decision, nota: nota.trim(), penalizar_conductor: penalizar })}>
              <IconVisto size={15} />{procesando ? 'Guardando' : 'Resolver reclamo'}
            </Boton>
          </div>
        </div>
      )}
    </article>
  );
};


// ── Página ──────────────────────────────────────────────────────────────────

const AdminPagos = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tema, alternarTema] = useTema();
  const { toasts, removeToast, toast } = useToast();

  const [pestana, setPestana] = useState(params.get('pestana') === 'reclamos' ? 'reclamos' : 'cuentas');
  const [estadoCuentas, setEstadoCuentas] = useState('PENDIENTE_VERIFICACION');
  const [estadoReclamos, setEstadoReclamos] = useState('ABIERTO');
  const [cuentas, setCuentas] = useState([]);
  const [reclamos, setReclamos] = useState([]);
  const [conteo, setConteo] = useState({ cuentas: null, reclamos: null });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [procesando, setProcesando] = useState(null);
  const [docPreview, setDocPreview] = useState(null);

  // La lista de la pestaña y el filtro que se están viendo.
  useEffect(() => {
    if (!token) return undefined;
    let vigente = true;
    const peticion = pestana === 'cuentas' ? cargarCuentasAdmin(token, estadoCuentas) : cargarReclamosAdmin(token, estadoReclamos);
    peticion
      .then(datos => {
        if (!vigente) return;
        if (pestana === 'cuentas') setCuentas(datos); else setReclamos(datos);
        setError(null);
      })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, pestana, estadoCuentas, estadoReclamos, recarga]);

  // Lo que está esperando al admin, para el número de cada pestaña.
  useEffect(() => {
    if (!token) return undefined;
    let vigente = true;
    Promise.all([cargarCuentasAdmin(token), cargarReclamosAdmin(token)])
      .then(([c, r]) => { if (vigente) setConteo({ cuentas: c.length, reclamos: r.length }); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [token, recarga]);

  const recargar = () => { setCargando(true); setRecarga(x => x + 1); };
  const cambiarPestana = (p) => { if (p !== pestana) { setCargando(true); setPestana(p); } };
  const cambiarFiltro = (valor) => {
    setCargando(true);
    if (pestana === 'cuentas') setEstadoCuentas(valor); else setEstadoReclamos(valor);
  };

  const verificar = async (cuenta, aprobar, nota) => {
    setProcesando(`cuenta-${cuenta.cuenta_id}`);
    try {
      await verificarCuentaAdmin(token, cuenta.cuenta_id, aprobar, nota);
      toast.success(aprobar
        ? `Cuenta de ${cuenta.conductor_nombre} verificada. Sus pasajeros ya la ven.`
        : `Cuenta rechazada. Le avisamos a ${cuenta.conductor_nombre}.`);
      recargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesando(null);
    }
  };

  const resolver = async (reclamo, datos) => {
    setProcesando(`reclamo-${reclamo.reclamo_id}`);
    try {
      await resolverReclamoAdmin(token, reclamo.reclamo_id, datos);
      toast.success('Reclamo resuelto. Les avisamos al pasajero y al conductor.');
      recargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesando(null);
    }
  };

  const filtros = pestana === 'cuentas' ? FILTROS_CUENTAS : FILTROS_RECLAMOS;
  const filtroActivo = pestana === 'cuentas' ? estadoCuentas : estadoReclamos;
  const lista = pestana === 'cuentas' ? cuentas : reclamos;

  const PESTANAS = [
    { id: 'cuentas', label: 'Cuentas', n: conteo.cuentas },
    { id: 'reclamos', label: 'Reclamos', n: conteo.reclamos },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.niebla2, fontFamily: T.ui }}>
      <EstilosBase />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <AnimatePresence>
        {docPreview && <ModalDocumento doc={docPreview} onCerrar={() => setDocPreview(null)} token={token} />}
      </AnimatePresence>

      <header style={{ background: T.monte, padding: '16px clamp(16px,4vw,40px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/conductores')} className="t-foco"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, borderRadius: T.rControl, padding: '9px 14px', cursor: 'pointer', fontSize: '13.5px', fontFamily: T.display, fontWeight: 600, color: claro(0.9) }}>
            <IconFlechaIzq size={15} />Volver al panel
          </button>
          <div>
            <LogoWordmark alto={13} oscuro />
            <h1 style={{ margin: '10px 0 0', fontSize: '21px', fontWeight: 800, fontFamily: T.display, letterSpacing: '-.02em', color: CLARO }}>Pagos</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <BotonTema tema={tema} alternar={alternarTema} compacto />
          <Boton onClick={recargar} style={{ padding: '10px 16px' }}>
            <IconRecargar size={15} />{cargando ? 'Actualizando' : 'Actualizar'}
          </Boton>
        </div>
      </header>

      <main style={{ padding: '24px clamp(16px,4vw,40px) 48px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

        <div role="tablist" aria-label="Qué revisar" style={{ display: 'flex', gap: '6px', borderBottom: `1px solid ${T.linea}`, flexWrap: 'wrap' }}>
          {PESTANAS.map(p => {
            const activa = pestana === p.id;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={activa} onClick={() => cambiarPestana(p.id)} className="t-foco"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '-1px', cursor: 'pointer', background: 'none',
                  border: 'none', borderBottom: `2px solid ${activa ? T.ruta : 'transparent'}`, color: activa ? T.tinta : T.piedra,
                  fontFamily: T.display, fontWeight: 700, fontSize: '14px', transition: 'color .18s, border-color .18s' }}>
                {p.label}
                {p.n > 0 && (
                  <span aria-label={`${p.n} por revisar`} style={{ minWidth: '20px', padding: '1px 7px', borderRadius: T.rChip, background: T.chivaSuave, border: `1px solid ${T.chivaLinea}`, color: T.chivaTexto, fontSize: '11.5px', textAlign: 'center' }}>
                    {p.n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p style={{ margin: 0, fontSize: '14px', color: T.piedra, lineHeight: 1.55, maxWidth: '68ch' }}>
          {pestana === 'cuentas'
            ? 'El pasajero solo ve la cuenta del conductor cuando la verificas. Verifícala únicamente si está a nombre del conductor.'
            : 'Cuando alguien dice que un pago o una devolución no le llegó, el pago queda en reclamo. Revisa la bitácora, llama a las partes si hace falta y decide.'}
        </p>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {filtros.map(f => (
            <button key={f.value} type="button" onClick={() => cambiarFiltro(f.value)} className="t-foco" aria-pressed={filtroActivo === f.value}
              style={{ padding: '7px 13px', borderRadius: T.rChip, cursor: 'pointer', fontSize: '12.5px', fontFamily: T.display, fontWeight: 600, transition: 'background .18s, color .18s',
                border: `1px solid ${filtroActivo === f.value ? T.tinta : T.linea}`,
                backgroundColor: filtroActivo === f.value ? T.tinta : T.papel,
                color: filtroActivo === f.value ? T.papel : T.piedra }}>
              {f.label}
            </button>
          ))}
          {!cargando && !error && (
            <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: T.piedraClara }}>{lista.length} en la lista</span>
          )}
        </div>

        {cargando ? (
          <div style={{ ...tarjeta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '48px 20px', color: T.piedra, fontSize: '14px' }}>
            <IconReloj size={16} />Cargando
          </div>
        ) : error ? (
          <div style={{ ...tarjeta, color: T.alertaTexto, background: T.alertaSuave, borderColor: T.alertaLinea, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <IconAlerta size={16} />{error}
          </div>
        ) : pestana === 'cuentas' ? (
          cuentas.length === 0 ? (
            <Vacio texto={estadoCuentas === 'PENDIENTE_VERIFICACION' ? 'No hay cuentas por verificar.' : 'No hay cuentas en esta lista.'} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: '14px', alignItems: 'start' }}>
              {cuentas.map(c => (
                <TarjetaCuenta key={c.cuenta_id} cuenta={c} procesando={procesando === `cuenta-${c.cuenta_id}`}
                  onVerificar={verificar} onVerDocumento={setDocPreview} />
              ))}
            </div>
          )
        ) : (
          reclamos.length === 0 ? (
            <Vacio texto={estadoReclamos === 'ABIERTO' ? 'No hay reclamos abiertos.' : 'No hay reclamos en esta lista.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reclamos.map(r => (
                <TarjetaReclamo key={r.reclamo_id} reclamo={r} procesando={procesando === `reclamo-${r.reclamo_id}`} onResolver={resolver} />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default AdminPagos;
