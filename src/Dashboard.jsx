import { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoTurify from './logo.png';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import PanelConductor from './PanelConductor';
import InputDireccion from './InputDireccion';
import PerfilDrawer from './PerfilDrawer';
import { ToastContainer, useToast } from './Toast';
import { SkeletonDashboard, SkeletonTarjetaConfirmado, ErrorConexion } from './Skeleton';

const greenMarkerHtml = `<div style="background-color:#16a34a;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`;
let DefaultIcon = L.divIcon({ html: greenMarkerHtml, className: '', iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
L.Marker.prototype.options.icon = DefaultIcon;

const BRAND_GREEN = '#16a34a';
import API_BASE_URL from './api';

const AjustarCamara = ({ coordenadas }) => {
  const map = useMap();
  useEffect(() => {
    if (coordenadas.origen && coordenadas.destino) {
      map.fitBounds(L.latLngBounds([coordenadas.origen, coordenadas.destino]), { padding: [50, 50] });
    } else if (coordenadas.origen) {
      map.setView(coordenadas.origen, 15);
    }
  }, [coordenadas, map]);
  return null;
};

const ModalErrorDireccion = ({ textoDireccion, onCerrar, onContinuar }) => (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCerrar}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000 }} />
    <motion.div initial={{ opacity: 0, scale: 0.92, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -20 }}
      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', zIndex: 3001, boxShadow: '0 20px 50px rgba(0,0,0,0.18)', width: '390px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '40px' }}>📍</span>
        <h3 style={{ margin: '10px 0 4px', color: '#1e293b', fontSize: '17px' }}>No encontramos "{textoDireccion}"</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
          Esta dirección no está en el mapa, pero puedes usarla igual — el conductor verá exactamente lo que escribiste.
        </p>
      </div>
      <button onClick={onContinuar}
        style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', padding: '13px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span>✅</span> Continuar con esta dirección
      </button>
      <button onClick={onCerrar}
        style={{ width: '100%', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '11px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>
        ✏️ Quiero corregir la dirección
      </button>
      <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>💡 Para mejor precisión en el mapa, intenta con:</p>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: '#64748b', lineHeight: '2' }}>
          <li>Nombre del <strong>barrio</strong> — ej: <em>"Laureles, Medellín"</em></li>
          <li>Nombre de la <strong>comuna</strong> — ej: <em>"El Poblado"</em></li>
          <li>Un <strong>lugar cercano</strong> — ej: <em>"Parque Lleras"</em></li>
          <li>Nombre del <strong>municipio</strong> — ej: <em>"Bello, Antioquia"</em></li>
        </ul>
      </div>
    </motion.div>
  </>
);

