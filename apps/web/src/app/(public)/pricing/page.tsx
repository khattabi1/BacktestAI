'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Zap,
  ShieldCheck,
  Cpu,
  ArrowRight,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Activity,
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

interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  description: string;
  priceMonthly: string;
  priceAnnual: string;
  periodMonthly: string;
  periodAnnual: string;
  ctaText: string;
  ctaHref: string;
  isPopular: boolean;
  features: string[];
}

const PLANS: PricingPlan[] = [
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Essential discretionary replay studio and baseline deterministic backtesting.',
    priceMonthly: '$0',
    priceAnnual: '$0',
    periodMonthly: 'forever free',
    periodAnnual: 'forever free',
    ctaText: 'Start Free Today',
    ctaHref: '/app/backtest',
    isPopular: false,
    features: [
      'TradingView-grade Replay Studio canvas',
      'Universal timeframes (1m, 5m, 15m, 1h, 4h, 1D)',
      'Up to 10 persistent backtest sessions',
      'On-chart discretionary order execution HUD',
      'Synchronized trading journal & trade ledger',
      'Standard metrics (Sharpe, Profit Factor, Max DD)',
      'Community quantitative research support',
    ],
  },
  {
    id: 'pro',
    name: 'Professional Quant',
    badge: 'MOST POPULAR',
    description: 'Complete institutional quantitative suite with AI strategy generation and forensic autopsy.',
    priceMonthly: '$79',
    priceAnnual: '$64',
    periodMonthly: 'per month',
    periodAnnual: 'per month, billed annually',
    ctaText: 'Launch Professional',
    ctaHref: '/app/quant',
    isPopular: true,
    features: [
      'Everything in Researcher, plus:',
      'Unlimited persistent backtest sessions & ledgers',
      'Sub-second intrabar execution with spread & slippage models',
      '1,000-Path Monte Carlo ruin probability engine',
      'Sliding 12-window Walk-Forward degradation analysis',
      'Claude AI Strategy Co-Pilot with AST schema tuning',
      '1-Click MetaTrader 5 MQL5 EA & Python code export',
      'DuckDB columnar Parquet custom data uploads',
      'Priority email & research desk support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Institutional',
    description: 'High-throughput cluster execution, custom tick data feeds, and dedicated AI models.',
    priceMonthly: '$249',
    priceAnnual: '$199',
    periodMonthly: 'per month',
    periodAnnual: 'per month, billed annually',
    ctaText: 'Contact Institutional Sales',
    ctaHref: '/contact',
    isPopular: false,
    features: [
      'Everything in Professional, plus:',
      'Dedicated Claude quantitative reasoning node',
      'Multi-factor cluster batch execution & parameter sweep',
      'Sub-millisecond custom tick feed ingestion (L2 / Order Book)',
      'Bespoke MQL5 Expert Advisor risk & prop firm modules',
      'REST API access & programmatic webhook triggers',
      'Dedicated quant engineer SLA & 99.99% uptime guarantee',
      'Custom corporate billing & multi-seat management',
    ],
  },
];

const COMPARISON_CATEGORIES = [
  {
    name: 'Deterministic Simulation Engine',
    items: [
      { feature: 'Look-Ahead Bias Guarantee', free: '0.000% Invariant', pro: '0.000% Invariant', ent: '0.000% Invariant' },
      { feature: 'Execution Speed Benchmark', free: '0.024ms / bar', pro: '0.024ms / bar', ent: '<0.010ms / bar (Cluster)' },
      { feature: 'Spread & Slippage Models', free: 'Fixed Spread', pro: 'Volatility-Scaled', ent: 'Quadratic & Dynamic Order Book' },
      { feature: 'Historical Data Depth', free: '1-Year 1m OHLCV', pro: '10+ Years Tick & Intrabar', ent: 'Custom Full History L2' },
    ],
  },
  {
    name: 'Discretionary Replay Canvas',
    items: [
      { feature: 'Viewport Domination', free: '90% Full Viewport', pro: '90% Full Viewport', ent: 'Multi-Monitor Workspace' },
      { feature: 'Multi-Timeframe Scrubber', free: '1m · 5m · 15m · 1h · 1D', pro: 'All Timeframes + Custom', proMax: true, ent: 'Tick-by-Tick High Res' },
      { feature: 'Persistent Sessions', free: '10 Sessions', pro: 'Unlimited', ent: 'Unlimited + Team Sync' },
      { feature: 'On-Chart Order HUD', free: 'Market & SL/TP', pro: 'Market, Limit, Stop, Trailing', ent: 'Custom Algorithmic Bracket' },
    ],
  },
  {
    name: 'Forensic Autopsy & AI Lab',
    items: [
      { feature: 'Monte Carlo Resampler', free: '—', pro: '1,000 Iteration Paths', ent: '10,000+ Iterations' },
      { feature: 'Walk-Forward Analysis', free: '—', pro: '12 Rolling Windows', ent: 'Custom Parameter Grid' },
      { feature: 'Claude AI Strategy Co-Pilot', free: '—', pro: 'Included (Dual Syntax)', ent: 'Dedicated AI Inference Node' },
      { feature: 'MetaTrader 5 MQL5 EA Export', free: '—', pro: 'Instant 1-Click .mq5', ent: 'Bespoke MQL5 Prop EA' },
    ],
  },
];

