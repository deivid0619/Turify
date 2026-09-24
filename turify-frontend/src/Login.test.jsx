// SCRUM-193 (HU45) — Tests automatizados del componente Login.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function llenarFormulario(email, password) {
  fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
}

describe('Login', () => {
  it('muestra los campos de correo y contraseña y el botón de entrar', () => {
    render(<Login />);

    expect(screen.getByPlaceholderText('tu@correo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('el botón de entrar empieza deshabilitado hasta llenar correo y contraseña válidos', () => {
    render(<Login />);
    const boton = screen.getByRole('button', { name: /entrar/i });
    expect(boton).toBeDisabled();

    llenarFormulario('persona@example.com', 'ClaveSegura123');
    expect(boton).not.toBeDisabled();
  });

  it('al enviar credenciales correctas, guarda el token y llama a onLoginSuccess', async () => {
    const fakeResponse = {
      ok: true,
      headers: { get: () => null },
      json: async () => ({ access_token: 'token-de-prueba', token_type: 'bearer' }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    const onLoginSuccess = vi.fn();
    render(<Login onLoginSuccess={onLoginSuccess} />);

    llenarFormulario('persona@example.com', 'ClaveSegura123');
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('token-de-prueba'));
    expect(localStorage.getItem('token')).toBe('token-de-prueba');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('muestra el mensaje de error que devuelve el backend cuando las credenciales son incorrectas', async () => {
    const fakeResponse = {
      ok: false,
      headers: { get: () => null },
      json: async () => ({ detail: 'Email o contraseña incorrectos' }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    render(<Login onLoginSuccess={vi.fn()} />);
    llenarFormulario('persona@example.com', 'ClaveIncorrecta');
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Email o contraseña incorrectos')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('muestra un mensaje de error de conexión si el fetch falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<Login onLoginSuccess={vi.fn()} />);
    llenarFormulario('persona@example.com', 'ClaveSegura123');
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/error de conexión/i)).toBeInTheDocument();
  });

  it('permite alternar a la pestaña "Conducir"', () => {
    render(<Login />);
    // Nombre exacto: la landing también tiene "Empezar a conducir".
    const tabConducir = screen.getByRole('button', { name: /^conducir$/i });
    fireEvent.click(tabConducir);
    expect(tabConducir.className).toMatch(/login-pestana-on/);
  });
});
