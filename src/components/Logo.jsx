import React from 'react';

export default function Logo({ size = 40, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4facfe" /> {/* Azul Claro */}
          <stop offset="100%" stopColor="#6f42c1" /> {/* Morado */}
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Forma del Escudo de Fondo */}
      <path
        d="M100 185C100 185 170 150 170 90V40L100 15L30 40V90C30 150 100 185 100 185Z"
        fill="url(#logoGradient)"
        stroke="white"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* Elemento interno: Representa personas/conexión (abstracto) */}
      <path
        d="M65 95C65 95 75 115 100 115C125 115 135 95 135 95"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="75" cy="75" r="10" fill="white" />
      <circle cx="125" cy="75" r="10" fill="white" />
      
    </svg>
  );
}