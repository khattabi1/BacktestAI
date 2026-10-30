'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';

export interface OrderPodProps {
  balance?: number;
  bid?: number;
  ask?: number;
  pipSize?: number;
  pipValuePerLot?: number;
  decimals?: number;
  symbol?: string;
  onExecuteOrder?: (order: {
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'STOP';
    entryPrice: number;
    lots: number;
    slPrice: number;
    tpPrice: number;
    slPips: number;
    tpPips: number;
    riskAmount: number;
  }) => void;
}

export function OrderPod({
  balance = 100000,
  bid = 1.08492,
  ask = 1.08500,
  pipSize: customPipSize,
  pipValuePerLot: customPipValuePerLot,
  decimals: customDecimals,
  symbol = 'EURUSD',
  onExecuteOrder,
}: OrderPodProps) {
  // 1. Symbol Detection & Asset Specifications
  const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
  const isCrypto = symbol.toUpperCase().includes('BTC') || symbol.toUpperCase().includes('ETH') || symbol.toUpperCase().includes('SOL');
  const isJpy = symbol.toUpperCase().includes('JPY');

  const decimals = customDecimals ?? (isGold ? 2 : isCrypto ? 2 : isJpy ? 3 : 5);
  const pipSize = customPipSize ?? (isGold ? 0.10 : isCrypto ? 1.0 : isJpy ? 0.01 : 0.0001);
  const pipValuePerLot = customPipValuePerLot ?? (isGold ? 10 : isCrypto ? 1 : 10);

  // 2. Persistent State from LocalStorage (default SL/TP pips = 100)
  const [slPips, setSlPips] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backtest_order_sl_pips');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 100;
  });

  const [tpPips, setTpPips] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backtest_order_tp_pips');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 100;
  });

  const [lots, setLots] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backtest_order_lots');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 0.01;
  });

  const [riskPercent, setRiskPercent] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backtest_order_risk_pct');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 1.0;
  });

  const [sizeMode, setSizeMode] = useState<'LOTS' | 'PERCENT'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backtest_order_size_mode');
      if (saved === 'LOTS' || saved === 'PERCENT') return saved;
    }
    return 'LOTS';
  });

  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(bid);
  const [offsetPips, setOffsetPips] = useState<number>(5);

  // Update limitPrice when bid changes if in MARKET mode
  useEffect(() => {
    if (orderType === 'MARKET') {
      setLimitPrice(bid);
    }
  }, [bid, orderType]);

  // Local input edit states to allow smooth manual typing into prices without jitter
  const [slPriceInput, setSlPriceInput] = useState<string>('');
  const [isSlPriceFocused, setIsSlPriceFocused] = useState<boolean>(false);

  const [tpPriceInput, setTpPriceInput] = useState<string>('');
  const [isTpPriceFocused, setIsTpPriceFocused] = useState<boolean>(false);

  // Persistence helpers
  const updateSlPips = (val: number) => {
    const clamped = Math.max(1, Math.round(val));
    setSlPips(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('backtest_order_sl_pips', String(clamped));
    }
  };

  const updateTpPips = (val: number) => {
    const clamped = Math.max(1, Math.round(val));
    setTpPips(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('backtest_order_tp_pips', String(clamped));
    }
  };

  const updateLots = (val: number) => {
    const clamped = Number(Math.max(0.01, val).toFixed(2));
    setLots(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('backtest_order_lots', String(clamped));
    }
  };

  const updateRiskPercent = (val: number) => {
    const clamped = Number(Math.max(0.01, val).toFixed(2));
    setRiskPercent(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('backtest_order_risk_pct', String(clamped));
    }
  };

  const updateSizeMode = (mode: 'LOTS' | 'PERCENT') => {
    setSizeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('backtest_order_size_mode', mode);
    }
  };

  // Base Entry Reference Price
  const baseEntry = orderType === 'MARKET' ? ask : limitPrice;
  const sellEntry = orderType === 'MARKET' ? bid : limitPrice;
  const buyEntry = orderType === 'MARKET' ? ask : limitPrice;

  // Real-time spread in pips
  const spreadPips = useMemo(() => {
    return Number(Math.max(0, (ask - bid) / pipSize).toFixed(1));
  }, [ask, bid, pipSize]);

  // Dynamic effective lots & dollar values
  const effectiveLots = useMemo(() => {
    if (sizeMode === 'LOTS') {
      return Number(Math.max(0.01, lots).toFixed(2));
    }
    const targetDollar = (balance * riskPercent) / 100;
    const calculatedLots = targetDollar / (Math.max(1, slPips) * pipValuePerLot);
    return Number(Math.max(0.01, calculatedLots).toFixed(2));
  }, [sizeMode, lots, balance, riskPercent, slPips, pipValuePerLot]);

  const riskDollar = useMemo(() => {
    return Number((effectiveLots * slPips * pipValuePerLot).toFixed(2));
  }, [effectiveLots, slPips, pipValuePerLot]);

  const rewardDollar = useMemo(() => {
    return Number((effectiveLots * tpPips * pipValuePerLot).toFixed(2));
  }, [effectiveLots, tpPips, pipValuePerLot]);

  const effectiveRiskPercent = useMemo(() => {
    return Number(((riskDollar / balance) * 100).toFixed(2));
  }, [riskDollar, balance]);

  // Synchronized prices: calculated based on baseEntry and pips
  const calculatedSlPrice = useMemo(() => {
    return Number((baseEntry - slPips * pipSize).toFixed(decimals));
  }, [baseEntry, slPips, pipSize, decimals]);

  const calculatedTpPrice = useMemo(() => {
    return Number((baseEntry + tpPips * pipSize).toFixed(decimals));
  }, [baseEntry, tpPips, pipSize, decimals]);

  // Manual price input handlers with bidirectional sync to pips
  const handleSlPriceChange = (valStr: string) => {
    setSlPriceInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed !== baseEntry) {
      const diffPips = Math.max(1, Math.round(Math.abs(baseEntry - parsed) / pipSize));
      updateSlPips(diffPips);
    }
  };

  const handleTpPriceChange = (valStr: string) => {
    setTpPriceInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed !== baseEntry) {
      const diffPips = Math.max(1, Math.round(Math.abs(parsed - baseEntry) / pipSize));
      updateTpPips(diffPips);
    }
  };

  return (
    <div className="w-full bg-[#090E17]/95 backdrop-blur-md rounded-2xl border border-[#1A2538] text-slate-200 font-mono select-none overflow-hidden shadow-2xl transition-all duration-200">
      {/* 1. TOP EXECUTION ROW */}
      <div className="p-3 flex items-stretch gap-2">
        {/* SELL CARD */}
        <button
          type="button"
          onClick={() =>
            onExecuteOrder?.({
              side: 'SELL',
              orderType,
              entryPrice: sellEntry,
              lots: effectiveLots,
              slPrice: Number((sellEntry + slPips * pipSize).toFixed(decimals)),
              tpPrice: Number((sellEntry - tpPips * pipSize).toFixed(decimals)),
              slPips,
              tpPips,
              riskAmount: riskDollar,
            })
          }
          className="flex-1 bg-[#0D1522] hover:bg-rose-950/25 border border-[#1E2E44] hover:border-rose-500/60 rounded-xl p-2.5 flex flex-col justify-between items-start transition-all duration-200 group cursor-pointer relative overflow-hidden"
          title={`Click to Execute SELL ${orderType} at ${sellEntry.toFixed(decimals)}`}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-500/0 group-hover:bg-rose-500 transition-all duration-200" />

          <div className="w-full flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider text-slate-400 group-hover:text-rose-300 transition-colors">
              SELL {orderType}
            </span>
            <span className="text-sm font-black text-rose-500/70 group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all">
              ↘
            </span>
          </div>

          <div className="mt-2 w-full text-left">
            <span className="text-[15px] font-black text-slate-100 group-hover:text-rose-200 tracking-tight font-mono transition-colors">
              {sellEntry.toFixed(decimals)}
            </span>
          </div>
        </button>

        {/* MIDDLE SIZING & SPREAD CARD (Editable Lot / % Input) */}
        <div className="w-[124px] shrink-0 bg-[#0C1320] border border-[#1A2638] rounded-xl p-2 flex flex-col items-center justify-between">
          {/* Sizing Mode Toggle */}
          <div className="w-full grid grid-cols-2 gap-1 p-0.5 bg-[#080D15] rounded-lg border border-[#141E2E]">
            <button
              type="button"
              onClick={() => updateSizeMode('LOTS')}
              className={`text-[9px] font-bold py-0.5 rounded transition-colors text-center ${
                sizeMode === 'LOTS'
                  ? 'bg-[#18263E] text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LOTS
            </button>
            <button
              type="button"
              onClick={() => updateSizeMode('PERCENT')}
              className={`text-[9px] font-bold py-0.5 rounded transition-colors text-center ${
                sizeMode === 'PERCENT'
                  ? 'bg-[#18263E] text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              % BAL
            </button>
          </div>

          {/* Stepper with WRITABLE INPUT */}
          <div className="w-full flex items-center justify-between gap-1 mt-1.5">
            <button
              type="button"
              onClick={() => (sizeMode === 'LOTS' ? updateLots(lots - 0.01) : updateRiskPercent(riskPercent - 0.25))}
              className="w-5 h-5 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-300 hover:text-white flex items-center justify-center transition-colors text-xs font-bold shrink-0"
              title="Decrease size"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              type="number"
              step={sizeMode === 'LOTS' ? '0.01' : '0.1'}
              min="0.01"
              value={sizeMode === 'LOTS' ? lots : riskPercent}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  if (sizeMode === 'LOTS') updateLots(val);
                  else updateRiskPercent(val);
                }
              }}
              className="w-14 bg-[#080D15] border border-[#162234] focus:border-cyan-500/60 rounded px-1 py-0.5 text-center text-xs font-black text-slate-100 font-mono tracking-tight focus:outline-none transition-colors"
            />

            <button
              type="button"
              onClick={() => (sizeMode === 'LOTS' ? updateLots(lots + 0.01) : updateRiskPercent(riskPercent + 0.25))}
              className="w-5 h-5 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-300 hover:text-white flex items-center justify-center transition-colors text-xs font-bold shrink-0"
              title="Increase size"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Telemetry Subtext: Risk Dollar & Real-time Spread */}
          <div className="mt-1 flex items-center justify-between w-full px-0.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-400">
              {effectiveRiskPercent}% (${riskDollar})
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 font-bold" title="Broker Spread">
              {spreadPips}p
            </span>
          </div>
        </div>

        {/* BUY CARD */}
        <button
          type="button"
          onClick={() =>
            onExecuteOrder?.({
              side: 'BUY',
              orderType,
              entryPrice: buyEntry,
              lots: effectiveLots,
              slPrice: Number((buyEntry - slPips * pipSize).toFixed(decimals)),
              tpPrice: Number((buyEntry + tpPips * pipSize).toFixed(decimals)),
              slPips,
              tpPips,
              riskAmount: riskDollar,
            })
          }
          className="flex-1 bg-[#0D1522] hover:bg-emerald-950/25 border border-[#1E2E44] hover:border-emerald-500/60 rounded-xl p-2.5 flex flex-col justify-between items-start transition-all duration-200 group cursor-pointer relative overflow-hidden"
          title={`Click to Execute BUY ${orderType} at ${buyEntry.toFixed(decimals)}`}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500/0 group-hover:bg-emerald-500 transition-all duration-200" />

          <div className="w-full flex items-center justify-between">
            <span className="text-sm font-black text-emerald-400/80 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">
              ↗
            </span>
            <span className="text-[11px] font-extrabold tracking-wider text-slate-400 group-hover:text-emerald-300 transition-colors">
              BUY {orderType}
            </span>
          </div>

          <div className="mt-2 w-full text-right">
            <span className="text-[15px] font-black text-slate-100 group-hover:text-emerald-200 tracking-tight font-mono transition-colors">
              {buyEntry.toFixed(decimals)}
            </span>
          </div>
        </button>
      </div>

      {/* 2. FIXED CONTROLS SECTION (Middle strip removed, bottom risk bar removed) */}
      <div className="px-3 pb-3 space-y-2.5 border-t border-[#141E2E] pt-2.5 bg-[#080D15]/60">
        {/* Order Execution Mode Selector */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">
            ORDER EXECUTION MODE
          </span>

          <div className="flex items-center gap-1 bg-[#0A0F1A] p-0.5 rounded-lg border border-[#162234]">
            {(['MARKET', 'LIMIT', 'STOP'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOrderType(mode)}
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded transition-colors ${
                  orderType === mode
                    ? 'bg-[#18263E] text-cyan-300 border border-cyan-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Limit / Stop Target Price & Offset (when mode !== 'MARKET') */}
        {orderType !== 'MARKET' && (
          <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-150">
            {/* Price Input */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl p-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">
                {orderType === 'LIMIT' ? 'LIMIT' : 'STOP'} PRICE
              </span>
              <input
                type="number"
                step={pipSize}
                value={limitPrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setLimitPrice(Number(val.toFixed(decimals)));
                }}
                className="w-24 bg-[#080D16] border border-[#162234] focus:border-cyan-500/60 rounded px-1.5 py-0.5 text-right text-xs font-black text-cyan-300 font-mono focus:outline-none"
              />
            </div>

            {/* Offset Input */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl p-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">OFFSET</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={offsetPips}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) setOffsetPips(Math.round(val));
                  }}
                  className="w-12 bg-[#080D16] border border-[#162234] focus:border-cyan-500/60 rounded px-1 py-0.5 text-center text-xs font-black text-slate-100 font-mono focus:outline-none"
                />
                <span className="text-[9px] text-slate-500 font-semibold">PIPS</span>
              </div>
            </div>
          </div>
        )}

        {/* STOP LOSS & TAKE PROFIT (2 Columns with fully writable inputs) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* STOP LOSS COLUMN */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
                <span className="text-[10px] font-extrabold text-slate-300 tracking-wider">
                  STOP LOSS
                </span>
              </div>
              <span className="text-[10px] font-black text-rose-400 font-mono">
                -${riskDollar}
              </span>
            </div>

            {/* SL PIPS WRITABLE INPUT + STEPPERS */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">PIPS</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateSlPips(slPips - 5)}
                  className="w-4 h-4 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={slPips}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 1) updateSlPips(val);
                  }}
                  className="w-14 bg-[#080D16] border border-[#162234] focus:border-rose-500/60 rounded px-1 py-0.5 text-center text-xs font-black text-slate-100 font-mono focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => updateSlPips(slPips + 5)}
                  className="w-4 h-4 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* SL PRICE WRITABLE INPUT (BIDIRECTIONAL SYNC TO PIPS) */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">PRICE</span>
              <input
                type="number"
                step={pipSize}
                value={isSlPriceFocused ? slPriceInput : calculatedSlPrice.toFixed(decimals)}
                onFocus={() => {
                  setIsSlPriceFocused(true);
                  setSlPriceInput(calculatedSlPrice.toFixed(decimals));
                }}
                onBlur={() => setIsSlPriceFocused(false)}
                onChange={(e) => handleSlPriceChange(e.target.value)}
                className="w-24 bg-[#080D16] border border-[#162234] focus:border-rose-500/60 rounded px-1.5 py-0.5 text-right text-xs font-black text-rose-300 font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* TAKE PROFIT COLUMN */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                <span className="text-[10px] font-extrabold text-slate-300 tracking-wider">
                  TAKE PROFIT
                </span>
              </div>
              <span className="text-[10px] font-black text-emerald-400 font-mono">
                +${rewardDollar}
              </span>
            </div>

            {/* TP PIPS WRITABLE INPUT + STEPPERS */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">PIPS</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateTpPips(tpPips - 5)}
                  className="w-4 h-4 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={tpPips}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 1) updateTpPips(val);
                  }}
                  className="w-14 bg-[#080D16] border border-[#162234] focus:border-emerald-500/60 rounded px-1 py-0.5 text-center text-xs font-black text-slate-100 font-mono focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => updateTpPips(tpPips + 5)}
                  className="w-4 h-4 rounded bg-[#131D2D] hover:bg-[#1A2940] text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* TP PRICE WRITABLE INPUT (BIDIRECTIONAL SYNC TO PIPS) */}
            <div className="bg-[#0C1320] border border-[#1A2638] rounded-xl px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">PRICE</span>
              <input
                type="number"
                step={pipSize}
                value={isTpPriceFocused ? tpPriceInput : calculatedTpPrice.toFixed(decimals)}
                onFocus={() => {
                  setIsTpPriceFocused(true);
                  setTpPriceInput(calculatedTpPrice.toFixed(decimals));
                }}
                onBlur={() => setIsTpPriceFocused(false)}
                onChange={(e) => handleTpPriceChange(e.target.value)}
                className="w-24 bg-[#080D16] border border-[#162234] focus:border-emerald-500/60 rounded px-1.5 py-0.5 text-right text-xs font-black text-emerald-300 font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default OrderPod;
