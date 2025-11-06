// src/utils/api.js
const API_BASE_URL = 'http://localhost:3000';

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error ${response.status}: ${error}`);
  }
  
  return response.json();
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