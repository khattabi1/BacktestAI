'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Rocket,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Coins,
  Globe2,
  BarChart3,
  Binary,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

// Step 1: Quant Profile
const PROFILES = [
  {
    id: 'systematic',
    title: 'Systematic Quant',
    desc: 'Algorithmic models, automated sweeps, and statistical edge.',
    icon: Binary,
  },
  {
    id: 'replay',
    title: 'Replay Trader',
    desc: 'Bar-by-bar replay, order flow, and discretionary execution.',
    icon: TrendingUp,
  },
  {
    id: 'hybrid',
    title: 'Hybrid Strategist',
    desc: 'Discretionary hypotheses synthesized into Python & MQL5 with AI.',
    icon: Sparkles,
  },
];

// Step 2: Primary Markets
const MARKETS = [
  { id: 'crypto', name: 'Crypto', pairs: 'BTC, ETH, SOL', icon: Coins },
  { id: 'fx', name: 'FX & Metals', pairs: 'EURUSD, GBPUSD, XAUUSD', icon: Globe2 },
  { id: 'indices', name: 'US Futures & Indices', pairs: 'NQ, ES, US30', icon: BarChart3 },
  { id: 'multi', name: 'Multi-Asset Portfolio', pairs: 'Cross-market universe', icon: Layers },
];

// Step 3: Strategy Language
const LANGUAGES = [
  {
    id: 'python',
    name: 'Python (Polars)',
    desc: 'Zero-copy columnar simulations & vectorized backtesting.',
    badge: 'Vectorized',
  },
  {
    id: 'mql5',
    name: 'MetaTrader 5 (MQL5)',
    desc: 'Production Expert Advisors with OnTick execution.',
    badge: 'EA Ready',
  },
  {
    id: 'hybrid',
    name: 'Dual Python & MQL5',
    desc: 'Prototype in Python, transpile to MQL5 with AI Co-Pilot.',
    badge: 'Recommended',
  },
];

