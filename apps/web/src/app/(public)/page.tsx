import Link from 'next/link';
import {
  ArrowRight,
  Terminal,
  Activity,
  ShieldCheck,
  Cpu,
  BarChart3,
  BookOpen,
  Layers,
  Sparkles,
  Zap,
  Lock,
  GitBranch,
  TrendingUp,
} from 'lucide-react';
import { HeroTerminalShowcase } from '@/components/landing/HeroTerminalShowcase';
import { InteractiveProofSection } from '@/components/landing/InteractiveProofSection';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 selection:bg-cyan-accent/25 relative overflow-hidden font-sans">
      {/* 1. Global Ambient Ray Tracing Lighting & Grids */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-cyan-accent/15 via-violet-500/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[800px] left-1/4 w-[800px] h-[500px] bg-gradient-to-tr from-emerald-500/10 via-cyan-accent/5 to-transparent blur-[140px] pointer-events-none" />

      {/* Subtle Fine Computational Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20 relative z-10">
        {/* Hero Copy */}
        <div className="text-center max-w-4xl mx-auto space-y-6 mb-12">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-accent/30 bg-[#0F1622]/90 backdrop-blur-md text-xs font-mono text-cyan-accent shadow-hud">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>Next-Gen Quant Research &amp; Replay Lab</span>
          </div>

          {/* Giant Hero Headline */}
          <h1 className="text-3xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-100 leading-[1.12] sm:leading-[1.08]">
            The Market Is Data. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent via-slate-100 to-violet-400">
              Intelligence Finds the Edge.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-sm sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Eliminate look-ahead bias with deterministic microsecond Polars execution,
            TradingView-grade bar-by-bar replay scrubbers, and automated Python &amp; MQL5 MetaTrader 5 AI strategy generation.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-3 w-full sm:w-auto">
            <Link
              href="/app/backtest"
              className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-2xl bg-cyan-accent text-obsidian-base font-bold text-sm hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center gap-2.5 active:scale-95 font-mono"
            >
              <Activity className="w-4 h-4 fill-current" />
              <span>Launch Replay Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/app/quant"
              className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-2xl bg-[#111722] hover:bg-[#151C27] border border-[#202A38] hover:border-cyan-accent/50 text-slate-200 hover:text-cyan-accent font-semibold text-sm transition-all flex items-center justify-center gap-2.5 font-mono shadow-sm"
            >
              <Cpu className="w-4 h-4 text-cyan-accent" />
              <span>Explore Quant AI Lab</span>
            </Link>
          </div>

          {/* Trust & Spec Proof Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>0.000% Look-Ahead Bias</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-accent" />
              <span>DuckDB Parquet Streaming</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              <span>MetaTrader 5 MQL5 Native</span>
            </div>
          </div>
        </div>

        {/* 5. Centerpiece: Interactive 3D Perspective Hero Terminal Showcase */}
        <div className="mt-8 mb-16">
          <HeroTerminalShowcase />
        </div>

        {/* 6. "Don't Trust the Backtest" & Pillar Breakdown */}
        <InteractiveProofSection />

        {/* 7. Bottom Sovereign Call-to-Action Card */}
        <div className="mt-12 rounded-3xl border border-[#202A38] bg-gradient-to-b from-[#111722] to-[#0A0E15] p-6 sm:p-10 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
              JOIN INSTITUTIONAL QUANT RESEARCHERS
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-100">
              Stop Guessing. Backtest with Zero Look-Ahead Bias.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              From manual bar replay to autonomous Python &amp; MQL5 generation, experience the sovereign quantitative command terminal.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2 w-full sm:w-auto">
              <Link
                href="/app/backtest"
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-cyan-accent text-obsidian-base font-bold font-mono text-xs hover:bg-cyan-accent/90 transition-all shadow-hud flex items-center justify-center text-center"
              >
                Launch Replay Studio Free
              </Link>
              <Link
                href="/app/quant"
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#202A38] text-slate-300 font-semibold font-mono text-xs transition-all flex items-center justify-center text-center"
              >
                Open Quant Trading Lab
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

