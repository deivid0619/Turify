// SCRUM-193 (HU45) — Tests automatizados del componente PanelConductor.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import PanelConductor from './PanelConductor';

vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: false }),
  GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
  MarkerF: () => null,
  PolylineF: () => null,
}));

function renderPanel() {
  const conductor = { user_id: 3, full_name: 'Conductor de Prueba', role: 'DRIVER' };
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ token: 'token-de-prueba', usuario: conductor }}>
        <PanelConductor />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (typeof url === 'string' && url.includes('/drivers/earnings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          ganancias_semana: 0,
          ganancias_mes: 0,
          viajes_completados: 0,
          calificacion_promedio: null,
          horarios_activos: [],
          top_rutas: [],
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PanelConductor', () => {
  it('muestra las 5 pestañas del panel', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /radar/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /ofertas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /historial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ganancias/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vehículo/i })).toBeInTheDocument();
  });

  it('carga las solicitudes del radar al montar', async () => {
    renderPanel();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service-requests/pending'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-de-prueba' }) })
      );
    });
  });

  it('al hacer clic en la pestaña Ganancias, consulta /drivers/earnings', async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: /ganancias/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ganancias/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/drivers/earnings'),
        expect.anything()
      );
    });
  });

  it('al hacer clic en la pestaña Vehículo, consulta /drivers/vehicle', async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: /vehículo/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /vehículo/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/drivers/vehicle'),
        expect.anything()
      );
    });
  });
});
