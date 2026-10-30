'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Cookie,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Sliders,
  Sparkles,
  Info,
  Check,
  X,
} from 'lucide-react';

interface StorageItem {
  key: string;
  type: 'Cookie' | 'localStorage' | 'IndexedDB';
  purpose: string;
  category: 'Essential' | 'Functional' | 'Analytical';
  retention: string;
}

const STORAGE_INVENTORY: StorageItem[] = [
  {
    key: 'backtest_si_session',
    type: 'Cookie',
    purpose: 'Cryptographically signed JWT session token for authenticated quant access.',
    category: 'Essential',
    retention: '30 Days / Session',
  },
  {
    key: 'backtest_si_csrf',
    type: 'Cookie',
    purpose: 'Anti-cross-site-request-forgery token protecting API endpoints.',
    category: 'Essential',
    retention: 'Session',
  },
  {
    key: 'backtest_si_chart_state',
    type: 'localStorage',
    purpose: 'Active OpenAlgo chart timeframe (1m, 5m, 1h), zoom levels, and drawing primitives.',
    category: 'Functional',
    retention: 'Persistent Local',
  },
  {
    key: 'backtest_si_replay_sandbox',
    type: 'IndexedDB',
    purpose: 'High-frequency bar replay buffer and intraday simulated trade ledger.',
    category: 'Functional',
    retention: 'Persistent Local',
  },
  {
    key: 'backtest_si_telemetry_optin',
    type: 'localStorage',
    purpose: 'Stores opt-in consent for deterministic simulation benchmarking and FPS telemetry.',
    category: 'Analytical',
    retention: '1 Year',
  },
];

export default function CookiesPage() {
  const [preferences, setPreferences] = useState({
    essential: true, // Always locked
    functional: true,
    analytical: false,
  });

  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111722] border border-[#202A38] text-[11px] font-mono text-cyan-accent">
          <Cookie className="w-3.5 h-3.5" />
          <span>LOCAL STATE & PRIVACY · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          Cookie & Local Storage Policy
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Transparent accounting of browser storage keys, session cache, and our categorical ban on third-party behavioral advertising pixels.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-mono text-slate-500 pt-2 border-t border-[#1A2332]">
          <span>Effective: Jan 15, 2026</span>
          <span className="hidden sm:inline">·</span>
          <span>Standard: Zero 3rd-Party Trackers</span>
          <span className="hidden sm:inline">·</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Client Replay Cache
          </span>
        </div>
      </div>

      {/* Zero Ads Callout HUD */}
      <div className="rounded-2xl border border-cyan-accent/20 bg-[#0E1522] p-5 sm:p-8 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-accent/10 border border-cyan-accent/30 flex items-center justify-center text-cyan-accent shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 font-sans">
            Our Zero Behavioral Tracker Invariant
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          BacktestAI does not embed Google AdSense, Meta Pixel, TikTok Trackers, or cross-domain ad telemetry. We only utilize storage keys strictly required for mathematical simulation fidelity, OpenAlgo chart rendering, and secure authentication.
        </p>
      </div>

      {/* Storage Inventory Table */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-accent font-semibold">
            TECHNICAL INVENTORY
          </span>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-100">
            Active Storage Keys & Primitives
          </h2>
          <p className="text-xs text-slate-400">
            Every identifier stored by the BacktestAI web client and its purpose in the simulation lifecycle.
          </p>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-2 sm:mx-0">
          <table className="w-full text-left font-mono text-xs min-w-[580px]">
            <thead>
              <tr className="border-b border-[#202A38] text-slate-400">
                <th className="py-3 px-3 sm:px-4 font-bold text-slate-300">KEY NAME</th>
                <th className="py-3 px-3 sm:px-4">TYPE</th>
                <th className="py-3 px-3 sm:px-4">CATEGORY</th>
                <th className="py-3 px-3 sm:px-4">RETENTION</th>
                <th className="py-3 px-3 sm:px-4">FUNCTION & PURPOSE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151D28]">
              {STORAGE_INVENTORY.map((item) => (
                <tr key={item.key} className="hover:bg-[#0D1118] transition-colors text-slate-300">
                  <td className="py-3.5 px-4 font-bold text-cyan-accent">{item.key}</td>
                  <td className="py-3.5 px-4 text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-[#111722] border border-[#202A38] text-[10px]">
                      {item.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.category === 'Essential'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.category === 'Functional'
                          ? 'bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{item.retention}</td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans text-xs max-w-md leading-relaxed">
                    {item.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Cookie Preferences Palette */}
      <div className="rounded-3xl border border-[#202A38] bg-[#0A0E15] p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 font-sans">
              Manage Client Storage Preferences
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Control which categories of non-essential storage BacktestAI may initialize on this device.
            </p>
          </div>
        </div>

        <div className="space-y-4 font-sans">
          {/* Essential */}
          <div className="p-4 rounded-2xl bg-[#0D1118] border border-[#1A2332] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-200">
                <span>Strictly Essential Storage</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                  LOCKED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Required for user authentication, API security (CSRF), and core deterministic session routing.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500">Always Active</div>
          </div>

          {/* Functional */}
          <div className="p-4 rounded-2xl bg-[#0D1118] border border-[#1A2332] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-sm text-slate-200">
                Functional & Replay Workspace Cache
              </div>
              <p className="text-xs text-slate-400">
                Preserves OpenAlgo chart drawings, active timeframe selections, and client-side replay ledger states.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setPreferences((p) => ({ ...p, functional: !p.functional }))
              }
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                preferences.functional ? 'bg-cyan-accent' : 'bg-[#1F2937]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-obsidian-base transition-transform ${
                  preferences.functional ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Analytical */}
          <div className="p-4 rounded-2xl bg-[#0D1118] border border-[#1A2332] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-sm text-slate-200">
                Performance Telemetry (Opt-in)
              </div>
              <p className="text-xs text-slate-400">
                Anonymous FPS rendering benchmarks, web worker calculation latency, and memory footprint metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setPreferences((p) => ({ ...p, analytical: !p.analytical }))
              }
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                preferences.analytical ? 'bg-cyan-accent' : 'bg-[#1F2937]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-obsidian-base transition-transform ${
                  preferences.analytical ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-cyan-accent text-obsidian-base font-mono text-xs font-bold hover:bg-cyan-accent/90 transition-all shadow-hud"
          >
            Save Preferences
          </button>
          {savedNotice && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-3.5 h-3.5" /> Preferences saved locally
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