const Dashboard = () => {
  const { token, usuario } = useContext(AuthContext);
  const navigate = useNavigate();
  const { toasts, removeToast, toast } = useToast();
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [errorConexion, setErrorConexion] = useState(false);

  const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

  const [tipoViaje, setTipoViaje] = useState('ida');
  const [busqueda, setBusqueda] = useState({ origen: '', destino: '', departure_time: '', return_time: '' });
  const [mostrarPasajeros, setMostrarPasajeros] = useState(false);
  const [pasajeros, setPasajeros] = useState({ adultos: 1, ninos: 0, mascotas: false });
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [datosMapa, setDatosMapa] = useState({ origen: null, destino: null, ruta: [] });
  const [infoRuta, setInfoRuta] = useState(null);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mostrarMisSolicitudes, setMostrarMisSolicitudes] = useState(false);
  const [listaSolicitudes, setListaSolicitudes] = useState([]);
  const [viajesConfirmados, setViajesConfirmados] = useState([]);
  const [pestanaViajes, setPestanaViajes] = useState('activos'); // 'activos' | 'confirmados'
  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [mostrarPanelConductor, setMostrarPanelConductor] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [modalFuec, setModalFuec] = useState(null); // request_id del viaje a registrar
  const [ocupantesFuec, setOcupantesFuec] = useState([{ full_name: '', document_type: 'CC', document_number: '' }]);
  const [enviandoFuec, setEnviandoFuec] = useState(false);
  const [fuecEnviado, setFuecEnviado] = useState({}); // { request_id: true } para saber cuáles ya se registraron
  const [errorDireccion, setErrorDireccion] = useState(null);
  const coordsBuffer = useRef({});

  // Geocodificar texto → coords usando Geoapify
  const geocodificar = async (texto) => {
    const q = encodeURIComponent(`${texto}, Colombia`);
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${q}&filter=countrycode:co&limit=1&lang=es&apiKey=${GEOAPIFY_KEY}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon };
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDatosMapa(prev => ({ ...prev, origen: [latitude, longitude] }));
        try {
          const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&lang=es&apiKey=${GEOAPIFY_KEY}`);
          const data = await res.json();
          const p = data.features?.[0]?.properties || {};
          const nombre = p.street || p.neighbourhood || p.suburb || 'Mi ubicación';
          const ciudad = p.city || p.town || p.municipality || '';
          setBusqueda(prev => ({ ...prev, origen: ciudad ? `${nombre}, ${ciudad}` : nombre }));
        } catch {
          setBusqueda(prev => ({ ...prev, origen: 'Mi ubicación' }));
        }
      }, () => console.log('El usuario denegó la ubicación'));
    }
  }, []);

  const handleBusqueda = (e) => setBusqueda(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleUbicacionActual = ({ texto, coords }) => {
    setDatosMapa(prev => ({ ...prev, origen: coords }));
  };

  const actualizarPasajeros = (tipo, operacion) => {
    setPasajeros(prev => {
      const total = prev.adultos + prev.ninos;
      if (operacion === 'sumar' && total >= 44) return prev;
      const nuevo = operacion === 'sumar' ? prev[tipo] + 1 : prev[tipo] - 1;
      if (tipo === 'adultos' && nuevo < 1) return prev;
      if (nuevo < 0) return prev;
      return { ...prev, [tipo]: nuevo };
    });
  };

  const totalAsientos = pasajeros.adultos + pasajeros.ninos;
  const textoViajeros = `${totalAsientos} viajero${totalAsientos > 1 ? 's' : ''}`;

  const trazarRutaConCoords = async (lat1, lon1, lat2, lon2) => {
    try {
      const apiKey = import.meta.env.VITE_ORS_API_KEY;
      const res = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${lon1},${lat1}&end=${lon2},${lat2}`);
      const data = await res.json();
      if (data.features?.length > 0) {
        const ruta = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const resumen = data.features[0].properties.summary;
        setDatosMapa({ origen: [lat1, lon1], destino: [lat2, lon2], ruta });
        setInfoRuta({ distancia: `${(resumen.distance / 1000).toFixed(1)} km`, tiempo: `${Math.round(resumen.duration / 60)} min` });
      } else {
        toast.warning('No se pudo trazar una ruta entre estas dos ubicaciones.');
      }
    } catch {
      toast.error('Error de conexión con el servidor de rutas.');
    }
  };

  const trazarRutaConductor = async (origen, destino) => {
    try {
      const [coordsOri, coordsDes] = await Promise.all([geocodificar(origen), geocodificar(destino)]);
      if (!coordsOri || !coordsDes) return;
      await trazarRutaConCoords(coordsOri.lat, coordsOri.lon, coordsDes.lat, coordsDes.lon);
      setInfoRuta(null);
    } catch (err) {
      console.error('Error trazando ruta del conductor:', err);
    }
  };

  const buscarRuta = async (e) => {
    e.preventDefault();
    if (!busqueda.origen || !busqueda.destino || !busqueda.departure_time) {
      toast.warning('Por favor completa origen, destino y fecha de salida.');
      return;
    }
    if (tipoViaje === 'redondo' && !busqueda.return_time) {
      toast.warning('Por favor selecciona una fecha de regreso.');
      return;
    }
    setCargandoMapa(true);
    setInfoRuta(null);
    setMostrarPasajeros(false);

    try {
      let lat1, lon1;
      const textoOrigen = busqueda.origen.toLowerCase();

      if (datosMapa.origen && (textoOrigen.includes('ubicación') || textoOrigen.includes('ubicacion') || textoOrigen.includes('mi ubicación'))) {
        [lat1, lon1] = datosMapa.origen;
      } else {
        const coordsOri = await geocodificar(busqueda.origen);
        if (coordsOri) {
          lat1 = coordsOri.lat;
          lon1 = coordsOri.lon;
        } else {
          coordsBuffer.current = {};
          setErrorDireccion({ campo: 'origen' });
          setCargandoMapa(false);
          return;
        }
      }

      const coordsDes = await geocodificar(busqueda.destino);
      if (!coordsDes) {
        coordsBuffer.current = { lat1, lon1 };
        setErrorDireccion({ campo: 'destino' });
        setCargandoMapa(false);
        return;
      }

      await trazarRutaConCoords(lat1, lon1, coordsDes.lat, coordsDes.lon);

    } catch (err) {
      console.error('Error:', err);
      toast.error('Error de conexión con el servidor de rutas.');
    } finally {
      setCargandoMapa(false);
    }
  };

  const handleContinuarConDireccionManual = async () => {
    setErrorDireccion(null);
    setCargandoMapa(true);
    try {
      if (errorDireccion.campo === 'origen') {
        const lat1 = datosMapa.origen ? datosMapa.origen[0] : 4.6097;
        const lon1 = datosMapa.origen ? datosMapa.origen[1] : -74.0817;
        const coordsDes = await geocodificar(busqueda.destino);
        if (coordsDes) {
          setDatosMapa(prev => ({ ...prev, origen: [lat1, lon1], destino: [coordsDes.lat, coordsDes.lon] }));
          await trazarRutaConCoords(lat1, lon1, coordsDes.lat, coordsDes.lon);
        } else {
          setInfoRuta({ distancia: 'No disponible', tiempo: 'No disponible' });
        }
      } else {
        const { lat1, lon1 } = coordsBuffer.current;
        setDatosMapa(prev => ({ ...prev, origen: [lat1, lon1] }));
        setInfoRuta({ distancia: 'No disponible', tiempo: 'No disponible' });
      }
    } catch {
      setInfoRuta({ distancia: 'No disponible', tiempo: 'No disponible' });
    } finally {
      setCargandoMapa(false);
    }
  };

  const crearViaje = async () => {
    if (!token) { toast.warning('Debes iniciar sesión para publicar un viaje.'); return; }
    setEnviandoSolicitud(true);
    try {
      const payload = {
        origin: busqueda.origen, destination: busqueda.destino,
        departure_time: busqueda.departure_time,
        return_time: tipoViaje === 'redondo' ? busqueda.return_time : null,
        trip_type: tipoViaje === 'redondo' ? 'ROUND_TRIP' : 'ONE_WAY',
        adults_count: pasajeros.adultos, children_count: pasajeros.ninos, has_pets: pasajeros.mascotas
      };
      const res = await fetch(`${API_BASE_URL}/api/service-requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error al publicar el viaje'); }
      setInfoRuta(null);
      setDatosMapa({ origen: null, destino: null, ruta: [] });
      setBusqueda({ origen: '', destino: '', departure_time: '', return_time: '' });
      toast.success('¡Viaje publicado exitosamente! Los conductores podrán hacerte ofertas.');
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // SCRUM-91: Cargar notificaciones reales del backend
  const cargarNotificaciones = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/notifications`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setNotificaciones(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    cargarNotificaciones();
    const intervalo = setInterval(cargarNotificaciones, 15000);
    return () => clearInterval(intervalo);
  }, [token]);

  const marcarLeida = async (notifId) => {
    try {
      await fetch(`${API_BASE_URL}/api/service-requests/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      setNotificaciones(prev => prev.map(n =>
        n.notification_id === notifId ? { ...n, is_read: true } : n
      ));
    } catch {}
  };

  // HU10: Enviar FUEC
  const enviarFuec = async () => {
    const invalidos = ocupantesFuec.filter(o => !o.full_name.trim() || !o.document_number.trim());
    if (invalidos.length > 0) { toast.warning('Completa nombre y número de documento de todos los ocupantes.'); return; }
    setEnviandoFuec(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${modalFuec}/passengers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ passengers: ocupantesFuec })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      setFuecEnviado(prev => ({ ...prev, [modalFuec]: true }));
      setModalFuec(null);
      toast.success('✅ Ocupantes registrados. El conductor ya puede ver la lista.');
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setEnviandoFuec(false);
    }
  };

  const agregarOcupante = () => {
    setOcupantesFuec(prev => [...prev, { full_name: '', document_type: 'CC', document_number: '' }]);
  };

  const quitarOcupante = (idx) => {
    if (ocupantesFuec.length === 1) return;
    setOcupantesFuec(prev => prev.filter((_, i) => i !== idx));
  };

  const actualizarOcupante = (idx, campo, valor) => {
    setOcupantesFuec(prev => prev.map((o, i) => i === idx ? { ...o, [campo]: valor } : o));
  };

  const marcarTodasLeidas = () => {
    notificaciones.filter(n => !n.is_read).forEach(n => marcarLeida(n.notification_id));
  };

  // SCRUM-79: Cargar viajes del pasajero — pendientes y confirmados
  const cargarMisViajes = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };

      // Cargar viajes PENDING con sus ofertas
      const respuesta = await fetch(`${API_BASE_URL}/api/service-requests/pending`, { headers });
      if (!respuesta.ok) return;
      const datos = await respuesta.json();

      const viajesConOfertas = await Promise.all(datos.map(async (v) => {
        let ofertas = [];
        try {
          const resOfertas = await fetch(`${API_BASE_URL}/api/service-requests/${v.request_id}/offers`, { headers });
          if (resOfertas.ok) {
            const dataOfertas = await resOfertas.json();
            ofertas = dataOfertas.map(o => ({
              id: o.offer_id,
              conductor: o.driver_name || `Conductor #${o.driver_id}`,
              foto: o.driver_photo || null,
              calificacion: 4.8,
              precio: o.offered_price,
              estado: o.status
            }));
          }
        } catch {}
        return {
          id: v.request_id,
          origin: v.origin,
          destination: v.destination,
          departure_time: v.departure_time,
          seats_needed: (v.adults_count || 1) + (v.children_count || 0),
          estado: ofertas.length > 0 ? 'Oferta recibida' : 'Buscando conductor',
          fechaCreacion: new Date(v.created_at || Date.now()).toLocaleDateString(),
          ofertas
        };
      }));

      // Cargar viajes ASSIGNED (confirmados)
      try {
        const resConfirmados = await fetch(`${API_BASE_URL}/api/service-requests/assigned`, { headers });
        if (resConfirmados.ok) {
          const dataConfirmados = await resConfirmados.json();
          setViajesConfirmados(dataConfirmados.map(v => ({
            id: v.request_id,
            origin: v.origin,
            destination: v.destination,
            departure_time: v.departure_time,
            seats_needed: (v.adults_count || 1) + (v.children_count || 0),
            fechaCreacion: new Date(v.created_at || Date.now()).toLocaleDateString(),
            conductor_nombre: v.conductor_nombre || 'Conductor asignado',
            conductor_foto: v.conductor_foto || null,
            precio_acordado: v.precio_acordado || 0,
            trip_status: v.trip_status || v.status || 'ASSIGNED'
          })));
        }
      } catch {}

      setListaSolicitudes(viajesConOfertas);
    } catch (error) { console.error('Error al cargar los viajes:', error); }
  };

  // SCRUM-81: Aceptar oferta — llama al endpoint real
  const handleAceptarOferta = async (viajeId, ofertaId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/offers/${ofertaId}/accept`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      toast.success('¡Viaje aceptado! El conductor ha sido notificado.');
      setViajeSeleccionado(null);
      cargarMisViajes();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleRechazarOferta = (viajeId, ofertaId) => {
    setListaSolicitudes(prev => prev.map(v => {
      if (v.id !== viajeId) return v;
      const nuevasOfertas = v.ofertas.filter(o => o.id !== ofertaId);
      return { ...v, estado: nuevasOfertas.length > 0 ? 'Oferta recibida' : 'Buscando conductor', ofertas: nuevasOfertas };
    }));
    setViajeSeleccionado(prev => {
      if (!prev || prev.id !== viajeId) return prev;
      return { ...prev, ofertas: prev.ofertas.filter(o => o.id !== ofertaId) };
    });
  };

  // SCRUM-80: Contraofertar — input dinámico + llamada al endpoint real
  const [modalContraoferta, setModalContraoferta] = useState(null); // { viajeId, ofertaId }
  const [precioContraoferta, setPrecioContraoferta] = useState('');
  const [enviandoContraoferta, setEnviandoContraoferta] = useState(false);

  const handleContraoferta = (viajeId, ofertaId) => {
    setModalContraoferta({ viajeId, ofertaId });
    setPrecioContraoferta('');
  };

  const enviarContraoferta = async () => {
    if (!precioContraoferta || isNaN(precioContraoferta) || Number(precioContraoferta) <= 0) {
      toast.warning('Ingresa un precio válido mayor a 0.');
      return;
    }
    setEnviandoContraoferta(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/offers/${modalContraoferta.ofertaId}/counter-offer`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ offered_price: Number(precioContraoferta) })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      toast.success(`¡Contraoferta de $${Number(precioContraoferta).toLocaleString()} enviada al conductor!`);
      setModalContraoferta(null);
      cargarMisViajes();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setEnviandoContraoferta(false);
    }
  };

  // HU15: Cargar viajes al montar con skeleton y manejo de error
  useEffect(() => {
    if (!token) return;
    const cargar = async () => {
      try {
        await cargarMisViajes();
      } catch {
        setErrorConexion(true);
      } finally {
        setCargandoInicial(false);
      }
    };
    cargar();
    // Polling de viajes confirmados para detectar cambios de estado (IN_PROGRESS, COMPLETED)
    const intervaloViajes = setInterval(() => cargarMisViajes(), 15000);
    return () => clearInterval(intervaloViajes);
  }, [token]);

  // Tiempo relativo para ofertas
  const tiempoRelativo = (fechaStr) => {
    if (!fechaStr) return '';
    const diff = Math.floor((Date.now() - new Date(fechaStr).getTime()) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
  };

  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 40px', backgroundColor: '#fff', borderBottom: '1px solid #eee', position: 'absolute', top: 0, width: '100%', zIndex: 1000, boxSizing: 'border-box', boxShadow: '0 1px 10px rgba(0,0,0,0.05)' };
  const searchBarStyle = { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '40px', padding: '5px 5px 5px 15px', backgroundColor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
  const dividerStyle = { width: '1px', height: '20px', background: '#ddd', margin: '0 10px', flexShrink: 0 };
  const inputStyle = { border: 'none', outline: 'none', fontSize: '13px', backgroundColor: 'transparent' };

  const SelectorPasajero = ({ titulo, subtitulo, tipo }) => {
    const deshabilitado = totalAsientos >= 44;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #eee' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#222' }}>{titulo}</div>
          <div style={{ fontSize: '13px', color: '#777', marginTop: '2px' }}>{subtitulo}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => actualizarPasajeros(tipo, 'restar')} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>-</motion.button>
          <span style={{ width: '20px', textAlign: 'center', fontSize: '15px' }}>{pasajeros[tipo]}</span>
          <motion.button whileTap={!deshabilitado ? { scale: 0.9 } : {}} type="button" onClick={() => actualizarPasajeros(tipo, 'sumar')} disabled={deshabilitado} style={{ width: '30px', height: '30px', borderRadius: '50%', border: deshabilitado ? '1px solid #eee' : '1px solid #777', background: '#fff', cursor: deshabilitado ? 'not-allowed' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: deshabilitado ? '#ccc' : '#222' }}>+</motion.button>
        </div>
      </div>
    );
  };

  return (
    <>
    {cargandoInicial && <SkeletonDashboard />}
    {errorConexion && !cargandoInicial && (
      <ErrorConexion onReintentar={() => {
        setErrorConexion(false);
        setCargandoInicial(true);
        cargarMisViajes().catch(() => setErrorConexion(true)).finally(() => setCargandoInicial(false));
      }} />
    )}
    <style>{`
      .fuec-input {
        width: 100%;
        padding: 9px 12px;
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: #f0fdf4 !important;
        font-size: 13px;
        font-family: 'DM Sans', sans-serif;
        box-sizing: border-box;
        outline: none;
        min-width: 0;
      }
      .fuec-input::placeholder { color: rgba(255,255,255,0.35) !important; }
      .fuec-input:focus {
        border-color: rgba(34,197,94,0.55) !important;
        background: rgba(34,197,94,0.08) !important;
        box-shadow: 0 0 0 3px rgba(34,197,94,0.1);
      }
      .fuec-select {
        width: 100%;
        padding: 9px 6px;
        background: #0d1a0d !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: #f0fdf4 !important;
        font-size: 13px;
        outline: none;
        cursor: pointer;
        min-width: 0;
      }
      .fuec-select option { background: #0d1a0d; color: #f0fdf4; }

      /* ── RESPONSIVIDAD TABLETS ── */
      @media (max-width: 900px) {
        .turify-panel-lateral {
          width: 100% !important;
          max-width: 100% !important;
          position: fixed !important;
          bottom: 0 !important;
          top: auto !important;
          left: 0 !important;
          right: 0 !important;
          height: 55vh !important;
          border-radius: 20px 20px 0 0 !important;
          box-shadow: 0 -4px 30px rgba(0,0,0,0.3) !important;
          z-index: 2000 !important;
        }
        .turify-header-search {
          flex-direction: column !important;
          gap: 6px !important;
        }
        .turify-header-search input {
          font-size: 12px !important;
        }
      }

      @media (max-width: 600px) {
        .turify-panel-lateral {
          height: 60vh !important;
        }
        .fuec-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
    <div style={{ height: '100vh', width: '100%', position: 'relative', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      <header style={headerStyle}>
        <img src={logoTurify} alt="Logo" style={{ height: '70px' }} />

        <form onSubmit={buscarRuta} style={searchBarStyle}>
          <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
            <button type="button" onClick={() => setTipoViaje('ida')} style={{ padding: '8px 12px', borderRadius: '20px', border: 'none', backgroundColor: tipoViaje === 'ida' ? BRAND_GREEN : 'transparent', color: tipoViaje === 'ida' ? '#fff' : '#666', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Solo ida</button>
            <button type="button" onClick={() => setTipoViaje('redondo')} style={{ padding: '8px 12px', borderRadius: '20px', border: 'none', backgroundColor: tipoViaje === 'redondo' ? BRAND_GREEN : 'transparent', color: tipoViaje === 'redondo' ? '#fff' : '#666', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Ida y vuelta</button>
          </div>
          <div style={dividerStyle} />
          <InputDireccion name="origen" placeholder="Origen" value={busqueda.origen} onChange={handleBusqueda} esOrigen={true} onUbicacionActual={handleUbicacionActual} />
          <div style={dividerStyle} />
          <InputDireccion name="destino" placeholder="Destino" value={busqueda.destino} onChange={handleBusqueda} />
          <div style={dividerStyle} />
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
          <div style={dividerStyle} />
          <div style={{ position: 'relative' }}>
            <div onClick={() => setMostrarPasajeros(!mostrarPasajeros)} style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '14px', color: '#222', userSelect: 'none', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Quién</span>
              <span style={{ color: '#666' }}>{textoViajeros}</span>
            </div>
            <AnimatePresence>
              {mostrarPasajeros && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.2 }}
                  style={{ position: 'absolute', top: '50px', right: '-40px', background: '#fff', borderRadius: '20px', padding: '15px 25px', width: '320px', boxShadow: '0 8px 28px rgba(0,0,0,0.15)', zIndex: 2000 }}>
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
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setMostrarPasajeros(false)} type="button" style={{ background: BRAND_GREEN, color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ background: BRAND_GREEN, border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', cursor: 'pointer', marginLeft: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '16px' }}>
            {cargandoMapa ? '...' : '🔍'}
          </motion.button>
        </form>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { setMostrarNotificaciones(true); }}
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '35px', height: '35px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <AnimatePresence>
              {notificaciones.filter(n => !n.is_read).length > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #fff' }}>
                  {notificaciones.filter(n => !n.is_read).length}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.button onClick={() => { cargarMisViajes(); setMostrarMisSolicitudes(true); }}
            style={{ background: '#fff', border: '1px solid #ddd', fontWeight: '600', cursor: 'pointer', color: '#444', fontSize: '13px', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            Mis Viajes
            {listaSolicitudes.length > 0 && (
              <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {listaSolicitudes.reduce((acc, v) => acc + (v.ofertas?.length || 0), 0)}
              </span>
            )}
          </motion.button>

          {usuario?.role === 'DRIVER' && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setMostrarPanelConductor(true)}
              style={{ background: BRAND_GREEN, border: 'none', fontWeight: '700', cursor: 'pointer', color: '#fff', fontSize: '13px', padding: '8px 15px', borderRadius: '20px' }}>
              🚗 Panel Conductor
            </motion.button>
          )}

          {usuario?.role === 'ADMIN' && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/admin/conductores')}
              style={{ background: '#7c3aed', border: 'none', fontWeight: '700', cursor: 'pointer', color: '#fff', fontSize: '13px', padding: '8px 15px', borderRadius: '20px' }}>
              🛡️ Panel Admin
            </motion.button>
          )}

          {usuario?.role !== 'DRIVER' && usuario?.role !== 'ADMIN' && (
            <motion.button onClick={() => navigate('/registro-conductor')}
              style={{ background: BRAND_GREEN, border: 'none', fontWeight: '700', cursor: 'pointer', color: '#fff', fontSize: '13px', padding: '8px 15px', borderRadius: '20px' }}>
              Quiero ser conductor
            </motion.button>
          )}

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setMostrarPerfil(true)}
            style={{ border: '1px solid #ddd', borderRadius: '20px', padding: '5px 15px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>☰</span>
            <div style={{ background: '#eee', borderRadius: '50%', width: '25px', height: '25px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {usuario?.profile_photo_url
                ? <img src={usuario.profile_photo_url} alt="perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>👤</span>}
            </div>
          </motion.div>
        </div>
      </header>

      {/* MODAL ERROR DIRECCIÓN */}
      <AnimatePresence>
        {errorDireccion && (
          <ModalErrorDireccion
            textoDireccion={errorDireccion.campo === 'origen' ? busqueda.origen : busqueda.destino}
            onCerrar={() => setErrorDireccion(null)}
            onContinuar={handleContinuarConDireccionManual}
          />
        )}
      </AnimatePresence>

      {/* MODAL CONTRAOFERTA — SCRUM-80 */}
      <AnimatePresence>
        {modalContraoferta && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalContraoferta(null)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', zIndex: 3001, width: '360px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: 'Inter, sans-serif' }}>
              <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '17px' }}>💬 Enviar Contraoferta</h3>
              <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px' }}>
                Ingresa el precio que estás dispuesto a pagar por este viaje.
              </p>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: '700', fontSize: '15px' }}>$</span>
                <input
                  type="number"
                  placeholder="Ej: 45000"
                  value={precioContraoferta}
                  onChange={e => setPrecioContraoferta(e.target.value)}
                  min="1"
                  autoFocus
                  style={{ width: '100%', padding: '12px 12px 12px 28px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setModalContraoferta(null)}
                  style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={enviarContraoferta} disabled={enviandoContraoferta}
                  style={{ flex: 1, background: enviandoContraoferta ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: enviandoContraoferta ? 'not-allowed' : 'pointer' }}>
                  {enviandoContraoferta ? 'Enviando...' : 'Enviar oferta'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL RESUMEN VIAJE */}
      <AnimatePresence>
        {infoRuta && (
          <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }}
            style={{ position: 'absolute', bottom: '40px', left: '50%', backgroundColor: '#fff', padding: '20px 25px', borderRadius: '15px', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center', width: '380px' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Resumen del viaje</p>
            <h3 style={{ margin: '8px 0 4px', color: '#222' }}>{infoRuta.tiempo} · {infoRuta.distancia}</h3>
            {infoRuta.distancia === 'No disponible' && (
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#f59e0b' }}>
                ⚠️ No se pudo trazar la ruta exacta, pero el viaje se publicará con las direcciones ingresadas.
              </p>
            )}
            <button onClick={crearViaje} disabled={enviandoSolicitud}
              style={{ background: enviandoSolicitud ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: enviandoSolicitud ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%' }}>
              {enviandoSolicitud ? 'Procesando...' : 'Confirmar y Publicar Viaje'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PANEL LATERAL MIS VIAJES */}
      <AnimatePresence>
        {mostrarMisSolicitudes && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, right: 0, width: '420px', maxWidth: '100%', height: '100vh', backgroundColor: '#fff', zIndex: 2001, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {viajeSeleccionado && (
                    <button onClick={() => setViajeSeleccionado(null)} style={{ border: 'none', background: '#e2e8f0', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>←</button>
                  )}
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{viajeSeleccionado ? 'Ofertas del viaje' : 'Mis Viajes'}</h2>
                </div>
                <button onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>
              {/* PESTAÑAS */}
              {!viajeSeleccionado && (
                <div style={{ display: 'flex', padding: '0 16px 12px', gap: '8px', borderBottom: '1px solid #eee', backgroundColor: '#f8fafc' }}>
                  {[
                    { id: 'activos', label: '⏳ En búsqueda', count: listaSolicitudes.length },
                    { id: 'confirmados', label: '✅ Confirmados', count: viajesConfirmados.length }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setPestanaViajes(tab.id)}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', transition: 'all 0.2s',
                        backgroundColor: pestanaViajes === tab.id ? BRAND_GREEN : '#e2e8f0',
                        color: pestanaViajes === tab.id ? '#fff' : '#475569' }}>
                      {tab.label}
                      {tab.count > 0 && <span style={{ marginLeft: '5px', background: 'rgba(0,0,0,0.15)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{tab.count}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

                {/* PESTAÑA: EN BÚSQUEDA */}
                {!viajeSeleccionado && pestanaViajes === 'activos' && listaSolicitudes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px', opacity: 0.7 }}>
                      <rect x="10" y="30" width="100" height="48" rx="10" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5"/>
                      <rect x="22" y="42" width="36" height="6" rx="3" fill="#86efac"/>
                      <rect x="22" y="54" width="24" height="4" rx="2" fill="#d1fae5"/>
                      <circle cx="88" cy="52" r="12" fill="#22c55e" opacity="0.15" stroke="#22c55e" strokeWidth="1.5"/>
                      <path d="M83 52 L87 56 L93 48" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="30" cy="16" r="8" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
                      <path d="M27 16 L29.5 18.5 L33 13" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="60" cy="10" r="5" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1"/>
                      <circle cx="90" cy="18" r="6" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
                    </svg>
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Sin viajes activos</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Busca una ruta en el mapa y<br/>publica tu primer viaje.</p>
                  </div>
                )}
                {!viajeSeleccionado && pestanaViajes === 'activos' && listaSolicitudes.map((viaje) => (
                  <div key={viaje.id} onClick={() => setViajeSeleccionado(viaje)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '15px', cursor: 'pointer', backgroundColor: viaje.ofertas.length > 0 ? '#f0fdf4' : '#fff', borderLeft: viaje.ofertas.length > 0 ? `4px solid ${BRAND_GREEN}` : '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{viaje.fechaCreacion}</span>
                      <span style={{ color: viaje.ofertas.length > 0 ? BRAND_GREEN : '#ca8a04', fontSize: '12px', fontWeight: 'bold' }}>
                        {viaje.ofertas.length > 0 ? `🎉 ${viaje.ofertas.length} Oferta(s)` : '⏳ ' + viaje.estado}
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px', marginBottom: '5px' }}>
                      {viaje.origin} <span style={{ color: BRAND_GREEN }}>→</span> {viaje.destination}
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '5px' }}>🗓️ Salida: {new Date(viaje.departure_time).toLocaleString()}</div>
                    <div style={{ fontSize: '13px', color: '#555' }}>👥 {viaje.seats_needed} asientos solicitados</div>
                  </div>
                ))}

                {/* PESTAÑA: CONFIRMADOS */}
                {!viajeSeleccionado && pestanaViajes === 'confirmados' && viajesConfirmados.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px', opacity: 0.7 }}>
                      <rect x="15" y="38" width="90" height="38" rx="8" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5"/>
                      <rect x="15" y="44" width="90" height="12" rx="0" fill="#dcfce7" opacity="0.5"/>
                      <circle cx="28" cy="62" r="7" fill="#fff" stroke="#86efac" strokeWidth="2"/>
                      <circle cx="92" cy="62" r="7" fill="#fff" stroke="#86efac" strokeWidth="2"/>
                      <rect x="38" y="32" width="16" height="10" rx="3" fill="#86efac"/>
                      <rect x="66" y="32" width="16" height="10" rx="3" fill="#86efac"/>
                      <path d="M50 20 Q60 10 70 20" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 3"/>
                      <circle cx="60" cy="20" r="4" fill="#22c55e" opacity="0.3"/>
                    </svg>
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Sin viajes confirmados</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Cuando un conductor acepte<br/>tu oferta aparecerá aquí.</p>
                  </div>
                )}
                {!viajeSeleccionado && pestanaViajes === 'confirmados' && viajesConfirmados.map((viaje) => {
                  const cfgEstadoViaje = {
                    ASSIGNED:    { border: BRAND_GREEN, bg: '#f0fdf4', badgeBg: '#dcfce7', badgeColor: '#166534', badgeLabel: '✅ Confirmado', info: 'El conductor está listo para recogerte.' },
                    IN_PROGRESS: { border: '#2563eb',   bg: '#eff6ff', badgeBg: '#dbeafe', badgeColor: '#1e40af', badgeLabel: '🚗 En camino', info: '¡Tu conductor está en camino!' },
                    COMPLETED:   { border: '#7c3aed',   bg: '#f5f3ff', badgeBg: '#e0e7ff', badgeColor: '#3730a3', badgeLabel: '🏁 Completado', info: 'Viaje finalizado exitosamente.' },
                  };
                  const cfg = cfgEstadoViaje[viaje.trip_status] || cfgEstadoViaje.ASSIGNED;
                  const esEnCurso = viaje.trip_status === 'IN_PROGRESS';

                  return (
                    <div key={viaje.id}
                      style={{ border: `1px solid ${cfg.border}`, borderRadius: '12px', padding: '16px', marginBottom: '15px', backgroundColor: cfg.bg, borderLeft: `4px solid ${cfg.border}`, transition: 'all 0.3s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{viaje.fechaCreacion}</span>
                        <span style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {cfg.badgeLabel}
                          {esEnCurso && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                          )}
                        </span>
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px', marginBottom: '6px' }}>
                        {viaje.origin} <span style={{ color: cfg.border }}>→</span> {viaje.destination}
                      </div>
                      <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>🗓️ Salida: {new Date(viaje.departure_time).toLocaleString()}</div>
                      <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>👥 {viaje.seats_needed} asiento(s)</div>
                      {/* Info estado */}
                      <div style={{ backgroundColor: cfg.badgeBg, borderRadius: '6px', padding: '7px 10px', marginBottom: '10px', fontSize: '12px', color: cfg.badgeColor, fontWeight: '600' }}>
                        {cfg.info}
                      </div>

                      {/* Barra de progreso del viaje */}
                      {(() => {
                        const pasos = [
                          { key: 'ASSIGNED',    label: 'Confirmado' },
                          { key: 'IN_PROGRESS', label: 'En camino' },
                          { key: 'COMPLETED',   label: 'Completado' },
                        ];
                        const idxActual = pasos.findIndex(p => p.key === viaje.trip_status);
                        return (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
                              {pasos.map((paso, idx) => {
                                const activo = idx <= idxActual;
                                const esCurrent = idx === idxActual;
                                return (
                                  <div key={paso.key} style={{ display: 'flex', alignItems: 'center', flex: idx < pasos.length - 1 ? 1 : 'none' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                      <div style={{
                                        width: esCurrent ? '20px' : '14px',
                                        height: esCurrent ? '20px' : '14px',
                                        borderRadius: '50%',
                                        backgroundColor: activo ? cfg.border : '#e2e8f0',
                                        border: esCurrent ? `3px solid ${cfg.border}` : 'none',
                                        boxShadow: esCurrent ? `0 0 0 3px ${cfg.border}22` : 'none',
                                        transition: 'all 0.3s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                      }}>
                                        {activo && !esCurrent && <span style={{ color: '#fff', fontSize: '8px', fontWeight: '700' }}>✓</span>}
                                      </div>
                                      <span style={{ fontSize: '9px', fontWeight: '600', color: activo ? cfg.badgeColor : '#94a3b8', whiteSpace: 'nowrap' }}>{paso.label}</span>
                                    </div>
                                    {idx < pasos.length - 1 && (
                                      <div style={{ flex: 1, height: '3px', backgroundColor: idx < idxActual ? cfg.border : '#e2e8f0', margin: '0 4px', marginBottom: '14px', borderRadius: '2px', transition: 'background-color 0.3s' }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Info conductor */}
                      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '10px 12px', border: `1px solid ${cfg.border}33`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                          {viaje.conductor_foto
                            ? <img src={viaje.conductor_foto} alt="conductor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : '🚗'}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{viaje.conductor_nombre}</p>
                          {viaje.precio_acordado > 0 && (
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                              Precio acordado: <strong style={{ color: BRAND_GREEN }}>${Number(viaje.precio_acordado).toLocaleString()}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                    {/* Botón FUEC */}
                    {(viaje.trip_status === 'ASSIGNED' || viaje.trip_status === 'IN_PROGRESS') && (
                      <button
                        onClick={() => {
                          setOcupantesFuec([{ full_name: '', document_type: 'CC', document_number: '' }]);
                          setModalFuec(viaje.id);
                        }}
                        style={{
                          marginTop: '10px', width: '100%', padding: '10px',
                          background: fuecEnviado[viaje.id] ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                          border: `1px solid ${fuecEnviado[viaje.id] ? BRAND_GREEN : 'rgba(34,197,94,0.35)'}`,
                          borderRadius: '8px',
                          color: fuecEnviado[viaje.id] ? BRAND_GREEN : '#166534',
                          fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                        {fuecEnviado[viaje.id] ? '✅ Ocupantes registrados — Actualizar' : '📋 Registrar ocupantes del viaje'}
                      </button>
                    )}
                    </div>
                  );
                })}

                {viajeSeleccionado && (
                  <div>
                    <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #cbd5e1' }}>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>{viajeSeleccionado.origin} a {viajeSeleccionado.destination}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>Salida: {new Date(viajeSeleccionado.departure_time).toLocaleString()}</div>
                    </div>
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
                        <div key={oferta.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px' }}>👤</div>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{oferta.conductor} <span style={{ color: '#eab308', fontSize: '13px' }}>★ {oferta.calificacion}</span></div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{oferta.vehiculo}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '18px', color: BRAND_GREEN }}>${oferta.precio.toLocaleString()}</div>
                          </div>
                          {oferta.created_at && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>🕐 Oferta enviada {tiempoRelativo(oferta.created_at)}</div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                            <button onClick={() => handleAceptarOferta(viajeActualizado.id, oferta.id)} style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar</button>
                            <button onClick={() => handleContraoferta(viajeActualizado.id, oferta.id)} style={{ flex: 1, background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Contra ofertar</button>
                            <button onClick={() => handleRechazarOferta(viajeActualizado.id, oferta.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
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

      {/* PANEL CONDUCTOR DRAWER */}
      <AnimatePresence>
        {mostrarPanelConductor && usuario?.role === 'DRIVER' && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMostrarPanelConductor(false)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, right: 0, width: '420px', maxWidth: '100%', height: '100vh', zIndex: 2001, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: '16px', left: '-44px', zIndex: 1 }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMostrarPanelConductor(false)}
                  style={{ background: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </motion.button>
              </div>
              <PanelConductor onVerRuta={(origen, destino) => {
                trazarRutaConductor(origen, destino);
                setMostrarPanelConductor(false);
              }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PANEL NOTIFICACIONES — SCRUM-91 */}
      <AnimatePresence>
        {mostrarNotificaciones && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMostrarNotificaciones(false)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000 }} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, left: 0, width: '380px', maxWidth: '100%', height: '100vh', backgroundColor: '#fff', zIndex: 2001, boxShadow: '5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

              {/* Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>🔔 Notificaciones</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {notificaciones.filter(n => !n.is_read).length} sin leer
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {notificaciones.filter(n => !n.is_read).length > 0 && (
                    <button onClick={marcarTodasLeidas}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                      ✓ Leer todas
                    </button>
                  )}
                  <button onClick={() => setMostrarNotificaciones(false)}
                    style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {notificaciones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔕</div>
                    <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>Sin notificaciones</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Las notificaciones aparecerán aquí.</p>
                  </div>
                )}
                {notificaciones.map((notif) => {
                  const cfgTipo = {
                    NEW_OFFER:     { icono: '💰', color: '#7c3aed', bg: '#f5f3ff' },
                    COUNTER_OFFER: { icono: '🔄', color: '#1d4ed8', bg: '#eff6ff' },
                    TRIP_ACCEPTED: { icono: '✅', color: '#15803d', bg: '#f0fdf4' },
                    TRIP_REJECTED: { icono: '❌', color: '#dc2626', bg: '#fef2f2' },
                    TRIP_STARTED:  { icono: '🚗', color: '#0369a1', bg: '#f0f9ff' },
                    TRIP_COMPLETED:{ icono: '🏁', color: '#4f46e5', bg: '#eef2ff' },
                    SYSTEM:        { icono: '📢', color: '#64748b', bg: '#f8fafc' },
                  };
                  const cfg = cfgTipo[notif.type] || cfgTipo.SYSTEM;
                  return (
                    <div key={notif.notification_id}
                      onClick={() => !notif.is_read && marcarLeida(notif.notification_id)}
                      style={{ backgroundColor: notif.is_read ? '#fff' : cfg.bg, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', border: `1px solid ${notif.is_read ? '#e2e8f0' : cfg.color + '33'}`, cursor: notif.is_read ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>{cfg.icono}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <p style={{ margin: 0, fontWeight: notif.is_read ? '600' : '700', fontSize: '13px', color: notif.is_read ? '#475569' : '#1e293b' }}>
                              {notif.title}
                            </p>
                            {!notif.is_read && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0, marginTop: '3px' }} />
                            )}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>{notif.message}</p>
                          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(notif.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL FUEC — HU10 */}
      <AnimatePresence>
        {modalFuec && (
          <>
            {/* Backdrop — fixed para cubrir toda la pantalla */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalFuec(null)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9000 }} />

            {/* Wrapper centrador — fixed con flex centra sin transform */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{
                pointerEvents: 'all',
                width: '500px', maxWidth: '95vw',
                maxHeight: '85vh',
                backgroundColor: '#081208',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex',
                flexDirection: 'column',
              }}>

              {/* HEADER — fijo arriba */}
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid rgba(34,197,94,0.12)', flexShrink: 0, backgroundColor: '#0a1a0a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: BRAND_GREEN }}>Documento de viaje</p>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#f0fdf4', fontFamily: "'Syne', sans-serif" }}>Registrar ocupantes</h3>
                  </div>
                  <button onClick={() => setModalFuec(null)}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '30px', height: '30px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                  Ingresa el nombre y documento de cada persona que viajará.
                </p>
              </div>

              {/* CONTENIDO — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', backgroundColor: '#081208' }}>
                {ocupantesFuec.map((ocupante, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>Ocupante {idx + 1}</span>
                      {ocupantesFuec.length > 1 && (
                        <button onClick={() => quitarOcupante(idx)}
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', fontSize: '11px', padding: '3px 8px', fontWeight: '600' }}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px', gap: '8px', minWidth: 0 }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '5px' }}>Nombre completo</label>
                        <input value={ocupante.full_name}
                          onChange={e => actualizarOcupante(idx, 'full_name', e.target.value)}
                          placeholder="Juan Pérez"
                          className="fuec-input" style={{}} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '5px' }}>Tipo</label>
                        <select value={ocupante.document_type}
                          onChange={e => actualizarOcupante(idx, 'document_type', e.target.value)}
                          className="fuec-select" style={{}}>
                          <option value="CC">CC</option>
                          <option value="TI">TI</option>
                          <option value="CE">CE</option>
                          <option value="PA">PA</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '5px' }}>Número</label>
                        <input value={ocupante.document_number}
                          onChange={e => actualizarOcupante(idx, 'document_number', e.target.value)}
                          placeholder="1234567890"
                          className="fuec-input" style={{}} />
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={agregarOcupante}
                  style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed rgba(34,197,94,0.3)', borderRadius: '10px', color: BRAND_GREEN, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                  + Agregar otro ocupante
                </button>
              </div>

              {/* FOOTER — fijo abajo, siempre visible */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(34,197,94,0.12)', flexShrink: 0, display: 'flex', gap: '10px', backgroundColor: '#0a1a0a' }}>
                <button onClick={() => setModalFuec(null)}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={enviarFuec} disabled={enviandoFuec}
                  style={{ flex: 2, padding: '12px', background: enviandoFuec ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${BRAND_GREEN}, #16a34a)`, border: 'none', borderRadius: '9px', color: enviandoFuec ? 'rgba(255,255,255,0.4)' : '#052e16', fontWeight: '700', fontSize: '14px', cursor: enviandoFuec ? 'not-allowed' : 'pointer', fontFamily: "'Syne', sans-serif" }}>
                  {enviandoFuec ? 'Guardando...' : '✓ Confirmar ocupantes'}
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* PERFIL DRAWER — HU16 */}
      <PerfilDrawer abierto={mostrarPerfil} onCerrar={() => setMostrarPerfil(false)} />

      {/* MAPA */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <MapContainer center={[4.6097, -74.0817]} zoom={6} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          {datosMapa.origen && <Marker position={datosMapa.origen}><Popup>Origen</Popup></Marker>}
          {datosMapa.destino && <Marker position={datosMapa.destino}><Popup>Destino</Popup></Marker>}
          {datosMapa.ruta.length > 0 && <Polyline positions={datosMapa.ruta} color={BRAND_GREEN} weight={4} />}
          <AjustarCamara coordenadas={{ origen: datosMapa.origen, destino: datosMapa.destino }} />
        </MapContainer>
      </div>
    </div>
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default Dashboard;
