'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap,
  Lock,
  Database,
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Terminal,
  Cpu,
  Layers,
} from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const SPEC_ITEMS = [
  { label: 'Execution Core', value: 'Rust-powered Polars DataFrames' },
  { label: 'Look-Ahead Bias', value: '0.000% (Strict chronological invariant)' },
  { label: 'Latency Benchmark', value: '0.024ms / bar on 1-minute OHLCV' },
  { label: 'Data Ingestion', value: 'DuckDB columnar Parquet streaming' },
  { label: 'Memory Footprint', value: 'Zero-copy slicing (<85MB RAM for 1M bars)' },
  { label: 'Order Fill Types', value: 'Market, Limit, Stop, Trailing Stop' },
  { label: 'Slippage Models', value: 'Fixed tick, Volatility-scaled, Quadratic' },
  { label: 'Margin Engine', value: 'Mark-to-market sub-second portfolio tracking' },
];

export default function BacktestingFeaturePage() {
  return (
    <div className="py-16 md:py-24 space-y-24">
      {/* 1. Page Hero */}
      <section className="max-w-5xl mx-auto px-6 space-y-6 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-cyan-accent" />
            <span>DETERMINISTIC SIMULATION ENGINE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            Zero Look-Ahead Bias. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-emerald-400">
              Guaranteed by Invariant.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Most vector backtesters cheat by accidentally accessing future candle prices. BacktestAI enforces chronological causality down to the microsecond.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app/backtest"
              className="px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud"
            >
              Launch Replay Studio Free
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 rounded-xl bg-[#111722] hover:bg-[#151C27] border border-[#202A38] text-slate-300 font-semibold font-mono text-xs transition-all"
            >
              Read Engine Whitepaper
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 2. Three Invariant Guarantees */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-accent/10 border border-cyan-accent/20 flex items-center justify-center text-cyan-accent">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">1. Causality Lock</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Bar at index $t$ has strict access only to data $0 \dots t$. Indicator rolling windows, ATR expansions, and order triggers cannot leak future $t+1$ opens or highs.
            </p>
          </div>

          <div className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">2. Intrabar Spread Modeling</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Orders are not filled at naive midpoint prices. Buys are filled at Ask, sells at Bid, with realistic liquidity exhaustion and spread expansion during high volatility.
            </p>
          </div>

          <div className="p-7 rounded-3xl border border-[#202A38] bg-[#0A0E15] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-100">3. DuckDB Columnar Streaming</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Historical OHLCV data is loaded directly from partitioned Parquet files using zero-copy memory buffers. Execute multi-year backtests without RAM exhaustion.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Architectural Code Inspection */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
                <Terminal className="w-3.5 h-3.5 text-cyan-accent" />
                <span>CLEAN MODULAR ARCHITECTURE</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-100">
                Event-Loop Invariant in Action
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                The engine processes history chronologically. At each bar, pending orders are matched against intrabar extremes before invoking the strategy logic for the next decision.
              </p>
              <div className="space-y-2 pt-2 text-xs font-mono text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Immutable typed domain contracts (`Bar`, `Order`, `Trade`)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Sub-second mark-to-market equity curve calculation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Built-in Sharpe, Sortino, Calmar, and Expectancy formulas</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-[#202A38] bg-[#07090E] p-4 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between pb-3 border-b border-[#202A38] text-slate-400 text-[11px]">
                  <span>packages/backtest/engine.py</span>
                  <span className="text-cyan-accent">POLARS CAUSAL CORE</span>
                </div>
                <pre className="pt-3 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`# Strict chronological execution loop
for i in range(len(bars)):
    current_bar = bars[i]
    
    # 1. Match pending orders strictly against intrabar bounds
    execution_engine.process_bar(current_bar, portfolio)
    
    # 2. Update mark-to-market equity without future bias
    portfolio.update_equity(current_bar.close, current_bar.timestamp)
    
    # 3. Strategy hook: Only historical context [0..i] is accessible
    strategy.on_bar(current_bar, portfolio)`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Specifications Table */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-8 shadow-2xl space-y-6">
          <h2 className="text-2xl font-bold text-slate-100 font-sans">
            Quantitative Specifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {SPEC_ITEMS.map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl bg-[#0D1118] border border-[#202A38] flex items-center justify-between"
              >
                <span className="text-slate-400">{item.label}</span>
                <span className="text-slate-100 font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
