'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { QuantLoader } from '@/components/common/QuantLoader';
import {
  Play,
  RotateCcw,
  Sliders,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Clock,
  DollarSign,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Database,
  Check,
  Sparkles,
  BarChart3,
  LineChart,
  Target,
  ArrowRight,
  Search,
  ExternalLink,
  Code2,
  Cpu,
  History,
} from 'lucide-react';
import { StrategyParameter, SimulationMetrics } from './AutopsyDiagnosticsDrawer';

export interface SimulatedTrade {
  trade_id?: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  pnl_percent: number;
  exit_reason?: string;
  commission?: number;
  slippage?: number;
  holding_period_bars?: number;
}

export interface EquityPoint {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown: number;
  drawdown_pct: number;
}

export interface SandboxLaunchConfig {
  symbol?: string;
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  parameters?: Record<string, any>;
  autoStart?: boolean;
}

export interface GranularMetrics extends SimulationMetrics {
  initialCapital?: number;
  endingEquity?: number;
  winningTrades?: number;
  losingTrades?: number;
  expectancy?: number;
  averageTrade?: number;
  averageWin?: number;
  averageLoss?: number;
  payoffRatio?: number;
  maxDrawdown?: number;
  maxConsecutiveWins?: number;
  maxConsecutiveLosses?: number;
  exposurePct?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
}

export interface CentralSandboxRunnerPanelProps {
  strategyName: string;
  code?: string;
  language?: 'python' | 'mql5';
  parameters?: StrategyParameter[];
  onUpdateParameter?: (name: string, value: string | number | boolean) => void;
  onSimulationComplete?: (results: {
    runId: string;
    metrics: SimulationMetrics;
    trades: SimulatedTrade[];
    symbol: string;
    timeframe: string;
  }) => void;
  initialConfig?: SandboxLaunchConfig | null;
  onSendReportToAgent?: (report: {
    runId: string;
    strategyName: string;
    symbol: string;
    timeframe: string;
    dateRange: string;
    metrics: SimulationMetrics;
    trades: SimulatedTrade[];
    parameters: Record<string, any>;
  }) => void;
  onBackToEditor?: () => void;
  onOpenChartRunner?: () => void;
  simulationMetrics?: SimulationMetrics | null;
  trades?: SimulatedTrade[];
  runId?: string | null;
  versionNum?: number;
  strategyVersions?: any[];
  onSelectVersion?: (v: number) => void;
  hideHeader?: boolean;
  selectedRunDetails?: any | null;
  isLoading?: boolean;
}

export interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  version_num?: number;
  symbol: string;
  timeframe: string;
  start_date?: string;
  end_date?: string;
  config?: any;
  status: string;
  metrics?: any;
  created_at: string;
}

// Metric Normalizer to guarantee zero overflow or malformed percentages
function sanitizeMetrics(m: any): GranularMetrics {
  if (!m) {
    return {
      netProfit: 0,
      netProfitPct: 0,
      winRate: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      maxDrawdownPct: 0,
      totalTrades: 0,
      barsProcessed: 0,
      executionTimeMs: 45,
      lookaheadBias: '0.000% (Strictly Causal)',
      initialCapital: 100000,
      endingEquity: 100000,
      winningTrades: 0,
      losingTrades: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0,
      payoffRatio: 0,
      maxDrawdown: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      exposurePct: 0,
    };
  }

  const rawWinRate = Number(m.winRate ?? m.win_rate ?? 0);
  const winRate = rawWinRate <= 1.0 && rawWinRate > 0
    ? Math.round(rawWinRate * 1000) / 10
    : Math.min(100, Math.max(0, Math.round(rawWinRate * 10) / 10));

  const rawDDPct = Number(m.maxDrawdownPct ?? m.max_drawdown_pct ?? 0);
  const maxDrawdownPct = rawDDPct <= 1.0 && rawDDPct > 0
    ? Math.round(rawDDPct * 1000) / 10
    : Math.min(100, Math.max(0, Math.round(rawDDPct * 10) / 10));

  return {
    netProfit: Number(m.netProfit ?? m.net_profit ?? 0),
    netProfitPct: Math.round(Number(m.netProfitPct ?? m.net_profit_pct ?? 0) * 100) / 100,
    winRate: isNaN(winRate) ? 0 : winRate,
    sharpeRatio: Math.round(Number(m.sharpeRatio ?? m.sharpe_ratio ?? 0) * 100) / 100,
    profitFactor: Math.round(Number(m.profitFactor ?? m.profit_factor ?? 0) * 100) / 100,
    maxDrawdownPct: isNaN(maxDrawdownPct) ? 0 : maxDrawdownPct,
    totalTrades: Number(m.totalTrades ?? m.total_trades ?? 0),
    barsProcessed: Number(m.barsProcessed ?? m.bars_processed ?? 0),
    executionTimeMs: Number(m.executionTimeMs ?? m.execution_time_ms ?? 0),
    lookaheadBias: '0.000% (Strictly Causal)',
    initialCapital: Number(m.initialCapital ?? m.initial_capital ?? 100000),
    endingEquity: Number(m.endingEquity ?? m.ending_equity ?? 100000),
    winningTrades: Number(m.winningTrades ?? m.winning_trades ?? 0),
    losingTrades: Number(m.losingTrades ?? m.losing_trades ?? 0),
    expectancy: Math.round(Number(m.expectancy ?? 0) * 100) / 100,
    averageTrade: Math.round(Number(m.averageTrade ?? m.average_trade ?? 0) * 100) / 100,
    averageWin: Math.round(Number(m.averageWin ?? m.average_win ?? 0) * 100) / 100,
    averageLoss: Math.round(Number(m.averageLoss ?? m.average_loss ?? 0) * 100) / 100,
    payoffRatio: Math.round(Number(m.payoffRatio ?? m.payoff_ratio ?? 0) * 100) / 100,
    maxDrawdown: Math.round(Number(m.maxDrawdown ?? m.max_drawdown ?? 0) * 100) / 100,
    maxConsecutiveWins: Number(m.maxConsecutiveWins ?? m.max_consecutive_wins ?? 0),
    maxConsecutiveLosses: Number(m.maxConsecutiveLosses ?? m.max_consecutive_losses ?? 0),
    exposurePct: Math.round(Number(m.exposurePct ?? m.exposure_pct ?? 0) * 10) / 10,
    sortinoRatio: Math.round(Number(m.sortinoRatio ?? m.sortino_ratio ?? 0) * 100) / 100,
    calmarRatio: Math.round(Number(m.calmarRatio ?? m.calmar_ratio ?? 0) * 100) / 100,
  };
}

// Format run summary label with sequential test number, engine, symbol, timeframe, date range, and performance
function formatRunLabel(r: BacktestRunSummary, idx: number, total: number): string {
  const runNumber = total - idx;
  const isMt5 = r.id.startsWith('mt5_');
  const engineTag = isMt5 ? 'MT5' : 'Sim';
  const sym = r.symbol || 'XAUUSD';
  const tf = (r.timeframe || 'M15').toUpperCase();

  // Helper to normalize dates (handles 'YYYY.MM.DD' and ISO 'YYYY-MM-DDTHH:mm:ss')
  const cleanDate = (val: any) => {
    if (!val) return null;
    const s = String(val).trim().replace(/\./g, '-');
    return s.split('T')[0].split(' ')[0];
  };

  // Prefer authentic simulation dates from config (from_date / to_date) or start_date / end_date
  const rawStart =
    (r.config as any)?.from_date ||
    (r.config as any)?.start_date ||
    (r.config as any)?.startDate ||
    r.start_date;
  const rawEnd =
    (r.config as any)?.to_date ||
    (r.config as any)?.end_date ||
    (r.config as any)?.endDate ||
    r.end_date;

  let dateRangeStr = '';
  const s = cleanDate(rawStart);
  const e = cleanDate(rawEnd);
  if (s && e) {
    dateRangeStr = ` · ${s} → ${e}`;
  }

  // Extract profit / WR if available in run summary
  let perfStr = '';
  const net = r.metrics?.netProfit ?? r.metrics?.net_profit;
  const wr = r.metrics?.winRate ?? r.metrics?.win_rate;
  if (net !== undefined && wr !== undefined) {
    const netFormatted = Number(net) >= 0 ? `+$${Number(net).toFixed(0)}` : `-$${Math.abs(Number(net)).toFixed(0)}`;
    const wrFormatted = Number(wr) <= 1 && Number(wr) > 0 ? `${(Number(wr) * 100).toFixed(0)}%` : `${Number(wr).toFixed(0)}%`;
    perfStr = ` (${netFormatted} · ${wrFormatted} WR)`;
  }

  return `Test #${runNumber} [${engineTag}] · ${sym} ${tf}${dateRangeStr}${perfStr}`;
}