const CAPITAL_OPTIONS = [10000, 50000, 100000, 250000];
const RISK_OPTIONS = ['0.5%', '1.0%', '2.0%'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, workspace, setWorkspace } = useAuthStore();

  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState('systematic');
  const [selectedMarket, setSelectedMarket] = useState('crypto');
  const [selectedLanguage, setSelectedLanguage] = useState('hybrid');
  const [capital, setCapital] = useState(100000);
  const [riskPerTrade, setRiskPerTrade] = useState('1.0%');
  const [workspaceName, setWorkspaceName] = useState(
    user?.full_name ? `${user.full_name.split(' ')[0]}'s Lab` : 'Quant Research Lab'
  );
  const [isFinishing, setIsFinishing] = useState(false);

  const handleNext = () => {
    if (step < 5) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleLaunch = async () => {
    setIsFinishing(true);

    try {
      // Store configured workspace in authStore
      setWorkspace({
        id: workspace?.id || 'ws_default_1',
        user_id: user?.id || 'usr_default',
        name: workspaceName,
        slug: workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        description: `${selectedProfile} | ${selectedMarket} | $${capital.toLocaleString('en-US')}`,
        is_default: 1,
      });

      // Brief transition before entering dashboard
      setTimeout(() => {
        router.push('/app');
      }, 700);
    } catch {
      router.push('/app');
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar & Header */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>STEP {step} OF 5</span>
          <span className="text-cyan-accent">
            {step === 1 && 'Role & Profile'}
            {step === 2 && 'Primary Markets'}
            {step === 3 && 'Strategy Language'}
            {step === 4 && 'Capital & Risk'}
            {step === 5 && 'Launch Lab'}
          </span>
        </div>
        <div className="h-1 w-full bg-[#111722] rounded-full overflow-hidden flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-full flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-cyan-accent shadow-sm' : 'bg-[#1C2533]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Quant Profile */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Select Your Trader Profile
            </h2>
            <p className="text-xs text-slate-400">
              Customize your default simulation engine and research tools.
            </p>
          </div>

          <div className="space-y-2.5">
            {PROFILES.map((p) => {
              const Icon = p.icon;
              const isSelected = selectedProfile === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProfile(p.id)}
                  className={`w-full p-3.5 rounded-lg border text-left transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-cyan-accent/10 border-cyan-accent shadow-sm'
                      : 'bg-[#111722] border-[#202A38] hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-cyan-accent text-[#080B10]'
                        : 'bg-[#080B10] border border-[#202A38] text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100">{p.title}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-accent" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Primary Markets */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Select Primary Markets
            </h2>
            <p className="text-xs text-slate-400">
              Choose instruments for your initial data partitions and watchlists.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MARKETS.map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMarket === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMarket(m.id)}
                  className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-cyan-accent/10 border-cyan-accent'
                      : 'bg-[#111722] border-[#202A38] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-cyan-accent' : 'text-slate-400'
                      }`}
                    />
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-accent" />}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-100 block">{m.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{m.pairs}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Strategy Language */}
      {step === 3 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Strategy Architecture
            </h2>
            <p className="text-xs text-slate-400">
              Select your primary coding environment and transpiler settings.
            </p>
          </div>

          <div className="space-y-2.5">
            {LANGUAGES.map((l) => {
              const isSelected = selectedLanguage === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLanguage(l.id)}
                  className={`w-full p-3.5 rounded-lg border text-left transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-accent/10 border-cyan-accent'
                      : 'bg-[#111722] border-[#202A38] hover:border-slate-600'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{l.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#080B10] border border-[#202A38] text-slate-300">
                        {l.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">{l.desc}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-accent shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Capital & Risk */}
      {step === 4 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Trading Defaults
            </h2>
            <p className="text-xs text-slate-400">
              Set default capital and position sizing for new simulations.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2">
                Initial Account Balance
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CAPITAL_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCapital(c)}
                    className={`py-2 px-3 rounded-lg border text-center font-mono text-sm transition-all ${
                      capital === c
                        ? 'bg-cyan-accent/10 border-cyan-accent text-cyan-accent font-semibold'
                        : 'bg-[#111722] border-[#202A38] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    ${c.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2">
                Default Risk Per Trade
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RISK_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiskPerTrade(r)}
                    className={`py-2 px-3 rounded-lg border text-center font-mono text-xs transition-all ${
                      riskPerTrade === r
                        ? 'bg-cyan-accent/10 border-cyan-accent text-cyan-accent font-semibold'
                        : 'bg-[#111722] border-[#202A38] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Launch Workspace */}
      {step === 5 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Ready to Launch
            </h2>
            <p className="text-xs text-slate-400">
              Confirm your research workspace details.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#111722] border border-[#202A38] space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                WORKSPACE NAME
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full px-3 py-2 bg-[#080B10] border border-[#202A38] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-accent font-sans"
              />
            </div>

            <div className="pt-2 border-t border-[#202A38] space-y-1.5 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Profile:</span>
                <span className="text-slate-200 capitalize">{selectedProfile}</span>
              </div>
              <div className="flex justify-between">
                <span>Market Focus:</span>
                <span className="text-slate-200 uppercase">{selectedMarket}</span>
              </div>
              <div className="flex justify-between">
                <span>Language:</span>
                <span className="text-slate-200 uppercase">{selectedLanguage}</span>
              </div>
              <div className="flex justify-between">
                <span>Default Balance:</span>
                <span className="text-cyan-accent">${capital.toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-2 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="py-2.5 px-4 min-h-[44px] rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            className="py-2.5 px-5 min-h-[44px] rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-xs hover:bg-cyan-300 transition-colors flex items-center justify-center gap-1.5 ml-auto shadow-sm cursor-pointer active:scale-95"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isFinishing}
            className="py-2.5 px-6 min-h-[44px] rounded-lg bg-cyan-accent text-[#080B10] font-semibold text-xs hover:bg-cyan-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ml-auto shadow-sm cursor-pointer active:scale-95"
          >
            {isFinishing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#080B10] border-t-transparent rounded-full animate-spin" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Launch Workspace</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
