'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  Layers,
  Code2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Search,
  Filter,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Activity,
  TrendingUp,
  Clock,
  ExternalLink,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

interface RealStrategy {
  id: string;
  name: string;
  slug: string;
  description: string;
  language: string;
  created_at: string;
  updated_at: string;
  author_email?: string;
  author_name?: string;
  run_count: number;
}

interface RealBacktestRun {
  id: string;
  strategy_id: string;
  strategy_name: string;
  version_num: number;
  symbol: string;
  timeframe: string;
  initial_capital: number;
  final_equity: number;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_pct: number;
  execution_time_ms: number;
  status: string;
  created_at: string;
  author_email?: string;
}

interface LiveTelemetryData {
  pool: {
    total_workers: number;
    installed_workers: number;
    idle_workers: number;
    busy_workers: number;
    queue_depth: number;
    total_jobs_processed: number;
    workers: {
      worker_id: number;
      base_dir: string;
      is_installed: boolean;
      is_busy: boolean;
      current_job_id: string | null;
      last_leased_at: number | null;
      completed_jobs_count: number;
    }[];
  };
  active_runs: {
    id: string;
    strategy_id: string;
    strategy_name: string;
    symbol: string;
    timeframe: string;
    status: string;
    initial_capital: number;
    created_at: string;
    execution_time_ms: number;
    author_email?: string;
  }[];
  recent_runs: {
    id: string;
    strategy_name: string;
    symbol: string;
    timeframe: string;
    status: string;
    initial_capital: number;
    final_equity: number;
    execution_time_ms: number;
    created_at: string;
    author_email?: string;
  }[];
  timestamp: string;
}

