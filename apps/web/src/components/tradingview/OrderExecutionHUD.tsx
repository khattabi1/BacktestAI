'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  Zap,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';
import type { ChartTrade, OpenAlgoBar } from '@backtest-ai/chart';

interface OrderExecutionHUDProps {
  currentBar: OpenAlgoBar | null;
  symbol: string;
  onExecuteTrade: (trade: ChartTrade) => void;
  initialBalance?: number;
  currentBalance?: number;
}

export function OrderExecutionHUD({
  currentBar,
  symbol,
  onExecuteTrade,
  initialBalance = 100000,
  currentBalance = 100000,
}: OrderExecutionHUDProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [lotSize, setLotSize] = useState<number>(1.0);
  const [enableSL, setEnableSL] = useState<boolean>(true);
  const [enableTP, setEnableTP] = useState<boolean>(true);
  const [slPips, setSlPips] = useState<number>(symbol.includes('BTC') ? 500 : symbol.includes('XAU') ? 15 : 50);
  const [tpPips, setTpPips] = useState<number>(symbol.includes('BTC') ? 1200 : symbol.includes('XAU') ? 35 : 120);
  const [lastExecutedPill, setLastExecutedPill] = useState<string | null>(null);

  const isForex = symbol.includes('EUR') || symbol.includes('GBP');
  const decimals = isForex ? 5 : 2;
  const pipMultiplier = isForex ? 0.0001 : 1.0;

  // Base price from current bar or fallback
  const basePrice = currentBar ? currentBar.close : (
    symbol.includes('BTC') ? 64250 : symbol.includes('XAU') ? 2364 : symbol.includes('EUR') ? 1.0850 : 100
  );

  const spread = isForex ? 0.00015 : symbol.includes('BTC') ? 1.5 : 0.25;
  const bidPrice = Number((basePrice - spread / 2).toFixed(decimals));
  const askPrice = Number((basePrice + spread / 2).toFixed(decimals));

  // Calculated SL & TP levels for Long
  const longSL = enableSL ? Number((askPrice - slPips * pipMultiplier).toFixed(decimals)) : undefined;
  const longTP = enableTP ? Number((askPrice + tpPips * pipMultiplier).toFixed(decimals)) : undefined;

  // Calculated SL & TP levels for Short
  const shortSL = enableSL ? Number((bidPrice + slPips * pipMultiplier).toFixed(decimals)) : undefined;
  const shortTP = enableTP ? Number((bidPrice - tpPips * pipMultiplier).toFixed(decimals)) : undefined;

  // Live Risk:Reward ratio
  const riskRewardRatio = useMemo(() => {
    if (!enableSL || !enableTP || slPips <= 0) return 'N/A';
    return `1 : ${(tpPips / slPips).toFixed(2)}`;
  }, [enableSL, enableTP, slPips, tpPips]);

  const handleExecute = (side: 'LONG' | 'SHORT') => {
    const entryPrice = side === 'LONG' ? askPrice : bidPrice;
    const entryTime = currentBar ? currentBar.time : Math.floor(Date.now() / 1000);
    // Simulated exit 3 bars forward or 1 hour forward
    const exitTime = typeof entryTime === 'number' ? entryTime + 3600 * 3 : entryTime;
    const sl = side === 'LONG' ? longSL : shortSL;
    const tp = side === 'LONG' ? longTP : shortTP;

    // Simulate outcome based on risk/reward probability
    const isWin = Math.random() < 0.62;
    const exitPrice = isWin
      ? (tp || (side === 'LONG' ? entryPrice * 1.02 : entryPrice * 0.98))
      : (sl || (side === 'LONG' ? entryPrice * 0.99 : entryPrice * 1.01));

    const pnlMultiplier = isForex ? 100000 : 1;
    const priceDelta = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
    const rawPnl = priceDelta * lotSize * pnlMultiplier;
    const pnl = Number(rawPnl.toFixed(2));
    const pnlPercent = Number(((pnl / currentBalance) * 100).toFixed(2));

    const newTrade: ChartTrade = {
      id: `DISC-${Date.now().toString(36).toUpperCase()}`,
      side,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice: Number(exitPrice.toFixed(decimals)),
      quantity: lotSize,
      pnl,
      pnlPercent,
      exitReason: isWin ? 'TP' : 'SL',
      stopLoss: sl,
      takeProfit: tp,
    };

    onExecuteTrade(newTrade);

    const pillText = `${side} ${lotSize} @ ${entryPrice.toFixed(decimals)} (${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString('en-US')})`;
    setLastExecutedPill(pillText);
    setTimeout(() => setLastExecutedPill(null), 3500);
  };

  return (
    <div className="absolute top-4 right-4 z-20 font-mono select-none flex flex-col items-end gap-2">
      {/* Execution Feedback Notification Pill */}
      {lastExecutedPill && (
        <div className="px-3 py-1.5 rounded-lg bg-emerald-edge/20 border border-emerald-edge/50 text-emerald-edge text-xs font-semibold shadow-hud backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>ORDER FILLED: {lastExecutedPill}</span>
        </div>
      )}

      {/* Main Order Ticket Card */}
      <div className="w-72 rounded-xl bg-obsidian-card/95 border border-obsidian-border shadow-2xl backdrop-blur-md overflow-hidden transition-all">
        {/* Card Header */}
        <div className="px-3 py-2 bg-obsidian-sub/80 border-b border-obsidian-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-accent animate-pulse" />
            <span className="text-xs font-bold text-slate-text tracking-tight">ORDER TICKET</span>
            <span className="text-[10px] text-cyan-accent font-semibold px-1 rounded bg-cyan-accent/10">
              SIMULATOR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-muted">R:R {riskRewardRatio}</span>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-slate-muted hover:text-slate-text transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Ticket Body */}
        {isExpanded && (
          <div className="p-3 space-y-3 text-xs">
            {/* 1. Large Quick Execution Buttons (Bid / Ask) */}
            <div className="grid grid-cols-2 gap-2">
              {/* SELL Button (Bid) */}
              <button
                onClick={() => handleExecute('SHORT')}
                className="group relative p-2.5 rounded-lg bg-gradient-to-b from-crimson-risk/20 to-crimson-risk/35 hover:from-crimson-risk/30 hover:to-crimson-risk/50 border border-crimson-risk/60 text-slate-text shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-crimson-risk uppercase">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>SELL / SHORT</span>
                </div>
                <span className="text-sm font-bold text-slate-text">
                  {bidPrice.toLocaleString('en-US', { minimumFractionDigits: decimals })}
                </span>
                <span className="text-[9px] text-slate-muted font-sans">Bid Price</span>
              </button>

              {/* BUY Button (Ask) */}
              <button
                onClick={() => handleExecute('LONG')}
                className="group relative p-2.5 rounded-lg bg-gradient-to-b from-emerald-edge/20 to-emerald-edge/35 hover:from-emerald-edge/30 hover:to-emerald-edge/50 border border-emerald-edge/60 text-slate-text shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-edge uppercase">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>BUY / LONG</span>
                </div>
                <span className="text-sm font-bold text-slate-text">
                  {askPrice.toLocaleString('en-US', { minimumFractionDigits: decimals })}
                </span>
                <span className="text-[9px] text-slate-muted font-sans">Ask Price</span>
              </button>
            </div>

            {/* 2. Lot Size / Quantity Controls */}
            <div className="space-y-1.5 pt-1 border-t border-obsidian-border/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-muted">Position Size / Lots</span>
                <span className="text-slate-text font-bold">{lotSize} lot</span>
              </div>

              {/* Quick Lot Pills */}
              <div className="grid grid-cols-5 gap-1">
                {[0.1, 0.5, 1.0, 2.0, 5.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setLotSize(val)}
                    className={`py-1 rounded text-center text-[10px] font-mono transition-colors ${
                      lotSize === val
                        ? 'bg-cyan-accent text-obsidian-base font-bold shadow-hud'
                        : 'bg-obsidian-sub hover:bg-obsidian-elevated text-slate-subtext border border-obsidian-border'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Stop Loss & Take Profit Toggles */}
            <div className="space-y-2 pt-1 border-t border-obsidian-border/60 text-[11px]">
              {/* Stop Loss */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-subtext">
                  <input
                    type="checkbox"
                    checked={enableSL}
                    onChange={(e) => setEnableSL(e.target.checked)}
                    className="accent-crimson-risk rounded w-3 h-3 cursor-pointer"
                  />
                  <span className="text-crimson-risk flex items-center gap-1 font-semibold">
                    <Shield className="w-3 h-3" /> Stop Loss
                  </span>
                </label>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={slPips}
                    disabled={!enableSL}
                    onChange={(e) => setSlPips(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-1.5 py-0.5 rounded bg-obsidian-sub border border-obsidian-border text-slate-text text-right text-[11px] disabled:opacity-40 outline-none focus:border-crimson-risk"
                  />
                  <span className="text-slate-muted text-[10px]">pts</span>
                </div>
              </div>

              {/* Take Profit */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-subtext">
                  <input
                    type="checkbox"
                    checked={enableTP}
                    onChange={(e) => setEnableTP(e.target.checked)}
                    className="accent-emerald-edge rounded w-3 h-3 cursor-pointer"
                  />
                  <span className="text-emerald-edge flex items-center gap-1 font-semibold">
                    <Target className="w-3 h-3" /> Take Profit
                  </span>
                </label>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tpPips}
                    disabled={!enableTP}
                    onChange={(e) => setTpPips(Math.max(1, Number(e.target.value)))}
                    className="w-16 px-1.5 py-0.5 rounded bg-obsidian-sub border border-obsidian-border text-slate-text text-right text-[11px] disabled:opacity-40 outline-none focus:border-emerald-edge"
                  />
                  <span className="text-slate-muted text-[10px]">pts</span>
                </div>
              </div>
            </div>

            {/* Quick Session Capital Glance */}
            <div className="pt-2 border-t border-obsidian-border/60 flex items-center justify-between text-[10px] text-slate-muted">
              <span>Sim Capital:</span>
              <span className="font-bold text-slate-text">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
