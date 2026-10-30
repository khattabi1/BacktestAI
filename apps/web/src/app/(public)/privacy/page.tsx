'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Lock,
  Shield,
  EyeOff,
  Server,
  Key,
  Cpu,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  Database,
} from 'lucide-react';

const PRINCIPLES = [
  {
    icon: EyeOff,
    title: 'Zero Alpha Leakage',
    desc: 'Proprietary trading logic, parameter ranges, and alpha hypotheses are never observed, mined, or monetized.',
  },
  {
    icon: Cpu,
    title: 'Zero AI Retraining',
    desc: 'Anthropic Claude Opus 5.5 processing operates under zero-retention enterprise terms. Your code is never used for model training.',
  },
  {
    icon: Server,
    title: 'Local Parquet Isolation',
    desc: 'Partitioned DuckDB tick and minute datasets are strictly bounded to your private tenant storage without cross-tenant sharing.',
  },
  {
    icon: Key,
    title: 'Hardware-Grade Encryption',
    desc: 'All secrets, broker webhook credentials, and persistent session snapshots are encrypted at rest with AES-256-GCM.',
  },
];

const SECTIONS = [
  {
    id: 'data-collection',
    title: '1. Quantitative Data Boundary',
    content: `BacktestAI collects only information required to provide deterministic simulation and authentication services:
    
• Account credentials (email, hashed password, API authentication tokens).
• Operational telemetry (simulation execution speed, memory footprint, DuckDB query times).
• Voluntary crash diagnostics and compiler error stack traces.

We explicitly DO NOT log or store external broker passwords, credit card numbers (processed via PCI-DSS compliant Stripe gateways), or raw live trading accounts.`,
  },
  {
    id: 'ai-processing',
    title: '2. Anthropic Claude AI Processing Invariant',
    content: `When utilizing the AI Strategy Co-Pilot in the Quant Trading Lab or SI Intelligence Workspace:

• Quantitative prompts and Python/MQL5 code snippets are transmitted directly to Anthropic Claude Opus 5.5 via enterprise-tier, zero-retention API endpoints.
• Anthropic does NOT retain user inputs or completions for model training, reinforcement learning from human feedback (RLHF), or general AI development.
• No other third-party LLM (such as unapproved models or data harvesting providers) has access to your trading scripts.`,
  },
  {
    id: 'duckdb-storage',
    title: '3. Parquet Data Architecture & Persistence',
    content: `Historical market OHLCV bars (BTCUSDT, XAUUSD, EURUSD, and custom user uploads) are structured as immutable Apache Parquet files queried via DuckDB.

Custom Parquet and CSV files uploaded to the platform are stored in sandboxed directories specific to your organization ID. BacktestAI does not redistribute user-uploaded historical market data to other customers or third parties.`,
  },
  {
    id: 'cookies-localstorage',
    title: '4. Client-Side State & Cookies',
    content: `We utilize local browser storage (IndexedDB and localStorage) for chart drawing tools, custom indicator colors, and persistent replay session journals.

We do NOT install third-party advertising cookies, cross-site trackers, or behavioral marketing beacons. For detailed breakdowns of all local keys, inspect our Cookie Policy.`,
  },
  {
    id: 'gdpr-compliance',
    title: '5. GDPR, CCPA & Compliance Rights',
    content: `Regardless of your geographic jurisdiction, BacktestAI affords all quant researchers sovereign rights over their data:

• Right to Access: Request a machine-readable JSON archive of all your saved strategies, backtest sessions, and ledger entries.
• Right to Erasure: Permanently delete your account, wiping all cloud-stored session states, backtest runs, and encrypted credentials.
• Zero Data Brokerage: We have never sold, rented, or bartered user data to hedge funds, high-frequency prop desks, or data brokers.`,
  },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('data-collection');

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
          <Lock className="w-3.5 h-3.5" />
          <span>DATA PRIVACY & SOVEREIGNTY · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          Privacy Policy
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Institutional quant privacy framework establishing zero alpha leakage, zero AI model retraining on user strategies, and client-side encryption.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-mono text-slate-500 pt-2 border-t border-[#1A2332]">
          <span>Effective: Jan 15, 2026</span>
          <span className="hidden sm:inline">·</span>
          <span>Security Standard: SOC2 Type II</span>
          <span className="hidden sm:inline">·</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Zero AI Retraining
          </span>
        </div>
      </div>

      {/* 4 Pillars HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {PRINCIPLES.map((p, idx) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-6 space-y-3 shadow-lg"
            >
              <div className="w-9 h-9 rounded-xl bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-100 text-sm font-sans">{p.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{p.desc}</p>
            </motion.div>
          );
        })}
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
        {/* Left Sticky Navigation (Desktop only) */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
          <div className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 space-y-3 shadow-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-2">
              Privacy Sections
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

          <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 space-y-2 text-xs font-sans">
            <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono text-xs">
              <Database className="w-3.5 h-3.5 text-cyan-accent" />
              <span>Data Export & Deletion</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              You can trigger a full JSON/Parquet export of your backtests or permanently purge your account data with 1-click in account settings.
            </p>
          </div>
        </aside>

        {/* Right Content */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-10">
          {SECTIONS.map((sec) => (
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
                  <Shield className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-xl font-bold text-slate-100 font-sans">
                  {sec.title}
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                {sec.content}
              </div>
            </motion.section>
          ))}

          {/* Bottom Card */}
          <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-100">Need a bespoke institutional DPA?</div>
              <p className="text-xs text-slate-400">
                Enterprise funds can execute custom Data Protection Agreements and HIPAA/SOC2 addendums.
              </p>
            </div>
            <Link
              href="/support"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center shrink-0"
            >
              Request DPA
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
