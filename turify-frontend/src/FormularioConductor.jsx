import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import API_BASE_URL from './api';
import {
  T, EstilosBase, Boton, Rotulo, LogoWordmark,
  Icono, IconReloj, IconVisto, IconEquis, IconAlerta, IconPersona,
  IconAuto, IconClipboard, IconRecibo, IconIdea,
} from './diseno';

const BRAND_GREEN = T.ruta;

const IconEscudo   = (p) => <Icono {...p}><path d="M12 3.2 5 6v5.6c0 4.3 3 7.7 7 9.2 4-1.5 7-4.9 7-9.2V6l-7-2.8Z" /><path d="M9 12l2.2 2.2L15.4 10" /></Icono>;
const IconTarjeta  = (p) => <Icono {...p}><rect x="3" y="6" width="18" height="12" rx="2.4" /><path d="M3 10h18M6.5 14h4" /></Icono>;
const IconLlave    = (p) => <Icono {...p}><circle cx="8.5" cy="12" r="3.6" /><path d="M12.1 12H20M17 12v3M20 12v2.4" /></Icono>;
const IconSubir    = (p) => <Icono {...p}><path d="M12 16.5V4.5M8 8.5l4-4 4 4" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></Icono>;
const IconFlechaIz = (p) => <Icono {...p}><path d="M11 6l-6 6 6 6M5 12h14" /></Icono>;

const ETIQUETA_DOCUMENTO = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Revisión Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros (Contractual / Extracontractual)',
};

// Tamaño legible para el archivo cargado — confirma que subió el correcto.
const pesoLegible = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  ZONA DE CARGA — tres estados claros: vacía, arrastrando y con archivo.
// ─────────────────────────────────────────────────────────────────────────────
const DropZone = ({ label, name, onChange, file, Ico = IconSubir }) => {
  const [arrastrando, setArrastrando] = useState(false);
  const cargado = Boolean(file);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault(); setArrastrando(false);
        if (e.dataTransfer.files?.length > 0) onChange({ target: { name, type: 'file', files: e.dataTransfer.files } });
      }}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: '13px',
        border: `1.5px ${cargado ? 'solid' : 'dashed'} ${arrastrando ? BRAND_GREEN : cargado ? T.musgoLinea : T.linea}`,
        borderRadius: T.rTarjeta, padding: '15px 16px', minHeight: '76px',
        background: arrastrando ? T.musgo : cargado ? T.musgo : T.niebla,
        cursor: 'pointer', transition: 'border-color .18s, background .18s',
      }}>
      <input type="file" name={name} onChange={onChange} aria-label={label}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />

      <span style={{
        flexShrink: 0, width: '38px', height: '38px', borderRadius: '11px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cargado ? 'transparent' : T.papel,
        border: `1px solid ${cargado ? 'transparent' : T.linea}`,
        color: cargado ? T.musgoTexto : T.piedraClara,
      }}>
        {cargado ? <IconVisto size={19} /> : <Ico size={18} />}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: cargado ? T.musgoTexto : T.tinta }}>{label}</div>
        <div style={{ fontSize: '12.5px', color: cargado ? T.musgoTexto : T.piedraClara, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cargado
            ? <>{file.name} · <span style={{ fontFamily: T.dato }}>{pesoLegible(file.size)}</span></>
            : 'Arrastrá el archivo o hacé clic'}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  ENCABEZADO DE SECCIÓN — el número sí es una secuencia real (datos, vehículo,
//  documentos), así que se numera; va en monoespaciada como el resto de datos.
// ─────────────────────────────────────────────────────────────────────────────
const Seccion = ({ n, titulo, descripcion, Ico, completa, children }) => (
  <section style={{ marginBottom: '36px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: `1px solid ${T.linea}`, marginBottom: '18px' }}>
      <span style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '9px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: completa ? T.musgo : T.niebla2,
        border: `1px solid ${completa ? T.musgoLinea : T.linea}`,
        color: completa ? T.musgoTexto : T.piedra,
      }}>
        {completa ? <IconVisto size={16} /> : <Ico size={16} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: T.tinta, fontFamily: T.display, letterSpacing: '-.01em' }}>
          {titulo}
        </h3>
        {descripcion && <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: T.piedra }}>{descripcion}</p>}
      </div>
      <span style={{ fontFamily: T.dato, fontSize: '12px', letterSpacing: '.14em', color: T.piedraClara, flexShrink: 0 }}>
        {String(n).padStart(2, '0')}
      </span>
    </div>
    {children}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Campo con etiqueta visible — el placeholder solo no sirve: desaparece al
