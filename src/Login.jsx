import { useState } from 'react';
import logoTurify from './logo.png';
import fondoImagen from './fondo.png'; 

const Login = ({ irARegistro, onLoginSuccess }) => {
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [errorBackend, setErrorBackend] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFormValid = formData.email.includes('@') && formData.password.length > 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Limpiamos el error del backend si el usuario vuelve a escribir
    if (errorBackend) {
      setErrorBackend('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue al enviar el formulario
    setIsLoading(true);
    setErrorBackend('');

    // Preparamos los datos en el formato x-www-form-urlencoded que exige FastAPI
    const urlEncodedData = new URLSearchParams();
    urlEncodedData.append('username', formData.email);
    urlEncodedData.append('password', formData.password);

    try {
      const response = await fetch('https://tricky-daintily-coffee.ngrok-free.dev/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'ngrok-skip-browser-warning': 'true' // Bypass para Ngrok
        },
        body: urlEncodedData
      });

      if (response.ok) {
        const data = await response.json();
        
        // 1. Guardamos el token en localStorage
        localStorage.setItem('token', data.access_token);
        
        console.log('Login exitoso, token guardado');
        
        // 2. Enviamos el token al App.jsx para actualizar el estado y redirigir (Sin alert)
        if (onLoginSuccess) {
          onLoginSuccess(data.access_token); 
        }
      } else {
        const errorData = await response.json();
        // FastAPI suele mandar el detalle del error en 'detail'
        setErrorBackend(errorData.detail || 'Correo o contraseña incorrectos.');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      setErrorBackend('Error de conexión. Verifica que el backend esté activo.');
    } finally {
      setIsLoading(false);
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
      
      {/* Mitad Izquierda - Imagen */}
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
          <h1 style={{ fontSize: '36px', marginBottom: '20px', fontWeight: 'bold' }}>¡Bienvenido de nuevo!</h1>
          <p style={{ fontSize: '18px', lineHeight: '1.6', maxWidth: '450px', margin: '0 auto' }}>
            Inicia sesión para gestionar tus rutas y mantener la conexión con la red Turify.
          </p>
        </div>

        <p style={{ position: 'absolute', bottom: '20px', fontSize: '12px', opacity: '0.7', zIndex: 2 }}>
          © 2026 Turify Transport. All rights reserved.
        </p>
      </div>

      {/* Mitad Derecha - Formulario */}
      <div style={{ flex: '1', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', position: 'relative' }}>
        
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ color: '#333', textAlign: 'left', margin: '0 0 10px 0', fontSize: '32px' }}>Iniciar Sesión</h2>
          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'left' }}>
            Ingresa tus credenciales para acceder a tu cuenta.
          </p>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <input type="email" name="email" placeholder="Correo Electrónico" value={formData.email} onChange={handleChange} style={inputStyle} disabled={isLoading} />
            </div>

            <div>
              <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} style={inputStyle} disabled={isLoading} />
            </div>

            {/* Mensaje de error del backend */}
            {errorBackend && (
              <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '14px', textAlign: 'center' }}>
                {errorBackend}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!isFormValid || isLoading}
              style={{ 
                ...buttonStyle, 
                backgroundColor: (isFormValid && !isLoading) ? '#2563eb' : '#9ca3af', 
                color: 'white', 
                marginTop: '10px',
                cursor: (isFormValid && !isLoading) ? 'pointer' : 'not-allowed'
              }}
            >
              {isLoading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>

          <p style={{ marginTop: '30px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
            ¿No tienes una cuenta? {' '}
            <span 
              onClick={irARegistro} 
              style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              Regístrate aquí
            </span>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;