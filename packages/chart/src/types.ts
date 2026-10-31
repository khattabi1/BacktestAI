import type { Bar } from 'openalgo-charts';

export type OpenAlgoBar = Bar;

export interface ChartTrade {
  id: string;
  side: 'LONG' | 'SHORT';
  entryTime: string | number;
  exitTime: string | number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  stopLoss?: number;
  takeProfit?: number;
  initialStopLoss?: number;
  isBreakEven?: boolean;
}

export interface ReplayStateUpdate {
  currentTime: number | null;
  currentBar: OpenAlgoBar | null;
  activeCount: number;
  isPlaying?: boolean;
  barIndex?: number;
  totalBars?: number;
  progressPct?: number;
}

export interface TradeSnapshotOverlay {
  symbol?: string;
  timeframe?: string;
  direction?: 'BUY' | 'SELL';
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl?: number;
  quantity?: number;
}

export interface OpenAlgoChartApi {
  priceToCoordinate: (price: number) => number | null;
  coordinateToPrice: (y: number) => number | null;
  getPlotRect: () => { left: number; top: number; width: number; height: number } | null;
  getChartElement: () => HTMLElement | null;
  subscribeScaleChange: (cb: () => void) => () => void;
  getCanvasSnapshot?: (tradeOverlay?: TradeSnapshotOverlay) => string | null;
}

export interface OpenAlgoChartProps {
  bars: OpenAlgoBar[];
  trades?: ChartTrade[];
  symbol?: string;
  timeframe?: string;
  height?: number | string;
  showVolume?: boolean;
  showReplayScrubber?: boolean;
  onBarHover?: (bar: OpenAlgoBar | null) => void;
  onReplayStateChange?: (state: ReplayStateUpdate) => void;
  // Studio & Session Integrations
  activeSessionId?: string;
  activeSessionName?: string;
  activeSessionBalance?: number;
  initialBarIndex?: number;
  initialReplayTime?: number;
  onOpenSessionLauncher?: () => void;
  isOrderPanelOpen?: boolean;
  onToggleOrderPanel?: () => void;
  onExitWorkspace?: () => void;
  activeStrategyName?: string;
  onOpenStrategyDrawer?: () => void;
  onRunSimulation?: () => void;
  isRunning?: boolean;
  isLoading?: boolean;
  onSymbolChange?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string, anchorTime?: number | null) => void;
  onLoadOlderBars?: () => void;
  onLoadNewerBars?: () => void;
  apiBaseUrl?: string;
  onChartApi?: (api: OpenAlgoChartApi | null) => void;
  isCompleted?: boolean;
}
