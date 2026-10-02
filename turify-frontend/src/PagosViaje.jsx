import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { T, Chip, Rotulo, Dato, IconAlerta, IconEscudo } from './diseno';
import { cop, cargarCuentaPagos, guardarCuentaPagos } from './pagos';
import { codigoViaje, municipioDe } from './viajes';

// ─────────────────────────────────────────────────────────────────────────────
//  PAGOS DEL VIAJE — ÉPICA 6 (SCRUM-178)
//  Lo usan el pasajero (Dashboard) y el conductor (PanelConductor). El backend
//  decide qué botones ve cada uno (campo `acciones` de cada pago): quien
//  recibe la plata es quien confirma; quien la entrega solo reporta.
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO = {
  PAGO_REPORTADO:       { tono: 'cielo',  label: 'Reportado',  barra: T.cielo },
  CONFIRMADO:           { tono: 'verde',  label: 'Pagado',     barra: T.ruta },
  RETENIDO:             { tono: 'verde',  label: 'Pagado',     barra: T.ruta },
  LIBERADO:             { tono: 'verde',  label: 'Pagado',     barra: T.ruta },
  EN_RECLAMO:           { tono: 'alerta', label: 'En reclamo', barra: T.alerta },
  DEVOLUCION_PENDIENTE: { tono: 'chiva',  label: 'Por devolver', barra: T.chiva },
  DEVOLUCION_REPORTADA: { tono: 'cielo',  label: 'Devolución reportada', barra: T.cielo },
  DEVUELTO:             { tono: 'neutro', label: 'Devuelto',   barra: T.linea },
  REEMBOLSADO:          { tono: 'neutro', label: 'Reembolsado', barra: T.linea },
  ANULADO:              { tono: 'neutro', label: 'No se cobra', barra: T.linea },
};
const estadoDe = (pago) => {
  if (pago.estado === 'PENDIENTE') {
    return pago.exigible
      ? { tono: 'chiva', label: 'Por pagar', barra: T.chiva }
      : { tono: 'neutro', label: 'Más adelante', barra: T.niebla2 };
  }
  return ESTADO[pago.estado] || { tono: 'neutro', label: pago.estado, barra: T.linea };
};

const ACCION = {
  PAGAR_EN_LINEA:         { label: (p) => `Pagar ${cop(p.monto)} en línea`, variante: 'primario', ocupado: 'Abriendo Wompi…' },
  REPORTAR_PAGO:          { label: () => 'Ya pagué', variante: 'primario' },
  CONFIRMAR_RECIBIDO:     { label: (p) => `Recibí ${cop(p.monto)}`, variante: 'primario',
                            confirmar: (p) => `¿Confirmas que recibiste ${cop(p.monto)}? No se puede deshacer.` },
  NO_RECIBIDO:            { label: (p) => (p.estado === 'PAGO_REPORTADO' ? 'No lo he recibido' : 'No me han pagado'), variante: 'peligro',
                            confirmar: () => 'Se abre un reclamo y un administrador de Turify revisa el caso con la bitácora del viaje.' },
  REPORTAR_DEVOLUCION:    { label: () => 'Ya lo devolví', variante: 'primario' },
  CONFIRMAR_DEVOLUCION:   { label: (p) => `Me llegaron ${cop(p.monto)}`, variante: 'primario',
                            confirmar: (p) => `¿Confirmas que te devolvieron ${cop(p.monto)}? No se puede deshacer.` },
  DEVOLUCION_NO_RECIBIDA: { label: () => 'No me ha llegado', variante: 'peligro',
                            confirmar: () => 'Se abre un reclamo y un administrador de Turify revisa el caso.' },
};

const estiloBoton = (variante, deshabilitado) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  borderRadius: '8px', padding: '7px 12px', fontFamily: T.ui, fontWeight: 700, fontSize: '12.5px',
  cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? 0.6 : 1,
  border: '1px solid transparent',
  ...(variante === 'peligro'
    ? { background: T.alertaSuave, color: T.alertaTexto, borderColor: T.alertaLinea }
    : variante === 'fantasma'
      ? { background: 'transparent', color: T.piedra, borderColor: T.linea }
      : { background: T.ruta, color: T.sobreRuta }),
});

