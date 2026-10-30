'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Terminal,
  Activity,
  Compass,
  FileQuestion,
  Home,
} from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col justify-between font-sans selection:bg-cyan-accent/25 selection:text-cyan-accent">
      {/* Top Bar */}
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
          HTTP STATUS · 404 NOT FOUND
        </span>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Diagnostic Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1316] border border-red-500/30 text-[11px] font-mono text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>LOOK-AHEAD HORIZON EXCEEDED · SIGNAL NOT FOUND</span>
          </div>

          {/* Big Code */}
          <div className="space-y-2">
            <h1 className="text-7xl sm:text-9xl font-extrabold font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-slate-100 via-slate-400 to-slate-800">
              404
            </h1>
            <p className="text-lg sm:text-xl font-bold text-slate-200">
              Requested Quantitative Partition Does Not Exist
            </p>
          </div>

          {/* Institutional Explanation */}
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            The target route cannot be resolved in the current deterministic event loop. The candle bar at index <code className="text-cyan-accent font-mono">t = 404</code> is out of historical bounds or has been dereferenced.
          </p>

          {/* Synthetic Terminal Frame */}
          <div className="max-w-lg mx-auto rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 text-left font-mono text-xs text-slate-400 space-y-2 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#1A2332] pb-2 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              <span className="ml-2">kernel_autopsy.log</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div><span className="text-red-400">ERROR:</span> InvariantCheckFailedException: RouteOutOfRange</div>
              <div className="text-slate-500">  at BacktestEngine.resolve_route(path=&apos;...&apos;)</div>
              <div><span className="text-cyan-accent">STATUS:</span> Causal enforcement preserved. 0.000% lookahead maintained.</div>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/app/backtest"
              className="px-5 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center gap-2"
            >
              <span>Launch Replay Studio</span>
            </Link>

            <Link
              href="/app"
              className="px-5 py-3 rounded-xl bg-[#111722] hover:bg-[#161F2E] border border-[#202A38] text-slate-200 font-mono text-xs font-semibold transition-all flex items-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <Link
              href="/docs"
              className="px-5 py-3 rounded-xl bg-[#0D1118] hover:bg-[#151C27] border border-[#202A38] text-slate-400 hover:text-slate-200 font-mono text-xs transition-all flex items-center gap-2"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Docs</span>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#202A38] py-6 text-center text-xs font-mono text-slate-500">
        <span>&copy; 2026 Backtest AI Inc. Deterministic Simulation & Quantitative Strategy Synthesis.</span>
      </footer>
    </div>
  );
}
