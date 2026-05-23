import { createContext } from 'react';

// Solo exporta el contexto — sin componentes
// Esto es necesario para que Vite Fast Refresh funcione correctamente
export const AuthContext = createContext();