import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { AuthContext } from './AuthContext';
import { useNavigate } from 'react-router-dom';

import API_BASE_URL from './api';
import {
  T, EstilosBase, Chip, Rotulo, LogoWordmark, BotonTema, useTema,
  IconReloj, IconPersona, IconAuto, IconClipboard, IconPrecio,
  IconCandado, IconProhibido, IconMapa, IconChincheta, IconBandeja,
  IconLupa, IconRecargar, IconFlechaIzq, IconAlerta, IconEscudo,
} from './diseno';

// Texto sobre el verde monte — el monte es oscuro en los dos temas.
const CLARO = '#EAF2EC';
const claro = (a) => `rgba(234,242,236,${a})`;
const SOBRE_MONTE = { fondo: 'rgba(255,255,255,0.07)', linea: T.monteLinea };

// Cada acción tiene tono e icono; el tono agrupa (entrar, crear, revisar) y el
// icono distingue, así dos acciones del mismo color no se confunden.
const TONOS = {
  verde:  { fondo: T.musgo,       linea: T.musgoLinea,  texto: T.musgoTexto },
  alerta: { fondo: T.alertaSuave, linea: T.alertaLinea, texto: T.alertaTexto },
  cielo:  { fondo: T.cieloSuave,  linea: T.cieloLinea,  texto: T.cieloTexto },
  chiva:  { fondo: T.chivaSuave,  linea: T.chivaLinea,  texto: T.chivaTexto },
  neutro: { fondo: T.niebla,      linea: T.linea,       texto: T.piedra },
};

const CONFIG_ACCION = {
  // HU seguridad (OWASP A09) — primero la alerta, para que salte a la vista
  // apenas se entra al panel de auditoría.
  ALERTA_FUERZA_BRUTA: { tono: 'alerta', Ico: IconAlerta,     label: 'Alerta: fuerza bruta' },
  LOGIN:             { tono: 'verde',  Ico: IconCandado,    label: 'Ingreso' },
  LOGIN_FAILED:      { tono: 'alerta', Ico: IconProhibido,  label: 'Ingreso fallido' },
  REGISTER:          { tono: 'cielo',  Ico: IconPersona,    label: 'Registro' },
  CREATE_TRIP:       { tono: 'chiva',  Ico: IconMapa,       label: 'Viaje creado' },
  CREATE_OFFER:      { tono: 'chiva',  Ico: IconPrecio,     label: 'Oferta enviada' },
  ACCEPT_OFFER:      { tono: 'verde',  Ico: IconPrecio,     label: 'Oferta aceptada' },
  REJECT_OFFER:      { tono: 'alerta', Ico: IconPrecio,     label: 'Oferta rechazada' },
  VERIFY_DOCUMENT:   { tono: 'verde',  Ico: IconClipboard,  label: 'Documento verificado' },
  REGISTER_DRIVER:   { tono: 'cielo',  Ico: IconAuto,       label: 'Registro de conductor' },
  UPLOAD_RUNT:       { tono: 'cielo',  Ico: IconClipboard,  label: 'RUNT enviado' },
  ROLE_CHANGE:       { tono: 'chiva',  Ico: IconEscudo,     label: 'Cambio de rol' },
};

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'ALERTA_FUERZA_BRUTA', label: 'Alertas' },
  { value: 'LOGIN', label: 'Ingresos' },
  { value: 'LOGIN_FAILED', label: 'Ingresos fallidos' },
  { value: 'REGISTER', label: 'Registros' },
  { value: 'CREATE_TRIP', label: 'Viajes' },
  { value: 'CREATE_OFFER', label: 'Ofertas' },
  { value: 'VERIFY_DOCUMENT', label: 'Verificaciones' },
  { value: 'ROLE_CHANGE', label: 'Cambios de rol' },
];

// Fila de la bitácora: los datos oficiales van en monoespaciada.
const celda = { padding: '9px 16px', verticalAlign: 'middle' };
const celdaDato = { ...celda, fontFamily: T.dato, fontSize: '12.5px', letterSpacing: '.04em', whiteSpace: 'nowrap' };

