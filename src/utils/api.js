// src/utils/api.js
const API_BASE_URL = 'http://localhost:3000';

// Función auxiliar para borrar todas las cookies
const clearAllCookies = () => {
  document.cookie.split(";").forEach((c) => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
};

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
      ...options,
    });

    // Si el token expiró o es inválido (401/403)
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      clearAllCookies();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      const error = await response.text();
      throw new Error(`Error ${response.status}: ${error}`);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error ${response.status}: ${error}`);
    }

    return response.json();

  } catch (error) {
    // Si el servidor se cae (Network Error / Failed to fetch)
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      console.warn("Servidor caído o no disponible. Cerrando sesión...");

      // Limpieza inmediata de sesión
      localStorage.removeItem('token');
      clearAllCookies();

      // Redirigir a login si no estamos ahí
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    throw error;
  }
};

// Función específica para login
export const loginUser = async (identificador, contrasena) => {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identificador, contrasena }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en el login');
  }

  return response.json();
};