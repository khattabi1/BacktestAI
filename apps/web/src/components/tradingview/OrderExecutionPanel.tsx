'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  PanelRightClose,
  PanelRightOpen,
  X,
  Plus,
  Minus,
  Check,
  Percent,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { OpenAlgoBar } from '@backtest-ai/chart';
import type { ReplayPosition, PositionSide } from '@backtest-ai/domain';
import { useSessionStore, calculateReplayPnl } from '@/stores/sessionStore';
import { SymbolLogo } from '@/components/common/SymbolLogo';

interface OrderExecutionPanelProps {
  currentBar: OpenAlgoBar | null;
  symbol: string;
  activePositions?: ReplayPosition[];
  currentBalance?: number;
  initialBalance?: number;
  isOpen: boolean;
  onToggle: () => void;
  onClosePosition?: (positionId: string) => void;
  onCloseAllPositions?: () => void;
  selectedChartSL?: number;
  selectedChartTP?: number;
  onOrderExecuted?: (details: {
    side: PositionSide;
    quantity: number;
    price: number;
    sl?: number;
    tp?: number;
  }) => void;
}

type OrderMode = 'MARKET' | 'PENDING';
type SizingMode = 'LOTS' | 'RISK_PCT';
type LevelMode = 'PIPS' | 'PRICE';

