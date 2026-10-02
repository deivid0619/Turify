// ─────────────────────────────────────────────────────────────────────────────
//  Cómo se nombra un viaje en pantalla: el mismo código en las tarjetas del
//  pasajero y del conductor, el panel del admin y el recibo en PDF
//  (TFY-000128, ver descargar_recibo en el backend), la ruta por municipio y
//  una sola fecha legible.
// ─────────────────────────────────────────────────────────────────────────────

export const codigoViaje = (id) => (id == null ? '' : `TFY-${String(id).padStart(6, '0')}`);

const DEPARTAMENTOS = new Set([
  'amazonas', 'antioquia', 'arauca', 'atlantico', 'bogota', 'bogota d.c.', 'bolivar', 'boyaca', 'caldas',
  'caqueta', 'casanare', 'cauca', 'cesar', 'choco', 'cordoba', 'cundinamarca', 'guainia', 'guaviare', 'huila',
  'la guajira', 'magdalena', 'meta', 'narino', 'norte de santander', 'putumayo', 'quindio', 'risaralda',
  'san andres y providencia', 'santander', 'sucre', 'tolima', 'valle del cauca', 'vaupes', 'vichada',
]);

const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// "Cra. 51 #11S-22, Guayabal, Medellín, Antioquia, Colombia" →
//   municipio "Medellín", detalle "Cra. 51 #11S-22, Guayabal"
const partir = (direccion) => {
  const partes = (direccion || '').split(',').map(p => p.trim()).filter(p => p && normalizar(p) !== 'colombia');
  let fin = partes.length;
  if (fin > 1 && DEPARTAMENTOS.has(normalizar(partes[fin - 1]))) fin -= 1;
  return { municipio: partes[fin - 1] || direccion || '', detalle: partes.slice(0, Math.max(0, fin - 1)).join(', ') };
};

export const municipioDe = (direccion) => partir(direccion).municipio;
export const detalleDireccion = (direccion) => partir(direccion).detalle;

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// "Vie 3 oct · 9:45 a. m." — la fecha del VIAJE, sin año si es el actual.
export const fechaViaje = (iso) => {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const dia = f.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
  const opciones = { day: 'numeric', month: 'short' };
  if (f.getFullYear() !== new Date().getFullYear()) opciones.year = 'numeric';
  const fecha = f.toLocaleDateString('es-CO', opciones).replace('.', '').replace(' de ', ' ');
  const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${capital(dia)} ${fecha} · ${hora}`;
};
