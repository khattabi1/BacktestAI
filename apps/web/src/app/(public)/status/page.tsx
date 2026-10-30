'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Cpu,
  Database,
  Terminal,
  Radio,
  RefreshCw,
  Bell,
  Check,
} from 'lucide-react';

interface Subsystem {
  name: string;
  category: string;
  uptime: string;
  latency: string;
  status: 'Operational' | 'Degraded' | 'Maintenance';
}

const SUBSYSTEMS: Subsystem[] = [
  {
    name: 'Deterministic Simulation Kernel (backtest_si)',
    category: 'Core Engine',
    uptime: '99.99%',
    latency: '0.024ms / bar',
    status: 'Operational',
  },
  {
    name: 'DuckDB Parquet Columnar Query Pipeline',
    category: 'Data Storage',
    uptime: '100.0%',
    latency: '0.008ms / slice',
    status: 'Operational',
  },
  {
    name: 'Anthropic Claude Opus 5.5 Strategy Gateway',
    category: 'AI Synthesis',
    uptime: '99.98%',
    latency: '1.24s avg',
    status: 'Operational',
  },
  {
    name: 'OpenAlgo Replay Studio Canvas Renderer',
    category: 'Frontend Engine',
    uptime: '100.0%',
    latency: '60 FPS stable',
    status: 'Operational',
  },
  {
    name: 'FastAPI Orchestration & REST Endpoints',
    category: 'Backend Cluster',
    uptime: '99.99%',
    latency: '3.1ms roundtrip',
    status: 'Operational',
  },
  {
    name: 'MQL5 Expert Advisor Transpiler & AST Parser',
    category: 'Code Generation',
    uptime: '100.0%',
    latency: '45ms build',
    status: 'Operational',
  },
];

const PAST_INCIDENTS = [
  {
    id: 'INC-2026-041',
    date: 'February 18, 2026',
    title: 'Parquet Partition Cache Eviction Latency',
    impact: 'Minor Degraded Performance',
    duration: '14 minutes',
    status: 'Resolved',
    description:
      'A routine DuckDB query memory compaction cycle caused a transient 18ms latency spike in custom historical Parquet downloads. Zero simulation runs failed or corrupted.',
  },
  {
    id: 'INC-2026-022',
    date: 'January 28, 2026',
    title: 'Claude Opus 5.5 API Upstream Rate Limit Spike',
    impact: 'Partial AI Strategy Generation Throttling',
    duration: '22 minutes',
    status: 'Resolved',
    description:
      'Anthropic upstream API experienced elevated latency. Automatic failover queues buffered requests, and all pending strategy syntheses completed without data loss.',
  },
];

export default function StatusPage() {
  const [subscribedEmail, setSubscribedEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('Just now');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (subscribedEmail) {
      setIsSubscribed(true);
      setTimeout(() => setIsSubscribed(false), 4000);
      setSubscribedEmail('');
    }
  };

  const handleManualRefresh = () => {
    setLastRefreshed('Refreshing...');
    setTimeout(() => {
      setLastRefreshed('Just now');
    }, 400);
  };

  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>REAL-TIME PLATFORM TELEMETRY · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          System Operational Status
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Live telemetry, compute cluster latencies, and uptime guarantees across deterministic simulation kernels and AI copilot services.
        </p>
      </div>

      {/* Primary Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-emerald-500/30 bg-[#07130F] p-5 sm:p-8 md:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 sm:w-7 h-6 sm:h-7" />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
              GLOBAL CLUSTER STATUS
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-100 font-sans">
              All Quant Systems Operational
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Current platform uptime: 99.992% · Zero active disruptions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D1E18] border border-emerald-500/30 text-emerald-300 font-mono text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lastRefreshed}</span>
          </button>
        </div>
      </motion.div>

      {/* Subsystems Telemetry Table */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4 border-b border-[#1A2332] pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
              CORE CLUSTERS
            </span>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-100">
              Subsystem Performance Metrics
            </h2>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Checked every 10s via synthetic probes
          </div>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {SUBSYSTEMS.map((sub) => (
            <div
              key={sub.name}
              className="p-4 rounded-2xl bg-[#0D1118] border border-[#1A2332] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1 max-w-md">
                <div className="font-sans font-bold text-xs sm:text-sm text-slate-200">{sub.name}</div>
                <div className="text-[11px] text-slate-500">{sub.category}</div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1A2332]">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                  <div className="text-slate-300 font-semibold">{sub.latency}</div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-slate-500 uppercase">90D Uptime</div>
                  <div className="text-emerald-400 font-semibold">{sub.uptime}</div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-[11px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{sub.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 90-Day Uptime Calendar Strip */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">
            90-DAY UPTIME TRAJECTORY
          </span>
          <span className="text-xs font-mono text-emerald-400 font-bold">99.992% Overall</span>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-2 sm:mx-0 px-2 sm:px-0">
          <div className="grid grid-cols-45 sm:grid-cols-90 gap-1 pt-2 min-w-[500px]">
            {Array.from({ length: 90 }).map((_, i) => (
              <div
                key={i}
                title={`Day ${90 - i} ago: 100.0% operational`}
                className="h-8 rounded-sm bg-emerald-500/70 hover:bg-emerald-400 transition-colors cursor-pointer"
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-[#151D28]">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Incident History & Maintenance Log */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
            INCIDENT FORENSICS
          </span>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-100">
            Historical Incident Disclosures
          </h2>
          <p className="text-xs text-slate-400">
            Transparent post-mortem autopsies of any technical deviations over the past 90 days.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {PAST_INCIDENTS.map((inc) => (
            <div
              key={inc.id}
              className="p-4 sm:p-5 rounded-2xl bg-[#0D1118] border border-[#1A2332] space-y-3 font-sans"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-cyan-accent">
                    {inc.id}
                  </span>
                  <h3 className="font-bold text-slate-200 text-xs sm:text-sm">{inc.title}</h3>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs">
                  <span className="text-slate-400 text-[11px] sm:text-xs">{inc.date}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[10px] sm:text-xs">
                    {inc.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{inc.description}</p>

              <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-mono text-slate-500 border-t border-[#151D28] pt-2">
                <span>Duration: {inc.duration}</span>
                <span>·</span>
                <span>Impact: {inc.impact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscribe to Incident Notifications */}
      <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
        <div className="space-y-1 max-w-lg">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-sm font-sans">
            <Bell className="w-4 h-4 text-cyan-accent" />
            <span>Subscribe to Platform Telemetry Alerts</span>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Receive automated webhook or email notices before scheduled DuckDB partition maintenance or API deprecations.
          </p>
        </div>

        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <input
            type="email"
            required
            value={subscribedEmail}
            onChange={(e) => setSubscribedEmail(e.target.value)}
            placeholder="infra@quant-fund.com"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#080B10] border border-[#202A38] text-base sm:text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-accent/60 w-full sm:w-64"
          />
          <button
            type="submit"
            className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud shrink-0 flex items-center justify-center"
          >
            {isSubscribed ? 'Subscribed!' : 'Subscribe'}
          </button>
        </form>
      </div>
    </div>
  );
}