export function OrderExecutionPanel({
  currentBar,
  symbol,
  activePositions = [],
  currentBalance = 10000,
  initialBalance = 10000,
  isOpen,
  onToggle,
  onClosePosition,
  onCloseAllPositions,
  selectedChartSL,
  selectedChartTP,
  onOrderExecuted,
}: OrderExecutionPanelProps) {
  const {
    openReplayPosition,
    addPendingOrder,
    getActiveSession,
  } = useSessionStore();

  const activeSession = getActiveSession();

  // Mode: Market vs Pending
  const [orderMode, setOrderMode] = useState<OrderMode>('MARKET');

  // Sizing Mode: Lots vs % of Balance
  const [sizingMode, setSizingMode] = useState<SizingMode>('LOTS');
  const [lots, setLots] = useState<number>(0.1);
  const [riskPct, setRiskPct] = useState<number>(1.0);

  // Symbol Telemetry
  const isForex = symbol.includes('EUR') || symbol.includes('GBP') || (symbol.length === 6 && !symbol.includes('XAU'));
  const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL');

  const decimals = isForex ? 5 : isGold ? 2 : 2;
  const tickSize = isForex ? 0.0001 : 0.1;
  const pipSize = isForex ? 0.0001 : isGold ? 0.10 : 1.0;
  const contractSize = isGold ? 100 : isCrypto ? 1 : 100000;
  const leverage = activeSession?.config?.leverage || 100;

  // Real-time Prices (MT5 standard: Candle Close is Bid; Ask is Bid + Spread)
  const basePrice = currentBar ? currentBar.close : (
    isGold ? 2650.00 : isCrypto ? 65000.00 : isForex ? 1.08500 : 100.00
  );
  const spread = isForex ? 0.00015 : isGold ? 0.25 : 2.0;
  const bidPrice = Number(basePrice.toFixed(decimals));
  const askPrice = Number((basePrice + spread).toFixed(decimals));
  const spreadInPips = Number((spread / pipSize).toFixed(1));

  // Pending Target Price
  const [pendingTargetPrice, setPendingTargetPrice] = useState<string>(
    bidPrice.toFixed(decimals)
  );

  // Stop Loss State (Default 100 pips)
  const [enableSL, setEnableSL] = useState<boolean>(true);
  const [slMode, setSlMode] = useState<LevelMode>('PIPS');
  const [slPipsStr, setSlPipsStr] = useState<string>('100.0');
  const [slPriceStr, setSlPriceStr] = useState<string>('');
  const [isSlPriceManual, setIsSlPriceManual] = useState<boolean>(false);

  // Take Profit State (Default 100 pips)
  const [enableTP, setEnableTP] = useState<boolean>(true);
  const [tpMode, setTpMode] = useState<LevelMode>('PIPS');
  const [tpPipsStr, setTpPipsStr] = useState<string>('100.0');
  const [tpPriceStr, setTpPriceStr] = useState<string>('');
  const [isTpPriceManual, setIsTpPriceManual] = useState<boolean>(false);

  // Keep SL Price & Pips in sync
  const currentSlPips = parseFloat(slPipsStr) || 100;
  const currentTpPips = parseFloat(tpPipsStr) || 100;

  // Real-time price update on each tick: maintains 100 pips (or user-chosen pips) distance
  useEffect(() => {
    if (!isSlPriceManual) {
      const delta = currentSlPips * pipSize;
      setSlPriceStr((bidPrice - delta).toFixed(decimals));
    }
  }, [bidPrice, currentSlPips, pipSize, decimals, isSlPriceManual]);

  useEffect(() => {
    if (!isTpPriceManual) {
      const delta = currentTpPips * pipSize;
      setTpPriceStr((bidPrice + delta).toFixed(decimals));
    }
  }, [bidPrice, currentTpPips, pipSize, decimals, isTpPriceManual]);

  // Effective Lots Calculation
  const calculatedLots = useMemo(() => {
    if (sizingMode === 'LOTS') {
      return Math.max(0.01, Number(lots.toFixed(2)));
    }
    // Risk % mode: calculate lots from dollar risk
    const targetRiskDollar = currentBalance * (riskPct / 100);
    if (enableSL && currentSlPips > 0) {
      const priceRiskPerLot = (currentSlPips * pipSize) * contractSize;
      if (priceRiskPerLot > 0) {
        const computed = targetRiskDollar / priceRiskPerLot;
        return Math.max(0.01, Number(computed.toFixed(2)));
      }
    }
    // Fallback if no SL: use margin %
    const marginPerLot = (basePrice * contractSize) / leverage;
    if (marginPerLot > 0) {
      const computed = targetRiskDollar / marginPerLot;
      return Math.max(0.01, Number(computed.toFixed(2)));
    }
    return 0.1;
  }, [sizingMode, lots, riskPct, currentBalance, enableSL, currentSlPips, pipSize, contractSize, basePrice, leverage]);

  // Synchronize when chart SL / TP dragged
  useEffect(() => {
    if (selectedChartSL && selectedChartSL > 0) {
      setEnableSL(true);
      setSlPriceStr(selectedChartSL.toFixed(decimals));
      const pips = Math.abs(basePrice - selectedChartSL) / pipSize;
      setSlPipsStr(pips.toFixed(1));
    }
  }, [selectedChartSL, basePrice, pipSize, decimals]);

  useEffect(() => {
    if (selectedChartTP && selectedChartTP > 0) {
      setEnableTP(true);
      setTpPriceStr(selectedChartTP.toFixed(decimals));
      const pips = Math.abs(basePrice - selectedChartTP) / pipSize;
      setTpPipsStr(pips.toFixed(1));
    }
  }, [selectedChartTP, basePrice, pipSize, decimals]);

  // Handle SL Pips change
  const handleSlPipsChange = (valStr: string) => {
    setSlPipsStr(valStr);
    setIsSlPriceManual(false);
    const p = parseFloat(valStr);
    if (!isNaN(p) && p > 0) {
      const priceDelta = p * pipSize;
      const estimatedPrice = basePrice - priceDelta;
      setSlPriceStr(estimatedPrice.toFixed(decimals));
    }
  };

  // Handle SL Price change
  const handleSlPriceChange = (valStr: string) => {
    setSlPriceStr(valStr);
    setIsSlPriceManual(true);
    const pr = parseFloat(valStr);
    if (!isNaN(pr) && pr > 0) {
      const pips = Math.abs(basePrice - pr) / pipSize;
      setSlPipsStr(pips.toFixed(1));
    }
  };

  // Handle TP Pips change
  const handleTpPipsChange = (valStr: string) => {
    setTpPipsStr(valStr);
    setIsTpPriceManual(false);
    const p = parseFloat(valStr);
    if (!isNaN(p) && p > 0) {
      const priceDelta = p * pipSize;
      const estimatedPrice = basePrice + priceDelta;
      setTpPriceStr(estimatedPrice.toFixed(decimals));
    }
  };

  // Handle TP Price change
  const handleTpPriceChange = (valStr: string) => {
    setTpPriceStr(valStr);
    setIsTpPriceManual(true);
    const pr = parseFloat(valStr);
    if (!isNaN(pr) && pr > 0) {
      const pips = Math.abs(basePrice - pr) / pipSize;
      setTpPipsStr(pips.toFixed(1));
    }
  };

  // Direct Execution Handler: SELL or BUY
  const handleExecute = useCallback((side: PositionSide) => {
    const entryTimeStr = currentBar?.time
      ? (typeof currentBar.time === 'number' ? new Date(currentBar.time * 1000).toISOString() : String(currentBar.time))
      : new Date().toISOString();

    const executionPrice = side === 'LONG' ? askPrice : bidPrice;

    // Determine SL Price for this direction (Strictly enforce impossible case boundary)
    let slValue: number | undefined = undefined;
    if (enableSL) {
      const delta = currentSlPips * pipSize;
      if (slMode === 'PRICE' && parseFloat(slPriceStr)) {
        const pr = parseFloat(slPriceStr);
        if (side === 'LONG') {
          // LONG: SL must be strictly below executionPrice
          slValue = pr < executionPrice ? pr : Number((executionPrice - delta).toFixed(decimals));
        } else {
          // SHORT: SL must be strictly above executionPrice
          slValue = pr > executionPrice ? pr : Number((executionPrice + delta).toFixed(decimals));
        }
      } else if (currentSlPips > 0) {
        slValue = side === 'LONG'
          ? Number((executionPrice - delta).toFixed(decimals))
          : Number((executionPrice + delta).toFixed(decimals));
      }
    }

    // Determine TP Price for this direction (Strictly enforce impossible case boundary)
    let tpValue: number | undefined = undefined;
    if (enableTP) {
      const delta = currentTpPips * pipSize;
      if (tpMode === 'PRICE' && parseFloat(tpPriceStr)) {
        const pr = parseFloat(tpPriceStr);
        if (side === 'LONG') {
          // LONG: TP must be strictly above executionPrice
          tpValue = pr > executionPrice ? pr : Number((executionPrice + delta).toFixed(decimals));
        } else {
          // SHORT: TP must be strictly below executionPrice
          tpValue = pr < executionPrice ? pr : Number((executionPrice - delta).toFixed(decimals));
        }
      } else if (currentTpPips > 0) {
        tpValue = side === 'LONG'
          ? Number((executionPrice + delta).toFixed(decimals))
          : Number((executionPrice - delta).toFixed(decimals));
      }
    }

    if (orderMode === 'MARKET') {
      openReplayPosition({
        symbol,
        side,
        entryTime: entryTimeStr,
        entryPrice: executionPrice,
        quantity: calculatedLots,
        stopLoss: slValue,
        takeProfit: tpValue,
        initialBalance: currentBalance,
      });

      if (onOrderExecuted) {
        onOrderExecuted({
          side,
          quantity: calculatedLots,
          price: executionPrice,
          sl: slValue,
          tp: tpValue,
        });
      }
    } else {
      // Pending Limit / Stop
      const targetP = parseFloat(pendingTargetPrice) || executionPrice;
      const orderType = (side === 'LONG' && targetP < executionPrice) || (side === 'SHORT' && targetP > executionPrice)
        ? 'LIMIT'
        : 'STOP';

      addPendingOrder({
        symbol,
        orderType,
        side,
        targetPrice: targetP,
        quantity: calculatedLots,
        stopLoss: slValue,
        takeProfit: tpValue,
        createdAtTime: entryTimeStr,
      });

      if (onOrderExecuted) {
        onOrderExecuted({
          side,
          quantity: calculatedLots,
          price: targetP,
          sl: slValue,
          tp: tpValue,
        });
      }
    }
  }, [
    currentBar,
    askPrice,
    bidPrice,
    enableSL,
    slMode,
    slPriceStr,
    currentSlPips,
    pipSize,
    decimals,
    enableTP,
    tpMode,
    tpPriceStr,
    currentTpPips,
    orderMode,
    openReplayPosition,
    symbol,
    calculatedLots,
    currentBalance,
    pendingTargetPrice,
    addPendingOrder,
    onOrderExecuted,
  ]);

  // Risk & Reward Readouts for Display
  const estimatedRiskDollar = currentSlPips > 0
    ? currentSlPips * pipSize * calculatedLots * contractSize
    : 0;
  const estimatedRewardDollar = currentTpPips > 0
    ? currentTpPips * pipSize * calculatedLots * contractSize
    : 0;
  const riskRewardRatio = estimatedRiskDollar > 0
    ? (estimatedRewardDollar / estimatedRiskDollar).toFixed(1)
    : null;

  // Margin calculation
  const notionalValue = askPrice * calculatedLots * contractSize;
  const estimatedMargin = notionalValue / leverage;

  // Unrealized PnL across all open positions
  const totalOpenPnl = useMemo(() => {
    return activePositions.reduce((acc, pos) => {
      const exitPrice = pos.side === 'LONG' ? bidPrice : askPrice;
      return acc + calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
    }, 0);
  }, [activePositions, bidPrice, askPrice]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="w-8 h-full shrink-0 z-20 bg-[#090E17] hover:bg-[#0E1522] border-l border-[#1A2538] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2.5 select-none group"
        title="Open Order Execution Panel"
      >
        <PanelRightOpen className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
        <span className="text-[10px] font-mono font-bold uppercase [writing-mode:vertical-rl] tracking-widest text-slate-400 group-hover:text-cyan-300">
          ORDER PANEL
        </span>
      </button>
    );
  }

  return (
    <div className="w-84 sm:w-92 h-full shrink-0 z-20 bg-[#090E17] border-l border-[#1A2538] flex flex-col shadow-2xl select-none font-mono text-slate-200 overflow-hidden">
      {/* 1. Header Row */}
      <div className="h-10 px-3 bg-[#0C1320] border-b border-[#1A2538] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SymbolLogo symbol={symbol} size="xs" className="w-4 h-4" />
          <span className="font-bold text-xs text-slate-100 tracking-wide">
            {symbol}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#131D2E] text-slate-400 border border-[#1E2E44]">
            Spread: {spreadInPips}p
          </span>
        </div>

        <button
          onClick={onToggle}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-[#162030] transition-colors cursor-pointer"
          title="Collapse Order Panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">

        {/* 2. Order Mode Segment (MARKET | PENDING) */}
        <div className="grid grid-cols-2 p-0.5 rounded-lg bg-[#060A12] border border-[#162030]">
          <button
            onClick={() => setOrderMode('MARKET')}
            className={`py-1 rounded-md text-xs font-bold transition-all ${
              orderMode === 'MARKET'
                ? 'bg-[#152238] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MARKET
          </button>
          <button
            onClick={() => setOrderMode('PENDING')}
            className={`py-1 rounded-md text-xs font-bold transition-all ${
              orderMode === 'PENDING'
                ? 'bg-[#152238] text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIMIT / STOP
          </button>
        </div>

        {/* 3. Pending Target Price (only if PENDING) */}
        {orderMode === 'PENDING' && (
          <div className="p-2.5 rounded-lg bg-[#0C121D] border border-[#1A2538] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
              <span>Target Entry Price</span>
              <span className="text-cyan-400 font-mono">Current: {bidPrice.toFixed(decimals)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const curr = parseFloat(pendingTargetPrice) || bidPrice;
                  setPendingTargetPrice((curr - 10 * pipSize).toFixed(decimals));
                }}
                className="px-2 py-1.5 rounded bg-[#141E30] hover:bg-[#1C2B44] text-xs font-bold text-slate-300 border border-[#223552]"
              >
                -10p
              </button>
              <input
                type="number"
                step={pipSize}
                value={pendingTargetPrice}
                onChange={(e) => setPendingTargetPrice(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded bg-[#070B12] border border-[#223552] text-white font-bold text-center text-sm focus:outline-none focus:border-cyan-400 font-mono"
              />
              <button
                onClick={() => {
                  const curr = parseFloat(pendingTargetPrice) || bidPrice;
                  setPendingTargetPrice((curr + 10 * pipSize).toFixed(decimals));
                }}
                className="px-2 py-1.5 rounded bg-[#141E30] hover:bg-[#1C2B44] text-xs font-bold text-slate-300 border border-[#223552]"
              >
                +10p
              </button>
            </div>
          </div>
        )}

        {/* 4. Position Sizing: LOTS vs ACCOUNT RISK % */}
        <div className="p-2.5 rounded-lg bg-[#0C121D] border border-[#1A2538] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Position Sizing
            </span>

            {/* Sizing Mode Switcher */}
            <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#060A12] border border-[#162030] text-[10px]">
              <button
                onClick={() => setSizingMode('LOTS')}
                className={`px-2 py-0.5 rounded transition-all ${
                  sizingMode === 'LOTS'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lots
              </button>
              <button
                onClick={() => setSizingMode('RISK_PCT')}
                className={`px-2 py-0.5 rounded transition-all ${
                  sizingMode === 'RISK_PCT'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                % Risk
              </button>
            </div>
          </div>

          {sizingMode === 'LOTS' ? (
            <>
              {/* Stepper Input for Lots */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLots((prev) => Math.max(0.01, Number((prev - 0.05).toFixed(2))))}
                  className="w-8 h-8 rounded bg-[#141E30] hover:bg-[#1C2B44] border border-[#223552] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={lots}
                    onChange={(e) => setLots(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                    className="w-full py-1.5 px-3 rounded bg-[#070B12] border border-[#223552] text-white font-bold text-center text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <span className="absolute right-2 text-[10px] text-slate-500 font-bold uppercase pointer-events-none">
                    LOTS
                  </span>
                </div>

                <button
                  onClick={() => setLots((prev) => Number((prev + 0.05).toFixed(2)))}
                  className="w-8 h-8 rounded bg-[#141E30] hover:bg-[#1C2B44] border border-[#223552] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Lots Chips */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {[0.01, 0.05, 0.1, 0.5, 1.0].map((quickLot) => (
                  <button
                    key={quickLot}
                    onClick={() => setLots(quickLot)}
                    className={`py-1 rounded text-[10px] font-bold border transition-all ${
                      lots === quickLot
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-[#101724] text-slate-400 border-[#1A2538] hover:bg-[#162030]'
                    }`}
                  >
                    {quickLot}
                  </button>
                ))}
              </div>

              {/* Margin Readout */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#141E30]">
                <span>Est. Required Margin:</span>
                <span className="text-slate-200 font-mono font-bold">${estimatedMargin.toFixed(2)} (1:{leverage})</span>
              </div>
            </>
          ) : (
            <>
              {/* Stepper Input for Risk % */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRiskPct((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))))}
                  className="w-8 h-8 rounded bg-[#141E30] hover:bg-[#1C2B44] border border-[#223552] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="number"
                    step="0.25"
                    min="0.1"
                    max="100"
                    value={riskPct}
                    onChange={(e) => setRiskPct(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    className="w-full py-1.5 px-3 rounded bg-[#070B12] border border-[#223552] text-white font-bold text-center text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <span className="absolute right-2 text-[10px] text-slate-500 font-bold uppercase pointer-events-none">
                    %
                  </span>
                </div>

                <button
                  onClick={() => setRiskPct((prev) => Number((prev + 0.25).toFixed(2)))}
                  className="w-8 h-8 rounded bg-[#141E30] hover:bg-[#1C2B44] border border-[#223552] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Risk Chips */}
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {[0.5, 1.0, 2.0, 3.0].map((quickPct) => (
                  <button
                    key={quickPct}
                    onClick={() => setRiskPct(quickPct)}
                    className={`py-1 rounded text-[10px] font-bold border transition-all ${
                      riskPct === quickPct
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-[#101724] text-slate-400 border-[#1A2538] hover:bg-[#162030]'
                    }`}
                  >
                    {quickPct}%
                  </button>
                ))}
              </div>

              {/* Risk Summary Readout */}
              <div className="p-1.5 rounded bg-[#070B12] border border-[#1A2538] text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Risk Capital:</span>
                  <span className="text-amber-300 font-bold font-mono">
                    ${((currentBalance * riskPct) / 100).toFixed(2)} ({riskPct}% of balance)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Calculated Sizing:</span>
                  <span className="text-cyan-300 font-bold font-mono">
                    {calculatedLots} Lots {enableSL && currentSlPips > 0 ? '(SL calibrated)' : '(margin based)'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 5. Stop Loss Section */}
        <div className={`p-2.5 rounded-lg border transition-all ${
          enableSL ? 'bg-[#120B10] border-rose-900/40' : 'bg-[#0A0E17]/60 border-[#162030]'
        }`}>
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1C1620]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSL}
                onChange={(e) => setEnableSL(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-rose-500 focus:ring-0 focus:outline-none bg-[#070B12] border-slate-700"
              />
              <span className={`text-[11px] font-bold ${enableSL ? 'text-rose-300' : 'text-slate-400'}`}>
                Stop Loss
              </span>
            </label>

            {/* Pips vs Price Toggle */}
            {enableSL && (
              <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#070B12] border border-[#201520] text-[10px]">
                <button
                  onClick={() => setSlMode('PIPS')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    slMode === 'PIPS' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pips
                </button>
                <button
                  onClick={() => setSlMode('PRICE')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    slMode === 'PRICE' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Price
                </button>
              </div>
            )}
          </div>

          {enableSL && (
            <div className="pt-2 space-y-1.5">
              {slMode === 'PIPS' ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={slPipsStr}
                      onChange={(e) => handleSlPipsChange(e.target.value)}
                      placeholder="Pips"
                      className="w-full py-1 px-2.5 rounded bg-[#070B12] border border-rose-900/40 text-rose-200 font-mono font-bold text-xs focus:outline-none focus:border-rose-400"
                    />
                    <span className="absolute right-2 text-[10px] text-rose-400/60 font-bold">PIPS</span>
                  </div>
                  <div className="text-right text-[10px] font-mono text-rose-400 font-bold shrink-0">
                    -${estimatedRiskDollar.toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="number"
                      step={pipSize}
                      value={slPriceStr}
                      onChange={(e) => handleSlPriceChange(e.target.value)}
                      placeholder="SL Price"
                      className="w-full py-1 px-2.5 rounded bg-[#070B12] border border-rose-900/40 text-rose-200 font-mono font-bold text-xs focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div className="text-right text-[10px] font-mono text-rose-400 font-bold shrink-0">
                    {currentSlPips.toFixed(1)}p
                  </div>
                </div>
              )}

              {/* Quick Pip Chips for SL */}
              <div className="grid grid-cols-4 gap-1">
                {[15, 25, 50, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSlPipsChange(String(p))}
                    className="py-0.5 rounded bg-[#180E15] hover:bg-[#24131F] border border-rose-900/30 text-[10px] text-rose-300 font-bold"
                  >
                    {p}p
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 6. Take Profit Section */}
        <div className={`p-2.5 rounded-lg border transition-all ${
          enableTP ? 'bg-[#0A1411] border-emerald-900/40' : 'bg-[#0A0E17]/60 border-[#162030]'
        }`}>
          <div className="flex items-center justify-between pb-1.5 border-b border-[#14201A]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableTP}
                onChange={(e) => setEnableTP(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-0 focus:outline-none bg-[#070B12] border-slate-700"
              />
              <span className={`text-[11px] font-bold ${enableTP ? 'text-emerald-300' : 'text-slate-400'}`}>
                Take Profit
              </span>
            </label>

            {/* Pips vs Price Toggle */}
            {enableTP && (
              <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#070B12] border border-[#14201A] text-[10px]">
                <button
                  onClick={() => setTpMode('PIPS')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    tpMode === 'PIPS' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pips
                </button>
                <button
                  onClick={() => setTpMode('PRICE')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    tpMode === 'PRICE' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Price
                </button>
              </div>
            )}
          </div>

          {enableTP && (
            <div className="pt-2 space-y-1.5">
              {tpMode === 'PIPS' ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tpPipsStr}
                      onChange={(e) => handleTpPipsChange(e.target.value)}
                      placeholder="Pips"
                      className="w-full py-1 px-2.5 rounded bg-[#070B12] border border-emerald-900/40 text-emerald-200 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                    <span className="absolute right-2 text-[10px] text-emerald-400/60 font-bold">PIPS</span>
                  </div>
                  <div className="text-right text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                    +${estimatedRewardDollar.toFixed(2)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="number"
                      step={pipSize}
                      value={tpPriceStr}
                      onChange={(e) => handleTpPriceChange(e.target.value)}
                      placeholder="TP Price"
                      className="w-full py-1 px-2.5 rounded bg-[#070B12] border border-emerald-900/40 text-emerald-200 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="text-right text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                    {currentTpPips.toFixed(1)}p
                  </div>
                </div>
              )}

              {/* Quick Pip Chips for TP */}
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-4 gap-1 flex-1 mr-2">
                  {[30, 50, 100, 200].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleTpPipsChange(String(p))}
                      className="py-0.5 rounded bg-[#0C1A14] hover:bg-[#12281E] border border-emerald-900/30 text-[10px] text-emerald-300 font-bold"
                    >
                      {p}p
                    </button>
                  ))}
                </div>
                {riskRewardRatio && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A1612] border border-emerald-500/30 text-emerald-300 font-bold font-mono">
                    1:{riskRewardRatio} R:R
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 7. DIRECT ONE-CLICK EXECUTION BUTTONS (No intermediate side selecting!) */}
        <div className="pt-1 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase font-semibold text-center tracking-wider">
            One-Click Market Execution
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* DIRECT SELL BUTTON (Shows exact SL and TP preview) */}
            <button
              onClick={() => handleExecute('SHORT')}
              className="group p-2.5 rounded-xl bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] border border-rose-400 text-white shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-rose-100">
                <TrendingDown className="w-4 h-4 text-white" />
                <span>SELL</span>
              </div>
              <span className="text-base font-black font-mono tracking-tight my-0.5">
                {orderMode === 'MARKET' ? bidPrice.toFixed(decimals) : (parseFloat(pendingTargetPrice) || bidPrice).toFixed(decimals)}
              </span>
              <span className="text-[10px] font-bold text-rose-200/90 font-mono">
                {calculatedLots} Lots
              </span>
              {(enableSL || enableTP) && (
                <div className="mt-1 pt-1 border-t border-rose-400/30 flex items-center gap-1.5 text-[8.5px] font-mono font-semibold text-rose-200/90">
                  {enableSL && <span>SL: {(bidPrice + currentSlPips * pipSize).toFixed(decimals)}</span>}
                  {enableSL && enableTP && <span className="opacity-50">|</span>}
                  {enableTP && <span>TP: {(bidPrice - currentTpPips * pipSize).toFixed(decimals)}</span>}
                </div>
              )}
            </button>

            {/* DIRECT BUY BUTTON (Shows exact SL and TP preview) */}
            <button
              onClick={() => handleExecute('LONG')}
              className="group p-2.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] border border-emerald-400 text-white shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-emerald-100">
                <TrendingUp className="w-4 h-4 text-white" />
                <span>BUY</span>
              </div>
              <span className="text-base font-black font-mono tracking-tight my-0.5">
                {orderMode === 'MARKET' ? askPrice.toFixed(decimals) : (parseFloat(pendingTargetPrice) || askPrice).toFixed(decimals)}
              </span>
              <span className="text-[10px] font-bold text-emerald-200/90 font-mono">
                {calculatedLots} Lots
              </span>
              {(enableSL || enableTP) && (
                <div className="mt-1 pt-1 border-t border-emerald-400/30 flex items-center gap-1.5 text-[8.5px] font-mono font-semibold text-emerald-200/90">
                  {enableSL && <span>SL: {(askPrice - currentSlPips * pipSize).toFixed(decimals)}</span>}
                  {enableSL && enableTP && <span className="opacity-50">|</span>}
                  {enableTP && <span>TP: {(askPrice + currentTpPips * pipSize).toFixed(decimals)}</span>}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
