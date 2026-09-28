import API_BASE_URL from './api';

// ─────────────────────────────────────────────────────────────────────────────
//  Pagos del viaje — llamadas al backend y utilidades (ÉPICA 6, SCRUM-178).
//  Los componentes que los muestran están en PagosViaje.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export const cop = (valor) => '$' + Math.round(Number(valor) || 0).toLocaleString('es-CO');

const RUTA_ACCION = {
  REPORTAR_PAGO: 'reportar-pago',
  CONFIRMAR_RECIBIDO: 'confirmar-recibido',
  NO_RECIBIDO: 'no-recibido',
  REPORTAR_DEVOLUCION: 'reportar-devolucion',
  CONFIRMAR_DEVOLUCION: 'confirmar-devolucion',
  DEVOLUCION_NO_RECIBIDA: 'devolucion-no-recibida',
};

const cabeceras = (token, json = false) => ({
  'Authorization': `Bearer ${token}`,
  'ngrok-skip-browser-warning': 'true',
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

// Los errores de validación (422) llegan como lista; se juntan en una frase.
const leer = async (res, mensajeError) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = Array.isArray(data.detail)
      ? data.detail.map(d => String(d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join(' ')
      : data.detail;
    throw new Error(detalle || mensajeError);
  }
  return data;
};

export async function ejecutarAccionPago(token, pagoId, accion) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/${pagoId}/${RUTA_ACCION[accion]}`, {
    method: 'POST', headers: cabeceras(token),
  });
  return leer(res, 'No se pudo registrar el pago.');
}

export async function abrirReclamo(token, requestId, motivo, pagoId = null) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/viajes/${requestId}/reclamos`, {
    method: 'POST', headers: cabeceras(token, true), body: JSON.stringify({ motivo, pago_id: pagoId }),
  });
  return leer(res, 'No se pudo abrir el reclamo.');
}

export async function cargarPagosPendientes(token) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/pendientes`, { headers: cabeceras(token) });
  return leer(res, 'No se pudieron cargar los pagos pendientes.');
}

// SCRUM-263 — cuenta a nombre del conductor donde recibe los pagos.
export async function cargarCuentaPagos(token) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/cuenta`, { headers: cabeceras(token) });
  return leer(res, 'No se pudo cargar tu cuenta de pagos.');
}

export async function guardarCuentaPagos(token, datos) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/cuenta`, {
    method: 'PUT', headers: cabeceras(token, true), body: JSON.stringify(datos),
  });
  return leer(res, 'No se pudo guardar la cuenta.');
}

// Mensaje del toast después de cada acción, en palabras del usuario.
export const MENSAJE_ACCION = {
  REPORTAR_PAGO: 'Listo: le avisamos al conductor para que confirme.',
  CONFIRMAR_RECIBIDO: 'Pago confirmado.',
  NO_RECIBIDO: 'Reclamo abierto. Un administrador lo revisará.',
  REPORTAR_DEVOLUCION: 'Listo: le avisamos al pasajero para que confirme.',
  CONFIRMAR_DEVOLUCION: 'Devolución confirmada.',
  DEVOLUCION_NO_RECIBIDA: 'Reclamo abierto. Un administrador lo revisará.',
};

export const hayPagoPorHacer = (plan) =>
  !!plan?.pagos?.some(p => p.exigible && p.estado === 'PENDIENTE');

export const anticipoDe = (plan) => plan?.pagos?.find(p => p.hito === 'ANTICIPO') || null;

// El anticipo cuenta como pagado aunque el conductor no lo haya confirmado
// todavía: es la misma regla que aplica el backend al cancelar (SCRUM-181).
export const anticipoPagado = (plan) => {
  const anticipo = anticipoDe(plan);
  return !!anticipo && ['PAGO_REPORTADO', 'CONFIRMADO', 'RETENIDO', 'LIBERADO'].includes(anticipo.estado);
};
