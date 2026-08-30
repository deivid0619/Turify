import { useState, useEffect, useRef } from 'react';

const BRAND_GREEN = '#16a34a';

// Contenedor oculto reutilizable que exige la API de PlacesService de Google (necesita un
// nodo del DOM o una instancia de mapa para construirse, aunque no lo vayamos a mostrar).
let placesServiceDiv = null;
const getPlacesService = () => {
  if (!window.google?.maps?.places) return null;
  if (!placesServiceDiv) {
    placesServiceDiv = document.createElement('div');
  }
  return new window.google.maps.places.PlacesService(placesServiceDiv);
};

const InputDireccion = ({ name, placeholder, value, onChange, esOrigen = false, onUbicacionActual, mapsLoaded = false }) => {
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
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

  // Inicializa el AutocompleteService de Google cuando el SDK ya cargó
  useEffect(() => {
    if (mapsLoaded && window.google?.maps?.places && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [mapsLoaded]);

  const buscarSugerencias = (texto) => {
    clearTimeout(debounceRef.current);
    setSinResultados(false);
    if (!texto || texto.length < 3) { setSugerencias([]); setMostrar(false); return; }
    if (!mapsLoaded || !autocompleteServiceRef.current) return;

    debounceRef.current = setTimeout(() => {
      setCargando(true);
      // Un session token por "sesión de búsqueda" (se crea al empezar a escribir y se reusa
      // hasta seleccionar un resultado) — reduce el costo de las llamadas a Places API
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: texto,
          componentRestrictions: { country: 'co' },
          sessionToken: sessionTokenRef.current,
        },
        (predictions, status) => {
          setCargando(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length > 0) {
            setSugerencias(predictions);
            setMostrar(true);
            setSinResultados(false);
          } else {
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
    // Texto que se muestra en el input mientras se resuelve el detalle del lugar
    onChange({ target: { name, value: prediction.description } });
    setSugerencias([]);
    setMostrar(false);
    setSinResultados(false);

    const placesService = getPlacesService();
    if (placesService) {
      placesService.getDetails(
        { placeId: prediction.place_id, fields: ['geometry', 'formatted_address'], sessionToken: sessionTokenRef.current },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const coords = [place.geometry.location.lat(), place.geometry.location.lng()];
            if (onUbicacionActual) onUbicacionActual({ texto: place.formatted_address || prediction.description, coords });
          }
          sessionTokenRef.current = null; // cerramos la sesion de autocompletar
        }
      );
    }
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
        if (!mapsLoaded || !window.google) {
          onChange({ target: { name, value: 'Mi ubicación' } });
          if (onUbicacionActual) onUbicacionActual({ texto: 'Mi ubicación', coords: [latitude, longitude] });
          setCargandoUbicacion(false);
          return;
        }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          const texto = status === 'OK' && results?.[0] ? results[0].formatted_address : 'Mi ubicación';
          onChange({ target: { name, value: texto } });
          if (onUbicacionActual) onUbicacionActual({ texto, coords: [latitude, longitude] });
          setCargandoUbicacion(false);
        });
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
          style={{ border: 'none', outline: 'none', fontSize: '13px', backgroundColor: 'transparent', width: '110px' }}
        />
        {cargando && <span style={{ fontSize: '10px', color: '#94a3b8' }}>⏳</span>}

        {/* BOTÓN UBICACIÓN ACTUAL — solo en origen */}
        {esOrigen && !cargando && (
          <button type="button" onClick={usarUbicacionActual} disabled={cargandoUbicacion}
            title="Usar mi ubicación actual"
            style={{ background: 'none', border: 'none', cursor: cargandoUbicacion ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '22px', height: '22px', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            {cargandoUbicacion
              ? <span style={{ fontSize: '12px' }}>⏳</span>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="9" />
                </svg>
            }
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {mostrar && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '-15px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', zIndex: 3000, minWidth: '300px', maxWidth: '360px', overflow: 'hidden' }}>

          {/* RESULTADOS */}
          {!sinResultados && sugerencias.map((prediction) => (
            <div key={prediction.place_id} onMouseDown={() => seleccionarSugerencia(prediction)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: '#fff', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
              <span style={{ fontSize: '16px', marginTop: '1px', flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                  {prediction.structured_formatting?.main_text || prediction.description}
                </div>
                {prediction.structured_formatting?.secondary_text && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {prediction.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* NO ENCONTRADO */}
          {sinResultados && (
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>🔍</span>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>No encontramos esa dirección</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>Las direcciones con número de casa tienen cobertura limitada.</p>
                </div>
              </div>

              {/* USAR DE TODAS FORMAS */}
              <div onMouseDown={usarDireccionManual}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', cursor: 'pointer', marginBottom: '10px' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dcfce7'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: BRAND_GREEN }}>Usar "{value}" de todas formas</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#166534' }}>El conductor verá esta dirección tal como la escribiste</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>💡 O intenta con:</p>
                <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: '11px', color: '#64748b', lineHeight: '1.9' }}>
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
