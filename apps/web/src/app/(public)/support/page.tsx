'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LifeBuoy,
  ShieldCheck,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileCode,
  Terminal,
  KeyRound,
  MessageSquare,
} from 'lucide-react';

const SLA_TIERS = [
  {
    tier: 'Researcher',
    sla: '48h Response',
    desc: 'Community forum & standard email queue.',
    badge: 'Standard',
  },
  {
    tier: 'Professional',
    sla: '24h Guaranteed',
    desc: 'Priority queue with direct quant engineer triage.',
    badge: 'Priority',
  },
  {
    tier: 'Enterprise',
    sla: '1h Dedicated SLA',
    desc: 'Direct Slack/Teams bridge & dedicated quant desks.',
    badge: 'Institutional',
  },
];

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    workspaceId: '',
    category: 'engine-bug',
    severity: 'normal',
    subject: '',
    message: '',
    attachLogs: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const generatedId = `TKT-SI-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedTicket(generatedId);
    }, 700);
  };

  const copyTicketId = () => {
    if (submittedTicket) {
      navigator.clipboard.writeText(submittedTicket);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    }
  };

  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-cyan-accent">
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>ENGINEERING SUPPORT DESK · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          Institutional Support & Incident Response
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Direct access to quantitative software engineers, data pipeline specialists, and algorithmic compilation architects.
        </p>
      </div>

      {/* SLA Tiers Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {SLA_TIERS.map((s, idx) => (
          <div
            key={s.tier}
            className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-6 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 font-sans text-sm">{s.tier}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  s.tier === 'Enterprise'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : s.tier === 'Professional'
                    ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {s.badge}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-slate-200">{s.sla}</div>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Form + Side Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Ticket Form */}
        <div className="lg:col-span-8">
          <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 md:p-10 shadow-2xl space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
                INCIDENT DISPATCH
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                Submit an Engineering Ticket
              </h2>
              <p className="text-xs text-slate-400">
                Provide reproduction steps or anomalous data hashes for rapid diagnostic resolution.
              </p>
            </div>

            {submittedTicket ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 sm:p-8 rounded-2xl bg-[#0D1520] border border-cyan-accent/30 space-y-4 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-cyan-accent/10 border border-cyan-accent/40 flex items-center justify-center text-cyan-accent mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">Ticket Dispatched to Quant Queue</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Your issue has been routed to our on-call quantitative platform team. You will receive cryptographic confirmation and diagnostic updates via email.
                </p>
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#111722] border border-[#202A38] font-mono text-sm text-cyan-accent">
                  <span>{submittedTicket}</span>
                  <button
                    type="button"
                    onClick={copyTicketId}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    {copiedTicket ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedTicket(null);
                      setFormData({
                        name: '',
                        email: '',
                        workspaceId: '',
                        category: 'engine-bug',
                        severity: 'normal',
                        subject: '',
                        message: '',
                        attachLogs: true,
                      });
                    }}
                    className="min-h-[44px] text-xs font-mono text-slate-400 hover:text-cyan-accent underline transition-colors"
                  >
                    Submit another ticket
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Dr. Arthur Vance"
                      className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Institutional Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="quant@citadel-research.com"
                      className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono"
                    >
                      <option value="engine-bug">Deterministic Simulation Engine Bug</option>
                      <option value="parquet-data">Parquet / DuckDB Market Data Discrepancy</option>
                      <option value="mql5-export">MetaTrader 5 MQL5 EA Transpile Anomaly</option>
                      <option value="claude-ai">Claude AI Strategy Co-Pilot Synthesis</option>
                      <option value="billing">Account, Licensing & Enterprise Billing</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Severity Tier *</label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono"
                    >
                      <option value="low">P3 - Minor Inconvenience / Question</option>
                      <option value="normal">P2 - Normal Defect / Non-Blocking</option>
                      <option value="high">P1 - High Impact / Backtest Engine Degradation</option>
                      <option value="critical">P0 - Critical Outage / Complete Workspace Lock</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Issue Subject *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Parquet tick slice timestamp gap on XAUUSD 2025-11-04"
                    className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Detailed Reproduction Log *</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe reproduction steps, parameter schema, unexpected return code, or error logs..."
                    className="w-full px-4 py-3 rounded-xl bg-[#0D1118] border border-[#202A38] text-base sm:text-xs text-slate-100 focus:outline-none focus:border-cyan-accent/60 transition-all font-mono leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="attachLogs"
                    checked={formData.attachLogs}
                    onChange={(e) => setFormData({ ...formData, attachLogs: e.target.checked })}
                    className="w-4 h-4 rounded border-[#202A38] bg-[#0D1118] text-cyan-accent focus:ring-0"
                  />
                  <label htmlFor="attachLogs" className="text-xs text-slate-400 select-none">
                    Automatically attach anonymized platform telemetry and engine version headers
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] w-full py-3.5 px-4 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Dispatching Ticket...</span>
                  ) : (
                    <>
                      <span>Transmit Incident Report</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Side Channel Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-6 space-y-4 shadow-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              DIRECT ESCALATION
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="p-3.5 rounded-xl bg-[#0D1118] border border-[#1A2332] space-y-1">
                <div className="font-semibold text-slate-200">Institutional Security PGP</div>
                <div className="font-mono text-[11px] text-cyan-accent break-all">
                  E4B9 8C71 289F 042A 1983
                </div>
                <p className="text-[11px] text-slate-500">For encrypted zero-day or vulnerability disclosures.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1118] border border-[#1A2332] space-y-1">
                <div className="font-semibold text-slate-200">Quant Community Discord</div>
                <p className="text-[11px] text-slate-400">
                  Join 4,500+ quantitative researchers, hedge fund engineers, and strategy developers.
                </p>
                <div className="pt-1">
                  <a
                    href="https://discord.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-cyan-accent hover:underline flex items-center gap-1"
                  >
                    discord.gg/backtest-ai →
                  </a>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1118] border border-[#1A2332] space-y-1">
                <div className="font-semibold text-slate-200">Live Status & Outage Feed</div>
                <p className="text-[11px] text-slate-400">
                  Check live cluster latency and pipeline maintenance schedules.
                </p>
                <div className="pt-1">
                  <Link
                    href="/status"
                    className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    View System Status (99.99% Uptime) →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
