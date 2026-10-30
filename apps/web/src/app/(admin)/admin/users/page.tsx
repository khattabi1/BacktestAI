'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  X,
  UserCheck,
  UserPlus,
  TrendingUp,
  Cpu,
  Zap,
  BarChart2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RealDbUser {
  id: string;
  email: string;
  full_name: string;
  tier: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  tokens_used?: number;
  strategy_count?: number;
  backtest_count?: number;
  last_login?: string | null;
}

interface AnalyticsSummary {
  total_users: number;
  daily_active_users: number;
  new_registered: number;
  account_upgrades: number;
  total_token_consumption: number;
  all_time_token_consumption: number;
  tier_breakdown: Record<string, number>;
}

interface ChartPoint {
  date: string;
  full_date: string;
  new_users: number;
  active_users: number;
  upgrades: number;
  tokens: number;
}

interface PendingAction {
  user: RealDbUser;
  type: 'ROLE' | 'TIER' | 'STATUS';
  newRole?: string;
  newTier?: string;
  newStatus?: boolean;
}

export default function AdminUsersPage() {
  const { token, user: currentAdmin } = useAuthStore();
  const [users, setUsers] = useState<RealDbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  // Timeframe and Analytics State
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<'activity' | 'tokens' | 'upgrades'>('activity');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Admin Password Protection State
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/users', { headers, credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to load users: HTTP ${res.status}`);
      }
      const data: RealDbUser[] = await res.json();
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Unable to load users. Please verify API server status.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/users/analytics?timeframe=${timeframe}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load analytics: HTTP ${res.status}`);
      }
      const data = await res.json();
      setAnalytics(data.summary || null);
      setChartData(data.chart_data || []);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  useEffect(() => {
    fetchAnalytics();
  }, [token, timeframe]);

  // Initiate confirmation modal when changing status
  const requestToggleStatus = (targetUser: RealDbUser) => {
    setModalError(null);
    setAdminPassword('');
    setPendingAction({
      user: targetUser,
      type: 'STATUS',
      newStatus: targetUser.is_active !== 1,
    });
  };

  // Initiate confirmation modal when changing role
  const requestRoleChange = (targetUser: RealDbUser, newRole: string) => {
    if (targetUser.role?.toLowerCase() === newRole.toLowerCase()) return;
    setModalError(null);
    setAdminPassword('');
    setPendingAction({
      user: targetUser,
      type: 'ROLE',
      newRole,
    });
  };

  // Initiate confirmation modal when changing tier
  const requestTierChange = (targetUser: RealDbUser, newTier: string) => {
    if (targetUser.tier?.toLowerCase() === newTier.toLowerCase()) return;
    setModalError(null);
    setAdminPassword('');
    setPendingAction({
      user: targetUser,
      type: 'TIER',
      newTier,
    });
  };

  // Submit authorized changes with password verification
  const handleAuthorizeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction || !adminPassword.trim()) {
      setModalError('Please enter your administrator password.');
      return;
    }

    setSubmittingPassword(true);
    setModalError(null);

    const targetUser = pendingAction.user;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (pendingAction.type === 'STATUS') {
        const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(targetUser.id)}/status`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            is_active: pendingAction.newStatus,
            admin_password: adminPassword.trim(),
            admin_email: currentAdmin?.email || 'khattabim116@gmail.com',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Authorization failed: Invalid administrator password.');
        }

        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: pendingAction.newStatus ? 1 : 0 } : u))
        );
        setNotification(`User ${targetUser.email} status updated to ${pendingAction.newStatus ? 'Active' : 'Suspended'}.`);
      } else {
        const payload: Record<string, any> = {
          admin_password: adminPassword.trim(),
          admin_email: currentAdmin?.email || 'khattabim116@gmail.com',
        };

        if (pendingAction.type === 'ROLE') payload.role = pendingAction.newRole;
        if (pendingAction.type === 'TIER') payload.tier = pendingAction.newTier;

        const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(targetUser.id)}`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Authorization failed: Invalid administrator password.');
        }

        const resData = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? {
                  ...u,
                  role: resData.role ?? u.role,
                  tier: resData.tier ?? u.tier,
                }
              : u
          )
        );

        setNotification(`Updated ${targetUser.email}: Role = ${resData.role}, Tier = ${resData.tier}`);
        // Re-fetch analytics to reflect tier upgrades
        fetchAnalytics();
      }

      setPendingAction(null);
      setAdminPassword('');
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      console.error('Action failed:', err);
      setModalError(err.message || 'Authorization failed. Please check administrator password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.id?.toLowerCase().includes(search.toLowerCase());
    const matchesTier =
      tierFilter === 'ALL' || u.tier?.toLowerCase() === tierFilter.toLowerCase();
    return matchesSearch && matchesTier;
  });

  // Chart Rendering Geometry
  const chartHeight = 160;
  const chartWidth = 640;
  const paddingX = 40;
  const paddingY = 25;
  const effectiveW = chartWidth - paddingX * 2;
  const effectiveH = chartHeight - paddingY * 2;

  const { maxVal, points } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { maxVal: 1, points: [] };
    }

    let maxV = 1;
    if (chartMetric === 'tokens') {
      maxV = Math.max(...chartData.map((d) => d.tokens), 50);
    } else if (chartMetric === 'upgrades') {
      maxV = Math.max(...chartData.map((d) => d.upgrades), 4);
    } else {
      maxV = Math.max(...chartData.map((d) => Math.max(d.active_users, d.new_users)), 4);
    }

    const n = chartData.length;
    const pts = chartData.map((d, i) => {
      const x = paddingX + (n > 1 ? (i / (n - 1)) * effectiveW : effectiveW / 2);
      let yActive = paddingY + effectiveH;
      let yNew = paddingY + effectiveH;
      let yVal = paddingY + effectiveH;

      if (chartMetric === 'tokens') {
        yVal = paddingY + effectiveH - (d.tokens / maxV) * effectiveH;
      } else if (chartMetric === 'upgrades') {
        yVal = paddingY + effectiveH - (d.upgrades / maxV) * effectiveH;
      } else {
        yActive = paddingY + effectiveH - (d.active_users / maxV) * effectiveH;
        yNew = paddingY + effectiveH - (d.new_users / maxV) * effectiveH;
      }

      return {
        x,
        yVal,
        yActive,
        yNew,
        data: d,
      };
    });

    return { maxVal: maxV, points: pts };
  }, [chartData, chartMetric, effectiveW, effectiveH]);

  const activePathD = useMemo(() => {
    if (points.length === 0) return '';
    if (chartMetric === 'activity') {
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yActive.toFixed(1)}`).join(' ');
    }
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yVal.toFixed(1)}`).join(' ');
  }, [points, chartMetric]);

  const newUsersPathD = useMemo(() => {
    if (points.length === 0 || chartMetric !== 'activity') return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yNew.toFixed(1)}`).join(' ');
  }, [points, chartMetric]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const baseY = paddingY + effectiveH;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    if (chartMetric === 'activity') {
      const lineD = points.map((p) => `L ${p.x.toFixed(1)} ${p.yActive.toFixed(1)}`).join(' ');
      return `M ${startX.toFixed(1)} ${baseY} ${lineD} L ${endX.toFixed(1)} ${baseY} Z`;
    }
    const lineD = points.map((p) => `L ${p.x.toFixed(1)} ${p.yVal.toFixed(1)}`).join(' ');
    return `M ${startX.toFixed(1)} ${baseY} ${lineD} L ${endX.toFixed(1)} ${baseY} Z`;
  }, [points, chartMetric, effectiveH]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0F172A] border border-cyan-500/40 text-cyan-300 shadow-xl shadow-cyan-950/40 text-sm font-mono animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header & Timeframe Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1E2638]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>BacktestAI</span>
            <span>/</span>
            <span className="text-slate-300">User Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>User Directory & Platform Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live telemetry of active quant researchers, account tiers, registration velocity, and AI token consumption.
          </p>
        </div>

        {/* Global Timeframe Selector Pills */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center bg-[#090D15] p-1 rounded-lg border border-[#1E2638]">
            {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#111722]'
                }`}
              >
                {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              fetchUsers();
              fetchAnalytics();
            }}
            disabled={loading || analyticsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D121D] hover:bg-[#182030] text-xs font-medium text-slate-200 border border-[#1E2638] transition-colors cursor-pointer"
            title="Refresh database state"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading || analyticsLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4 PRIMARY STATISTIC KPI CARDS                                */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Daily Active Users (DAU) */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-cyan-500/30 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Active Users</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {analyticsLoading ? '...' : analytics?.daily_active_users ?? 0}
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              of {analytics?.total_users ?? users.length} total
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online & active within {timeframe}</span>
          </div>
        </div>

        {/* 2. New Registered Users */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-cyan-500/30 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">New Registered</span>
            <div className="w-7 h-7 rounded-lg bg-blue-950/40 border border-blue-800/60 flex items-center justify-center text-blue-400">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {analyticsLoading ? '...' : analytics?.new_registered ?? 0}
            </span>
            <span className="text-[11px] font-mono text-blue-400">New signups</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            Enrolled accounts in timeframe
          </div>
        </div>

        {/* 3. Account Upgrades */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-cyan-500/30 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Account Upgrades</span>
            <div className="w-7 h-7 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100">
              {analyticsLoading ? '...' : analytics?.account_upgrades ?? 0}
            </span>
            <span className="text-[11px] font-mono text-amber-400">Tier elevations</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            Free → Pro → Enterprise transitions
          </div>
        </div>

        {/* 4. Token Consumption */}
        <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] hover:border-cyan-500/30 transition-all group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Token Consumption</span>
            <div className="w-7 h-7 rounded-lg bg-purple-950/40 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {analyticsLoading
                ? '...'
                : (analytics?.total_token_consumption ?? 0).toLocaleString()}
            </span>
            <span className="text-[11px] font-mono text-slate-400">LLM tokens</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500">
            Agent & copilot model compute
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REAL-TIME TREND CHART WITH METRIC TABS                        */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 rounded-xl bg-[#0D121D] border border-[#1E2638] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#162030]">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Platform Dynamics & Time-Series Telemetry
            </h2>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-[#090D15] p-1 rounded-lg border border-[#162030]">
            <button
              type="button"
              onClick={() => setChartMetric('activity')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                chartMetric === 'activity'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activity & Signups
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('tokens')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                chartMetric === 'tokens'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Token Consumption
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('upgrades')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                chartMetric === 'upgrades'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Account Upgrades
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <div className="flex items-center gap-4">
            {chartMetric === 'activity' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Active Users</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>New Signups</span>
                </div>
              </>
            ) : chartMetric === 'tokens' ? (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Daily Token Usage</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Tier Upgrades</span>
              </div>
            )}
          </div>

          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <div className="text-cyan-300 text-xs font-mono animate-in fade-in">
              {chartData[hoveredIndex].full_date}:{' '}
              {chartMetric === 'tokens'
                ? `${chartData[hoveredIndex].tokens.toLocaleString()} tokens`
                : chartMetric === 'upgrades'
                ? `${chartData[hoveredIndex].upgrades} upgrades`
                : `${chartData[hoveredIndex].active_users} active, ${chartData[hoveredIndex].new_users} signups`}
            </div>
          )}
        </div>

        {/* SVG Chart Container */}
        <div className="relative w-full h-44 bg-[#080B10] rounded-lg border border-[#162030] overflow-hidden p-2 flex items-center justify-center">
          {analyticsLoading ? (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Fetching telemetry data...</span>
            </div>
          ) : points.length === 0 ? (
            <div className="text-xs font-mono text-slate-500">
              No historical data recorded for this timeframe.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="amberArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = paddingY + effectiveH * (1 - pct);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#162030"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingX - 6}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {Math.round(maxVal * pct)}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient Fill */}
              <path
                d={areaD}
                fill={
                  chartMetric === 'tokens'
                    ? 'url(#cyanArea)'
                    : chartMetric === 'upgrades'
                    ? 'url(#amberArea)'
                    : 'url(#cyanArea)'
                }
              />

              {/* Activity Metric: New Users Line */}
              {chartMetric === 'activity' && (
                <path
                  d={newUsersPathD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Main Metric Line */}
              <path
                d={activePathD}
                fill="none"
                stroke={
                  chartMetric === 'tokens'
                    ? '#06b6d4'
                    : chartMetric === 'upgrades'
                    ? '#f59e0b'
                    : '#06b6d4'
                }
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Point Circles and Hover Hotspots */}
              {points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const yTarget =
                  chartMetric === 'activity' ? p.yActive : p.yVal;

                return (
                  <g key={i}>
                    {/* Circle marker */}
                    <circle
                      cx={p.x}
                      cy={yTarget}
                      r={isHovered ? 5 : 3.5}
                      fill="#080B10"
                      stroke={
                        chartMetric === 'upgrades'
                          ? '#f59e0b'
                          : '#06b6d4'
                      }
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all"
                    />

                    {/* Secondary circle marker for new users in activity view */}
                    {chartMetric === 'activity' && (
                      <circle
                        cx={p.x}
                        cy={p.yNew}
                        r={isHovered ? 4.5 : 3}
                        fill="#080B10"
                        stroke="#10b981"
                        strokeWidth={isHovered ? 2 : 1.5}
                      />
                    )}

                    {/* X-axis date label */}
                    <text
                      x={p.x}
                      y={chartHeight - 8}
                      fill={isHovered ? '#38bdf8' : '#64748b'}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {p.data.date}
                    </text>

                    {/* Transparent hover capture column */}
                    <rect
                      x={p.x - effectiveW / (points.length * 2)}
                      y={0}
                      width={effectiveW / points.length}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FILTERS AND SEARCH BAR                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3.5 rounded-xl bg-[#0D121D] border border-[#1E2638] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or user ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#080B10] border border-[#1E2638] text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Total in view: <strong className="text-slate-200">{filteredUsers.length}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 uppercase font-mono text-[10px]">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#080B10] border border-[#1E2638] text-slate-300 text-xs font-mono focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="ALL">All Tiers</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* USERS TABLE WITH PER-USER TOKEN CONSUMPTION                   */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl bg-[#0D121D] border border-[#1E2638] overflow-hidden shadow-sm">
        {/* Mobile Users Card Stack */}
        <div className="md:hidden divide-y divide-[#1E2638] p-3 space-y-3">
          {loading && users.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xs font-mono">Loading platform accounts...</span>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-mono">
              No matching users found.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div key={u.id} className="pt-3 first:pt-0 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-slate-100 font-sans block truncate">{u.full_name}</span>
                    <span className="text-xs text-slate-400 font-mono block truncate">{u.email}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                      u.is_active === 1
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                        : 'bg-red-950/40 text-red-400 border border-red-800/60'
                    }`}
                  >
                    {u.is_active === 1 ? 'Active' : 'Suspended'}
                  </span>
                </div>

                {/* Per-User Token Consumption on Mobile */}
                <div className="bg-[#090D15] p-2.5 rounded-lg border border-[#162030] flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Token Consumption:</span>
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {(u.tokens_used ?? 0).toLocaleString()} <span className="text-slate-500 font-normal text-[10px]">tokens</span>
                  </span>
                </div>

                {/* Mobile Tier & Role Controls */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#090D15] p-2.5 rounded-lg border border-[#162030]">
                  <div>
                    <span className="text-slate-500 text-[10px] block mb-1">TIER</span>
                    <select
                      value={u.tier?.toLowerCase() || 'free'}
                      onChange={(e) => requestTierChange(u, e.target.value)}
                      className="w-full px-2 py-1 rounded bg-[#0D121D] border border-[#1E2638] text-slate-200 text-xs font-mono capitalize focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block mb-1">ROLE</span>
                    <select
                      value={u.role?.toLowerCase() || 'user'}
                      onChange={(e) => requestRoleChange(u, e.target.value)}
                      className="w-full px-2 py-1 rounded bg-[#0D121D] border border-[#1E2638] text-slate-200 text-xs font-mono lowercase focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-[#162030] flex items-center justify-between text-slate-400">
                    <span>Strategies: <strong className="text-slate-300">{u.strategy_count ?? 0} MQL5</strong></span>
                    <span>Runs: <strong className="text-slate-300">{u.backtest_count ?? 0}</strong></span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => requestToggleStatus(u)}
                    className={`w-full py-2 rounded-lg border text-xs font-mono min-h-[42px] transition-colors cursor-pointer ${
                      u.is_active === 1
                        ? 'bg-red-950/20 hover:bg-red-950/40 border-red-800/40 text-red-300'
                        : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                    }`}
                  >
                    {u.is_active === 1 ? 'Suspend Account' : 'Activate Account'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Users Table with Token Consumption Column */}
        <div className="hidden md:block overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090D15] text-slate-400 border-b border-[#162030] text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-sans">NAME & EMAIL</th>
                <th className="py-2.5 px-4">TIER</th>
                <th className="py-2.5 px-4">ROLE</th>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 px-4">TOKEN CONSUMPTION</th>
                <th className="py-2.5 px-4 text-center">MODELS</th>
                <th className="py-2.5 px-4 text-center">RUNS</th>
                <th className="py-2.5 px-4">REGISTERED</th>
                <th className="py-2.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162030]">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading platform accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const tokenCount = u.tokens_used ?? 0;
                  const tierLower = (u.tier || 'free').toLowerCase();
                  const tokenLimit =
                    tierLower === 'enterprise'
                      ? 1000000
                      : tierLower === 'pro'
                      ? 500000
                      : 50000;
                  const usagePct = Math.min(100, Math.max(3, (tokenCount / tokenLimit) * 100));

                  return (
                    <tr key={u.id} className="hover:bg-[#090D15]/60 transition-colors">
                      <td className="py-3 px-4 font-sans">
                        <span className="font-semibold text-slate-200 block">{u.full_name}</span>
                        <span className="text-xs text-slate-400 font-mono">{u.email}</span>
                      </td>

                      {/* TIER Selector (requires admin password) */}
                      <td className="py-3 px-4">
                        <select
                          value={u.tier?.toLowerCase() || 'free'}
                          onChange={(e) => requestTierChange(u, e.target.value)}
                          className="px-2 py-1 rounded bg-[#090D15] hover:bg-[#111722] border border-[#162030] hover:border-cyan-500/40 text-slate-200 capitalize text-xs font-mono transition-colors focus:outline-none cursor-pointer"
                          title="Change tier (Requires admin password)"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>

                      {/* ROLE Selector (requires admin password) */}
                      <td className="py-3 px-4">
                        <select
                          value={u.role?.toLowerCase() || 'user'}
                          onChange={(e) => requestRoleChange(u, e.target.value)}
                          className={`px-2 py-1 rounded border text-xs font-mono transition-colors focus:outline-none cursor-pointer ${
                            u.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                              : 'bg-[#090D15] hover:bg-[#111722] text-slate-300 border-[#162030] hover:border-cyan-500/40'
                          }`}
                          title="Change role (Requires admin password)"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            u.is_active === 1
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                              : 'bg-red-950/40 text-red-400 border border-red-800/60'
                          }`}
                        >
                          {u.is_active === 1 ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* PER-USER TOKEN CONSUMPTION COLUMN */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 min-w-[130px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-200 font-mono text-xs font-semibold flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>{tokenCount.toLocaleString()}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {tierLower === 'enterprise' ? 'Unlimited' : `${(tokenLimit / 1000).toFixed(0)}k cap`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#162030] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usagePct > 80
                                  ? 'bg-amber-400'
                                  : tokenCount > 0
                                  ? 'bg-cyan-400'
                                  : 'bg-slate-600'
                              }`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-300">
                        {u.strategy_count ?? 0} MQL5
                      </td>

                      <td className="py-3 px-4 text-center text-slate-300">
                        {u.backtest_count ?? 0} Runs
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {u.created_at ? u.created_at.slice(0, 10) : '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => requestToggleStatus(u)}
                          className={`text-[11px] hover:underline font-mono min-h-[32px] cursor-pointer ${
                            u.is_active === 1 ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {u.is_active === 1 ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ADMIN PASSWORD VERIFICATION MODAL                             */}
      {/* ------------------------------------------------------------- */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-xl bg-[#0D121D] border border-[#1E2638] shadow-2xl overflow-hidden font-sans">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2638]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-semibold text-slate-200">Admin Password Required</h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAuthorizeAction} className="p-4 space-y-3">
              {modalError && (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password..."
                  className="w-full px-3 py-2 rounded-lg bg-[#080B10] border border-[#1E2638] text-slate-200 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#080B10] border border-[#1E2638] text-slate-300 text-xs font-mono hover:bg-[#162032] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword || !adminPassword.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#080B10] text-xs font-bold font-mono transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingPassword ? 'Verifying...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
