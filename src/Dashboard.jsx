import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoTurify from './logo.png';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';

// --- CONFIGURACIÓN DE ICONOS VERDES CUSTOM ---
const greenMarkerHtml = `
  <div style="
    background-color: #16a34a; 
    width: 14px; 
    height: 14px; 
    border-radius: 50%; 
    border: 2px solid white; 
    box-shadow: 0 0 5px rgba(0,0,0,0.3);
  "></div>
`;

let DefaultIcon = L.divIcon({
    html: greenMarkerHtml,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
});
L.Marker.prototype.options.icon = DefaultIcon;

const BRAND_GREEN = '#16a34a';

const AjustarCamara = ({ coordenadas }) => {
  const map = useMap();
  useEffect(() => {
    if (coordenadas.origen && coordenadas.destino) {
      const bounds = L.latLngBounds([coordenadas.origen, coordenadas.destino]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (coordenadas.origen) {
        map.setView(coordenadas.origen, 15);
    }
  }, [coordenadas, map]);
  return null;
};

const Dashboard = () => {
  // --- ESTADOS PRINCIPALES ---
  const [tipoViaje, setTipoViaje] = useState('ida'); 
  const [busqueda, setBusqueda] = useState({ origen: '', destino: '', departure_time: '', return_time: '' });
  const [mostrarPasajeros, setMostrarPasajeros] = useState(false);
  const [pasajeros, setPasajeros] = useState({ adultos: 1, ninos: 0, mascotas: false });
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [datosMapa, setDatosMapa] = useState({ origen: null, destino: null, ruta: [] });
  const [infoRuta, setInfoRuta] = useState(null);
  const navigate = useNavigate();

  // --- ESTADOS PARA GESTIÓN DE SOLICITUDES Y OFERTAS ---
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mostrarMisSolicitudes, setMostrarMisSolicitudes] = useState(false);
  const [listaSolicitudes, setListaSolicitudes] = useState([]); 
  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);
  const [notificaciones, setNotificaciones] = useState(0); // Nuevo estado para la campana

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDatosMapa(prev => ({ ...prev, origen: [latitude, longitude] }));
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const nombreLugar = data.address?.road || data.address?.suburb || "Mi ubicación";
          setBusqueda(prev => ({ ...prev, origen: nombreLugar }));
        } catch (error) {
          setBusqueda(prev => ({ ...prev, origen: "Mi ubicación" }));
        }
      }, () => console.log("El usuario denegó la ubicación"));
    }
  }, []);

  const handleBusqueda = (e) => setBusqueda({ ...busqueda, [e.target.name]: e.target.value });

  const actualizarPasajeros = (tipo, operacion) => {
    setPasajeros(prev => {
      const totalPasajeros = prev.adultos + prev.ninos;
      if (operacion === 'sumar' && totalPasajeros >= 44) return prev;
      const nuevoValor = operacion === 'sumar' ? prev[tipo] + 1 : prev[tipo] - 1;
      if (tipo === 'adultos' && nuevoValor < 1) return prev;
      if (nuevoValor < 0) return prev;
      return { ...prev, [tipo]: nuevoValor };
    });
  };

  const totalAsientos = pasajeros.adultos + pasajeros.ninos;
  const textoViajeros = `${totalAsientos} viajero${totalAsientos > 1 ? 's' : ''}`;

  const buscarRuta = async (e) => {
    e.preventDefault();
    if (!busqueda.origen || !busqueda.destino || !busqueda.departure_time) {
        alert("Por favor completa origen, destino y fecha de salida.");
        return;
    }
    if (tipoViaje === 'redondo' && !busqueda.return_time) {
        alert("Por favor selecciona una fecha de regreso.");
        return;
    }

    setCargandoMapa(true);
    setInfoRuta(null);
    setMostrarPasajeros(false); 

    try {
      let lat1, lon1;
      const textoOrigen = busqueda.origen.toLowerCase();
      if (datosMapa.origen && (textoOrigen.includes("ubicación") || textoOrigen.includes("ubicacion"))) {
        [lat1, lon1] = datosMapa.origen;
      } else {
        const queryOrigen = encodeURIComponent(`${busqueda.origen}, Colombia`);
        const resOri = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryOrigen}&limit=1`);
        const dataOri = await resOri.json();
        if (dataOri.length > 0) { lat1 = parseFloat(dataOri[0].lat); lon1 = parseFloat(dataOri[0].lon); }
      }

      const queryDestino = encodeURIComponent(`${busqueda.destino}, Colombia`);
      const resDes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryDestino}&limit=1`);
      const dataDes = await resDes.json();

      if (lat1 && dataDes.length > 0) {
        const lat2 = parseFloat(dataDes[0].lat);
        const lon2 = parseFloat(dataDes[0].lon);
        const resRuta = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`);
        const dataRuta = await resRuta.json();
        if (dataRuta.routes?.length > 0) {
          const rutaInvertida = dataRuta.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          setDatosMapa({ origen: [lat1, lon1], destino: [lat2, lon2], ruta: rutaInvertida });
          const distanciaKm = (dataRuta.routes[0].distance / 1000).toFixed(1);
          const tiempoMinutos = Math.round(dataRuta.routes[0].duration / 60);
          setInfoRuta({ distancia: `${distanciaKm} km`, tiempo: `${tiempoMinutos} min` });
        }
      } else { alert("No encontramos una de las direcciones."); }
    } catch (err) { alert("Error al buscar la ruta."); } finally { setCargandoMapa(false); }
  };

  const crearViaje = async () => {
    setEnviandoSolicitud(true);
    const nuevoId = Date.now();
    const nuevaSolicitud = {
      id: nuevoId,
      origin: busqueda.origen,
      destination: busqueda.destino,
      departure_time: busqueda.departure_time,
      return_time: tipoViaje === 'redondo' ? busqueda.return_time : null,
      seats_needed: totalAsientos, 
      estado: 'Buscando conductor',
      fechaCreacion: new Date().toLocaleDateString(),
      ofertas: [] 
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      setListaSolicitudes(prev => [nuevaSolicitud, ...prev]);
      setInfoRuta(null); 
      setMostrarMisSolicitudes(true);

      // SIMULADOR: Después de 5 segundos, llega una oferta
      setTimeout(() => {
        const ofertaSimulada = {
          id: Date.now() + 1,
          conductor: "Carlos G.",
          vehiculo: "Chevrolet Spark 2022",
          calificacion: 4.8,
          precio: 45000 
        };

        setListaSolicitudes(prev => prev.map(viaje => {
          if (viaje.id === nuevoId) {
            return { ...viaje, estado: 'Oferta recibida', ofertas: [ofertaSimulada, ...viaje.ofertas] };
          }
          return viaje;
        }));

        // --- NUEVO: Aumentar contador de notificaciones ---
        setNotificaciones(prev => prev + 1);

      }, 5000);

    } catch (error) {
      alert("Hubo un error al procesar tu solicitud.");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // --- ACCIONES DE OFERTA ---
  const handleAceptarOferta = (viajeId, ofertaId) => {
    alert("¡Viaje aceptado! Redirigiendo a detalles del conductor...");
    setListaSolicitudes(prev => prev.map(v => v.id === viajeId ? { ...v, estado: 'Confirmado', ofertas: [] } : v));
    setViajeSeleccionado(null);
  };

  const handleRechazarOferta = (viajeId, ofertaId) => {
    setListaSolicitudes(prev => prev.map(v => {
      if (v.id === viajeId) {
        const nuevasOfertas = v.ofertas.filter(o => o.id !== ofertaId);
        return { ...v, estado: nuevasOfertas.length > 0 ? 'Oferta recibida' : 'Buscando conductor', ofertas: nuevasOfertas };
      }
      return v;
    }));
    setViajeSeleccionado(prev => {
      if (prev && prev.id === viajeId) {
        const nuevasOfertas = prev.ofertas.filter(o => o.id !== ofertaId);
        return { ...prev, ofertas: nuevasOfertas };
      }
      return prev;
    });
  };

  const handleContraoferta = (viajeId, ofertaId) => {
    const nuevaTarifa = window.prompt("¿Cuánto deseas ofrecer por este viaje? (Ej. 40000)");
    if (nuevaTarifa) {
      alert(`Has enviado una contraoferta de $${nuevaTarifa} al conductor. Esperando su respuesta...`);
    }
  };

  // --- ESTILOS COMPONENTES PEQUEÑOS ---
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 40px', backgroundColor: '#fff', borderBottom: '1px solid #eee', position: 'absolute', top: 0, width: '100%', zIndex: 1000, boxSizing: 'border-box', boxShadow: '0 1px 10px rgba(0,0,0,0.05)' };
  const searchBarStyle = { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '40px', padding: '5px 5px 5px 15px', backgroundColor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
  const inputStyle = { border: 'none', outline: 'none', fontSize: '13px', backgroundColor: 'transparent' };
  const dividerStyle = { width: '1px', height: '20px', background: '#ddd', margin: '0 10px' };

  const SelectorPasajero = ({ titulo, subtitulo, tipo }) => {
    const botonDeshabilitado = totalAsientos >= 44;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #eee' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>{titulo}</div>
          <div style={{ fontSize: '13px', color: '#777', marginTop: '2px' }}>{subtitulo}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => actualizarPasajeros(tipo, 'restar')} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>-</motion.button>
          <span style={{ width: '20px', textAlign: 'center', fontSize: '15px' }}>{pasajeros[tipo]}</span>
          <motion.button whileTap={!botonDeshabilitado ? { scale: 0.9 } : {}} type="button" onClick={() => actualizarPasajeros(tipo, 'sumar')} disabled={botonDeshabilitado} style={{ width: '30px', height: '30px', borderRadius: '50%', border: botonDeshabilitado ? '1px solid #eee' : '1px solid #777', background: '#fff', cursor: botonDeshabilitado ? 'not-allowed' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: botonDeshabilitado ? '#ccc' : '#222' }}>+</motion.button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      
      {/* HEADER COMPLETO */}
      <header style={headerStyle}>
        <img src={logoTurify} alt="Logo" style={{ height: '70px' }} />
        
        {/* BARRA DE BÚSQUEDA RESTAURADA */}
        <form onSubmit={buscarRuta} style={searchBarStyle}>
          <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
            <button type="button" onClick={() => setTipoViaje('ida')} style={{ padding: '8px 12px', borderRadius: '20px', border: 'none', backgroundColor: tipoViaje === 'ida' ? BRAND_GREEN : 'transparent', color: tipoViaje === 'ida' ? '#fff' : '#666', fontWeight: '600', fontSize: '12px', cursor: 'pointer', transition: '0.2s' }}>Solo ida</button>
            <button type="button" onClick={() => setTipoViaje('redondo')} style={{ padding: '8px 12px', borderRadius: '20px', border: 'none', backgroundColor: tipoViaje === 'redondo' ? BRAND_GREEN : 'transparent', color: tipoViaje === 'redondo' ? '#fff' : '#666', fontWeight: '600', fontSize: '12px', cursor: 'pointer', transition: '0.2s' }}>Ida y vuelta</button>
          </div>
          <div style={dividerStyle}></div>
          <input type="text" name="origen" placeholder="Origen" value={busqueda.origen} onChange={handleBusqueda} style={{ ...inputStyle, width: '110px' }} />
          <div style={dividerStyle}></div>
          <input type="text" name="destino" placeholder="" value={busqueda.destino} onChange={handleBusqueda} style={{ ...inputStyle, width: '110px' }} />
          <div style={dividerStyle}></div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input type="datetime-local" name="departure_time" value={busqueda.departure_time} onChange={handleBusqueda} style={{ ...inputStyle, width: '130px', color: busqueda.departure_time ? '#000' : '#888' }} required />
            <AnimatePresence>
              {tipoViaje === 'redondo' && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  <span style={{ fontSize: '12px', color: '#888', marginRight: '5px' }}>→</span>
                  <input type="datetime-local" name="return_time" value={busqueda.return_time} onChange={handleBusqueda} style={{ ...inputStyle, width: '130px', color: busqueda.return_time ? '#000' : '#888' }} required={tipoViaje === 'redondo'} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={dividerStyle}></div>
          
          {/* SELECTOR DE PASAJEROS RESTAURADO */}
          <div style={{ position: 'relative' }}>
            <div onClick={() => setMostrarPasajeros(!mostrarPasajeros)} style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '14px', color: '#222', userSelect: 'none', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Quién</span>
              <span style={{ color: '#666' }}>{textoViajeros}</span>
            </div>
            <AnimatePresence>
              {mostrarPasajeros && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.2, ease: "easeOut" }} style={{ position: 'absolute', top: '50px', right: '-40px', background: '#fff', borderRadius: '20px', padding: '15px 25px', width: '320px', boxShadow: '0 8px 28px rgba(0,0,0,0.15)', zIndex: 2000 }}>
                  <SelectorPasajero titulo="Adultos" subtitulo="15 años o más" tipo="adultos" />
                  <SelectorPasajero titulo="Niños" subtitulo="Edades 0 – 14" tipo="ninos" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #eee' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>Mascotas</div>
                      <div style={{ fontSize: '13px', color: '#777', marginTop: '2px' }}>¿Traes mascota?</div>
                    </div>
                    <input type="checkbox" checked={pasajeros.mascotas} onChange={(e) => setPasajeros(prev => ({ ...prev, mascotas: e.target.checked }))} style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: BRAND_GREEN }} />
                  </div>
                  {totalAsientos >= 44 && <p style={{ color: '#d97706', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>Límite máximo alcanzado.</p>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMostrarPasajeros(false)} type="button" style={{ background: BRAND_GREEN, color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ background: BRAND_GREEN, border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', cursor: 'pointer', marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' }}>
            {cargandoMapa ? '...' : '🔍'}
          </motion.button>
        </form>

        {/* BOTONERA DERECHA */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          
          {/* --- CAMPANITA DE NOTIFICACIONES --- */}
          <motion.div 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => {
              setMostrarMisSolicitudes(true);
              setNotificaciones(0); 
            }}
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '35px', height: '35px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0' }}
          >
            <span style={{ fontSize: '18px' }}>🔔</span>
            <AnimatePresence>
              {notificaciones > 0 && (
                <motion.span 
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #fff' }}
                >
                  {notificaciones}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* --- BOTÓN MIS VIAJES --- */}
          <motion.button 
            onClick={() => setMostrarMisSolicitudes(true)}
            style={{ background: '#fff', border: '1px solid #ddd', fontWeight: '600', cursor: 'pointer', color: '#444', fontSize: '13px', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            Mis Viajes
            {listaSolicitudes.length > 0 && (
              <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {listaSolicitudes.reduce((acc, viaje) => acc + viaje.ofertas.length, 0)}
              </span>
            )}
          </motion.button>

          {/* --- BOTÓN QUIERO SER CONDUCTOR (Movido al final) --- */}
          <motion.button 
          onClick={() => navigate('/registro-conductor')}
          style={{ background: BRAND_GREEN, border: 'none', fontWeight: '700', cursor: 'pointer', color: '#fff', fontSize: '13px', padding: '8px 15px', borderRadius: '20px' }}>
            Quiero ser conductor
          </motion.button>

          {/* --- MENÚ DE USUARIO --- */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ border: '1px solid #ddd', borderRadius: '20px', padding: '5px 15px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>☰</span> <div style={{background: '#eee', borderRadius: '50%', width: '25px', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>👤</div>
          </motion.div>

          

        </div>
      </header>

      {/* MODAL RESUMEN VIAJE (MAPA) */}
      <AnimatePresence>
        {infoRuta && (
          <motion.div initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 50, x: "-50%" }} style={{ position: 'absolute', bottom: '40px', left: '50%', backgroundColor: '#fff', padding: '20px 25px', borderRadius: '15px', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center', width: '350px' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Resumen del viaje</p>
            <h3 style={{ margin: '8px 0 15px 0', color: '#222' }}>{infoRuta.tiempo} ({infoRuta.distancia})</h3>
            <button onClick={crearViaje} disabled={enviandoSolicitud} style={{ background: enviandoSolicitud ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: enviandoSolicitud ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%', transition: '0.2s' }}>
              {enviandoSolicitud ? 'Procesando...' : 'Confirmar y Publicar Viaje'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PANEL LATERAL DE SOLICITUDES Y OFERTAS --- */}
      <AnimatePresence>
        {mostrarMisSolicitudes && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }}
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, right: 0, width: '420px', maxWidth: '100%', height: '100vh', backgroundColor: '#fff', zIndex: 2001, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}
            >
              
              {/* HEADER DEL PANEL */}
              <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {viajeSeleccionado && (
                    <button onClick={() => setViajeSeleccionado(null)} style={{ border: 'none', background: '#e2e8f0', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>←</button>
                  )}
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
                    {viajeSeleccionado ? 'Ofertas del viaje' : 'Mis Viajes Activos'}
                  </h2>
                </div>
                <button onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>
              
              {/* CONTENIDO DEL PANEL */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#fff' }}>
                
                {/* VISTA 1: LISTA DE VIAJES */}
                {!viajeSeleccionado && listaSolicitudes.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🚗</div>
                    Aún no tienes solicitudes.
                  </div>
                )}
                {!viajeSeleccionado && listaSolicitudes.map((viaje) => (
                  <div 
                    key={viaje.id} 
                    onClick={() => setViajeSeleccionado(viaje)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '15px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: viaje.ofertas.length > 0 ? '#f0fdf4' : '#fff', borderLeft: viaje.ofertas.length > 0 ? `4px solid ${BRAND_GREEN}` : '1px solid #e2e8f0' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{viaje.fechaCreacion}</span>
                      <span style={{ color: viaje.ofertas.length > 0 ? BRAND_GREEN : '#ca8a04', fontSize: '12px', fontWeight: 'bold' }}>
                        {viaje.ofertas.length > 0 ? `🎉 ${viaje.ofertas.length} Oferta(s)` : '⏳ ' + viaje.estado}
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px', marginBottom: '5px' }}>
                      {viaje.origin} <span style={{ color: BRAND_GREEN }}>→</span> {viaje.destination}
                    </div>
                    {/* --- INFORMACIÓN RESTAURADA --- */}
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '5px' }}>
                      🗓️ Salida: {new Date(viaje.departure_time).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555' }}>
                      👥 {viaje.seats_needed} asientos solicitados
                    </div>
                    {/* -------------------------------- */}
                  </div>
                ))}

                {/* VISTA 2: OFERTAS DEL VIAJE SELECCIONADO */}
                {viajeSeleccionado && (
                  <div>
                    <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #cbd5e1' }}>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>{viajeSeleccionado.origin} a {viajeSeleccionado.destination}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>Salida: {new Date(viajeSeleccionado.departure_time).toLocaleString()}</div>
                    </div>

                    {/* Obtener el viaje actualizado de la lista maestra */}
                    {(() => {
                      const viajeActualizado = listaSolicitudes.find(v => v.id === viajeSeleccionado.id);
                      if (!viajeActualizado || viajeActualizado.ofertas.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ fontSize: '30px', marginBottom: '10px' }}>📡</div>
                            <div style={{ color: '#64748b', fontSize: '14px' }}>Esperando ofertas de conductores...</div>
                          </div>
                        );
                      }

                      return viajeActualizado.ofertas.map(oferta => (
                        <div key={oferta.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px' }}>👤</div>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{oferta.conductor} <span style={{ color: '#eab308', fontSize: '13px' }}>★ {oferta.calificacion}</span></div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{oferta.vehiculo}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '18px', color: BRAND_GREEN }}>
                              ${oferta.precio.toLocaleString()}
                            </div>
                          </div>
                          
                          {/* BOTONERA DE ACCIONES */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                            <button 
                              onClick={() => handleAceptarOferta(viajeActualizado.id, oferta.id)}
                              style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                              Aceptar
                            </button>
                            <button 
                              onClick={() => handleContraoferta(viajeActualizado.id, oferta.id)}
                              style={{ flex: 1, background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                              Contra ofertar
                            </button>
                            <button 
                              onClick={() => handleRechazarOferta(viajeActualizado.id, oferta.id)}
                              style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                              title="Rechazar">
                              ✕
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAPA Y CAPAS */}
      <div style={{ height: '100%', width: '100%', paddingTop: '90px', boxSizing: 'border-box' }} onClick={() => setMostrarPasajeros(false)}>
        <MapContainer center={[6.24, -75.58]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          {datosMapa.origen && <Marker position={datosMapa.origen}><Popup>Origen</Popup></Marker>}
          {datosMapa.destino && <Marker position={datosMapa.destino}><Popup>Destino</Popup></Marker>}
          {datosMapa.ruta.length > 0 && <Polyline positions={datosMapa.ruta} color={BRAND_GREEN} weight={5} />}
          <AjustarCamara coordenadas={datosMapa} />
        </MapContainer>
      </div>
    </div>
  );
};

export default Dashboard;