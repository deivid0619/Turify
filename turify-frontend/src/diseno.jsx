import { useState, useEffect } from 'react';
// ─────────────────────────────────────────────────────────────────────────────
//  SISTEMA DE DISEÑO TURIFY
//  Un solo lugar para color, tipografía, radios y los componentes compartidos.
//  Si un color no está aquí, no debería usarse en la app.
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  // Los valores viven en index.css (paletas clara y oscura). Acá solo se apunta
  // a la variable, así todo lo que use T cambia de tema sin tocar una línea más.
  monte:       'var(--t-monte)',
  monteAlto:   'var(--t-monte-alto)',
  monteLinea:  'var(--t-monte-linea)',
  ruta:        'var(--t-ruta)',
  rutaHover:   'var(--t-ruta-hover)',
  musgo:       'var(--t-musgo)',
  musgoLinea:  'var(--t-musgo-linea)',
  musgoTexto:  'var(--t-musgo-texto)',
  niebla:      'var(--t-niebla)',
  niebla2:     'var(--t-niebla-2)',
  papel:       'var(--t-papel)',
  chiva:       'var(--t-chiva)',
  chivaSuave:  'var(--t-chiva-suave)',
  chivaLinea:  'var(--t-chiva-linea)',
  chivaTexto:  'var(--t-chiva-texto)',
  tinta:       'var(--t-tinta)',
  piedra:      'var(--t-piedra)',
  piedraClara: 'var(--t-piedra-clara)',
  linea:       'var(--t-linea)',
  cielo:       'var(--t-cielo)',
  cieloSuave:  'var(--t-cielo-suave)',
  cieloLinea:  'var(--t-cielo-linea)',
  cieloTexto:  'var(--t-cielo-texto)',
  alerta:      'var(--t-alerta)',
  alertaSuave: 'var(--t-alerta-suave)',
  alertaLinea: 'var(--t-alerta-linea)',
  alertaTexto: 'var(--t-alerta-texto)',

  // ── Tipografía ──
  display: "'Syne', system-ui, sans-serif",
  ui:      "'DM Sans', system-ui, sans-serif",
  dato:    "'IBM Plex Mono', ui-monospace, monospace",

  // ── Radios ──
  rDato: '4px', rControl: '10px', rTarjeta: '14px', rChip: '999px',
};

// Colores fijos — SOLO para donde no llega el CSS: marcadores de Google Maps,
// el favicon y cualquier export a imagen. El logo NO los usa: sigue el tema,
// porque un verde de marca distinto al de los botones se lee como un error.
export const FIJO = { ruta: '#16A34A', chiva: '#E9A13B', monte: '#0E2A1E', tinta: '#131A16' };


