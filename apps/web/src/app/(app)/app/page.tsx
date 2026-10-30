'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Brain,
  Clock,
  Users,
  Bell,
  GitBranch,
  TrendingUp,
  TrendingDown,
  BarChart2,
  LineChart,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AgentSessionSummary {
  session_id: string;
  user_id: string;
  title: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
}

interface StrategyItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  language?: string;
  default_symbol?: string;
  default_timeframe?: string;
  created_at?: string;
}

interface CommunityPost {
  id: string;
  author?: {
    name?: string;
  };
  content: string;
  likesCount?: number;
  commentsCount?: number;
  createdAt?: string;
}

interface BacktestTrade {
  trade_id: string;
  symbol: string;
  side: string;
  entry_time: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  pnl: number;
  pnl_percent?: number;
}

interface BacktestEquityPoint {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown: number;
  drawdown_pct: number;
}

interface BacktestPerformanceMetrics {
  initial_capital: number;
  ending_equity: number;
  net_profit: number;
  net_profit_pct: number;
  total_trades: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
  max_drawdown_pct: number;
}

interface BacktestRecord {
  id: string;
  strategy_id?: string;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  status: string;
  metrics: BacktestPerformanceMetrics;
  equity_curve?: BacktestEquityPoint[];
  trades?: BacktestTrade[];
  created_at: string;
}

interface StrategyTestItem {
  id: string;
  name: string;
  language: string;
  version: string;
  symbol: string;
  timeframe: string;
  testCount: number;
  testPct: number;
  winRate: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    let s = dateStr.trim();
    if (s.length >= 10 && s[4] === '.' && s[7] === '.') {
      s = s.slice(0, 4) + '-' + s.slice(5, 7) + '-' + s.slice(8);
    }
    s = s.replace(' ', 'T');
    if (!s.endsWith('Z') && !s.includes('+') && !/[-+]\d{2}:\d{2}$/.test(s)) s += 'Z';
    const d = new Date(s);
    if (isNaN(d.getTime())) return dateStr.slice(5, 10);

    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return 'just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1m ago';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(5, 10);
  }
}

