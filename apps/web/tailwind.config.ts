import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/chart/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          base: '#080B10',
          sub: '#0D1118',
          card: '#111722',
          elevated: '#151C27',
          border: '#202A38',
        },
        cyan: {
          accent: '#22D3EE',
          glow: 'rgba(34, 211, 238, 0.15)',
        },
        emerald: {
          edge: '#22C55E',
          glow: 'rgba(34, 197, 94, 0.15)',
        },
        crimson: {
          risk: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.15)',
        },
        violet: {
          ai: '#8B5CF6',
          glow: 'rgba(139, 92, 246, 0.15)',
        },
        slate: {
          text: '#F4F7FA',
          subtext: '#94A3B8',
          muted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        'hud': '0 0 20px -5px rgba(34, 211, 238, 0.1)',
        'hud-emerald': '0 0 20px -5px rgba(34, 197, 94, 0.1)',
        'hud-card': '0 4px 24px -2px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
};

export default config;
