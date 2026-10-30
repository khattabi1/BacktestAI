import { darkTheme, type ChartTheme } from 'openalgo-charts';

export const OBSIDIAN_OPENALGO_THEME: ChartTheme = {
  ...darkTheme,
  background: '#080B10',
  grid: 'rgba(32, 42, 56, 0.45)',
  axisLine: '#202A38',
  axisText: '#94A3B8',
  paneSeparator: '#202A38',
  crosshair: '#22D3EE',
  upColor: '#22C55E', // Emerald
  downColor: '#EF4444', // Controlled Red
  wickUpColor: '#22C55E',
  wickDownColor: '#EF4444',
  buy: '#22C55E',
  sell: '#EF4444',
  profit: '#22C55E',
  loss: '#EF4444',
};