function formatCurrency(val: number): string {
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  const abs = Math.abs(val);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// -----------------------------------------------------------------------------
// Dashboard Page Component
// -----------------------------------------------------------------------------

export default function DashboardPage() {
  const { user, token } = useAuthStore();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [totalBacktestsCount, setTotalBacktestsCount] = useState<number>(0);

  // Real Tested Strategy State (Latest from database)
  const [recentBacktests, setRecentBacktests] = useState<BacktestRecord[]>([]);
  const [selectedBacktestId, setSelectedBacktestId] = useState<string | null>(null);
  const [activeBacktestDetail, setActiveBacktestDetail] = useState<BacktestRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // View Mode: Equity Curve vs Underwater Drawdown
  const [viewMode, setViewMode] = useState<'EQUITY' | 'UNDERWATER'>('EQUITY');

  // Scrubber Hover Index
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeUser =
    user?.full_name?.split(' ')[0]?.toLowerCase() ||
    user?.email?.split('@')[0]?.toLowerCase() ||
    'khattabi';

  // Load backtest run details (including full equity curve and trades)
  const loadBacktestDetail = async (runId: string) => {
    setIsLoadingDetail(true);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/v1/backtests/${encodeURIComponent(runId)}`, {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data: BacktestRecord = await res.json();
        setActiveBacktestDetail(data);
      }
    } catch (err) {
      console.warn('[Dashboard] Error fetching backtest details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Load overall dashboard datasets from real API endpoints
  const loadDashboardData = async () => {
    setIsLoading(true);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const [sessRes, stratRes, commRes, btRes] = await Promise.allSettled([
        fetch(`/api/v1/agent/sessions?user_id=${encodeURIComponent(activeUser)}`, { headers, credentials: 'include' }),
        fetch('/api/v1/strategies', { headers, credentials: 'include' }),
        fetch('/api/v1/community/posts', { headers, credentials: 'include' }),
        fetch('/api/v1/backtests?limit=100', { headers, credentials: 'include' }),
      ]);

      if (sessRes.status === 'fulfilled' && sessRes.value.ok) {
        const data = await sessRes.value.json();
        if (Array.isArray(data)) setSessions(data);
      }
      if (stratRes.status === 'fulfilled' && stratRes.value.ok) {
        const data = await stratRes.value.json();
        if (Array.isArray(data)) setStrategies(data);
      }
      if (commRes.status === 'fulfilled' && commRes.value.ok) {
        const data = await commRes.value.json();
        if (data && Array.isArray(data.posts)) setCommunityPosts(data.posts);
      }
      if (btRes.status === 'fulfilled' && btRes.value.ok) {
        const data: BacktestRecord[] = await btRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          setTotalBacktestsCount(data.length);
          // Filter to runs that contain simulated activity (prioritizing runs with trades)
          const validRuns = data.filter((r) => (r.metrics?.total_trades ?? 0) > 0);
          const candidateRuns = validRuns.length > 0 ? validRuns : data;
          setRecentBacktests(candidateRuns);

          // Select the latest tested strategy
          const latestRun = candidateRuns[0];
          setSelectedBacktestId(latestRun.id);
          // Fetch its complete equity curve and trades
          loadBacktestDetail(latestRun.id);
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [token, activeUser]);

  // When user switches selected tested strategy from the header dropdown
  const handleSelectBacktest = (runId: string) => {
    setSelectedBacktestId(runId);
    setHoverIndex(null);
    loadBacktestDetail(runId);
  };

  // Derive trade analytics from real closed trades of the active backtest
  const tradeAnalytics = useMemo(() => {
    const trades = activeBacktestDetail?.trades || [];
    if (trades.length === 0) {
      return {
        longTrades: 0,
        shortTrades: 0,
        longPct: 50,
        shortPct: 50,
        winCount: 0,
        lossCount: 0,
        avgTrade: 0,
      };
    }

    let longs = 0;
    let shorts = 0;
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;

    for (const t of trades) {
      const p = t.pnl || 0;
      totalPnl += p;

      if (t.side?.toUpperCase() === 'LONG') longs += 1;
      else shorts += 1;

      if (p > 0) wins += 1;
      else losses += 1;
    }

    const totalOrders = trades.length || 1;
    const longPct = Math.round((longs / totalOrders) * 100);
    const shortPct = 100 - longPct;
    const avgTrade = Number((totalPnl / totalOrders).toFixed(2));

    return {
      longTrades: longs,
      shortTrades: shorts,
      longPct,
      shortPct,
      winCount: wins,
      lossCount: losses,
      avgTrade,
    };
  }, [activeBacktestDetail]);

  // Derive real strategy testing frequency and version iteration metrics
  const strategyTestSummary = useMemo(() => {
    const runCounts: Record<string, { count: number; winRates: number[] }> = {};
    for (const r of recentBacktests) {
      const key = r.strategy_name || r.strategy_id || 'Unknown';
      if (!runCounts[key]) {
        runCounts[key] = { count: 0, winRates: [] };
      }
      runCounts[key].count += 1;
      if (r.metrics?.win_rate != null) {
        runCounts[key].winRates.push(r.metrics.win_rate);
      }
    }

    const totalRuns = recentBacktests.length || 1;

    // Collect only strategies that have actually been tested (testCount > 0)
    const stratMap = new Map<string, StrategyTestItem>();

    for (const s of strategies) {
      const matched = runCounts[s.name] ||
        runCounts[s.id] ||
        Object.entries(runCounts).find(([k]) => k.toLowerCase().includes(s.name.toLowerCase()))?.[1];

      if (matched && matched.count > 0) {
        const avgWr = matched.winRates.length > 0
          ? matched.winRates.reduce((a, b) => a + b, 0) / matched.winRates.length
          : 50.0;

        const ver = (s as any).version_num
          ? `v${(s as any).version_num}`
          : (s as any).version || 'v1';

        stratMap.set(s.name, {
          id: s.id,
          name: s.name,
          language: (s.language || 'MQL5').toUpperCase(),
          version: ver,
          symbol: s.default_symbol || 'EURUSD',
          timeframe: s.default_timeframe || '1h',
          testCount: matched.count,
          testPct: Math.round((matched.count / totalRuns) * 100),
          winRate: Number(avgWr.toFixed(1)),
        });
      }
    }

    // Also pick up any backtest runs whose strategy isn't explicitly in the strategies array
    for (const [name, data] of Object.entries(runCounts)) {
      if (!stratMap.has(name) && name !== 'Unknown' && data.count > 0) {
        const avgWr = data.winRates.length > 0
          ? data.winRates.reduce((a, b) => a + b, 0) / data.winRates.length
          : 50.0;
        stratMap.set(name, {
          id: name,
          name,
          language: 'MQL5',
          version: 'v1',
          symbol: 'EURUSD',
          timeframe: '1h',
          testCount: data.count,
          testPct: Math.round((data.count / totalRuns) * 100),
          winRate: Number(avgWr.toFixed(1)),
        });
      }
    }

    const testedItems = Array.from(stratMap.values());
    testedItems.sort((a, b) => b.testCount - a.testCount);

    const DISPLAY_LIMIT = 3;
    const topStrategies = testedItems.slice(0, DISPLAY_LIMIT);
    const mostTested = testedItems[0] || { name: 'None', testCount: 0 };

    return {
      topStrategies,
      testedCount: testedItems.length,
      hasMore: testedItems.length > DISPLAY_LIMIT,
      moreCount: Math.max(0, testedItems.length - DISPLAY_LIMIT),
      totalVersions: strategies.length,
      totalRuns: recentBacktests.length,
      mostTestedName: mostTested.name,
      mostTestedRuns: mostTested.testCount,
    };
  }, [strategies, recentBacktests]);

  // SVG Geometry Dimensions
  const chartW = 900;
  const chartH = 230;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 15;
  const padBottom = 20;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  // Real Vector SVG Path from active backtest equity curve
  const chartGeometry = useMemo(() => {
    const rawCurve = activeBacktestDetail?.equity_curve || [];
    if (rawCurve.length === 0) return { pathD: '', areaD: '', points: [] };

    // Sample down to at most 70 points for fluid vector rendering if needed
    const step = Math.max(1, Math.floor(rawCurve.length / 70));
    const dataset = rawCurve.filter((_, idx) => idx % step === 0 || idx === rawCurve.length - 1);

    if (viewMode === 'EQUITY') {
      const values = dataset.map((d) => d.equity);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal || 1;

      const points = dataset.map((d, i) => {
        const x = padLeft + (i / (dataset.length - 1)) * innerW;
        const normY = (d.equity - minVal) / range;
        const y = padTop + (1 - normY) * innerH;
        return { x, y, raw: d };
      });

      const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
      const baselineY = padTop + innerH;
      const areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

      return { pathD, areaD, points, minVal, maxVal };
    } else {
      // Underwater Drawdown Curve
      const values = dataset.map((d) => d.drawdown_pct);
      const maxDD = Math.max(...values, activeBacktestDetail?.metrics?.max_drawdown_pct || 1);

      const points = dataset.map((d, i) => {
        const x = padLeft + (i / (dataset.length - 1)) * innerW;
        const normY = d.drawdown_pct / (maxDD || 1);
        const y = padTop + normY * innerH;
        return { x, y, raw: d };
      });

      const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
      const ceilingY = padTop;
      const areaD = `${pathD} L ${points[points.length - 1].x} ${ceilingY} L ${points[0].x} ${ceilingY} Z`;

      return { pathD, areaD, points, minVal: 0, maxVal: maxDD };
    }
  }, [activeBacktestDetail, viewMode, innerW, innerH]);

  const activeHoverPoint = useMemo(() => {
    if (hoverIndex === null || !chartGeometry.points || hoverIndex >= chartGeometry.points.length) {
      return null;
    }
    return chartGeometry.points[hoverIndex];
  }, [hoverIndex, chartGeometry.points]);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pts = chartGeometry.points;
    if (!pts || pts.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (xRel - padLeft) / innerW));
    const idx = Math.round(ratio * (pts.length - 1));
    setHoverIndex(idx);
  };

  // Active metrics from the tested strategy
  const activeMetrics = activeBacktestDetail?.metrics;
  const hasBacktest = Boolean(activeBacktestDetail);

  return (
    <div className="space-y-6 sm:space-y-7 pb-16 font-sans max-w-7xl mx-auto">
      {/* ----------------------------------------------------------------- */}
      {/* 1. CLEAN HERO (NO FLOATING BADGES, UNIFIED MATCHING BUTTONS)      */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
              Quantitative Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Algorithmic strategy synthesis, real-time market data radar, and institutional backtesting studio.
            </p>
          </div>

          {/* Unified Action Buttons with Cohesive Pro Styling */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Link
              href="/app/quant"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#080B10] font-semibold text-xs transition-colors shadow-sm"
            >
              <Brain className="w-4 h-4" />
              <span>Launch Quant Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/app/backtest"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141B29] hover:bg-[#1A2336] border border-[#243044] hover:border-slate-500 text-slate-200 font-medium text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
              <span>Run Backtest</span>
            </Link>

            <Link
              href="/app/community"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#141B29] hover:bg-[#1A2336] border border-[#243044] hover:border-slate-500 text-slate-200 font-medium text-xs transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Community</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. GLOBAL QUANTITATIVE WORKSPACE TELEMETRY (DYNAMIC KPI RADAR)   */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="flex items-center mb-2.5 px-1">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Global Quantitative Workspace Telemetry</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Synthesized Strategies */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D121D] border border-[#1E2638] shadow-sm space-y-2 select-none">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-mono text-slate-400 truncate flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>TOTAL STRATEGIES</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                Repository
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
              <span>{isLoading ? '...' : strategies.length}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-[#1E2638]">
              <span>Native MQL5</span>
              <span className="text-emerald-400/80">Active Models</span>
            </div>
          </div>

          {/* Card 2: Total Backtest Simulations Made */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D121D] border border-[#1E2638] shadow-sm space-y-2 select-none">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-mono text-slate-400 truncate flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                <span>BACKTEST SIMULATIONS</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                MT5 Engine
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
              <span>{isLoading ? '...' : (totalBacktestsCount || recentBacktests.length || 0)}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-[#1E2638]">
              <span>Deterministic Sim</span>
              <span className="text-cyan-400/80">Validated Runs</span>
            </div>
          </div>

          {/* Card 3: Quant AI Research Sessions */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D121D] border border-[#1E2638] shadow-sm space-y-2 select-none">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-mono text-slate-400 truncate flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span>QUANT AI SESSIONS</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                Copilot Active
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
              <span>{isLoading ? '...' : sessions.length}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-[#1E2638]">
              <span>Synthesis Threads</span>
              <span className="text-cyan-400/80">Active Enclave</span>
            </div>
          </div>

          {/* Card 4: Community Notifications & Feed */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#0D121D] border border-[#1E2638] shadow-sm space-y-2 select-none">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-mono text-slate-400 truncate flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-purple-400" />
                <span>COMMUNITY NOTIFICATIONS</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                Activity
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
              <span>{isLoading ? '...' : communityPosts.length}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-[#1E2638]">
              <span>Community Feed</span>
              <span className="text-purple-400/80">Network Updates</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. LAST TESTED STRATEGY PERFORMANCE CANVAS (100% REAL DATA)      */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl bg-[#0D121D] border border-[#1E2638] p-4 sm:p-6 shadow-sm space-y-4">
        {/* Header Controls: Strategy Title & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2638]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              {viewMode === 'EQUITY' ? <LineChart className="w-4 h-4" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                  <span>Last Tested Strategy:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {activeBacktestDetail ? activeBacktestDetail.strategy_name : 'No Test Run Found'}
                  </span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {activeBacktestDetail
                  ? `${activeBacktestDetail.symbol} · ${activeBacktestDetail.timeframe} · Tested ${formatRelativeTime(activeBacktestDetail.created_at)}`
                  : 'Synthesize or select a strategy blueprint to run a backtest simulation.'}
              </p>
            </div>
          </div>

          {/* Controls: Tested Run Selector & View Mode Switcher */}
          {hasBacktest && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* If user has multiple completed test runs, allow switching */}
              {recentBacktests.length > 1 && (
                <div className="flex items-center rounded-lg bg-[#141B29] border border-[#243044] px-2 py-1 text-xs font-mono text-slate-300">
                  <span className="text-slate-500 mr-1.5 text-[10px] uppercase">Run:</span>
                  <select
                    value={selectedBacktestId || ''}
                    onChange={(e) => handleSelectBacktest(e.target.value)}
                    className="bg-transparent text-cyan-400 outline-none cursor-pointer text-xs font-mono font-medium"
                  >
                    {recentBacktests.map((run) => (
                      <option key={run.id} value={run.id} className="bg-[#141B29] text-slate-200">
                        {run.strategy_name} ({run.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* View Mode Toggle: Equity Curve vs Underwater Drawdown */}
              <div className="flex items-center rounded-lg bg-[#141B29] p-0.5 border border-[#243044]">
                <button
                  onClick={() => setViewMode('EQUITY')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                    viewMode === 'EQUITY'
                      ? 'bg-cyan-400 text-[#080B10] font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Equity
                </button>
                <button
                  onClick={() => setViewMode('UNDERWATER')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                    viewMode === 'UNDERWATER'
                      ? 'bg-rose-500 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Underwater
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real Dynamic Price / Telemetry Readout */}
        {hasBacktest && activeMetrics ? (
          <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                {activeHoverPoint
                  ? 'POINT-IN-TIME INSPECTED TELEMETRY'
                  : viewMode === 'EQUITY'
                  ? 'SIMULATED FINAL NET EQUITY'
                  : 'MAXIMUM RECORDED DRAWDOWN'}
              </span>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-100 flex items-center gap-2.5">
                <span>
                  {activeHoverPoint
                    ? viewMode === 'EQUITY'
                      ? `$${activeHoverPoint.raw.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : `-${activeHoverPoint.raw.drawdown_pct.toFixed(2)}%`
                    : viewMode === 'EQUITY'
                    ? `$${activeMetrics.ending_equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : `-${Math.abs(activeMetrics.max_drawdown_pct).toFixed(2)}%`}
                </span>

                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                    activeMetrics.net_profit >= 0
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  {activeMetrics.net_profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {activeMetrics.net_profit >= 0 ? '+' : ''}
                  {activeMetrics.net_profit_pct.toFixed(2)}% Net
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5 sm:gap-6 font-mono text-xs">
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">SHARPE RATIO</span>
                <span className={`font-semibold ${activeMetrics.sharpe_ratio >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {activeMetrics.sharpe_ratio.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">PROFIT FACTOR</span>
                <span className="font-semibold text-emerald-400">{activeMetrics.profit_factor.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">MAX DRAWDOWN</span>
                <span className="font-semibold text-rose-400">-{Math.abs(activeMetrics.max_drawdown_pct).toFixed(2)}%</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] block">INSPECTED DATE</span>
                <span className="text-slate-300">
                  {activeHoverPoint ? activeHoverPoint.raw.timestamp.slice(0, 10) : activeBacktestDetail?.created_at?.slice(0, 10) || 'Latest'}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Real Interactive Vector SVG Chart */}
        <div className="w-full h-56 relative bg-[#090D15] rounded-xl border border-[#162030] overflow-hidden select-none">
          {isLoadingDetail || isLoading ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400 gap-2 font-mono text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading verified backtest telemetry...</span>
            </div>
          ) : !hasBacktest || chartGeometry.points.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <p className="text-xs text-slate-400 font-mono">No completed backtest simulation found.</p>
              <Link
                href="/app/backtest"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#080B10] font-semibold text-xs transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Backtest in Studio</span>
              </Link>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-full cursor-crosshair"
              preserveAspectRatio="none"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="cyanEquityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="roseUnderwaterFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.28" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padLeft} y1={padTop} x2={chartW - padRight} y2={padTop} stroke="#1A2538" strokeDasharray="3 3" />
              <line x1={padLeft} y1={padTop + innerH * 0.5} x2={chartW - padRight} y2={padTop + innerH * 0.5} stroke="#1A2538" strokeDasharray="3 3" />
              <line x1={padLeft} y1={padTop + innerH} x2={chartW - padRight} y2={padTop + innerH} stroke="#1A2538" />

              {/* Gradient Area Fill */}
              <path
                d={chartGeometry.areaD}
                fill={viewMode === 'UNDERWATER' ? 'url(#roseUnderwaterFill)' : 'url(#cyanEquityFill)'}
              />

              {/* Main Vector Curve Stroke */}
              <path
                d={chartGeometry.pathD}
                fill="none"
                stroke={viewMode === 'UNDERWATER' ? '#F43F5E' : '#22D3EE'}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hover Crosshair & Anchor Point */}
              {activeHoverPoint && (
                <g>
                  <line
                    x1={activeHoverPoint.x}
                    y1={padTop}
                    x2={activeHoverPoint.x}
                    y2={padTop + innerH}
                    stroke={viewMode === 'UNDERWATER' ? '#FB7185' : '#38BDF8'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={activeHoverPoint.x}
                    cy={activeHoverPoint.y}
                    r="4"
                    fill="#080B10"
                    stroke={viewMode === 'UNDERWATER' ? '#F43F5E' : '#22D3EE'}
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUB-WIDGETS: REAL STRATEGY TEST ACTIVITY & DIRECTIONAL STATS  */}
        {/* (CALCULATED DIRECTLY FROM REAL USER REPOSITORY AND RUNS)      */}
        {/* ------------------------------------------------------------- */}
        {hasBacktest && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            {/* Widget A: Real Strategy Versions & Test Activity */}
            <div className="rounded-xl bg-[#090D15] border border-[#162030] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Strategy Testing & Version Activity
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {strategyTestSummary.testedCount} Tested · {strategyTestSummary.totalRuns} Runs
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {strategyTestSummary.topStrategies.length === 0 ? (
                  <div className="py-6 text-center text-xs font-mono text-slate-500">
                    No strategy test simulations recorded yet.
                  </div>
                ) : (
                  strategyTestSummary.topStrategies.map((item) => (
                    <div
                      key={item.id || item.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#0B0F19] border border-[#141C2B] hover:border-[#1E293B] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-medium text-slate-200 truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#111726] text-slate-400 border border-[#1A2336] shrink-0 font-medium">
                              {item.version}
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#0D121F] text-slate-500 uppercase shrink-0">
                              {item.language}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                            <span className="text-slate-300 font-medium">{item.symbol}</span>
                            <span>·</span>
                            <span>{item.timeframe}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-slate-500 block uppercase">Simulations</span>
                          <span className="font-mono text-xs font-semibold text-slate-200">
                            {item.testCount} {item.testCount === 1 ? 'Run' : 'Runs'}
                          </span>
                        </div>
                        <div className="text-right pl-3 border-l border-[#1A2336]">
                          <span className="text-[9px] font-mono text-slate-500 block uppercase">Win Rate</span>
                          <span className={`font-mono text-xs font-medium ${item.winRate >= 50 ? 'text-emerald-400/80' : 'text-slate-400'}`}>
                            {item.winRate > 0 ? `${item.winRate}%` : '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-[#141C2B]">
                <span>
                  Top Tested:{' '}
                  <strong className="text-slate-300">{strategyTestSummary.mostTestedName}</strong>
                </span>
                {strategyTestSummary.hasMore ? (
                  <Link
                    href="/app/strategies"
                    className="text-slate-400 hover:text-slate-200 hover:underline flex items-center gap-1 transition-colors"
                  >
                    <span>+{strategyTestSummary.moreCount} more in library</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span>
                    Recorded Runs:{' '}
                    <strong className="text-slate-300">{strategyTestSummary.totalRuns} Total</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Widget B: Real Trade Direction & Execution Profile */}
            <div className="rounded-xl bg-[#090D15] border border-[#162030] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Trade Direction & Execution Profile
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {activeBacktestDetail?.trades?.length || 0} MT5 Orders
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                {/* Long Exposure Progress - Soft Muted Green */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">Long Exposure ({activeBacktestDetail?.symbol})</span>
                    <span className="text-emerald-400/80 font-semibold">
                      {tradeAnalytics.longTrades} Trades ({tradeAnalytics.longPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#111724] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: `${tradeAnalytics.longPct}%` }} />
                  </div>
                </div>

                {/* Short Exposure Progress - Soft Muted Red */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">Short Exposure ({activeBacktestDetail?.symbol})</span>
                    <span className="text-rose-400/80 font-semibold">
                      {tradeAnalytics.shortTrades} Trades ({tradeAnalytics.shortPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#111724] rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500/50 rounded-full" style={{ width: `${tradeAnalytics.shortPct}%` }} />
                  </div>
                </div>

                {/* Win/Loss Split Progress - Soft Muted Green & Red */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">Win / Loss Ratio</span>
                    <span className="font-semibold font-mono text-[11px]">
                      <span className="text-emerald-400/80">{tradeAnalytics.winCount} Wins</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-rose-400/80">{tradeAnalytics.lossCount} Losses</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#111724] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500/50"
                      style={{
                        width: `${Math.round(
                          (tradeAnalytics.winCount / (tradeAnalytics.winCount + tradeAnalytics.lossCount || 1)) * 100
                        )}%`,
                      }}
                    />
                    <div
                      className="h-full bg-rose-500/50"
                      style={{
                        width: `${Math.round(
                          (tradeAnalytics.lossCount / (tradeAnalytics.winCount + tradeAnalytics.lossCount || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-[#141C2B]">
                <span>
                  Avg Trade:{' '}
                  <strong className={tradeAnalytics.avgTrade >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}>
                    {formatCurrency(tradeAnalytics.avgTrade)}
                  </strong>
                </span>
                <span>Execution Engine: <strong className="text-slate-400">MetaTrader 5 Native</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. WORKSPACE RADAR: AI RESEARCH SESSIONS & STRATEGY REPOSITORY    */}
      {/* (CLEAN INTERACTIVE ROWS WITHOUT REPETITIVE BUTTONS)               */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Recent Quant AI Research Sessions */}
        <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wide font-mono">
                Recent Quant AI Conversations
              </h3>
            </div>
            <Link
              href="/app/quant"
              className="text-xs text-cyan-400 hover:underline font-mono flex items-center gap-1"
            >
              <span>View Lab</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-slate-400">No active AI research sessions found.</p>
              <Link
                href="/app/quant"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 text-[#080B10] font-semibold text-xs hover:bg-cyan-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Strategy Synthesis</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.slice(0, 5).map((s) => (
                <Link
                  key={s.session_id}
                  href={`/app/quant?sessionId=${s.session_id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#141B29] border border-transparent hover:border-[#202A38] transition-all group cursor-pointer"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
                        {s.title || 'Untitled Strategy'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#161F30] text-slate-400 border border-[#202A38]">
                        {s.message_count || 0} msgs
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatRelativeTime(s.updated_at || s.created_at)}</span>
                      <span>·</span>
                      <span className="text-cyan-400/70">AI Research</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 group-hover:text-cyan-400 text-xs font-mono shrink-0">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Strategy Repository */}
        <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wide font-mono">
                Synthesized Strategy Repository
              </h3>
            </div>
            <Link
              href="/app/strategies"
              className="text-xs text-emerald-400 hover:underline font-mono flex items-center gap-1"
            >
              <span>View All ({strategies.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {strategies.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-slate-400">No strategy blueprints found.</p>
              <Link
                href="/app/quant"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 text-[#080B10] font-semibold text-xs hover:bg-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Synthesize Strategy</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {strategies.slice(0, 5).map((strat) => (
                <Link
                  key={strat.id}
                  href={`/app/backtest?strategy=${encodeURIComponent(strat.id)}&symbol=${strat.default_symbol || 'XAUUSD'}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#141B29] border border-transparent hover:border-[#202A38] transition-all group cursor-pointer"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {strat.name}
                      </span>
                      <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#161F30] text-emerald-400 border border-[#202A38] uppercase">
                        {strat.language || 'mql5'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                      <span className="text-cyan-400 font-semibold">{strat.default_symbol || 'XAUUSD'}</span>
                      <span>·</span>
                      <span>{strat.default_timeframe || '15m'}</span>
                      <span>·</span>
                      <span className="truncate">{strat.category || 'Quantitative Strategy'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 group-hover:text-emerald-400 text-xs font-mono shrink-0">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. COMMUNITY STRATEGY FEED                                        */}
      {/* ----------------------------------------------------------------- */}
      {communityPosts.length > 0 && (
        <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-xs text-slate-100 uppercase tracking-wide font-mono">
                Community Strategy Feed
              </h3>
            </div>
            <Link
              href="/app/community"
              className="text-xs text-cyan-400 hover:underline font-mono flex items-center gap-1"
            >
              <span>Explore Community</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {communityPosts.slice(0, 3).map((post) => (
              <Link
                key={post.id}
                href={`/app/community?post=${post.id}`}
                className="p-3.5 rounded-lg bg-[#111726] border border-[#1E2638] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-2.5 group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 transition-colors font-mono">
                      {post.author?.name || 'Quant Contributor'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {post.content}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1E2638] flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>❤️ {post.likesCount || 0}</span>
                    <span>💬 {post.commentsCount || 0}</span>
                  </div>
                  <span className="text-cyan-400 text-[11px] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    View &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
