import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const BRAND_GREEN = '#16a34a';
const API_BASE_URL = 'http://127.0.0.1:8000';

// === COMPONENTE REUTILIZABLE PARA ARRASTRAR Y SOLTAR (DRAG & DROP) ===
const DropZone = ({ label, name, onChange, file }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onChange({ target: { name, type: 'file', files: e.dataTransfer.files } });
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? BRAND_GREEN : '#cbd5e1'}`,
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: isDragging ? '#f0fdf4' : '#f8fafc',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100px'
      }}
    >
      <input 
        type="file" 
        name={name} 
        onChange={onChange} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
      />
      
      {file ? (
        <div style={{ color: BRAND_GREEN, fontWeight: '600' }}>
          ✅ Archivo cargado: <br/> 
          <span style={{ fontSize: '12px', color: '#333' }}>{file.name}</span>
        </div>
      ) : (
        <div style={{ color: '#64748b' }}>
          <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📁</span>
          <strong style={{ color: '#334155', fontSize: '14px' }}>{label}</strong><br/>
          <span style={{ fontSize: '12px' }}>Arrastra aquí o haz clic</span>
        </div>
      )}
    </div>
  );
};

// === COMPONENTE PRINCIPAL DEL FORMULARIO ===
const FormularioConductor = () => {
  const navigate = useNavigate();
  const { token, usuario } = useContext(AuthContext);

  const [formConductor, setFormConductor] = useState({
    age: '', affiliated_company: '', profile_photo: null,
    plate: '', capacity: '', vehicle_photo: null,
    doc_soat: null, doc_licencia: null, doc_tarjeta_operacion: null,
    doc_tecnomecanica: null, doc_seguros: null
  });

  // Pre-llenar datos del usuario desde el contexto (ya disponibles gracias al AuthContext actualizado)
  const datosUsuario = {
    full_name: usuario?.full_name || '',
    email: usuario?.email || '',
    phone_number: usuario?.phone_number || ''
  };

  const handleInputConductor = (e) => {
    const { name, value, type, files } = e.target;
    setFormConductor(prev => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value
    }));
  };

  const enviarFormularioConductor = async (e) => {
    e.preventDefault();

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
      // URL corregida: apunta al endpoint real del backend
      const respuesta = await fetch(`${API_BASE_URL}/drivers/register-details`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
          // NO incluir Content-Type al usar FormData
        },
        body: formData
      });

      if (!respuesta.ok) {
        const errorData = await respuesta.json();
        throw new Error(errorData.detail || 'Error al enviar la solicitud');
      }

      alert("¡Solicitud enviada con éxito! Revisaremos tus documentos.");
      navigate('/dashboard'); 

    } catch (error) {
      console.error("Error enviando el formulario:", error);
      alert(`Hubo un error: ${error.message}`);
    }
  };

  const inputBloqueadoStyle = {
    padding: '14px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#e2e8f0', 
    color: '#64748b', 
    cursor: 'not-allowed' 
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', overflow: 'hidden' }}
      >
        
        {/* HEADER */}
        <div style={{ padding: '20px 30px', backgroundColor: BRAND_GREEN, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Únete como Conductor</h2>
          <button 
            type="button"
            onClick={() => navigate('/dashboard')} 
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            ← Volver al mapa
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={enviarFormularioConductor} style={{ padding: '40px 30px' }}>
          
          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b', marginTop: 0 }}>👤 1. Datos Personales</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Tus datos básicos han sido cargados desde tu cuenta.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            {/* Campos bloqueados pre-llenados desde el contexto */}
            <input type="text" value={datosUsuario.full_name} readOnly style={inputBloqueadoStyle} title="Este dato proviene de tu cuenta" placeholder="Nombre completo" />
            <input type="email" value={datosUsuario.email} readOnly style={inputBloqueadoStyle} title="Este dato proviene de tu cuenta" placeholder="Correo electrónico" />
            <input type="tel" value={datosUsuario.phone_number} readOnly style={inputBloqueadoStyle} title="Este dato proviene de tu cuenta" placeholder="Teléfono" />
            
            {/* Campos editables */}
            <input type="number" name="age" placeholder="Edad" onChange={handleInputConductor} required min="18" style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
            
            <select name="affiliated_company" onChange={handleInputConductor} required style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' }}>
              <option value="">Selecciona tu Empresa Afiliada...</option>
              <option value="1">Transportes Medellín S.A.</option>
              <option value="2">Rutas de Antioquia</option>
              <option value="3">Independiente (Sin empresa)</option>
            </select>

            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Sube tu Foto de Perfil" name="profile_photo" onChange={handleInputConductor} file={formConductor.profile_photo} />
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>🚗 2. Datos del Vehículo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <input type="text" name="plate" placeholder="Placa del Vehículo (Ej. ABC-123)" onChange={handleInputConductor} required style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }} />
            <input type="number" name="capacity" placeholder="Capacidad (Número de asientos)" onChange={handleInputConductor} required min="1" max="44" style={{ padding: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
            
            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Sube una Foto de tu Vehículo" name="vehicle_photo" onChange={handleInputConductor} file={formConductor.vehicle_photo} />
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>📄 3. Documentación Reglamentaria</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Por favor adjunta los documentos en formato PDF o Imagen.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
            <DropZone label="SOAT Vigente" name="doc_soat" onChange={handleInputConductor} file={formConductor.doc_soat} />
            <DropZone label="Licencia de Conducción" name="doc_licencia" onChange={handleInputConductor} file={formConductor.doc_licencia} />
            <DropZone label="Tarjeta de Operación" name="doc_tarjeta_operacion" onChange={handleInputConductor} file={formConductor.doc_tarjeta_operacion} />
            <DropZone label="Revisión Tecnomecánica" name="doc_tecnomecanica" onChange={handleInputConductor} file={formConductor.doc_tecnomecanica} />
            <div style={{ gridColumn: 'span 2' }}>
              <DropZone label="Seguros (Contractual / Extracontractual)" name="doc_seguros" onChange={handleInputConductor} file={formConductor.doc_seguros} />
            </div>
          </div>

          <button type="submit" style={{ width: '100%', background: BRAND_GREEN, color: '#fff', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s' }}>
            Enviar Solicitud
          </button>
        </form>

      </motion.div>
    </div>
  );
};

export default FormularioConductor;