export default function AdminStrategiesPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'live' | 'strategies' | 'runs'>('live');
  const [strategies, setStrategies] = useState<RealStrategy[]>([]);
  const [runs, setRuns] = useState<RealBacktestRun[]>([]);
  const [liveData, setLiveData] = useState<LiveTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [autoPoll, setAutoPoll] = useState(true);

  // Fetch strategies and historical runs
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [stratRes, runsRes] = await Promise.all([
        fetch('/api/v1/admin/strategies', { headers, credentials: 'include' }),
        fetch('/api/v1/admin/runs', { headers, credentials: 'include' }),
      ]);

      if (!stratRes.ok || !runsRes.ok) {
        throw new Error('Failed to fetch strategy registry');
      }

      const stratsData: RealStrategy[] = await stratRes.json();
      const runsData: RealBacktestRun[] = await runsRes.json();

      setStrategies(stratsData);
      setRuns(runsData);
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
      setError('Unable to load strategies. Please verify API server status.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch live running tests and worker pool status
  const fetchLiveData = async () => {
    setLiveLoading(true);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/live-runs', { headers, credentials: 'include' });
      if (res.ok) {
        const data: LiveTelemetryData = await res.json();
        setLiveData(data);
      }
    } catch (err) {
      console.error('Error fetching live runs:', err);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLiveData();
  }, [token]);

  // Live polling interval for running tests
  useEffect(() => {
    if (!autoPoll || activeTab !== 'live') return;

    const interval = setInterval(() => {
      fetchLiveData();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoPoll, activeTab, token]);

  // Filter strategies
  const filteredStrategies = strategies.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.author_email && s.author_email.toLowerCase().includes(q))
    );
  });

  // Filter runs
  const filteredRuns = runs.filter((r) => {
    if (statusFilter !== 'ALL' && r.status.toUpperCase() !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.strategy_name.toLowerCase().includes(q) ||
      r.symbol.toLowerCase().includes(q) ||
      (r.author_email && r.author_email.toLowerCase().includes(q))
    );
  });

  const activeRunsCount = liveData?.active_runs?.length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2638]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>BacktestAI</span>
            <span>/</span>
            <span>Admin</span>
            <span>/</span>
            <span className="text-slate-300">Strategies & Execution Audits</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-cyan-400" />
            <span>Strategy Registry & Live Test Monitor</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Inspect live executing backtests, MetaTrader 5 worker pool nodes, and registered quantitative models.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {activeTab === 'live' && (
            <button
              onClick={() => setAutoPoll(!autoPoll)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                autoPoll
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#0D121D] border-[#1E2638] text-slate-400'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoPoll ? 'animate-pulse text-emerald-400' : ''}`} />
              <span>{autoPoll ? 'Live Polling: 3s' : 'Polling: Paused'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'live') fetchLiveData();
              else fetchData();
            }}
            disabled={loading || liveLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D121D] hover:bg-[#151D2C] border border-[#1E2638] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || liveLoading) ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Live Running Tests</span>
            <span className={`w-2 h-2 rounded-full ${activeRunsCount > 0 ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`} />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {activeRunsCount}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">MT5 Worker Nodes</span>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
            {liveData?.pool?.idle_workers ?? 5} / {liveData?.pool?.total_workers ?? 5} Idle
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Total Strategies</span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{strategies.length}</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Total Executions</span>
          <div className="text-2xl font-bold text-slate-200 font-mono mt-1">{runs.length}</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#080B10] border border-[#1E2638] self-start">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              activeTab === 'live'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Live Running Tests</span>
            {activeRunsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px]">
                {activeRunsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              activeTab === 'strategies'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Registered Strategies ({strategies.length})
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
              activeTab === 'runs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Backtest Execution Runs ({runs.length})
          </button>
        </div>

        {activeTab !== 'live' && (
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'strategies'
                    ? 'Search strategies, slugs, or authors...'
                    : 'Search runs by strategy name or symbol...'
                }
                className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#080B10] border border-[#1E2638] text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {activeTab === 'runs' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded bg-[#080B10] border border-[#1E2638] text-slate-300 text-xs font-mono focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="RUNNING">Running</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: LIVE RUNNING TESTS MONITOR                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Active In-Flight Tests */}
          <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2638]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Active Backtest Simulations In-Flight ({activeRunsCount})
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Last checked: {liveData?.timestamp ? new Date(liveData.timestamp).toLocaleTimeString() : 'Live'}
              </span>
            </div>

            {activeRunsCount === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200 font-mono">
                  Worker Fleet Standing By — Zero Tests In-Flight
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  All 5 MetaTrader 5 portable worker nodes are online and ready to execute simulations dispatched from the Quant Lab or Studio.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveData?.active_runs?.map((run) => (
                  <div
                    key={run.id}
                    className="p-4 rounded-lg bg-[#080B10] border border-cyan-500/30 space-y-3 relative overflow-hidden animate-in fade-in"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 animate-pulse" />

                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div>
                        <span className="text-sm font-bold text-slate-100">{run.strategy_name}</span>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                          <span className="text-cyan-400 font-bold">{run.symbol}</span>
                          <span>•</span>
                          <span>{run.timeframe}</span>
                          <span>•</span>
                          <span>Cap: ${run.initial_capital?.toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        RUNNING
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Simulation Progress: Tick Replay Engine</span>
                        <span className="text-cyan-300 animate-pulse">Processing...</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#162030] overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-[pulse_1.5s_infinite] w-2/3" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-[#1E2638] pt-2">
                      <span>User: <strong className="text-slate-400">{run.author_email || 'Quant User'}</strong></span>
                      <span>Job: <code className="text-slate-400">{run.id.slice(0, 12)}...</code></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MT5 Worker Pool Node Telemetry */}
          <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2638]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  MetaTrader 5 Native Worker Cluster (5 Isolated Portable Nodes)
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                100% Operational
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(liveData?.pool?.workers ?? [1, 2, 3, 4, 5].map((i) => ({
                worker_id: i,
                is_installed: true,
                is_busy: false,
                current_job_id: null,
                completed_jobs_count: 0,
              }))).map((w: any) => {
                const isBusy = w.is_busy;
                return (
                  <div
                    key={w.worker_id}
                    className={`p-3.5 rounded-lg border font-mono transition-all ${
                      isBusy
                        ? 'bg-cyan-950/20 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                        : 'bg-[#080B10] border-[#1E2638]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200">Node #{w.worker_id}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                          isBusy
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isBusy ? 'ACTIVE' : 'READY'}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-400">
                      <div>Engine: <span className="text-slate-300">MT5 x64</span></div>
                      <div>Mode: <span className="text-slate-300">/portable</span></div>
                      <div>Completed: <span className="text-slate-300 font-bold">{w.completed_jobs_count ?? 0}</span></div>
                      <div className="truncate text-[10px] text-slate-500 pt-1 border-t border-[#1E2638]">
                        {isBusy ? `Job: ${w.current_job_id}` : 'Standing by'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Completed Backtest Stream */}
          <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Recent Backtest Completions
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('runs')}
                className="text-xs text-cyan-400 hover:underline font-mono cursor-pointer"
              >
                View Full Execution Ledger →
              </button>
            </div>

            <div className="divide-y divide-[#1E2638]">
              {(liveData?.recent_runs ?? []).slice(0, 4).map((r) => {
                const isSuccess = r.status?.toUpperCase() === 'COMPLETED';
                const pnl = r.final_equity - r.initial_capital;
                return (
                  <div key={r.id} className="py-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSuccess ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <div>
                        <span className="font-semibold text-slate-200">{r.strategy_name}</span>
                        <span className="text-slate-500 ml-2">
                          {r.symbol} {r.timeframe}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={pnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {pnl >= 0 ? `+$${pnl.toLocaleString()}` : `-$${Math.abs(pnl).toLocaleString()}`}
                      </span>
                      <span className="text-slate-400">{r.execution_time_ms ? `${(r.execution_time_ms / 1000).toFixed(1)}s` : '< 1s'}</span>
                      <span className="text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: REGISTERED STRATEGIES                                  */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'strategies' && (
        <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-[#1E2638] bg-[#080B10] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Strategy Details</th>
                  <th className="py-3 px-4">Language / Engine</th>
                  <th className="py-3 px-4">Author</th>
                  <th className="py-3 px-4 text-center">Backtest Executions</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Identifier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2638]">
                {filteredStrategies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                      No strategies found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredStrategies.map((strat) => (
                    <tr key={strat.id} className="hover:bg-[#121826] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-[#162032] border border-[#202E48] flex items-center justify-center text-cyan-400">
                            <FileCode className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{strat.name}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{strat.description}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {strat.language?.toUpperCase() || 'MQL5'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {strat.author_name || strat.author_email || 'System'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-center">
                        <span className="px-2 py-0.5 rounded text-xs bg-[#080B10] border border-[#1E2638] text-slate-300">
                          {strat.run_count} runs
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {strat.created_at ? new Date(strat.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        <code>{strat.slug}</code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: HISTORICAL BACKTEST EXECUTION RUNS                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'runs' && (
        <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-[#1E2638] bg-[#080B10] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Strategy & Symbol</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Initial Capital</th>
                  <th className="py-3 px-4 text-right">Final Equity</th>
                  <th className="py-3 px-4 text-center">Win Rate</th>
                  <th className="py-3 px-4 text-center">Profit Factor</th>
                  <th className="py-3 px-4 text-center">Max Drawdown</th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th className="py-3 px-4">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2638]">
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 font-mono">
                      No backtest execution records found.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => {
                    const isSuccess = run.status?.toUpperCase() === 'COMPLETED';
                    const isFailed = run.status?.toUpperCase() === 'FAILED';
                    const netProfit = run.final_equity - run.initial_capital;

                    return (
                      <tr key={run.id} className="hover:bg-[#121826] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{run.strategy_name}</div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-0.5">
                            <span className="text-cyan-400 font-bold">{run.symbol}</span>
                            <span>•</span>
                            <span>{run.timeframe}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                              isSuccess
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : isFailed
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                          ${run.initial_capital?.toLocaleString() || '100,000'}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono">
                          <span className={netProfit >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            ${run.final_equity?.toLocaleString() || run.initial_capital?.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-200">
                          {run.win_rate ? `${(run.win_rate * 100).toFixed(1)}%` : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-200">
                          {run.profit_factor ? run.profit_factor.toFixed(2) : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-rose-300">
                          {run.max_drawdown_pct ? `${run.max_drawdown_pct.toFixed(2)}%` : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                          {run.execution_time_ms ? `${(run.execution_time_ms / 1000).toFixed(1)}s` : '< 1s'}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {run.created_at ? new Date(run.created_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
