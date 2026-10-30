'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Scale,
  ShieldAlert,
  Flame,
  Binary,
  Layers,
  HelpCircle,
  FileWarning,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: Binary,
    title: '1. Hypothetical & Simulated Performance Disclosure',
    content: `Hypothetical or simulated performance results have inherent limitations. Unlike an actual performance record, simulated results do not represent actual trading. Also, since the trades have not actually been executed, the results may have under- or over-compensated for the impact, if any, of certain market factors, such as lack of liquidity. 

Simulated trading programs in general are also subject to the fact that they are designed with the benefit of hindsight. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.`,
  },
  {
    icon: Layers,
    title: '2. The Overfitting & Data Snooping Hazard',
    content: `BacktestAI provides state-of-the-art forensic autopsy metrics (including Walk-Forward efficiency, Monte Carlo ruin probabilities, and regime degradation) specifically to combat the severe hazard of overfitting.

A strategy that displays an exceptional Sharpe ratio, low drawdown, and linear equity curve in historical backtesting may simply be over-parameterized to match past noise rather than genuine market inefficiencies. Multiple hypothesis testing ("p-hacking") without proper penalization almost always results in catastrophic failure upon live capital deployment.`,
  },
  {
    icon: Flame,
    title: '3. Execution Realities: Slippage, Spreads & Latency',
    content: `Our deterministic simulation engine incorporates realistic slippage models, spread schedules, and commission deductions. However, actual broker executions are subject to unpredictable market conditions:

• Queue Priority: Limit orders in backtests assume fill upon touching the price; in live order books, your order is queued behind existing resting liquidity.
• Gap Openings & Flash Crashes: Stop-loss orders do not guarantee execution at the specified stop price; they trigger market orders executed at the next available bid/ask.
• API Latency: Network transit time, exchange matching engine latency, and broker requotes cannot be completely predicted in simulated environments.`,
  },
  {
    icon: Scale,
    title: '4. No Investment Advice & Professional Consultation',
    content: `All content, indicators, mathematical formulas, documentation, and Claude AI strategy synthesis on BacktestAI are provided exclusively for quantitative research and educational purposes. 

BacktestAI does not manage customer funds, execute live orders on behalf of users, or recommend specific securities, futures contracts, currencies, or digital assets. You should consult with a certified financial advisor before risking real capital in live financial markets.`,
  },
];

export default function DisclaimerPage() {
  return (
    <div className="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-16">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#201314] border border-red-500/30 text-[11px] font-mono text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>STATUTORY RISK DISCLOSURES · BACKTESTAI</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100">
          Quantitative Trading & Risk Disclaimer
        </h1>
        <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
          Statutory regulatory disclosures, hypothetical simulation disclosures, and mandatory quantitative risk disclosures governing algorithmic trading systems.
        </p>
      </div>

      {/* Statutory CFTC Rule 4.41 Box */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl border border-red-500/30 bg-[#0E0B0F] p-5 sm:p-8 md:p-10 space-y-4 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
            <FileWarning className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-red-400 font-bold">
              REGULATORY COMPLIANCE MANDATE
            </div>
            <h2 className="text-base sm:text-xl font-bold text-slate-100 font-sans">
              CFTC RULE 4.41 — HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS
            </h2>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-sans border-t border-[#261719] pt-4">
          <p className="font-semibold text-slate-200">
            HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN INHERENT LIMITATIONS. UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT ACTUALLY BEEN EXECUTED, THE RESULTS MAY HAVE UNDER- OR OVER-COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY.
          </p>
          <p className="text-slate-400 text-xs">
            SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFITS OR LOSSES SIMILAR TO THOSE SHOWN.
          </p>
        </div>
      </motion.div>

      {/* Deep Risk Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        {SECTIONS.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <motion.div
              key={sec.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="rounded-2xl border border-[#202A38] bg-[#0A0E15] p-5 sm:p-7 space-y-3 sm:space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-[#1A2332] pb-3">
                <div className="w-8 h-8 rounded-lg bg-[#111722] border border-[#202A38] flex items-center justify-center text-cyan-accent shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-100 text-sm sm:text-base font-sans">{sec.title}</h3>
              </div>
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                {sec.content}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Quantitative Autopsy Notice */}
      <div className="rounded-2xl border border-[#202A38] bg-[#0D1118] p-5 sm:p-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="text-sm font-bold text-slate-100 font-sans">
            Combat Overfitting in the Forensic Autopsy Room
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Use our 1,000-path Monte Carlo stress tests and 12-window Walk-Forward degradations to scientifically assess whether your trading edge is robust before deploying capital.
          </p>
        </div>
        <Link
          href="/features/analytics"
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#151C27] hover:bg-[#1C2636] border border-[#202A38] text-cyan-accent font-mono text-xs font-semibold transition-all shrink-0 flex items-center justify-center"
        >
          Explore Autopsy Engine →
        </Link>
      </div>
    </div>
  );
}
