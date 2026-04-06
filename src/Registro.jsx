import { useState } from 'react';
// Importamos el mismo logo para mantener la identidad visual
import logoTurify from './logo.png';

const Registro = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'PASSENGER',
    affiliated_company: '',
    fuec_document: null
  });

  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'file' ? files[0] : value
    });
  };

  const validarFormulario = () => {
    let erroresVisuales = {};
    if (!formData.full_name.trim()) erroresVisuales.full_name = 'El nombre es obligatorio.';
    if (!formData.email.includes('@')) erroresVisuales.email = 'Correo inválido.';
    if (formData.password.length < 6) erroresVisuales.password = 'Mínimo 6 caracteres.';
    
    if (formData.role === 'DRIVER') {
      if (!formData.affiliated_company.trim()) erroresVisuales.affiliated_company = 'La empresa es obligatoria.';
      if (!formData.fuec_document) erroresVisuales.fuec_document = 'Debes subir tu documento FUEC.';
    }
    return erroresVisuales;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const erroresEncontrados = validarFormulario();

    if (Object.keys(erroresEncontrados).length > 0) {
      setErrores(erroresEncontrados);
    } else {
      setErrores({});
      console.log('Payload listo para el Integrante C (Backend):', formData);
      alert('Validación exitosa. Revisa la consola.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginTop: '5px',
    boxSizing: 'border-box',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: '#ffffff',
    color: '#333'
  };

  return (
    // Contenedor principal idéntico al del Login (logo arriba, tarjeta centrada)
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', paddingBottom: '40px' }}>
      
      {/* Imagen del logo */}
      <img 
        src={logoTurify} 
        alt="Logo Turify" 
        style={{ width: '220px', marginBottom: '20px' }} 
      />

      {/* Tarjeta del formulario */}
      <div style={{ width: '100%', maxWidth: '400px', padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 0 15px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
        <h2 style={{ color: '#333', textAlign: 'center', margin: '0 0 20px 0' }}>Crear Cuenta</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label htmlFor="role" style={{ fontWeight: 'bold', color: '#333' }}>¿Qué tipo de usuario eres?</label>
            <select id="role" name="role" value={formData.role} onChange={handleChange} style={inputStyle}>
              <option value="PASSENGER">Pasajero</option>
              <option value="DRIVER">Conductor</option>
            </select>
          </div>

          <div>
            <input type="text" name="full_name" placeholder="Nombre Completo" value={formData.full_name} onChange={handleChange} style={inputStyle} />
            {errores.full_name && <span style={{ color: 'red', fontSize: '12px' }}>{errores.full_name}</span>}
          </div>

          <div>
            <input type="email" name="email" placeholder="Correo Electrónico" value={formData.email} onChange={handleChange} style={inputStyle} />
            {errores.email && <span style={{ color: 'red', fontSize: '12px' }}>{errores.email}</span>}
          </div>

          <div>
            <input type="text" name="phone_number" placeholder="Teléfono" value={formData.phone_number} onChange={handleChange} style={inputStyle} />
          </div>

          <div>
            <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} style={inputStyle} />
            {errores.password && <span style={{ color: 'red', fontSize: '12px' }}>{errores.password}</span>}
          </div>

          {formData.role === 'DRIVER' && (
            <div style={{ backgroundColor: '#eef2ff', padding: '15px', borderRadius: '6px', border: '1px solid #c7d2fe', marginTop: '5px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#3730a3' }}>Datos de Conductor</h4>
              
              <div style={{ marginBottom: '10px' }}>
                <input type="text" name="affiliated_company" placeholder="Empresa Afiliada" value={formData.affiliated_company} onChange={handleChange} style={inputStyle} />
                {errores.affiliated_company && <span style={{ color: 'red', fontSize: '12px' }}>{errores.affiliated_company}</span>}
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Sube tu documento FUEC (PDF/IMG):</label>
                <input type="file" name="fuec_document" onChange={handleChange} style={{ ...inputStyle, padding: '6px', backgroundColor: 'transparent', border: 'none' }} />
                {errores.fuec_document && <span style={{ color: 'red', fontSize: '12px' }}>{errores.fuec_document}</span>}
              </div>
            </div>
          )}

          <button type="submit" style={{ padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
            Registrarse
          </button>
        </form>
      </div>
    </div>
  );
};

export default Registro;