import { useState, useEffect, useContext, useRef, useCallback } from 'react';
const IconIdea = (p) => <IconTrazo {...p}><path d="M9.5 17.5h5M10.5 20.5h3" /><path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6H9.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5Z" /></IconTrazo>;
import { motion, AnimatePresence } from 'framer-motion';
import logoTurify from './logo.png';
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import PanelConductor from './PanelConductor';
import AdminConductores from './Adminconductores';
import InputDireccion from './InputDireccion';
import SelectorFechaHora from './SelectorFechaHora';
import PerfilDrawer from './PerfilDrawer';
import { ToastContainer, useToast } from './Toast';
import { SkeletonDashboard, SkeletonTarjetaConfirmado, ErrorConexion } from './Skeleton';

const BRAND_GREEN = T.ruta;
import API_BASE_URL from './api';
import {
  T, EstilosBase, TableroRuta, Icono,
  IconReloj, IconVisto, IconBandera, IconAuto, IconCalendario, IconPersonas,
  IconRadar, IconRecibo, IconEstrella, IconClipboard, IconEquis, IconFlecha,
  IconAlerta, IconGorro, IconPin, IconPersona, IconRecibo as _IconRecibo,
  MarcaTurify, LogoWordmark, BotonTema, useTema,
} from './diseno';

// Librerias de Google Maps que necesitamos: 'places' para el autocompletar de InputDireccion,
// 'geometry' para decodificar el polyline que devuelve el Directions Service.
// OJO: este array debe ser una constante estable (fuera del componente) — si se recrea en
// cada render, useJsApiLoader vuelve a montar el script y Google Maps tira warnings/errores.
const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;


