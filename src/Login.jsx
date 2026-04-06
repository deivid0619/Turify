import { useState } from 'react';
// 1. Importamos la imagen que acabas de guardar en la carpeta src
import logoTurify from './logo.png';

const Login = ({ irARegistro }) => {
  const [credenciales, setCredenciales] = useState({ correo: '', password: '' });
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredenciales({ ...credenciales, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let erroresVisuales = {};
    if (!credenciales.correo.includes('@')) erroresVisuales.correo = 'Ingresa un correo válido.';
    if (credenciales.password.length === 0) erroresVisuales.password = 'La contraseña es obligatoria.';
    
    if (Object.keys(erroresVisuales).length > 0) {
      setErrores(erroresVisuales);
    } else {
      setErrores({});
      console.log('Login listo para el backend:', credenciales);
      alert('Login validado en Frontend. Revisa la consola.');
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
    // Contenedor principal que centra el logo y la tarjeta en forma de columna
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px' }}>
      
      {/* 2. Etiqueta de la imagen del logo */}
      <img 
        src={logoTurify} 
        alt="Logo Turify" 
        style={{ width: '300px', marginBottom: '20px' }} 
      />

      {/* Tarjeta del formulario */}
      <div style={{ width: '100%', maxWidth: '400px', padding: '30px', fontFamily: 'sans-serif', backgroundColor: '#dadada', borderRadius: '8px', boxShadow: '0 0 15px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
        <h2 style={{ color: '#333', textAlign: 'center', margin: '0 0 20px 0' }}>Iniciar Sesión</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label htmlFor="correo" style={{ fontWeight: 'bold', color: '#333' }}>Correo Electrónico:</label>
            <input 
              type="email" 
              id="correo" 
              name="correo" 
              value={credenciales.correo} 
              onChange={handleChange} 
              style={inputStyle} 
            />
            {errores.correo && <span style={{ color: 'red', fontSize: '12px' }}>{errores.correo}</span>}
          </div>

          <div>
            <label htmlFor="password" style={{ fontWeight: 'bold', color: '#333' }}>Contraseña:</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              value={credenciales.password} 
              onChange={handleChange} 
              style={inputStyle} 
            />
            {errores.password && <span style={{ color: 'red', fontSize: '12px' }}>{errores.password}</span>}
          </div>

          <button type="submit" style={{ padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
            Entrar
          </button>
        </form>

        <hr style={{ margin: '20px 0', border: '0.5px solid #ccc' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, textAlign: 'center', color: '#666', fontSize: '14px' }}>¿No tienes cuenta en Turify?</p>
          <button onClick={irARegistro} style={{ padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Crear una cuenta nueva
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;