//  escribir y deja al usuario sin saber qué escribió en cada casilla.
// ─────────────────────────────────────────────────────────────────────────────
const Campo = ({ etiqueta, hijo, ancho }) => (
  <div style={{ gridColumn: ancho ? 'span 2' : undefined }}>
    <label style={{ display: 'block', fontFamily: T.dato, fontSize: '11px', fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: T.piedraClara, marginBottom: '6px' }}>
      {etiqueta}
    </label>
    {hijo}
  </div>
);

const estiloEntrada = {
  padding: '12px 14px', border: `1px solid ${T.linea}`, borderRadius: T.rControl,
  width: '100%', boxSizing: 'border-box', background: T.papel, color: T.tinta,
  fontSize: '15px', fontFamily: T.ui, outline: 'none',
};
const estiloBloqueado = { ...estiloEntrada, background: T.niebla2, color: T.piedra, cursor: 'not-allowed' };

// ─────────────────────────────────────────────────────────────────────────────
//  VISTA DE ESTADO — cuando los documentos ya se enviaron.
// ─────────────────────────────────────────────────────────────────────────────
const VistaEstadoDocumentos = ({ estadoData, onVolver }) => {
  const config = {
    PENDIENTE: { Ico: IconReloj,  color: T.chivaTexto,  bg: T.chivaSuave,  borde: T.chivaLinea,  titulo: 'Documentos en revisión', descripcion: 'Un administrador está revisando tus documentos. Te avisamos apenas haya respuesta.' },
    APROBADO:  { Ico: IconVisto,  color: T.musgoTexto,  bg: T.musgo,       borde: T.musgoLinea,  titulo: 'Ya sos conductor',      descripcion: 'Tus documentos quedaron aprobados. Ya podés recibir solicitudes de viaje.' },
    RECHAZADO: { Ico: IconEquis,  color: T.alertaTexto, bg: T.alertaSuave, borde: T.alertaLinea, titulo: 'Documentos rechazados', descripcion: 'Algunos documentos no pasaron la revisión. Corregilos y volvé a enviarlos.' },
  };
  const c = config[estadoData.estado] || config.PENDIENTE;

  const estadoDoc = (e) => e === 'APPROVED'
    ? { bg: T.musgo, color: T.musgoTexto, Ico: IconVisto, label: 'Aprobado' }
    : e === 'REJECTED'
      ? { bg: T.alertaSuave, color: T.alertaTexto, Ico: IconEquis, label: 'Rechazado' }
      : { bg: T.chivaSuave, color: T.chivaTexto, Ico: IconReloj, label: 'Pendiente' };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '620px', margin: '0 auto', background: T.papel, borderRadius: '18px', border: `1px solid ${T.linea}`, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 24px 50px -34px rgba(0,0,0,.35)', overflow: 'hidden' }}>

      <Cabecera titulo="Estado de tu solicitud" onVolver={onVolver} />

      <div style={{ padding: '28px 30px 32px' }}>
        <div style={{ background: c.bg, border: `1px solid ${c.borde}`, borderRadius: T.rTarjeta, padding: '26px 24px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: T.papel, border: `1px solid ${c.borde}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: c.color }}>
            <c.Ico size={24} />
          </div>
          <h3 style={{ margin: '0 0 7px', color: c.color, fontSize: '18px', fontFamily: T.display, fontWeight: 800, letterSpacing: '-.01em' }}>{c.titulo}</h3>
          <p style={{ margin: '0 auto', color: T.piedra, fontSize: '14.5px', lineHeight: 1.6, maxWidth: '42ch' }}>{c.descripcion}</p>
        </div>

        {estadoData.documentos && (
          <div>
            <Rotulo style={{ marginBottom: '12px' }}>Estado por documento</Rotulo>
            {estadoData.documentos.map((doc, i) => {
              const e = estadoDoc(doc.estado);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: T.rControl, border: `1px solid ${T.linea}`, marginBottom: '8px', background: T.niebla }}>
                  <span style={{ fontSize: '14px', color: T.tinta, fontWeight: 600 }}>{ETIQUETA_DOCUMENTO[doc.tipo] || doc.tipo}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: T.rChip, fontSize: '11.5px', fontWeight: 700, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>
                    <e.Ico size={12} />{e.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {estadoData.documentos_rechazados?.length > 0 && (
          <div style={{ background: T.alertaSuave, border: `1px solid ${T.alertaLinea}`, borderRadius: T.rTarjeta, padding: '15px 17px', marginTop: '16px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, color: T.alertaTexto, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <IconAlerta size={14} />Tenés que volver a enviar:
            </p>
            {estadoData.documentos_rechazados.map((tipo, i) => (
              <p key={i} style={{ margin: '4px 0', fontSize: '13.5px', color: T.alertaTexto }}>· {ETIQUETA_DOCUMENTO[tipo] || tipo}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Cabecera compartida — monte, como la entrada y el panel del conductor.
const Cabecera = ({ titulo, onVolver }) => (
  <div style={{ position: 'relative', overflow: 'hidden', background: T.monte, padding: '20px 26px' }}>
    <svg viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
      <g fill="none" stroke="#86EFAC" strokeWidth="1">
        <path d="M-10 66 C 90 48, 210 82, 310 62 S 510 36, 610 56" />
        <path d="M-10 82 C 90 64, 210 98, 310 78 S 510 52, 610 72" />
        <path d="M-10 50 C 90 34, 210 66, 310 46 S 510 22, 610 40" />
      </g>
    </svg>
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <LogoWordmark alto={13} oscuro />
        <h2 style={{ margin: '12px 0 0', fontSize: '21px', fontWeight: 800, color: '#fff', fontFamily: T.display, letterSpacing: '-.02em' }}>{titulo}</h2>
      </div>
      <button type="button" onClick={onVolver} className="t-foco"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.monteLinea}`, color: 'rgba(234,242,236,.9)', padding: '8px 14px', borderRadius: T.rControl, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', fontFamily: T.ui }}>
        <IconFlechaIz size={14} />Volver al mapa
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const FormularioConductor = () => {
  const navigate = useNavigate();
  const { token, usuario } = useContext(AuthContext);

  const [estadoCarga, setEstadoCarga] = useState('cargando'); // 'cargando' | 'mostrar_formulario' | 'mostrar_estado'
  const [estadoData, setEstadoData] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const [formConductor, setFormConductor] = useState({
    age: '', affiliated_company: '', profile_photo: null,
    plate: '', capacity: '', vehicle_photo: null,
    doc_soat: null, doc_licencia: null, doc_tarjeta_operacion: null,
    doc_tecnomecanica: null, doc_seguros: null,
    // HU55 — comodidades del vehículo, opcionales (se pueden dejar sin marcar
    // y configurar después desde el panel del conductor)
    tiene_ac: false, tiene_wifi: false, tiene_bano: false, tiene_musica: false,
    tiene_maletero_amplio: false, tiene_sillas_bebe: false,
    tiene_sillas_reclinables: false, tiene_cargador_usb: false, tiene_tv: false, tiene_buen_audio: false,
    acepta_mascotas: false,
  });

  const datosUsuario = {
    full_name: usuario?.full_name || '',
    email: usuario?.email || '',
    phone_number: usuario?.phone_number || ''
  };

  // Al cargar, consultar el estado de documentos del usuario
  useEffect(() => {
    const consultarEstado = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/drivers/registration-status`, {
          headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data.estado === 'SIN_DOCUMENTOS' || data.estado === 'RECHAZADO') {
          setEstadoData(data);
          setEstadoCarga('mostrar_formulario');
        } else {
          setEstadoData(data);
          setEstadoCarga('mostrar_estado');
        }
      } catch {
        // Si falla la consulta, mostramos el formulario de todas formas
        setEstadoCarga('mostrar_formulario');
      }
    };
    consultarEstado();
  }, [token]);

  const handleInputConductor = (e) => {
    const { name, value, type, files, checked } = e.target;
    if (errorEnvio) setErrorEnvio('');
    setFormConductor(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : type === 'checkbox' ? checked : value
    }));
  };

  const enviarFormularioConductor = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrorEnvio('');

    const formData = new FormData();
    formData.append('age', formConductor.age);
    formData.append('affiliated_company', formConductor.affiliated_company);
    formData.append('plate', formConductor.plate);
    formData.append('capacity', formConductor.capacity);
    // HU55 — comodidades opcionales del vehículo
    formData.append('tiene_ac', formConductor.tiene_ac);
    formData.append('tiene_wifi', formConductor.tiene_wifi);
    formData.append('tiene_bano', formConductor.tiene_bano);
    formData.append('tiene_musica', formConductor.tiene_musica);
    formData.append('tiene_maletero_amplio', formConductor.tiene_maletero_amplio);
    formData.append('tiene_sillas_bebe', formConductor.tiene_sillas_bebe);
    formData.append('tiene_sillas_reclinables', formConductor.tiene_sillas_reclinables);
    formData.append('tiene_cargador_usb', formConductor.tiene_cargador_usb);
    formData.append('tiene_tv', formConductor.tiene_tv);
    formData.append('tiene_buen_audio', formConductor.tiene_buen_audio);
    formData.append('acepta_mascotas', formConductor.acepta_mascotas);
    if (formConductor.profile_photo) formData.append('profile_photo', formConductor.profile_photo);
    if (formConductor.vehicle_photo) formData.append('vehicle_photo', formConductor.vehicle_photo);
    if (formConductor.doc_soat) formData.append('doc_soat', formConductor.doc_soat);
    if (formConductor.doc_licencia) formData.append('doc_licencia', formConductor.doc_licencia);
    if (formConductor.doc_tarjeta_operacion) formData.append('doc_tarjeta_operacion', formConductor.doc_tarjeta_operacion);
    if (formConductor.doc_tecnomecanica) formData.append('doc_tecnomecanica', formConductor.doc_tecnomecanica);
    if (formConductor.doc_seguros) formData.append('doc_seguros', formConductor.doc_seguros);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/drivers/register-details`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: formData
      });

      if (!respuesta.ok) {
        const errorData = await respuesta.json();
        throw new Error(errorData.detail || 'No se pudo enviar la solicitud.');
      }

      setEstadoData({
        estado: 'PENDIENTE',
        mensaje: 'Tus documentos están siendo revisados por el administrador.',
        documentos: null
      });
      setEstadoCarga('mostrar_estado');

    } catch (error) {
      // Antes esto era un alert() del navegador: cortaba el flujo y no dejaba
      // ver el formulario. Ahora el error se queda junto al botón de envío.
      setErrorEnvio(error.message);
    } finally {
      setEnviando(false);
    }
  };

  // ── Progreso: el formulario es largo, conviene decir cuánto falta ──
  const documentos = ['doc_soat', 'doc_licencia', 'doc_tarjeta_operacion', 'doc_tecnomecanica', 'doc_seguros'];
  const seccionPersonalLista = Boolean(formConductor.age && formConductor.affiliated_company);
  const seccionVehiculoLista = Boolean(formConductor.plate && formConductor.capacity);
  const documentosCargados = documentos.filter(d => formConductor[d]).length;
  const seccionDocsLista = documentosCargados === documentos.length;
  const listas = [seccionPersonalLista, seccionVehiculoLista, seccionDocsLista].filter(Boolean).length;

  // --- RENDER ---
  if (estadoCarga === 'cargando') {
    return (
      <>
        <EstilosBase />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.niebla, fontFamily: T.ui }}>
          <div style={{ textAlign: 'center', color: T.piedra }}>
            <div style={{ display: 'inline-flex', color: T.piedraClara, animation: 't-girar .9s linear infinite', marginBottom: '14px' }}>
              <Icono size={26}><path d="M4 4v5h5" /><path d="M5.5 15A7.5 7.5 0 0 0 19 9.5" /><path d="M18.5 9A7.5 7.5 0 0 0 5 14.5" /></Icono>
            </div>
            <p style={{ margin: 0, fontSize: '14.5px' }}>Verificando tu estado de registro…</p>
          </div>
        </div>
      </>
    );
  }

  if (estadoCarga === 'mostrar_estado') {
    return (
      <>
        <EstilosBase />
        <div style={{ minHeight: '100vh', background: T.niebla, padding: '40px 20px', fontFamily: T.ui }}>
          <VistaEstadoDocumentos estadoData={estadoData} onVolver={() => navigate('/dashboard')} />
        </div>
      </>
    );
  }

  return (
    <>
      <EstilosBase />
      <style>{`
        .fc-entrada:focus { border-color:${T.ruta} !important; box-shadow:0 0 0 3px rgba(22,163,74,.12); }
        .fc-comodidad:hover { border-color:${T.piedraClara} !important; }
        @media (max-width: 720px) { .fc-rejilla { grid-template-columns:1fr !important; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: T.niebla, padding: '40px 20px', fontFamily: T.ui }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: '820px', margin: '0 auto', background: T.papel, borderRadius: '18px', border: `1px solid ${T.linea}`, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 24px 50px -34px rgba(0,0,0,.35)', overflow: 'hidden' }}>

          <Cabecera titulo="Registrate como conductor" onVolver={() => navigate('/dashboard')} />

          {/* Progreso — tres secciones, se marca la que ya quedó completa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 30px', background: T.niebla, borderBottom: `1px solid ${T.linea}` }}>
            <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: T.linea, overflow: 'hidden' }}>
              <div style={{ width: `${(listas / 3) * 100}%`, height: '100%', background: BRAND_GREEN, transition: 'width .3s ease' }} />
            </div>
            <span style={{ fontFamily: T.dato, fontSize: '12px', letterSpacing: '.1em', color: T.piedra, whiteSpace: 'nowrap' }}>
              {listas} de 3 secciones
            </span>
          </div>

          {/* Banner si tiene docs rechazados */}
          {estadoData?.estado === 'RECHAZADO' && (
            <div style={{ background: T.alertaSuave, border: `1px solid ${T.alertaLinea}`, margin: '20px 30px 0', borderRadius: T.rTarjeta, padding: '14px 17px' }}>
              <p style={{ margin: 0, fontWeight: 700, color: T.alertaTexto, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <IconAlerta size={14} />Algunos documentos fueron rechazados. Podés volver a enviarlos acá abajo.
              </p>
              {estadoData.documentos_rechazados?.map((tipo, i) => (
                <p key={i} style={{ margin: '4px 0 0', fontSize: '13.5px', color: T.alertaTexto }}>· {ETIQUETA_DOCUMENTO[tipo] || tipo}</p>
              ))}
            </div>
          )}

          <form onSubmit={enviarFormularioConductor} style={{ padding: '30px' }}>

            {/* ── 1. Datos personales ── */}
            <Seccion n={1} titulo="Tus datos" Ico={IconPersona} completa={seccionPersonalLista}
              descripcion="Nombre, correo y teléfono vienen de tu cuenta.">
              <div className="fc-rejilla" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Campo etiqueta="Nombre completo" hijo={
                  <input type="text" value={datosUsuario.full_name} readOnly style={estiloBloqueado} />} />
                <Campo etiqueta="Correo" hijo={
                  <input type="email" value={datosUsuario.email} readOnly style={estiloBloqueado} />} />
                <Campo etiqueta="Teléfono" hijo={
                  <input type="tel" value={datosUsuario.phone_number} readOnly style={{ ...estiloBloqueado, fontFamily: T.dato, letterSpacing: '.06em' }} />} />
                <Campo etiqueta="Edad" hijo={
                  <input type="number" name="age" className="fc-entrada" placeholder="Mínimo 18"
                    value={formConductor.age} onChange={handleInputConductor} required min="18" style={estiloEntrada} />} />
                <Campo etiqueta="Empresa afiliada" ancho hijo={
                  <select name="affiliated_company" className="fc-entrada" value={formConductor.affiliated_company}
                    onChange={handleInputConductor} required style={estiloEntrada}>
                    <option value="">Elegí tu empresa…</option>
                    <option value="1">Departour</option>
                    <option value="2">Transporte Real</option>
                  </select>} />
                <div style={{ gridColumn: 'span 2' }}>
                  <DropZone label="Tu foto de perfil" name="profile_photo" onChange={handleInputConductor} file={formConductor.profile_photo} />
                </div>
              </div>
            </Seccion>

            {/* ── 2. Vehículo ── */}
            <Seccion n={2} titulo="Tu vehículo" Ico={IconAuto} completa={seccionVehiculoLista}>
              <div className="fc-rejilla" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <Campo etiqueta="Placa" hijo={
                  <input type="text" name="plate" className="fc-entrada" placeholder="ABC-123"
                    value={formConductor.plate} onChange={handleInputConductor} required
                    style={{ ...estiloEntrada, textTransform: 'uppercase', fontFamily: T.dato, letterSpacing: '.08em' }} />} />
                <Campo etiqueta="Capacidad" hijo={
                  <input type="number" name="capacity" className="fc-entrada" placeholder="Asientos disponibles"
                    value={formConductor.capacity} onChange={handleInputConductor} required min="1" max="44" style={estiloEntrada} />} />
                <div style={{ gridColumn: 'span 2' }}>
                  <DropZone label="Foto de tu vehículo" name="vehicle_photo" onChange={handleInputConductor} file={formConductor.vehicle_photo} />
                </div>
              </div>

              {/* HU55 — comodidades del vehículo, opcionales. Se preguntan aquí, en el
                  registro, para que la mayoría de conductores queden con esto
                  configurado desde el primer día; el que prefiera puede dejarlas
                  todas sin marcar y configurarlas después en su panel. */}
              <div style={{ background: T.niebla, border: `1px solid ${T.linea}`, borderRadius: T.rTarjeta, padding: '16px' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 700, color: T.tinta, margin: '0 0 3px' }}>
                  <IconIdea size={14} color={T.chivaTexto} />Comodidades (opcional)
                </p>
                <p style={{ fontSize: '13.5px', color: T.piedra, margin: '0 0 13px' }}>
                  Algunos pasajeros filtran su búsqueda por esto. Podés dejarlas sin marcar y configurarlas después desde tu panel.
                </p>
                <div className="fc-rejilla" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    ['tiene_ac', 'Aire acondicionado'],
                    ['tiene_wifi', 'WiFi'],
                    ['tiene_bano', 'Baño'],
                    ['tiene_musica', 'Bluetooth'],
                    ['tiene_maletero_amplio', 'Maletero amplio'],
                    ['tiene_sillas_bebe', 'Sillas para bebé'],
                    ['tiene_sillas_reclinables', 'Sillas reclinables'],
                    ['tiene_cargador_usb', 'Cargador USB'],
                    ['tiene_tv', 'Televisor'],
                    ['tiene_buen_audio', 'Sonido de alta fidelidad'],
                    ['acepta_mascotas', 'Acepta mascotas'],
                  ].map(([campo, etiqueta]) => {
                    const marcada = formConductor[campo];
                    return (
                      <label key={campo} className="fc-comodidad" style={{
                        display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px',
                        color: marcada ? T.musgoTexto : T.tinta, fontWeight: marcada ? 600 : 400,
                        background: marcada ? T.musgo : T.papel,
                        border: `1px solid ${marcada ? T.musgoLinea : T.linea}`,
                        borderRadius: T.rControl, padding: '10px 12px', cursor: 'pointer',
                        transition: 'background .15s, border-color .15s',
                      }}>
                        <input type="checkbox" name={campo} checked={marcada} onChange={handleInputConductor}
                          style={{ accentColor: BRAND_GREEN, width: '15px', height: '15px', cursor: 'pointer' }} />
                        {etiqueta}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Seccion>

            {/* ── 3. Documentos ── */}
            <Seccion n={3} titulo="Documentación reglamentaria" Ico={IconClipboard} completa={seccionDocsLista}
              descripcion={`En PDF o imagen. ${documentosCargados} de ${documentos.length} cargados.`}>
              <div className="fc-rejilla" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <DropZone label="SOAT vigente" name="doc_soat" Ico={IconEscudo} onChange={handleInputConductor} file={formConductor.doc_soat} />
                <DropZone label="Licencia de conducción" name="doc_licencia" Ico={IconTarjeta} onChange={handleInputConductor} file={formConductor.doc_licencia} />
                <DropZone label="Tarjeta de operación" name="doc_tarjeta_operacion" Ico={IconClipboard} onChange={handleInputConductor} file={formConductor.doc_tarjeta_operacion} />
                <DropZone label="Revisión tecnomecánica" name="doc_tecnomecanica" Ico={IconLlave} onChange={handleInputConductor} file={formConductor.doc_tecnomecanica} />
                <div style={{ gridColumn: 'span 2' }}>
                  <DropZone label="Seguros (contractual y extracontractual)" name="doc_seguros" Ico={IconRecibo} onChange={handleInputConductor} file={formConductor.doc_seguros} />
                </div>
              </div>
            </Seccion>

            {errorEnvio && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: T.alertaSuave, border: `1px solid ${T.alertaLinea}`, borderRadius: T.rControl, padding: '11px 13px', marginBottom: '14px', color: T.alertaTexto, fontSize: '14px' }}>
                <IconAlerta size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{errorEnvio}</span>
              </div>
            )}

            <Boton type="submit" ancho disabled={enviando}
              variante={enviando ? 'inactivo' : 'primario'} style={{ padding: '15px', fontSize: '15.5px' }}>
              {enviando ? 'Enviando documentos…' : 'Enviar solicitud'}
            </Boton>

            <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: '13px', color: T.piedraClara }}>
              Un administrador revisa tus documentos antes de habilitarte. Te avisamos cuando haya respuesta.
            </p>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default FormularioConductor;