// ─────────────────────────────────────────────────────────────────────────────
//  MAPA EN MODO OSCURO — no es el "dark" genérico de Google: el suelo y el agua
//  se llevan al verde monte de la marca, y las vías quedan apenas más claras que
//  el fondo para que la ruta verde siga siendo lo que más resalta.
// ─────────────────────────────────────────────────────────────────────────────
const MAPA_OSCURO = [
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

const mapContainerStyle = { width: '100%', height: '100%' };
const centroDefaultColombia = { lat: 4.6097, lng: -74.0817 };

// Iconos, tokens y componentes compartidos viven en ./diseno — un solo lugar.
const IconTrazo = Icono;

const ModalErrorDireccion = ({ textoDireccion, onCerrar, onContinuar }) => (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCerrar}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(14,42,30,0.52)', zIndex: 3000 }} />
    <motion.div initial={{ opacity: 0, scale: 0.92, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -20 }}
      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--t-papel)', borderRadius: '16px', padding: '28px', zIndex: 3001, boxShadow: '0 20px 50px rgba(0,0,0,0.18)', width: '390px', fontFamily: T.ui }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <span style={{ display: 'inline-flex', color: 'var(--t-chiva-texto)' }}><IconPin size={34} /></span>
        <h3 style={{ margin: '10px 0 4px', color: 'var(--t-tinta)', fontSize: '17px' }}>No encontramos "{textoDireccion}"</h3>
        <p style={{ margin: 0, color: 'var(--t-piedra)', fontSize: '13px' }}>
          Esta dirección no está en el mapa, pero puedes usarla igual — el conductor verá exactamente lo que escribiste.
        </p>
      </div>
      <button onClick={onContinuar}
        style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', padding: '13px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <IconVisto size={15} />Continuar con esta dirección
      </button>
      <button onClick={onCerrar}
        style={{ width: '100%', background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: '1px solid var(--t-linea)', padding: '11px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>
        Quiero corregir la dirección
      </button>
      <div style={{ backgroundColor: 'var(--t-niebla)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--t-linea)' }}>
        <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: 'var(--t-piedra)', display: 'flex', alignItems: 'center', gap: '6px' }}><IconIdea size={13} />Para mejor precisión en el mapa, probá con:</p>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: 'var(--t-piedra)', lineHeight: '2' }}>
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

  // Carga el script de Google Maps JS SDK una sola vez para todo el Dashboard
  // (InputDireccion reutiliza este mismo `isLoaded` via prop, no vuelve a cargar el script)
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const mapRef = useRef(null);
  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  const [tipoViaje, setTipoViaje] = useState('ida');
  const [busqueda, setBusqueda] = useState({ origen: '', destino: '', departure_time: '', return_time: '' });
  const [mostrarPasajeros, setMostrarPasajeros] = useState(false);
  const [pasajeros, setPasajeros] = useState({ adultos: 1, ninos: 0, mascotas: false });
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [datosMapa, setDatosMapa] = useState({ origen: null, destino: null, ruta: [] });
  // HU09 — la búsqueda de conductores es automática (por origen del viaje, con
  // radio ampliable), ya no la elige el pasajero.
  // HU38 — comodidades que el pasajero puede exigir del vehículo al publicar el viaje
  const [comodidadesFiltro, setComodidadesFiltro] = useState({
    tiene_ac: false, tiene_wifi: false, tiene_bano: false, tiene_musica: false,
    tiene_maletero_amplio: false, tiene_sillas_bebe: false, acepta_mascotas: false,
  });
  const [infoRuta, setInfoRuta] = useState(null);

  // Equivalente al viejo <AjustarCamara> de Leaflet: cuando hay origen y destino, encuadra ambos;
  // si solo hay origen (ej. geolocalizacion inicial), centra ahi con zoom de calle.
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (datosMapa.origen && datosMapa.destino) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(datosMapa.origen);
      bounds.extend(datosMapa.destino);
      mapRef.current.fitBounds(bounds, 50);
    } else if (datosMapa.origen) {
      mapRef.current.panTo(datosMapa.origen);
      mapRef.current.setZoom(15);
    }
  }, [datosMapa.origen, datosMapa.destino]);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mostrarMisSolicitudes, setMostrarMisSolicitudes] = useState(false);
  const [listaSolicitudes, setListaSolicitudes] = useState([]);
  const [viajesConfirmados, setViajesConfirmados] = useState([]);
  const [pestanaViajes, setPestanaViajes] = useState('activos'); // 'activos' | 'confirmados' | 'completados'
  const [tema, alternarTema] = useTema();
  const [confirmandoCancelarId, setConfirmandoCancelarId] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [actualizandoViajes, setActualizandoViajes] = useState(false);

  // HU21 — Perfil público del conductor: se abre en una pestaña nueva
  // (página aparte), no como modal encima del dashboard.
  const abrirPerfilConductor = (driverId) => {
    if (!driverId) return;
    window.open(`/conductor/${driverId}`, '_blank', 'noopener,noreferrer');
  };
  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [modalFuec, setModalFuec] = useState(null); // request_id del viaje a registrar
  // HU29 — Calificaciones bidireccionales
  const [modalCalificar, setModalCalificar] = useState(null); // request_id del viaje a calificar
  const [estrellasCalificar, setEstrellasCalificar] = useState(0);
  const [comentarioCalificar, setComentarioCalificar] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [ocupantesFuec, setOcupantesFuec] = useState([{ full_name: '', document_type: 'CC', document_number: '' }]);
  const [enviandoFuec, setEnviandoFuec] = useState(false);
  const [fuecEnviado, setFuecEnviado] = useState({}); // { request_id: true } para saber cuáles ya se registraron
  const [errorDireccion, setErrorDireccion] = useState(null);
  const coordsBuffer = useRef({});

  // Bounding box aproximado de Antioquia — se usa como sesgo (no como filtro estricto) para
  // que direcciones ambiguas como "Cl 35b" (sin ciudad/departamento) se resuelvan dentro de
  // Antioquia en vez de en cualquier otra parte de Colombia donde exista una calle con ese
  // mismo nombre (ej. Cali). Google respeta esto como preferencia, no descarta resultados
  // fuera de esta zona si el texto realmente apunta a otro lugar.
  const BOUNDS_ANTIOQUIA = { south: 5.4, west: -77.2, north: 8.9, east: -73.9 };

  // Geocodificar texto → coords usando Google Geocoding (via el SDK de JS, sin llamadas REST directas).
  // Solo Google — sin respaldo de otro proveedor. Se deja el console.warn con el status real de
  // Google para poder diagnosticar rápido si una búsqueda puntual falla (REQUEST_DENIED, ZERO_RESULTS, etc.).
  const geocodificar = (texto) => {
    if (!mapsLoaded || !window.google) return Promise.resolve(null);
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode(
        {
          address: `${texto}, Colombia`,
          componentRestrictions: { country: 'co' },
          bounds: new window.google.maps.LatLngBounds(
            { lat: BOUNDS_ANTIOQUIA.south, lng: BOUNDS_ANTIOQUIA.west },
            { lat: BOUNDS_ANTIOQUIA.north, lng: BOUNDS_ANTIOQUIA.east }
          ),
        },
        (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lon: loc.lng() });
          } else {
            console.warn(`[Geocoding] Google no encontró "${texto}" — status: ${status}`);
            resolve(null);
          }
        }
      );
    });
  };

  // Geocodificacion inversa (coords → texto de direccion) usando Google Geocoding — solo Google.
  const geocodificarInverso = (lat, lng) => {
    if (!mapsLoaded || !window.google) return Promise.resolve(null);
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          resolve(results[0].formatted_address);
        } else {
          console.warn(`[Geocoding] Google no pudo revertir (${lat},${lng}) — status: ${status}`);
          resolve(null);
        }
      });
    });
  };

  useEffect(() => {
    if (!mapsLoaded) return; // esperamos a que cargue el SDK de Google Maps antes de geocodificar
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDatosMapa(prev => ({ ...prev, origen: { lat: latitude, lng: longitude } }));
        try {
          const direccion = await geocodificarInverso(latitude, longitude);
          setBusqueda(prev => ({ ...prev, origen: direccion || 'Mi ubicación' }));
        } catch {
          setBusqueda(prev => ({ ...prev, origen: 'Mi ubicación' }));
        }
      }, () => console.log('El usuario denegó la ubicación'));
    }
  }, [mapsLoaded]);

  const handleBusqueda = (e) => setBusqueda(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleUbicacionActual = ({ texto, coords }) => {
    // coords llega como [lat, lng] desde InputDireccion — lo convertimos al formato {lat, lng} de Google
    setDatosMapa(prev => ({ ...prev, origen: { lat: coords[0], lng: coords[1] } }));
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

  // Trazar ruta con Google Directions Service (via SDK JS, no REST directo — evita problemas de CORS)
  // Ademas de distancia/tiempo, arma un objeto `datosRutaParaPrecio` con la info que el motor de
  // precio sugerido va a necesitar (distancia, duracion, si la ruta pasa por peajes segun los pasos
  // de la ruta, y un texto de resumen de vias). El costo exacto de peajes no lo entrega el Directions
  // Service clasico — para eso Google tiene la Routes API (REST, computeRoutes con extraComputations:
  // TOLLS), que habria que llamar desde el backend porque necesita otra API habilitada y facturación
  // aparte. Por ahora dejamos `tieneEstimacionPeajes: false` como marcador para esa integración futura.
  const trazarRutaConCoords = (lat1, lon1, lat2, lon2) => {
    if (!mapsLoaded || !window.google) {
      toast.error('El mapa todavía se está cargando, intenta de nuevo en un momento.');
      return Promise.resolve(null);
    }
    const directionsService = new window.google.maps.DirectionsService();
    return new Promise((resolve) => {
      directionsService.route(
        {
          origin: { lat: lat1, lng: lon1 },
          destination: { lat: lat2, lng: lon2 },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result?.routes?.[0]) {
            const ruta = result.routes[0];
            const leg = ruta.legs[0];
            const pathDecodificado = window.google.maps.geometry.encoding
              .decodePath(ruta.overview_polyline)
              .map(p => ({ lat: p.lat(), lng: p.lng() }));

            // Heuristica simple de tipo de via a partir de las instrucciones de cada paso
            // (util como señal para el motor de precio mientras no tengamos la Routes API con peajes)
            const instrucciones = leg.steps.map(s => s.instructions || '').join(' ').toLowerCase();
            const posibleTrocha = /trocha|sin pavimentar|camino rural|unnamed road/.test(instrucciones);

            setDatosMapa({
              origen: { lat: lat1, lng: lon1 },
              destino: { lat: lat2, lng: lon2 },
              ruta: pathDecodificado,
            });
            setInfoRuta({
              distancia: `${(leg.distance.value / 1000).toFixed(1)} km`,
              tiempo: `${Math.round(leg.duration.value / 60)} min`,
              datosParaPrecio: {
                distancia_metros: leg.distance.value,
                duracion_segundos: leg.duration.value,
                posible_trocha: posibleTrocha,
                tiene_estimacion_peajes: false, // TODO: Routes API (backend) para costo real de peajes
              },
            });
            resolve(leg);
          } else {
            toast.warning('No se pudo trazar una ruta entre estas dos ubicaciones.');
            resolve(null);
          }
        }
      );
    });
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
        lat1 = datosMapa.origen.lat;
        lon1 = datosMapa.origen.lng;
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
        const lat1 = datosMapa.origen ? datosMapa.origen.lat : centroDefaultColombia.lat;
        const lon1 = datosMapa.origen ? datosMapa.origen.lng : centroDefaultColombia.lng;
        const coordsDes = await geocodificar(busqueda.destino);
        if (coordsDes) {
          setDatosMapa(prev => ({ ...prev, origen: { lat: lat1, lng: lon1 }, destino: { lat: coordsDes.lat, lng: coordsDes.lon } }));
          await trazarRutaConCoords(lat1, lon1, coordsDes.lat, coordsDes.lon);
        } else {
          setInfoRuta({ distancia: 'No disponible', tiempo: 'No disponible' });
        }
      } else {
        const { lat1, lon1 } = coordsBuffer.current;
        setDatosMapa(prev => ({ ...prev, origen: { lat: lat1, lng: lon1 } }));
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

      // Épica 2 (HU08) — distancia y tipo de vía salen de lo que YA calculó el Directions Service
      // clásico al trazar la ruta (sin llamada extra ni costo adicional). Los peajes NO se piden a
      // Google: la Routes API no tiene cobertura de precios de peajes en Colombia (solo EE.UU.,
      // Canadá, México, Brasil, Argentina, Australia, India, Indonesia y Japón por ahora), así que
      // pagar por ese dato no serviría de nada. El costo/existencia de peaje lo indicará el
      // conductor manualmente (pendiente de definir en qué paso del flujo).
      if (datosMapa.origen && datosMapa.destino) {
        payload.origin_lat = datosMapa.origen.lat;
        payload.origin_lng = datosMapa.origen.lng;
        payload.destination_lat = datosMapa.destino.lat;
        payload.destination_lng = datosMapa.destino.lng;
        const datosParaPrecio = infoRuta?.datosParaPrecio;
        if (datosParaPrecio) {
          payload.distance_km = Math.round((datosParaPrecio.distancia_metros / 1000) * 100) / 100;
          payload.tipo_via = datosParaPrecio.posible_trocha ? 'DESTAPADA' : 'PAVIMENTADA';
        }
      }

      // HU38 — comodidades que el pasajero exige del vehículo (filtro de búsqueda)
      payload.requiere_ac = comodidadesFiltro.tiene_ac;
      payload.requiere_wifi = comodidadesFiltro.tiene_wifi;
      payload.requiere_bano = comodidadesFiltro.tiene_bano;
      payload.requiere_musica = comodidadesFiltro.tiene_musica;
      payload.requiere_maletero_amplio = comodidadesFiltro.tiene_maletero_amplio;
      payload.requiere_sillas_bebe = comodidadesFiltro.tiene_sillas_bebe;
      payload.requiere_acepta_mascotas = comodidadesFiltro.acepta_mascotas;

      const res = await fetch(`${API_BASE_URL}/api/service-requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error al publicar el viaje'); }

      // HU09 — el filtro de comodidades (HU38) ya NO excluye a nadie de la
      // notificación inicial (es flexible: se avisa a todos los cercanos, y el
      // pasajero decide al ver las ofertas quién cumple qué). Si nadie fue
      // notificado es sencillamente porque no hay ningún conductor conectado
      // en este momento — no tiene que ver con los filtros elegidos.
      const data = await res.json().catch(() => null);
      const sinConductoresConectados = data && data.conductores_notificados === 0;
      if (sinConductoresConectados) {
        toast.warning('Publicado, pero no hay ningún conductor conectado en este momento. Tu viaje queda visible y te avisaremos apenas alguno se conecte.');
      }

      setInfoRuta(null);
      setDatosMapa({ origen: null, destino: null, ruta: [] });
      setComodidadesFiltro({ tiene_ac: false, tiene_wifi: false, tiene_bano: false, tiene_musica: false, tiene_maletero_amplio: false, tiene_sillas_bebe: false, acepta_mascotas: false });
      setBusqueda({ origen: '', destino: '', departure_time: '', return_time: '' });
      if (!sinConductoresConectados) {
        toast.success('¡Viaje publicado exitosamente! Los conductores podrán hacerte ofertas.');
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // Cargar notificaciones — carga inicial + Realtime (fallback a polling)
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
    if (!token || !usuario) return;
    cargarNotificaciones();

    // Supabase Realtime — escucha INSERT en Notification para este usuario
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = supabase
          .channel(`notif-dashboard-${usuario.user_id}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'Notification',
            filter: `user_id=eq.${usuario.user_id}`
          }, () => cargarNotificaciones())
          .subscribe();
        return () => supabase.removeChannel(channel);
      });
    } else {
      // Fallback polling si Supabase no configurado
      const intervalo = setInterval(cargarNotificaciones, 15000);
      return () => clearInterval(intervalo);
    }
  }, [token, usuario]);

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
      toast.success('Ocupantes registrados. El conductor ya puede ver la lista.');
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setEnviandoFuec(false);
    }
  };

  // HU29: Enviar calificación al conductor
  const enviarCalificacion = async () => {
    if (estrellasCalificar < 1) { toast.warning('Elige de 1 a 5 estrellas.'); return; }
    setEnviandoCalificacion(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${modalCalificar}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ score: estrellasCalificar, comment: comentarioCalificar || null })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      setViajesConfirmados(prev => prev.map(v => v.id === modalCalificar ? { ...v, ya_califico: true } : v));
      setModalCalificar(null);
      setEstrellasCalificar(0);
      setComentarioCalificar('');
      toast.success('Gracias por tu calificación.');
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  // HU25: Descargar recibo del viaje en PDF (SCRUM-190) — el endpoint requiere
  // Authorization, así que no se puede usar un <a href> plano: se pide el PDF como
  // blob autenticado y se dispara la descarga manualmente con un object URL.
  const [descargandoRecibo, setDescargandoRecibo] = useState(null); // request_id en descarga
  const descargarRecibo = async (requestId) => {
    setDescargandoRecibo(requestId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/receipt`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) {
        let detalle = 'No se pudo generar el recibo.';
        try { detalle = (await res.json()).detail || detalle; } catch {}
        throw new Error(detalle);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `turify_recibo_${requestId}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setDescargandoRecibo(null);
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
              driverId: o.driver_id,
              conductor: o.driver_name || `Conductor #${o.driver_id}`,
              foto: o.driver_photo || null,
              // HU21 — badge de experiencia verificada (RUNT aprobado por el admin)
              verificado: !!o.driver_verificado,
              // HU29 — calificación real (antes venía simulada); null si el conductor aún no tiene calificaciones
              calificacion: o.driver_rating ?? null,
              calificacionCantidad: o.driver_rating_count || 0,
              precio: o.offered_price,
              estado: o.status,
              // HU38 — comodidades y categoría del vehículo, y si es un buen ajuste para el grupo
              comodidades: o.comodidades || null,
              recomendado: !!o.recomendado
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
          created_at: v.created_at,
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
            trip_status: v.trip_status || v.status || 'ASSIGNED',
            // HU26 — tracking en tiempo real
            driver_id: v.driver_id || null,
            conductor_lat: v.conductor_lat ?? null,
            conductor_lng: v.conductor_lng ?? null,
            // HU29 — calificaciones
            ya_califico: v.ya_califico || false,
          })));
        }
      } catch {}

      setListaSolicitudes(viajesConOfertas);
    } catch (error) { console.error('Error al cargar los viajes:', error); }
  };

  // Botón "Actualizar" manual en "Mis Viajes" (En búsqueda / Confirmados) — refresca
  // ambas listas de una vez, ya que cargarMisViajes las trae juntas.
  const refrescarViajes = async () => {
    setActualizandoViajes(true);
    try {
      await cargarMisViajes();
    } finally {
      setActualizandoViajes(false);
    }
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

  // HU09 — el pasajero puede cancelar la búsqueda mientras el viaje sigue
  // pendiente (aún no aceptó ninguna oferta). Una vez cancelado, el backend lo
  // marca CANCELLED y ya no aparece en /pending, así que simplemente lo
  // quitamos de la lista local sin esperar al próximo refresco.
  const cancelarBusqueda = async (viajeId) => {
    setCancelandoId(viajeId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${viajeId}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'No se pudo cancelar la búsqueda.'); }
      setListaSolicitudes(prev => prev.filter(v => v.id !== viajeId));
      setViajeSeleccionado(prev => (prev && prev.id === viajeId ? null : prev));
      toast.success('Búsqueda cancelada.');
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setCancelandoId(null);
      setConfirmandoCancelarId(null);
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

    // Supabase Realtime — escucha UPDATE en ServiceRequest para este pasajero
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_ANON_KEY && usuario) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = supabase
          .channel(`viajes-pasajero-${usuario.user_id}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'ServiceRequest',
            filter: `passenger_id=eq.${usuario.user_id}`
          }, () => cargarMisViajes())
          .subscribe();
        return () => supabase.removeChannel(channel);
      });
    } else {
      // Fallback polling
      const intervaloViajes = setInterval(() => cargarMisViajes(), 15000);
      return () => clearInterval(intervaloViajes);
    }
  }, [token, usuario]);

  // HU26 — Tracking en tiempo real del conductor mientras el viaje está IN_PROGRESS.
  // Se suscribe (Supabase Realtime) a los cambios de ubicación del conductor asignado
  // y actualiza solo esa tarjeta, sin recargar toda la lista de viajes.
  useEffect(() => {
    const driverIdsEnCurso = viajesConfirmados
      .filter(v => v.trip_status === 'IN_PROGRESS' && v.driver_id)
      .map(v => v.driver_id);
    if (driverIdsEnCurso.length === 0) return;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    let cancelado = false;
    let canales = [];
    import('@supabase/supabase-js').then(({ createClient }) => {
      if (cancelado) return;
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      canales = driverIdsEnCurso.map(driverId =>
        supabase
          .channel(`tracking-conductor-${driverId}`)
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'User',
            filter: `user_id=eq.${driverId}`
          }, (payload) => {
            const { current_lat, current_lng } = payload.new || {};
            if (current_lat == null || current_lng == null) return;
            setViajesConfirmados(prev => prev.map(v =>
              v.driver_id === driverId ? { ...v, conductor_lat: current_lat, conductor_lng: current_lng } : v
            ));
          })
          .subscribe()
      );
    });

    return () => {
      cancelado = true;
      canales.forEach(ch => ch && ch.unsubscribe && ch.unsubscribe());
    };
  }, [JSON.stringify(viajesConfirmados.filter(v => v.trip_status === 'IN_PROGRESS').map(v => v.driver_id))]);

  // Tiempo relativo para ofertas
  const tiempoRelativo = (fechaStr) => {
    if (!fechaStr) return '';
    const diff = Math.floor((Date.now() - new Date(fechaStr).getTime()) / 1000);
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
  };

  // HU09 — a partir de cuánto tiempo sin ninguna oferta le avisamos al pasajero
  // que la búsqueda sigue en curso (útil sobre todo en veredas/zonas con pocos
  // conductores conectados, donde una respuesta puede tardar más).
  const MINUTOS_AVISO_SIN_OFERTAS = 15;
  const minutosTranscurridos = (fechaStr) => {
    if (!fechaStr) return 0;
    return Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000);
  };

  // ── Estilos del sidebar (rediseño HU05 — inspirado en el layout de Uber, pero
  // sin adoptar su paleta: el mapa deja de ser el fondo de toda la pantalla y pasa
  // a ser un panel contenido junto a un panel fijo con el formulario de búsqueda) ──
  const sidebarStyle = { width: '400px', minWidth: '400px', height: '100vh', backgroundColor: 'var(--t-niebla)', borderRight: '1px solid var(--t-linea)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative', zIndex: 500, overflowY: 'auto' };
  const sidebarTopStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px 8px' };
  const fieldBoxStyle = { display: 'flex', alignItems: 'center', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '11px 14px', backgroundColor: 'var(--t-papel)' };
  const fieldLabelStyle = { fontSize: '10px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '5px' };
  const dividerStyle = { height: '1px', width: '100%', background: 'var(--t-linea)', margin: '2px 0', flexShrink: 0 };
  const inputStyle = { border: 'none', outline: 'none', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--t-tinta)', fontFamily: T.ui };
  const navBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '11px 14px', fontWeight: '600', cursor: 'pointer', color: 'var(--t-tinta)', fontSize: '13px' };

  const SelectorPasajero = ({ titulo, subtitulo, tipo }) => {
    const deshabilitado = totalAsientos >= 44;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid var(--t-linea)' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--t-tinta)' }}>{titulo}</div>
          <div style={{ fontSize: '13px', color: 'var(--t-piedra)', marginTop: '2px' }}>{subtitulo}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => actualizarPasajeros(tipo, 'restar')} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--t-linea)', background: 'var(--t-papel)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-piedra)' }}>-</motion.button>
          <span style={{ width: '20px', textAlign: 'center', fontSize: '15px' }}>{pasajeros[tipo]}</span>
          <motion.button whileTap={!deshabilitado ? { scale: 0.9 } : {}} type="button" onClick={() => actualizarPasajeros(tipo, 'sumar')} disabled={deshabilitado} style={{ width: '30px', height: '30px', borderRadius: '50%', border: deshabilitado ? '1px solid #eee' : '1px solid #777', background: 'var(--t-papel)', cursor: deshabilitado ? 'not-allowed' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: deshabilitado ? 'var(--t-piedra-clara)' : 'var(--t-tinta)' }}>+</motion.button>
        </div>
      </div>
    );
  };

  // HU06 — Un conductor siempre ve el panel de conductor, no el dashboard de
  // pasajero con un botón para abrirlo aparte.
  if (usuario?.role === 'DRIVER') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh', background: 'var(--t-niebla)', padding: '14px', boxSizing: 'border-box' }}>
        <PanelConductor />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  // Un admin no necesita el mapa ni pedir un viaje — su "dashboard" es directamente
  // el panel de verificación de documentos.
  if (usuario?.role === 'ADMIN') {
    return <AdminConductores />;
  }

  // "Confirmados" y "Completados" ahora son pestañas separadas — antes
  // compartían una sola lista (ordenada por fecha de creación), así que un
  // historial largo de viajes completados terminaba empujando los viajes
  // activos hacia abajo y había que bajar a buscarlos.
  // "Confirmados": solo ASSIGNED/IN_PROGRESS, con el que está en curso ahora
  // mismo primero, y el resto por la salida más próxima — siempre arriba lo
  // que necesita tu atención ahora.
  const viajesActivosConfirmados = viajesConfirmados
    .filter(v => v.trip_status !== 'COMPLETED')
    .sort((a, b) => {
      if (a.trip_status === 'IN_PROGRESS' && b.trip_status !== 'IN_PROGRESS') return -1;
      if (b.trip_status === 'IN_PROGRESS' && a.trip_status !== 'IN_PROGRESS') return 1;
      return new Date(a.departure_time) - new Date(b.departure_time);
    });
  // "Completados": el historial, con el más reciente primero, en su propia pestaña.
  const viajesCompletadosOrdenados = viajesConfirmados
    .filter(v => v.trip_status === 'COMPLETED')
    .sort((a, b) => new Date(b.departure_time) - new Date(a.departure_time));

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
    <EstilosBase />
    <style>{`
      @keyframes girar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .fuec-input {
        width: 100%;
        padding: 9px 12px;
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: var(--t-musgo) !important;
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
        background: var(--t-monte-alto) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: var(--t-musgo) !important;
        font-size: 13px;
        outline: none;
        cursor: pointer;
        min-width: 0;
      }
      .fuec-select option { background: var(--t-monte-alto); color: var(--t-musgo); }

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

      /* ── PANEL "MIS VIAJES" — pasajes de viaje ── */
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.7); }
      }
      @keyframes ticket-entra {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .viaje-pasaje {
        position: relative;
        background: var(--t-papel);
        border-radius: 14px;
        margin-bottom: 16px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 8px 20px -12px rgba(0,0,0,0.25);
        border: 1px solid var(--t-linea);
        animation: ticket-entra 0.25s ease-out;
        overflow: hidden;
      }
      .viaje-pasaje__talon {
        position: relative;
        border-top: 1.5px dashed var(--t-linea);
        margin: 0 18px;
      }
      .viaje-pasaje__talon::before,
      .viaje-pasaje__talon::after {
        content: '';
        position: absolute;
        top: -9px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--t-niebla);
        border: 1px solid var(--t-linea);
      }
      .viaje-pasaje__talon::before { left: -27px; }
      .viaje-pasaje__talon::after { right: -27px; }
      .pestana-mv {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
        padding: 9px 4px;
        border-radius: 9px;
        border: none;
        cursor: pointer;
        font-weight: 700;
        font-size: 11.5px;
        font-family: 'DM Sans', sans-serif;
        letter-spacing: 0.01em;
        transition: background-color 0.18s, color 0.18s;
      }
    `}</style>
    <div style={{ height: '100vh', width: '100%', position: 'relative', fontFamily: T.ui, overflow: 'hidden', display: 'flex' }}>

      <aside style={sidebarStyle}>
        <div style={sidebarTopStyle}>
          {/* La barra tiene 400 px: cabe el nombre. La marca compacta se reserva
              para el favicon y las vistas angostas. */}
          <LogoWordmark alto={17} />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => { setMostrarNotificaciones(true); }}
              style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '35px', height: '35px', borderRadius: '50%', background: 'var(--t-papel)', border: '1px solid var(--t-linea)' }}>
              <Icono size={17} color="var(--t-piedra)">
                <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
              </Icono>
              <AnimatePresence>
                {notificaciones.filter(n => !n.is_read).length > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#C2410C', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #fff' }}>
                    {notificaciones.filter(n => !n.is_read).length}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setMostrarPerfil(true)}
              style={{ border: '1px solid var(--t-linea)', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--t-papel)' }}>
              <div style={{ background: 'var(--t-niebla-2)', borderRadius: '50%', width: '25px', height: '25px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {usuario?.profile_photo_url
                  ? <img src={usuario.profile_photo_url} alt="perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <IconPersona size={15} color="var(--t-piedra)" />}
              </div>
            </motion.div>
          </div>
        </div>

        <div style={{ padding: '10px 28px 24px' }}>
          <h2 style={{ margin: '4px 0 2px', fontSize: '20px', color: 'var(--t-tinta)', fontWeight: '700', fontFamily: T.display, letterSpacing: '-.01em' }}>¿A dónde viajas hoy?</h2>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--t-piedra)' }}>Publica tu viaje y te contactamos con conductores cerca.</p>

          <form onSubmit={buscarRuta} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button type="button" onClick={() => setTipoViaje('ida')} style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', backgroundColor: tipoViaje === 'ida' ? BRAND_GREEN : 'var(--t-papel)', color: tipoViaje === 'ida' ? '#fff' : 'var(--t-piedra)', border: tipoViaje === 'ida' ? 'none' : '1px solid var(--t-linea)', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Solo ida</button>
              <button type="button" onClick={() => setTipoViaje('redondo')} style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', backgroundColor: tipoViaje === 'redondo' ? BRAND_GREEN : 'var(--t-papel)', color: tipoViaje === 'redondo' ? '#fff' : 'var(--t-piedra)', border: tipoViaje === 'redondo' ? 'none' : '1px solid var(--t-linea)', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>Ida y vuelta</button>
            </div>
            <div style={dividerStyle} />
            <div style={fieldBoxStyle}>
              <div style={{ width: '100%' }}>
                <div style={fieldLabelStyle}>Origen</div>
                <InputDireccion name="origen" placeholder="¿Desde dónde sales?" value={busqueda.origen} onChange={handleBusqueda} esOrigen={true} onUbicacionActual={handleUbicacionActual} mapsLoaded={mapsLoaded} ancho="260px" />
              </div>
            </div>
            <div style={fieldBoxStyle}>
              <div style={{ width: '100%' }}>
                <div style={fieldLabelStyle}>Destino</div>
                <InputDireccion name="destino" placeholder="¿A dónde vas?" value={busqueda.destino} onChange={handleBusqueda} mapsLoaded={mapsLoaded} ancho="260px" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
              <SelectorFechaHora
                label="Salida"
                value={busqueda.departure_time}
                onChange={val => setBusqueda(prev => ({ ...prev, departure_time: val }))}
                placeholder="Fecha y hora de salida"
                required
              />
              <AnimatePresence>
                {tipoViaje === 'redondo' && (
                  <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} style={{ overflow: 'hidden', flexShrink: 0 }}>
                    <SelectorFechaHora
                      label="Regreso"
                      value={busqueda.return_time}
                      onChange={val => setBusqueda(prev => ({ ...prev, return_time: val }))}
                      min={busqueda.departure_time || undefined}
                      placeholder="Fecha y hora de regreso"
                      required={tipoViaje === 'redondo'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div style={{ position: 'relative' }}>
              <div onClick={() => setMostrarPasajeros(!mostrarPasajeros)} style={{ ...fieldBoxStyle, cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}>
                <div>
                  <div style={fieldLabelStyle}>Quién</div>
                  <span style={{ fontSize: '13px', color: 'var(--t-tinta)' }}>{textoViajeros}</span>
                </div>
                <span style={{ display: 'flex', color: 'var(--t-piedra-clara)' }}>
                  <IconTrazo size={14}><path d="M6 9.5l6 5.5 6-5.5" /></IconTrazo>
                </span>
              </div>
              <AnimatePresence>
                {mostrarPasajeros && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.2 }}
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--t-papel)', borderRadius: '16px', padding: '15px 20px', boxShadow: '0 8px 28px rgba(0,0,0,0.15)', zIndex: 2000, border: '1px solid var(--t-linea)' }}>
                    <SelectorPasajero titulo="Adultos" subtitulo="15 años o más" tipo="adultos" />
                    <SelectorPasajero titulo="Niños" subtitulo="Edades 0 – 14" tipo="ninos" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid var(--t-linea)' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--t-tinta)' }}>Mascotas</div>
                        <div style={{ fontSize: '13px', color: 'var(--t-piedra)', marginTop: '2px' }}>¿Traes mascota?</div>
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
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" style={{ background: BRAND_GREEN, border: 'none', borderRadius: '12px', padding: '13px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', marginTop: '4px' }}>
              {cargandoMapa ? 'Buscando ruta…' : <><IconRadar size={15} />Buscar ruta</>}
            </motion.button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '22px' }}>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => { cargarMisViajes(); setMostrarMisSolicitudes(true); }}
              style={navBtnStyle}>
              <IconClipboard size={15} />
              <span style={{ flex: 1 }}>Mis viajes</span>
              {listaSolicitudes.length > 0 && (
                <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {listaSolicitudes.reduce((acc, v) => acc + (v.ofertas?.length || 0), 0)}
                </span>
              )}
            </motion.button>

            {usuario?.role !== 'DRIVER' && usuario?.role !== 'ADMIN' && (
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => navigate('/registro-conductor')}
                style={{ ...navBtnStyle, background: BRAND_GREEN, border: 'none', color: '#fff' }}>
                <IconAuto size={15} /><span>Quiero ser conductor</span>
              </motion.button>
            )}
          </div>

          {/* Apariencia — el interruptor vive al pie de la barra, fuera del flujo
              de crear un viaje, para que no compita con la acción principal. */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--t-linea)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontFamily: T.dato, fontSize: '10px', letterSpacing: '.16em',
                           textTransform: 'uppercase', color: 'var(--t-piedra-clara)' }}>
              Apariencia
            </span>
            <BotonTema tema={tema} alternar={alternarTema} />
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, position: 'relative', padding: '16px 16px 16px 0', boxSizing: 'border-box' }}>

        {/* MAPA — Google Maps (@react-google-maps/api). Ya no es el fondo de toda la
            pantalla: es un panel contenido junto al sidebar de búsqueda. */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          {mapsLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={datosMapa.origen || centroDefaultColombia}
              zoom={datosMapa.origen ? 15 : 6}
              onLoad={onMapLoad}
              options={{ disableDefaultUI: true, zoomControl: true, styles: tema === 'oscuro' ? MAPA_OSCURO : undefined }}
            >
              {datosMapa.origen && <MarkerF position={datosMapa.origen} title="Origen" />}
              {datosMapa.destino && <MarkerF position={datosMapa.destino} title="Destino" />}
              {datosMapa.ruta.length > 0 && (
                <PolylineF path={datosMapa.ruta} options={{ strokeColor: BRAND_GREEN, strokeWeight: 4 }} />
              )}
            </GoogleMap>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--t-niebla-2)', color: 'var(--t-piedra-clara)', fontSize: '14px' }}>
              Cargando mapa...
            </div>
          )}

          {/* MODAL RESUMEN VIAJE — centrado sobre el panel del mapa, no sobre toda la pantalla */}
          <AnimatePresence>
            {infoRuta && (
              <motion.div initial={{ opacity: 0, y: 50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 50, x: '-50%' }}
                style={{ position: 'absolute', bottom: '24px', left: '50%', backgroundColor: 'var(--t-papel)', padding: '20px 25px', borderRadius: '15px', zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center', width: '380px', maxWidth: 'calc(100% - 32px)' }}>
                <p style={{ margin: 0, color: 'var(--t-piedra)', fontSize: '13px' }}>Resumen del viaje</p>
                <h3 style={{ margin: '8px 0 4px', color: 'var(--t-tinta)' }}>{infoRuta.tiempo} · {infoRuta.distancia}</h3>
                {infoRuta.distancia === 'No disponible' && (
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#f59e0b' }}>
                    <IconAlerta size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
                    No se pudo trazar la ruta exacta, pero el viaje se publicará con las direcciones que escribiste.
                  </p>
                )}

                {/* HU09 — la búsqueda de conductores es automática desde el origen del
                    viaje: empieza cerca y se amplía sola si no hay nadie disponible. */}
                <p style={{ margin: '0 0 12px', fontSize: '11px', color: 'var(--t-piedra)', textAlign: 'left' }}>
                  Buscamos automáticamente a los conductores disponibles más cercanos a tu origen.
                </p>

                {/* HU38 — Filtro de comodidades del vehículo */}
                <div style={{ textAlign: 'left', margin: '0 0 14px', padding: '10px 12px', background: 'var(--t-niebla)', border: '1px solid var(--t-linea)', borderRadius: '10px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ¿Necesitas alguna comodidad? (opcional)
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      ['tiene_ac', 'Aire acondicionado'],
                      ['tiene_wifi', 'WiFi'],
                      ['tiene_bano', 'Baño'],
                      ['tiene_musica', 'Música'],
                      ['tiene_maletero_amplio', 'Maletero amplio'],
                      ['tiene_sillas_bebe', 'Sillas para bebé'],
                      ['acepta_mascotas', 'Acepta mascotas'],
                    ].map(([campo, etiqueta]) => (
                      <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--t-tinta)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!comodidadesFiltro[campo]}
                          onChange={e => setComodidadesFiltro({ ...comodidadesFiltro, [campo]: e.target.checked })} />
                        {etiqueta}
                      </label>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '10.5px', color: 'var(--t-piedra-clara)' }}>
                    Solo se te notificarán ofertas de conductores cuyo vehículo cumpla lo que marques aquí.
                  </p>
                </div>

                <button onClick={crearViaje} disabled={enviandoSolicitud}
                  style={{ background: enviandoSolicitud ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: enviandoSolicitud ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%' }}>
                  {enviandoSolicitud ? 'Procesando...' : 'Confirmar y Publicar Viaje'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

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
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--t-papel)', borderRadius: '16px', padding: '28px', zIndex: 3001, width: '360px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: T.ui }}>
              <h3 style={{ margin: '0 0 8px', color: 'var(--t-tinta)', fontSize: '17px', fontFamily: T.display, fontWeight: 800, letterSpacing: '-.01em' }}>Enviar contraoferta</h3>
              <p style={{ margin: '0 0 20px', color: 'var(--t-piedra)', fontSize: '13px' }}>
                Ingresa el precio que estás dispuesto a pagar por este viaje.
              </p>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-piedra)', fontWeight: '700', fontSize: '15px' }}>$</span>
                <input
                  type="number"
                  placeholder="Ej: 45000"
                  value={precioContraoferta}
                  onChange={e => setPrecioContraoferta(e.target.value)}
                  min="1"
                  autoFocus
                  style={{ width: '100%', padding: '12px 12px 12px 28px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setModalContraoferta(null)}
                  style={{ flex: 1, background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={enviarContraoferta} disabled={enviandoContraoferta}
                  style={{ flex: 1, background: enviandoContraoferta ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: enviandoContraoferta ? 'not-allowed' : 'pointer' }}>
                  {enviandoContraoferta ? 'Enviando...' : 'Enviar oferta'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PANEL LATERAL MIS VIAJES */}
      <AnimatePresence>
        {mostrarMisSolicitudes && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(14,42,30,0.52)', zIndex: 2000 }} />
            <motion.div className="turify-panel-lateral" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, right: 0, width: '420px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--t-niebla)', zIndex: 2001, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--t-linea)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--t-papel)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {viajeSeleccionado && (
                    <button onClick={() => setViajeSeleccionado(null)} title="Volver"
                      style={{ border: '1px solid var(--t-linea)', background: 'var(--t-niebla)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-tinta)' }}>
                      <IconFlecha size={15} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--t-tinta)', fontFamily: T.display, letterSpacing: '-0.01em' }}>
                      {viajeSeleccionado ? 'Ofertas del viaje' : 'Mis viajes'}
                    </h2>
                    {viajeSeleccionado && (
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra-clara)' }}>{viajeSeleccionado.origin} → {viajeSeleccionado.destination}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => { setMostrarMisSolicitudes(false); setViajeSeleccionado(null); }} title="Cerrar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-piedra-clara)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconEquis size={17} />
                </button>
              </div>
              {/* PESTAÑAS */}
              {!viajeSeleccionado && (
                <div style={{ display: 'flex', padding: '12px 16px', gap: '6px', borderBottom: '1px solid var(--t-linea)', backgroundColor: 'var(--t-papel)' }}>
                  {[
                    { id: 'activos', label: 'Buscando', icon: IconReloj, count: listaSolicitudes.length },
                    { id: 'confirmados', label: 'Confirmados', icon: IconVisto, count: viajesActivosConfirmados.length },
                    { id: 'completados', label: 'Completados', icon: IconBandera, count: viajesCompletadosOrdenados.length }
                  ].map(tab => (
                    <button key={tab.id} className="pestana-mv" onClick={() => setPestanaViajes(tab.id)}
                      style={{
                        backgroundColor: pestanaViajes === tab.id ? BRAND_GREEN : 'var(--t-niebla-2)',
                        color: pestanaViajes === tab.id ? '#fff' : 'var(--t-piedra)' }}>
                      <tab.icon size={13} />
                      {tab.label}
                      {tab.count > 0 && <span style={{ background: pestanaViajes === tab.id ? 'rgba(255,255,255,0.28)' : 'var(--t-linea)', color: pestanaViajes === tab.id ? '#fff' : 'var(--t-piedra)', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{tab.count}</span>}
                    </button>
                  ))}
                  <button onClick={refrescarViajes} disabled={actualizandoViajes} title="Actualizar"
                    style={{ flexShrink: 0, width: '32px', borderRadius: '9px', border: '1px solid var(--t-linea)', background: 'var(--t-papel)', cursor: actualizandoViajes ? 'default' : 'pointer', color: 'var(--t-piedra)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconTrazo size={14} style={{ display: 'inline-flex', animation: actualizandoViajes ? 'girar 0.8s linear infinite' : 'none' }}>
                      <path d="M4 4v5h5" /><path d="M20 20v-5h-5" /><path d="M5.5 15A7.5 7.5 0 0 0 19 9.5" /><path d="M18.5 9A7.5 7.5 0 0 0 5 14.5" />
                    </IconTrazo>
                  </button>
                </div>
              )}
              <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>

                {/* PESTAÑA: EN BÚSQUEDA */}
                {!viajeSeleccionado && pestanaViajes === 'activos' && listaSolicitudes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--t-musgo)', border: '1px solid var(--t-musgo-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: BRAND_GREEN }}>
                      <IconRadar size={24} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '15px' }}>Sin viajes activos</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--t-piedra)', lineHeight: '1.5' }}>Busca una ruta en el mapa y<br/>publica tu primer viaje.</p>
                  </div>
                )}
                {!viajeSeleccionado && pestanaViajes === 'activos' && listaSolicitudes.map((viaje) => {
                  const avisoSinOfertas = viaje.ofertas.length === 0 && minutosTranscurridos(viaje.created_at) >= MINUTOS_AVISO_SIN_OFERTAS;
                  return (
                  <div key={viaje.id} onClick={() => setViajeSeleccionado(viaje)} className="viaje-pasaje" style={{ cursor: 'pointer', padding: '13px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <TableroRuta origen={viaje.origin} destino={viaje.destination} size={11} style={{ flex: 1 }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '8px', color: viaje.ofertas.length > 0 ? BRAND_GREEN : 'var(--t-chiva-texto)', fontSize: '11px', fontWeight: '700' }}>
                        {viaje.ofertas.length > 0
                          ? <><IconVisto size={12} />{viaje.ofertas.length}</>
                          : <IconReloj size={12} />}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--t-piedra-clara)' }}>
                      <IconCalendario size={11} />
                      <span>{new Date(viaje.departure_time).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ margin: '0 1px' }}>·</span>
                      <IconPersonas size={11} />
                      <span>{viaje.seats_needed}</span>
                    </div>

                    {avisoSinOfertas && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', fontSize: '11px', color: 'var(--t-chiva-texto)' }}>
                        <IconAlerta size={12} style={{ flexShrink: 0 }} />
                        <span>Seguimos buscando conductores en tu zona.</span>
                      </div>
                    )}

                    {/* Cancelar búsqueda — con confirmación inline, no window.confirm */}
                    {confirmandoCancelarId === viaje.id ? (
                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '9px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--t-alerta-texto)', flex: 1 }}>¿Cancelar?</span>
                        <button onClick={() => setConfirmandoCancelarId(null)} disabled={cancelandoId === viaje.id}
                          style={{ background: 'var(--t-papel)', color: 'var(--t-piedra)', border: '1px solid var(--t-linea)', borderRadius: '7px', padding: '4px 9px', fontSize: '10.5px', fontWeight: '600', cursor: 'pointer' }}>
                          No
                        </button>
                        <button onClick={() => cancelarBusqueda(viaje.id)} disabled={cancelandoId === viaje.id}
                          style={{ background: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', border: '1px solid var(--t-alerta-linea)', borderRadius: '7px', padding: '4px 9px', fontSize: '10.5px', fontWeight: '700', cursor: cancelandoId === viaje.id ? 'default' : 'pointer' }}>
                          {cancelandoId === viaje.id ? 'Cancelando…' : 'Sí, cancelar'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmandoCancelarId(viaje.id); }}
                          style={{ background: 'none', border: 'none', color: 'var(--t-piedra-clara)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: '2px 0' }}>
                          Cancelar búsqueda
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}

                {/* PESTAÑA: CONFIRMADOS */}
                {!viajeSeleccionado && pestanaViajes === 'confirmados' && viajesActivosConfirmados.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--t-musgo)', border: '1px solid var(--t-musgo-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: BRAND_GREEN }}>
                      <IconVisto size={24} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '15px' }}>Sin viajes confirmados</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--t-piedra)', lineHeight: '1.5' }}>Cuando un conductor acepte<br/>tu oferta aparecerá aquí.</p>
                  </div>
                )}

                {/* PESTAÑA: COMPLETADOS — historial aparte, no compite con los activos */}
                {!viajeSeleccionado && pestanaViajes === 'completados' && viajesCompletadosOrdenados.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--t-cielo-suave)', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--t-cielo-texto)' }}>
                      <IconBandera size={24} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '15px' }}>Aún no tienes viajes completados</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--t-piedra)', lineHeight: '1.5' }}>Cuando termines un viaje,<br/>quedará aquí en tu historial.</p>
                  </div>
                )}

                {!viajeSeleccionado && (pestanaViajes === 'confirmados' || pestanaViajes === 'completados') &&
                  (pestanaViajes === 'completados' ? viajesCompletadosOrdenados : viajesActivosConfirmados).map((viaje) => {
                  const cfgEstadoViaje = {
                    ASSIGNED:    { color: BRAND_GREEN, badgeBg: 'var(--t-musgo)', badgeColor: 'var(--t-musgo-texto)', Icono: IconVisto, badgeLabel: 'Confirmado', info: 'El conductor está listo para recogerte.' },
                    IN_PROGRESS: { color: 'var(--t-cielo)',   badgeBg: 'var(--t-cielo-suave)', badgeColor: '#1e40af', Icono: IconAuto,  badgeLabel: 'En camino',   info: '¡Tu conductor está en camino!' },
                    COMPLETED:   { color: 'var(--t-cielo-texto)',   badgeBg: '#e0e7ff', badgeColor: '#3730a3', Icono: IconBandera, badgeLabel: 'Completado', info: 'Viaje finalizado exitosamente.' },
                  };
                  const cfg = cfgEstadoViaje[viaje.trip_status] || cfgEstadoViaje.ASSIGNED;
                  const esEnCurso = viaje.trip_status === 'IN_PROGRESS';

                  return (
                    <div key={viaje.id} className="viaje-pasaje">
                      <div style={{ padding: '16px 18px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '11.5px', color: 'var(--t-piedra-clara)' }}>{viaje.fechaCreacion}</span>
                          <span style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <cfg.Icono size={12} />
                            {cfg.badgeLabel}
                            {esEnCurso && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                            )}
                          </span>
                        </div>
                        <TableroRuta origen={viaje.origin} destino={viaje.destination} size={12} style={{ marginBottom: '10px' }} />
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px', color: 'var(--t-piedra)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><IconCalendario size={13} />{new Date(viaje.departure_time).toLocaleString()}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><IconPersonas size={13} />{viaje.seats_needed}</span>
                        </div>
                      </div>
                      <div className="viaje-pasaje__talon" />
                      <div style={{ padding: '14px 18px 16px' }}>
                        {/* Info estado */}
                        {/* Línea de vida del viaje — reemplaza la barra de 3 pasos y
                            absorbe el aviso de estado: el detalle cuelga del paso actual,
                            así la tarjeta pierde una caja y gana claridad. */}
                        {(() => {
                          const pasos = [
                            { key: 'ASSIGNED',    label: 'Confirmado',  detalle: 'El conductor aceptó tu viaje.' },
                            { key: 'IN_PROGRESS', label: 'En camino',   detalle: 'Va hacia el punto de recogida.' },
                            { key: 'COMPLETED',   label: 'Completado',  detalle: 'Viaje finalizado.' },
                          ];
                          const idxActual = pasos.findIndex(p => p.key === viaje.trip_status);
                          return (
                            <div style={{ marginBottom: '13px' }}>
                              {pasos.map((paso, idx) => {
                                const hecho = idx < idxActual;
                                const actual = idx === idxActual;
                                const ultimo = idx === pasos.length - 1;
                                return (
                                  <div key={paso.key} style={{
                                    display: 'grid', gridTemplateColumns: '16px 1fr', gap: '11px',
                                    alignItems: 'start', position: 'relative',
                                    paddingBottom: ultimo ? 0 : '13px',
                                  }}>
                                    {/* Riel vertical */}
                                    {!ultimo && (
                                      <span style={{
                                        position: 'absolute', left: '7.2px', top: '13px', bottom: 0,
                                        width: '1.5px', background: hecho ? cfg.color : 'var(--t-linea)',
                                      }} />
                                    )}
                                    <span style={{
                                      width: actual ? '11px' : '9px', height: actual ? '11px' : '9px',
                                      borderRadius: '50%', margin: actual ? '4px auto 0' : '5px auto 0',
                                      background: hecho || actual ? cfg.color : 'var(--t-linea)',
                                      boxShadow: actual ? `0 0 0 4px ${cfg.color}22` : 'none',
                                      position: 'relative', zIndex: 1, transition: 'all .3s',
                                    }} />
                                    <div>
                                      <div style={{
                                        fontSize: '12px', fontWeight: actual ? '700' : '500',
                                        color: hecho || actual ? T.tinta : 'var(--t-piedra-clara)',
                                      }}>{paso.label}</div>
                                      {actual && (
                                        <div style={{ fontSize: '11.5px', color: T.piedra, marginTop: '1px' }}>
                                          {paso.detalle}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {/* Info conductor */}
                        <div onClick={() => viaje.driver_id && abrirPerfilConductor(viaje.driver_id)}
                          title={viaje.driver_id ? 'Ver perfil del conductor' : undefined}
                          style={{ backgroundColor: 'var(--t-niebla)', borderRadius: '9px', padding: '10px 12px', border: `1px solid ${cfg.color}33`, display: 'flex', alignItems: 'center', gap: '10px', cursor: viaje.driver_id ? 'pointer' : 'default' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--t-linea)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-piedra)', flexShrink: 0 }}>
                            {viaje.conductor_foto
                              ? <img src={viaje.conductor_foto} alt="conductor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <IconAuto size={17} />}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: 'var(--t-tinta)', textDecoration: viaje.driver_id ? 'underline' : 'none', textDecorationColor: 'var(--t-linea)', textUnderlineOffset: '3px' }}>
                              {viaje.conductor_nombre}
                            </p>
                            {viaje.precio_acordado > 0 && (
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra)' }}>
                                Precio acordado: <strong style={{ color: BRAND_GREEN }}>${Number(viaje.precio_acordado).toLocaleString()}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* HU26 — Tracking en tiempo real del conductor */}
                        {esEnCurso && viaje.conductor_lat && viaje.conductor_lng && mapsLoaded && (
                          <div style={{ marginTop: '10px', borderRadius: '9px', overflow: 'hidden', border: `1px solid ${cfg.color}33`, height: '160px' }}>
                            <GoogleMap
                              mapContainerStyle={{ width: '100%', height: '100%' }}
                              center={{ lat: viaje.conductor_lat, lng: viaje.conductor_lng }}
                              zoom={15}
                              options={{ disableDefaultUI: true, gestureHandling: 'none', zoomControl: false, styles: tema === 'oscuro' ? MAPA_OSCURO : undefined }}
                            >
                              <MarkerF
                                position={{ lat: viaje.conductor_lat, lng: viaje.conductor_lng }}
                                title="Tu conductor"
                                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }}
                              />
                            </GoogleMap>
                          </div>
                        )}
                        {esEnCurso && (!viaje.conductor_lat || !viaje.conductor_lng) && (
                          <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--t-piedra-clara)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <IconRadar size={12} />Esperando la ubicación del conductor...
                          </p>
                        )}

                      {/* Botón FUEC */}
                      {(viaje.trip_status === 'ASSIGNED' || viaje.trip_status === 'IN_PROGRESS') && (
                        <button
                          onClick={() => {
                            setOcupantesFuec([{ full_name: '', document_type: 'CC', document_number: '' }]);
                            setModalFuec(viaje.id);
                          }}
                          style={{
                            marginTop: '10px', width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                            background: fuecEnviado[viaje.id] ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                            border: `1px solid ${fuecEnviado[viaje.id] ? BRAND_GREEN : 'rgba(34,197,94,0.35)'}`,
                            borderRadius: '8px',
                            color: fuecEnviado[viaje.id] ? BRAND_GREEN : 'var(--t-musgo-texto)',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
                          }}>
                          {fuecEnviado[viaje.id] ? <IconVisto size={13} /> : <IconClipboard size={13} />}
                          {fuecEnviado[viaje.id] ? 'Ocupantes registrados — Actualizar' : 'Registrar ocupantes del viaje'}
                        </button>
                      )}

                      {/* Botón calificar — HU29 (SCRUM-194) */}
                      {viaje.trip_status === 'COMPLETED' && (
                        <button
                          disabled={viaje.ya_califico}
                          onClick={() => { setEstrellasCalificar(0); setComentarioCalificar(''); setModalCalificar(viaje.id); }}
                          style={{
                            marginTop: '10px', width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                            background: viaje.ya_califico ? 'rgba(148,163,184,0.1)' : 'rgba(234,179,8,0.1)',
                            border: `1px solid ${viaje.ya_califico ? 'var(--t-linea)' : 'var(--t-chiva)'}`,
                            borderRadius: '8px',
                            color: viaje.ya_califico ? 'var(--t-piedra-clara)' : 'var(--t-chiva-texto)',
                            fontSize: '12px', fontWeight: '700', cursor: viaje.ya_califico ? 'default' : 'pointer', transition: 'all 0.2s'
                          }}>
                          {viaje.ya_califico ? <IconVisto size={13} /> : <IconEstrella size={13} />}
                          {viaje.ya_califico ? 'Ya calificaste este viaje' : 'Calificar viaje'}
                        </button>
                      )}

                      {/* Botón descargar recibo — HU25 (SCRUM-190) */}
                      {viaje.trip_status === 'COMPLETED' && (
                        <button
                          disabled={descargandoRecibo === viaje.id}
                          onClick={() => descargarRecibo(viaje.id)}
                          style={{
                            marginTop: '8px', width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                            background: 'rgba(37,99,235,0.08)',
                            border: '1px solid rgba(37,99,235,0.3)',
                            borderRadius: '8px',
                            color: 'var(--t-cielo-texto)',
                            fontSize: '12px', fontWeight: '700', cursor: descargandoRecibo === viaje.id ? 'default' : 'pointer', transition: 'all 0.2s'
                          }}>
                          <IconRecibo size={13} />
                          {descargandoRecibo === viaje.id ? 'Generando recibo…' : 'Descargar recibo (PDF)'}
                        </button>
                      )}
                      </div>
                    </div>
                  );
                })}

                {viajeSeleccionado && (
                  <div>
                    {(() => {
                      const viajeActualizado = listaSolicitudes.find(v => v.id === viajeSeleccionado.id);
                      if (!viajeActualizado || viajeActualizado.ofertas.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--t-musgo)', border: '1px solid var(--t-musgo-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: BRAND_GREEN }}>
                              <IconRadar size={20} />
                            </div>
                            <div style={{ color: 'var(--t-piedra)', fontSize: '13.5px' }}>Esperando ofertas de conductores...</div>
                          </div>
                        );
                      }
                      return viajeActualizado.ofertas.map(oferta => (
                        <div key={oferta.id} style={{ border: '1px solid var(--t-linea)', borderRadius: '14px', padding: '16px', marginBottom: '14px', background: 'var(--t-papel)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                            <div onClick={() => abrirPerfilConductor(oferta.driverId)}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}
                              title="Ver perfil del conductor">
                              <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--t-linea)', borderRadius: '50%', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--t-piedra)', flexShrink: 0 }}>
                                {oferta.foto ? <img src={oferta.foto} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconPersonas size={18} />}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: '700', fontSize: '14.5px', textDecoration: 'underline', textDecorationColor: 'var(--t-linea)', textUnderlineOffset: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span>{oferta.conductor}</span>
                                  {oferta.verificado && (
                                    <span title="Experiencia verificada" style={{ color: 'var(--t-chiva-texto)', display: 'flex' }}><IconGorro size={13} /></span>
                                  )}
                                </div>
                                {oferta.calificacion != null
                                  ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--t-chiva-texto)', fontSize: '12px' }}><IconEstrella size={11} />{oferta.calificacion} <span style={{ color: 'var(--t-piedra-clara)' }}>({oferta.calificacionCantidad})</span></span>
                                  : <span style={{ color: 'var(--t-piedra-clara)', fontSize: '11.5px' }}>Sin calificaciones aún</span>}
                                <div style={{ fontSize: '11.5px', color: 'var(--t-piedra)', marginTop: '1px' }}>{oferta.vehiculo}</div>
                              </div>
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '17px', color: BRAND_GREEN, flexShrink: 0, fontFamily: T.display }}>${oferta.precio.toLocaleString()}</div>
                          </div>

                          {oferta.comodidades && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                              {oferta.recomendado && (
                                <span style={{ background: 'var(--t-musgo)', color: BRAND_GREEN, border: `1px solid ${BRAND_GREEN}`, borderRadius: '100px', padding: '3px 9px', fontSize: '11px', fontWeight: '700' }}>
                                  Buen ajuste para tu grupo
                                </span>
                              )}
                              <span style={{ background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: '1px solid var(--t-linea)', borderRadius: '100px', padding: '3px 9px', fontSize: '11px', fontWeight: '600' }}>
                                {oferta.comodidades.categoria} · hasta {oferta.comodidades.capacidad} pasajeros
                              </span>
                              {[
                                [oferta.comodidades.tiene_ac, 'Aire acondicionado'],
                                [oferta.comodidades.tiene_wifi, 'WiFi'],
                                [oferta.comodidades.tiene_bano, 'Baño'],
                                [oferta.comodidades.tiene_musica, 'Música'],
                                [oferta.comodidades.tiene_maletero_amplio, 'Maletero amplio'],
                                [oferta.comodidades.tiene_sillas_bebe, 'Sillas para bebé'],
                                [oferta.comodidades.acepta_mascotas, 'Acepta mascotas'],
                              ].filter(([activo]) => activo).map(([, etiqueta]) => (
                                <span key={etiqueta} style={{ background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: '1px solid var(--t-linea)', borderRadius: '100px', padding: '3px 9px', fontSize: '11px', fontWeight: '600' }}>
                                  {etiqueta}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* HU38 — filtro flexible: si pediste comodidades y este conductor no
                              las tiene todas, se muestra igual (no se oculta), pero se avisa qué
                              le falta para que decidas tú si igual te sirve. */}
                          {oferta.comodidades && oferta.comodidades.comodidades_faltantes && oferta.comodidades.comodidades_faltantes.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', background: 'var(--t-chiva-suave)', border: '1px solid var(--t-chiva-linea)', borderRadius: '8px', padding: '7px 10px', marginBottom: '10px', fontSize: '11px', color: 'var(--t-chiva-texto)' }}>
                              <IconAlerta size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                              <span>No tiene: {oferta.comodidades.comodidades_faltantes.join(', ')}</span>
                            </div>
                          )}

                          {oferta.created_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--t-piedra-clara)', marginBottom: '4px' }}><IconReloj size={11} />Oferta enviada {tiempoRelativo(oferta.created_at)}</div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '13px' }}>
                            <button onClick={() => handleAceptarOferta(viajeActualizado.id, oferta.id)} style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', padding: '10px', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Aceptar</button>
                            <button onClick={() => handleContraoferta(viajeActualizado.id, oferta.id)} style={{ flex: 1, background: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', border: 'none', padding: '10px', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Contra ofertar</button>
                            <button onClick={() => handleRechazarOferta(viajeActualizado.id, oferta.id)} title="Rechazar oferta" style={{ background: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', border: 'none', padding: '10px 13px', borderRadius: '9px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><IconEquis size={14} /></button>
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

      {/* PANEL NOTIFICACIONES — SCRUM-91 */}
      <AnimatePresence>
        {mostrarNotificaciones && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMostrarNotificaciones(false)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(14,42,30,0.52)', zIndex: 2000 }} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.3 }}
              style={{ position: 'absolute', top: 0, left: 0, width: '380px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--t-papel)', zIndex: 2001, boxShadow: '5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', fontFamily: T.ui }}>

              {/* Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--t-linea)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--t-niebla)' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--t-tinta)', fontFamily: T.display, letterSpacing: '-.01em' }}>Notificaciones</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra)' }}>
                    {notificaciones.filter(n => !n.is_read).length} sin leer
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {notificaciones.filter(n => !n.is_read).length > 0 && (
                    <button onClick={marcarTodasLeidas}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--t-piedra)', cursor: 'pointer', fontFamily: T.ui }}>
                      <IconVisto size={12} />Leer todas
                    </button>
                  )}
                  <button onClick={() => setMostrarNotificaciones(false)}
                    title="Cerrar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-piedra-clara)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconEquis size={17} /></button>
                </div>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {notificaciones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--t-piedra-clara)' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--t-niebla-2)', border: '1px solid var(--t-linea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--t-piedra-clara)' }}>
                      <IconCampana size={22} />
                    </div>
                    <p style={{ margin: 0, fontWeight: '600', color: 'var(--t-piedra)' }}>Sin notificaciones</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Las notificaciones aparecerán aquí.</p>
                  </div>
                )}
                {notificaciones.map((notif) => {
                  // El color dice de qué se trata; el icono, qué pasó exactamente.
                  const cfgTipo = {
                    NEW_OFFER:     { Ico: IconPrecio,   color: T.musgoTexto,  bg: T.musgo },
                    COUNTER_OFFER: { Ico: IconIntercambio, color: T.chivaTexto, bg: T.chivaSuave },
                    TRIP_ACCEPTED: { Ico: IconVisto,    color: T.musgoTexto,  bg: T.musgo },
                    TRIP_REJECTED: { Ico: IconEquis,    color: T.alertaTexto, bg: T.alertaSuave },
                    TRIP_STARTED:  { Ico: IconAuto,     color: T.cieloTexto,  bg: T.cieloSuave },
                    TRIP_COMPLETED:{ Ico: IconBandera,  color: T.cieloTexto,  bg: T.cieloSuave },
                    SYSTEM:        { Ico: IconCampana,  color: T.piedra,      bg: T.niebla2 },
                  };
                  const cfg = cfgTipo[notif.type] || cfgTipo.SYSTEM;
                  return (
                    <div key={notif.notification_id}
                      onClick={() => !notif.is_read && marcarLeida(notif.notification_id)}
                      style={{ backgroundColor: notif.is_read ? 'var(--t-papel)' : cfg.bg, borderRadius: T.rTarjeta, padding: '12px 14px', marginBottom: '8px', border: `1px solid ${notif.is_read ? T.linea : 'transparent'}`, cursor: notif.is_read ? 'default' : 'pointer', transition: 'background-color .2s, border-color .2s' }}>
                      <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: notif.is_read ? T.niebla2 : 'rgba(255,255,255,.16)', color: notif.is_read ? T.piedraClara : cfg.color }}>
                          <cfg.Ico size={15} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <p style={{ margin: 0, fontWeight: notif.is_read ? '600' : '700', fontSize: '13px', color: notif.is_read ? 'var(--t-piedra)' : 'var(--t-tinta)' }}>
                              {notif.title}
                            </p>
                            {!notif.is_read && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0, marginTop: '3px' }} />
                            )}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--t-piedra)', lineHeight: '1.4' }}>{notif.message}</p>
                          <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--t-piedra-clara)' }}>
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
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(14,42,30,0.78)', zIndex: 9000 }} />

            {/* Wrapper centrador — fixed con flex centra sin transform */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{
                pointerEvents: 'all',
                width: '500px', maxWidth: '95vw',
                maxHeight: '85vh',
                backgroundColor: 'var(--t-monte)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                fontFamily: T.ui,
                display: 'flex',
                flexDirection: 'column',
              }}>

              {/* HEADER — fijo arriba */}
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid rgba(34,197,94,0.12)', flexShrink: 0, backgroundColor: '#0a1a0a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: BRAND_GREEN }}>Documento de viaje</p>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--t-musgo)', fontFamily: T.display }}>Registrar ocupantes</h3>
                  </div>
                  <button onClick={() => setModalFuec(null)}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '30px', height: '30px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                  Ingresa el nombre y documento de cada persona que viajará.
                </p>
              </div>

              {/* CONTENIDO — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', backgroundColor: 'var(--t-monte)' }}>
                {ocupantesFuec.map((ocupante, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>Ocupante {idx + 1}</span>
                      {ocupantesFuec.length > 1 && (
                        <button onClick={() => quitarOcupante(idx)}
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: 'var(--t-alerta-linea)', cursor: 'pointer', fontSize: '11px', padding: '3px 8px', fontWeight: '600' }}>
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
                  style={{ flex: 2, padding: '12px', background: enviandoFuec ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${BRAND_GREEN}, var(--t-ruta))`, border: 'none', borderRadius: '9px', color: enviandoFuec ? 'rgba(255,255,255,0.4)' : '#08210F', fontWeight: 700, fontSize: '14px', cursor: enviandoFuec ? 'not-allowed' : 'pointer', fontFamily: T.display, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {enviandoFuec ? 'Guardando…' : <><IconVisto size={15} />Confirmar ocupantes</>}
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL CALIFICAR VIAJE — HU29 (SCRUM-194) */}
      <AnimatePresence>
        {modalCalificar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalCalificar(null)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--t-papel)', borderRadius: '16px', padding: '28px', zIndex: 3001, width: '360px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: T.ui }}>
              <h3 style={{ margin: '0 0 6px', color: 'var(--t-tinta)', fontSize: '17px', fontFamily: T.display, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: '8px' }}><IconEstrella size={17} color="var(--t-chiva)" />¿Cómo estuvo tu viaje?</h3>
              <p style={{ margin: '0 0 18px', color: 'var(--t-piedra)', fontSize: '13px' }}>Tu calificación ayuda a otros pasajeros a elegir mejor.</p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setEstrellasCalificar(n)}
                    title={`${n} de 5`} aria-label={`Calificar con ${n} de 5`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex',
                             color: n <= estrellasCalificar ? 'var(--t-chiva)' : 'var(--t-linea)', transition: 'color .15s, transform .15s',
                             transform: n <= estrellasCalificar ? 'scale(1)' : 'scale(.94)' }}>
                    <IconEstrella size={30} grosor={1.5}
                      style={{ fill: n <= estrellasCalificar ? 'currentColor' : 'none' }} />
                  </button>
                ))}
              </div>

              <textarea value={comentarioCalificar} onChange={e => setComentarioCalificar(e.target.value)}
                placeholder="Cuéntanos más (opcional)" rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: '16px' }} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setModalCalificar(null)}
                  style={{ flex: 1, background: 'var(--t-niebla-2)', color: 'var(--t-piedra)', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={enviarCalificacion} disabled={enviandoCalificacion || estrellasCalificar < 1}
                  style={{ flex: 1, background: (enviandoCalificacion || estrellasCalificar < 1) ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: (enviandoCalificacion || estrellasCalificar < 1) ? 'not-allowed' : 'pointer' }}>
                  {enviandoCalificacion ? 'Enviando...' : 'Enviar calificación'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PERFIL DRAWER — HU16 */}
      <PerfilDrawer abierto={mostrarPerfil} onCerrar={() => setMostrarPerfil(false)} />
    </div>
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default Dashboard;