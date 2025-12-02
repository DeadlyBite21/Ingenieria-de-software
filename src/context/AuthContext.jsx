// src/context/AuthContext.jsx
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, loginUser } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar si hay token al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verificar si el token es válido obteniendo el perfil
      apiFetch('/api/me')
        .then(profile => {
          setUser(profile);
        })
        .catch(() => {
          // Token inválido, limpiar localStorage
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identificador, contrasena) => {
    const response = await loginUser(identificador, contrasena);

    // Guardar token y datos del usuario
    localStorage.setItem('token', response.token);
    setUser(response.usuario);

    return response;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.rol === 0,
    isProfesor: user?.rol === 1,
    isAlumno: user?.rol === 2,
    isPsicologo: user?.rol === 3,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};