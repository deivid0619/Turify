import { useContext } from 'react';
import { AuthContext } from './AuthContext';

const Dashboard = () => {
  // Traemos la función de cerrar sesión desde cualquier parte de la app
  const { cerrarSesion } = useContext(AuthContext);

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      backgroundColor: '#ffffff', 
      display: 'flex', 
      flexDirection: 'column', // Para apilar el texto y el botón
      justifyContent: 'center', 
      alignItems: 'center',
      fontFamily: 'sans-serif',
      gap: '20px' // Espacio entre elementos
    }}>
      <h1 style={{ color: '#333', margin: 0 }}>Login exitoso</h1>
      
      <button 
        onClick={cerrarSesion} // Al hacer clic, borra el token y React Router lo expulsa automáticamente
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#ef4444', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Cerrar Sesión
      </button>
    </div>
  );
};

export default Dashboard;