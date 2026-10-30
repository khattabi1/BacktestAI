'use client';

import React, { useState, useCallback } from 'react';

interface ReplayHeroArtProps {
  className?: string;
}

export function ReplayHeroArt({ className = '' }: ReplayHeroArtProps) {
  const [artTilt, setArtTilt] = useState<{ x: number; y: number; isHovered: boolean }>({
    x: 0,
    y: 0,
    isHovered: false,
  });

  const handleArtMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setArtTilt({ x: x * 20, y: -y * 20, isHovered: true });
  }, []);

  const handleArtMouseLeave = useCallback(() => {
    setArtTilt({ x: 0, y: 0, isHovered: false });
  }, []);

  return (
    <div
      onMouseMove={handleArtMouseMove}
      onMouseLeave={handleArtMouseLeave}
      className={`shrink-0 flex items-center justify-center md:justify-end relative group cursor-pointer select-none ${className}`}
      style={{ perspective: 1000 }}
      title="Chrono Market Replay Engine"
    >
      <div
        className="transition-transform duration-500 ease-out"
        style={{
          transform: `rotateX(${artTilt.y * 0.6}deg) rotateY(${artTilt.x * 0.6}deg) scale(${
            artTilt.isHovered ? 1.03 : 1
          })`,
          transformStyle: 'preserve-3d',
        }}
      >
        <svg
          viewBox="0 0 330 120"
          className="w-64 sm:w-76 md:w-88 h-auto select-none overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Chrono Market Replay Engine"
        >
          <defs>
            <style>{`
              @keyframes pulseLaserPlayhead {
                0%, 100% { opacity: 0.7; stroke-width: 1.5; }
                50% { opacity: 1; stroke-width: 2.2; }
              }
              @keyframes floatNeedleBadge {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-3px); }
              }
              @keyframes ghostCandleShimmer {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.55; }
              }
              @keyframes rotateDialRing {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .anim-laser-playhead {
                animation: pulseLaserPlayhead 3.5s ease-in-out infinite;
              }
              .anim-needle-badge {
                animation: floatNeedleBadge 4s ease-in-out infinite;
              }
              .anim-ghost-candle {
                animation: ghostCandleShimmer 5s ease-in-out infinite;
              }
              .anim-chrono-dial {
                transform-origin: 290px 60px;
                animation: rotateDialRing 30s linear infinite;
              }
            `}</style>

            {/* Ambient Background Glow */}
            <radialGradient id="chronoAmbientGlow" cx="45%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>

            {/* Playhead Laser Gradient */}
            <linearGradient id="playheadLaserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="40%" stopColor="#06b6d4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
            </linearGradient>

            {/* Tape Stage Gradient */}
            <linearGradient id="tapeStageGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#081422" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#0c1e34" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#091524" stopOpacity="0.7" />
            </linearGradient>

            {/* Dial Arc Gradient */}
            <linearGradient id="dialArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="neonReplayGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Ambient Background Glow */}
          <ellipse cx="165" cy="60" rx="140" ry="50" fill="url(#chronoAmbientGlow)" />

          {/* 2. Timeline Grid & Tape Stage Card */}
          <rect
            x="10"
            y="12"
            width="310"
            height="96"
            rx="12"
            fill="url(#tapeStageGrad)"
            stroke="#1a2e48"
            strokeWidth="1"
          />

          {/* Horizontal Gridlines */}
          <line x1="20" y1="36" x2="250" y2="36" stroke="#162940" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="20" y1="60" x2="250" y2="60" stroke="#162940" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="20" y1="84" x2="250" y2="84" stroke="#162940" strokeWidth="0.8" strokeDasharray="3 3" />

          {/* Timeline Bottom Ruler & Time Marks */}
          <line x1="20" y1="96" x2="250" y2="96" stroke="#1c3452" strokeWidth="1" />
          {[35, 65, 95, 125, 155, 185, 215, 245].map((x) => (
            <line key={x} x1={x} y1="96" x2={x} y2="100" stroke="#24446a" strokeWidth="1" />
          ))}

          <text x="35" y="106" fill="#475569" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
            T-4
          </text>
          <text x="95" y="106" fill="#475569" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
            T-2
          </text>
          <text x="155" y="106" fill="#06b6d4" fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
            T [NOW]
          </text>
          <text x="215" y="106" fill="#64748b" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
            T+2 (UNSEEN)
          </text>

          {/* 3. REVEALED HISTORICAL CANDLES (PAST TAPE) */}
          {/* Candle 1: Bullish Green */}
          <line x1="35" y1="52" x2="35" y2="82" stroke="#10b981" strokeWidth="1" opacity="0.7" />
          <rect x="31" y="60" width="8" height="16" rx="1" fill="#10b981" />

          {/* Candle 2: Bullish Green Climbing */}
          <line x1="65" y1="44" x2="65" y2="76" stroke="#10b981" strokeWidth="1" opacity="0.7" />
          <rect x="61" y="50" width="8" height="20" rx="1" fill="#10b981" />

          {/* Candle 3: Bearish Red Pullback */}
          <line x1="95" y1="48" x2="95" y2="86" stroke="#f43f5e" strokeWidth="1" opacity="0.8" />
          <rect x="91" y="54" width="8" height="24" rx="1" fill="#f43f5e" />

          {/* Candle 4: Bullish Breakout */}
          <line x1="125" y1="32" x2="125" y2="70" stroke="#10b981" strokeWidth="1" opacity="0.8" />
          <rect x="121" y="38" width="8" height="26" rx="1" fill="#10b981" />

          {/* Candle 5: Current Forming Candle right before playhead */}
          <line x1="155" y1="26" x2="155" y2="64" stroke="#38bdf8" strokeWidth="1.2" />
          <rect x="150" y="32" width="10" height="24" rx="1.5" fill="#06b6d4" filter="url(#neonReplayGlow)" />

          {/* 4. EXECUTION MARKER AT CANDLE 3 (BUY ENTRY) */}
          <g>
            {/* Entry Arrow Pin */}
            <polygon points="95,89 92,94 98,94" fill="#10b981" />
            <rect x="76" y="88" width="38" height="9" rx="3" fill="#06221a" stroke="#10b981" strokeWidth="0.8" />
            <text x="95" y="94.5" fill="#34d399" fontSize="5.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              BUY 0.01
            </text>
            {/* Profit Trajectory Arc */}
            <path
              d="M 95 87 Q 115 50 145 36"
              fill="none"
              stroke="#10b981"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          </g>

          {/* 5. ACTIVE CHRONO PLAYHEAD LASER */}
          <g>
            <line
              x1="168"
              y1="16"
              x2="168"
              y2="96"
              stroke="url(#playheadLaserGrad)"
              className="anim-laser-playhead"
            />
            {/* Top Playhead Needle Head */}
            <g className="anim-needle-badge">
              <polygon points="168,26 163,18 173,18" fill="#38bdf8" />
              <rect x="146" y="7" width="44" height="12" rx="4" fill="#082236" stroke="#38bdf8" strokeWidth="1" />
              <text x="168" y="15" fill="#7dd3fc" fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ▶ STEP T+1
              </text>
            </g>
          </g>

          {/* 6. GHOST / FUTURE UNREVEALED CANDLES (Awaiting Step Forward) */}
          <g className="anim-ghost-candle">
            {/* Candle 6 (Ghost) */}
            <line x1="185" y1="28" x2="185" y2="60" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
            <rect x="181" y="34" width="8" height="20" rx="1" fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="2 2" />

            {/* Candle 7 (Ghost Target Peak) */}
            <line x1="215" y1="20" x2="215" y2="52" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.4" />
            <rect x="211" y="24" width="8" height="22" rx="1" fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 2" />
            {/* Ghost TP Target Pill */}
            <rect x="200" y="10" width="30" height="9" rx="2.5" fill="#061c14" stroke="#10b981" strokeWidth="0.6" strokeDasharray="2 1" />
            <text x="215" y="16.5" fill="#10b981" fontSize="5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              TP +$240
            </text>

            {/* Candle 8 (Ghost Distant) */}
            <line x1="245" y1="30" x2="245" y2="68" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.3" />
            <rect x="241" y="38" width="8" height="18" rx="1" fill="none" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 2" />
          </g>

          {/* 7. CHRONO REPLAY SPEED & TIME TRAVEL DIAL (Right Cockpit) */}
          <g>
            {/* Outer Static Track */}
            <circle cx="288" cy="60" r="28" fill="#071320" stroke="#182e46" strokeWidth="1.5" />

            {/* Animated Rotating Calibrated Ticks */}
            <g className="anim-chrono-dial">
              <circle
                cx="288"
                cy="60"
                r="24"
                fill="none"
                stroke="url(#dialArcGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                opacity="0.85"
              />
            </g>

            {/* Inner Fixed Dial Face */}
            <circle cx="288" cy="60" r="18" fill="#0b1e32" stroke="#0284c7" strokeWidth="1" />

            {/* Replay Chrono Badge Text */}
            <text x="288" y="57" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="900" textAnchor="middle">
              10x
            </text>
            <text x="288" y="66" fill="#94a3b8" fontSize="5.5" fontFamily="monospace" fontWeight="600" textAnchor="middle">
              SPEED
            </text>

            {/* Chrono Fast-Forward Glyphs */}
            <polygon points="280,74 284,77 280,80" fill="#06b6d4" />
            <polygon points="284,74 288,77 284,80" fill="#06b6d4" />
            <polygon points="292,74 296,77 292,80" fill="#10b981" />
          </g>
        </svg>
      </div>
    </div>
  );
}
