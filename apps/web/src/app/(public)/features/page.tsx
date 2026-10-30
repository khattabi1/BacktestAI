'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  ShieldCheck,
  Layers,
  ArrowRight,
  Zap,
  Lock,
  Database,
  LineChart,
  Terminal,
  FileCode,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const FEATURES = [
  {
    href: '/features/backtesting',
    title: 'Deterministic Engine',
    badge: '0.000% Look-Ahead Bias',
    icon: Zap,
    metric: '0.024ms / bar',
    metricLabel: 'Execution Speed',
    description:
      'Polars-powered columnar event-loop enforcing strict microsecond causality. Intrabar bid/ask spread modeling, volatility-scaled slippage, and zero future leakage.',
    tags: ['Polars Rust', 'Causal Invariant', 'Tick Simulation', 'DuckDB Stream'],
  },
  {
    href: '/features/charts',
    title: 'OpenAlgo Replay Canvas',
    badge: 'TradingView Grade',
    icon: Activity,
    metric: '120 FPS',
    metricLabel: 'Hardware Acceleration',
    description:
      'Multi-timeframe bar replay scrubber with discretionary order palette. Place simulated market, stop, and limit orders directly onto live chart candles with synchronized session ledger.',
    tags: ['Universal Timeframes', 'Intrabar Scrubbing', 'Order Palette', 'Session Ledger'],
  },
  {
    href: '/features/analytics',
    title: 'Forensic Autopsy',
    badge: 'Ruin Destruction',
    icon: ShieldCheck,
    metric: '1,000 Paths',
    metricLabel: 'Monte Carlo Resampling',
    description:
      'Brutal out-of-sample stress testing. Rolling walk-forward degradation envelopes, volatility regime shift sensitivity matrices, and statistical ruin probabilities.',
    tags: ['Walk-Forward', 'Monte Carlo', 'Overfitting Score', 'Regime Matrix'],
  },
  {
    href: '/features/intelligence',
    title: 'AI Strategy Co-Pilot',
    badge: 'Claude Opus 5.5',
    icon: Cpu,
    metric: '1-Click',
    metricLabel: 'MQL5 & Python Export',
    description:
      'Natural language prompt-to-strategy engine with real-time parameter schema parsing and bidirectional Python Polars ↔ MetaTrader 5 MQL5 EA cross-compilation.',
    tags: ['Claude Opus 5.5', 'Prompt to Strategy', 'AST Schema Parser', 'MQL5 EA Export'],
  },
];

const COMPARISON_ROWS = [
  {
    feature: 'Look-Ahead Bias Prevention',
    backtestSi: 'Guaranteed (Chronological Invariant)',
    tradingView: 'Partial (Pinescript lookahead leakage)',
    mt5: 'Partial (Bar close open shift bugs)',
    pandas: 'None (Vectorized future index leakage)',
  },
  {
    feature: 'Execution Engine Speed',
    backtestSi: '0.024ms/bar (Native Polars Rust)',
    tradingView: 'Cloud Queue (Variable latency)',
    mt5: 'Native C++ (Single core bound)',
    pandas: 'Slow (Python GIL iteration)',
  },
  {
    feature: 'Memory Consumption',
    backtestSi: 'Zero-Copy (DuckDB Parquet Columnar)',
    tradingView: 'Cloud Managed (Limited historical depth)',
    mt5: 'Direct Disk (Proprietary .fxt format)',
    pandas: 'High (Loads entire CSV into RAM)',
  },
  {
    feature: 'Walk-Forward & Monte Carlo',
    backtestSi: 'Built-in 1,000-Path Resampler',
    tradingView: 'Third-party script required',
    mt5: 'Optimization table only',
    pandas: 'Manual custom scripting',
  },
  {
    feature: 'MetaTrader 5 EA Native Export',
    backtestSi: 'Instant 1-Click .mq5 EA generation',
    tradingView: 'Not supported (Pine Script only)',
    mt5: 'Manual MQL5 development',
    pandas: 'Not supported (Python only)',
  },
];