// Barra de pagos: cada tramo ocupa su porcentaje del precio (20/50/30 o
// 30/70) y se pinta según cómo va ese pago.
const BarraPagos = ({ pagos }) => (
  <div aria-hidden="true" style={{ display: 'flex', gap: '3px', height: '6px', margin: '2px 0 10px' }}>
    {pagos.map(p => (
      <span key={p.pago_id} style={{ flex: `${p.porcentaje} 1 0`, borderRadius: '3px', background: estadoDe(p).barra, transition: 'background-color .3s' }} />
    ))}
  </div>
);

const FilaPago = ({ pago, onAccion, procesando }) => {
  const [confirmando, setConfirmando] = useState(null);
  const est = estadoDe(pago);
  const mostrarTexto = !['CONFIRMADO', 'ANULADO', 'DEVUELTO'].includes(pago.estado) && !(pago.estado === 'PENDIENTE' && !pago.exigible);

  const ejecutar = (accion) => {
    setConfirmando(null);
    onAccion(pago, accion);
  };

  return (
    <div style={{ padding: '9px 0', borderTop: `1px solid ${T.niebla2}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: T.tinta }}>
            {pago.etiqueta} <span style={{ fontWeight: 500, color: T.piedraClara, fontSize: '11.5px' }}>{Math.round(pago.porcentaje)} %</span>
          </div>
          <div style={{ fontSize: '11.5px', color: T.piedra }}>{pago.momento}</div>
        </div>
        <span style={{ fontFamily: T.dato, fontWeight: 600, fontSize: '13.5px', color: T.tinta, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cop(pago.monto)}</span>
        <Chip tono={est.tono} style={{ flexShrink: 0 }}>{est.label}</Chip>
      </div>

      {mostrarTexto && pago.estado_texto && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: pago.estado === 'EN_RECLAMO' ? T.alertaTexto : T.piedra, lineHeight: 1.45 }}>{pago.estado_texto}</p>
      )}

      {pago.acciones?.length > 0 && !confirmando && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {pago.acciones.map(accion => {
            const cfg = ACCION[accion];
            if (!cfg) return null;
            const ocupadoAccion = procesando === `${pago.pago_id}:${accion}`;
            return (
              <button key={accion} type="button" className="t-foco" disabled={!!procesando}
                onClick={() => (cfg.confirmar ? setConfirmando(accion) : ejecutar(accion))}
                style={estiloBoton(cfg.variante, !!procesando)}>
                {ocupadoAccion ? (cfg.ocupado || 'Guardando…') : cfg.label(pago)}
              </button>
            );
          })}
        </div>
      )}

      {pago.acciones?.includes('PAGAR_EN_LINEA') && !confirmando && (
        <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: T.piedra, lineHeight: 1.45, display: 'flex', gap: '5px', alignItems: 'flex-start' }}>
          <IconEscudo size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
          Pagas en Wompi con tarjeta, PSE, Nequi o Bancolombia. Turify guarda el anticipo y se lo entrega al conductor cuando lleguen al destino.
        </p>
      )}

      {confirmando && (
        <div style={{ marginTop: '8px', padding: '9px 11px', borderRadius: '8px', background: T.niebla, border: `1px solid ${T.linea}` }}>
          <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: T.tinta, lineHeight: 1.45 }}>{ACCION[confirmando].confirmar(pago)}</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="t-foco" onClick={() => ejecutar(confirmando)} disabled={!!procesando}
              style={estiloBoton(ACCION[confirmando].variante, !!procesando)}>
              {ACCION[confirmando].variante === 'peligro' ? 'Sí, abrir reclamo' : 'Sí, confirmar'}
            </button>
            <button type="button" className="t-foco" onClick={() => setConfirmando(null)} style={estiloBoton('fantasma', false)}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const PlanPagos = ({ plan, onAccion, procesando, onReclamo, compacto = false }) => {
  if (!plan) return null;
  const devoluciones = plan.devoluciones_de_otros_conductores || [];
  return (
    <div style={{ marginTop: '10px', border: `1px solid ${T.linea}`, borderRadius: '10px', padding: compacto ? '10px 12px' : '12px 14px', background: T.papel }}>
      {plan.pagos.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <Rotulo>Pagos del viaje</Rotulo>
            <span style={{ fontSize: '12px', color: T.piedra, fontVariantNumeric: 'tabular-nums' }}>
              Pagado <b style={{ color: T.tinta }}>{cop(plan.pagado)}</b> de {cop(plan.precio)}
            </span>
          </div>
          <BarraPagos pagos={plan.pagos} />
          {plan.pagos.map(p => <FilaPago key={p.pago_id} pago={p} onAccion={onAccion} procesando={procesando} />)}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: `1px solid ${T.niebla2}`, fontSize: '11.5px', color: T.piedra }}>
            <span>Comisión de Turify: <b style={{ color: T.tinta }}>{cop(plan.comision)}</b>{plan.comision === 0 && ' (no se cobra en este viaje)'}</span>
            <span>Recibe el conductor: <b style={{ color: T.tinta }}>{cop(plan.neto_conductor)}</b></span>
          </div>
        </>
      )}

      {devoluciones.length > 0 && (
        <div style={{ marginTop: plan.pagos.length ? '12px' : 0 }}>
          <Rotulo style={{ marginBottom: '4px' }}>Devolución de tu conductor anterior</Rotulo>
          {devoluciones.map(p => <FilaPago key={p.pago_id} pago={p} onAccion={onAccion} procesando={procesando} />)}
        </div>
      )}

      {onReclamo && (
        <button type="button" onClick={onReclamo} className="t-foco"
          style={{ marginTop: '8px', background: 'none', border: 'none', padding: 0, color: T.piedra, fontSize: '12px', fontFamily: T.ui, textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer' }}>
          ¿Algún problema con un pago? Abrir un reclamo
        </button>
      )}
    </div>
  );
};

// Pagos sueltos (viajes cancelados o que volvieron a quedar sin conductor):
// devoluciones y reclamos que ya no salen en ninguna tarjeta de viaje.
export const PagosPendientes = ({ pendientes, onAccion, procesando, titulo }) => {
  if (!pendientes?.length) return null;
  return (
    <div style={{ marginBottom: '14px', border: `1px solid ${T.chivaLinea}`, background: T.chivaSuave, borderRadius: '12px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 700, color: T.chivaTexto, marginBottom: '4px' }}>
        <IconAlerta size={14} />{titulo}
      </div>
      {pendientes.map(({ viaje, pago }) => (
        <div key={pago.pago_id} style={{ marginTop: '6px', background: T.papel, borderRadius: '9px', padding: '4px 11px', border: `1px solid ${T.linea}` }}>
          <div style={{ fontSize: '11.5px', color: T.piedra, paddingTop: '6px' }}>
            {codigoViaje(viaje.request_id)} · {municipioDe(viaje.origin)} → {municipioDe(viaje.destination)}{viaje.status === 'CANCELLED' ? ' · viaje cancelado' : ''}
          </div>
          <FilaPago pago={pago} onAccion={onAccion} procesando={procesando} />
        </div>
      ))}
    </div>
  );
};

export const CodigoAbordaje = ({ codigo, para, bloqueadoHasta }) => {
  if (!codigo) return null;
  const hora = bloqueadoHasta ? new Date(bloqueadoHasta).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div style={{ marginTop: '10px', borderRadius: '10px', padding: '12px 14px', background: T.monte, color: '#EAF2EC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Rotulo style={{ color: 'rgba(234,242,236,.6)' }}>{para === 'REGRESO' ? 'Código para el regreso' : 'Código de abordaje'}</Rotulo>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'rgba(234,242,236,.82)', lineHeight: 1.45 }}>
            Díselo al conductor cuando te subas, no antes: con él se da por iniciado el {para === 'REGRESO' ? 'regreso' : 'viaje'}.
          </p>
        </div>
        <span aria-label={`Código ${codigo.split('').join(' ')}`}
          style={{ fontFamily: T.dato, fontSize: '26px', fontWeight: 600, letterSpacing: '.28em', fontVariantNumeric: 'tabular-nums', paddingLeft: '.28em' }}>
          {codigo}
        </span>
      </div>
      {hora && (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#FCD34D' }}>
          El conductor escribió mal el código varias veces y quedó bloqueado hasta las {hora}.
        </p>
      )}
    </div>
  );
};

// anticipoEnApp: el anticipo se paga en Wompi, no al conductor (SCRUM-179);
// la cuenta es solo para los pagos que van directo a él.
export const CuentaParaPagar = ({ cuenta, hayPagosPorHacer, anticipoEnApp = false }) => {
  if (!cuenta) {
    if (!hayPagosPorHacer) return null;
    return (
      <p style={{ margin: '10px 0 0', fontSize: '12px', color: T.piedra, lineHeight: 1.5 }}>
        Págale al conductor en efectivo o por transferencia y registra cada pago aquí con “Ya pagué”: así queda constancia para los dos.
        {anticipoEnApp && ' El anticipo no: ese se paga en la app con “Pagar en línea”.'}
      </p>
    );
  }
  return (
    <div style={{ marginTop: '10px', border: `1px solid ${T.musgoLinea}`, background: T.musgo, borderRadius: '10px', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: T.musgoTexto }}>
        <IconEscudo size={14} />Paga solo a esta cuenta · verificada por Turify
      </div>
      <div style={{ marginTop: '5px', fontSize: '13px', color: T.tinta, display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700 }}>{cuenta.tipo_texto}</span>
        <Dato style={{ fontSize: '13px' }}>{cuenta.numero}</Dato>
        <span style={{ color: T.piedra }}>{cuenta.titular_nombre}</span>
      </div>
      {anticipoEnApp && (
        <p style={{ margin: '5px 0 0', fontSize: '11.5px', color: T.musgoTexto, lineHeight: 1.45 }}>
          Es para los pagos que van directo al conductor. El anticipo se paga en la app con “Pagar en línea”.
        </p>
      )}
    </div>
  );
};

export const ModalReclamo = ({ abierto, onCerrar, onEnviar, enviando }) => {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 5;
  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !enviando && onCerrar()}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000 }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 3001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', pointerEvents: 'none' }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="titulo-reclamo"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              style={{ pointerEvents: 'auto', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', background: T.papel, borderRadius: '16px', padding: '24px', width: '400px', maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: T.ui }}>
              <h3 id="titulo-reclamo" style={{ margin: '0 0 6px', color: T.tinta, fontSize: '17px', fontFamily: T.display, fontWeight: 800 }}>Abrir un reclamo</h3>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: T.piedra, lineHeight: 1.5 }}>
                Cuéntanos qué pasó. Un administrador de Turify lo revisa con la bitácora del viaje (códigos de abordaje, llegadas y pagos registrados) y les responde a los dos.
              </p>
              <textarea id="motivo-reclamo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={4} maxLength={1000}
                placeholder="Ej.: pagué el anticipo por Nequi el martes y el conductor dice que no le llegó."
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${T.linea}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: T.papel, color: T.tinta }} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={onCerrar} disabled={enviando} className="t-foco"
                  style={{ flex: 1, background: T.niebla2, color: T.piedra, border: 'none', padding: '11px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  Volver
                </button>
                <button type="button" disabled={!valido || enviando} className="t-foco"
                  onClick={async () => { const ok = await onEnviar(motivo.trim()); if (ok) setMotivo(''); }}
                  style={{ flex: 1, background: valido && !enviando ? T.ruta : T.piedraClara, color: valido && !enviando ? 'var(--t-sobre-ruta)' : '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: valido && !enviando ? 'pointer' : 'not-allowed' }}>
                  {enviando ? 'Enviando…' : 'Enviar reclamo'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  COBROS DEL CONDUCTOR — SCRUM-262 / SCRUM-263 (pestaña Ganancias)
// ─────────────────────────────────────────────────────────────────────────────

const ESTADOS_RECIBIDO = ['CONFIRMADO', 'LIBERADO'];

const Cifra = ({ etiqueta, valor, tono = T.tinta }) => (
  <div style={{ minWidth: 0 }}>
    <Rotulo style={{ fontSize: '9.5px' }}>{etiqueta}</Rotulo>
    <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: '17px', color: tono, marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>{cop(valor)}</div>
  </div>
);

export const ResumenCobros = ({ ganancias }) => {
  if (!ganancias || ganancias.recibido_mes === undefined) return null;
  const { recibido_mes, por_cobrar, en_reclamo, por_devolver, comision_mes, compensaciones_mes } = ganancias;
  const viajes = ganancias.viajes_pagos || [];
  return (
    <div style={{ background: T.papel, border: `1px solid ${T.linea}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <p style={{ margin: 0, fontFamily: T.display, fontWeight: 700, fontSize: '14px', color: T.tinta }}>Tus cobros</p>
        <span style={{ fontSize: '11.5px', color: T.piedra }}>Últimos 30 días</span>
      </div>

      <div style={{ margin: '10px 0 12px' }}>
        <Rotulo style={{ fontSize: '9.5px' }}>Recibido</Rotulo>
        <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: '26px', color: T.ruta, fontVariantNumeric: 'tabular-nums' }}>{cop(recibido_mes)}</div>
        <div style={{ fontSize: '11.5px', color: T.piedra, lineHeight: 1.45 }}>
          Ya descontada la comisión de Turify ({cop(comision_mes)}).
          {compensaciones_mes > 0 && ` Incluye ${cop(compensaciones_mes)} de cancelaciones tardías.`}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', paddingTop: '10px', borderTop: `1px solid ${T.niebla2}` }}>
        <Cifra etiqueta="Por cobrar" valor={por_cobrar} tono={por_cobrar > 0 ? T.chivaTexto : T.tinta} />
        <Cifra etiqueta="En reclamo" valor={en_reclamo} tono={en_reclamo > 0 ? T.alertaTexto : T.tinta} />
        <Cifra etiqueta="Por devolver" valor={por_devolver} tono={por_devolver > 0 ? T.alertaTexto : T.tinta} />
      </div>

      {viajes.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <Rotulo style={{ marginBottom: '4px' }}>Pagos por viaje</Rotulo>
          {viajes.map(v => {
            const recibido = v.pagos
              .filter(p => ESTADOS_RECIBIDO.includes(p.estado))
              .reduce((suma, p) => suma + p.monto - p.comision, 0);
            const enReclamo = v.pagos.some(p => p.estado === 'EN_RECLAMO');
            const porDevolver = v.pagos.some(p => p.estado === 'DEVOLUCION_PENDIENTE' || p.estado === 'DEVOLUCION_REPORTADA');
            return (
              <div key={`${v.request_id}-${v.departure_time}`} style={{ display: 'flex', gap: '10px', alignItems: 'baseline', padding: '8px 0', borderTop: `1px solid ${T.niebla2}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', color: T.tinta, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.origin} → {v.destination}</div>
                  <div style={{ fontSize: '11px', color: T.piedra }}>
                    {v.departure_time ? new Date(v.departure_time).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''}
                    {v.trip_status === 'CANCELLED' && ' · cancelado'}
                    {v.trip_status === 'CANCELADO_POR_TI' && ' · lo cancelaste'}
                    {enReclamo && ' · en reclamo'}
                    {porDevolver && ' · por devolver'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: '13px', color: T.tinta, fontVariantNumeric: 'tabular-nums' }}>{cop(recibido)}</div>
                  <div style={{ fontSize: '11px', color: T.piedra }}>de {cop(v.neto)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TIPOS_CUENTA = [
  { valor: 'NEQUI', texto: 'Nequi' },
  { valor: 'DAVIPLATA', texto: 'Daviplata' },
  { valor: 'BANCOLOMBIA_AHORROS', texto: 'Bancolombia · ahorros' },
  { valor: 'BANCOLOMBIA_CORRIENTE', texto: 'Bancolombia · corriente' },
  { valor: 'OTRO_BANCO', texto: 'Otro banco' },
];
const ESTADO_CUENTA = {
  PENDIENTE_VERIFICACION: { tono: 'chiva', texto: 'En revisión' },
  VERIFICADA: { tono: 'verde', texto: 'Verificada' },
  RECHAZADA: { tono: 'alerta', texto: 'Rechazada' },
};
const esBilletera = (tipo) => tipo === 'NEQUI' || tipo === 'DAVIPLATA';

const estiloCampo = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: '14px', fontFamily: T.ui,
  border: `1px solid ${T.linea}`, borderRadius: '8px', background: T.papel, color: T.tinta, outline: 'none',
};
const estiloEtiqueta = { display: 'block', fontSize: '12px', color: T.piedra, margin: '0 0 4px' };

export const CuentaCobros = ({ token, nombreConductor, onExito, onError }) => {
  const [cuenta, setCuenta] = useState(undefined); // undefined = cargando
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ tipo: 'NEQUI', banco: '', numero: '', titular_nombre: nombreConductor || '', titular_documento: '' });

  useEffect(() => {
    let vigente = true;
    cargarCuentaPagos(token)
      .then(d => { if (vigente) setCuenta(d.cuenta); })
      .catch(() => { if (vigente) setCuenta(null); });
    return () => { vigente = false; };
  }, [token]);

  const campo = (nombre) => (e) => setForm(f => ({ ...f, [nombre]: e.target.value }));

  const abrirEdicion = () => {
    if (cuenta) {
      setForm({ tipo: cuenta.tipo, banco: cuenta.banco || '', numero: cuenta.numero, titular_nombre: cuenta.titular_nombre, titular_documento: '' });
    }
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = await guardarCuentaPagos(token, {
        ...form,
        banco: form.tipo === 'OTRO_BANCO' ? form.banco : null,
      });
      setCuenta(datos.cuenta);
      setEditando(false);
      onExito('Cuenta guardada. Queda en revisión hasta que un administrador la verifique con tu cédula.');
    } catch (error) {
      onError(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const estado = cuenta ? ESTADO_CUENTA[cuenta.estado] : null;
  const mostrarFormulario = editando || cuenta === null;

  return (
    <div style={{ background: T.papel, border: `1px solid ${T.linea}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <p style={{ margin: 0, fontFamily: T.display, fontWeight: 700, fontSize: '14px', color: T.tinta }}>Cuenta para recibir pagos</p>
        {estado && !editando && <Chip tono={estado.tono}>{estado.texto}</Chip>}
      </div>

      {cuenta === undefined && <p style={{ margin: 0, fontSize: '13px', color: T.piedra }}>Cargando…</p>}

      {cuenta && !editando && (
        <>
          <div style={{ fontSize: '13.5px', color: T.tinta, display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline' }}>
            <span style={{ fontFamily: T.display, fontWeight: 700 }}>{cuenta.tipo_texto}</span>
            <Dato style={{ fontSize: '13px' }}>{cuenta.numero}</Dato>
            <span style={{ color: T.piedra }}>{cuenta.titular_nombre}</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: cuenta.estado === 'RECHAZADA' ? T.alertaTexto : T.piedra, lineHeight: 1.5 }}>
            {cuenta.estado === 'VERIFICADA' && 'Los pasajeros de tus viajes confirmados ven esta cuenta para pagarte.'}
            {cuenta.estado === 'PENDIENTE_VERIFICACION' && 'Un administrador la está comparando con tu cédula. Mientras tanto, los pasajeros no la ven.'}
            {cuenta.estado === 'RECHAZADA' && `No se pudo verificar: ${cuenta.nota_admin || 'revisa los datos'}.`}
          </p>
          <button type="button" onClick={abrirEdicion} className="t-foco"
            style={{ marginTop: '10px', background: 'none', border: `1px solid ${T.linea}`, borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px', fontFamily: T.display, fontWeight: 700, color: T.tinta, cursor: 'pointer' }}>
            Cambiar cuenta
          </button>
        </>
      )}

      {mostrarFormulario && (
        <form onSubmit={guardar}>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: T.piedra, lineHeight: 1.5 }}>
            Tiene que estar a tu nombre: por seguridad no se aceptan cuentas de terceros.
            {cuenta && ' Si la cambias, vuelve a quedar en revisión.'}
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div>
              <label htmlFor="cuenta-tipo" style={estiloEtiqueta}>Tipo de cuenta</label>
              <select id="cuenta-tipo" value={form.tipo} onChange={campo('tipo')} style={estiloCampo}>
                {TIPOS_CUENTA.map(t => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
              </select>
            </div>
            {form.tipo === 'OTRO_BANCO' && (
              <div>
                <label htmlFor="cuenta-banco" style={estiloEtiqueta}>Banco</label>
                <input id="cuenta-banco" value={form.banco} onChange={campo('banco')} maxLength={60} placeholder="Ej.: Banco de Bogotá" style={estiloCampo} />
              </div>
            )}
            <div>
              <label htmlFor="cuenta-numero" style={estiloEtiqueta}>{esBilletera(form.tipo) ? 'Número de celular' : 'Número de cuenta'}</label>
              <input id="cuenta-numero" value={form.numero} onChange={campo('numero')} inputMode="numeric" maxLength={24}
                placeholder={esBilletera(form.tipo) ? '300 123 4567' : 'Solo números'} style={estiloCampo} />
            </div>
            <div>
              <label htmlFor="cuenta-titular" style={estiloEtiqueta}>Nombre del titular</label>
              <input id="cuenta-titular" value={form.titular_nombre} onChange={campo('titular_nombre')} maxLength={100} style={estiloCampo} />
            </div>
            <div>
              <label htmlFor="cuenta-documento" style={estiloEtiqueta}>Cédula del titular</label>
              <input id="cuenta-documento" value={form.titular_documento} onChange={campo('titular_documento')} inputMode="numeric" maxLength={14} style={estiloCampo} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {cuenta && (
              <button type="button" onClick={() => setEditando(false)} disabled={guardando} className="t-foco"
                style={{ flex: 1, background: T.niebla2, color: T.piedra, border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13.5px', fontFamily: T.display, fontWeight: 700, cursor: 'pointer' }}>
                Volver
              </button>
            )}
            <button type="submit" disabled={guardando} className="t-foco"
              style={{ flex: 1, background: T.ruta, color: 'var(--t-sobre-ruta)', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13.5px', fontFamily: T.display, fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar cuenta'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
