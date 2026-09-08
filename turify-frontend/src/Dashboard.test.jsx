// SCRUM-193 (HU45) — Tests automatizados del componente Dashboard.
//
// Dashboard.jsx integra Google Maps, Supabase Realtime y varios paneles
// hijos (PanelConductor, AdminConductores). Para poder montarlo en jsdom sin
// depender de red real ni del script de Google Maps, se mockea
// @react-google-maps/api (isLoaded: false es justamente el estado que el
// propio componente ya maneja de forma segura mientras el mapa carga) y se
// reemplaza el fetch global por una versión que responde vacío/OK a
// cualquier endpoint.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import Dashboard from './Dashboard';

vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: false }),
  GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
  MarkerF: () => null,
  PolylineF: () => null,
}));

function renderDashboard(usuario) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ token: 'token-de-prueba', usuario }}>
        <Dashboard />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => [],
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Dashboard — pasajero', () => {
  const pasajero = { user_id: 1, full_name: 'Pasajero de Prueba', role: 'PASSENGER' };

  it('muestra un estado de carga y luego el formulario de publicar viaje', async () => {
    renderDashboard(pasajero);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('¿Desde dónde sales?')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('¿A dónde vas?')).toBeInTheDocument();
    expect(screen.getByText(/buscar ruta/i)).toBeInTheDocument();
  });

  it('llama a /api/service-requests/pending para cargar los viajes del pasajero', async () => {
    renderDashboard(pasajero);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service-requests/pending'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-de-prueba' }) })
      );
    });
  });
});

describe('Dashboard — conductor', () => {
  it('un usuario DRIVER ve el PanelConductor en vez del dashboard de pasajero', async () => {
    renderDashboard({ user_id: 2, full_name: 'Conductor de Prueba', role: 'DRIVER' });

    // PanelConductor (probado a fondo en PanelConductor.test.jsx) también
    // muestra sus propias pestañas — con que aparezca "Radar" alcanza para
    // confirmar que Dashboard delegó correctamente por rol.
    await waitFor(() => {
      expect(screen.getByText(/radar/i)).toBeInTheDocument();
    });
  });
});
