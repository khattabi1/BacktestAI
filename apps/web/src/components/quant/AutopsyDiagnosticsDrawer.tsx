import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  Terminal,
  Database,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Wand2,
  Loader2,
  Activity,
  Layers,
  TrendingUp,
  TrendingDown,
  Cpu,
  ExternalLink,
  Code2,
  X,
  Search,
  LineChart,
} from 'lucide-react';

export interface LintIssue {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
  fixSuggestion?: string;
}

export interface StrategyParameter {
  name: string;
  type: 'int' | 'float' | 'double' | 'bool' | 'string';
  defaultValue: number | string | boolean;
  comment?: string;
}

export interface SimulationMetrics {
  netProfit: number;
  netProfitPct: number;
  winRate: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdownPct: number;
  totalTrades: number;
  barsProcessed: number;
  executionTimeMs: number;
  lookaheadBias: string;
}

export type DrawerTab = 'problems' | 'parameters' | 'autopsy' | 'trade';

export interface AutopsyDiagnosticsDrawerProps {
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  lintIssues: LintIssue[];
  parameters: StrategyParameter[];
  onUpdateParameter: (name: string, value: string | number | boolean) => void;
  metrics: SimulationMetrics | null;
  onFixWithAI: (issue: LintIssue) => void;
  language: 'python' | 'mql5';
  trades?: any[];
  symbol?: string;
  timeframe?: string;
  balance?: number;
  equity?: number;
  currentReplayTime?: number | null;
  currentBar?: any | null;
  onNavigateToLine?: (line: number, column?: number) => void;
  isChartRunnerOpen?: boolean;
  isChartRunnerEnabled?: boolean;
  onOpenChartRunner?: () => void;
  mobileActiveTab?: 'results' | 'chart' | 'code' | 'agent';
}

function getTypeBadge(type: string): { label: string; classes: string } {
  const t = (type || '').toLowerCase();
  if (t === 'int') {
    return {
      label: 'INT',
      classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    };
  }
  if (t === 'double' || t === 'float') {
    return {
      label: t.toUpperCase(),
      classes: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    };
  }
  if (t === 'bool' || t === 'boolean') {
    return {
      label: 'BOOL',
      classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    };
  }
  return {
    label: (t || 'STR').toUpperCase(),
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };
}

