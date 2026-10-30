'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Scale,
  FileText,
  Lock,
  Cpu,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

const SECTIONS = [
  {
    id: 'scope',
    title: '1. Platform Scope & Purpose',
    icon: Terminal,
    content: `BacktestAI provides institutional quantitative backtesting, market replay simulation, and algorithmic strategy engineering tools. The software simulates historical market orders with zero look-ahead bias against deterministic Parquet and DuckDB datasets. 

By accessing or utilizing BacktestAI ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must terminate access immediately.`,
  },
  {
    id: 'intellectual-property',
    title: '2. Algorithmic IP & Strategy Ownership',
    icon: Lock,
    content: `You retain 100% full, unencumbered ownership of all quantitative algorithms, Python scripts, Polars indicators, MetaTrader 5 (MQL5) Expert Advisors, and proprietary strategy parameters created or imported on the Platform.

BacktestAI asserts zero ownership claims over your intellectual property. Furthermore, BacktestAI does NOT inspect, aggregate, reverse-engineer, or utilize your strategy logic or backtest results to train internal artificial intelligence models or algorithmic trading systems.`,
  },
  {
    id: 'no-advice',
    title: '3. No Financial Advice & Simulation Invariant',
    icon: AlertTriangle,
    content: `BacktestAI is a technology and quantitative research platform. It is NOT a registered investment adviser, commodity trading advisor (CTA), broker-dealer, or financial intermediary with the SEC, CFTC, FCA, or any international financial authority.

All backtest metrics (including Sharpe ratio, maximum drawdown, Calmar ratio, and win rates) represent simulated historical approximations. Past performance is no guarantee of future results. We do not provide financial, investment, legal, or tax advice.`,
  },
  {
    id: 'compute-limits',
    title: '4. Compute & Fair Resource Usage',
    icon: Cpu,
    content: `Subscribers receive access to high-performance simulation kernels, DuckDB columnar query pipelines, and Anthropic Claude AI strategy generation interfaces according to their plan tier.

You agree not to execute automated denial-of-service attempts, abuse the API endpoints, distribute malware, or bypass computational quotas. High-throughput cluster parameter sweeps and Monte Carlo runs must adhere to declared concurrency quotas.`,
  },
  {
    id: 'exports',
    title: '5. Multi-Platform Strategy Exports',
    icon: FileText,
    content: `The Platform provides 1-click export of production-ready MetaTrader 5 (.mq5) Expert Advisors and standalone Python trading scripts. 

You are solely responsible for testing, auditing, compiling, and deploying exported source code on your execution venues or broker environments. BacktestAI assumes no liability for order execution slippage, latency disparities, broker API disconnections, or losses incurred in live markets.`,
  },
  {
    id: 'liability',
    title: '6. Limitation of Liability',
    icon: Scale,
    content: `To the maximum extent permitted by applicable law, BacktestAI, its affiliates, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, trading capital, data, or goodwill.

The Platform and simulation data are provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied.`,
  },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('scope');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-cyan-accent">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>LEGAL GOVERNANCE · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          Terms of Service
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Master institutional quantitative platform agreement governing deterministic simulation, intellectual property protections, and zero look-ahead bias research.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-mono text-slate-500 pt-2 border-t border-[#1A2332]">
          <span>Effective: Jan 15, 2026</span>
          <span className="hidden sm:inline">·</span>
          <span>Version: 2.4.0</span>
          <span className="hidden sm:inline">·</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% User IP Ownership
          </span>
        </div>
      </div>

      {/* Mobile Horizontal Section Jump Bar */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToSection(sec.id)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap shrink-0 transition-colors ${
              activeSection === sec.id
                ? 'bg-cyan-accent/20 text-cyan-accent border border-cyan-accent/40 font-medium'
                : 'bg-[#0D1118] text-slate-400 border border-[#202A38]'
            }`}
          >
            {sec.title}
          </button>
        ))}
      </div>

      {/* Main Grid: TOC + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Sticky TOC (Desktop only) */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 space-y-3 shadow-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-2">
              Document Contents
            </div>
            <nav className="space-y-1 font-mono text-xs">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                    activeSection === sec.id
                      ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#111722]'
                  }`}
                >
                  <span className="truncate">{sec.title}</span>
                  <ArrowRight className="w-3 h-3 opacity-60 shrink-0 ml-2" />
                </button>
              ))}
            </nav>
          </div>

          {/* Quick Notice Card */}
          <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 space-y-2 text-xs font-sans">
            <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono text-xs">
              <Lock className="w-3.5 h-3.5 text-cyan-accent" />
              <span>IP Protection Invariant</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              We guarantee under section 2 that your quantitative logic, MQL5 Expert Advisors, and proprietary indicators are strictly yours. We never train AI models on user strategies.
            </p>
          </div>
        </aside>

        {/* Right Content Sections */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-10">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <motion.section
                key={sec.id}
                id={sec.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-7 md:p-8 space-y-4 shadow-xl scroll-mt-24"
              >
                <div className="flex items-center gap-3 border-b border-[#1A2332] pb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-slate-100 font-sans">
                    {sec.title}
                  </h2>
                </div>
                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                  {sec.content}
                </div>
              </motion.section>
            );
          })}

          {/* Bottom Action Card */}
          <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-100">Questions about our Terms?</div>
              <p className="text-xs text-slate-400">
                Contact our compliance and legal team directly for institutional agreements.
              </p>
            </div>
            <Link
              href="/support"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center shrink-0"
            >
              Contact Legal Desk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
