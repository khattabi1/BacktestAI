'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Cpu,
  Database,
  Users,
  Layers,
  ShieldAlert,
  ArrowRight,
  Server,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface MT5WorkerInfo {
  worker_id: string;
  name: string;
  path: string;
  status: 'ONLINE' | 'STANDBY';
  engine: string;
  assigned_job?: string | null;
}

interface AdminTelemetryData {
  total_users: number;
  active_users: number;
  total_strategies: number;
  total_backtest_runs: number;
  unresolved_incidents: number;
  database_type: string;
  cluster_status: string;
  active_workers: number;
  workers: MT5WorkerInfo[];
}

export default function AdminDashboardPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<AdminTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/stats', { headers, credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load admin telemetry`);
      }
      const json: AdminTelemetryData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('[AdminDashboard] Fetch error:', err);
      setError('Unable to load cluster telemetry. Ensure the backend FastAPI engine is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* ------------------------------------------------------------- */}
      {/* HEADER                                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1E2638]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>BacktestAI</span>
            <span>/</span>
            <span className="text-slate-300">Admin Command Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Platform Operations & Fleet Telemetry</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D121D] hover:bg-[#151D2C] border border-[#1E2638] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Platform Healthy
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. PLATFORM TELEMETRY KPI METERS                              */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        {/* Total Registered Users */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Registered Accounts</span>
            </span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 pt-1">
            {loading ? '...' : data?.total_users ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block">
            {data?.active_users ?? 0} Active Researchers
          </span>
        </div>

        {/* Real MQL5 Strategies */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>MQL5 Strategies</span>
            </span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 pt-1">
            {loading ? '...' : data?.total_strategies ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Native .mq5 Verified EAs
          </span>
        </div>

        {/* Real MT5 Backtests */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backtest Simulations</span>
            </span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 pt-1">
            {loading ? '...' : data?.total_backtest_runs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Completed Executions
          </span>
        </div>

        {/* Unresolved Bugs / Reports */}
        <Link
          href="/admin/reports"
          className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-rose-500/40 transition-colors space-y-1 block group"
        >
          <span className="text-[10px] text-slate-500 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Failures & Bugs</span>
            </span>
            <span className="text-rose-400/80 group-hover:text-rose-400 text-[10px] transition-colors">
              Inspect &rarr;
            </span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-100 pt-1 group-hover:text-rose-400 transition-colors">
            {loading ? '...' : data?.unresolved_incidents ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Open Incidents / Reports
          </span>
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REAL LOCAL METATRADER 5 WORKER FLEET                      */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E2638]">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Local MetaTrader 5 Terminal Worker Fleet</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Cluster worker pool managing parallel Strategy Tester executions across local terminal instances.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#090D15] border border-[#162030] text-slate-400 self-start sm:self-center">
            Workers Pool: 5 Allocated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono text-xs">
          {(data?.workers || [1, 2, 3, 4, 5].map((i) => ({
            worker_id: `mt5_worker_0${i}`,
            name: `Terminal Node #${i}`,
            path: `mt5_workers/instance_${i}`,
            status: 'STANDBY' as const,
            engine: 'MetaTrader 5 Native x64',
          }))).map((w) => (
            <div
              key={w.worker_id}
              className="p-3.5 rounded-lg bg-[#090D15] border border-[#162030] space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{w.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${w.status === 'ONLINE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#141B28] text-slate-400 border border-[#1E2638]'
                      }`}
                  >
                    {w.status}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate" title={w.path}>
                  {w.path.split('\\').slice(-2).join('/')}
                </span>
              </div>

              <div className="pt-2 border-t border-[#141C2B] text-[10px] text-slate-400 flex items-center justify-between">
                <span>Native x64</span>
                <span className="text-cyan-400">Idle / Ready</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. QUICK NAVIGATION CARDS TO THE 3 DEDICATED SECTIONS         */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        {/* Card 1: Users */}
        <Link
          href="/admin/users"
          className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-cyan-500/40 hover:bg-[#101625] transition-all space-y-2 block group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 font-sans">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>User Directory</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Manage multi-tenant accounts, update tiers, and toggle active or suspended user states.
          </p>
        </Link>

        {/* Card 2: Strategies & Runs */}
        <Link
          href="/admin/strategies"
          className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-emerald-500/40 hover:bg-[#101625] transition-all space-y-2 block group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 font-sans">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Strategies & Runs</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Audit verified MQL5 strategy blueprints and inspect completed backtest simulation metrics.
          </p>
        </Link>

        {/* Card 3: Bugs & Reports Center */}
        <Link
          href="/admin/reports"
          className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-rose-500/40 hover:bg-[#101625] transition-all space-y-2 block group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 font-sans">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Bugs & Reports Center</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Monitor simulation crashes, compilation failures, and resolve user-submitted bug tickets.
          </p>
        </Link>
      </div>
    </div>
  );
}
