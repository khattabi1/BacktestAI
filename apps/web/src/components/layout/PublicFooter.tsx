import React from 'react';
import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="border-t border-[#202A38] py-12 bg-[#06080C] text-xs font-mono text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pb-10 border-b border-[#1A2332]">
          {/* Col 1: Brand */}
          <div className="space-y-3 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">BACKTESTAI</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-accent/10 text-cyan-accent">
                v2.4
              </span>
            </div>
            <p className="text-slate-400 font-sans text-xs leading-relaxed max-w-sm">
              Next-generation quantitative backtesting, bar-by-bar market replay, and AI strategy engineering platform.
            </p>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-2">
            <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              Platform
            </div>
            <ul className="space-y-2 text-slate-400 font-sans text-xs">
              <li>
                <Link href="/features" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Features Overview
                </Link>
              </li>
              <li>
                <Link href="/features/backtesting" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Deterministic Engine
                </Link>
              </li>
              <li>
                <Link href="/features/charts" className="hover:text-cyan-accent transition-colors block py-0.5">
                  OpenAlgo Replay Canvas
                </Link>
              </li>
              <li>
                <Link href="/features/analytics" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Forensic Autopsy
                </Link>
              </li>
              <li>
                <Link href="/features/intelligence" className="hover:text-cyan-accent transition-colors block py-0.5">
                  AI Strategy Co-Pilot
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Workspaces */}
          <div className="space-y-2">
            <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              Workspaces
            </div>
            <ul className="space-y-2 text-slate-400 font-sans text-xs">
              <li>
                <Link href="/app/backtest" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Replay Studio
                </Link>
              </li>
              <li>
                <Link href="/app/quant" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Quant Trading Lab
                </Link>
              </li>
              <li>
                <Link href="/app/strategies" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Strategy Library
                </Link>
              </li>
              <li>
                <Link href="/app/compare" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Matrix Compare
                </Link>
              </li>
              <li>
                <Link href="/app/journal" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Research Journal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Resources & Legal */}
          <div className="space-y-2">
            <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              Resources & Legal
            </div>
            <ul className="space-y-2 text-slate-400 font-sans text-xs">
              <li>
                <Link href="/pricing" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Research Blog
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Support Desk
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-cyan-accent transition-colors block py-0.5">
                  Risk Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
          <span>© 2026 BacktestAI Inc. Built for institutional quant researchers.</span>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-400">
            <Link href="/status" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Status: Operational</span>
            </Link>
            <span className="hidden sm:inline">·</span>
            <span>Latency: 0.024ms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