export function CentralSandboxRunnerPanel({
  strategyName,
  code = '',
  language = 'python',
  parameters = [],
  onUpdateParameter,
  onSimulationComplete,
  initialConfig,
  onSendReportToAgent,
  onBackToEditor,
  onOpenChartRunner,
  simulationMetrics: initialMetrics,
  trades: initialTrades,
  runId: propRunId,
  versionNum: propVersionNum,
  strategyVersions = [],
  onSelectVersion,
  hideHeader = false,
  selectedRunDetails,
  isLoading = false,
}: CentralSandboxRunnerPanelProps) {
  // Strategy base name and active version
  const cleanStrategyName = useMemo(() => strategyName.replace(/\.[^/.]+$/, ''), [strategyName]);
  const versionMatch = cleanStrategyName.match(/_v(\d+)/);
  const effectiveVersionNum = propVersionNum ?? (versionMatch ? Number(versionMatch[1]) : 1);
  const versionPill = `v${effectiveVersionNum}`;

  const initialMetricsRef = useRef(initialMetrics);
  initialMetricsRef.current = initialMetrics;
  const propRunIdRef = useRef(propRunId);
  propRunIdRef.current = propRunId;

  // All completed backtest runs for this strategy across all versions
  const [allStrategyRuns, setAllStrategyRuns] = useState<BacktestRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(propRunId || null);
  const [isLoadingRuns, setIsLoadingRuns] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Strict version isolation: only show runs that belong to the active version
  const availableRuns = useMemo(() => {
    return allStrategyRuns.filter((r) => {
      const v = Number(r.version_num ?? (r.config as any)?.version_num ?? 1);
      return v === effectiveVersionNum;
    });
  }, [allStrategyRuns, effectiveVersionNum]);

  // Active run data
  const [currentMetrics, setCurrentMetrics] = useState<GranularMetrics | null>(
    initialMetrics ? sanitizeMetrics(initialMetrics) : null
  );
  const [currentTrades, setCurrentTrades] = useState<SimulatedTrade[]>(initialTrades || []);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [runConfig, setRunConfig] = useState<{
    symbol: string;
    timeframe: string;
    startDate?: string;
    endDate?: string;
    initialCapital: number;
    parameters: Record<string, any>;
  }>({
    symbol: initialConfig?.symbol || 'XAUUSD',
    timeframe: initialConfig?.timeframe || '15m',
    startDate: initialConfig?.startDate,
    endDate: initialConfig?.endDate,
    initialCapital: 100000,
    parameters: initialConfig?.parameters || {},
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'chart' | 'analytics' | 'trades' | 'config'>('chart');
  const [chartViewMode, setChartViewMode] = useState<'equity' | 'underwater'>('equity');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'wins' | 'losses' | 'be' | 'long' | 'short'>('all');
  const [tradeSearch, setTradeSearch] = useState<string>('');
  const [tradePage, setTradePage] = useState<number>(1);
  const tradesPerPage = 20;

  // Running execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Synchronize when parent passes fresh simulation metrics or trades (standalone unmanaged mode only)
  useEffect(() => {
    if (hideHeader) return;
    if (initialMetrics) {
      setCurrentMetrics(sanitizeMetrics(initialMetrics));
    }
    if (initialTrades && initialTrades.length > 0) {
      setCurrentTrades(initialTrades);
    }
    if (propRunId) {
      setSelectedRunId(propRunId);
    }
  }, [initialMetrics, initialTrades, propRunId, hideHeader]);

  // Synchronize when parent passes detailed run object
  useEffect(() => {
    if (!selectedRunDetails) {
      if (hideHeader) {
        setCurrentMetrics(null);
        setCurrentTrades([]);
        setEquityCurve([]);
      }
      return;
    }

    if (selectedRunDetails.id) {
      setSelectedRunId(selectedRunDetails.id);
      propRunIdRef.current = selectedRunDetails.id;
      setAllStrategyRuns((prev) => {
        if (prev.some((r) => r.id === selectedRunDetails.id)) return prev;
        const summaryObj: BacktestRunSummary = {
          id: selectedRunDetails.id,
          strategy_id: selectedRunDetails.strategy_id || cleanStrategyName,
          strategy_name: selectedRunDetails.strategy_name || cleanStrategyName,
          version_num: selectedRunDetails.version_num ?? effectiveVersionNum,
          symbol: selectedRunDetails.symbol || 'XAUUSD',
          timeframe: selectedRunDetails.timeframe || '15m',
          start_date: selectedRunDetails.start_date,
          end_date: selectedRunDetails.end_date,
          status: 'completed',
          metrics: selectedRunDetails.metrics,
          created_at: selectedRunDetails.created_at || new Date().toISOString(),
        };
        return [summaryObj, ...prev];
      });
    }

    const mappedMetrics = sanitizeMetrics(selectedRunDetails.metrics || {});
    mappedMetrics.barsProcessed = selectedRunDetails.bars_processed ?? 0;
    mappedMetrics.executionTimeMs = Math.round((selectedRunDetails.duration_seconds ?? 0) * 1000);
    setCurrentMetrics(mappedMetrics);

    const rawTrades: SimulatedTrade[] = Array.isArray(selectedRunDetails.trades)
      ? selectedRunDetails.trades.map((t: any, idx: number) => {
          const sideRaw = String(t.side || 'BUY').toUpperCase();
          const side: 'BUY' | 'SELL' = sideRaw.includes('SELL') || sideRaw.includes('SHORT') ? 'SELL' : 'BUY';
          return {
            trade_id: t.trade_id || t.id || `TRD_${idx + 1}`,
            symbol: t.symbol || selectedRunDetails.symbol || 'XAUUSD',
            side: side,
            entry_time: t.entry_time ? String(t.entry_time).replace(/\./g, '-').replace('T', ' ').slice(0, 19) : '',
            exit_time: t.exit_time ? String(t.exit_time).replace(/\./g, '-').replace('T', ' ').slice(0, 19) : '',
            entry_price: Number(t.entry_price ?? 0),
            exit_price: Number(t.exit_price ?? 0),
            quantity: Number(t.quantity ?? 1),
            pnl: Math.round(Number(t.pnl ?? 0) * 100) / 100,
            pnl_percent: Math.round(Number(t.pnl_percent ?? t.pnl_pct ?? 0) * 100) / 100,
            exit_reason: t.exit_reason || 'TARGET_HIT',
            commission: Number(t.commission ?? t.fee ?? 0),
            slippage: Number(t.slippage ?? 0),
            holding_period_bars: Number(t.holding_period_bars ?? 0),
          };
        })
      : [];
    // Strict chronological sort prevents any date backtracking on chart
    rawTrades.sort((a, b) => {
      const ta = a.entry_time ? new Date(a.entry_time.replace(' ', 'T')).getTime() : 0;
      const tb = b.entry_time ? new Date(b.entry_time.replace(' ', 'T')).getTime() : 0;
      return ta - tb;
    });
    setCurrentTrades(rawTrades);

    if (Array.isArray(selectedRunDetails.equity_curve) && selectedRunDetails.equity_curve.length > 0) {
      const sortedCurve = [...selectedRunDetails.equity_curve].sort((a, b) => {
        const ta = a.timestamp ? new Date(String(a.timestamp).replace(' ', 'T')).getTime() : 0;
        const tb = b.timestamp ? new Date(String(b.timestamp).replace(' ', 'T')).getTime() : 0;
        return ta - tb;
      });
      setEquityCurve(sortedCurve);
    } else if (rawTrades.length > 0) {
      let runningBalance = mappedMetrics.initialCapital || 100000;
      let peak = runningBalance;
      const synth: EquityPoint[] = [
        {
          timestamp: rawTrades[0]?.entry_time || '2024-01-01',
          balance: runningBalance,
          equity: runningBalance,
          drawdown: 0,
          drawdown_pct: 0,
        },
      ];
      rawTrades.forEach((t) => {
        runningBalance += t.pnl;
        if (runningBalance > peak) peak = runningBalance;
        const dd = peak - runningBalance;
        const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
        synth.push({
          timestamp: t.exit_time,
          balance: runningBalance,
          equity: runningBalance,
          drawdown: dd,
          drawdown_pct: ddPct,
        });
      });
      setEquityCurve(synth);
    }

    const cleanDate = (val: any) => {
      if (!val) return undefined;
      const s = String(val).trim().replace(/\./g, '-');
      return s.split('T')[0].split(' ')[0];
    };

    const rawStart =
      selectedRunDetails.start_date ||
      selectedRunDetails.config?.from_date ||
      selectedRunDetails.config?.start_date ||
      selectedRunDetails.config?.startDate ||
      (rawTrades.length > 0 ? rawTrades[0].entry_time : undefined);
    const rawEnd =
      selectedRunDetails.end_date ||
      selectedRunDetails.config?.to_date ||
      selectedRunDetails.config?.end_date ||
      selectedRunDetails.config?.endDate ||
      (rawTrades.length > 0 ? rawTrades[rawTrades.length - 1].exit_time : undefined);

    setRunConfig({
      symbol: selectedRunDetails.symbol || 'XAUUSD',
      timeframe: selectedRunDetails.timeframe || '15m',
      startDate: cleanDate(rawStart),
      endDate: cleanDate(rawEnd),
      initialCapital: selectedRunDetails.config?.initial_capital ?? mappedMetrics.initialCapital ?? 100000,
      parameters: selectedRunDetails.config?.parameters || {},
    });
  }, [selectedRunDetails, cleanStrategyName, effectiveVersionNum, hideHeader]);

  // Load detailed results for a specific backtest ID
  const loadRunDetails = useCallback(async (runId: string) => {
    setIsLoadingDetails(true);
    // Clear stale display data immediately so old test is never visible during load
    setCurrentMetrics(null);
    setCurrentTrades([]);
    setEquityCurve([]);
    try {
      let data: any = null;
      try {
        const res = await fetch(`/api/v1/backtests/${runId}`);
        if (res.ok) data = await res.json();
      } catch {
        const res2 = await fetch(`/api/v1/backtests/${runId}`);
        if (res2.ok) data = await res2.json();
      }

      if (!data) return;

      const mappedMetrics = sanitizeMetrics(data.metrics || {});
      mappedMetrics.barsProcessed = data.bars_processed ?? 0;
      mappedMetrics.executionTimeMs = Math.round((data.duration_seconds ?? 0) * 1000);
      setCurrentMetrics(mappedMetrics);

      // Normalize trades
      const rawTrades: SimulatedTrade[] = Array.isArray(data.trades)
        ? data.trades.map((t: any, idx: number) => {
            const sideRaw = String(t.side || 'BUY').toUpperCase();
            const side: 'BUY' | 'SELL' = sideRaw.includes('SELL') || sideRaw.includes('SHORT') ? 'SELL' : 'BUY';
            return {
              trade_id: t.trade_id || t.id || `TRD_${idx + 1}`,
              symbol: t.symbol || data.symbol || 'XAUUSD',
              side: side,
              entry_time: t.entry_time ? String(t.entry_time).replace(/\./g, '-').replace('T', ' ').slice(0, 19) : '',
              exit_time: t.exit_time ? String(t.exit_time).replace(/\./g, '-').replace('T', ' ').slice(0, 19) : '',
              entry_price: Number(t.entry_price ?? 0),
              exit_price: Number(t.exit_price ?? 0),
              quantity: Number(t.quantity ?? 1),
              pnl: Math.round(Number(t.pnl ?? 0) * 100) / 100,
              pnl_percent: Math.round(Number(t.pnl_percent ?? t.pnl_pct ?? 0) * 100) / 100,
              exit_reason: t.exit_reason || 'TARGET_HIT',
              commission: Number(t.commission ?? t.fee ?? 0),
              slippage: Number(t.slippage ?? 0),
              holding_period_bars: Number(t.holding_period_bars ?? 0),
            };
          })
        : [];
      // Strict chronological sort prevents any date backtracking on chart
      rawTrades.sort((a, b) => {
        const ta = a.entry_time ? new Date(a.entry_time.replace(' ', 'T')).getTime() : 0;
        const tb = b.entry_time ? new Date(b.entry_time.replace(' ', 'T')).getTime() : 0;
        return ta - tb;
      });
      setCurrentTrades(rawTrades);

      // Load or Synthesize Equity Curve
      if (Array.isArray(data.equity_curve) && data.equity_curve.length > 0) {
        const sortedCurve = [...data.equity_curve].sort((a, b) => {
          const ta = a.timestamp ? new Date(String(a.timestamp).replace(' ', 'T')).getTime() : 0;
          const tb = b.timestamp ? new Date(String(b.timestamp).replace(' ', 'T')).getTime() : 0;
          return ta - tb;
        });
        setEquityCurve(sortedCurve);
      } else if (rawTrades.length > 0) {
        let runningBalance = mappedMetrics.initialCapital || 100000;
        let peak = runningBalance;
        const synth: EquityPoint[] = [
          {
            timestamp: rawTrades[0]?.entry_time || '2024-01-01',
            balance: runningBalance,
            equity: runningBalance,
            drawdown: 0,
            drawdown_pct: 0,
          },
        ];
        rawTrades.forEach((t) => {
          runningBalance += t.pnl;
          if (runningBalance > peak) peak = runningBalance;
          const dd = peak - runningBalance;
          const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
          synth.push({
            timestamp: t.exit_time,
            balance: runningBalance,
            equity: runningBalance,
            drawdown: dd,
            drawdown_pct: ddPct,
          });
        });
        setEquityCurve(synth);
      }

      const cleanDate = (val: any) => {
        if (!val) return undefined;
        const s = String(val).trim().replace(/\./g, '-');
        return s.split('T')[0].split(' ')[0];
      };

      const rawStart =
        data.start_date ||
        data.config?.from_date ||
        data.config?.start_date ||
        data.config?.startDate ||
        (rawTrades.length > 0 ? rawTrades[0].entry_time : undefined);
      const rawEnd =
        data.end_date ||
        data.config?.to_date ||
        data.config?.end_date ||
        data.config?.endDate ||
        (rawTrades.length > 0 ? rawTrades[rawTrades.length - 1].exit_time : undefined);

      // Store configuration snapshot
      setRunConfig({
        symbol: data.symbol || 'XAUUSD',
        timeframe: data.timeframe || '15m',
        startDate: cleanDate(rawStart),
        endDate: cleanDate(rawEnd),
        initialCapital: data.config?.initial_capital ?? 100000,
        parameters: data.config?.parameters || {},
      });
    } catch (err) {
      console.warn('[CentralSandboxRunnerPanel] Failed to load run details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Fetch available backtests from backend and auto-load the latest run
  const fetchRuns = useCallback(async () => {
    if (hideHeader) return;
    setIsLoadingRuns(true);
    try {
      let data: BacktestRunSummary[] = [];
      try {
        const res = await fetch('/api/v1/backtests?limit=50');
        if (res.ok) data = await res.json();
      } catch {
        const res2 = await fetch('/api/v1/backtests?limit=50');
        if (res2.ok) data = await res2.json();
      }

      if (Array.isArray(data) && data.length > 0) {
        // STRICT filter: only include runs that belong to the active strategy
        const matchingRuns = data.filter(
          (r) =>
            r.strategy_id === cleanStrategyName ||
            r.strategy_id === strategyName ||
            (r.strategy_name && r.strategy_name.toLowerCase() === cleanStrategyName.toLowerCase()) ||
            cleanStrategyName.includes(r.strategy_id) ||
            r.strategy_id.includes(cleanStrategyName)
        );
        setAllStrategyRuns(matchingRuns);
      } else {
        setAllStrategyRuns([]);
      }
    } catch (err) {
      console.warn('[CentralSandboxRunnerPanel] Failed to fetch backtests list:', err);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [cleanStrategyName, strategyName, hideHeader]);

  // Synchronize active run selection when active version or availableRuns changes
  useEffect(() => {
    if (hideHeader) return;
    // If a run is already actively selected with details loaded, do not overwrite it!
    if (selectedRunId && selectedRunDetails?.id === selectedRunId) {
      return;
    }
    if (availableRuns.length > 0) {
      const preferredId = propRunIdRef.current;
      const targetRun =
        (preferredId && availableRuns.find((r) => r.id === preferredId)) ||
        (selectedRunId && availableRuns.find((r) => r.id === selectedRunId)) ||
        availableRuns[0];

      if (targetRun) {
        setSelectedRunId(targetRun.id);
        loadRunDetails(targetRun.id);
      }
    } else if (!selectedRunDetails) {
      setSelectedRunId(null);
      if (!initialMetricsRef.current) {
        setCurrentMetrics(null);
        setCurrentTrades([]);
        setEquityCurve([]);
      }
    }
  }, [availableRuns, effectiveVersionNum, loadRunDetails, selectedRunId, selectedRunDetails, hideHeader]);

  // Fetch runs on mount or strategy change
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Handle run selection change — immediately clear stale data to prevent race
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    // Clear stale display state so old test data is never visible during load
    setCurrentMetrics(null);
    setCurrentTrades([]);
    setEquityCurve([]);
    loadRunDetails(runId);
  };

  // Re-run Backtest
  const handleRunBacktest = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const paramPayload: Record<string, any> = {};
      parameters.forEach((p) => {
        paramPayload[p.name] = p.defaultValue;
      });

      const isMql5 = language === 'mql5' || strategyName.endsWith('.mq5') || strategyName.endsWith('.ex5');
      const res = await fetch('/api/v1/backtests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: isMql5 ? `${cleanStrategyName}.ex5` : (cleanStrategyName || 'gold_fvg_trend_pullback'),
          strategy_name: cleanStrategyName,
          symbol: runConfig.symbol || (isMql5 ? 'XAUUSD' : 'XAUUSD'),
          timeframe: runConfig.timeframe || (isMql5 ? 'H1' : '15m'),
          start_date: isMql5 ? '2026-09-01' : '2024-01-01',
          end_date: isMql5 ? '2026-10-01' : '2025-12-31',
          config: {
            initial_capital: runConfig.initialCapital || 100000,
            slippage_points: 0.5,
            commission_pct: 0.0002,
            use_mt5: isMql5,
            engine: isMql5 ? 'mt5' : 'vectorized',
            leverage: 100.0,
            version_num: effectiveVersionNum,
          },
          parameters: {
            ...(Object.keys(paramPayload).length > 0 ? paramPayload : { ema_period: 50, atr_multiplier_sl: 1.5 }),
            version_num: effectiveVersionNum,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.id) {
        setSelectedRunId(data.id);
        await loadRunDetails(data.id);
        await fetchRuns();
      }
    } catch (err: any) {
      console.warn('[CentralSandboxRunnerPanel] Execution failed:', err);
      setRunError(err.message || 'Execution error during deterministic backtest.');
    } finally {
      setIsRunning(false);
    }
  };

  // Trade exit classification helper
  const isTradeTp = useCallback((t: SimulatedTrade) => {
    const reason = (t.exit_reason || '').toUpperCase();
    return (reason.includes('TP') || reason.includes('TARGET')) && t.pnl > 0;
  }, []);

  const isTradeBe = useCallback((t: SimulatedTrade) => {
    if (isTradeTp(t)) return false;
    const reason = (t.exit_reason || '').toUpperCase();
    return (
      reason.includes('BE') ||
      reason.includes('BREAKEVEN') ||
      reason.includes('TRAIL') ||
      Math.abs(t.pnl) <= 0.50 ||
      (t.pnl >= 0 && (reason.includes('SL') || reason.includes('STOP')))
    );
  }, [isTradeTp]);

  const isTradeSl = useCallback((t: SimulatedTrade) => {
    return !isTradeTp(t) && !isTradeBe(t);
  }, [isTradeTp, isTradeBe]);

  // Filtered & Paginated Trades
  const filteredTrades = useMemo(() => {
    return currentTrades.filter((t) => {
      if (tradeFilter === 'wins' && t.pnl <= 0) return false;
      if (tradeFilter === 'losses' && t.pnl >= 0) return false;
      if (tradeFilter === 'be' && !isTradeBe(t)) return false;
      if (tradeFilter === 'long' && t.side !== 'BUY') return false;
      if (tradeFilter === 'short' && t.side !== 'SELL') return false;

      if (tradeSearch.trim()) {
        const q = tradeSearch.toLowerCase();
        const matchesId = (t.trade_id || '').toLowerCase().includes(q);
        const matchesReason = (t.exit_reason || '').toLowerCase().includes(q);
        const matchesDate = (t.entry_time || '').includes(q) || (t.exit_time || '').includes(q);
        if (!matchesId && !matchesReason && !matchesDate) return false;
      }
      return true;
    });
  }, [currentTrades, tradeFilter, tradeSearch, isTradeBe]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / tradesPerPage));
  const paginatedTrades = useMemo(() => {
    const start = (tradePage - 1) * tradesPerPage;
    return filteredTrades.slice(start, start + tradesPerPage);
  }, [filteredTrades, tradePage]);

  // Derived Analytics with Break-Even (BE) awareness & empirical metric calculation
  const analyticsData = useMemo(() => {
    if (!currentTrades || currentTrades.length === 0) return null;

    const wins = currentTrades.filter((t) => t.pnl > 0);
    const losses = currentTrades.filter((t) => t.pnl < 0);
    const longs = currentTrades.filter((t) => t.side === 'BUY');
    const shorts = currentTrades.filter((t) => t.side === 'SELL');

    const longWins = longs.filter((t) => t.pnl > 0).length;
    const shortWins = shorts.filter((t) => t.pnl > 0).length;

    const longNetPnl = longs.reduce((acc, t) => acc + t.pnl, 0);
    const shortNetPnl = shorts.reduce((acc, t) => acc + t.pnl, 0);

    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const payoff = avgLoss > 0 ? avgWin / avgLoss : (wins.length > 0 ? 999 : 0);

    let tpCount = 0;
    let beCount = 0;
    let slCount = 0;

    currentTrades.forEach((t) => {
      if (isTradeTp(t)) {
        tpCount++;
      } else if (isTradeBe(t)) {
        beCount++;
      } else {
        slCount++;
      }
    });

    const total = currentTrades.length;
    const tpPct = total > 0 ? Math.round((tpCount / total) * 1000) / 10 : 0;
    const bePct = total > 0 ? Math.round((beCount / total) * 1000) / 10 : 0;
    const slPct = total > 0 ? Math.round((slCount / total) * 1000) / 10 : 0;

    const expectancy = total > 0 ? (grossProfit - grossLoss) / total : 0;

    return {
      winsCount: wins.length,
      lossesCount: losses.length,
      longsCount: longs.length,
      shortsCount: shorts.length,
      longWinRate: longs.length > 0 ? Math.round((longWins / longs.length) * 1000) / 10 : 0,
      shortWinRate: shorts.length > 0 ? Math.round((shortWins / shorts.length) * 1000) / 10 : 0,
      longNetPnl: Math.round(longNetPnl * 100) / 100,
      shortNetPnl: Math.round(shortNetPnl * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      payoff: Math.round(payoff * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      tpCount,
      beCount,
      slCount,
      tpPct,
      bePct,
      slPct,
    };
  }, [currentTrades, isTradeTp, isTradeBe]);

  // Fallback to empirical calculations if the MT5 summary report left certain metrics at 0
  const effectiveMetrics = useMemo(() => {
    if (!currentMetrics) return null;
    const res = { ...currentMetrics };
    if (analyticsData) {
      if (!res.winningTrades || res.winningTrades === 0) {
        res.winningTrades = analyticsData.winsCount;
      }
      if (!res.losingTrades || res.losingTrades === 0) {
        res.losingTrades = analyticsData.lossesCount;
      }
      if ((!res.averageWin || res.averageWin === 0) && analyticsData.avgWin > 0) {
        res.averageWin = analyticsData.avgWin;
      }
      if ((!res.averageLoss || res.averageLoss === 0) && analyticsData.avgLoss > 0) {
        res.averageLoss = analyticsData.avgLoss;
      }
      if ((!res.payoffRatio || res.payoffRatio === 0) && analyticsData.payoff > 0) {
        res.payoffRatio = analyticsData.payoff;
      }
      if ((!res.expectancy || res.expectancy === 0) && analyticsData.expectancy !== 0) {
        res.expectancy = analyticsData.expectancy;
      }
    }
    return res;
  }, [currentMetrics, analyticsData]);

  // Safely compute High-Water Mark without spreading arrays (prevents Maximum call stack size exceeded)
  const peakEquity = useMemo(() => {
    const initCap = currentMetrics?.initialCapital || 100000;
    if (!equityCurve || equityCurve.length === 0) return initCap;
    let max = initCap;
    for (let i = 0; i < equityCurve.length; i++) {
      const pt = equityCurve[i];
      const val = pt.balance || pt.equity || 0;
      if (val > max) max = val;
    }
    return max;
  }, [equityCurve, currentMetrics?.initialCapital]);

  // Derived loading gate: true when data is being fetched or when parent signals loading or details not yet synced with selectedRunId
  const isDataLoading =
    isLoadingDetails ||
    isLoading ||
    (hideHeader
      ? !selectedRunDetails || (Boolean(propRunId) && selectedRunDetails.id !== propRunId)
      : isLoadingRuns);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080B11] text-slate-100 overflow-hidden font-sans select-none relative">
      {/* LOADING GATE OVERLAY — blocks stale data display during test switch or initial load */}
      {isDataLoading && (
        <QuantLoader
          overlay
          size="md"
          label="Loading Test Data"
          sublabel="Synchronizing metrics, trades & equity curve…"
        />
      )}

      {/* 1. Gentle Single Unified Header Bar */}
      {!hideHeader && (
        <div className="h-11 border-b border-[#182334] bg-gradient-to-r from-[#0B0F18] via-[#0D1422] to-[#0B0F18] px-3.5 sm:px-4 flex items-center justify-between shrink-0 font-mono z-10 select-none shadow-sm">
          {/* Left: Test Run Selector styled cleanly like the table header */}
          <div className="flex items-center min-w-0 flex-1 mr-3">
            {availableRuns.length > 0 ? (
              <div className="relative flex items-center min-w-0 max-w-full">
                <select
                  value={selectedRunId || ''}
                  onChange={(e) => handleSelectRun(e.target.value)}
                  className="bg-[#0B0F16] border border-[#202A38] hover:border-[#2E3C50] focus:border-cyan-500/50 rounded-lg px-3 py-1.5 text-[10px] sm:text-[10.5px] text-slate-300 font-mono uppercase tracking-wider outline-none cursor-pointer transition-all max-w-[280px] sm:max-w-[420px] md:max-w-[560px] lg:max-w-[760px] truncate shadow-sm"
                  title={`Select a historical backtest run for ${versionPill}`}
                >
                  {availableRuns.map((r, idx) => (
                    <option key={r.id} value={r.id} className="bg-[#0B0F16] text-slate-300 font-mono text-[10px] sm:text-[10.5px] uppercase tracking-wider py-1.5">
                      {formatRunLabel(r, idx, availableRuns.length)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[10px] sm:text-[10.5px] text-slate-500 italic font-mono uppercase tracking-wider">No tests for {versionPill} yet</span>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (selectedRunId) loadRunDetails(selectedRunId);
                fetchRuns();
              }}
              disabled={isLoadingRuns || isLoadingDetails}
              className="group text-[10px] sm:text-[10.5px] px-3 py-1.5 rounded-lg bg-[#0B0F16] hover:bg-[#121824] text-slate-300 hover:text-cyan-300 border border-[#202A38] hover:border-[#2E3C50] flex items-center gap-1.5 font-mono uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh Latest Telemetry"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingRuns || isLoadingDetails ? 'animate-spin text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'}`} />
              <span className="font-semibold">Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {runError && (
        <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{runError}</span>
          </div>
          <button onClick={() => setRunError(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* 2. Gentle Performance Hero Cards */}
      <div className="p-1.5 sm:p-3 xl:p-4 bg-[#090D15] border-b border-[#182232] grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-1.5 sm:gap-2.5">
        {/* Net Profit */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Net Profit</span>
            {effectiveMetrics && effectiveMetrics.netProfit >= 0 ? (
              <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0" />
            )}
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div
              className={`text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight truncate ${
                effectiveMetrics && effectiveMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {effectiveMetrics
                ? effectiveMetrics.netProfit >= 0
                  ? `+$${effectiveMetrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `-$${Math.abs(effectiveMetrics.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '$0.00'}
            </div>
            <div className="text-[8.5px] sm:text-[10px] 2xl:text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <span className={`truncate font-medium ${effectiveMetrics && effectiveMetrics.netProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {effectiveMetrics && effectiveMetrics.netProfitPct >= 0 ? '+' : ''}
                {effectiveMetrics?.netProfitPct ?? 0}%
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono text-[8.5px] sm:text-[10px] truncate">
                ${(effectiveMetrics?.endingEquity || 100000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Win Rate</span>
            <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 shrink-0" />
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div className="text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight text-slate-100 truncate">
              {effectiveMetrics?.winRate ?? 0}%
            </div>
            {/* Visual ratio bar */}
            <div className="w-full h-1 sm:h-1.5 bg-[#17202F] rounded-full overflow-hidden mt-1 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${effectiveMetrics?.winRate ?? 0}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${100 - (effectiveMetrics?.winRate ?? 0)}%` }}
              />
            </div>
            <div className="text-[8.5px] sm:text-[10px] text-slate-400 flex items-center justify-between mt-0.5 font-mono truncate">
              <span className="text-emerald-400">{effectiveMetrics?.winningTrades ?? 0} W</span>
              <span className="text-rose-400">{effectiveMetrics?.losingTrades ?? 0} L</span>
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Profit Factor</span>
            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div
              className={`text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight truncate ${
                (effectiveMetrics?.profitFactor ?? 0) >= 1.5
                  ? 'text-emerald-400'
                  : (effectiveMetrics?.profitFactor ?? 0) >= 1.0
                  ? 'text-cyan-400'
                  : 'text-amber-400'
              }`}
            >
              {effectiveMetrics?.profitFactor ?? 0}
            </div>
            <div className="text-[8.5px] sm:text-[10px] 2xl:text-[11px] text-slate-400 mt-0.5 truncate">
              {(effectiveMetrics?.profitFactor ?? 0) >= 1.5 ? (
                <span className="text-emerald-400 font-medium">Strong Alpha</span>
              ) : (effectiveMetrics?.profitFactor ?? 0) >= 1.0 ? (
                <span className="text-cyan-400">Near Breakeven</span>
              ) : (
                <span className="text-amber-400">Sub-Optimal</span>
              )}
            </div>
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Max Drawdown</span>
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0" />
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div className="text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight text-rose-400 truncate">
              -{effectiveMetrics?.maxDrawdownPct ?? 0}%
            </div>
            <div className="text-[8.5px] sm:text-[10px] 2xl:text-[11px] text-slate-400 mt-0.5 font-mono truncate">
              {effectiveMetrics?.maxDrawdown
                ? `-$${Math.round(effectiveMetrics.maxDrawdown).toLocaleString('en-US')}`
                : 'Controlled Risk'}
            </div>
          </div>
        </div>

        {/* Expectancy */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Expectancy</span>
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 shrink-0" />
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div
              className={`text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight truncate ${
                (effectiveMetrics?.expectancy ?? 0) >= 0 ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              {(effectiveMetrics?.expectancy ?? 0) >= 0 ? '+' : ''}$
              {Number(effectiveMetrics?.expectancy ?? 0).toFixed(2)}
              <span className="text-[8.5px] sm:text-[10px] text-slate-500 font-normal font-sans"> /fill</span>
            </div>
            <div className="text-[8.5px] sm:text-[10px] 2xl:text-[11px] text-slate-400 mt-0.5 truncate">
              Payoff:{' '}
              {effectiveMetrics?.payoffRatio && effectiveMetrics.payoffRatio > 0
                ? `${Number(effectiveMetrics.payoffRatio).toFixed(2)}:1`
                : effectiveMetrics?.winningTrades && !effectiveMetrics?.losingTrades
                ? '∞'
                : '0.00:1'}
            </div>
          </div>
        </div>

        {/* Executed Fills */}
        <div className="p-1.5 sm:p-2.5 2xl:p-3 rounded-lg sm:rounded-xl bg-[#0E1420] border border-[#1A2638] flex flex-col justify-between min-w-0 overflow-hidden">
          <span className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span className="truncate">Executed Fills</span>
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-400 shrink-0" />
          </span>
          <div className="mt-0.5 sm:mt-1.5 min-w-0">
            <div className="text-xs sm:text-sm 2xl:text-base font-bold font-mono tracking-tight text-slate-100 flex items-center justify-between gap-1 truncate">
              <span className="truncate">{effectiveMetrics?.totalTrades ?? currentTrades.length}</span>
              <span className="text-[8.5px] sm:text-[10px] 2xl:text-xs text-slate-500 font-normal shrink-0">
                {effectiveMetrics?.executionTimeMs !== undefined && effectiveMetrics.executionTimeMs > 0
                  ? effectiveMetrics.executionTimeMs >= 1000
                    ? `${(effectiveMetrics.executionTimeMs / 1000).toFixed(1)}s`
                    : `${effectiveMetrics.executionTimeMs}ms`
                  : '<10ms'}
              </span>
            </div>
            <div className="text-[8.5px] sm:text-[10px] 2xl:text-[11px] text-cyan-400 font-medium mt-0.5 flex items-center gap-1 font-mono truncate">
              <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{selectedRunId?.startsWith('mt5_') ? 'MT5 Real Fills' : 'Verified Fills'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Gentle Sub-Navigation Tabs */}
      <div className="h-11 px-3 sm:px-5 border-b border-[#182232] bg-[#0A0F17] flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'chart'
                ? 'bg-[#151F30] text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121926]'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden 2xl:inline">Equity & Drawdown</span>
            <span className="2xl:hidden">Equity</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-[#151F30] text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121926]'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden 2xl:inline">Edge Diagnostics & Analytics</span>
            <span className="hidden md:inline 2xl:hidden">Edge Analytics</span>
            <span className="md:hidden">Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('trades')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'trades'
                ? 'bg-[#151F30] text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121926]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="hidden 2xl:inline">Executed Trades</span>
            <span className="2xl:hidden">Trades</span>
            <span className="font-mono text-[10px] text-slate-400 shrink-0">({currentTrades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'config'
                ? 'bg-[#151F30] text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121926]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden 2xl:inline">Configuration Snapshot</span>
            <span className="2xl:hidden">Config</span>
          </button>
        </div>

        {/* Symbol & Invariant details */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <span className="px-2.5 py-0.5 rounded-md bg-[#121A26] border border-[#1E2B3E] font-mono text-[11px] text-slate-300">
            {runConfig.symbol} · {runConfig.timeframe.toUpperCase()}
          </span>
          {runConfig.startDate && runConfig.endDate && (
            <span className="hidden 2xl:inline px-2.5 py-0.5 rounded-md bg-[#121A26] border border-[#1E2B3E] font-mono text-[11px] text-cyan-300">
              {runConfig.startDate} → {runConfig.endDate}
            </span>
          )}
          <span className="text-cyan-400 font-medium text-[11px] flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40 font-mono">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>{selectedRunId?.startsWith('mt5_') ? 'MT5' : 'Backtest'}</span>
          </span>
        </div>
      </div>

      {/* 4. Main Body Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {/* TAB 1: Equity & Drawdown Curves - Executive Results Resume */}
        {activeTab === 'chart' && (
          <div className="space-y-4">
            {/* Chart Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Portfolio Capital & Drawdown Trajectory</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-resolution fill history · Date-anchored mark-to-market trajectory
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[#0E1522] p-1 rounded-lg border border-[#1E2B3E] self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setChartViewMode('equity')}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                    chartViewMode === 'equity'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Equity Curve
                </button>
                <button
                  onClick={() => setChartViewMode('underwater')}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                    chartViewMode === 'underwater'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Underwater (DD %)
                </button>
              </div>
            </div>

            {/* Interactive Vector Equity Chart Canvas */}
            <div className="w-full h-[280px] sm:h-[320px] md:h-[340px] bg-[#0A0E17] border border-[#1A2538] rounded-xl p-1.5 sm:p-2 relative overflow-hidden shadow-lg flex flex-col">
              <EquityDrawdownSvgChart
                data={equityCurve}
                viewMode={chartViewMode}
                initialCapital={effectiveMetrics?.initialCapital || 100000}
              />
            </div>

            {/* Performance Summary Footnote Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538] min-w-0 overflow-hidden">
                <span className="text-[11px] text-slate-400 font-medium block truncate">High-Water Mark (Peak Equity)</span>
                <span className="text-base font-bold text-slate-100 mt-1 block font-mono truncate">
                  ${peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block truncate">Peak portfolio balance achieved</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538] min-w-0 overflow-hidden">
                <span className="text-[11px] text-slate-400 font-medium block truncate">Deepest Drawdown Trough</span>
                <span className="text-base font-bold text-rose-400 mt-1 block font-mono truncate">
                  -{effectiveMetrics?.maxDrawdownPct ?? 0}%
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-mono truncate">
                  {effectiveMetrics?.maxDrawdown
                    ? `-$${Math.round(effectiveMetrics.maxDrawdown).toLocaleString('en-US')}`
                    : 'Maximum drawdown from portfolio high'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538] min-w-0 overflow-hidden">
                <span className="text-[11px] text-slate-400 font-medium block truncate">Gross Edge & Payoff Quality</span>
                <div className="text-base font-bold text-emerald-400 mt-1 block font-mono truncate">
                  PF {effectiveMetrics?.profitFactor ?? 0}
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    (Payoff: {effectiveMetrics?.payoffRatio && effectiveMetrics.payoffRatio > 0 ? `${Number(effectiveMetrics.payoffRatio).toFixed(2)}:1` : '0.00:1'})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block font-mono truncate">
                  +${analyticsData?.grossProfit ?? 0} gross win · -${analyticsData?.grossLoss ?? 0} gross loss
                </span>
              </div>
            </div>

            {/* Executive Results Resume Grid */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 pt-1">
              {/* Exit Mechanics & Break-Even Split */}
              <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Exit Execution Split (TP · BE · SL)</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-medium">
                    {effectiveMetrics?.winRate ?? 0}% Effective Win Rate
                  </span>
                </div>

                {analyticsData ? (
                  <div className="space-y-2.5 text-xs">
                    {/* Visual 3-part segmented bar */}
                    <div className="w-full h-2 bg-[#17202F] rounded-full overflow-hidden flex shadow-inner">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${analyticsData.tpPct}%` }}
                        title={`Take Profit: ${analyticsData.tpCount} (${analyticsData.tpPct}%)`}
                      />
                      <div
                        className="bg-cyan-500 h-full transition-all duration-300"
                        style={{ width: `${analyticsData.bePct}%` }}
                        title={`Break-Even / Trailing Stop: ${analyticsData.beCount} (${analyticsData.bePct}%)`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${analyticsData.slPct}%` }}
                        title={`Stop Loss: ${analyticsData.slCount} (${analyticsData.slPct}%)`}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-400 font-medium block text-[10px]">Take Profit (TP)</span>
                        <span className="text-slate-100 font-bold text-xs mt-0.5 block">
                          {analyticsData.tpCount} <span className="text-emerald-400 font-normal">({analyticsData.tpPct}%)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block">Target reached</span>
                      </div>

                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-cyan-400 font-medium block text-[10px]">Break-Even (BE)</span>
                        <span className="text-slate-100 font-bold text-xs mt-0.5 block">
                          {analyticsData.beCount} <span className="text-cyan-400 font-normal">({analyticsData.bePct}%)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block">Trailing / Protected</span>
                      </div>

                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <span className="text-rose-400 font-medium block text-[10px]">Stop Loss (SL)</span>
                        <span className="text-slate-100 font-bold text-xs mt-0.5 block">
                          {analyticsData.slCount} <span className="text-rose-400 font-normal">({analyticsData.slPct}%)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block">Capital cut</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal pt-1">
                      {analyticsData.beCount > 0 ? (
                        <>
                          <strong className="text-slate-200">{analyticsData.beCount} trades</strong> exited via trailing stop or moved break-even stop, protecting capital without taking full stop-loss hits.
                        </>
                      ) : (
                        'All trades closed directly at explicit take-profit targets or stop-loss limits.'
                      )}
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs italic">Awaiting fill data...</span>
                )}
              </div>

              {/* Directional Performance & Expectancy Summary */}
              <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Directional Edge & Expectancy</span>
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-medium">
                    +${Number(effectiveMetrics?.expectancy ?? 0).toFixed(2)} /fill
                  </span>
                </div>

                {analyticsData ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="p-2.5 rounded-lg bg-[#0F1624] border border-[#1E2B3E]">
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span>Longs ({analyticsData.longsCount})</span>
                          <span className="text-emerald-400 font-bold">{analyticsData.longWinRate}% WR</span>
                        </div>
                        <div className={`text-sm font-bold mt-1 ${analyticsData.longNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {analyticsData.longNetPnl >= 0 ? `+$${analyticsData.longNetPnl}` : `-$${Math.abs(analyticsData.longNetPnl)}`}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0F1624] border border-[#1E2B3E]">
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span>Shorts ({analyticsData.shortsCount})</span>
                          <span className="text-cyan-400 font-bold">{analyticsData.shortWinRate}% WR</span>
                        </div>
                        <div className={`text-sm font-bold mt-1 ${analyticsData.shortNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {analyticsData.shortNetPnl >= 0 ? `+$${analyticsData.shortNetPnl}` : `-$${Math.abs(analyticsData.shortNetPnl)}`}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Average Win vs Loss:</span>
                        <span className="font-mono text-slate-200">
                          <span className="text-emerald-400 font-semibold">+${Number(effectiveMetrics?.averageWin ?? 0).toFixed(2)}</span>
                          {' · '}
                          <span className="text-rose-400 font-semibold">-${Math.abs(Number(effectiveMetrics?.averageLoss ?? 0)).toFixed(2)}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total Executed Fills:</span>
                        <span className="font-mono text-slate-200 font-semibold">
                          {effectiveMetrics?.totalTrades ?? currentTrades.length} trades ({effectiveMetrics?.winningTrades ?? 0} wins · {effectiveMetrics?.losingTrades ?? 0} losses)
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs italic">Awaiting fill data...</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Performance Analytics & Edge Diagnostics */}
        {activeTab === 'analytics' && effectiveMetrics && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Strategy Edge Diagnostics & Invariant Telemetry</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed breakdowns of directional alpha, streaks, and fill distribution
              </p>
            </div>

            {/* Grid of Analytics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
              {/* Payoff & Risk Reward */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2.5 min-w-0 overflow-hidden">
                <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">
                  Risk / Reward & Payoff
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400 truncate">Average Win:</span>
                    <span className="text-emerald-400 font-bold font-mono shrink-0">
                      +${Number(effectiveMetrics.averageWin ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400 truncate">Average Loss:</span>
                    <span className="text-rose-400 font-bold font-mono shrink-0">
                      -${Math.abs(Number(effectiveMetrics.averageLoss ?? 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#1A2538] gap-1">
                    <span className="text-slate-300 font-medium truncate">Payoff Ratio:</span>
                    <span className="text-cyan-300 font-bold font-mono shrink-0">
                      {effectiveMetrics.payoffRatio && effectiveMetrics.payoffRatio > 0
                        ? `${Number(effectiveMetrics.payoffRatio).toFixed(2)} : 1`
                        : '0.00 : 1'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Long vs Short Directional Breakdown */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2.5 min-w-0 overflow-hidden">
                <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">
                  Directional Performance
                </span>
                {analyticsData ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-400 truncate">Longs ({analyticsData.longsCount}):</span>
                      <span className="text-slate-200 font-mono shrink-0">
                        {analyticsData.longWinRate}% WR (
                        <span className={analyticsData.longNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ${analyticsData.longNetPnl}
                        </span>
                        )
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-400 truncate">Shorts ({analyticsData.shortsCount}):</span>
                      <span className="text-slate-200 font-mono shrink-0">
                        {analyticsData.shortWinRate}% WR (
                        <span className={analyticsData.shortNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          ${analyticsData.shortNetPnl}
                        </span>
                        )
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#17202F] rounded-full overflow-hidden mt-1 flex">
                      <div
                        className="bg-cyan-500 h-full"
                        style={{
                          width: `${(analyticsData.longsCount / (currentTrades.length || 1)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-violet-500 h-full"
                        style={{
                          width: `${(analyticsData.shortsCount / (currentTrades.length || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs italic">Awaiting fill data...</span>
                )}
              </div>

              {/* Exit Reasons Distribution */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2.5 min-w-0 overflow-hidden">
                <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">
                  Exit Split (TP · BE · SL)
                </span>
                {analyticsData ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-emerald-400 font-medium truncate">Take Profit (TP):</span>
                      <span className="font-mono text-slate-200 shrink-0">
                        {analyticsData.tpCount} ({analyticsData.tpPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-cyan-400 font-medium truncate">Break-Even (BE):</span>
                      <span className="font-mono text-slate-200 shrink-0">
                        {analyticsData.beCount} ({analyticsData.bePct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-rose-400 font-medium truncate">Stop Loss (SL):</span>
                      <span className="font-mono text-slate-200 shrink-0">
                        {analyticsData.slCount} ({analyticsData.slPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#17202F] rounded-full overflow-hidden mt-1 flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${analyticsData.tpPct}%` }} />
                      <div className="bg-cyan-500 h-full" style={{ width: `${analyticsData.bePct}%` }} />
                      <div className="bg-rose-500 h-full" style={{ width: `${analyticsData.slPct}%` }} />
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs italic">Awaiting fill data...</span>
                )}
              </div>

              {/* Streaks & Exposure */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2.5 min-w-0 overflow-hidden">
                <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider truncate">
                  Streaks & Exposure
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400 truncate">Max Consecutive Wins:</span>
                    <span className="text-emerald-400 font-bold font-mono shrink-0">
                      {effectiveMetrics.maxConsecutiveWins ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400 truncate">Max Consecutive Losses:</span>
                    <span className="text-rose-400 font-bold font-mono shrink-0">
                      {effectiveMetrics.maxConsecutiveLosses ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#1A2538] gap-1">
                    <span className="text-slate-400 truncate">Market Exposure:</span>
                    <span className="text-slate-200 font-mono shrink-0">
                      {Number(effectiveMetrics.exposurePct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Telemetry Summary Card */}
            <div className="p-4 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Strategy Performance Synthesis</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                The strategy completed <strong>{effectiveMetrics.totalTrades ?? currentTrades.length}</strong> executed fills on{' '}
                <strong>{runConfig.symbol}</strong> ({runConfig.timeframe.toUpperCase()}). With a win rate of{' '}
                <strong>{effectiveMetrics.winRate}%</strong> (including break-even and trailing stops) and risk/reward payoff of{' '}
                <strong>
                  {effectiveMetrics.payoffRatio && effectiveMetrics.payoffRatio > 0
                    ? `${Number(effectiveMetrics.payoffRatio).toFixed(2)}:1`
                    : '0.00:1'}
                </strong>, the net expectancy is{' '}
                <strong className={(effectiveMetrics.expectancy ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {(effectiveMetrics.expectancy ?? 0) >= 0 ? '+' : ''}${Number(effectiveMetrics.expectancy ?? 0).toFixed(2)}
                </strong>{' '}
                per fill.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Executed Trades Ledger */}
        {activeTab === 'trades' && (
          <div className="space-y-3">
            {/* Filter & Search Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-[#0C121D] p-1 rounded-xl border border-[#1A2538] overflow-x-auto">
                <button
                  onClick={() => {
                    setTradeFilter('all');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({currentTrades.length})
                </button>
                <button
                  onClick={() => {
                    setTradeFilter('wins');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'wins'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Wins ({analyticsData?.winsCount ?? currentTrades.filter((t) => t.pnl > 0).length})
                </button>
                <button
                  onClick={() => {
                    setTradeFilter('be');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'be'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Break-Even ({analyticsData?.beCount ?? 0})
                </button>
                <button
                  onClick={() => {
                    setTradeFilter('losses');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'losses'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Losses ({analyticsData?.lossesCount ?? currentTrades.filter((t) => t.pnl < 0).length})
                </button>
                <button
                  onClick={() => {
                    setTradeFilter('long');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'long'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Longs ({currentTrades.filter((t) => t.side === 'BUY').length})
                </button>
                <button
                  onClick={() => {
                    setTradeFilter('short');
                    setTradePage(1);
                  }}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    tradeFilter === 'short'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Shorts ({currentTrades.filter((t) => t.side === 'SELL').length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search trade ID, date, reason..."
                  value={tradeSearch}
                  onChange={(e) => {
                    setTradeSearch(e.target.value);
                    setTradePage(1);
                  }}
                  className="bg-[#0C121D] border border-[#1A2538] focus:border-cyan-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none w-full sm:w-64 font-mono transition-colors"
                />
              </div>
            </div>

            {/* Trades Table */}
            {filteredTrades.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs italic bg-[#0A0E16] rounded-xl border border-[#1A2538]">
                No trades match the current filter or search criteria.
              </div>
            ) : (
              <div className="border border-[#1A2538] rounded-xl overflow-hidden bg-[#0A0E16]">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0E1522] text-slate-400 border-b border-[#1A2538] text-[11px] uppercase font-semibold tracking-wider">
                      <tr>
                        <th className="px-3.5 py-3">#</th>
                        <th className="px-3.5 py-3">ID</th>
                        <th className="px-3.5 py-3">Side</th>
                        <th className="px-3.5 py-3">Entry Time</th>
                        <th className="px-3.5 py-3">Exit Time</th>
                        <th className="px-3.5 py-3">Entry ($)</th>
                        <th className="px-3.5 py-3">Exit ($)</th>
                        <th className="px-3.5 py-3">Size</th>
                        <th className="px-3.5 py-3">Net PnL ($)</th>
                        <th className="px-3.5 py-3">Return (%)</th>
                        <th className="px-3.5 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#17202F]">
                      {paginatedTrades.map((t, idx) => {
                        const globalIdx = (tradePage - 1) * tradesPerPage + idx + 1;
                        const isProfit = t.pnl >= 0;
                        return (
                          <tr key={t.trade_id || idx} className="hover:bg-[#0F1624] transition-colors">
                            <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">{globalIdx}</td>
                            <td className="px-3.5 py-2.5 text-slate-300 font-mono text-[11px]">{t.trade_id || `TRD_${globalIdx}`}</td>
                            <td className="px-3.5 py-2.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  t.side === 'BUY'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {t.side === 'BUY' ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
                              {t.entry_time}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
                              {t.exit_time}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-200 font-mono text-[11px]">
                              {Number(t.entry_price).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-200 font-mono text-[11px]">
                              {Number(t.exit_price).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">
                              {t.quantity}
                            </td>
                            <td
                              className={`px-3.5 py-2.5 font-bold font-mono text-[11px] ${
                                isProfit ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isProfit ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`}
                            </td>
                            <td
                              className={`px-3.5 py-2.5 font-bold font-mono text-[11px] ${
                                isProfit ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isProfit ? `+${t.pnl_percent}%` : `${t.pnl_percent}%`}
                            </td>
                            <td className="px-3.5 py-2.5">
                              {(() => {
                                if (isTradeTp(t)) {
                                  return (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      {t.exit_reason || 'TP'}
                                    </span>
                                  );
                                } else if (isTradeBe(t)) {
                                  return (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                      BE / Trail ({t.exit_reason || 'BE'})
                                    </span>
                                  );
                                } else if (isTradeSl(t) || t.pnl < 0) {
                                  return (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      {t.exit_reason || 'SL'}
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-[#141C28] text-slate-400 border border-[#202A38]">
                                    {t.exit_reason || 'CLOSE'}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="h-11 px-4 bg-[#0B1018] border-t border-[#1A2538] flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Showing {(tradePage - 1) * tradesPerPage + 1} -{' '}
                    {Math.min(tradePage * tradesPerPage, filteredTrades.length)} of {filteredTrades.length} fills
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTradePage((p) => Math.max(1, p - 1))}
                      disabled={tradePage <= 1}
                      className="px-2.5 py-1 rounded bg-[#121926] border border-[#202A38] disabled:opacity-30 disabled:cursor-not-allowed hover:text-slate-200 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <span className="text-xs px-2 font-mono">
                      {tradePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setTradePage((p) => Math.min(totalPages, p + 1))}
                      disabled={tradePage >= totalPages}
                      className="px-2.5 py-1 rounded bg-[#121926] border border-[#202A38] disabled:opacity-30 disabled:cursor-not-allowed hover:text-slate-200 transition-colors"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Run Configuration Snapshot */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Strategy Parameters Frozen For This Simulation</h3>
              <p className="text-xs text-slate-400 mt-0.5">Read-only invariant telemetry snapshot</p>
            </div>

            {/* Run Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                <span className="text-[11px] text-slate-400 font-medium block">Target Asset</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block font-mono">{runConfig.symbol}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                <span className="text-[11px] text-slate-400 font-medium block">Resolution</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block font-mono">{runConfig.timeframe.toUpperCase()}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                <span className="text-[11px] text-slate-400 font-medium block">Simulation Range</span>
                <span className="text-xs font-bold text-cyan-300 mt-1 block font-mono">
                  {runConfig.startDate && runConfig.endDate ? `${runConfig.startDate} → ${runConfig.endDate}` : 'Historical'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                <span className="text-[11px] text-slate-400 font-medium block">Starting Capital</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block font-mono">
                  ${runConfig.initialCapital.toLocaleString('en-US')}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                <span className="text-[11px] text-slate-400 font-medium block">Engine Protocol</span>
                <span className="text-sm font-bold text-cyan-300 mt-1 block">
                  {selectedRunId?.startsWith('mt5_') ? 'MT5 Strategy Tester' : 'Deterministic Sandbox'}
                </span>
              </div>
            </div>

            {/* Hyperparameters Grid */}
            <div className="border border-[#1A2538] rounded-xl overflow-hidden bg-[#0A0E16]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0E1522] text-slate-400 border-b border-[#1A2538] text-[11px] uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Parameter Name</th>
                    <th className="px-4 py-3">Tested Value</th>
                    <th className="px-4 py-3">Description / Invariant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17202F]">
                  {parameters.length > 0 ? (
                    parameters.map((param) => (
                      <tr key={param.name} className="hover:bg-[#0F1624]">
                        <td className="px-4 py-2.5 font-bold text-slate-200 font-mono">{param.name}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-[#121926] border border-[#202A38] text-cyan-300 font-mono font-bold">
                            {String(runConfig.parameters[param.name] ?? param.defaultValue)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs italic">
                          {param.comment || `Hyperparameter invariant for ${param.name}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500 italic">
                        Standard deterministic engine hyperparameters were applied for this test.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gentle Interactive SVG Equity & Drawdown Chart Component
// ---------------------------------------------------------------------------
interface ChartProps {
  data: EquityPoint[];
  viewMode: 'equity' | 'underwater';
  initialCapital: number;
}

function EquityDrawdownSvgChart({ data, viewMode, initialCapital }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 800, height: 280 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Downsample to max 250 points for buttery-smooth rendering
  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length <= 250) return data;
    const step = Math.floor(data.length / 250);
    const result: EquityPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
      result.push(data[i]);
    }
    if (result[result.length - 1] !== data[data.length - 1]) {
      result.push(data[data.length - 1]);
    }
    return result;
  }, [data]);

  // Real-time ResizeObserver: instantly adapts as panels are dragged, resized, or expanded
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) {
        setDims({
          width: Math.round(w),
          height: Math.round(h > 40 ? h : 280),
        });
      }
    };

    measure();

    const ro = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0) {
            setDims({
              width: Math.round(width),
              height: Math.round(height > 40 ? height : 280),
            });
          }
        }
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = dims.width || 800;
  const height = dims.height || 280;

  // Ultra-tight paddings so chart fills 100% of top, bottom, and side space
  const padLeft = viewMode === 'underwater' ? 42 : 50;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 22;

  const chartW = Math.max(10, width - padLeft - padRight);
  const chartH = Math.max(10, height - padTop - padBottom);

  // Scales & Bounds: tightly anchored to data so curve utilizes the full vertical span
  const { minVal, maxVal, highWaterMark } = useMemo(() => {
    if (sampledData.length === 0) {
      return { minVal: initialCapital * 0.99, maxVal: initialCapital * 1.01, highWaterMark: initialCapital };
    }
    if (viewMode === 'underwater') {
      let maxDD = 0.1;
      for (let i = 0; i < sampledData.length; i++) {
        const dd = sampledData[i].drawdown_pct || 0;
        if (dd > maxDD) maxDD = dd;
      }
      return { minVal: -maxDD * 1.02, maxVal: 0, highWaterMark: 0 };
    } else {
      let rawMin = initialCapital;
      let rawMax = initialCapital;
      let isFirst = true;
      for (let i = 0; i < sampledData.length; i++) {
        const val = sampledData[i].balance || sampledData[i].equity || initialCapital;
        if (isFirst) {
          rawMin = val;
          rawMax = val;
          isFirst = false;
        } else {
          if (val < rawMin) rawMin = val;
          if (val > rawMax) rawMax = val;
        }
      }
      const span = Math.max(rawMax - rawMin, 1);
      // Tight 1.5% margin prevents stroke clipping while using virtually full vertical space
      const min = rawMin - span * 0.015;
      const max = rawMax + span * 0.015;
      return { minVal: min, maxVal: max, highWaterMark: rawMax };
    }
  }, [sampledData, viewMode, initialCapital]);

  const getY = useCallback(
    (val: number) => {
      if (maxVal === minVal) return padTop + chartH / 2;
      return padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
    },
    [maxVal, minVal, chartH, padTop]
  );

  const getX = useCallback(
    (idx: number) => {
      if (sampledData.length <= 1) return padLeft;
      return padLeft + (idx / (sampledData.length - 1)) * chartW;
    },
    [sampledData.length, chartW, padLeft]
  );

  // Compute evenly spaced date ticks across the dataset for X-axis (responsive to container width)
  const dateTicks = useMemo(() => {
    if (sampledData.length < 2) return [];
    const count = width < 450 ? 3 : width < 700 ? 4 : 5;
    const ticks: { index: number; x: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = [];
    for (let i = 0; i < count; i++) {
      const fraction = i / (count - 1);
      const idx = Math.min(sampledData.length - 1, Math.round(fraction * (sampledData.length - 1)));
      const pt = sampledData[idx];
      const x = getX(idx);
      let label = '';
      if (pt && pt.timestamp) {
        const raw = String(pt.timestamp).replace(/\./g, '-').replace('T', ' ').trim();
        const parts = raw.split(' ');
        label = parts[0] || raw;
      } else {
        label = `#${idx + 1}`;
      }
      const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
      ticks.push({ index: idx, x, label, anchor });
    }
    return ticks;
  }, [sampledData, getX, width]);

  // SVG Paths
  const { linePath, areaPath } = useMemo(() => {
    if (sampledData.length === 0) return { linePath: '', areaPath: '' };

    let lPath = '';
    sampledData.forEach((d, idx) => {
      const val = viewMode === 'underwater' ? -(d.drawdown_pct || 0) : d.balance || d.equity || initialCapital;
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) {
        lPath += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        lPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const baselineY = getY(viewMode === 'underwater' ? 0 : minVal);
    const firstX = getX(0);
    const lastX = getX(sampledData.length - 1);
    const aPath = `${lPath} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [sampledData, viewMode, initialCapital, getX, getY, minVal]);

  const hwmY = getY(viewMode === 'underwater' ? 0 : highWaterMark);
  const initCapY = getY(viewMode === 'underwater' ? 0 : initialCapital);

  // Mouse Hover Handler with exact pixel crosshair tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (sampledData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const svgX = (xRel / rect.width) * width;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIndex(null);
      return;
    }
    const ratio = (svgX - padLeft) / chartW;
    const idx = Math.round(ratio * (sampledData.length - 1));
    setHoverIndex(Math.max(0, Math.min(sampledData.length - 1, idx)));
  };

  // Touch Scrub Handler for Mobile Viewports
  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (sampledData.length === 0 || !e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = touch.clientX - rect.left;
    const svgX = (xRel / rect.width) * width;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIndex(null);
      return;
    }
    const ratio = (svgX - padLeft) / chartW;
    const idx = Math.round(ratio * (sampledData.length - 1));
    setHoverIndex(Math.max(0, Math.min(sampledData.length - 1, idx)));
  };

  const activePoint = hoverIndex !== null && hoverIndex < sampledData.length ? sampledData[hoverIndex] : null;
  const activeX = hoverIndex !== null ? getX(hoverIndex) : 0;
  const activeY =
    activePoint && hoverIndex !== null
      ? getY(viewMode === 'underwater' ? -(activePoint.drawdown_pct || 0) : activePoint.balance || activePoint.equity || initialCapital)
      : 0;

  // Authentic empty state returned ONLY after all hooks have executed unconditionally
  if (!data || data.length === 0 || sampledData.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[240px] flex flex-col items-center justify-center text-slate-500 text-xs bg-[#090D15] rounded-xl border border-[#162030]/60"
      >
        <Activity className="w-6 h-6 mb-2 text-slate-600 animate-pulse" />
        <span className="font-medium text-slate-400">No Equity Trajectory Recorded</span>
        <span className="text-[11px] text-slate-500 mt-1">
          Execute a simulation to generate equity curve and drawdown telemetry.
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[240px] select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block overflow-visible select-none cursor-crosshair touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="gentleEquityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="gentleDrawdownGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.30" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padTop + chartH * pct;
          const val = maxVal - pct * (maxVal - minVal);
          return (
            <g key={pct}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#16202E"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                {viewMode === 'underwater' ? `${val.toFixed(1)}%` : `$${Math.round(val).toLocaleString('en-US')}`}
              </text>
            </g>
          );
        })}

        {/* X-Axis Baseline */}
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={width - padRight}
          y2={padTop + chartH}
          stroke="#1E2B3E"
          strokeWidth="1.2"
        />

        {/* Vertical Grid Lines & Date Ticks on X-Axis */}
        {dateTicks.map((tick, i) => (
          <g key={`date-tick-${i}`}>
            <line
              x1={tick.x}
              y1={padTop}
              x2={tick.x}
              y2={padTop + chartH}
              stroke="#16202E"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={tick.x}
              y1={padTop + chartH}
              x2={tick.x}
              y2={padTop + chartH + 4}
              stroke="#334155"
              strokeWidth="1.2"
            />
            <text
              x={tick.x}
              y={padTop + chartH + 14}
              textAnchor={tick.anchor}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* High Water Mark Line (dashed gold) */}
        {viewMode !== 'underwater' && hwmY >= padTop && hwmY <= padTop + chartH && (
          <line
            x1={padLeft}
            y1={hwmY}
            x2={width - padRight}
            y2={hwmY}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.65"
          />
        )}

        {/* Baseline / Initial Capital Line (dashed slate) */}
        {viewMode !== 'underwater' && initCapY >= padTop && initCapY <= padTop + chartH && (
          <line
            x1={padLeft}
            y1={initCapY}
            x2={width - padRight}
            y2={initCapY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        )}

        {/* Area Gradient Fill */}
        <path
          d={areaPath}
          fill={viewMode === 'underwater' ? 'url(#gentleDrawdownGrad)' : 'url(#gentleEquityGrad)'}
        />

        {/* Main Curve Line */}
        <path
          d={linePath}
          fill="none"
          stroke={viewMode === 'underwater' ? '#f43f5e' : '#10b981'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair & Active Point on Hover */}
        {activePoint && hoverIndex !== null && (
          <g>
            <line
              x1={activeX}
              y1={padTop}
              x2={activeX}
              y2={padTop + chartH}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={activeX} cy={activeY} r="4.5" fill="#38bdf8" stroke="#080B11" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Floating Hover Tooltip Card */}
      {activePoint && hoverIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded-xl bg-[#0D1420]/95 border border-cyan-500/50 shadow-2xl text-xs font-mono text-slate-100 backdrop-blur-md transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${Math.max(90, Math.min(width - 90, activeX))}px`,
            top: `${Math.max(45, activeY)}px`,
          }}
        >
          <div className="text-[10px] text-slate-400 border-b border-[#1E2C3F] pb-1 mb-1.5 font-medium flex items-center justify-between gap-4 font-sans">
            <span>Point #{hoverIndex + 1}</span>
            <span className="text-cyan-400 font-mono">
              {activePoint.timestamp ? activePoint.timestamp.replace('T', ' ').slice(0, 16) : ''}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400 font-sans text-[11px]">Balance:</span>
              <span className="font-bold text-slate-100 font-mono">
                ${Number(activePoint.balance || activePoint.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400 font-sans text-[11px]">Drawdown:</span>
              <span className="font-bold text-rose-400 font-mono">
                -{Number(activePoint.drawdown_pct || 0).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
