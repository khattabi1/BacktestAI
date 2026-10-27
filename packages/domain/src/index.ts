/**
 * Backtest AI Shared Domain Models & Contracts
 * Pure TypeScript interfaces shared with apps/web
 */

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderSide = 'BUY' | 'SELL';
export type PositionSide = 'LONG' | 'SHORT';
export type BacktestStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Bar {
  timestamp: string; // ISO 8601 UTC string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread?: number;
}

export interface Order {
  orderId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt?: string;
  tag?: string;
}

export interface Position {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  entryTime: string;
  currentPrice: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  tradeId: string;
  symbol: string;
  side: PositionSide;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  exitReason: 'TP' | 'SL' | 'SIGNAL' | 'CLOSE_END' | 'MANUAL' | 'PARTIAL';
  holdingPeriodBars: number;
  tag?: string;
}

export interface EquityPoint {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

export interface PerformanceMetrics {
  initialCapital: number;
  endingEquity: number;
  netProfit: number;
  netProfitPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  averageTrade: number;
  averageWin: number;
  averageLoss: number;
  payoffRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  exposurePct: number;
}

export interface SimulationConfig {
  initialCapital: number;
  leverage: number;
  commissionPerOrder: number;
  commissionPct: number;
  slippagePoints: number;
  spreadPoints: number;
  pointValue: number;
  riskFreeRate: number;
  annualizationFactor: number;
}

export interface StrategyRecord {
  id: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  parameters: Record<string, unknown>;
  codeSnippet?: string;
  tags: string[];
}

export interface BacktestRecord {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  status: BacktestStatus;
  config: SimulationConfig;
  metrics?: PerformanceMetrics;
  trades?: Trade[];
  equityCurve?: EquityPoint[];
  engineVersion: string;
  dataChecksum: string;
  createdAt: string;
}

export interface ReplayPosition {
  id: string;
  symbol: string;
  side: PositionSide;
  entryTime: string;
  entryPrice: number;
  quantity: number; // lots
  stopLoss?: number;
  takeProfit?: number;
  initialBalance: number;
  openBarIndex?: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  orderType: 'LIMIT' | 'STOP';
  side: PositionSide;
  targetPrice: number;
  quantity: number; // lots
  stopLoss?: number;
  takeProfit?: number;
  createdAtTime: string;
}

export interface BacktestSession {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  initialBalance: number;
  currentBalance: number;
  strategyId: string;
  strategyName: string;
  parameters: Record<string, unknown>;
  config: SimulationConfig;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  replayIndex?: number;
  lastBarIndex?: number;
  lastReplayTime?: number;
  totalBars?: number;
  progressPct?: number;
  journalId?: string;
  activePositions?: ReplayPosition[];
  pendingOrders?: PendingOrder[];
  trades: Trade[];
  metrics?: PerformanceMetrics;
  equityCurve?: EquityPoint[];
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  backtestId?: string;
  strategyId?: string;
  title: string;
  hypothesis: string;
  setupNotes: string;
  conclusion: string;
  tags: string[];
  createdAt: string;
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  assetClass: 'Forex' | 'Crypto' | 'Indices' | 'Commodities';
  baseCurrency: string;
  quoteCurrency: string;
  pipSize: number;
  minLotSize: number;
  isActive: boolean;
}

export interface BacktestRunRequest {
  symbol: string;
  timeframe: string;
  strategyId: string;
  strategyName?: string;
  parameters: Record<string, unknown>;
  config: SimulationConfig;
  startDate?: string;
  endDate?: string;
}

export interface BacktestRunResponse {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  status: BacktestStatus;
  config: SimulationConfig;
  metrics: PerformanceMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  barsProcessed: number;
  durationSeconds: number;
  createdAt: string;
}

export interface MarketSymbolInfo {
  market: string;
  symbol: string;
  timeframe: string;
  fileCount: number;
}

export interface StrategyParameterDef {
  name: string;
  type: string;
  default: unknown;
  description: string;
  minValue?: number;
  maxValue?: number;
}

export interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  parameters: StrategyParameterDef[];
}
