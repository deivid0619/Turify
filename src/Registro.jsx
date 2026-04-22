import { useState } from 'react';
import logoTurify from './logo.png';
import fondoImagen from './fondo.png'; 

const Registro = ({ irALogin }) => {
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '', 
    phone_number: ''
  });

  const [errores, setErrores] = useState({});
  const [isLoading, setIsLoading] = useState(false); // Estado para la carga

  // Validaciones dinámicas de la contraseña
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  // Validación dinámica general
  const isFormValid = 
    formData.full_name.trim() !== '' &&
    formData.email.includes('@') &&
    isPasswordValid &&
    formData.confirmPassword === formData.password &&
    formData.password !== ''; 

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    if (errores[name]) {
      setErrores({
        ...errores,
        [name]: ''
      });
    }
  };

  const validarFormulario = () => {
    let erroresVisuales = {};
    if (!formData.full_name.trim()) erroresVisuales.full_name = 'El nombre es obligatorio.';
    if (!formData.email.includes('@')) erroresVisuales.email = 'Correo inválido.';
    if (!isPasswordValid) erroresVisuales.password = 'La contraseña no cumple con todos los requisitos.';
    if (formData.password !== formData.confirmPassword) erroresVisuales.confirmPassword = 'Las contraseñas no coinciden.';
    
    return erroresVisuales;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const erroresEncontrados = validarFormulario();

    if (Object.keys(erroresEncontrados).length > 0) {
      setErrores(erroresEncontrados);
      return;
    }

    setErrores({});
    setIsLoading(true); // Iniciamos el estado de carga
    
    const { confirmPassword, ...payload } = formData;
    
    try {
      // Petición al backend en Ngrok
      const response = await fetch('http://127.0.0.1:8000/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' // Bypass para Ngrok
        },
        body: JSON.stringify(payload)
      });

      // Manejo de códigos de respuesta
      if (response.ok) { // Códigos 200 - 299
        alert('¡Registro exitoso! Ya puedes iniciar sesión.');
        irALogin(); // Opcional: Redirigir al login automáticamente
      } else {
        // Códigos 400, 422 (típico de FastAPI por validaciones), etc.
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        alert(`Hubo un error en el registro (Código ${response.status}). Revisa la consola.`);
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      alert('Error de conexión. Verifica que el backend y Ngrok estén activos.');
    } finally {
      setIsLoading(false); // Detenemos el estado de carga
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 15px',
    marginTop: '5px',
    boxSizing: 'border-box',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: '#ffffff',
    color: '#333',
    fontSize: '14px',
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px',
    transition: 'background-color 0.2s',
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <div style={{ 
        flex: '1.2', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '60px', 
        textAlign: 'center',
        position: 'relative',
        backgroundImage: `url(${fondoImagen})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        backgroundRepeat: 'no-repeat', 
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1 }}></div>

        <div style={{ zIndex: 2 }}>
          <img src={logoTurify} alt="Logo Turify" style={{ width: '420px', marginBottom: '40px' }} />
          <h1 style={{ fontSize: '36px', marginBottom: '20px', fontWeight: 'bold' }}>¡Únete a la Red de Turify!</h1>
          <p style={{ fontSize: '18px', lineHeight: '1.6', maxWidth: '450px', margin: '0 auto' }}>
            Regístrate hoy para experimentar una gestión de transporte más rápida, eficiente y conectada.
          </p>
        </div>

        <p style={{ position: 'absolute', bottom: '20px', fontSize: '12px', opacity: '0.7', zIndex: 2 }}>
          © 2026 Turify Transport. All rights reserved.
        </p>
      </div>

      <div style={{ flex: '1', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', position: 'relative' }}>
        
        <button 
          onClick={irALogin} 
          style={{ 
            position: 'absolute', 
            top: '40px', 
            left: '40px', 
            background: 'none', 
            border: 'none', 
            color: '#6b7280', 
            fontSize: '14px', 
            fontWeight: '600', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.target.style.color = '#2563eb'}
          onMouseLeave={(e) => e.target.style.color = '#6b7280'}
        >
          <span style={{ fontSize: '18px' }}>←</span> Volver al Login
        </button>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ color: '#333', textAlign: 'left', margin: '0 0 10px 0', fontSize: '32px' }}>Crear Cuenta</h2>
          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'left' }}>
            Completa tus datos para comenzar.
          </p>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <input type="text" name="full_name" placeholder="Nombre Completo" value={formData.full_name} onChange={handleChange} style={inputStyle} disabled={isLoading} />
              {errores.full_name && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block' }}>{errores.full_name}</span>}
            </div>

            <div>
              <input type="email" name="email" placeholder="Correo Electrónico" value={formData.email} onChange={handleChange} style={inputStyle} disabled={isLoading} />
              {errores.email && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block' }}>{errores.email}</span>}
            </div>

            <div>
              <input type="text" name="phone_number" placeholder="Teléfono" value={formData.phone_number} onChange={handleChange} style={inputStyle} disabled={isLoading} />
            </div>

            <div>
              <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} style={inputStyle} disabled={isLoading} />
              
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <div style={{ color: hasMinLength ? '#10b981' : '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>{hasMinLength ? '✓' : '✕'}</span> Mínimo 8 caracteres
                </div>
                <div style={{ color: hasUppercase ? '#10b981' : '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>{hasUppercase ? '✓' : '✕'}</span> Al menos una letra mayúscula
                </div>
                <div style={{ color: hasNumber ? '#10b981' : '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>{hasNumber ? '✓' : '✕'}</span> Al menos un número
                </div>
              </div>

            </div>

            <div>
              <input type="password" name="confirmPassword" placeholder="Confirmar Contraseña" value={formData.confirmPassword} onChange={handleChange} style={inputStyle} disabled={isLoading} />
              {errores.confirmPassword && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px', display: 'block' }}>{errores.confirmPassword}</span>}
            </div>

            <button 
              type="submit" 
              disabled={!isFormValid || isLoading}
              style={{ 
                ...buttonStyle, 
                backgroundColor: (isFormValid && !isLoading) ? '#10b981' : '#9ca3af', 
                color: 'white', 
                marginTop: '15px',
                cursor: (isFormValid && !isLoading) ? 'pointer' : 'not-allowed'
              }}
            >
              {isLoading ? 'Registrando...' : 'Registrarse'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Registro;