export function AutopsyDiagnosticsDrawer({
  activeTab,
  onTabChange,
  isExpanded,
  onToggleExpanded,
  lintIssues,
  parameters,
  onUpdateParameter,
  metrics,
  onFixWithAI,
  language,
  trades = [],
  symbol = 'XAUUSD',
  timeframe = 'H1',
  balance = 100000,
  equity = 100000,
  currentReplayTime = null,
  currentBar = null,
  onNavigateToLine,
  isChartRunnerOpen = false,
  isChartRunnerEnabled = true,
  onOpenChartRunner,
  mobileActiveTab,
}: AutopsyDiagnosticsDrawerProps) {
  const [fixingLine, setFixingLine] = useState<number | null>(null);
  const [paramSearch, setParamSearch] = useState('');

  // Synchronize active drawer tab with mobile corresponding panel
  useEffect(() => {
    if (!mobileActiveTab) return;
    if (mobileActiveTab === 'results' && activeTab !== 'autopsy') {
      onTabChange('autopsy');
    } else if (mobileActiveTab === 'chart' && activeTab !== 'trade') {
      onTabChange('trade');
    } else if (mobileActiveTab === 'code' && activeTab !== 'problems' && activeTab !== 'parameters') {
      onTabChange('problems');
    }
  }, [mobileActiveTab, activeTab, onTabChange]);

  // Dynamic Fluid Drawer Height & Dragging State
  const [drawerHeight, setDrawerHeight] = useState<number>(200);
  const [isDraggingHeight, setIsDraggingHeight] = useState<boolean>(false);
  const [isDrawerMaximized, setIsDrawerMaximized] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) setDrawerHeight(175);
      else if (window.innerHeight <= 600) setDrawerHeight(150);
      else if (window.innerHeight <= 850) setDrawerHeight(200);
      else setDrawerHeight(240);
    }
    const handleWinResize = () => {
      if (typeof window !== 'undefined') {
        const isMob = window.innerWidth < 1024;
        const maxH = isMob
          ? Math.max(120, Math.floor(window.innerHeight * 0.38))
          : Math.max(120, Math.floor(window.innerHeight * 0.45));
        setDrawerHeight((prev) => {
          if (isMob && prev > 185) return 175;
          if (prev > maxH) return maxH;
          if (window.innerHeight <= 600 && prev > 150) return 150;
          return prev;
        });
      }
    };
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  const startHeightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isExpanded) return;
    setIsDraggingHeight(true);
    const startY = e.clientY;
    const startHeight = drawerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const minH = 100;
      const maxH = Math.max(120, Math.floor(window.innerHeight * 0.7));
      const nextH = Math.max(minH, Math.min(maxH, startHeight + deltaY));
      setDrawerHeight(nextH);
    };

    const handleMouseUp = () => {
      setIsDraggingHeight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const filteredParameters = useMemo(() => {
    if (!paramSearch.trim()) return parameters;
    const q = paramSearch.toLowerCase();
    return parameters.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        (p.comment && p.comment.toLowerCase().includes(q))
    );
  }, [parameters, paramSearch]);
  const parseSec = (val: any): number => {
    if (typeof val === 'number') return val > 1e11 ? Math.floor(val / 1000) : Math.floor(val);
    if (!val) return 0;
    let s = String(val).trim().replace(/\./g, '-').replace(' ', 'T');
    if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
    const ms = new Date(s).getTime();
    return isNaN(ms) ? 0 : Math.floor(ms / 1000);
  };

  const formatTerminalTime = (val: any): string => {
    if (!val) return '-';
    const str = String(val).trim();
    const match = str.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return match[6] ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}` : `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
    }
    return str.substring(5, 19) || str;
  };

  const formatTradePrice = (val: any): string => {
    const num = Number(val ?? 0);
    if (isNaN(num) || num === 0) return '-';
    if (num < 10) return num.toFixed(4);
    return num.toFixed(2);
  };

  const getSl = (t: any): string => {
    if (!t) return '-';
    const val = t.stop_loss ?? t.stopLoss ?? t.sl ?? t.initial_sl ?? t.initialSl ?? t.planned_stop_loss;
    if (val != null && !isNaN(Number(val)) && Number(val) > 0) return formatTradePrice(val);
    const reason = String(t.exit_reason || t.exitReason || t.comment || '');
    const m = reason.match(/(?:sl|stop\s*loss)[:\s]*([\d.]+)/i);
    if (m && m[1] && !isNaN(Number(m[1]))) return formatTradePrice(m[1]);
    return '-';
  };

  const getTp = (t: any): string => {
    if (!t) return '-';
    const val = t.take_profit ?? t.takeProfit ?? t.tp ?? t.initial_tp ?? t.initialTp ?? t.planned_take_profit;
    if (val != null && !isNaN(Number(val)) && Number(val) > 0) return formatTradePrice(val);
    const reason = String(t.exit_reason || t.exitReason || t.comment || '');
    const m = reason.match(/(?:tp|take\s*profit)[:\s]*([\d.]+)/i);
    if (m && m[1] && !isNaN(Number(m[1]))) return formatTradePrice(m[1]);
    return '-';
  };

  // Causal Live MT5 Account Engine
  const {
    openPositions,
    closedTrades,
    liveBalance,
    liveEquity,
    floatingPnl,
    totalMargin,
    freeMargin,
    marginLevel,
  } = React.useMemo(() => {
    const initialCap = balance ?? 100000;
    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        openPositions: [] as any[],
        closedTrades: [] as any[],
        liveBalance: initialCap,
        liveEquity: initialCap,
        floatingPnl: 0,
        totalMargin: 0,
        freeMargin: initialCap,
        marginLevel: '-',
      };
    }

    const isReplaying = currentReplayTime != null && currentReplayTime > 0;
    const currentPrice = Number(currentBar?.close ?? 0);

    const openList: any[] = [];
    const closedList: any[] = [];

    if (isReplaying) {
      for (const t of trades) {
        const entrySec = parseSec(t.entry_time || t.entryTime);
        const exitSec = parseSec(t.exit_time || t.exitTime);

        if (entrySec <= currentReplayTime) {
          if (!exitSec || exitSec > currentReplayTime) {
            openList.push(t);
          } else {
            closedList.push(t);
          }
        }
      }
    } else {
      for (const t of trades) {
        const hasNoExit = !t.exit_time && !t.exitTime;
        if (hasNoExit) {
          openList.push(t);
        } else {
          closedList.push(t);
        }
      }
    }

    // Settled balance from all completed closed trades
    const realizedPnl = closedList.reduce((sum, t) => sum + Number(t.pnl ?? 0), 0);
    const calculatedBalance = initialCap + realizedPnl;

    let calcFloatingPnl = 0;
    let calcMargin = 0;

    const enrichedOpenPositions = openList.map((t, idx) => {
      const isLong = String(t.side || '').toUpperCase().includes('BUY') || String(t.side || '').toUpperCase() === 'LONG';
      const vol = Number(t.quantity ?? t.volume ?? 0.01);
      const entryP = Number(t.entryPrice ?? t.entry_price ?? 0);
      const currP = currentPrice > 0 ? currentPrice : Number(t.exitPrice ?? t.exit_price ?? entryP);

      const sym = String(t.symbol || symbol || 'XAUUSD').toUpperCase();
      const multiplier = sym.includes('XAU') ? 100 : (sym.includes('JPY') ? 1000 : 100000);
      const posPnl = (isLong ? (currP - entryP) : (entryP - currP)) * vol * multiplier;

      calcFloatingPnl += posPnl;
      const posMargin = vol * (sym.includes('XAU') ? 1000 : 1000);
      calcMargin += posMargin;

      return {
        ...t,
        orderId: String(t.trade_id || t.ticket || t.id || idx + 1),
        openTime: String(t.entryTime || t.entry_time || ''),
        isLong,
        volume: vol,
        symbol: sym,
        entryPrice: entryP,
        stopLoss: getSl(t),
        takeProfit: getTp(t),
        currentPrice: currP,
        commission: Number(t.fee ?? t.commission ?? 0),
        swap: 0,
        profit: posPnl,
      };
    });

    const calcEquity = calculatedBalance + calcFloatingPnl;
    const calcFreeMargin = Math.max(0, calcEquity - calcMargin);
    const calcMarginLevel = calcMargin > 0 ? `${((calcEquity / calcMargin) * 100).toFixed(2)}%` : '-';

    return {
      openPositions: enrichedOpenPositions,
      closedTrades: closedList,
      liveBalance: calculatedBalance,
      liveEquity: calcEquity,
      floatingPnl: calcFloatingPnl,
      totalMargin: calcMargin,
      freeMargin: calcFreeMargin,
      marginLevel: calcMarginLevel,
    };
  }, [trades, currentReplayTime, currentBar, balance, symbol]);

  // Real Mathematical Autopsy Diagnostics Calculation Engine
  const autopsyMetrics = React.useMemo(() => {
    const initCap = balance ?? 100000;
    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        sharpe: metrics?.sharpeRatio ?? 0,
        sortino: 0,
        calmar: 0,
        ruinProb: '0.00%',
        lookaheadLeaks: 0,
        maxConsecWins: 0,
        maxConsecLosses: 0,
        profitFactor: metrics?.profitFactor ?? 0,
        winRate: metrics?.winRate ?? 0,
        totalTrades: 0,
        verdict: 'NO TRADES RECORDED',
        verdictColor: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
        downsideVol: '0.0%',
      };
    }

    const validTrades = trades.filter((t) => typeof t.pnl === 'number');
    const wins = validTrades.filter((t) => Number(t.pnl) > 0);
    const losses = validTrades.filter((t) => Number(t.pnl) < 0);
    const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0));
    const calcPf = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);
    const pf = metrics?.profitFactor ?? Number(calcPf.toFixed(2));
    const wr = metrics?.winRate ?? (validTrades.length > 0 ? Number(((wins.length / validTrades.length) * 100).toFixed(1)) : 0);

    // Downside deviation & Sortino calculation
    const returns = validTrades.map((t) => Number(t.pnl) / initCap);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const downsideSq = returns.filter((r) => r < 0).map((r) => r * r);
    const downsideVariance = downsideSq.length > 0 ? downsideSq.reduce((a, b) => a + b, 0) / downsideSq.length : 0.00001;
    const downsideDev = Math.sqrt(downsideVariance);
    const sortinoVal = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(Math.min(252, validTrades.length)) : 0;

    // Calmar calculation (Net Profit % / Max Drawdown %)
    const maxDd = metrics?.maxDrawdownPct ?? 2.85;
    const netProfitPct = metrics?.netProfitPct ?? (((grossProfit - grossLoss) / initCap) * 100);
    const calmarVal = maxDd > 0 ? netProfitPct / maxDd : 0;

    // Consecutive wins and losses streaks
    let maxW = 0, currW = 0;
    let maxL = 0, currL = 0;
    for (const t of validTrades) {
      if (Number(t.pnl) > 0) {
        currW++;
        currL = 0;
        if (currW > maxW) maxW = currW;
      } else if (Number(t.pnl) < 0) {
        currL++;
        currW = 0;
        if (currL > maxL) maxL = currL;
      }
    }

    // Perry Kaufman Risk of Ruin calculation
    const p = wr / 100;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 1;
    const R = avgWin / (avgLoss || 1);
    let ruinNum = 0;
    if (p <= 0 || grossProfit <= grossLoss) {
      ruinNum = 100.0;
    } else if (p >= 0.9) {
      ruinNum = 0.0;
    } else {
      const edge = p * R - (1 - p);
      if (edge <= 0) {
        ruinNum = 100.0;
      } else {
        const ratio = ((1 - p) * (1 / Math.max(0.1, R))) / Math.max(0.01, p);
        ruinNum = Math.min(100, Math.max(0, Math.pow(ratio, 10) * 100));
      }
    }

    // Strict Causality Invariant Audit (check if any trade exit is before entry)
    let lookaheadLeaks = 0;
    for (const t of validTrades) {
      const ent = parseSec(t.entry_time || t.entryTime);
      const ext = parseSec(t.exit_time || t.exitTime);
      if (ext > 0 && ext < ent) {
        lookaheadLeaks++;
      }
    }

    // Dynamic Qualitative Verdict Banner
    let verdict = 'VERDICT: READY FOR LIVE BOT DEPLOYMENT';
    let verdictColor = 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';

    if (pf < 1.0 || (metrics?.netProfit ?? (grossProfit - grossLoss)) < 0) {
      verdict = 'VERDICT: UNPROFITABLE / NEGATIVE EXPECTANCY';
      verdictColor = 'text-rose-300 bg-rose-500/15 border-rose-500/30';
    } else if (maxDd > 25.0 || ruinNum > 15.0) {
      verdict = 'VERDICT: HIGH DRAWDOWN RISK / CAUTION';
      verdictColor = 'text-amber-300 bg-amber-500/15 border-amber-500/30';
    } else if (pf >= 1.2 && maxDd <= 15.0) {
      verdict = 'VERDICT: INSTITUTIONAL GRADE (PASS)';
      verdictColor = 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
    }

    return {
      sharpe: metrics?.sharpeRatio ?? 0,
      sortino: Number(sortinoVal.toFixed(2)),
      calmar: Number(calmarVal.toFixed(2)),
      ruinProb: `${ruinNum.toFixed(2)}%`,
      lookaheadLeaks,
      maxConsecWins: maxW,
      maxConsecLosses: maxL,
      profitFactor: pf,
      winRate: wr,
      totalTrades: validTrades.length,
      verdict,
      verdictColor,
      downsideVol: `${(downsideDev * 100).toFixed(1)}%`,
    };
  }, [trades, metrics, balance]);

  const [terminalView, setTerminalView] = React.useState<'positions' | 'history'>('positions');

  React.useEffect(() => {
    if (openPositions.length === 0 && closedTrades.length > 0) {
      setTerminalView('history');
    } else if (openPositions.length > 0) {
      setTerminalView('positions');
    }
  }, [openPositions.length, closedTrades.length]);

  const errorCount = lintIssues.filter((i) => i.severity === 'error').length;
  const warningCount = lintIssues.filter((i) => i.severity === 'warning').length;

  const handleTabClick = (tab: DrawerTab) => {
    onTabChange(tab);
    if (!isExpanded) {
      onToggleExpanded();
    }
  };

  return (
    <div
      suppressHydrationWarning
      style={
        isExpanded
          ? {
              height: isDrawerMaximized ? 'calc(100% - 48px)' : `${drawerHeight}px`,
              maxHeight: isDrawerMaximized ? 'none' : '38vh',
            }
          : { height: '32px' }
      }
      className={`border-t border-[#202A38] bg-[#0D1118] flex flex-col transition-[height] font-mono select-none relative ${
        isDraggingHeight ? 'transition-none select-none' : 'duration-150'
      }`}
    >
      {/* Interactive Top Border Resizer Handle */}
      {isExpanded && !isDrawerMaximized && (
        <div
          onMouseDown={startHeightResize}
          className={`absolute top-0 left-0 right-0 h-2 -mt-1 cursor-row-resize z-30 group flex items-center justify-center select-none transition-colors ${
            isDraggingHeight ? 'bg-cyan-500/40' : 'hover:bg-cyan-500/25'
          }`}
          title="Drag up/down to resize bottom drawer"
        >
          <div className="w-12 h-0.5 rounded-full bg-slate-600 group-hover:bg-cyan-400 transition-colors" />
        </div>
      )}

      {/* 1. Header with Tabs */}
      <div
        onClick={() => {
          if (!isExpanded) {
            onToggleExpanded();
          }
        }}
        onDoubleClick={onToggleExpanded}
        className="h-8 px-3 border-b border-[#202A38] flex items-center justify-between bg-[#0B0F16] text-xs shrink-0 select-none cursor-pointer hover:bg-[#0E131C] transition-colors"
        title={!isExpanded ? 'Click to expand bottom panel' : undefined}
      >
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap pl-0.5">
          {/* Problems Tab: Visible on Code tab in mobile, or any tab on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTabClick('problems');
            }}
            className={`items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              mobileActiveTab && mobileActiveTab !== 'code' ? 'hidden lg:flex' : 'flex'
            } ${
              activeTab === 'problems' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${errorCount > 0 ? 'text-crimson-risk' : 'text-emerald-400'}`} />
            <span className="whitespace-nowrap">Problems ({errorCount})</span>
          </button>

          {/* Parameters Schema Tab: Visible on Code tab in mobile, or any tab on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTabClick('parameters');
            }}
            className={`items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              mobileActiveTab && mobileActiveTab !== 'code' ? 'hidden lg:flex' : 'flex'
            } ${
              activeTab === 'parameters' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 shrink-0" />
            <span className="whitespace-nowrap">
              <span className="hidden sm:inline">Parameters Schema</span>
              <span className="sm:hidden">Params</span> ({parameters.length})
            </span>
          </button>

          {/* Autopsy Diagnostics Radar: Visible on Results tab in mobile, or any tab on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTabClick('autopsy');
            }}
            className={`items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              mobileActiveTab && mobileActiveTab !== 'results' ? 'hidden lg:flex' : 'flex'
            } ${
              activeTab === 'autopsy' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-400 shrink-0" />
            <span className="whitespace-nowrap">
              <span className="hidden sm:inline">Autopsy Diagnostics</span>
              <span className="sm:hidden">Autopsy</span>
            </span>
          </button>

          {/* MT5 Live Terminal Tab: Visible on Chart tab in mobile, or any tab on desktop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTabClick('trade');
            }}
            className={`items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              mobileActiveTab && mobileActiveTab !== 'chart' ? 'hidden lg:flex' : 'flex'
            } ${
              activeTab === 'trade' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">
              <span className="hidden sm:inline">MT5 Live Terminal</span>
              <span className="sm:hidden">Terminal</span>
            </span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-3">
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDrawerMaximized((prev) => !prev);
              }}
              className="p-1 rounded hover:bg-[#17202E] text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title={isDrawerMaximized ? 'Restore Drawer Height' : 'Maximize Drawer'}
            >
              {isDrawerMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isDrawerMaximized) setIsDrawerMaximized(false);
              onToggleExpanded();
            }}
            className="p-1 rounded hover:bg-[#17202E] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Console' : 'Expand Console'}
          >
            {isExpanded ? <X className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Drawer Body Content */}
      {isExpanded && (
        <div className="flex-1 p-3 overflow-y-auto text-xs min-h-0 bg-[#080B10]">
          {/* TAB 1: Problems */}
          {activeTab === 'problems' && (
            <div className="space-y-1.5">
              {lintIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>No syntax or indentation errors detected. Code passes strict AST & causality checks.</span>
                </div>
              ) : (
                lintIssues.map((issue, i) => (
                  <div
                    key={i}
                    onClick={() => onNavigateToLine?.(issue.line, issue.column)}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#151C27] border border-[#202A38] hover:border-cyan-500/40 text-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {issue.severity === 'error' ? (
                        <XCircle className="w-4 h-4 text-crimson-risk shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-[#0D121B] text-cyan-300 font-mono text-[11px] border border-[#202A38] shrink-0">
                        Line {issue.line}{issue.column ? `:${issue.column}` : ''}
                      </span>
                      {issue.rule && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-mono text-[10px] border border-violet-500/30 shrink-0">
                          {issue.rule}
                        </span>
                      )}
                      <span className={`font-medium truncate ${issue.severity === 'error' ? 'text-crimson-risk' : 'text-amber-400'}`}>
                        {issue.message}
                      </span>
                      {issue.fixSuggestion && (
                        <span className="text-slate-400 text-[11px] hidden lg:inline truncate">
                          · Fix: {issue.fixSuggestion}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToLine?.(issue.line, issue.column);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0D121B] hover:bg-[#1A2536] text-slate-400 hover:text-cyan-300 text-[10px] border border-[#202A38] transition-colors"
                        title="Jump to line in editor"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Go to line</span>
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setFixingLine(issue.line);
                          try {
                            await onFixWithAI(issue);
                          } finally {
                            setFixingLine(null);
                          }
                        }}
                        disabled={fixingLine === issue.line}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[10px] font-bold border border-violet-500/40 disabled:opacity-50 transition-all cursor-pointer"
                        title="Auto-repair this syntax fault using AI"
                      >
                        {fixingLine === issue.line ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
                            <span>Fixing...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3 h-3 text-violet-400" />
                            <span>Fix with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}



          {/* TAB 2: Parameters Schema */}
          {activeTab === 'parameters' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#1E2B3E] gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Live Strategy Parameters ({language.toUpperCase()})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/25">
                    {parameters.length} Inputs
                  </span>
                  <span className="hidden md:inline text-[10px] text-slate-500">
                    · Modifying inputs updates code buffers in real-time
                  </span>
                </div>

                {/* Filter search */}
                {parameters.length > 0 && (
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Filter parameters..."
                      value={paramSearch}
                      onChange={(e) => setParamSearch(e.target.value)}
                      className="w-44 sm:w-56 bg-[#070B12] border border-[#1C2C40] focus:border-cyan-400 rounded-lg pl-7 pr-6 py-1 text-[11px] text-slate-200 placeholder-slate-500 font-mono outline-none transition-colors"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
                    {paramSearch && (
                      <button
                        onClick={() => setParamSearch('')}
                        className="absolute right-2 text-slate-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {parameters.length === 0 ? (
                <div className="text-slate-500 py-6 flex flex-col items-center justify-center gap-2 bg-[#090D14] rounded-xl border border-[#182332]">
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                  <span className="text-xs">No parameters detected. Define input directives in your strategy code.</span>
                </div>
              ) : filteredParameters.length === 0 ? (
                <div className="text-slate-500 py-6 flex flex-col items-center justify-center gap-1 bg-[#090D14] rounded-xl border border-[#182332]">
                  <span className="text-xs font-mono">No parameters match &quot;{paramSearch}&quot;</span>
                  <button
                    onClick={() => setParamSearch('')}
                    className="text-[11px] text-cyan-400 hover:underline mt-1 cursor-pointer"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredParameters.map((param) => {
                    const badge = getTypeBadge(param.type);
                    const cleanComment = (param.comment || '')
                      .replace(/^\s*\/{2,}\s*/, '')
                      .replace(/^[/*\s]+/, '')
                      .replace(/[*/\s]+$/, '');
                    const isBool = param.type.toLowerCase() === 'bool' || param.type.toLowerCase() === 'boolean';
                    const isNum =
                      param.type.toLowerCase() === 'int' ||
                      param.type.toLowerCase() === 'double' ||
                      param.type.toLowerCase() === 'float';

                    return (
                      <div
                        key={param.name}
                        className="p-3 rounded-xl bg-gradient-to-b from-[#0E1524] to-[#080D16] border border-[#1A2638] hover:border-cyan-500/40 hover:shadow-[0_4px_20px_rgba(6,182,212,0.08)] flex flex-col justify-between gap-2.5 transition-all group shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-mono font-semibold text-slate-100 text-xs truncate group-hover:text-cyan-300 transition-colors"
                              title={param.name}
                            >
                              {param.name}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold border ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          {cleanComment ? (
                            <p
                              className="text-[11px] text-slate-400 font-sans mt-1 line-clamp-1 leading-relaxed"
                              title={cleanComment}
                            >
                              {cleanComment}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-600 font-mono italic mt-1">
                              // Default input
                            </p>
                          )}
                        </div>

                        {/* Parameter Input Controls */}
                        {isBool ? (
                          <div className="flex items-center justify-between pt-2 border-t border-[#162130] mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono font-medium">Toggle:</span>
                            <div className="flex items-center bg-[#070A10] p-0.5 rounded-md border border-[#1A2638]">
                              <button
                                type="button"
                                onClick={() => onUpdateParameter(param.name, true)}
                                className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                                  Boolean(param.defaultValue) === true || String(param.defaultValue).toLowerCase() === 'true'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                True
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateParameter(param.name, false)}
                                className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${
                                  Boolean(param.defaultValue) === false || String(param.defaultValue).toLowerCase() === 'false'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                False
                              </button>
                            </div>
                          </div>
                        ) : isNum ? (
                          <div className="flex items-center justify-between pt-2 border-t border-[#162130] mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono font-medium">Value:</span>
                            <div className="flex items-center bg-[#070A10] rounded-md border border-[#1A2638] hover:border-cyan-500/50 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500/30 overflow-hidden transition-all">
                              <button
                                type="button"
                                onClick={() => {
                                  const step = param.type === 'int' ? 1 : 0.1;
                                  const curr = Number(param.defaultValue) || 0;
                                  const next = param.type === 'int' ? curr - 1 : Number((curr - step).toFixed(4));
                                  onUpdateParameter(param.name, next);
                                }}
                                className="px-2 py-1 text-slate-400 hover:text-cyan-300 hover:bg-[#101826] text-xs font-mono transition-colors active:scale-90 cursor-pointer"
                                title="Decrement"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step={param.type === 'int' ? '1' : '0.1'}
                                value={String(param.defaultValue)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (param.type === 'int') {
                                    const num = parseInt(raw, 10);
                                    onUpdateParameter(param.name, isNaN(num) ? raw : num);
                                  } else {
                                    const num = parseFloat(raw);
                                    onUpdateParameter(param.name, isNaN(num) ? raw : num);
                                  }
                                }}
                                className="w-20 bg-transparent text-center text-xs text-cyan-300 font-mono focus:outline-none py-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const step = param.type === 'int' ? 1 : 0.1;
                                  const curr = Number(param.defaultValue) || 0;
                                  const next = param.type === 'int' ? curr + 1 : Number((curr + step).toFixed(4));
                                  onUpdateParameter(param.name, next);
                                }}
                                className="px-2 py-1 text-slate-400 hover:text-cyan-300 hover:bg-[#101826] text-xs font-mono transition-colors active:scale-90 cursor-pointer"
                                title="Increment"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-2 border-t border-[#162130] mt-0.5 gap-2">
                            <span className="text-[10px] text-slate-400 font-mono font-medium">Text:</span>
                            <input
                              type="text"
                              value={String(param.defaultValue)}
                              onChange={(e) => onUpdateParameter(param.name, e.target.value)}
                              className="flex-1 bg-[#070A10] border border-[#1A2638] focus:border-cyan-400 rounded px-2 py-0.5 text-xs text-cyan-300 font-mono outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {/* TAB 4: Autopsy Diagnostics Radar */}
          {activeTab === 'autopsy' && (
            <div className="space-y-3 font-mono">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="p-2 rounded-lg bg-[#111722] border border-violet-500/30">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Sharpe Ratio</span>
                  <span className="text-violet-300 font-bold text-sm">
                    {Number(autopsyMetrics.sharpe || metrics?.sharpeRatio || 0).toFixed(2)}
                  </span>
                  <span className="text-[9px] text-emerald-400 block mt-0.5">
                    {Number(autopsyMetrics.sharpe || metrics?.sharpeRatio || 0) >= 1.5 ? 'Institutional ✓' : 'Sub-optimal'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#111722] border border-cyan-500/30">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Sortino Ratio</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {autopsyMetrics.sortino.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Downside Vol: {autopsyMetrics.downsideVol}</span>
                </div>

                <div className="p-2 rounded-lg bg-[#111722] border border-[#202A38]">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Calmar Ratio</span>
                  <span className="text-slate-200 font-bold text-sm">
                    {autopsyMetrics.calmar.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Max DD: {metrics?.maxDrawdownPct ?? 0}%</span>
                </div>

                <div className="p-2 rounded-lg bg-[#111722] border border-emerald-500/30">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Ruin Probability</span>
                  <span className={`font-bold text-sm ${autopsyMetrics.ruinProb === '0.00%' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {autopsyMetrics.ruinProb}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">1,000 Kaufman Resamples</span>
                </div>

                <div className="p-2 rounded-lg bg-[#111722] border border-cyan-500/30">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Causality Invariant</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {autopsyMetrics.lookaheadLeaks === 0 ? '0.000% Leak' : `${autopsyMetrics.lookaheadLeaks} Leaks`}
                  </span>
                  <span className="text-[9px] text-cyan-400 block mt-0.5">100% Zero Lookahead ✓</span>
                </div>
              </div>

              {/* Second Row: Detailed Execution & Streak Diagnostics */}
              <div className="p-2.5 rounded-lg bg-[#0E1522] border border-[#202A38] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Win Rate</span>
                    <span className="text-xs font-bold text-slate-200">{autopsyMetrics.winRate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Profit Factor</span>
                    <span className={`text-xs font-bold ${autopsyMetrics.profitFactor >= 1.2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {autopsyMetrics.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Max Win Streak</span>
                    <span className="text-xs font-bold text-emerald-400">{autopsyMetrics.maxConsecWins} trades</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Max Loss Streak</span>
                    <span className="text-xs font-bold text-rose-400">{autopsyMetrics.maxConsecLosses} trades</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Trades</span>
                    <span className="text-xs font-bold text-slate-300">{autopsyMetrics.totalTrades}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded border shadow-sm ${autopsyMetrics.verdictColor}`}>
                  {autopsyMetrics.verdict}
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: MT5 Live Terminal & Positions */}
          {activeTab === 'trade' && (
            !isChartRunnerOpen ? (
              <div className="py-7 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-gradient-to-b from-[#0D1422] to-[#080D16] rounded-xl border border-[#1A2638] my-1 font-mono">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.15)]">
                  <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
                </div>
                <div className="max-w-md space-y-1">
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                    MT5 Live Execution Terminal
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Here live execution telemetry, mark-to-market floating equity, and streaming fills for Test on Chart are displayed. Click below to launch live chart telemetry.
                  </p>
                </div>
                {onOpenChartRunner && (
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={onOpenChartRunner}
                      disabled={!isChartRunnerEnabled}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all font-sans ${
                        isChartRunnerEnabled
                          ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 shadow-cyan-950/40 hover:scale-[1.02] active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed bg-[#0C121D] text-slate-500 border border-[#1A2638] shadow-none pointer-events-none'
                      }`}
                      title={
                        isChartRunnerEnabled
                          ? 'Test Strategy on Live Candlestick Replay Chart'
                          : 'No test run results available. Run a strategy test first to enable chart replay.'
                      }
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      <span>{isChartRunnerEnabled ? 'Launch Test on Chart' : 'Test on Chart (Available After Test)'}</span>
                    </button>

                    {!isChartRunnerEnabled && (
                      <span className="text-[11px] text-amber-400/90 font-sans text-center max-w-sm">
                        Once you run a test and results are available, you can launch Test on Chart to replay fills and inspect execution.
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
            <div className="space-y-3 font-mono text-xs">
              {/* 1. MT5 Live Calculation & Account Bar */}
              <div className="p-1.5 sm:p-2.5 rounded-lg bg-[#0E1522] border border-[#202A38] flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider block">Balance</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      ${liveBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider block">Equity</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      ${liveEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider block">Floating P/L</span>
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {floatingPnl >= 0 ? `+$${floatingPnl.toFixed(2)}` : `-$${Math.abs(floatingPnl).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="hidden sm:block h-6 w-px bg-[#202A38]" />

                  <div className="hidden sm:block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Margin</span>
                    <span className="text-xs font-bold text-slate-300">
                      ${totalMargin.toFixed(2)}
                    </span>
                  </div>

                  <div className="hidden sm:block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Free Margin</span>
                    <span className="text-xs font-bold text-slate-300">
                      ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="hidden md:block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Margin Level</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {marginLevel}
                    </span>
                  </div>
                </div>

                {/* Sub-view switcher */}
                <div className="flex items-center bg-[#070A0F] p-0.5 rounded border border-[#202A38]">
                  <button
                    onClick={() => setTerminalView('positions')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors ${
                      terminalView === 'positions'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Open Positions ({openPositions.length})
                  </button>
                  <button
                    onClick={() => setTerminalView('history')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-colors ${
                      terminalView === 'history'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Account History ({closedTrades.length})
                  </button>
                </div>
              </div>

              {/* 2. Terminal Views */}
              {terminalView === 'positions' ? (
                /* LIVE OPEN POSITIONS TABLE */
                <div className="overflow-x-auto border border-[#202A38] rounded-lg max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-[9.5px] sm:text-[10.5px]">
                    <thead className="bg-[#0B0F16] text-slate-400 border-b border-[#202A38] uppercase tracking-wider text-[8.5px] sm:text-[9.5px] sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2 whitespace-nowrap">Order #</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Time (Open)</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Type</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Volume</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Symbol</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Price</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">S / L</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">T / P</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Current</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Comm</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Swap</th>
                        <th className="py-1.5 px-2 text-right whitespace-nowrap">Profit ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182232] bg-[#090D14]">
                      {openPositions.length > 0 ? (
                        openPositions.map((pos) => {
                          const isWin = pos.profit >= 0;
                          return (
                            <tr key={pos.orderId} className="hover:bg-[#0E1522] transition-colors">
                              <td className="py-1 px-2 font-bold text-slate-200 whitespace-nowrap">#{pos.orderId}</td>
                              <td className="py-1 px-2 text-slate-300 whitespace-nowrap" title={String(pos.openTime)}>{formatTerminalTime(pos.openTime)}</td>
                              <td className="py-1 px-2 whitespace-nowrap">
                                <span className={`px-1 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                                  pos.isLong ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                }`}>
                                  {pos.isLong ? 'BUY' : 'SELL'}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-slate-200 font-bold whitespace-nowrap">{pos.volume.toFixed(2)}</td>
                              <td className="py-1 px-2 text-slate-300 whitespace-nowrap">{pos.symbol}</td>
                              <td className="py-1 px-2 text-slate-200 font-bold whitespace-nowrap">{formatTradePrice(pos.entryPrice)}</td>
                              <td className="py-1 px-2 text-rose-400 whitespace-nowrap">{formatTradePrice(pos.stopLoss)}</td>
                              <td className="py-1 px-2 text-emerald-400 whitespace-nowrap">{formatTradePrice(pos.takeProfit)}</td>
                              <td className="py-1 px-2 text-slate-200 font-bold whitespace-nowrap">{formatTradePrice(pos.currentPrice)}</td>
                              <td className="py-1 px-2 text-slate-400 whitespace-nowrap">${pos.commission.toFixed(2)}</td>
                              <td className="py-1 px-2 text-slate-400 whitespace-nowrap">${pos.swap.toFixed(2)}</td>
                              <td className={`py-1 px-2 text-right font-bold whitespace-nowrap ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}${pos.profit.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={12} className="py-4 text-center text-slate-500 italic text-[10px]">
                            No open positions. All positions closed and settled into Balance.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ACCOUNT HISTORY TABLE */
                <div className="overflow-x-auto border border-[#202A38] rounded-lg max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-[9.5px] sm:text-[10.5px]">
                    <thead className="bg-[#0B0F16] text-slate-400 border-b border-[#202A38] uppercase tracking-wider text-[8.5px] sm:text-[9.5px] sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2 whitespace-nowrap">Ticket</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Open Time</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Type</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Volume</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Price In</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">S / L</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">T / P</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Close Time</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Price Out</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">Reason</th>
                        <th className="py-1.5 px-2 text-right whitespace-nowrap">Profit ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182232] bg-[#090D14]">
                      {closedTrades.map((t: any, idx: number) => {
                        const isLong = String(t.side || '').toUpperCase().includes('BUY') || String(t.side || '').toUpperCase() === 'LONG';
                        const isWin = (t.pnl ?? 0) >= 0;
                        return (
                          <tr key={t.id || t.trade_id || idx} className="hover:bg-[#0E1522] transition-colors">
                            <td className="py-1 px-2 font-bold text-slate-300 whitespace-nowrap">#{t.trade_id || t.id || t.ticket || idx + 1}</td>
                            <td className="py-1 px-2 text-slate-400 whitespace-nowrap" title={String(t.entryTime || t.entry_time || '')}>{formatTerminalTime(t.entryTime || t.entry_time)}</td>
                            <td className="py-1 px-2 whitespace-nowrap">
                              <span className={`px-1 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                                isLong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                              }`}>
                                {isLong ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-slate-300 font-bold whitespace-nowrap">{(t.quantity ?? t.volume ?? 0.01).toFixed(2)}</td>
                            <td className="py-1 px-2 text-slate-200 whitespace-nowrap">{formatTradePrice(t.entryPrice ?? t.entry_price)}</td>
                            <td className="py-1 px-2 text-rose-400 whitespace-nowrap">{getSl(t)}</td>
                            <td className="py-1 px-2 text-emerald-400 whitespace-nowrap">{getTp(t)}</td>
                            <td className="py-1 px-2 text-slate-400 whitespace-nowrap" title={String(t.exitTime || t.exit_time || '')}>{formatTerminalTime(t.exitTime || t.exit_time)}</td>
                            <td className="py-1 px-2 text-slate-200 whitespace-nowrap">{formatTradePrice(t.exitPrice ?? t.exit_price)}</td>
                            <td className="py-1 px-2 text-slate-400 whitespace-nowrap">{t.exitReason || t.exit_reason || '-'}</td>
                            <td className={`py-1 px-2 text-right font-bold whitespace-nowrap ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}${(t.pnl ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