export default function FeaturesPage() {
  return (
    <div className="py-10 sm:py-16 md:py-24 space-y-16 sm:space-y-24">
      {/* 1. Features Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-accent" />
            <span>INSTITUTIONAL QUANT ARCHITECTURE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            Architected for Truth. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-slate-200">
              Engineered for Alpha.
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Eliminate look-ahead bias, stress-test strategy edges, and bridge discretionary intuition with autonomous AI generation across four core quantitative pillars.
          </p>
        </motion.div>
      </section>

      {/* 2. Four Pillar Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 sm:p-8 rounded-3xl border border-[#202A38] bg-[#0A0E15] hover:border-slate-600 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5 sm:mb-6">
                    <div className="w-11 sm:w-12 h-11 sm:h-12 rounded-2xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent group-hover:border-cyan-accent/40 transition-colors">
                      <Icon className="w-5 sm:w-6 h-5 sm:h-6" />
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-base sm:text-lg font-bold text-slate-100 block">{feat.metric}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{feat.metricLabel}</span>
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5 sm:mb-6">
                    {feat.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 sm:mb-8">
                    {feat.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] sm:text-[11px] font-mono px-2 sm:px-2.5 py-0.5 rounded-md bg-[#111722] border border-[#202A38] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={feat.href}
                  className="min-h-[44px] inline-flex items-center justify-between w-full py-3 px-4 rounded-xl bg-[#111722] hover:bg-[#151C27] border border-[#202A38] hover:border-cyan-accent/40 text-slate-200 text-xs font-mono font-semibold transition-all group/btn"
                >
                  <span>Explore Architecture Deep-Dive</span>
                  <ArrowRight className="w-4 h-4 text-cyan-accent group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 3. Competitive Comparison Matrix */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={sectionVariants}
          className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden"
        >
          <div className="max-w-2xl mb-6 sm:mb-8 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
              PLATFORM BENCHMARK
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Why Institutional Researchers Choose BacktestAI
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Traditional backtesters either leak future information or lock you into proprietary scripting languages. BacktestAI enforces strict mathematical rigor.
            </p>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-2 sm:mx-0">
            <table className="w-full text-left font-mono text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-[#202A38] text-slate-500">
                  <th className="py-3 px-3 sm:px-4">CAPABILITY</th>
                  <th className="py-3 px-3 sm:px-4 text-cyan-accent font-bold">BACKTESTAI</th>
                  <th className="py-3 px-3 sm:px-4">TRADINGVIEW</th>
                  <th className="py-3 px-3 sm:px-4">METATRADER 5</th>
                  <th className="py-3 px-3 sm:px-4">PANDAS SCRIPTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151D28] text-slate-300">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-[#0D1118] transition-colors">
                    <td className="py-3.5 px-3 sm:px-4 font-semibold text-slate-200 font-sans text-xs">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-emerald-400 font-semibold bg-cyan-accent/5">
                      {row.backtestSi}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-slate-400">{row.tradingView}</td>
                    <td className="py-3.5 px-3 sm:px-4 text-slate-400">{row.mt5}</td>
                    <td className="py-3.5 px-3 sm:px-4 text-slate-500">{row.pandas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* 4. Bottom Action Card */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Ready to Experience Zero Look-Ahead Bias?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Launch Replay Studio to test your discretionary edge or enter Quant Lab to generate your first AI strategy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <Link
                href="/app/backtest"
                className="min-h-[44px] w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center"
              >
                Launch Replay Studio Free
              </Link>
              <Link
                href="/app/quant"
                className="min-h-[44px] w-full sm:w-auto px-6 py-3 rounded-xl bg-[#151C27] hover:bg-[#1A2332] border border-[#202A38] text-slate-200 font-semibold font-mono text-xs transition-all flex items-center justify-center"
              >
                Open Quant Trading Lab
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
