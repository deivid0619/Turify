import { useState } from 'react';
import Login from './Login';
import Registro from './Registro';

function App() {
  const [pantallaActual, setPantallaActual] = useState('login');

  return (
    <div>
      {pantallaActual === 'login' && (
        <Login irARegistro={() => setPantallaActual('registro')} />
      )}

      {pantallaActual === 'registro' && (
        <div>
          <button onClick={() => setPantallaActual('login')} style={{ margin: '20px', padding: '10px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ← Volver al Login
          </button>
          <Registro />
        </div>
      )}
    </div>
  );
}

export default App;