const FAQS = [
  {
    question: 'How is 0.000% look-ahead bias mathematically guaranteed?',
    answer:
      'BacktestAI executes an event-loop where bar index t has strict, immutable access only to historical indices 0 through t. Indicator calculation buffers, rolling ATR windows, and pending order checks cannot read future candle opens or highs by architectural design.',
  },
  {
    question: 'Are the exported MetaTrader 5 Expert Advisors ready for live execution?',
    answer:
      'Yes. Exported .mq5 files are complete, standalone Expert Advisors with native OnTick event handlers, lot sizing math, stop-loss / take-profit calculations, and order management classes. They require zero external DLLs and compile cleanly in MetaEditor.',
  },
  {
    question: 'Can I upload my own historical market data?',
    answer:
      'Professional and Enterprise plans allow you to import custom CSV or Parquet files directly into your local DuckDB partition hierarchy. The platform automatically validates timestamp continuity, detects gaps, and constructs intraday bars.',
  },
  {
    question: 'Can I switch between monthly and annual billing at any time?',
    answer:
      'Yes, you can upgrade, downgrade, or cancel your subscription at any time directly in your account settings. When switching to annual billing, your 20% discount is applied immediately to your next billing cycle.',
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="py-10 sm:py-16 md:py-24 space-y-16 sm:space-y-24">
      {/* 1. Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-accent" />
            <span>TRANSPARENT INSTITUTIONAL PRICING</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100">
            Predictable Pricing. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent via-slate-100 to-emerald-400">
              Zero Look-Ahead Bias.
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Start free with our TradingView-grade Replay Studio, or unlock the complete quantitative suite with Claude AI strategy generation and 1,000-path Monte Carlo stress testing.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl font-mono text-xs transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#151C27] text-white border border-cyan-accent/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly Billing
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`min-h-[42px] relative px-3.5 sm:px-4 py-2 rounded-xl font-mono text-xs transition-all flex items-center gap-1.5 sm:gap-2 ${
                billingCycle === 'annual'
                  ? 'bg-[#151C27] text-white border border-cyan-accent/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/20">
                SAVE 20%
              </span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* 2. Three Obsidian Pricing Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {PLANS.map((plan, idx) => {
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
            const period = billingCycle === 'annual' ? plan.periodAnnual : plan.periodMonthly;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.isPopular
                    ? 'bg-[#0E1520] border-2 border-cyan-accent/50 shadow-[0_0_35px_-5px_rgba(34,211,238,0.15)]'
                    : 'bg-[#0A0E15] border border-[#202A38] hover:border-slate-600'
                }`}
              >
                {/* Popular Pill */}
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-accent text-obsidian-base font-mono text-[10px] font-extrabold uppercase tracking-widest shadow-hud">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="mb-6 space-y-2">
                    <h3 className="text-xl font-bold text-slate-100">{plan.name}</h3>
                    <p className="text-xs text-slate-400 min-h-[36px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6 sm:mb-8 pb-6 border-b border-[#202A38]">
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-4xl sm:text-5xl font-extrabold text-slate-100 tracking-tight">
                        {price}
                      </span>
                      <span className="text-xs text-slate-400">{period}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 mb-8 text-xs font-mono text-slate-300">
                    {plan.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-cyan-accent shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <Link
                  href={plan.ctaHref}
                  className={`min-h-[44px] w-full py-3.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                    plan.isPopular
                      ? 'bg-cyan-accent text-obsidian-base hover:bg-cyan-accent/90 shadow-hud'
                      : 'bg-[#151C27] hover:bg-[#1C2636] border border-[#202A38] text-slate-200 hover:text-white'
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 3. Deep Feature Comparison Breakdown Table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={sectionVariants}
          className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 md:p-10 shadow-2xl space-y-6 sm:space-y-8"
        >
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
              FEATURE MATRIX
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Detailed Plan Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Compare architectural boundaries across data streaming, execution precision, and export formats.
            </p>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-2 sm:mx-0">
            <table className="w-full text-left font-mono text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-[#202A38] text-slate-400">
                  <th className="py-3 px-3 sm:px-4 font-bold text-slate-300">CAPABILITY</th>
                  <th className="py-3 px-3 sm:px-4">RESEARCHER</th>
                  <th className="py-3 px-3 sm:px-4 text-cyan-accent font-bold">PROFESSIONAL</th>
                  <th className="py-3 px-3 sm:px-4">ENTERPRISE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151D28]">
                {COMPARISON_CATEGORIES.map((cat) => (
                  <React.Fragment key={cat.name}>
                    <tr className="bg-[#0D1118]/80 text-slate-200 font-sans font-bold text-xs">
                      <td colSpan={4} className="py-2.5 px-3 sm:px-4 tracking-wider text-[11px] text-cyan-accent/90">
                        {cat.name.toUpperCase()}
                      </td>
                    </tr>
                    {cat.items.map((item) => (
                      <tr key={item.feature} className="hover:bg-[#0D1118] transition-colors text-slate-300">
                        <td className="py-3 px-3 sm:px-4 font-sans text-xs text-slate-200">{item.feature}</td>
                        <td className="py-3 px-3 sm:px-4 text-slate-400">{item.free}</td>
                        <td className="py-3 px-3 sm:px-4 text-slate-100 font-semibold bg-cyan-accent/5">
                          {item.pro}
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-slate-300">{item.ent}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* 4. Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center space-y-2 mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-accent" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Answers for Quantitative Researchers
          </h2>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={faq.question}
                className="rounded-2xl border border-[#202A38] bg-[#0A0E15] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-slate-200 hover:text-cyan-accent transition-colors gap-3"
                >
                  <span className="font-semibold text-xs sm:text-sm font-sans">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-cyan-accent' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-slate-400 font-sans text-xs leading-relaxed border-t border-[#151D28] pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Bottom Sovereign Call-to-Action */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-6 sm:p-10 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Start Building with Zero Look-Ahead Bias
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Launch Replay Studio immediately with free historical market data, or explore the Quant Trading Lab to automate your strategies.
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
                className="min-h-[44px] w-full sm:w-auto px-6 py-3 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#202A38] text-slate-200 font-semibold font-mono text-xs transition-all flex items-center justify-center"
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
