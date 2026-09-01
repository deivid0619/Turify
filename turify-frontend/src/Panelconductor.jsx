import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  T, TableroRuta, Icono, Rotulo,
  IconReloj, IconVisto, IconEquis, IconBandera, IconAuto, IconCalendario,
  IconPersonas, IconPersona, IconRadar, IconPin, IconEstrella, IconClipboard,
  IconAlerta, IconCampana, IconPrecio, IconIntercambio, IconRecibo,
  LogoWordmark, BotonTema, useTema, MAPA_OSCURO, FIJO, BotonCentrarMapa,
} from './diseno';

const IconGirar   = (p) => <Icono {...p}><path d="M4 4v5h5" /><path d="M20 20v-5h-5" /><path d="M5.5 15A7.5 7.5 0 0 0 19 9.5" /><path d="M18.5 9A7.5 7.5 0 0 0 5 14.5" /></Icono>;
const IconFiltros = (p) => <Icono {...p}><path d="M3.5 6.5h17M6.5 12h11M10 17.5h4" /></Icono>;
const IconMascota = (p) => <Icono {...p}><ellipse cx="8" cy="9" rx="1.8" ry="2.4" /><ellipse cx="16" cy="9" rx="1.8" ry="2.4" /><ellipse cx="4.6" cy="13.6" rx="1.6" ry="2.1" /><ellipse cx="19.4" cy="13.6" rx="1.6" ry="2.1" /><path d="M12 13.2c2.6 0 4.6 2.1 4.6 4.2 0 1.6-1.3 2.4-2.8 2.4-1 0-1.3-.4-1.8-.4s-.8.4-1.8.4c-1.5 0-2.8-.8-2.8-2.4 0-2.1 2-4.2 4.6-4.2Z" /></Icono>;
const IconGrafico = (p) => <Icono {...p}><path d="M4 20V4M4 20h16" /><path d="M8 16.5v-4M12.5 16.5V8M17 16.5v-6.5" /></Icono>;
const IconMapa    = (p) => <Icono {...p}><path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8Z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></Icono>;
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, MarkerF, CircleF, OverlayViewF, useJsApiLoader } from '@react-google-maps/api';
import { AuthContext } from './AuthContext';
import { ToastContainer, useToast } from './Toast';
import { SkeletonTarjetaViaje } from './Skeleton';
import PerfilDrawer from './PerfilDrawer';

const BRAND_GREEN = 'var(--t-ruta)';
import API_BASE_URL from './api';

// Mismo id/libraries que usa Dashboard.jsx — useJsApiLoader reutiliza el script ya
// cargado en vez de inyectarlo de nuevo (evita warnings de "google maps already loaded").
const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapContainerStyle = { width: '100%', height: '100%' };
const centroDefaultAntioquia = { lat: 6.2442, lng: -75.5812 }; // Medellín

// HU06/HU38 — color de las zonas de demanda según cuántas solicitudes hay
const colorPorDemanda = (count) => {
  if (count >= 6) return '#dc5f3c';
  if (count >= 3) return '#f59e0b';
  return '#86efac';
};

