import React from 'react';

/**
 * Enhanced Precision Syntax Code Icon
 * Features crisp, bold brackets in vivid sky-cyan with an amber operator slash.
 * Completely static (no hover animations).
 */
export function CodeViewIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      {/* Right Bracket '>' */}
      <path
        d="M17 16L21 12L17 8"
        stroke="#38BDF8"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left Bracket '<' */}
      <path
        d="M7 8L3 12L7 16"
        stroke="#38BDF8"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center Operator Slash '/' in Amber */}
      <path
        d="M14 4L10 20"
        stroke="#F59E0B"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Precision Quantitative Backtest Results Icon
 * Displays a rising cumulative equity curve with shaded profit area and peak profit dot.
 * Completely static (no hover animations).
 */
export function ResultsViewIcon({
  className = 'w-4 h-4',
  isActive = false,
}: {
  className?: string;
  isActive?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      {/* Shaded Profit Area under Curve */}
      <path
        d="M3 18L7.5 13.5L11.5 15.5L16.5 8.5L21 5.5V20H3V18Z"
        fill="#10B981"
        fillOpacity={isActive ? 0.35 : 0.22}
      />
      {/* Axes */}
      <path
        d="M3 3V20H21"
        stroke={isActive ? '#38BDF8' : '#475569'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rising Cumulative Equity Curve (Profit Alpha) */}
      <path
        d="M3 18L7.5 13.5L11.5 15.5L16.5 8.5L21 5.5"
        stroke="#10B981"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Peak Profit Point */}
      <circle cx="21" cy="5.5" r="2.2" fill="#10B981" />
    </svg>
  );
}

/**
 * Precision Financial Candlestick Chart Icon
 * Displays a 3-candle price formation (Bull Green, Bear Red, Breakout Bull) with price axes and horizontal level line.
 * Completely static (no hover animations).
 */
export function ChartCandlesIcon({
  className = 'w-4 h-4',
  isActive = false,
}: {
  className?: string;
  isActive?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      {/* Axes */}
      <path
        d="M2 3V20A1 1 0 0 0 3 21H22"
        stroke={isActive ? '#38BDF8' : '#475569'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Horizontal Price Dotted Level Line */}
      <line
        x1="2"
        y1="11"
        x2="22"
        y2="11"
        stroke="#06B6D4"
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.6"
      />
      {/* Candle 1: Bull Green */}
      <line x1="6.5" y1="9" x2="6.5" y2="18" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4.5" y="11" width="4" height="5" rx="0.8" fill="#10B981" />

      {/* Candle 2: Bear Pullback (Red) */}
      <line x1="12" y1="10" x2="12" y2="19" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10" y="12" width="4" height="5" rx="0.8" fill="#F43F5E" />

      {/* Candle 3: Big Bull Breakout Green */}
      <line x1="17.5" y1="4" x2="17.5" y2="14" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="15.5" y="6" width="4" height="6" rx="0.8" fill="#10B981" />
    </svg>
  );
}
