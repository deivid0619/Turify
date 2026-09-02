import { useState, useEffect, useRef } from 'react';
const IconIdea = (p) => <Icono {...p}><path d="M9.5 17.5h5M10.5 20.5h3" /><path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6H9.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" /></Icono>;
import { T, Icono, IconPin, IconVisto, IconRadar } from './diseno';
const IconGirar = (p) => <Icono {...p}><path d="M4 4v5h5" /><path d="M5.5 15A7.5 7.5 0 0 0 19 9.5" /><path d="M18.5 9A7.5 7.5 0 0 0 5 14.5" /></Icono>;

const BRAND_GREEN = 'var(--t-ruta)';

// Sesgo geográfico hacia Antioquia (mismo bounding box usado en Dashboard.jsx para geocodificar),
// para que nombres locales cortos como "C4TA" o barrios sin ciudad se prioricen en esta zona.
const BOUNDS_ANTIOQUIA = { south: 5.4, west: -77.2, north: 8.9, east: -73.9 };

// Autocompletado de direcciones — usa Google Places (Autocomplete Service). Reutiliza la misma
// key/librería 'places' que ya carga Dashboard.jsx via useJsApiLoader — por eso recibe
// `mapsLoaded` como prop en vez de cargar su propio script.
const InputDireccion = ({ name, placeholder, value, onChange, esOrigen = false, onUbicacionActual, ancho = '110px', mapsLoaded = false }) => {
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useEffect(() => {
    const handleClickFuera = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMostrar(false);
        setSinResultados(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  const boundsAntioquia = () => new window.google.maps.LatLngBounds(
    { lat: BOUNDS_ANTIOQUIA.south, lng: BOUNDS_ANTIOQUIA.west },
    { lat: BOUNDS_ANTIOQUIA.north, lng: BOUNDS_ANTIOQUIA.east }
  );

  const buscarSugerencias = (texto) => {
    clearTimeout(debounceRef.current);
    setSinResultados(false);
    if (!texto || texto.length < 3) { setSugerencias([]); setMostrar(false); return; }
    if (!mapsLoaded || !window.google) { setSugerencias([]); setMostrar(false); return; }

    debounceRef.current = setTimeout(() => {
      setCargando(true);
      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: texto,
          componentRestrictions: { country: 'co' },
          locationBias: boundsAntioquia(),
          sessionToken: sessionTokenRef.current,
        },
        (predictions, status) => {
          setCargando(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
            setSugerencias(predictions);
            setMostrar(true);
            setSinResultados(false);
          } else {
            if (status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              console.warn(`[Autocomplete] Google no respondió bien a "${texto}" — status: ${status}`);
            }
            setSugerencias([]);
            setMostrar(true);
            setSinResultados(true);
          }
        }
      );
    }, 350);
  };

  const handleChange = (e) => {
    onChange(e);
    buscarSugerencias(e.target.value);
  };

  const seleccionarSugerencia = (prediction) => {
    onChange({ target: { name, value: prediction.description } });
    setSugerencias([]);
    setMostrar(false);
    setSinResultados(false);
    // Nueva sesión de facturación de Places para la próxima búsqueda
    sessionTokenRef.current = null;
  };

  const usarDireccionManual = () => {
    setMostrar(false);
    setSinResultados(false);
  };

  const usarUbicacionActual = () => {
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
    setCargandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapsLoaded && window.google) {
          if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
          geocoderRef.current.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            const texto = (status === 'OK' && results?.[0]) ? results[0].formatted_address : 'Mi ubicación';
            onChange({ target: { name, value: texto } });
            if (onUbicacionActual) onUbicacionActual({ texto, coords: [latitude, longitude] });
            setCargandoUbicacion(false);
          });
        } else {
          onChange({ target: { name, value: 'Mi ubicación' } });
          if (onUbicacionActual) onUbicacionActual({ texto: 'Mi ubicación', coords: [latitude, longitude] });
          setCargandoUbicacion(false);
        }
      },
      () => { alert('No pudimos acceder a tu ubicación. Verifica los permisos del navegador.'); setCargandoUbicacion(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="text"
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => (sugerencias.length > 0 || sinResultados) && setMostrar(true)}
          autoComplete="off"
          style={{ border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent', width: ancho }}
        />
        {cargando && <span style={{ display: 'inline-flex', color: T.piedraClara, animation: 't-girar .9s linear infinite' }}><IconGirar size={12} /></span>}

        {/* BOTÓN UBICACIÓN ACTUAL — solo en origen */}
        {esOrigen && !cargando && (
          <button type="button" onClick={usarUbicacionActual} disabled={cargandoUbicacion}
            title="Usar mi ubicación actual"
            style={{ background: 'none', border: 'none', cursor: cargandoUbicacion ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '22px', height: '22px', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--t-musgo)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            {cargandoUbicacion
              ? <span style={{ display: 'inline-flex', color: T.piedraClara, animation: 't-girar .9s linear infinite' }}><IconGirar size={13} /></span>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="9" />
                </svg>
            }
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {mostrar && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '-15px', backgroundColor: 'var(--t-papel)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--t-linea)', zIndex: 3000, minWidth: '300px', maxWidth: '360px', overflow: 'hidden' }}>

          {/* RESULTADOS */}
          {!sinResultados && sugerencias.map((prediction, i) => {
            const structured = prediction.structured_formatting || {};
            const nombrePrincipal = structured.main_text || prediction.description;
            const secundario = structured.secondary_text || '';

            return (
              <div key={prediction.place_id || i} onMouseDown={() => seleccionarSugerencia(prediction)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < sugerencias.length - 1 ? '1px solid var(--t-niebla-2)' : 'none', display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: 'var(--t-papel)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--t-musgo)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                <span style={{ marginTop: '1px', flexShrink: 0, display: 'flex', color: T.piedra }}><IconPin size={15} /></span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--t-tinta)' }}>{nombrePrincipal}</div>
                  {secundario && (
                    <div style={{ fontSize: '12px', color: 'var(--t-piedra)', marginTop: '2px' }}>
                      {secundario}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* NO ENCONTRADO */}
          {sinResultados && (
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                <span style={{ flexShrink: 0, display: 'flex', color: T.piedraClara }}><IconRadar size={16} /></span>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: 'var(--t-tinta)' }}>No encontramos esa dirección</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra)' }}>Las direcciones con número de casa tienen cobertura limitada.</p>
                </div>
              </div>

              {/* USAR DE TODAS FORMAS */}
              <div onMouseDown={usarDireccionManual}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--t-musgo)', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', cursor: 'pointer', marginBottom: '10px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--t-musgo)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--t-musgo)'}>
                <span style={{ flexShrink: 0, display: 'flex', color: T.musgoTexto }}><IconVisto size={15} /></span>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: BRAND_GREEN }}>Usar "{value}" de todas formas</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-musgo-texto)' }}>El conductor verá esta dirección tal como la escribiste</p>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--t-niebla)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--t-linea)' }}>
                <p style={{ margin: '0 0 5px', fontSize: '12px', fontWeight: '700', color: T.piedra, display: 'flex', alignItems: 'center', gap: '6px' }}><IconIdea size={12} />O probá con:</p>
                <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: '12px', color: 'var(--t-piedra)', lineHeight: '1.9' }}>
                  <li>Nombre del <strong>barrio</strong> — ej: <em>"Laureles"</em></li>
                  <li>Nombre de la <strong>comuna</strong> — ej: <em>"El Poblado"</em></li>
                  <li>Un <strong>lugar cercano</strong> — ej: <em>"Parque Lleras"</em></li>
                  <li>Nombre del <strong>municipio</strong> — ej: <em>"Bello"</em></li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InputDireccion;