// ─────────────────────────────────────────────────────────────────────────────
//  MAPA EN MODO OSCURO — no es el "dark" genérico de Google: el suelo y el agua
//  se llevan al verde monte de la marca, y las vías quedan apenas más claras que
//  el fondo para que la ruta verde siga siendo lo que más resalta.
//  Los valores van fijos a propósito: Google Maps recibe JSON, no lee variables CSS.
// ─────────────────────────────────────────────────────────────────────────────
export const MAPA_OSCURO = [
  { elementType: 'geometry', stylers: [{ color: '#0B1F16' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1F16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7E9187' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#22402F' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#A8BBAF' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#102A1E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1B3527' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8DA396' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#274534' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#12291F' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07160F' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3F5A4B' }] },
];

export const FUENTES_URL =
  "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// ─────────────────────────────────────────────────────────────────────────────
//  Estilos globales — se monta una vez por pantalla.
// ─────────────────────────────────────────────────────────────────────────────
export const EstilosBase = () => (
  <style>{`
    @import url('${FUENTES_URL}');

    @keyframes t-girar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes t-latido { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.45; transform:scale(.72); } }
    @keyframes t-entra { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes t-flap {
      0%   { transform: rotateX(0);    filter: brightness(1); }
      50%  { transform: rotateX(-88deg); filter: brightness(.35); }
      100% { transform: rotateX(0);    filter: brightness(1); }
    }

    .t-foco:focus-visible { outline: 2px solid ${T.ruta}; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .t-anim { animation: none !important; }
    }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
//  TEMA — claro / oscuro. Se guarda la preferencia y se marca <html data-tema>.
//  Los tokens de arriba apuntan a variables CSS, así que con eso basta.
// ─────────────────────────────────────────────────────────────────────────────
export const leerTema = () => {
  try {
    const guardado = localStorage.getItem('turify-tema');
    if (guardado === 'oscuro' || guardado === 'claro') return guardado;
  } catch { /* almacenamiento bloqueado: seguimos con el del sistema */ }
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'oscuro' : 'claro';
};

export const aplicarTema = (tema) => {
  document.documentElement.setAttribute('data-tema', tema);
  try { localStorage.setItem('turify-tema', tema); } catch { /* sin persistencia */ }
};

export const useTema = () => {
  const [tema, setTema] = useState(() => (typeof window === 'undefined' ? 'claro' : leerTema()));
  useEffect(() => { aplicarTema(tema); }, [tema]);
  return [tema, () => setTema(t => (t === 'oscuro' ? 'claro' : 'oscuro'))];
};

const IconSol = (p) => <Icono {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" /></Icono>;
const IconLuna = (p) => <Icono {...p}><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" /></Icono>;

// Interruptor de tema — cabe en una barra lateral sin robar atención.
export const BotonTema = ({ tema, alternar, compacto = false }) => (
  <button type="button" onClick={alternar} className="t-foco"
    title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: compacto ? 0 : '8px',
      background: T.papel, border: `1px solid ${T.linea}`, borderRadius: T.rControl,
      padding: compacto ? '8px' : '9px 12px', cursor: 'pointer', color: T.piedra,
      fontFamily: T.ui, fontSize: '12px', fontWeight: 600,
      transition: 'border-color .18s, color .18s',
    }}>
    {tema === 'oscuro' ? <IconSol size={15} /> : <IconLuna size={15} />}
    {!compacto && (tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro')}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Iconos de trazo — un solo grosor, sin relleno, sin emojis.
// ─────────────────────────────────────────────────────────────────────────────
export const Icono = ({ children, size = 16, color = 'currentColor', grosor = 1.7, style, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" style={style} {...rest}>
    {children}
  </svg>
);

export const IconReloj      = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></Icono>;
export const IconVisto      = (p) => <Icono {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Icono>;
export const IconBandera    = (p) => <Icono {...p}><path d="M6 21V4" /><path d="M6 4h12l-3 4 3 4H6" /></Icono>;
export const IconAuto       = (p) => <Icono {...p}><path d="M4 16v-3.2a1.4 1.4 0 0 1 .12-.57L5.9 8.4A2 2 0 0 1 7.75 7h8.5a2 2 0 0 1 1.85 1.4l1.78 3.83c.11.24.12.4.12.57V16" /><path d="M4 16h16v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2Z" /><circle cx="7.5" cy="16" r="1.4" /><circle cx="16.5" cy="16" r="1.4" /></Icono>;
export const IconCalendario = (p) => <Icono {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></Icono>;
export const IconPersonas   = (p) => <Icono {...p}><circle cx="9" cy="8.5" r="2.6" /><path d="M4 19c0-3 2.2-5 5-5s5 2 5 5" /><path d="M15.5 6.5a2.4 2.4 0 1 1 0 4.8" /><path d="M17 14.3c1.9.5 3 2.1 3 4.7" /></Icono>;
export const IconPersona    = (p) => <Icono {...p}><circle cx="12" cy="8.2" r="3.2" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></Icono>;
export const IconRadar      = (p) => <Icono {...p}><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><path d="M12 12l6-3.2" /><path d="M6 12a6 6 0 0 1 6-6" opacity="0.55" /><path d="M4 12a8 8 0 0 1 8-8" opacity="0.3" /></Icono>;
export const IconPin        = (p) => <Icono {...p}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" /></Icono>;
export const IconRecibo     = (p) => <Icono {...p}><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z" /><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" /></Icono>;
export const IconEstrella   = (p) => <Icono {...p}><path d="M12 3.7l2.4 5 5.4.6-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.6Z" /></Icono>;
export const IconClipboard  = (p) => <Icono {...p}><rect x="5" y="4.5" width="14" height="16" rx="2.3" /><rect x="8.7" y="3" width="6.6" height="3" rx="1.3" /><path d="M8.5 11.5h7M8.5 15h5" /></Icono>;
export const IconEquis      = (p) => <Icono {...p}><path d="M6 6l12 12M18 6L6 18" /></Icono>;
export const IconFlecha     = (p) => <Icono {...p}><path d="M13 6l6 6-6 6M19 12H5" /></Icono>;
export const IconAlerta     = (p) => <Icono {...p}><path d="M12 4l9 15.5H3Z" /><path d="M12 10v4M12 17h.01" /></Icono>;
export const IconGorro      = (p) => <Icono {...p}><path d="M12 5 3 9.2 12 13l9-3.8L12 5Z" /><path d="M7 11.3V15c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-3.7" /></Icono>;
export const IconOjo        = (p) => <Icono {...p}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Icono>;
export const IconOjoTachado = (p) => <Icono {...p}><path d="M4 4l16 16" /><path d="M9.6 9.7a2.8 2.8 0 0 0 3.9 3.9" /><path d="M6.6 6.8C4.2 8.4 2.5 12 2.5 12s3.5 6.2 9.5 6.2c1.5 0 2.8-.4 4-.9" /><path d="M17.6 15.1c2-1.5 3.4-3.8 3.4-3.8S17.5 5.8 12 5.8c-.6 0-1.2.1-1.8.2" /></Icono>;
export const IconCampana     = (p) => <Icono {...p}><path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></Icono>;
export const IconPrecio      = (p) => <Icono {...p}><circle cx="12" cy="12" r="8.6" /><path d="M14.4 9.4c-.5-.8-1.4-1.2-2.4-1.2-1.4 0-2.4.8-2.4 1.9 0 2.6 5 1.4 5 4 0 1.2-1.1 2-2.6 2-1.1 0-2-.4-2.5-1.2" /><path d="M12 6.6v10.8" /></Icono>;
export const IconIntercambio = (p) => <Icono {...p}><path d="M4 8.5h13l-3-3M20 15.5H7l3 3" /></Icono>;
export const IconIdea        = (p) => <Icono {...p}><path d="M9.5 17.5h5M10.5 20.5h3" /><path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6H9.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" /></Icono>;
// ── Comodidades del vehículo ──
export const IconAire    = (p) => <Icono {...p}><path d="M12 3v18M12 8.5 8.2 6.3M12 8.5l3.8-2.2M12 15.5l-3.8 2.2M12 15.5l3.8 2.2" /><path d="M4.2 7.6l15.6 8.8M4.2 16.4l15.6-8.8" /></Icono>;
export const IconWifi    = (p) => <Icono {...p}><path d="M8.5 15.5a5 5 0 0 1 7 0" /><path d="M5.6 12.3a9 9 0 0 1 12.8 0" /><path d="M2.8 9.2a13 13 0 0 1 18.4 0" /><path d="M12 19h.01" /></Icono>;
export const IconBano    = (p) => <Icono {...p}><path d="M4 11.5h16v1.8a5.5 5.5 0 0 1-5.5 5.5h-5A5.5 5.5 0 0 1 4 13.3Z" /><path d="M7 11.5V6.4A2.4 2.4 0 0 1 9.4 4c1.1 0 2 .7 2.3 1.7" /><path d="M8 18.8 7 21M16 18.8 17 21" /></Icono>;
export const IconMusica  = (p) => <Icono {...p}><circle cx="7" cy="17.5" r="2.6" /><circle cx="18" cy="15.5" r="2.6" /><path d="M9.6 17.5V6.4l11-2v11.1" /><path d="M9.6 9.6l11-2" /></Icono>;
export const IconMaleta  = (p) => <Icono {...p}><rect x="3.5" y="7.5" width="17" height="12.5" rx="2.4" /><path d="M8.5 7.5V5.6A1.6 1.6 0 0 1 10.1 4h3.8a1.6 1.6 0 0 1 1.6 1.6v1.9" /><path d="M9 11v5.5M15 11v5.5" /></Icono>;
export const IconBebe    = (p) => <Icono {...p}><path d="M9.5 3.5h5l-.6 3.2h-3.8Z" /><path d="M10.4 6.7 8.6 13.4a3.6 3.6 0 0 0 3.4 4.6h0a3.6 3.6 0 0 0 3.4-4.6l-1.8-6.7" /><path d="M8.4 20.5h7.2" /></Icono>;
export const IconMascota = (p) => <Icono {...p}><ellipse cx="8" cy="9" rx="1.8" ry="2.4" /><ellipse cx="16" cy="9" rx="1.8" ry="2.4" /><ellipse cx="4.6" cy="13.6" rx="1.6" ry="2.1" /><ellipse cx="19.4" cy="13.6" rx="1.6" ry="2.1" /><path d="M12 13.2c2.6 0 4.6 2.1 4.6 4.2 0 1.6-1.3 2.4-2.8 2.4-1 0-1.3-.4-1.8-.4s-.8.4-1.8.4c-1.5 0-2.8-.8-2.8-2.4 0-2.1 2-4.2 4.6-4.2Z" /></Icono>;
export const IconEmpresa = (p) => <Icono {...p}><path d="M4 20.5V6.5l7-3v17M11 20.5h9V10l-9-3.2" /><path d="M14.5 12.5h2M14.5 16h2M7 10h1M7 13.5h1" /></Icono>;

export const IconSenal      = (p) => <Icono {...p}><path d="M4 17.5v-2M8.6 17.5v-5M13.2 17.5v-8M17.8 17.5v-11" /></Icono>;

// ── Documentos oficiales — se repiten entre el registro del conductor y la
//    verificación del admin, así que viven acá y no sueltos en cada pantalla.
export const IconEscudo   = (p) => <Icono {...p}><path d="M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6l-7-2.8Z" /><path d="M9 12l2.2 2.2L15.4 10" /></Icono>;
export const IconTarjeta  = (p) => <Icono {...p}><rect x="3" y="6" width="18" height="12" rx="2.4" /><path d="M3 10h18M6.5 14h4" /></Icono>;
export const IconLlave    = (p) => <Icono {...p}><circle cx="8.5" cy="12" r="3.6" /><path d="M12.1 12H20M17 12v3M20 12v2.4" /></Icono>;
export const IconDocumento = (p) => <Icono {...p}><path d="M13.5 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5Z" /><path d="M13.5 3.5v5h5" /><path d="M8.8 13h6.4M8.8 16.4h4.2" /></Icono>;
export const IconDescargar = (p) => <Icono {...p}><path d="M12 4v11M8 11.2l4 4 4-4" /><path d="M4.5 17v2.2a1.3 1.3 0 0 0 1.3 1.3h12.4a1.3 1.3 0 0 0 1.3-1.3V17" /></Icono>;

// ── Navegación y acciones de la barra del admin ──
export const IconFlechaIzq = (p) => <Icono {...p}><path d="M11 6l-6 6 6 6M5 12h14" /></Icono>;
export const IconSalir     = (p) => <Icono {...p}><path d="M15 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H15" /><path d="M14.5 12H21M18 8.8l3.2 3.2-3.2 3.2" /></Icono>;
export const IconRecargar  = (p) => <Icono {...p}><path d="M20.4 11.2A8.4 8.4 0 0 0 6.2 6.6L3.6 9.2" /><path d="M3.6 5v4.2h4.2" /><path d="M3.6 12.8a8.4 8.4 0 0 0 14.2 4.6l2.6-2.6" /><path d="M20.4 19v-4.2h-4.2" /></Icono>;
export const IconLupa      = (p) => <Icono {...p}><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 20.5 20.5" /></Icono>;

// ── Bitácora de auditoría ──
export const IconCandado   = (p) => <Icono {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" /><path d="M12 14.4v2.4" /></Icono>;
export const IconProhibido = (p) => <Icono {...p}><circle cx="12" cy="12" r="8.6" /><path d="M6 18 18 6" /></Icono>;
export const IconMapa      = (p) => <Icono {...p}><path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8Z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></Icono>;
export const IconChincheta = (p) => <Icono {...p}><path d="M9 3.5h6M10.2 3.5v6.2L7.5 13h9l-2.7-3.3V3.5" /><path d="M12 13v7.5" /></Icono>;
export const IconBandeja   = (p) => <Icono {...p}><path d="M3.5 13.5 6 5.8a2 2 0 0 1 1.9-1.3h8.2A2 2 0 0 1 18 5.8l2.5 7.7" /><path d="M3.5 13.5h4.2l1.2 2.6h6.2l1.2-2.6h4.2v4.2a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" /></Icono>;


// ─────────────────────────────────────────────────────────────────────────────
//  CENTRAR EL MAPA — flota sobre el mapa, arriba de los controles de zoom, que
//  es donde el ojo ya lo busca. Cada pantalla decide qué significa "centrar":
//  el pasajero encuadra su ruta, el conductor vuelve a su posición.
// ─────────────────────────────────────────────────────────────────────────────
export const IconCentrar = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="3.4" />
    <circle cx="12" cy="12" r="7.6" />
    <path d="M12 1.6v2.8M12 19.6v2.8M22.4 12h-2.8M4.4 12H1.6" />
  </Icono>
);

export const BotonCentrarMapa = ({ onClick, titulo = 'Centrar el mapa', deshabilitado = false, style }) => (
  <button type="button" onClick={onClick} disabled={deshabilitado} className="t-foco"
    title={titulo} aria-label={titulo}
    style={{
      position: 'absolute', right: '10px', bottom: '96px', zIndex: 20,
      width: '40px', height: '40px', borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.papel, border: `1px solid ${T.linea}`,
      boxShadow: '0 2px 6px rgba(0,0,0,.18)',
      color: deshabilitado ? T.piedraClara : T.tinta,
      cursor: deshabilitado ? 'not-allowed' : 'pointer',
      opacity: deshabilitado ? 0.55 : 1,
      transition: 'color .18s, border-color .18s',
      ...style,
    }}>
    <IconCentrar size={19} />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
//  TABLERO DE RUTA — elemento firma.
//  El cartón del parabrisas: origen y destino en mayúsculas, una línea que los une.
// ─────────────────────────────────────────────────────────────────────────────
export const TableroRuta = ({ origen, destino, oscuro = false, size = 12.5, style }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0,
    fontFamily: T.dato, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.09em', fontSize: `${size}px`,
    color: oscuro ? '#EAF2EC' : T.tinta, ...style,
  }}>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{origen}</span>
    <span style={{
      flex: 1, minWidth: '14px', height: '1px', position: 'relative',
      background: oscuro ? T.monteLinea : T.linea,
    }}>
      <span style={{ position: 'absolute', left: 0, top: '50%', width: '4px', height: '4px', borderRadius: '50%', background: T.ruta, transform: 'translateY(-50%)' }} />
      <span style={{ position: 'absolute', right: 0, top: '50%', width: '4px', height: '4px', borderRadius: '50%', background: T.chiva, transform: 'translateY(-50%)' }} />
    </span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: oscuro ? T.chiva : T.chivaTexto }}>{destino}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Primitivas de formulario
// ─────────────────────────────────────────────────────────────────────────────
export const Boton = ({ variante = 'primario', ancho, children, style, ...rest }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    borderRadius: T.rControl, padding: '12px 18px', fontFamily: T.ui,
    fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
    transition: 'background .18s, border-color .18s, color .18s',
    width: ancho ? '100%' : undefined, border: '1px solid transparent',
  };
  const variantes = {
    primario:  { background: T.ruta, color: '#fff' },
    fantasma:  { background: 'transparent', color: T.tinta, borderColor: T.linea },
    monte:     { background: T.monte, color: '#fff' },
    peligro:   { background: T.alertaSuave, color: T.alertaTexto, borderColor: T.alertaLinea },
    inactivo:  { background: 'var(--t-niebla-2)', color: T.piedraClara, cursor: 'not-allowed' },
  };
  return (
    <button className="t-foco" style={{ ...base, ...variantes[variante], ...style }} {...rest}>
      {children}
    </button>
  );
};

export const Chip = ({ tono = 'neutro', children, style }) => {
  const tonos = {
    neutro: { background: T.niebla, borderColor: T.linea,       color: T.piedra },
    verde:  { background: T.musgo,  borderColor: T.musgoLinea,  color: T.musgoTexto,  fontWeight: 700 },
    chiva:  { background: T.chivaSuave, borderColor: T.chivaLinea, color: T.chivaTexto, fontWeight: 700 },
    cielo:  { background: T.cieloSuave, borderColor: T.cieloLinea, color: T.cieloTexto, fontWeight: 700 },
    alerta: { background: T.alertaSuave, borderColor: T.alertaLinea, color: T.alertaTexto, fontWeight: 700 },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      borderRadius: T.rChip, padding: '3px 9px', fontSize: '10.5px',
      fontWeight: 500, border: '1px solid', ...tonos[tono], ...style,
    }}>{children}</span>
  );
};

// Dato oficial: placa, FUEC, identificador, hora.
export const Dato = ({ children, style }) => (
  <span style={{ fontFamily: T.dato, fontWeight: 600, letterSpacing: '.08em', fontSize: '11.5px', ...style }}>
    {children}
  </span>
);

// Rótulo de sección — mayúsculas espaciadas, en monoespaciada.
export const Rotulo = ({ children, style }) => (
  <div style={{
    fontFamily: T.dato, fontSize: '10.5px', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '.16em', color: T.piedraClara, ...style,
  }}>{children}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  CUÁNDO VA CADA MARCA — se usa UNA, nunca las dos juntas.
//
//  LogoWordmark (con nombre) — donde hay ancho y la marca tiene que presentarse:
//    · pantalla de entrada y registro
//    · cabecera de la barra lateral del pasajero
//    · cabecera del panel del conductor y del admin
//    · documentos generados (recibo, FUEC)
//
//  MarcaTurify (compacta, los dos puntos) — donde el nombre no cabe o sobra:
//    · favicon y icono de la app
//    · barra lateral colapsada y vistas móviles angostas
//    · avatar, marcador del mapa, estados de carga
//    · cualquier caja de menos de ~120 px de ancho
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  PROPUESTAS DE LOGO — todas nacen del mismo gesto: dos puntos unidos por un
//  camino. El nombre va en Syne con tracking abierto, como en la pantalla de
//  entrada. Cada una trae su versión compacta para favicon y avatar.
// ─────────────────────────────────────────────────────────────────────────────

// A · WORDMARK CON RUTA — el nombre con la ruta corriendo por debajo, del ancho
//     exacto de la palabra. Es el logo más callado y el más fiel al sistema.
export const LogoWordmark = ({ alto = 22, oscuro = false }) => (
  <span style={{ display: 'inline-flex', flexDirection: 'column', gap: `${alto * 0.32}px` }}>
    <span style={{
      fontFamily: T.display, fontWeight: 800, fontSize: `${alto}px`,
      letterSpacing: '.24em', textIndent: '.24em', lineHeight: 1,
      color: oscuro ? '#EAF2EC' : T.tinta,
    }}>TURIFY</span>
    <span style={{ position: 'relative', display: 'block', height: `${Math.max(alto * 0.2, 5)}px` }}>
      <span style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: '1.5px', background: oscuro ? T.monteLinea : T.linea, transform: 'translateY(-50%)',
      }} />
      <span style={{
        position: 'absolute', left: 0, top: '50%', width: `${alto * 0.19}px`, height: `${alto * 0.19}px`,
        borderRadius: '50%', background: T.ruta, transform: 'translateY(-50%)',
      }} />
      <span style={{
        position: 'absolute', right: 0, top: '50%', width: `${alto * 0.19}px`, height: `${alto * 0.19}px`,
        borderRadius: '50%', background: T.chiva, transform: 'translateY(-50%)',
      }} />
    </span>
  </span>
);

// A · MARCA COMPACTA — los dos puntos son la marca. Sin nombre, quedan ellos y
//     el tramo que los une, en diagonal para que llenen el cuadro y se separen
//     bien a tamaño chico.
export const MarcaTurify = ({ alto = 32, oscuro = false, plano = false }) => (
  <svg width={alto} height={alto} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {!plano && (
      <rect width="40" height="40" rx="11"
        fill={oscuro ? '#0A1F16' : T.tinta}
        stroke={oscuro ? 'rgba(255,255,255,.12)' : 'none'} />
    )}
    <path d="M12.5 27.5 27.5 12.5"
      stroke={plano ? (oscuro ? '#EAF2EC' : T.tinta) : '#EAF2EC'}
      strokeWidth="2" strokeLinecap="round" opacity={plano ? '.45' : '.55'} />
    <circle cx="12.5" cy="27.5" r="5" fill={T.ruta} />
    <circle cx="27.5" cy="12.5" r="5" fill={T.chiva} />
  </svg>
);

// B · MONOGRAMA T — la T cuyo travesaño es la ruta: un punto en cada extremo.
//     La más fuerte como icono suelto; el nombre va al lado.
export const LogoMonograma = ({ alto = 40, oscuro = false, conTexto = true }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: `${alto * 0.32}px` }}>
    <svg width={alto} height={alto} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M9 13h22" stroke={oscuro ? '#EAF2EC' : T.tinta} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 13v18" stroke={oscuro ? '#EAF2EC' : T.tinta} strokeWidth="3" strokeLinecap="round" />
      <circle cx="9" cy="13" r="4" fill={T.ruta} />
      <circle cx="31" cy="13" r="4" fill={T.chiva} />
    </svg>
    {conTexto && (
      <span style={{
        fontFamily: T.display, fontWeight: 800, fontSize: `${alto * 0.44}px`,
        letterSpacing: '.2em', textIndent: '.2em', lineHeight: 1,
        color: oscuro ? '#EAF2EC' : T.tinta,
      }}>TURIFY</span>
    )}
  </span>
);

// C · BIFURCACIÓN — la Y de Turify leída como lo que es en una carretera: una
//     bifurcación. Cada ramal termina en un destino posible. Es el logo que
//     habla de elegir, que es justo lo que hace el pasajero con las ofertas.
export const LogoBifurcacion = ({ alto = 40, oscuro = false, conTexto = true }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: `${alto * 0.32}px` }}>
    <svg width={alto} height={alto} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 33V22" stroke={oscuro ? '#EAF2EC' : T.tinta} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 22c0-5-4-6-8-8.5" stroke={oscuro ? '#EAF2EC' : T.tinta} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M20 22c0-5 4-6 8-8.5" stroke={oscuro ? '#EAF2EC' : T.tinta} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="11.4" cy="12.6" r="4" fill={T.ruta} />
      <circle cx="28.6" cy="12.6" r="4" fill={T.chiva} />
    </svg>
    {conTexto && (
      <span style={{
        fontFamily: T.display, fontWeight: 800, fontSize: `${alto * 0.44}px`,
        letterSpacing: '.2em', textIndent: '.2em', lineHeight: 1,
        color: oscuro ? '#EAF2EC' : T.tinta,
      }}>TURIFY</span>
    )}
  </span>
);
