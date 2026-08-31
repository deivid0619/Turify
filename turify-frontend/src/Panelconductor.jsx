import { useState, useEffect, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, MarkerF, CircleF, OverlayViewF, useJsApiLoader } from '@react-google-maps/api';
import { AuthContext } from './AuthContext';
import { ToastContainer, useToast } from './Toast';
import { SkeletonTarjetaViaje } from './Skeleton';
import PerfilDrawer from './PerfilDrawer';
import logoTurify from './logo.png';

const BRAND_GREEN = '#16a34a';
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
      toast.success('✅ ¡Gracias por calificar a tu pasajero!');
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

  const cargarSolicitudes = async () => {
    setCargando(true);
    setError(null);
    try {
      // HU09 — el radio de búsqueda lo define el PASAJERO al publicar el viaje;
      // el backend filtra comparándolo contra current_lat/current_lng del conductor.
      const res = await fetch(`${API_BASE_URL}/api/service-requests/pending`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSolicitudes(data);
    } catch {
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setCargando(false);
    }
  };

  // Bug visual: esto se disparaba en el mismo instante que la sincronización
  // inicial (forzar desconectado), y por orden de red podía llegar al backend
  // ANTES de que esa desconexión se aplicara — el radar mostraba TODAS las
  // solicitudes un instante (porque el backend aún creía que seguías online de
  // una sesión anterior) y luego, al llegar la desconexión, se vaciaban de
  // golpe. Por eso se espera a `sincronizado`.
  useEffect(() => { if (token && sincronizado) cargarSolicitudes(); }, [token, sincronizado, disponible, ubicacionActual]);

  // El radar solo se refrescaba cada 20s (junto con el reporte de ubicación) o
  // al tocar "Actualizar" a mano — una solicitud nueva podía tardar en aparecer.
  // Mientras estás conectado, refresca el radar cada 3s por su cuenta.
  useEffect(() => {
    if (!disponible || !token) return;
    const intervalo = setInterval(cargarSolicitudes, 3000);
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
    const m = { ESPERANDO: { bg: '#fef3c7', color: '#92400e', label: '⏳ Esperando respuesta del pasajero' }, CONTRAOFERTA: { bg: '#dbeafe', color: '#1e40af', label: '🔄 Contraoferta recibida' }, RECHAZADO: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' }, ACEPTADO: { bg: '#dcfce7', color: '#166534', label: '✅ Aceptado' } };
    return m[estado] || { bg: '#f1f5f9', color: '#475569', label: estado };
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
        color: #f0fdf4 !important;
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
        background: #0d1a0d !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        border-radius: 8px;
        color: #f0fdf4 !important;
        font-size: 13px;
        outline: none;
        min-width: 0;
      }
      .fuec-select option { background: #0d1a0d; color: #f0fdf4; }
    `}</style>
    <div style={{ display: 'flex', gap: '14px', height: '100%', fontFamily: 'Inter, sans-serif' }}>
    <aside style={{ width: '420px', flexShrink: 0, background: '#052e16', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* CHROME OSCURO — logo, saludo y control de conexión (protagonista) */}
      <div style={{ padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <img src={logoTurify} alt="Turify" style={{ height: '24px' }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Perfil — desde acá el conductor sube su RUNT (pestaña "Mis Docs") */}
            <button onClick={() => setMostrarPerfil(true)} title="Mi perfil"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px' }}>
              👤
            </button>
            {/* Campana de notificaciones */}
            <div onClick={() => setMostrarNotifPanel(true)}
              style={{ position: 'relative', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🔔</span>
              {notificaciones.filter(n => !n.is_read).length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', fontSize: '9px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #052e16' }}>
                  {notificaciones.filter(n => !n.is_read).length}
                </span>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={cargarSolicitudes} disabled={cargando}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', padding: '6px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
              {cargando ? '···' : 'Actualizar'}
            </motion.button>
          </div>
        </div>

        <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Hola, {usuario?.full_name?.split(' ')[0] || 'Conductor'}</p>

        {/* CONTROL PRINCIPAL — conectarse, no "pedir viajes" */}
        <button onClick={toggleDisponibilidad}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            padding: '13px', borderRadius: '12px', border: disponible ? 'none' : '1px solid rgba(255,255,255,0.18)',
            cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '14px', fontWeight: '700',
            background: disponible ? `linear-gradient(135deg, #22c55e, ${BRAND_GREEN})` : 'rgba(255,255,255,0.05)',
            color: disponible ? '#052e16' : '#f0fdf4',
            boxShadow: disponible ? '0 4px 16px rgba(34,197,94,0.3)' : 'none',
          }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: disponible ? '#052e16' : '#64748b' }} />
          {disponible ? 'Estás conectado — toca para desconectarte' : 'Conectarme'}
        </button>

        <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>
          {disponible
            ? `Viendo solicitudes cerca de ti · ${viajesActivos.length} viaje(s) activo(s)`
            : 'Conéctate para empezar a recibir solicitudes de tu zona'}
        </p>
      </div>

      {/* PESTAÑAS */}
      <div style={{ display: 'flex', gap: '6px', padding: '0 20px 16px' }}>
        {[{ id: 'radar', label: '📡 Radar', count: solicitudes.length }, { id: 'activos', label: '📋 Mis Ofertas', count: viajesActivos.length }, { id: 'ganancias', label: '💰 Ganancias', count: 0 }, { id: 'vehiculo', label: 'Mi vehículo', count: 0 }].map(tab => (
          <button key={tab.id} onClick={() => setPestanaActiva(tab.id)}
            style={{ flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '11px', transition: 'all 0.2s', backgroundColor: pestanaActiva === tab.id ? '#fff' : 'rgba(255,255,255,0.08)', color: pestanaActiva === tab.id ? BRAND_GREEN : 'rgba(255,255,255,0.7)' }}>
            {tab.label}
            {tab.count > 0 && <span style={{ background: pestanaActiva === tab.id ? BRAND_GREEN : 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', marginLeft: '4px' }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* HOJA CLARA — contenido de cada pestaña, igual mecánica de siempre */}
      <div style={{ flex: 1, background: '#fff', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', overflowY: 'auto', minHeight: 0 }}>

      {/* ALERTA ÉXITO */}
      <AnimatePresence>
        {alertaExito && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ margin: '12px 16px 0', backgroundColor: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '10px 14px', color: BRAND_GREEN, fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>
            ✅ ¡Oferta enviada al pasajero! Esperando su aceptación.
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL OFERTA */}
      <AnimatePresence>
        {solicitudModal && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ margin: '12px 16px 0', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {solicitudModal.origin}</p>
                <p style={{ margin: '2px 0', fontWeight: '700', fontSize: '13px', color: BRAND_GREEN }}>→ {solicitudModal.destination}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>👥 {(solicitudModal.adults_count || 1) + (solicitudModal.children_count || 0)} pasajero(s){solicitudModal.has_pets ? ' · 🐾' : ''}</p>
              </div>
              <button onClick={() => { setSolicitudModal(null); setPrecio(''); setErrorPrecio(''); }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>💰 ¿Cuánto cobrarías por este viaje?</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px', fontWeight: '700' }}>$</span>
                  <input type="number" placeholder="Ej: 45000" value={precio}
                    onChange={(e) => { setPrecio(e.target.value); if (errorPrecio) validarPrecio(e.target.value); }}
                    min="1" style={{ width: '100%', padding: '10px 12px 10px 26px', border: `1px solid ${errorPrecio ? '#ef4444' : '#cbd5e1'}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                {errorPrecio && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#ef4444' }}>{errorPrecio}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={enviarOferta} disabled={enviandoOferta}
                style={{ background: enviandoOferta ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: '700', fontSize: '13px', cursor: enviandoOferta ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: filtrosActivos ? '#f0fdf4' : '#f8fafc', border: `1px solid ${filtrosActivos ? BRAND_GREEN : '#e2e8f0'}`, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: filtrosActivos ? BRAND_GREEN : '#475569', cursor: 'pointer' }}>
                  <span>⚙️</span> Filtros
                  {filtrosActivos && <span style={{ background: BRAND_GREEN, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                </button>
                {filtrosActivos && (
                  <button onClick={() => setFiltros({ tipo: 'todos', pasajeros: 'todos', mascotas: false })}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' }}>
                    Limpiar filtros
                  </button>
                )}
              </div>

              <AnimatePresence>
                {mostrarFiltros && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>

                    {/* Tipo de viaje */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de viaje</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: 'ONE_WAY', label: '→ Solo ida' }, { val: 'ROUND_TRIP', label: '↩ Ida y vuelta' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, tipo: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.tipo === op.val ? BRAND_GREEN : '#e2e8f0', color: filtros.tipo === op.val ? '#fff' : '#475569' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Pasajeros */}
                    <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pasajeros</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {[{ val: 'todos', label: 'Todos' }, { val: '1', label: '1 pasajero' }, { val: '2-4', label: '2–4' }, { val: '5+', label: '5 o más' }].map(op => (
                        <button key={op.val} onClick={() => setFiltros(f => ({ ...f, pasajeros: op.val }))}
                          style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s', backgroundColor: filtros.pasajeros === op.val ? BRAND_GREEN : '#e2e8f0', color: filtros.pasajeros === op.val ? '#fff' : '#475569' }}>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Mascotas */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Solo con mascotas 🐾</p>
                      <div onClick={() => setFiltros(f => ({ ...f, mascotas: !f.mascotas }))}
                        style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: filtros.mascotas ? BRAND_GREEN : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: filtros.mascotas ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Contador de resultados filtrados */}
              {filtrosActivos && !cargando && (
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b' }}>
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
              <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}<br />
                <button onClick={cargarSolicitudes} style={{ marginTop: '8px', background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Reintentar</button>
              </div>
            )}
            {/* ESTADO VACÍO */}
            {!cargando && !error && solicitudes.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '36px 20px' }}>
                <svg width="110" height="90" viewBox="0 0 110 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '14px', opacity: 0.75 }}>
                  <circle cx="55" cy="45" r="32" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="20" fill="none" stroke="#86efac" strokeWidth="1" strokeDasharray="4 3"/>
                  <circle cx="55" cy="45" r="8" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.5"/>
                  <circle cx="55" cy="45" r="3" fill="#16a34a"/>
                  <line x1="55" y1="13" x2="55" y2="7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="55" y1="77" x2="55" y2="83" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="23" y1="45" x2="17" y2="45" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="87" y1="45" x2="93" y2="45" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
                  {disponible ? 'Radar sin señal' : 'Estás desconectado'}
                </p>
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                  {disponible
                    ? <>No hay viajes en tu zona por ahora.<br/>Vuelve a verificar en un momento.</>
                    : <>Actívate como "Disponible" (arriba) para<br/>empezar a ver viajes cerca de ti.</>}
                </p>
                {disponible ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={cargarSolicitudes}
                    style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                    🔄 Verificar de nuevo
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={toggleDisponibilidad}
                    style={{ background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                    📡 Conectarme
                  </motion.button>
                )}
              </motion.div>
            )}
            {/* ESTADO VACÍO CUANDO HAY VIAJES PERO NINGUNO PASA FILTROS */}
            {!cargando && !error && solicitudes.length > 0 && solicitudesFiltradas.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>Sin resultados con estos filtros</p>
                <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px' }}>Hay {solicitudes.length} viaje(s) disponibles, pero ninguno coincide.</p>
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
                  style={{ border: `1px solid ${estaSeleccionada ? BRAND_GREEN : '#e2e8f0'}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', boxShadow: estaSeleccionada ? `0 0 0 2px ${BRAND_GREEN}33` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                  {/* Cuerpo clickeable → traza ruta SCRUM-77 */}
                  <div onClick={() => handleClickTarjeta(sol)} style={{ padding: '14px', cursor: 'pointer', backgroundColor: estaSeleccionada ? '#f0fdf4' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {sol.origin}</p>
                        <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>→ {sol.destination}</p>
                      </div>
                      <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '20px', fontWeight: '700', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                        {sol.trip_type === 'ROUND_TRIP' ? '↩ Ida y vuelta' : '→ Solo ida'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span>🗓️ {formatearFecha(sol.departure_time)}</span>
                      <span>👥 {(sol.adults_count || 1) + (sol.children_count || 0)} pasajero(s){sol.has_pets ? ' 🐾' : ''}</span>
                    </div>
                    {estaSeleccionada && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ marginTop: '8px', fontSize: '11px', color: BRAND_GREEN, fontWeight: '600' }}>
                        🗺️ Ruta trazada en el mapa — haz clic para ocultar
                      </motion.div>
                    )}
                  </div>
                  {/* Botón oferta - SCRUM-76 */}
                  <div style={{ padding: '0 14px 14px' }}>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={(e) => { e.stopPropagation(); setSolicitudModal(sol); setPrecio(''); setErrorPrecio(''); }}
                      style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      💰 Hacer oferta
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
                🔄 Actualizar
              </button>
            </div>

            {viajesActivos.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <p style={{ margin: '0 0 6px', fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>Aún no has enviado ofertas</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Cuando hagas una oferta aparecerá aquí con su estado.</p>
              </motion.div>
            )}

            {viajesActivos.map((viaje) => {
              const esContraoferta = viaje.status === 'PASSENGER_COUNTER_OFFERED';
              const esAceptado = viaje.status === 'ACCEPTED';
              const esRechazado = viaje.status === 'REJECTED';

              const cfgEstado = {
                DRIVER_OFFERED:           { bg: '#fef3c7', color: '#92400e', label: '⏳ Esperando respuesta del pasajero' },
                PASSENGER_COUNTER_OFFERED:{ bg: '#dbeafe', color: '#1e40af', label: '🔄 Contraoferta recibida — ¡Responde!' },
                ACCEPTED:                 { bg: '#dcfce7', color: '#166534', label: '✅ Confirmado — Listo para iniciar' },
                REJECTED:                 { bg: '#fee2e2', color: '#991b1b', label: '❌ Rechazado' },
              };
              // Estado real del viaje (viene del trip_status)
              const cfgViaje = {
                ASSIGNED:    { bg: '#dcfce7', color: '#166534', label: '✅ Viaje confirmado' },
                IN_PROGRESS: { bg: '#dbeafe', color: '#1e40af', label: '🚗 Viaje en curso' },
                COMPLETED:   { bg: '#e0e7ff', color: '#3730a3', label: '🏁 Viaje completado' },
              };
              const estadoViaje = viaje.trip_status;
              const est = cfgEstado[viaje.status] || { bg: '#f1f5f9', color: '#475569', label: viaje.status };

              return (
                <motion.div key={viaje.offer_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ border: `1px solid ${esContraoferta ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', marginBottom: '12px',
                    boxShadow: esContraoferta ? '0 0 0 2px #3b82f633' : 'none', transition: 'all 0.2s' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>📍 {viaje.origin}</p>
                      <p style={{ margin: '2px 0', fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>→ {viaje.destination}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>🗓️ {formatearFecha(viaje.departure_time)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: BRAND_GREEN }}>${Number(viaje.offered_price).toLocaleString()}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                        {esContraoferta ? 'Precio del pasajero' : 'Tu oferta'}
                      </p>
                    </div>
                  </div>

                  <span style={{ display: 'inline-block', backgroundColor: est.bg, color: est.color, borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', marginBottom: esContraoferta ? '10px' : '0' }}>
                    {est.label}
                  </span>

                  {/* SCRUM-84: Botones para responder contraoferta */}
                  {esContraoferta && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'ACCEPT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'ACCEPT'}
                        style={{ flex: 1, background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'ACCEPT' ? '...' : '✅ Aceptar precio'}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => resolverContraoferta(viaje.offer_id, 'REJECT')}
                        disabled={resolviendoOferta === viaje.offer_id + 'REJECT'}
                        style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '8px', padding: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        {resolviendoOferta === viaje.offer_id + 'REJECT' ? '...' : '❌ Rechazar'}
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
                      style={{ marginTop: '10px', width: '100%', padding: '9px', background: '#dcfce7', border: '1px solid #16a34a', borderRadius: '8px', color: '#14532d', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      👥 Ver ocupantes del viaje
                    </button>
                  )}

                  {esAceptado && estadoViaje === 'ASSIGNED' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                        🎉 Viaje confirmado — cuando recojas al pasajero, inicia el viaje
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'start')}
                        disabled={gestionandoViaje === viaje.request_id + 'start'}
                        style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'start' ? '...' : '🚗 Iniciar viaje'}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'IN_PROGRESS' && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ backgroundColor: '#dbeafe', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>
                        🚗 Viaje en curso — finaliza cuando llegues al destino
                      </div>
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => gestionarViaje(viaje.request_id, 'complete')}
                        disabled={gestionandoViaje === viaje.request_id + 'complete'}
                        style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                        {gestionandoViaje === viaje.request_id + 'complete' ? '...' : '🏁 Finalizar viaje'}
                      </motion.button>
                    </div>
                  )}

                  {esAceptado && estadoViaje === 'COMPLETED' && (
                    <div style={{ marginTop: '10px', backgroundColor: '#e0e7ff', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#3730a3', fontWeight: '600', textAlign: 'center' }}>
                      🏁 Viaje completado — ¡Buen trabajo!
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
                        border: `1px solid ${viaje.ya_califico ? '#cbd5e1' : '#eab308'}`,
                        borderRadius: '8px',
                        color: viaje.ya_califico ? '#94a3b8' : '#a16207',
                        fontSize: '12px', fontWeight: '700', cursor: viaje.ya_califico ? 'default' : 'pointer'
                      }}>
                      {viaje.ya_califico ? '✅ Ya calificaste a este pasajero' : '⭐ Calificar pasajero'}
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
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>Cargando...</div>
            )}

            {errorGanancias && !cargandoGanancias && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{errorGanancias}</p>
                <button onClick={cargarGanancias} style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                  🔄 Reintentar
                </button>
              </div>
            )}

            {ganancias && !cargandoGanancias && !errorGanancias && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, background: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '12px', padding: '14px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Esta semana</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: BRAND_GREEN }}>${ganancias.ganancias_semana.toLocaleString('es-CO')}</p>
                  </div>
                  <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Este mes</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>${ganancias.ganancias_mes.toLocaleString('es-CO')}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{ganancias.viajes_completados}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Viajes completados</p>
                  </div>
                  <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                      {ganancias.calificacion_promedio != null ? `★ ${ganancias.calificacion_promedio}` : '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                      {ganancias.calificacion_promedio != null ? 'Calificación' : 'Calificación (próximamente)'}
                    </p>
                  </div>
                </div>

                {ganancias.viajes_completados === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Aún no tienes viajes completados. Cuando finalices tu primer viaje, aquí verás tus ganancias y estadísticas.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Horarios más activos</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
                        {ganancias.horarios_activos.map((cant, hora) => {
                          const max = Math.max(...ganancias.horarios_activos, 1);
                          return (
                            <div key={hora} title={`${hora}:00 — ${cant} viaje(s)`}
                              style={{ flex: 1, height: `${Math.max((cant / max) * 100, 4)}%`, background: cant > 0 ? BRAND_GREEN : '#e2e8f0', borderRadius: '2px' }} />
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: '#94a3b8' }}>
                        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                      </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Rutas más frecuentes</p>
                      {ganancias.top_rutas.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < ganancias.top_rutas.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <span style={{ fontSize: '12px', color: '#334155' }}>{r.ruta}</span>
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
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>Cargando...</div>
            )}

            {errorVehiculo && !cargandoVehiculo && (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{errorVehiculo}</p>
                <button onClick={cargarVehiculo} style={{ background: 'none', border: `1px solid ${BRAND_GREEN}`, color: BRAND_GREEN, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                  Reintentar
                </button>
              </div>
            )}

            {formVehiculo && !cargandoVehiculo && !errorVehiculo && (
              <>
                <div style={{ background: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Placa {formVehiculo.plate} · Categoría {formVehiculo.categoria}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#166534' }}>
                    La categoría se calcula automáticamente según la capacidad real de tu vehículo y se usa para sugerirte a los pasajeros que buscan tu tipo de vehículo.
                  </p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>Capacidad real (pasajeros)</label>
                  <input type="number" min="1" max="60" value={formVehiculo.capacidad_real ?? ''}
                    onChange={e => setFormVehiculo({ ...formVehiculo, capacidad_real: e.target.value })}
                    placeholder={`Registrada: ${formVehiculo.capacity}`}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} />
                </div>

                <p style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Comodidades</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    ['tiene_ac', 'Aire acondicionado'],
                    ['tiene_wifi', 'WiFi'],
                    ['tiene_bano', 'Baño'],
                    ['tiene_musica', 'Música'],
                    ['tiene_maletero_amplio', 'Maletero amplio'],
                    ['tiene_sillas_bebe', 'Sillas para bebé'],
                  ].map(([campo, etiqueta]) => (
                    <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!formVehiculo[campo]}
                        onChange={e => setFormVehiculo({ ...formVehiculo, [campo]: e.target.checked })} />
                      {etiqueta}
                    </label>
                  ))}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: formVehiculo.acepta_mascotas ? '10px' : 0 }}>
                    <input type="checkbox" checked={!!formVehiculo.acepta_mascotas}
                      onChange={e => setFormVehiculo({ ...formVehiculo, acepta_mascotas: e.target.checked, cargo_mascota: e.target.checked ? formVehiculo.cargo_mascota : 0 })} />
                    Acepto mascotas
                  </label>
                  {formVehiculo.acepta_mascotas && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Cargo adicional por mascota (COP)</label>
                      <input type="number" min="0" value={formVehiculo.cargo_mascota ?? ''}
                        onChange={e => setFormVehiculo({ ...formVehiculo, cargo_mascota: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} />
                    </div>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#334155', marginBottom: '14px' }}>
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
    <main style={{ flex: 1, position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        {mapsLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={ubicacionActual || centroDefaultAntioquia}
            zoom={ubicacionActual ? 12 : 9}
            options={{ disableDefaultUI: true, zoomControl: true }}
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
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: BRAND_GREEN, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }} />
            )}

            {disponible && solicitudesConUbicacion.map(sol => (
              <MarkerF key={sol.request_id} position={{ lat: sol.origin_lat, lng: sol.origin_lng }}
                title={`${sol.origin} → ${sol.destination}`}
                onClick={() => { setSolicitudModal(sol); setPrecio(''); setErrorPrecio(''); }}
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />
            ))}
          </GoogleMap>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '14px' }}>
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
              style={{ position: 'fixed', top: 0, right: 0, width: '360px', maxWidth: '100vw', height: '100vh', backgroundColor: '#fff', zIndex: 3001, boxShadow: '-5px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

              {/* Header notif */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>🔔 Notificaciones</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {notificaciones.filter(n => !n.is_read).length} sin leer
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {notificaciones.filter(n => !n.is_read).length > 0 && (
                    <button onClick={marcarTodasLeidas}
                      style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                      ✓ Leer todas
                    </button>
                  )}
                  <button onClick={() => setMostrarNotifPanel(false)}
                    style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>
              </div>

              {/* Lista notif */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {notificaciones.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔕</div>
                    <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>Sin notificaciones</p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Aquí verás cuando el pasajero responda.</p>
                  </div>
                )}
                {notificaciones.map((notif) => {
                  const cfg = {
                    NEW_OFFER:      { icono: '💰', color: '#7c3aed', bg: '#f5f3ff' },
                    COUNTER_OFFER:  { icono: '🔄', color: '#1d4ed8', bg: '#eff6ff' },
                    TRIP_ACCEPTED:  { icono: '✅', color: '#15803d', bg: '#f0fdf4' },
                    TRIP_REJECTED:  { icono: '❌', color: '#dc2626', bg: '#fef2f2' },
                    TRIP_STARTED:   { icono: '🚗', color: '#0369a1', bg: '#f0f9ff' },
                    TRIP_COMPLETED: { icono: '🏁', color: '#4f46e5', bg: '#eef2ff' },
                    SYSTEM:         { icono: '📢', color: '#64748b', bg: '#f8fafc' },
                  }[notif.type] || { icono: '📢', color: '#64748b', bg: '#f8fafc' };

                  return (
                    <div key={notif.notification_id}
                      onClick={() => !notif.is_read && marcarLeida(notif.notification_id)}
                      style={{ backgroundColor: notif.is_read ? '#fff' : cfg.bg, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', border: `1px solid ${notif.is_read ? '#e2e8f0' : cfg.color + '33'}`, cursor: notif.is_read ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{cfg.icono}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ margin: 0, fontWeight: notif.is_read ? '600' : '700', fontSize: '13px', color: notif.is_read ? '#475569' : '#1e293b' }}>
                              {notif.title}
                            </p>
                            {!notif.is_read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0, marginTop: '3px' }} />}
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

      {/* MODAL OCUPANTES FUEC — position fixed */}
      <AnimatePresence>
        {modalOcupantesId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalOcupantesId(null)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9000 }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ pointerEvents: 'all', width: '440px', maxWidth: '95vw', maxHeight: '80vh', backgroundColor: '#0f1a0f', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: BRAND_GREEN }}>Documento de viaje</p>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f0fdf4', fontFamily: "'Syne', sans-serif" }}>Ocupantes registrados</h3>
                </div>
                <button onClick={() => setModalOcupantesId(null)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '30px', height: '30px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {!ocupantesPorViaje[modalOcupantesId] || ocupantesPorViaje[modalOcupantesId].length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>El pasajero aún no ha registrado los ocupantes.</p>
                  </div>
                ) : (
                  ocupantesPorViaje[modalOcupantesId].map((oc, i) => (
                    <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#f0fdf4' }}>{oc.full_name}</p>
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
                  style={{ width: '100%', padding: '11px', background: `linear-gradient(135deg, ${BRAND_GREEN}, #16a34a)`, border: 'none', borderRadius: '9px', color: '#052e16', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}>
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
              style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', zIndex: 3001, width: '360px', maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: 'Inter, sans-serif' }}>
              <h3 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '17px' }}>⭐ ¿Cómo estuvo tu pasajero?</h3>
              <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '13px' }}>Tu calificación queda registrada en su perfil.</p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setEstrellasCalificar(n)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '30px', padding: 0, color: n <= estrellasCalificar ? '#eab308' : '#e2e8f0' }}>
                    ★
                  </button>
                ))}
              </div>

              <textarea value={comentarioCalificar} onChange={e => setComentarioCalificar(e.target.value)}
                placeholder="Cuéntanos más (opcional)" rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: '16px' }} />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setModalCalificar(null)}
                  style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={enviarCalificacion} disabled={enviandoCalificacion || estrellasCalificar < 1}
                  style={{ flex: 1, background: (enviandoCalificacion || estrellasCalificar < 1) ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: (enviandoCalificacion || estrellasCalificar < 1) ? 'not-allowed' : 'pointer' }}>
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