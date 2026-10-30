'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Terminal,
  Bug,
  Server,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface IncidentReport {
  id: string;
  type: 'EXECUTION_FAILURE' | 'USER_REPORT' | 'SYSTEM_ERROR';
  title: string;
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  user_email: string;
  error_trace?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  created_at: string;
}

export default function AdminReportsPage() {
  const { token } = useAuthStore();
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'INVESTIGATING' | 'RESOLVED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/reports', { headers, credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load incidents`);
      }
      const data: IncidentReport[] = await res.json();
      setIncidents(data);
    } catch (err: any) {
      console.error('Failed to load incident reports:', err);
      setError('Could not retrieve incident reports. Ensure the API server is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const handleStatusChange = async (reportId: string, newStatus: 'OPEN' | 'INVESTIGATING' | 'RESOLVED') => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/reports/${reportId}/status`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update status: HTTP ${res.status}`);
      }

      setIncidents((prev) =>
        prev.map((inc) => (inc.id === reportId ? { ...inc, status: newStatus } : inc))
      );

      setNotification(`Incident ${reportId} marked as ${newStatus}.`);
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      alert(`Error updating incident status: ${err.message}`);
    }
  };

  // Filter calculations
  const filtered = incidents.filter((inc) => {
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = inc.title?.toLowerCase().includes(q);
      const matchEmail = inc.user_email?.toLowerCase().includes(q);
      const matchError = inc.error_trace?.toLowerCase().includes(q);
      const matchId = inc.id?.toLowerCase().includes(q);
      if (!matchTitle && !matchEmail && !matchError && !matchId) return false;
    }
    return true;
  });

  const totalCount = incidents.length;
  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const investigatingCount = incidents.filter((i) => i.status === 'INVESTIGATING').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const categories = Array.from(new Set(incidents.map((i) => i.category).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0F172A] border border-cyan-500/40 text-cyan-300 shadow-xl shadow-cyan-950/40 text-sm font-mono animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2638]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>BacktestAI</span>
            <span>/</span>
            <span>Admin</span>
            <span>/</span>
            <span className="text-slate-300">Bugs & Reports Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <span>Platform Failures & Bug Registry</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time tracking of MT5 terminal execution errors, compiler faults, and system incident logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D121D] hover:bg-[#151D2C] border border-[#1E2638] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Total Incidents</span>
            <Bug className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1.5">{totalCount}</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-400 uppercase tracking-wider font-mono">Open / Unresolved</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1.5">{openCount}</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 uppercase tracking-wider font-mono">Investigating</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1.5">{investigatingCount}</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400 uppercase tracking-wider font-mono">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1.5">{resolvedCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3.5 rounded-lg bg-[#0D121D] border border-[#1E2638] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, error message, user email or incident ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#080B10] border border-[#1E2638] text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status Tabs */}
          {(['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-[#080B10] text-slate-400 border border-[#1E2638] hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 rounded bg-[#080B10] border border-[#1E2638] text-slate-300 text-xs font-mono focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Incident List */}
      <div className="rounded-lg bg-[#0D121D] border border-[#1E2638] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-mono flex flex-col items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Querying platform failure registry...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-400 text-sm font-mono flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm font-mono flex flex-col items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-1" />
            <span className="text-slate-200 font-semibold">Zero Failures Recorded</span>
            <span className="text-xs text-slate-500">
              All MT5 worker nodes, compilation tasks, and backtest pipelines are running without errors.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[#1E2638]">
            {filtered.map((inc) => {
              const isExpanded = expandedId === inc.id;

              const severityBadge =
                inc.severity === 'Critical'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : inc.severity === 'High'
                  ? 'bg-rose-950/60 text-rose-400 border-rose-800/40'
                  : inc.severity === 'Medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700';

              const statusBadge =
                inc.status === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : inc.status === 'INVESTIGATING'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40';

              return (
                <div key={inc.id} className="p-4 hover:bg-[#121826] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                        className="p-1 rounded hover:bg-[#1C2537] text-slate-400 hover:text-slate-200 transition-colors mt-0.5 cursor-pointer"
                        title={isExpanded ? 'Collapse' : 'Expand error details'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${statusBadge}`}
                          >
                            {inc.status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${severityBadge}`}
                          >
                            {inc.severity}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#080B10] text-slate-400 border border-[#1E2638]">
                            {inc.category}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(inc.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-200">{inc.title}</h3>

                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <span>User: <strong className="text-slate-300">{inc.user_email}</strong></span>
                          <span>•</span>
                          <span>Ref: <strong className="text-slate-500">{inc.id}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Status Management Actions */}
                    <div className="flex items-center gap-2 self-start lg:self-center ml-7 lg:ml-0">
                      {inc.status !== 'INVESTIGATING' && (
                        <button
                          onClick={() => handleStatusChange(inc.id, 'INVESTIGATING')}
                          className="px-2.5 py-1 rounded bg-[#080B10] hover:bg-[#162032] border border-[#1E2638] hover:border-cyan-500/40 text-cyan-300 text-xs font-mono transition-colors cursor-pointer"
                        >
                          Investigate
                        </button>
                      )}
                      {inc.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleStatusChange(inc.id, 'RESOLVED')}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                      {inc.status === 'RESOLVED' && (
                        <button
                          onClick={() => handleStatusChange(inc.id, 'OPEN')}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono transition-colors cursor-pointer"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Stack Trace / Description */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 p-3 rounded-lg bg-[#080B10] border border-[#1E2638] space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-[#1E2638] pb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Diagnostic Stack Trace / Description</span>
                        </span>
                        <span className="text-[10px] text-slate-500">System Trace Log</span>
                      </div>
                      <pre className="text-xs font-mono text-rose-300/90 whitespace-pre-wrap break-all leading-relaxed p-2 bg-[#05080F] rounded border border-[#1A2234]">
                        {inc.error_trace || 'No detailed error trace attached.'}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