const AdminLogs = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tema, alternarTema] = useTema();

  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroAccion, setFiltroAccion] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargarLogs = async (accion = '') => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (accion) params.append('action', accion);

      const res = await fetch(`${API_BASE_URL}/admin/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { if (token) cargarLogs(filtroAccion); }, [token, filtroAccion]);

  const formatearFecha = (fecha) => {
    try {
      return new Date(fecha).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return fecha; }
  };

  const logsFiltrados = logs.filter(l => {
    if (!busqueda) return true;
    const texto = `${l.detail} ${l.action} ${l.ip_address} ${l.user_id}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  // Contadores por tipo
  const contadores = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.niebla2, fontFamily: T.ui }}>
      <EstilosBase />

      {/* CABECERA OSCURA — la marca y el regreso al panel, como en el resto de la app */}
      <header style={{ background: T.monte, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button onClick={() => navigate('/admin/conductores')} className="t-foco"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: SOBRE_MONTE.fondo, border: `1px solid ${SOBRE_MONTE.linea}`, borderRadius: T.rControl, padding: '9px 14px', cursor: 'pointer', fontSize: '13.5px', fontFamily: T.ui, fontWeight: 600, color: claro(0.9) }}>
            <IconFlechaIzq size={15} />Volver al panel
          </button>
          <div>
            <LogoWordmark alto={13} oscuro />
            <h1 style={{ margin: '10px 0 0', fontSize: '21px', fontWeight: 800, fontFamily: T.display, letterSpacing: '-.02em', color: CLARO }}>Bitácora de auditoría</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <BotonTema tema={tema} alternar={alternarTema} compacto />
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => cargarLogs(filtroAccion)} className="t-foco"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: T.ruta, color: '#fff', border: '1px solid transparent', borderRadius: T.rControl, padding: '10px 16px', cursor: 'pointer', fontFamily: T.ui, fontWeight: 700, fontSize: '13.5px' }}>
            <IconRecargar size={15} />{cargando ? 'Actualizando' : 'Actualizar'}
          </motion.button>
        </div>
      </header>

      <div style={{ padding: '24px 40px' }}>

        <Rotulo style={{ marginBottom: '10px' }}>Historial de acciones del sistema</Rotulo>

        {/* TARJETAS RESUMEN — cada una filtra la tabla por su acción */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(CONFIG_ACCION).map(([accion, cfg]) => {
            const tono = TONOS[cfg.tono];
            const activa = filtroAccion === accion;
            return (
              <button key={accion} type="button" className="t-foco"
                onClick={() => setFiltroAccion(activa ? '' : accion)}
                style={{
                  textAlign: 'left', backgroundColor: activa ? tono.fondo : T.papel, borderRadius: T.rTarjeta, padding: '14px',
                  border: `1px solid ${activa ? tono.linea : T.linea}`, cursor: 'pointer',
                  fontFamily: T.ui, transition: 'background .18s, border-color .18s',
                }}>
                <span style={{ display: 'flex', color: tono.texto, marginBottom: '8px' }}><cfg.Ico size={19} /></span>
                <div style={{ fontFamily: T.dato, fontSize: '23px', fontWeight: 600, color: tono.texto }}>{contadores[accion] || 0}</div>
                <div style={{ fontSize: '12.5px', color: T.piedra, marginTop: '3px' }}>{cfg.label}</div>
              </button>
            );
          })}
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div style={{ backgroundColor: T.papel, borderRadius: T.rTarjeta, padding: '16px 20px', marginBottom: '16px', border: `1px solid ${T.linea}`, display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', border: `1px solid ${T.linea}`, borderRadius: T.rControl, background: T.niebla, color: T.piedraClara }}>
            <IconLupa size={15} />
            <input
              type="text"
              placeholder="Buscá en la bitácora"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '9px 0', border: 'none', background: 'transparent', fontSize: '14px', fontFamily: T.ui, color: T.tinta, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltroAccion(f.value)} className="t-foco"
                style={{ padding: '7px 13px', borderRadius: T.rChip, cursor: 'pointer', fontSize: '12.5px', fontFamily: T.ui, fontWeight: 600, transition: 'background .18s, color .18s',
                  border: `1px solid ${filtroAccion === f.value ? T.tinta : T.linea}`,
                  backgroundColor: filtroAccion === f.value ? T.tinta : T.niebla,
                  color: filtroAccion === f.value ? T.papel : T.piedra }}>
                {f.label}
              </button>
            ))}
          </div>
          <span style={{ fontFamily: T.dato, fontSize: '12.5px', color: T.piedraClara, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {logsFiltrados.length} registro{logsFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* TABLA DE LA BITÁCORA — filas densas y desplazamiento horizontal
            propio, para que la tabla no empuje el ancho de la página. */}
        <div style={{ backgroundColor: T.papel, borderRadius: T.rTarjeta, border: `1px solid ${T.linea}`, overflow: 'hidden' }}>
          {cargando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '50px', color: T.piedra, fontSize: '14px' }}>
              <IconReloj size={16} />Cargando la bitácora
            </div>
          ) : logsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: T.piedra }}>
              <span style={{ display: 'inline-flex', color: T.piedraClara, marginBottom: '12px' }}><IconBandeja size={34} /></span>
              <p style={{ margin: 0, fontSize: '14px' }}>No hay registros que mostrar.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: T.niebla, borderBottom: `1px solid ${T.linea}` }}>
                    {['ID', 'Acción', 'Usuario', 'Detalle', 'IP', 'Fecha'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: T.dato, fontWeight: 500, color: T.piedraClara, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '.16em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsFiltrados.map((log, i) => {
                    const cfg = CONFIG_ACCION[log.action] || { tono: 'neutro', Ico: IconChincheta, label: log.action };
                    return (
                      <tr key={log.log_id} style={{ borderBottom: `1px solid ${T.linea}`, backgroundColor: i % 2 === 0 ? T.papel : T.niebla }}>
                        <td style={{ ...celdaDato, color: T.piedraClara }}>#{log.log_id}</td>
                        <td style={celda}>
                          <Chip tono={cfg.tono === 'neutro' ? 'neutro' : cfg.tono} style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                            <cfg.Ico size={13} />{cfg.label}
                          </Chip>
                        </td>
                        <td style={{ ...celdaDato, color: T.piedra }}>
                          {log.user_id ? `#${log.user_id}` : '—'}
                        </td>
                        <td style={{ ...celda, color: T.tinta, maxWidth: '320px' }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.detail}>
                            {log.detail || '—'}
                          </span>
                        </td>
                        <td style={{ ...celdaDato, color: T.piedra }}>
                          {log.ip_address || '—'}
                        </td>
                        <td style={{ ...celdaDato, color: T.piedra }}>
                          {formatearFecha(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
