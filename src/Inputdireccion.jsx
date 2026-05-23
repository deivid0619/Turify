import { useState, useEffect, useRef } from 'react';

const BRAND_GREEN = '#16a34a';

const InputDireccion = ({ name, placeholder, value, onChange, esOrigen = false, onUbicacionActual }) => {
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

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

  const buscarSugerencias = (texto) => {
    clearTimeout(debounceRef.current);
    setSinResultados(false);
    if (!texto || texto.length < 3) { setSugerencias([]); setMostrar(false); return; }

    debounceRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const q = encodeURIComponent(texto);
        const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${q}&filter=countrycode:co&limit=5&lang=es&apiKey=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const features = data.features || [];

        if (features.length > 0) {
          setSugerencias(features);
          setMostrar(true);
          setSinResultados(false);
        } else {
          setSugerencias([]);
          setMostrar(true);
          setSinResultados(true);
        }
      } catch {
        setSugerencias([]);
        setMostrar(false);
      } finally {
        setCargando(false);
      }
    }, 350);
  };

  const handleChange = (e) => {
    onChange(e);
    buscarSugerencias(e.target.value);
  };

  const seleccionarSugerencia = (feature) => {
    const p = feature.properties;
    // Construimos el texto: calle + ciudad + estado
    const partes = [
      p.street ? (p.housenumber ? `${p.street} #${p.housenumber}` : p.street) : null,
      p.city || p.town || p.municipality || p.county || null,
      p.state || null
    ].filter(Boolean);
    const texto = partes.join(', ');
    onChange({ target: { name, value: texto } });
    setSugerencias([]);
    setMostrar(false);
    setSinResultados(false);
  };

  const usarDireccionManual = () => {
    setMostrar(false);
    setSinResultados(false);
  };

  const usarUbicacionActual = () => {
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
    setCargandoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=es&apiKey=${API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          const p = data.features?.[0]?.properties || {};
          const nombre = p.street || p.neighbourhood || p.suburb || 'Mi ubicación';
          const ciudad = p.city || p.town || p.municipality || '';
          const texto = ciudad ? `${nombre}, ${ciudad}` : nombre;
          onChange({ target: { name, value: texto } });
          if (onUbicacionActual) onUbicacionActual({ texto, coords: [latitude, longitude] });
        } catch {
          onChange({ target: { name, value: 'Mi ubicación' } });
          if (onUbicacionActual) onUbicacionActual({ texto: 'Mi ubicación', coords: [latitude, longitude] });
        } finally {
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
          {!sinResultados && sugerencias.map((feature, i) => {
            const p = feature.properties;
            const nombrePrincipal = p.street
              ? (p.housenumber ? `${p.street} #${p.housenumber}` : p.street)
              : p.name || p.neighbourhood || p.suburb || p.formatted?.split(',')[0] || '';
            const ciudad = p.city || p.town || p.municipality || p.county || '';
            const dpto = p.state || '';

            return (
              <div key={i} onMouseDown={() => seleccionarSugerencia(feature)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < sugerencias.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: '#fff', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                <span style={{ fontSize: '16px', marginTop: '1px', flexShrink: 0 }}>📍</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{nombrePrincipal}</div>
                  {(ciudad || dpto) && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {[ciudad, dpto].filter(Boolean).join(', ')} · Colombia
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