const PanelConductor = ({ onVerRuta }) => {
  const { token, usuario } = useContext(AuthContext);
  const { toasts, removeToast, toast } = useToast();

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // HU06 — Zonas de demanda (visibles conectado o no) y solicitudes puntuales
  // con coordenadas (solo se pintan en el mapa cuando el conductor está conectado)
  const [zonasDemanda, setZonasDemanda] = useState([]);
  const [mostrarAvisoZonas, setMostrarAvisoZonas] = useState(true);

  const cargarZonasDemanda = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/demand-zones`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setZonasDemanda(await res.json());
    } catch {}
  };

  const [pestanaActiva, setPestanaActiva] = useState('radar');
  const [tema, alternarTema] = useTema();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [solicitudModal, setSolicitudModal] = useState(null);
  const [precio, setPrecio] = useState('');
  const [enviandoOferta, setEnviandoOferta] = useState(false);
  const [alertaExito, setAlertaExito] = useState(false);
  const [errorPrecio, setErrorPrecio] = useState('');
  const [viajesActivos, setViajesActivos] = useState([]);
  const [tarjetaRutaId, setTarjetaRutaId] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotifPanel, setMostrarNotifPanel] = useState(false);
  // HU20 — el conductor accede a "Mis Docs" (subir RUNT) desde el drawer de perfil,
  // que antes solo se abría desde el Dashboard del pasajero.
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  // Filtros del radar
  const [filtros, setFiltros] = useState({ tipo: 'todos', pasajeros: 'todos', mascotas: false });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // HU09 — Disponibilidad y rango geográfico del conductor
  const [disponible, setDisponible] = useState(false);
  const [ubicacionActual, setUbicacionActual] = useState(null); // { lat, lng }
  // Referencia al mapa: hace falta para centrarlo sin pelear con la prop `center`,
  // que si se fuerza en cada render impide que el conductor lo mueva a mano.
  const mapaRef = useRef(null);

  const centrarEnMiUbicacion = useCallback(() => {
    if (!mapaRef.current) return;
    if (ubicacionActual) {
      mapaRef.current.panTo(ubicacionActual);
      mapaRef.current.setZoom(12);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUbicacionActual(punto);
      if (mapaRef.current) { mapaRef.current.panTo(punto); mapaRef.current.setZoom(12); }
    });
  }, [ubicacionActual]);

  // HU29 — Calificaciones bidireccionales
  const [modalCalificar, setModalCalificar] = useState(null); // request_id del viaje a calificar
  const [estrellasCalificar, setEstrellasCalificar] = useState(0);
  const [comentarioCalificar, setComentarioCalificar] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);

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
      setViajesActivos(prev => prev.map(v => v.request_id === modalCalificar ? { ...v, ya_califico: true } : v));
      setModalCalificar(null);
      setEstrellasCalificar(0);
      setComentarioCalificar('');
      toast.success('Gracias por calificar a tu pasajero.');
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  // Notificaciones del conductor — carga inicial + Realtime (fallback a polling)
  const cargarNotificaciones = async () => {
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

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = supabase
          .channel(`notif-conductor-${usuario.user_id}`)
          .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'Notification',
            filter: `user_id=eq.${usuario.user_id}`
          }, () => cargarNotificaciones())
          .subscribe();
        return () => supabase.removeChannel(channel);
      });
    } else {
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

  const marcarTodasLeidas = () => {
    notificaciones.filter(n => !n.is_read).forEach(n => marcarLeida(n.notification_id));
  };

  // HU09 — Envía current_lat/current_lng/is_online al backend
  const actualizarUbicacionBackend = async (payload) => {
    try {
      const res = await fetch(`${API_BASE_URL}/drivers/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  };

  // Si una sesión anterior quedó "en línea" en el backend (por ejemplo se cerró
  // la pestaña sin desconectarse), el panel arranca mostrando "Desconectado" en
  // pantalla pero el backend seguía creyendo que el conductor estaba online.
  // Forzamos que el backend quede desconectado apenas se abre el panel — y
  // guardamos esa petición en un ref para poder ESPERARLA antes de conectar: si
  // el conductor toca "Conectarme" muy rápido después de cargar la pantalla, sin
  // esto la petición de "desconectar" (lenta) podía llegar al backend DESPUÉS
  // de la de "conectar" (por orden de red) y dejar is_online en false otra vez,
  // aunque la pantalla ya dijera "conectado" — el radar se quedaba vacío.
  const syncInicialRef = useRef(null);
  const [sincronizado, setSincronizado] = useState(false);
  useEffect(() => {
    if (!token) return;
    syncInicialRef.current = actualizarUbicacionBackend({ is_online: false }).finally(() => setSincronizado(true));
  }, [token]);

  // HU09 — Activar/desactivar disponibilidad. Al activar, pide geolocalización
  // y empieza a reportarla periódicamente mientras el conductor esté disponible.
  const toggleDisponibilidad = () => {
    if (disponible) {
      setDisponible(false);
      actualizarUbicacionBackend({ is_online: false });
      return;
    }
    if (!navigator.geolocation) {
      toast('Tu navegador no soporta geolocalización.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUbicacionActual({ lat: latitude, lng: longitude });
        setDisponible(true);
        // Espera a que la sincronización inicial (desconectar) termine antes de
        // mandar "conectar", así nunca llegan al backend en el orden equivocado.
        if (syncInicialRef.current) await syncInicialRef.current;
        await actualizarUbicacionBackend({ current_lat: latitude, current_lng: longitude, is_online: true });
        cargarSolicitudes();
      },
      () => toast('No se pudo obtener tu ubicación. Actívala e intenta de nuevo.', 'error'),
      { enableHighAccuracy: true }
    );
  };

  // Mientras esté disponible, reporta su posición cada 20s (mantiene el radar actualizado)
  useEffect(() => {
    if (!disponible || !navigator.geolocation) return;
    const intervalo = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setUbicacionActual({ lat: latitude, lng: longitude });
        actualizarUbicacionBackend({ current_lat: latitude, current_lng: longitude });
      });
    }, 20000);
    return () => clearInterval(intervalo);
  }, [disponible, token]);

  // `silencioso` distingue una carga que el conductor está esperando ver (primera
  // carga, conectarse, tocar "Actualizar") de un refresco automático de fondo:
  // en el segundo caso NO tocamos `cargando` (que es lo que hacía desaparecer
  // toda la lista y mostrar los esqueletos cada vez) — la lista se queda en
  // pantalla y `solicitudes` simplemente se actualiza con lo nuevo, así que un
  // viaje nuevo aparece agregado sin que el radar entero parpadee.
  const cargarSolicitudes = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    if (!silencioso) setError(null);
    try {
      // HU09 — el radio de búsqueda ahora es automático (origen del viaje +
      // expansión), el backend ya lo resuelve y ordena por cercanía.
      const res = await fetch(`${API_BASE_URL}/api/service-requests/pending`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSolicitudes(data);
    } catch {
      if (!silencioso) setError('No se pudieron cargar las solicitudes.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  // Bug visual: esto se disparaba en el mismo instante que la sincronización
  // inicial (forzar desconectado), y por orden de red podía llegar al backend
  // ANTES de que esa desconexión se aplicara — el radar mostraba TODAS las
  // solicitudes un instante (porque el backend aún creía que seguías online de
  // una sesión anterior) y luego, al llegar la desconexión, se vaciaban de
  // golpe. Por eso se espera a `sincronizado`. Ya NO depende de `ubicacionActual`
  // (eso quedó a cargo del intervalo silencioso de abajo) — antes, cada
  // actualización de posición (cada 20s) también disparaba una carga "visible"
  // que hacía parpadear la lista.
  useEffect(() => { if (token && sincronizado) cargarSolicitudes(); }, [token, sincronizado, disponible]);

  // Mientras estás conectado, el radar se refresca solo cada 15s (antes eran
  // 3s: eso disparaba muchísimas peticiones seguidas). Es un refresco
  // silencioso: no muestra esqueletos ni oculta la lista, solo agrega/actualiza
  // lo que cambió.
  useEffect(() => {
    if (!disponible || !token) return;
    const intervalo = setInterval(() => cargarSolicitudes(true), 15000);
    return () => clearInterval(intervalo);
  }, [disponible, token]);

  // SCRUM-83: Cargar negociaciones activas cuando se cambia a esa pestaña
  const cargarOcupantes = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/passengers`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setOcupantesPorViaje(prev => ({ ...prev, [requestId]: data }));
      }
    } catch {}
  };

  const cargarViajesActivos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/driver/my-offers`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        setViajesActivos(data);
      }
    } catch (e) {
      console.error('Error cargando ofertas activas:', e);
    }
  };

  useEffect(() => {
    if (token && pestanaActiva === 'activos') cargarViajesActivos();
  }, [token, pestanaActiva]);

  // HU35 — Panel de ganancias del conductor (SCRUM-204)
  const [ganancias, setGanancias] = useState(null);
  const [cargandoGanancias, setCargandoGanancias] = useState(false);
  const [errorGanancias, setErrorGanancias] = useState(null);

  const cargarGanancias = async () => {
    setCargandoGanancias(true);
    setErrorGanancias(null);
    try {
      const res = await fetch(`${API_BASE_URL}/drivers/earnings`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      setGanancias(await res.json());
    } catch {
      setErrorGanancias('No pudimos cargar tus ganancias. Intenta de nuevo.');
    } finally {
      setCargandoGanancias(false);
    }
  };

  useEffect(() => {
    if (token && pestanaActiva === 'ganancias') cargarGanancias();
  }, [token, pestanaActiva]);

  // HU38 — Comodidades, capacidad real y tarifas del vehículo (SCRUM-207)
  const [vehiculo, setVehiculo] = useState(null);
  const [formVehiculo, setFormVehiculo] = useState(null);
  const [cargandoVehiculo, setCargandoVehiculo] = useState(false);
  const [errorVehiculo, setErrorVehiculo] = useState(null);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);

  const cargarVehiculo = async () => {
    setCargandoVehiculo(true);
    setErrorVehiculo(null);
    try {
      const res = await fetch(`${API_BASE_URL}/drivers/vehicle`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No pudimos cargar tu vehículo.');
      }
      const data = await res.json();
      setVehiculo(data);
      setFormVehiculo(data);
    } catch (e) {
      setErrorVehiculo(e.message);
    } finally {
      setCargandoVehiculo(false);
    }
  };

  useEffect(() => {
    if (token && pestanaActiva === 'vehiculo') cargarVehiculo();
  }, [token, pestanaActiva]);

  const guardarVehiculo = async () => {
    setGuardandoVehiculo(true);
    try {
      const payload = {
        // Las tarifas (por km, espera, día, etc.) ya NO las decide el conductor —
        // quedan fuera de este formulario a propósito.
        capacidad_real: (formVehiculo.capacidad_real === '' || formVehiculo.capacidad_real == null) ? null : Number(formVehiculo.capacidad_real),
        tiene_ac: formVehiculo.tiene_ac,
        tiene_wifi: formVehiculo.tiene_wifi,
        tiene_bano: formVehiculo.tiene_bano,
        tiene_musica: formVehiculo.tiene_musica,
        tiene_maletero_amplio: formVehiculo.tiene_maletero_amplio,
        tiene_sillas_bebe: formVehiculo.tiene_sillas_bebe,
        acepta_mascotas: formVehiculo.acepta_mascotas,
        cargo_mascota: formVehiculo.cargo_mascota === '' ? null : Number(formVehiculo.cargo_mascota),
        acepta_menores_2_anos: formVehiculo.acepta_menores_2_anos,
      };
      const res = await fetch(`${API_BASE_URL}/drivers/vehicle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo guardar. Verifica los valores.');
      }
      const data = await res.json();
      setVehiculo(data);
      setFormVehiculo(data);
      toast.success('Cambios guardados en tu vehículo.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardandoVehiculo(false);
    }
  };

  // HU26 — Sondeo ligero en segundo plano (independiente de la pestaña activa) para
  // saber si el conductor tiene un viaje EN CURSO y así activar el tracking cada 3s.
  useEffect(() => {
    if (!token) return;
    cargarViajesActivos();
    const intervalo = setInterval(cargarViajesActivos, 15000);
    return () => clearInterval(intervalo);
  }, [token]);

  const viajeEnCurso = viajesActivos.some(v => v.trip_status === 'IN_PROGRESS');

  // HU26 — Mientras haya un viaje IN_PROGRESS, reporta la ubicación cada 3 segundos
  // (más frecuente que el reporte de disponibilidad, para que el pasajero vea al
  // conductor moverse en tiempo real durante el viaje).
  useEffect(() => {
    if (!viajeEnCurso || !navigator.geolocation) return;
    const reportar = () => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setUbicacionActual({ lat: latitude, lng: longitude });
        actualizarUbicacionBackend({ current_lat: latitude, current_lng: longitude });
      });
    };
    reportar();
    const intervalo = setInterval(reportar, 3000);
    return () => clearInterval(intervalo);
  }, [viajeEnCurso, token]);

  // SCRUM-82: Conductor responde a contraoferta
  const [resolviendoOferta, setResolviendoOferta] = useState(null);
  const [ocupantesPorViaje, setOcupantesPorViaje] = useState({});
  const [modalOcupantesId, setModalOcupantesId] = useState(null);
  const [gestionandoViaje, setGestionandoViaje] = useState(null); // request_id en proceso

  // HU17: Conductor inicia o finaliza el viaje
  const gestionarViaje = async (requestId, accion) => {
    setGestionandoViaje(requestId + accion);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${requestId}/${accion}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      const data = await res.json();
      toast.success(data.message);
      cargarViajesActivos();
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setGestionandoViaje(null);
    }
  };

  const resolverContraoferta = async (offerId, action) => {
    setResolviendoOferta(offerId + action);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/offers/${offerId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ action })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail); }
      const data = await res.json();
      toast.success(data.message);
      cargarViajesActivos();
    } catch (e) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setResolviendoOferta(null);
    }
  };

  const validarPrecio = (val) => {
    if (!val || val === '') { setErrorPrecio('El precio no puede estar vacío.'); return false; }
    if (isNaN(val) || Number(val) <= 0) { setErrorPrecio('El precio debe ser mayor a 0.'); return false; }
    setErrorPrecio('');
    return true;
  };

  const enviarOferta = async () => {
    if (!validarPrecio(precio)) return;
    setEnviandoOferta(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/service-requests/${solicitudModal.request_id}/offers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ offered_price: Number(precio) })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al enviar oferta');
      }
      setViajesActivos(prev => [...prev, {
        request_id: solicitudModal.request_id,
        origin: solicitudModal.origin,
        destination: solicitudModal.destination,
        departure_time: solicitudModal.departure_time,
        offered_price: Number(precio),
        estado: 'ESPERANDO'
      }]);
      setSolicitudModal(null);
      setPrecio('');
      setAlertaExito(true);
      setTimeout(() => setAlertaExito(false), 3500);
      cargarSolicitudes();
    } catch (err) {
      setErrorPrecio(err.message);
    } finally {
      setEnviandoOferta(false);
    }
  };

  const handleClickTarjeta = (sol) => {
    const esLaMisma = tarjetaRutaId === sol.request_id;
    setTarjetaRutaId(esLaMisma ? null : sol.request_id);
    if (!esLaMisma && onVerRuta) onVerRuta(sol.origin, sol.destination);
  };

  const formatearFecha = (f) => {
    try { return new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return f; }
  };

  const estadoConfig = (estado) => {
    const m = { ESPERANDO: { bg: 'var(--t-chiva-suave)', color: 'var(--t-chiva-texto)', Ico: IconReloj, label: 'Esperando respuesta del pasajero' }, CONTRAOFERTA: { bg: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', Ico: IconIntercambio, label: 'Contraoferta recibida' }, RECHAZADO: { bg: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', Ico: IconEquis, Ico: IconEquis, label: 'Rechazado' }, ACEPTADO: { bg: 'var(--t-musgo)', color: 'var(--t-musgo-texto)', Ico: IconVisto, label: 'Aceptado' } };
    return m[estado] || { bg: T.niebla2, color: T.piedra, Ico: IconReloj, label: estado };
  };

  const solicitudesFiltradas = solicitudes.filter(sol => {
    if (filtros.tipo !== 'todos' && sol.trip_type !== filtros.tipo) return false;
    const totalPax = (sol.adults_count || 1) + (sol.children_count || 0);
    if (filtros.pasajeros === '1') { if (totalPax !== 1) return false; }
    else if (filtros.pasajeros === '2-4') { if (totalPax < 2 || totalPax > 4) return false; }
    else if (filtros.pasajeros === '5+') { if (totalPax < 5) return false; }
    if (filtros.mascotas && !sol.has_pets) return false;
    return true;
  });
  const filtrosActivos = filtros.tipo !== 'todos' || filtros.pasajeros !== 'todos' || filtros.mascotas;

  // HU06 — solicitudes con coordenadas, para pintarlas como pines en el mapa
  const solicitudesConUbicacion = solicitudes.filter(sol => sol.origin_lat != null && sol.origin_lng != null);

  // Zonas de demanda: se ven estés conectado o no (ayuda a decidir dónde posicionarte),
  // se refrescan cada 30s.
  useEffect(() => {
    if (!token) return;
    cargarZonasDemanda();
    const intervalo = setInterval(cargarZonasDemanda, 30000);
    return () => clearInterval(intervalo);
  }, [token]);

  return (
    <>
    <style>{`
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
      .fuec-input:focus { border-color: rgba(34,197,94,0.55) !important; background: rgba(34,197,94,0.08) !important; }
      .fuec-select {
        width: 100%;
        padding: 9px 6px;
        background: var(--t-monte-alto) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: var(--t-musgo) !important;
        font-size: 13px;
        outline: none;
        min-width: 0;
      }
      .fuec-select option { background: var(--t-monte-alto); color: var(--t-musgo); }

      /* ── Responsividad ──
         El panel medía 420 px fijos y el mapa tomaba el resto. En una ventana
         angosta el mapa quedaba con ancho cero y no se veía: ni el mapa ni el
         botón de centrar. Por debajo de 1000 px se apilan. */
      @media (max-width: 1000px) {
        .pc-raiz { flex-direction: column; height: auto; min-height: 100%; }
        .pc-lateral { width: 100% !important; max-width: 100% !important; }
        .pc-mapa { min-height: 340px; flex: none !important; }
      }
    `}</style>
    <div className="pc-raiz" style={{ display: 'flex', gap: '14px', height: '100%', fontFamily: T.ui }}>
    <aside className="pc-lateral" style={{ width: '420px', flexShrink: 0, background: 'var(--t-monte)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* CABECERA OSCURA — marca, saludo y el control de conexión, que es
          lo único que el conductor toca antes de empezar a trabajar. */}
      <div style={{ padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <LogoWordmark alto={13} oscuro />
          <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            <BotonTema tema={tema} alternar={alternarTema} compacto />
            {/* Perfil — desde acá el conductor sube su RUNT (pestaña "Mis Docs") */}
            <button onClick={() => setMostrarPerfil(true)} title="Mi perfil" className="t-foco"
              style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.monteLinea}`, borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(234,242,236,.8)', flexShrink: 0 }}>
              <IconPersona size={15} />
            </button>
            {/* Campana de notificaciones */}
            <button onClick={() => setMostrarNotifPanel(true)} title="Notificaciones" className="t-foco"
              style={{ position: 'relative', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.monteLinea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconCampana size={15} color="rgba(234,242,236,.8)" />
              {notificaciones.filter(n => !n.is_read).length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: T.alerta, color: '#fff', borderRadius: '50%', minWidth: '16px', height: '16px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.monte}`, padding: '0 3px' }}>
                  {notificaciones.filter(n => !n.is_read).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Saludo: el nombre es lo que se lee, el resto es contexto */}
        <div style={{ marginBottom: '13px' }}>
          <p style={{ margin: 0, fontFamily: T.display, fontWeight: 800, fontSize: '19px', letterSpacing: '-.01em', color: '#fff' }}>
            Hola, {usuario?.full_name?.split(' ')[0] || 'Conductor'}
          </p>
          <p style={{ margin: '2px 0 0', fontFamily: T.dato, fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(234,242,236,.42)' }}>
            {disponible ? 'En línea' : 'Desconectado'}
          </p>
        </div>

        {/* CONTROL PRINCIPAL — conectarse, no "pedir viajes". El estado se lee
            en el color y en el punto, no solo en el texto. */}
        <button onClick={toggleDisponibilidad} className="t-foco"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            padding: '14px', borderRadius: T.rTarjeta, cursor: 'pointer',
            fontFamily: T.display, fontSize: '14.5px', fontWeight: 700,
            border: disponible ? 'none' : `1px solid ${T.monteLinea}`,
            background: disponible ? BRAND_GREEN : 'rgba(255,255,255,0.05)',
            color: disponible ? '#08210F' : '#EAF2EC',
            transition: 'background .2s, color .2s',
          }}>
          <span className={disponible ? 't-anim' : undefined} style={{
            width: '9px', height: '9px', borderRadius: '50%',
            background: disponible ? '#08210F' : 'rgba(234,242,236,.45)',
            animation: disponible ? 't-latido 1.8s infinite' : 'none',
          }} />
          {disponible ? 'Estás conectado' : 'Conectarme'}
        </button>

        <p style={{ margin: '10px 0 0', color: 'rgba(234,242,236,.42)', fontSize: '11.5px', textAlign: 'center', lineHeight: 1.5 }}>
          {disponible
            ? <>Viendo solicitudes cerca tuyo{viajesActivos.length > 0 && <> · {viajesActivos.length} viaje{viajesActivos.length > 1 ? 's' : ''} activo{viajesActivos.length > 1 ? 's' : ''}</>}<br /><span style={{ opacity: .75 }}>Tocá de nuevo para desconectarte</span></>
            : 'Conectate para empezar a recibir solicitudes de tu zona'}
        </p>
      </div>

      {/* PESTAÑAS */}
      <div style={{ display: 'flex', gap: '5px', padding: '0 20px 16px' }}>
        {[{ id: 'radar', Ico: IconRadar, label: 'Radar', count: solicitudes.length }, { id: 'activos', Ico: IconClipboard, label: 'Ofertas', count: viajesActivos.length }, { id: 'ganancias', Ico: IconGrafico, label: 'Ganancias', count: 0 }, { id: 'vehiculo', Ico: IconAuto, label: 'Vehículo', count: 0 }].map(tab => (
          <button key={tab.id} onClick={() => setPestanaActiva(tab.id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 6px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: T.ui, whiteSpace: 'nowrap', minWidth: 0, transition: 'background-color .18s, color .18s', backgroundColor: pestanaActiva === tab.id ? '#fff' : 'rgba(255,255,255,0.08)', color: pestanaActiva === tab.id ? T.monte : 'rgba(255,255,255,0.7)' }}>
            <tab.Ico size={13} />{tab.label}
            {tab.count > 0 && <span style={{ background: pestanaActiva === tab.id ? BRAND_GREEN : 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', marginLeft: '4px' }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* HOJA CLARA — contenido de cada pestaña, igual mecánica de siempre */}
      <div style={{ flex: 1, background: 'var(--t-papel)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', overflowY: 'auto', minHeight: 0 }}>

      {/* ALERTA ÉXITO */}
      <AnimatePresence>
        {alertaExito && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ margin: '12px 16px 0', backgroundColor: 'var(--t-musgo)', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '10px 14px', color: BRAND_GREEN, fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>
            <IconVisto size={14} style={{ verticalAlign: '-2px', marginRight: '7px' }} />Oferta enviada. Esperando la respuesta del pasajero.
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL OFERTA */}
      <AnimatePresence>
        {solicitudModal && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ margin: '12px 16px 0', backgroundColor: 'var(--t-niebla)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: T.tinta, display: 'flex', alignItems: 'flex-start', gap: '7px' }}><IconPin size={14} style={{ flexShrink: 0, marginTop: '2px' }} />{solicitudModal.origin}</p>
                <p style={{ margin: '2px 0', fontWeight: '700', fontSize: '13px', color: BRAND_GREEN }}>→ {solicitudModal.destination}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.piedra, display: 'flex', alignItems: 'center', gap: '6px' }}><IconPersonas size={13} />{(solicitudModal.adults_count || 1) + (solicitudModal.children_count || 0)} pasajero(s){solicitudModal.has_pets && <> · <IconMascota size={12} /></>}</p>
              </div>
              <button onClick={() => { setSolicitudModal(null); setPrecio(''); setErrorPrecio(''); }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--t-piedra-clara)' }}>×</button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--t-piedra)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}><IconPrecio size={14} />¿Cuánto cobrarías por este viaje?</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-piedra)', fontSize: '14px', fontWeight: '700' }}>$</span>
                  <input type="number" placeholder="Ej: 45000" value={precio}
                    onChange={(e) => { setPrecio(e.target.value); if (errorPrecio) validarPrecio(e.target.value); }}
                    min="1" style={{ width: '100%', padding: '10px 12px 10px 26px', border: `1px solid ${errorPrecio ? '#C2410C' : 'var(--t-linea)'}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                {errorPrecio && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#C2410C' }}>{errorPrecio}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={enviarOferta} disabled={enviandoOferta}
                style={{ background: enviandoOferta ? 'var(--t-piedra-clara)' : BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', fontSize: '13px', cursor: enviandoOferta ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {enviandoOferta ? '...' : 'Enviar'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTENIDO */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* PESTAÑA RADAR */}
        {pestanaActiva === 'radar' && (
          <>
            {/* BARRA DE FILTROS */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mostrarFiltros ? '10px' : '0' }}>
                <button onClick={() => setMostrarFiltros(f => !f)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: filtrosActivos ? 'var(--t-musgo)' : 'var(--t-niebla)', border: `1px solid ${filtrosActivos ? BRAND_GREEN : 'var(--t-linea)'}`, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: filtrosActivos ? BRAND_GREEN : 'var(--t-piedra)', cursor: 'pointer' }}>
                  <IconFiltros size={14} /> Filtros
                  {filtrosActivos && <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconVisto size={10} color="#fff" grosor={2.6} /></span>}
                </button>
                {filtrosActivos && (
                  <button onClick={() => setFiltros({ tipo: 'todos', pasajeros: 'todos', mascotas: false })}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: '#C2410C', fontWeight: '600', cursor: 'pointer' }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              <AnimatePresence>
                {mostrarFiltros && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', backgroundColor: 'var(--t-niebla)', border: '1px solid var(--t-linea)', borderRadius: '10px', padding: '12px' }}>

                    {/* Tipo de viaje */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de viaje</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: 'ONE_WAY', label: '→ Solo ida' }, { val: 'ROUND_TRIP', label: '↩ Ida y vuelta' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, tipo: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.tipo === op.val ? BRAND_GREEN : 'var(--t-linea)', color: filtros.tipo === op.val ? '#fff' : 'var(--t-piedra)' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Pasajeros */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pasajeros</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: '1', label: '1 pasajero' }, { val: '2-4', label: '2–4' }, { val: '5+', label: '5 o más' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, pasajeros: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.pasajeros === op.val ? BRAND_GREEN : 'var(--t-linea)', color: filtros.pasajeros === op.val ? '#fff' : 'var(--t-piedra)' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Mascotas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>Solo con mascotas <IconMascota size={13} /></p>
                      <div onClick={() => setFiltros(f => ({ ...f, mascotas: !f.mascotas }))}
                        style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: filtros.mascotas ? BRAND_GREEN : 'var(--t-linea)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: filtros.mascotas ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--t-papel)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Contador de resultados filtrados */}
              {filtrosActivos && !cargando && (
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--t-piedra)' }}>
                  {solicitudesFiltradas.length} de {solicitudes.length} viaje(s) coinciden con tus filtros
                </p>
              )}
            </div>

            {cargando && (
              <>
                <SkeletonTarjetaViaje />
                <SkeletonTarjetaViaje />
                <SkeletonTarjetaViaje />
              </>
            )}
            {!cargando && error && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#C2410C', fontSize: '13px' }}>
                <IconAlerta size={14} style={{ verticalAlign: '-2px', marginRight: '7px' }} />{error}<br />
                <button onClick={cargarSolicitudes} style={{ marginTop: '8px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reintentar</button>
              </div>
            )}
            {/* ESTADO VACÍO */}
            {!cargando && !error && solicitudes.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '36px 20px' }}>
                <svg width="110" height="90" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '14px', opacity: 0.75 }}>
                  <circle cx="55" cy="45" r="32" fill="var(--t-musgo)" stroke="var(--t-musgo-linea)" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="20" fill="none" stroke="#86efac" strokeWidth="1" strokeDasharray="4 3"/>
                  <circle cx="55" cy="45" r="8" fill="var(--t-musgo)" stroke="var(--t-ruta)" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="3" fill="var(--t-ruta)"/>
                  <line x1="55" y1="13" x2="55" y2="7" stroke="var(--t-ruta)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="55" y1="77" x2="55" y2="83" stroke="var(--t-ruta)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="23" y1="45" x2="17" y2="45" stroke="var(--t-ruta)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="87" y1="45" x2="93" y2="45" stroke="var(--t-ruta)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '14px' }}>
                  {disponible ? 'Radar sin señal' : 'Estás desconectado'}
                </p>
                <p style={{ margin: '0 0 16px', color: 'var(--t-piedra)', fontSize: '13px', lineHeight: '1.5' }}>
                  {disponible
                    ? <>No hay viajes en tu zona por ahora.<br/>Vuelve a verificar en un momento.</>
                    : <>Actívate como "Disponible" (arriba) para<br/>empezar a ver viajes cerca de ti.</>}
                </p>
                {disponible ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={cargarSolicitudes}
                    style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                    <IconGirar size={14} />Verificar de nuevo
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={toggleDisponibilidad}
                    style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                    <IconRadar size={14} />Conectarme
                  </motion.button>
                )}
              </motion.div>
            )}
            {/* ESTADO VACÍO CUANDO HAY VIAJES PERO NINGUNO PASA FILTROS */}
            {!cargando && !error && solicitudes.length > 0 && solicitudesFiltradas.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: T.musgo, border: `1px solid ${T.musgoLinea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.musgoTexto }}><IconRadar size={22} /></div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '14px' }}>Sin resultados con estos filtros</p>
                <p style={{ margin: '0 0 12px', color: 'var(--t-piedra)', fontSize: '13px' }}>Hay {solicitudes.length} viaje(s) disponibles, pero ninguno coincide.</p>
                <button onClick={() => setFiltros({ tipo: 'todos', pasajeros: 'todos', mascotas: false })}
                  style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, borderRadius: '8px', padding: '7px 14px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                  Limpiar filtros
                </button>
              </motion.div>
            )}
            {/* TARJETAS */}
            {!cargando && solicitudesFiltradas.map((sol) => {
              const estaSeleccionada = tarjetaRutaId === sol.request_id;
              return (
                <motion.div key={sol.request_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: `1px solid ${estaSeleccionada ? BRAND_GREEN : 'var(--t-linea)'}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: estaSeleccionada ? `0 0 0 2px ${BRAND_GREEN}33` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                  {/* Cuerpo clickeable → traza ruta SCRUM-77 */}
                  <div onClick={() => handleClickTarjeta(sol)} style={{ padding: '14px', cursor: 'pointer', backgroundColor: estaSeleccionada ? 'var(--t-musgo)' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <TableroRuta origen={sol.origin} destino={sol.destination} size={11} />
                      </div>
                      <span style={{ fontSize: '10px', background: 'var(--t-chiva-suave)', color: 'var(--t-chiva-texto)', padding: '3px 8px', borderRadius: '20px', fontWeight: '700', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                        {sol.trip_type === 'ROUND_TRIP' ? '↩ Ida y vuelta' : '→ Solo ida'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--t-piedra)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconCalendario size={12} />{formatearFecha(sol.departure_time)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><IconPersonas size={12} />{(sol.adults_count || 1) + (sol.children_count || 0)} pasajero(s){sol.has_pets && <IconMascota size={12} />}</span>
                    </div>
                    {/* HU38 — filtro flexible de comodidades: el viaje se ve igual aunque tu
                        vehículo no cumpla todo, pero te avisamos qué te falta para que decidas
                        si te conviene ofertar de todas formas. */}
                    {sol.comodidades_exigidas > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '600', color: sol.comodidades_faltantes?.length ? 'var(--t-chiva-texto)' : BRAND_GREEN }}>
                        {sol.comodidades_faltantes?.length
                          ? `El pasajero pidió comodidades que te faltan: ${sol.comodidades_faltantes.join(', ')}`
                          : `Cumplís las ${sol.comodidades_exigidas} comodidad(es) que pidió el pasajero`}
                      </div>
                    )}
                    {estaSeleccionada && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ marginTop: '8px', fontSize: '11px', color: BRAND_GREEN, fontWeight: '600' }}>
                        <IconMapa size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Ruta trazada en el mapa — hacé clic para ocultarla
                      </motion.div>
                    )}
                  </div>
                  {/* Botón oferta - SCRUM-76 */}
                  <div style={{ padding: '0 14px 14px' }}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={(e) => { e.stopPropagation(); setSolicitudModal(sol); setPrecio(''); setErrorPrecio(''); }}
                      style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      <IconPrecio size={15} />Hacer oferta
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </>
        )}

        {/* PESTAÑA VIAJES ACTIVOS - SCRUM-89 */}
        {/* PESTAÑA MIS OFERTAS — SCRUM-83 y SCRUM-84 */}
        {pestanaActiva === 'activos' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={cargarViajesActivos}
                style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                <IconGirar size={14} />Actualizar
              </button>
            </div>

            {viajesActivos.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: T.niebla2, border: `1px solid ${T.linea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: T.piedraClara }}><IconClipboard size={23} /></div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--t-tinta)', fontSize: '15px' }}>Aún no has enviado ofertas</p>
                <p style={{ margin: 0, color: 'var(--t-piedra)', fontSize: '13px' }}>Cuando hagas una oferta aparecerá aquí con su estado.</p>
              </motion.div>
            )}

            {viajesActivos.map((viaje) => {
              const esContraoferta = viaje.status === 'PASSENGER_COUNTER_OFFERED';
              const esAceptado = viaje.status === 'ACCEPTED';
              const esRechazado = viaje.status === 'REJECTED';

              const cfgEstado = {
                DRIVER_OFFERED:           { bg: 'var(--t-chiva-suave)', color: 'var(--t-chiva-texto)', Ico: IconReloj, label: 'Esperando respuesta del pasajero' },
                PASSENGER_COUNTER_OFFERED:{ bg: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', Ico: IconIntercambio, label: 'Contraoferta recibida — respondé' },
                ACCEPTED:                 { bg: 'var(--t-musgo)', color: 'var(--t-musgo-texto)', Ico: IconVisto, label: 'Confirmado — listo para iniciar' },
                REJECTED:                 { bg: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', Ico: IconEquis, label: 'Rechazado' },
              };
              // Estado real del viaje (viene del trip_status)
              const cfgViaje = {
                ASSIGNED:    { bg: 'var(--t-musgo)', color: 'var(--t-musgo-texto)', Ico: IconVisto, label: 'Viaje confirmado' },
                IN_PROGRESS: { bg: 'var(--t-cielo-suave)', color: 'var(--t-cielo-texto)', Ico: IconAuto, label: 'Viaje en curso' },
                COMPLETED:   { bg: '#e0e7ff', color: 'var(--t-cielo-texto)', Ico: IconBandera, label: 'Viaje completado' },
              };
              const estadoViaje = viaje.trip_status;
              const est = cfgEstado[viaje.status] || { bg: 'var(--t-niebla-2)', color: 'var(--t-piedra)', label: viaje.status };

              return (
                <motion.div key={viaje.offer_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: `1px solid ${esContraoferta ? '#3b82f6' : 'var(--t-linea)'}`, borderRadius: '12px', padding: '14px', marginBottom: '12px',
                    boxShadow: esContraoferta ? '0 0 0 2px #3b82f633' : 'none', transition: 'all 0.2s' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <TableroRuta origen={viaje.origin} destino={viaje.destination} size={11} />
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--t-piedra)' }}>{formatearFecha(viaje.departure_time)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: BRAND_GREEN }}>${Number(viaje.offered_price).toLocaleString()}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--t-piedra-clara)' }}>
                        {esContraoferta ? 'Precio del pasajero' : 'Tu oferta'}
                      </p>
                    </div>
                  </div>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: est.bg, color: est.color, borderRadius: '20px', padding: '4px 11px', fontSize: '11px', fontWeight: 700, marginBottom: esContraoferta ? '10px' : '0' }}>
                    {est.Ico && <est.Ico size={12} />}{est.label}
                  </span>

                  {/* SCRUM-84: Botones para responder contraoferta */}
                  {esContraoferta && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'ACCEPT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'ACCEPT'}
                        style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'ACCEPT' ? '...' : <><IconVisto size={14} />Aceptar precio</>}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'REJECT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'REJECT'}
                        style={{ flex: 1, background: 'var(--t-alerta-suave)', color: 'var(--t-alerta-texto)', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'REJECT' ? '...' : <><IconEquis size={14} />Rechazar</>}
                      </motion.button>
                    </div>
                  )}

                  {/* HU17: Botones de gestión del viaje */}
                  {/* HU10: Botón ver ocupantes */}
                  {esAceptado && (estadoViaje === 'ASSIGNED' || estadoViaje === 'IN_PROGRESS') && (
                    <button
                      onClick={async () => {
                        await cargarOcupantes(viaje.request_id);
                        setModalOcupantesId(viaje.request_id);
                      }}
                      style={{ marginTop: '10px', width: '100%', padding: '9px', background: 'var(--t-musgo)', border: '1px solid var(--t-ruta)', borderRadius: '8px', color: 'var(--t-musgo-texto)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      <IconPersonas size={15} />Ver ocupantes del viaje
                    </button>
                  )}

                  {esAceptado && estadoViaje === 'ASSIGNED' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: 'var(--t-musgo)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: 'var(--t-musgo-texto)', fontWeight: '600' }}>
                        <IconVisto size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Viaje confirmado. Cuando recojas al pasajero, iniciá el viaje.
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'start')}
                        disabled={gestionandoViaje === viaje.request_id + 'start'}
                        style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'start' ? '...' : <><IconAuto size={15} />Iniciar viaje</>}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'IN_PROGRESS' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: 'var(--t-cielo-suave)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: 'var(--t-cielo-texto)', fontWeight: '600' }}>
                        <IconAuto size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Viaje en curso. Finalizá cuando llegues al destino.
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'complete')}
                        disabled={gestionandoViaje === viaje.request_id + 'complete'}
                        style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'complete' ? '...' : <><IconBandera size={15} />Finalizar viaje</>}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'COMPLETED' && (
                    <div style={{ marginTop: '10px', backgroundColor: 'var(--t-cielo-suave)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--t-cielo-texto)', fontWeight: '600', textAlign: 'center' }}>
                      <IconBandera size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Viaje completado.
                    </div>
                  )}

                  {/* Botón calificar pasajero — HU29 (SCRUM-194) */}
                  {esAceptado && estadoViaje === 'COMPLETED' && (
                    <button
                      disabled={viaje.ya_califico}
                      onClick={() => { setEstrellasCalificar(0); setComentarioCalificar(''); setModalCalificar(viaje.request_id); }}
                      style={{
                        marginTop: '8px', width: '100%', padding: '10px',
                        background: viaje.ya_califico ? 'rgba(148,163,184,0.1)' : 'rgba(234,179,8,0.1)',
                        border: `1px solid ${viaje.ya_califico ? 'var(--t-linea)' : 'var(--t-chiva)'}`,
                        borderRadius: '8px',
                        color: viaje.ya_califico ? 'var(--t-piedra-clara)' : 'var(--t-chiva-texto)',
                        fontSize: '12px', fontWeight: '700', cursor: viaje.ya_califico ? 'default' : 'pointer'
                      }}>
                      {viaje.ya_califico ? <><IconVisto size={14} />Ya calificaste a este pasajero</> : <><IconEstrella size={14} />Calificar pasajero</>}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </>
        )}

        {/* PESTAÑA GANANCIAS — HU35 (SCRUM-204) */}
        {pestanaActiva === 'ganancias' && (
          <>
            {cargandoGanancias && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t-piedra-clara)', fontSize: '13px' }}>Cargando...</div>
            )}

            {errorGanancias && !cargandoGanancias && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <p style={{ color: '#C2410C', fontSize: '13px', marginBottom: '10px' }}>{errorGanancias}</p>
                <button onClick={cargarGanancias} style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                  <IconGirar size={14} />Reintentar
                </button>
              </div>
            )}

            {ganancias && !cargandoGanancias && !errorGanancias && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, background: 'var(--t-musgo)', border: `1px solid ${BRAND_GREEN}`, borderRadius: '12px', padding: '14px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: 'var(--t-musgo-texto)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Esta semana</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: BRAND_GREEN }}>${ganancias.ganancias_semana.toLocaleString('es-CO')}</p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--t-niebla)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '14px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: 'var(--t-piedra)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Este mes</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--t-tinta)' }}>${ganancias.ganancias_mes.toLocaleString('es-CO')}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: 'var(--t-tinta)' }}>{ganancias.viajes_completados}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--t-piedra)' }}>Viajes completados</p>
                  </div>
                  <div style={{ flex: 1, background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: 'var(--t-tinta)' }}>
                      {ganancias.calificacion_promedio != null
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><IconEstrella size={16} style={{ fill: 'currentColor' }} />{ganancias.calificacion_promedio}</span>
                        : '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--t-piedra)' }}>
                      {ganancias.calificacion_promedio != null ? 'Calificación' : 'Calificación (próximamente)'}
                    </p>
                  </div>
                </div>

                {ganancias.viajes_completados === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: T.niebla2, border: `1px solid ${T.linea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.piedraClara }}><IconGrafico size={22} /></div>
                    <p style={{ margin: 0, color: 'var(--t-piedra)', fontSize: '13px' }}>Aún no tienes viajes completados. Cuando finalices tu primer viaje, aquí verás tus ganancias y estadísticas.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '700', color: 'var(--t-tinta)' }}>Horarios más activos</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
                        {ganancias.horarios_activos.map((cant, hora) => {
                          const max = Math.max(...ganancias.horarios_activos, 1);
                          return (
                            <div key={hora} title={`${hora}:00 — ${cant} viaje(s)`}
                              style={{ flex: 1, height: `${Math.max((cant / max) * 100, 4)}%`, background: cant > 0 ? BRAND_GREEN : 'var(--t-linea)', borderRadius: '2px' }} />
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'var(--t-piedra-clara)' }}>
                        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                      </div>
                    </div>

                    <div style={{ background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '14px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '700', color: 'var(--t-tinta)' }}>Rutas más frecuentes</p>
                      {ganancias.top_rutas.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < ganancias.top_rutas.length - 1 ? '1px solid var(--t-niebla-2)' : 'none' }}>
                          <span style={{ fontSize: '12px', color: 'var(--t-tinta)' }}>{r.ruta}</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: BRAND_GREEN }}>{r.viajes} viaje{r.viajes !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* PESTAÑA MI VEHÍCULO — HU38 (SCRUM-207) */}
        {pestanaActiva === 'vehiculo' && (
          <>
            {cargandoVehiculo && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t-piedra-clara)', fontSize: '13px' }}>Cargando...</div>
            )}

            {errorVehiculo && !cargandoVehiculo && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <p style={{ color: '#C2410C', fontSize: '13px', marginBottom: '10px' }}>{errorVehiculo}</p>
                <button onClick={cargarVehiculo} style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                  Reintentar
                </button>
              </div>
            )}

            {formVehiculo && !cargandoVehiculo && !errorVehiculo && (
              <>
                <div style={{ background: 'var(--t-musgo)', border: `1px solid ${BRAND_GREEN}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: 'var(--t-musgo-texto)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Placa {formVehiculo.plate} · Categoría {formVehiculo.categoria}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--t-musgo-texto)' }}>
                    La categoría se calcula automáticamente según la capacidad real de tu vehículo y se usa para sugerirte a los pasajeros que buscan tu tipo de vehículo.
                  </p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--t-tinta)', marginBottom: '5px' }}>Capacidad real (pasajeros)</label>
                  <input type="number" min="1" max="60" value={formVehiculo.capacidad_real ?? ''}
                    onChange={e => setFormVehiculo({ ...formVehiculo, capacidad_real: e.target.value })}
                    placeholder={`Registrada: ${formVehiculo.capacity}`}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '13px' }} />
                </div>

                {/* HU38 — los pasajeros ahora pueden filtrar por comodidades al publicar un
                    viaje: si el conductor no marca ninguna, simplemente no le llegarán esas
                    solicitudes filtradas, aunque su vehículo sí las tenga. */}
                {!formVehiculo.tiene_ac && !formVehiculo.tiene_wifi && !formVehiculo.tiene_bano &&
                  !formVehiculo.tiene_musica && !formVehiculo.tiene_maletero_amplio && !formVehiculo.tiene_sillas_bebe && (
                  <div style={{ background: 'var(--t-chiva-suave)', border: '1px solid var(--t-chiva-linea)', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--t-chiva-texto)' }}>
                      Aún no has marcado ninguna comodidad. Los pasajeros ahora pueden filtrar su búsqueda por
                      comodidades — si tu vehículo tiene aire acondicionado, WiFi u otras, márcalas para no perderte
                      esos viajes.
                    </p>
                  </div>
                )}

                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--t-tinta)', marginBottom: '8px' }}>Comodidades</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    ['tiene_ac', 'Aire acondicionado'],
                    ['tiene_wifi', 'WiFi'],
                    ['tiene_bano', 'Baño'],
                    ['tiene_musica', 'Música'],
                    ['tiene_maletero_amplio', 'Maletero amplio'],
                    ['tiene_sillas_bebe', 'Sillas para bebé'],
                  ].map(([campo, etiqueta]) => (
                    <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--t-tinta)', border: '1px solid var(--t-linea)', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!formVehiculo[campo]}
                        onChange={e => setFormVehiculo({ ...formVehiculo, [campo]: e.target.checked })} />
                      {etiqueta}
                    </label>
                  ))}
                </div>

                <div style={{ border: '1px solid var(--t-linea)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '700', color: 'var(--t-tinta)', marginBottom: formVehiculo.acepta_mascotas ? '10px' : 0 }}>
                    <input type="checkbox" checked={!!formVehiculo.acepta_mascotas}
                      onChange={e => setFormVehiculo({ ...formVehiculo, acepta_mascotas: e.target.checked, cargo_mascota: e.target.checked ? formVehiculo.cargo_mascota : 0 })} />
                    Acepto mascotas
                  </label>
                  {formVehiculo.acepta_mascotas && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--t-piedra)', marginBottom: '4px' }}>Cargo adicional por mascota (COP)</label>
                      <input type="number" min="0" value={formVehiculo.cargo_mascota ?? ''}
                        onChange={e => setFormVehiculo({ ...formVehiculo, cargo_mascota: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--t-linea)', borderRadius: '8px', fontSize: '13px' }} />
                    </div>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--t-tinta)', marginBottom: '14px' }}>
                  <input type="checkbox" checked={!!formVehiculo.acepta_menores_2_anos}
                    onChange={e => setFormVehiculo({ ...formVehiculo, acepta_menores_2_anos: e.target.checked })} />
                  Acepto menores de 2 años
                </label>

                <button onClick={guardarVehiculo} disabled={guardandoVehiculo}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: BRAND_GREEN, color: '#fff', fontSize: '13px', fontWeight: '700', cursor: guardandoVehiculo ? 'default' : 'pointer', opacity: guardandoVehiculo ? 0.6 : 1 }}>
                  {guardandoVehiculo ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </>
            )}
          </>
        )}
      </div>
      </div>
    </aside>

    {/* MAPA — zonas de demanda + tu posición. Mientras estás desconectado no se ven
        solicitudes puntuales (eso solo aparece al conectarte), pero sí las zonas
        con más flujo de pedidos, para que decidas dónde posicionarte. */}
    <main className="pc-mapa" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        {mapsLoaded ? (
          <>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={ubicacionActual || centroDefaultAntioquia}
            zoom={ubicacionActual ? 12 : 9}
            onLoad={(mapa) => { mapaRef.current = mapa; }}
            options={{ disableDefaultUI: true, zoomControl: true, styles: tema === 'oscuro' ? MAPA_OSCURO : undefined }}
          >
            {zonasDemanda.map((zona, i) => (
              <CircleF key={i}
                center={{ lat: zona.lat, lng: zona.lng }}
                radius={Math.min(1200 + zona.count * 350, 4500)}
                options={{
                  fillColor: colorPorDemanda(zona.count),
                  fillOpacity: 0.28,
                  strokeColor: colorPorDemanda(zona.count),
                  strokeOpacity: 0.55,
                  strokeWeight: 1.5,
                  clickable: false,
                }} />
            ))}
            {zonasDemanda.map((zona, i) => (
              <OverlayViewF key={`label-${i}`} position={{ lat: zona.lat, lng: zona.lng }} mapPaneName="floatPane">
                <div style={{ transform: 'translate(-50%, -50%)', background: 'rgba(5,14,5,0.85)', color: '#fff', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', fontFamily: "'Syne', sans-serif", pointerEvents: 'none' }}>
                  {zona.label} · {zona.count}
                </div>
              </OverlayViewF>
            ))}

            {ubicacionActual && (
              <MarkerF position={ubicacionActual} title="Tu posición"
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: FIJO.ruta, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }} />
            )}

            {disponible && solicitudesConUbicacion.map(sol => (
              <MarkerF key={sol.request_id} position={{ lat: sol.origin_lat, lng: sol.origin_lng }}
                title={`${sol.origin} → ${sol.destination}`}
                onClick={() => { setSolicitudModal(sol); setPrecio(''); setErrorPrecio(''); }}
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />
            ))}
          </GoogleMap>
          <BotonCentrarMapa onClick={centrarEnMiUbicacion}
            titulo={ubicacionActual ? 'Centrar en mi ubicación' : 'Buscar mi ubicación'} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--t-niebla-2)', color: 'var(--t-piedra-clara)', fontSize: '14px' }}>
            Cargando mapa...
          </div>
        )}

        {!disponible && mostrarAvisoZonas && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,14,5,0.85)', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontSize: '12px' }}>
            <span style={{ flex: 1, textAlign: 'center' }}>
              Estas son las zonas con más solicitudes ahora mismo. Conéctate para ver los viajes puntuales cerca de ti.
            </span>
            <button onClick={() => setMostrarAvisoZonas(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '16px', lineHeight: 1, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              ×
            </button>
          </div>
        )}
      </div>
    </main>
    </div>

      {/* PANEL NOTIFICACIONES CONDUCTOR */}
      <AnimatePresence>
        {mostrarNotifPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMostrarNotifPanel(false)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000 }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
              style={{ position: 'fixed', top: 0, right: 0, width: '360px', maxWidth: '100vw', height: '100vh', backgroundColor: 'var(--t-papel)', zIndex: 3001, boxShadow: '-5px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

              {/* Header notif */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--t-linea)', backgroundColor: 'var(--t-niebla)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: T.tinta, fontFamily: T.display, letterSpacing: '-.01em' }}>Notificaciones</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--t-piedra)' }}>
                    {notificaciones.filter(n => !n.is_read).length} sin leer
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {notificaciones.filter(n => !n.is_read).length > 0 && (
                    <button onClick={marcarTodasLeidas}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: T.papel, border: `1px solid ${T.linea}`, borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--t-piedra)', cursor: 'pointer' }}>
                      <IconVisto size={12} />Leer todas
                    </button>
                  )}
                  <button onClick={() => setMostrarNotifPanel(false)}
                    title="Cerrar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.piedraClara, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconEquis size={17} /></button>
                </div>
              </div>

              {/* Lista notif */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {notificaciones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--t-piedra-clara)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: T.niebla2, border: `1px solid ${T.linea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.piedraClara }}><IconCampana size={20} /></div>
                    <p style={{ margin: 0, fontWeight: '600', color: 'var(--t-piedra)' }}>Sin notificaciones</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Aquí verás cuando el pasajero responda.</p>
                  </div>
                )}
                {notificaciones.map((notif) => {
                  const cfg = {
                    NEW_OFFER:      { Ico: IconPrecio,       color: T.musgoTexto,  bg: T.musgo },
                    COUNTER_OFFER:  { Ico: IconIntercambio, color: T.chivaTexto,  bg: T.chivaSuave },
                    TRIP_ACCEPTED:  { Ico: IconVisto,       color: T.musgoTexto,  bg: T.musgo },
                    TRIP_REJECTED:  { Ico: IconEquis,       color: T.alertaTexto, bg: T.alertaSuave },
                    TRIP_STARTED:   { Ico: IconAuto,        color: T.cieloTexto,  bg: T.cieloSuave },
                    TRIP_COMPLETED: { Ico: IconBandera,     color: T.cieloTexto,  bg: T.cieloSuave },
                    SYSTEM:         { Ico: IconCampana,     color: T.piedra,      bg: T.niebla2 },
                  }[notif.type] || { Ico: IconCampana, color: T.piedra, bg: T.niebla2 };

                  return (
                    <div key={notif.notification_id}
                      onClick={() => !notif.is_read && marcarLeida(notif.notification_id)}
                      style={{ backgroundColor: notif.is_read ? '#fff' : cfg.bg, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', border: `1px solid ${notif.is_read ? 'var(--t-linea)' : cfg.color + '33'}`, cursor: notif.is_read ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: notif.is_read ? T.niebla2 : 'rgba(255,255,255,.16)', color: notif.is_read ? T.piedraClara : cfg.color }}>
                          <cfg.Ico size={15} />
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ margin: 0, fontWeight: notif.is_read ? '600' : '700', fontSize: '13px', color: notif.is_read ? 'var(--t-piedra)' : 'var(--t-tinta)' }}>
                              {notif.title}
                            </p>
                            {!notif.is_read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0, marginTop: '3px' }} />}
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

      {/* MODAL OCUPANTES FUEC — position fixed */}
      <AnimatePresence>
        {modalOcupantesId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalOcupantesId(null)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9000 }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ pointerEvents: 'all', width: '440px', maxWidth: '95vw', maxHeight: '80vh', backgroundColor: T.monteAlto, border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: BRAND_GREEN }}>Documento de viaje</p>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--t-musgo)', fontFamily: "'Syne', sans-serif" }}>Ocupantes registrados</h3>
                </div>
                <button onClick={() => setModalOcupantesId(null)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '30px', height: '30px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {!ocupantesPorViaje[modalOcupantesId] || ocupantesPorViaje[modalOcupantesId].length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: T.niebla2, border: `1px solid ${T.linea}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.piedraClara }}><IconPersonas size={20} /></div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>El pasajero aún no ha registrado los ocupantes.</p>
                  </div>
                ) : (
                  ocupantesPorViaje[modalOcupantesId].map((oc, i) => (
                    <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: 'var(--t-musgo)' }}>{oc.full_name}</p>
                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Ocupante {i + 1}</p>
                      </div>
                      <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: '700', color: BRAND_GREEN }}>
                        {oc.document_type} {oc.document_number}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <button onClick={() => setModalOcupantesId(null)}
                  style={{ width: '100%', padding: '11px', background: `linear-gradient(135deg, ${BRAND_GREEN}, var(--t-ruta))`, border: 'none', borderRadius: '9px', color: '#08210F', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
                  Cerrar
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL CALIFICAR PASAJERO — HU29 (SCRUM-194) */}
      <AnimatePresence>
        {modalCalificar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalCalificar(null)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000 }} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--t-papel)', borderRadius: '16px', padding: '28px', zIndex: 3001, width: '360px', maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              <h3 style={{ margin: '0 0 6px', color: 'var(--t-tinta)', fontSize: '17px', fontFamily: T.display, fontWeight: 800, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: '8px' }}><IconEstrella size={17} color={T.chiva} />¿Cómo estuvo tu pasajero?</h3>
              <p style={{ margin: '0 0 18px', color: 'var(--t-piedra)', fontSize: '13px' }}>Tu calificación queda registrada en su perfil.</p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setEstrellasCalificar(n)}
                    title={`${n} de 5`} aria-label={`Calificar con ${n} de 5`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex',
                             color: n <= estrellasCalificar ? T.chiva : T.linea, transition: 'color .15s, transform .15s',
                             transform: n <= estrellasCalificar ? 'scale(1)' : 'scale(.94)' }}>
                    <IconEstrella size={30} grosor={1.5} style={{ fill: n <= estrellasCalificar ? 'currentColor' : 'none' }} />
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

    <PerfilDrawer abierto={mostrarPerfil} onCerrar={() => setMostrarPerfil(false)} />
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default PanelConductor;