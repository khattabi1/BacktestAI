'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Wrench,
  Clock,
  Database,
  Cpu,
  Activity,
  ArrowRight,
  LifeBuoy,
  CheckCircle2,
} from 'lucide-react';

const TASKS = [
  {
    title: 'DuckDB Columnar Partition Re-Indexing',
    desc: 'Optimizing bloom filters and dictionary encodings across multi-gigabyte tick historical Parquet archives.',
    status: 'In Progress (84%)',
    icon: Database,
  },
  {
    title: 'Claude Opus 5.5 Strategy AST Cache Warming',
    desc: 'Pre-caching quantitative grammar definitions and MQL5 syntax trees for sub-second co-pilot responses.',
    status: 'Completed',
    icon: Cpu,
  },
  {
    title: 'Intrabar High-Resolution Simulation Buffer Scaling',
    desc: 'Calibrating multi-threaded worker pools for parallelized walk-forward windows and Monte Carlo runs.',
    status: 'In Progress (62%)',
    icon: Activity,
  },
];

export default function MaintenancePage() {
  // Simulated countdown timer (1h 14m 22s)
  const [secondsRemaining, setSecondsRemaining] = useState(4462);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="py-20 md:py-28 max-w-4xl mx-auto px-6 text-center space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1812] border border-amber-500/30 text-[11px] font-mono text-amber-400">
          <Wrench className="w-3.5 h-3.5 animate-spin" />
          <span>SCHEDULED INFRASTRUCTURE UPGRADE IN PROGRESS</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-100 font-sans">
            Calibrating Platform Kernels
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            BacktestAI is undergoing planned architectural optimizations to enhance simulation speeds and expand DuckDB historical data throughput.
          </p>
        </div>

        {/* Live Countdown Clock */}
        <div className="max-w-md mx-auto rounded-3xl border border-[#202A38] bg-[#0A0E15] p-6 shadow-2xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold flex items-center justify-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-accent" />
            <span>ESTIMATED RETURN TO SERVICE</span>
          </div>
          <div className="font-mono text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent via-slate-100 to-emerald-400 tracking-wider">
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Estimated completion: Today at 18:30 UTC
          </p>
        </div>

        {/* Calibration Checklist */}
        <div className="max-w-2xl mx-auto rounded-2xl border border-[#202A38] bg-[#0A0E15] p-6 md:p-8 text-left space-y-4 shadow-xl">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
            ACTIVE UPGRADE PROCEDURES
          </div>

          <div className="space-y-3 font-sans">
            {TASKS.map((t) => {
              const Icon = t.icon;
              const isDone = t.status === 'Completed';
              return (
                <div
                  key={t.title}
                  className="p-4 rounded-xl bg-[#0D1118] border border-[#1A2332] flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-sm text-slate-200">{t.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation / Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/status"
            className="px-5 py-3 rounded-xl bg-[#111722] hover:bg-[#161F2E] border border-cyan-accent/30 text-cyan-accent font-mono text-xs font-semibold transition-all flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Check Live Cluster Status</span>
          </Link>

          <Link
            href="/support"
            className="px-5 py-3 rounded-xl bg-[#0D1118] hover:bg-[#151C27] border border-[#202A38] text-slate-400 hover:text-slate-200 font-mono text-xs transition-all flex items-center gap-2"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Contact Quant Desk</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
