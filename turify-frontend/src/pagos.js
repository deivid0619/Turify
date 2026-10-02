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
  if (accion === 'PAGAR_EN_LINEA') return abrirPagoEnLinea(token, pagoId);
  const res = await fetch(`${API_BASE_URL}/api/pagos/${pagoId}/${RUTA_ACCION[accion]}`, {
    method: 'POST', headers: cabeceras(token),
  });
  return leer(res, 'No se pudo registrar el pago.');
}

// SCRUM-179 — el anticipo se paga en Wompi. El backend arma el link con el
// monto y la referencia firmados y el navegador se va al checkout; la promesa
// no se resuelve porque la página se va (el botón queda en "Abriendo Wompi…").
export async function abrirPagoEnLinea(token, pagoId) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/${pagoId}/pagar-en-linea`, {
    method: 'POST', headers: cabeceras(token),
  });
  const data = await leer(res, 'No se pudo abrir el pago en línea.');
  window.location.assign(data.url);
  return new Promise(() => {});
}

// SCRUM-180 — de vuelta de Wompi: el backend consulta la transacción en Wompi
// (no le cree al navegador) y la aplica al anticipo.
export async function confirmarPagoWompi(token, transaccionId) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/wompi/confirmar`, {
    method: 'POST', headers: cabeceras(token, true), body: JSON.stringify({ transaccion_id: transaccionId }),
  });
  return leer(res, 'No pudimos revisar tu pago.');
}

// Wompi devuelve al pasajero a /dashboard?pago=wompi&id=<transacción>. Por si
// agrega "?id=" en vez de "&id=" a una URL que ya traía "?", se leen las dos.
export const transaccionDeRegreso = (search) => {
  const params = new URLSearchParams(search);
  const pago = params.get('pago') || '';
  if (!pago.startsWith('wompi')) return null;
  const id = params.get('id') || new URLSearchParams(pago.slice('wompi'.length).replace(/^\?/, '')).get('id');
  return id && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
};

export const MENSAJE_WOMPI = {
  APPROVED: 'Pago aprobado. Turify guarda tu anticipo y se lo entrega al conductor cuando lleguen al destino.',
  DECLINED: 'El pago no se aprobó. Puedes intentarlo otra vez con otro medio de pago.',
  ERROR: 'El pago no se pudo completar. Puedes intentarlo otra vez.',
  VOIDED: 'El pago se anuló.',
  PENDING: 'Tu pago está en proceso. Te avisamos apenas Wompi lo confirme.',
};

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

// ── Administración (SCRUM-263 cuentas, SCRUM-264 reclamos) ────────────────

export async function cargarCuentasAdmin(token, estado = 'PENDIENTE_VERIFICACION') {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/cuentas?estado=${estado}`, { headers: cabeceras(token) });
  return leer(res, 'No se pudieron cargar las cuentas.');
}

export async function verificarCuentaAdmin(token, cuentaId, aprobar, nota) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/cuentas/${cuentaId}/verificar`, {
    method: 'POST', headers: cabeceras(token, true), body: JSON.stringify({ aprobar, nota: nota || null }),
  });
  return leer(res, 'No se pudo guardar la verificación.');
}

export async function cargarReclamosAdmin(token, estado = 'ABIERTO') {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/reclamos?estado=${estado}`, { headers: cabeceras(token) });
  return leer(res, 'No se pudieron cargar los reclamos.');
}

export async function resolverReclamoAdmin(token, reclamoId, datos) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/reclamos/${reclamoId}/resolver`, {
    method: 'POST', headers: cabeceras(token, true), body: JSON.stringify(datos),
  });
  return leer(res, 'No se pudo resolver el reclamo.');
}

// SCRUM-180 — anticipos que Turify retiene: entregarlos al conductor o
// devolvérselos al pasajero (accion: 'liberar' | 'reembolsar').
export async function cargarAnticiposAdmin(token) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/anticipos`, { headers: cabeceras(token) });
  return leer(res, 'No se pudieron cargar los anticipos.');
}

export async function moverAnticipoAdmin(token, pagoId, accion, nota) {
  const res = await fetch(`${API_BASE_URL}/api/pagos/admin/anticipos/${pagoId}/${accion}`, {
    method: 'POST', headers: cabeceras(token, true), body: JSON.stringify({ nota: nota || null }),
  });
  return leer(res, 'No se pudo registrar el movimiento.');
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
