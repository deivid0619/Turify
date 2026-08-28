import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const BRAND_GREEN = '#16a34a';
import API_BASE_URL from './api';

const ETIQUETA_DOCUMENTO = {
  'SOAT': 'SOAT Vigente',
  'Licencia de Conduccion': 'Licencia de Conducción',
  'Tarjeta de operacion': 'Tarjeta de Operación',
  'Tecnomecanica': 'Revisión Tecnomecánica',
  'Seguros Contractual y extracontractual': 'Seguros (Contractual / Extracontractual)',
};

// === DRAG & DROP ===
const DropZone = ({ label, name, onChange, file }) => {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length > 0) onChange({ target: { name, type: 'file', files: e.dataTransfer.files } }); }}
      style={{ border: `2px dashed ${isDragging ? BRAND_GREEN : '#cbd5e1'}`, borderRadius: '12px', padding: '20px', textAlign: 'center', backgroundColor: isDragging ? '#f0fdf4' : '#f8fafc', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100px' }}
    >
      <input type="file" name={name} onChange={onChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
      {file ? (
        <div style={{ color: BRAND_GREEN, fontWeight: '600' }}>✅ Archivo cargado:<br /><span style={{ fontSize: '12px', color: '#333' }}>{file.name}</span></div>
      ) : (
        <div style={{ color: '#64748b' }}>
          <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📁</span>
          <strong style={{ color: '#334155', fontSize: '14px' }}>{label}</strong><br />
          <span style={{ fontSize: '12px' }}>Arrastra aquí o haz clic</span>
        </div>
      )}
    </div>
  );
};

// === VISTA DE ESTADO DE DOCUMENTOS (cuando ya fueron enviados) ===
const VistaEstadoDocumentos = ({ estadoData, onVolver }) => {
  const config = {
    PENDIENTE: { icon: '⏳', color: '#92400e', bg: '#fef3c7', titulo: 'Documentos en revisión', descripcion: 'Tus documentos están siendo revisados por el administrador. Te notificaremos cuando haya una respuesta.' },
    APROBADO:  { icon: '✅', color: '#166534', bg: '#dcfce7', titulo: '¡Eres conductor!', descripcion: 'Todos tus documentos han sido aprobados. Ya puedes recibir solicitudes de viaje.' },
    RECHAZADO: { icon: '❌', color: '#991b1b', bg: '#fee2e2', titulo: 'Documentos rechazados', descripcion: 'Algunos documentos fueron rechazados. Corrígelos y vuelve a enviarlos.' },
  };
  const c = config[estadoData.estado] || config.PENDIENTE;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '20px 30px', backgroundColor: BRAND_GREEN, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>Estado de tu solicitud</h2>
        <button type="button" onClick={onVolver}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Volver al mapa
        </button>
      </div>

      <div style={{ padding: '40px 30px' }}>
        {/* Banner de estado */}
        <div style={{ backgroundColor: c.bg, border: `1px solid ${c.color}33`, borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>{c.icon}</div>
          <h3 style={{ margin: '0 0 8px', color: c.color, fontSize: '18px' }}>{c.titulo}</h3>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>{c.descripcion}</p>
        </div>

        {/* Lista de documentos con estado */}
        {estadoData.documentos && (
          <div>
            <p style={{ margin: '0 0 12px', fontWeight: '700', fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado por documento</p>
            {estadoData.documentos.map((doc, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600' }}>{ETIQUETA_DOCUMENTO[doc.tipo] || doc.tipo}</span>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                  backgroundColor: doc.estado === 'APPROVED' ? '#dcfce7' : doc.estado === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                  color: doc.estado === 'APPROVED' ? '#166534' : doc.estado === 'REJECTED' ? '#991b1b' : '#92400e'
                }}>
                  {doc.estado === 'APPROVED' ? '✅ Aprobado' : doc.estado === 'REJECTED' ? '❌ Rechazado' : '⏳ Pendiente'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Documentos rechazados */}
        {estadoData.documentos_rechazados && estadoData.documentos_rechazados.length > 0 && (
          <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', marginTop: '16px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#991b1b', fontSize: '13px' }}>📋 Documentos que debes volver a enviar:</p>
            {estadoData.documentos_rechazados.map((tipo, i) => (
              <p key={i} style={{ margin: '4px 0', fontSize: '13px', color: '#7f1d1d' }}>• {ETIQUETA_DOCUMENTO[tipo] || tipo}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// === COMPONENTE PRINCIPAL ===
const FormularioConductor = () => {
  const navigate = useNavigate();
  const { token, usuario } = useContext(AuthContext);

  const [estadoCarga, setEstadoCarga] = useState('cargando'); // 'cargando' | 'mostrar_formulario' | 'mostrar_estado'
  const [estadoData, setEstadoData] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [formConductor, setFormConductor] = useState({
    age: '', affiliated_company: '', profile_photo: null,
    plate: '', capacity: '', vehicle_photo: null,
    doc_soat: null, doc_licencia: null, doc_tarjeta_operacion: null,
    doc_tecnomecanica: null, doc_seguros: null
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
          // Sin docs o con rechazados: mostrar formulario
          setEstadoData(data);
          setEstadoCarga('mostrar_formulario');
        } else {
          // PENDIENTE o APROBADO: mostrar estado
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
    const { name, value, type, files } = e.target;
    setFormConductor(prev => ({ ...prev, [name]: type === 'file' ? files[0] : value }));
  };

  const enviarFormularioConductor = async (e) => {
    e.preventDefault();
    setEnviando(true);

    const formData = new FormData();
    formData.append('age', formConductor.age);
    formData.append('affiliated_company', formConductor.affiliated_company);
    formData.append('plate', formConductor.plate);
    formData.append('capacity', formConductor.capacity);
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
        throw new Error(errorData.detail || 'Error al enviar la solicitud');
      }

      // Mostrar vista de estado tras el envío exitoso
      setEstadoData({
        estado: 'PENDIENTE',
        mensaje: 'Tus documentos están siendo revisados por el administrador.',
        documentos: null
      });
      setEstadoCarga('mostrar_estado');

    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const inputBloqueadoStyle = { padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: '#e2e8f0', color: '#64748b', cursor: 'not-allowed' };

  // --- RENDER ---
  if (estadoCarga === 'cargando') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
          <p>Verificando tu estado de registro...</p>
        </div>
      </div>
    );
  }

  if (estadoCarga === 'mostrar_estado') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
        <VistaEstadoDocumentos estadoData={estadoData} onVolver={() => navigate('/dashboard')} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ padding: '20px 30px', backgroundColor: BRAND_GREEN, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Únete como Conductor</h2>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            ← Volver al mapa
          </button>
        </div>

        {/* Banner si tiene docs rechazados */}
        {estadoData?.estado === 'RECHAZADO' && (
          <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5', margin: '20px 30px 0', borderRadius: '10px', padding: '14px 18px' }}>
            <p style={{ margin: 0, fontWeight: '700', color: '#991b1b', fontSize: '13px' }}>
              ⚠️ Algunos documentos fueron rechazados. Puedes volver a enviarlos a continuación.
            </p>
            {estadoData.documentos_rechazados?.map((tipo, i) => (
              <p key={i} style={{ margin: '4px 0 0', fontSize: '12px', color: '#7f1d1d' }}>• {ETIQUETA_DOCUMENTO[tipo] || tipo}</p>
            ))}
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={enviarFormularioConductor} style={{ padding: '40px 30px' }}>

          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b', marginTop: 0 }}>👤 1. Datos Personales</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Tus datos básicos han sido cargados desde tu cuenta.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <input type="text" value={datosUsuario.full_name} readOnly style={inputBloqueadoStyle} placeholder="Nombre completo" />
            <input type="email" value={datosUsuario.email} readOnly style={inputBloqueadoStyle} placeholder="Correo electrónico" />
            <input type="tel" value={datosUsuario.phone_number} readOnly style={inputBloqueadoStyle} placeholder="Teléfono" />
            <input type="number" name="age" placeholder="Edad" onChange={handleInputConductor} required min="18" style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
            <select name="affiliated_company" onChange={handleInputConductor} required style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' }}>
              <option value="">Selecciona tu Empresa Afiliada...</option>
              <option value="1">Departour</option>
              <option value="2">Transporte Real</option>
            </select>
            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Sube tu Foto de Perfil" name="profile_photo" onChange={handleInputConductor} file={formConductor.profile_photo} />
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>🚗 2. Datos del Vehículo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <input type="text" name="plate" placeholder="Placa (Ej. ABC-123)" onChange={handleInputConductor} required style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }} />
            <input type="number" name="capacity" placeholder="Capacidad (asientos)" onChange={handleInputConductor} required min="1" max="44" style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Sube una Foto de tu Vehículo" name="vehicle_photo" onChange={handleInputConductor} file={formConductor.vehicle_photo} />
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>📄 3. Documentación Reglamentaria</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Adjunta los documentos en formato PDF o Imagen.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <DropZone label="SOAT Vigente" name="doc_soat" onChange={handleInputConductor} file={formConductor.doc_soat} />
            <DropZone label="Licencia de Conducción" name="doc_licencia" onChange={handleInputConductor} file={formConductor.doc_licencia} />
            <DropZone label="Tarjeta de Operación" name="doc_tarjeta_operacion" onChange={handleInputConductor} file={formConductor.doc_tarjeta_operacion} />
            <DropZone label="Revisión Tecnomecánica" name="doc_tecnomecanica" onChange={handleInputConductor} file={formConductor.doc_tecnomecanica} />
            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Seguros (Contractual / Extracontractual)" name="doc_seguros" onChange={handleInputConductor} file={formConductor.doc_seguros} />
            </div>
          </div>

          <button type="submit" disabled={enviando}
            style={{ width: '100%', background: enviando ? '#9ca3af' : BRAND_GREEN, color: '#fff', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: enviando ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}>
            {enviando ? 'Enviando documentos...' : 'Enviar Solicitud'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default FormularioConductor;