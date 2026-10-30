'use client';

import React from 'react';

export interface QuantLoaderProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  label?: string | React.ReactNode;
  sublabel?: string | React.ReactNode;
  className?: string;
  overlay?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  xs: 20,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
};

export function QuantLoaderIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ display: 'block' }}
    >
      <defs>
        <style>{`
          @keyframes qRotateQuad {
            0%, 15% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(90deg) scale(0.78); }
            85%, 100% { transform: rotate(90deg) scale(1); }
          }
          .q-anim-quad {
            transform-origin: 50px 50px;
            animation: qRotateQuad 1.4s infinite cubic-bezier(0.65, 0, 0.35, 1);
          }
        `}</style>
      </defs>
      <g>
        <g className="q-anim-quad">
          <rect x="16" y="16" width="29" height="29" rx="4.48" fill="#00F0FF" />
          <rect x="55" y="16" width="29" height="29" rx="4.48" fill="#10B981" />
          <rect x="16" y="55" width="29" height="29" rx="4.48" fill="#F43F5E" />
          <rect x="55" y="55" width="29" height="29" rx="4.48" fill="#00F0FF" />
        </g>
      </g>
    </svg>
  );
}

export function QuantLoader({
  size = 'md',
  label,
  sublabel,
  className = '',
  overlay = false,
}: QuantLoaderProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 48;

  const content = (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="relative flex items-center justify-center">
        <QuantLoaderIcon size={pixelSize} />
      </div>

      {label && (
        <div className="mt-4 text-xs font-mono text-slate-200 font-medium tracking-widest uppercase">
          {label}
        </div>
      )}

      {sublabel && (
        <div className="mt-1 text-[11px] font-mono text-slate-500 max-w-sm">
          {sublabel}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#080B10]/95 backdrop-blur-sm transition-opacity duration-300">
        {content}
      </div>
    );
  }

  return content;
}
