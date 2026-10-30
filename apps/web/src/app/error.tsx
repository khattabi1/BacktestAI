'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertOctagon,
  RefreshCw,
  Home,
  LifeBuoy,
  Terminal,
} from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for internal telemetry
    console.error('BacktestAI Kernel Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col justify-between font-sans selection:bg-cyan-accent/25 selection:text-cyan-accent">
      <header className="border-b border-[#202A38] bg-[#080B10]/85 backdrop-blur-md px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#111722] border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shadow-hud">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-slate-100">
            BACKTEST<span className="text-cyan-accent">AI</span>
          </span>
        </Link>
        <span className="text-xs font-mono text-slate-500">
          HTTP STATUS · 500 EXECUTION FAULT
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1316] border border-red-500/30 text-[11px] font-mono text-red-400">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>KERNEL ANOMALY · INVARIANT EXCEPTION</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-7xl sm:text-9xl font-extrabold font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-slate-100 via-slate-400 to-slate-800">
              500
            </h1>
            <p className="text-lg sm:text-xl font-bold text-slate-200">
              Simulation Execution Interrupted
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            An unhandled runtime exception occurred within the client execution framework. State integrity has been preserved to avoid data corruption.
          </p>

          <div className="max-w-xl mx-auto rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 text-left font-mono text-xs text-slate-400 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1A2332] pb-2 text-[11px] text-slate-500">
              <span>stack_trace.log</span>
              {error.digest && <span>Digest: {error.digest}</span>}
            </div>
            <div className="text-red-400 break-all text-[11px]">
              {error.message || 'Unknown kernel runtime anomaly encountered.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => reset()}
              className="px-5 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Execution</span>
            </button>

            <Link
              href="/"
              className="px-5 py-3 rounded-xl bg-[#111722] hover:bg-[#161F2E] border border-[#202A38] text-slate-200 font-mono text-xs font-semibold transition-all flex items-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>

            <Link
              href="/support"
              className="px-5 py-3 rounded-xl bg-[#0D1118] hover:bg-[#151C27] border border-[#202A38] text-slate-400 hover:text-slate-200 font-mono text-xs transition-all flex items-center gap-2"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Report to Support Desk</span>
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-[#202A38] py-6 text-center text-xs font-mono text-slate-500">
        <span>&copy; 2026 Backtest AI Inc. Deterministic Simulation & Quantitative Strategy Synthesis.</span>
      </footer>
    </div>
  );
}
