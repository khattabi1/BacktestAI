'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { ReplayPosition, PendingOrder, Trade } from '@backtest-ai/domain';
import { calculateReplayPnl } from '@/stores/sessionStore';

export interface BottomOrdersBlotterProps {
  activePositions: ReplayPosition[];
  pendingOrders: PendingOrder[];
  trades: Trade[];
  currentPrice: number;
  bidPrice?: number;
  askPrice?: number;
  decimals?: number;
  balance?: number;
  symbol?: string;
  onClosePosition: (positionId: string) => void;
  onPartialClosePosition?: (positionId: string, quantity: number) => void;
  onCancelPendingOrder: (orderId: string) => void;
}

export function BottomOrdersBlotter({
  activePositions = [],
  pendingOrders = [],
  trades = [],
  currentPrice = 0,
  bidPrice,
  askPrice,
  decimals = 2,
  balance = 100000,
  symbol = 'EURUSD',
  onClosePosition,
  onPartialClosePosition,
  onCancelPendingOrder,
}: BottomOrdersBlotterProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false;
    }
    return true;
  });
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [partialMenuPosId, setPartialMenuPosId] = useState<string | null>(null);
  const [customLotsInput, setCustomLotsInput] = useState<string>('');

  // Total Floating PnL across active positions
  const totalFloatingPnl = useMemo(() => {
    return activePositions.reduce((sum, pos) => {
      const exitPrice = pos.side === 'LONG' ? (bidPrice ?? currentPrice) : (askPrice ?? currentPrice);
      return sum + calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
    }, 0);
  }, [activePositions, bidPrice, askPrice, currentPrice]);

  const equity = Number((balance + totalFloatingPnl).toFixed(2));

  // Closed Trades Stats
  const totalRealizedPnl = useMemo(() => {
    return trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [trades]);

  const winRate = useMemo(() => {
    if (trades.length === 0) return 0;
    const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
    return Number(((wins / trades.length) * 100).toFixed(1));
  }, [trades]);

  return (
    <div className="w-full bg-[#080D16] border-t border-[#1A2538] flex flex-col shrink-0 select-none font-mono z-30 transition-all duration-200">
      {/* 1. BLOTTER HEADER STRIP */}
      <div className="h-8 px-3 bg-[#0A0F1A] border-b border-[#141E2E] flex items-center justify-between text-xs">
        {/* Left Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('positions');
              if (!isOpen) setIsOpen(true);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'positions' && isOpen
                ? 'bg-[#16243A] text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#101724]'
            }`}
          >
            <span>Positions</span>
            <span
              className={`px-1 py-0.2 rounded text-[10px] font-black ${
                activePositions.length > 0
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {activePositions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              if (!isOpen) setIsOpen(true);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'orders' && isOpen
                ? 'bg-[#16243A] text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#101724]'
            }`}
          >
            <span>Orders</span>
            <span
              className={`px-1 py-0.2 rounded text-[10px] font-black ${
                pendingOrders.length > 0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {pendingOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              if (!isOpen) setIsOpen(true);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'history' && isOpen
                ? 'bg-[#16243A] text-cyan-300 border border-cyan-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#101724]'
            }`}
          >
            <span>History</span>
            <span
              className={`px-1 py-0.2 rounded text-[10px] font-black ${
                trades.length > 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {trades.length}
            </span>
          </button>
        </div>

        {/* Right Financial Telemetry + Collapse Toggle */}
        <div className="flex items-center gap-3 text-[11px]">
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Balance:</span>
              <span className="font-bold text-slate-100 font-mono">
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="h-3 w-px bg-[#1A2538]" />

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Equity:</span>
              <span className="font-bold text-slate-100 font-mono">
                ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="h-3 w-px bg-[#1A2538]" />

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Floating:</span>
              <span
                className={`font-black font-mono ${
                  totalFloatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalFloatingPnl >= 0 ? `+$${totalFloatingPnl.toFixed(2)}` : `-$${Math.abs(totalFloatingPnl).toFixed(2)}`}
              </span>
            </div>

            <div className="h-3 w-px bg-[#1A2538]" />

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Win Rate:</span>
              <span className="font-bold text-cyan-300 font-mono">{winRate}%</span>
            </div>
          </div>

          <div className="h-3 w-px bg-[#1A2538]" />

          {/* Expand / Minimize Toggle */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#162234] transition-colors cursor-pointer"
            title={isOpen ? 'Minimize Panel' : 'Expand Panel'}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT (EXPANDED DOCK TABLE) */}
      {isOpen && (
        <div className="h-[155px] overflow-y-auto overflow-x-auto custom-scrollbar p-1 text-[11px] bg-[#070B12]">
          {/* TAB 1: ACTIVE POSITIONS */}
          {activeTab === 'positions' && (
            activePositions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                <span>No active open positions.</span>
                <span className="text-[10px] text-slate-400">
                  Execute a BUY or SELL from the Order Pod on the right to start trading.
                </span>
              </div>
            ) : (
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] border-b border-[#141E2E] pb-1">
                    <th className="py-1 px-2 font-bold">TICKET</th>
                    <th className="py-1 px-2 font-bold">SIDE</th>
                    <th className="py-1 px-2 font-bold">LOTS</th>
                    <th className="py-1 px-2 font-bold">SYMBOL</th>
                    <th className="py-1 px-2 font-bold">OPEN PRICE</th>
                    <th className="py-1 px-2 font-bold">CURRENT</th>
                    <th className="py-1 px-2 font-bold">S / L</th>
                    <th className="py-1 px-2 font-bold">T / P</th>
                    <th className="py-1 px-2 font-bold text-right">PROFIT ($)</th>
                    <th className="py-1 px-2 font-bold text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F1726]">
                  {activePositions.map((pos, idx) => {
                    const exitPrice = pos.side === 'LONG' ? (bidPrice ?? currentPrice) : (askPrice ?? currentPrice);
                    const posPnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);

                    return (
                      <tr key={pos.id} className="hover:bg-[#0D1524] transition-colors group">
                        <td className="py-1 px-2 text-slate-400 font-mono">#{idx + 1}</td>
                        <td className="py-1 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              pos.side === 'LONG'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-1 px-2 font-bold text-slate-200">{pos.quantity.toFixed(2)}</td>
                        <td className="py-1 px-2 font-bold text-slate-100">{pos.symbol}</td>
                        <td className="py-1 px-2 text-slate-300 font-mono">{pos.entryPrice.toFixed(decimals)}</td>
                        <td className="py-1 px-2 text-slate-300 font-mono">{exitPrice.toFixed(decimals)}</td>
                        <td className="py-1 px-2 text-rose-300/90 font-mono">
                          {pos.stopLoss ? pos.stopLoss.toFixed(decimals) : '-'}
                        </td>
                        <td className="py-1 px-2 text-emerald-300/90 font-mono">
                          {pos.takeProfit ? pos.takeProfit.toFixed(decimals) : '-'}
                        </td>
                        <td
                          className={`py-1 px-2 font-black font-mono text-right ${
                            posPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {posPnl >= 0 ? `+$${posPnl.toFixed(2)}` : `-$${Math.abs(posPnl).toFixed(2)}`}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <div className="relative inline-flex items-center justify-center gap-1">
                            {/* 1. Quick Inline 50% Partial Close */}
                            {onPartialClosePosition && pos.quantity > 0.01 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const half = Number((pos.quantity * 0.5).toFixed(2));
                                  if (half > 0) onPartialClosePosition(pos.id, half);
                                }}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#101b2a] hover:bg-cyan-950/80 border border-cyan-500/30 hover:border-cyan-400/70 text-cyan-300 transition-all cursor-pointer"
                                title={`Close 50% (${(pos.quantity * 0.5).toFixed(2)} Lots)`}
                              >
                                50%
                              </button>
                            )}

                            {/* 2. Custom Partial Close popover trigger */}
                            {onPartialClosePosition && pos.quantity > 0.02 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPartialMenuPosId((prev) => (prev === pos.id ? null : pos.id));
                                  setCustomLotsInput((pos.quantity * 0.5).toFixed(2));
                                }}
                                className={`px-1 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                  partialMenuPosId === pos.id
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                    : 'bg-[#0f1724] hover:bg-[#162234] border-[#1e2e46] text-slate-400 hover:text-slate-200'
                                }`}
                                title="Custom Partial Close"
                              >
                                %
                              </button>
                            )}

                            {/* Custom Partial Close Popover */}
                            {partialMenuPosId === pos.id && onPartialClosePosition && (
                              <div
                                className="absolute right-0 bottom-full mb-1.5 w-44 p-2 bg-[#0a111c] border border-cyan-500/40 rounded-lg shadow-2xl z-50 text-left font-mono space-y-1.5 backdrop-blur-md"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-300 border-b border-[#162234] pb-1">
                                  <span>PARTIAL CLOSE</span>
                                  <button
                                    type="button"
                                    onClick={() => setPartialMenuPosId(null)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Quick Percent Chips: 25%, 50%, 75% */}
                                <div className="grid grid-cols-3 gap-1 text-[9px]">
                                  {[0.25, 0.5, 0.75].map((pct) => {
                                    const lotsToClose = Number(Math.max(0.01, pos.quantity * pct).toFixed(2));
                                    return (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => {
                                          onPartialClosePosition(pos.id, lotsToClose);
                                          setPartialMenuPosId(null);
                                        }}
                                        className="py-0.5 rounded bg-[#131d2e] hover:bg-cyan-950/80 border border-[#1e2f46] hover:border-cyan-400/60 text-cyan-300 font-bold transition-colors cursor-pointer"
                                      >
                                        {pct * 100}%
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Custom Input */}
                                <div className="flex items-center gap-1 pt-0.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={pos.quantity}
                                    value={customLotsInput}
                                    onChange={(e) => setCustomLotsInput(e.target.value)}
                                    className="w-full px-1.5 py-0.5 bg-[#050a12] border border-[#1e2f46] rounded text-white text-[10px] font-bold focus:outline-none focus:border-cyan-400"
                                    placeholder="Lots"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = parseFloat(customLotsInput);
                                      if (!isNaN(val) && val > 0) {
                                        onPartialClosePosition(pos.id, Math.min(pos.quantity, val));
                                        setPartialMenuPosId(null);
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-black uppercase transition-colors shrink-0 cursor-pointer"
                                  >
                                    OK
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 3. Full Close [X] Button */}
                            <button
                              type="button"
                              onClick={() => onClosePosition(pos.id)}
                              className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="Close Full Position"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* TAB 2: PENDING ORDERS */}
          {activeTab === 'orders' && (
            pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                <span>No active pending orders.</span>
                <span className="text-[10px] text-slate-400">
                  Select LIMIT or STOP in the Order Pod to place orders.
                </span>
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] border-b border-[#141E2E] pb-1">
                    <th className="py-1 px-2 font-bold">#</th>
                    <th className="py-1 px-2 font-bold">TYPE</th>
                    <th className="py-1 px-2 font-bold">SIDE</th>
                    <th className="py-1 px-2 font-bold">LOTS</th>
                    <th className="py-1 px-2 font-bold">TARGET PRICE</th>
                    <th className="py-1 px-2 font-bold">S / L</th>
                    <th className="py-1 px-2 font-bold">T / P</th>
                    <th className="py-1 px-2 font-bold text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F1726]">
                  {pendingOrders.map((ord, idx) => (
                    <tr key={ord.id} className="hover:bg-[#0D1524] transition-colors">
                      <td className="py-1 px-2 text-slate-400 font-mono">#{idx + 1}</td>
                      <td className="py-1 px-2 font-bold text-cyan-300">{ord.orderType}</td>
                      <td className="py-1 px-2 font-bold text-slate-200">{ord.side}</td>
                      <td className="py-1 px-2 font-bold text-slate-200">{ord.quantity.toFixed(2)}</td>
                      <td className="py-1 px-2 text-amber-300 font-mono">{ord.targetPrice.toFixed(decimals)}</td>
                      <td className="py-1 px-2 text-rose-400 font-mono">
                        {ord.stopLoss ? ord.stopLoss.toFixed(decimals) : '-'}
                      </td>
                      <td className="py-1 px-2 text-emerald-400 font-mono">
                        {ord.takeProfit ? ord.takeProfit.toFixed(decimals) : '-'}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => onCancelPendingOrder(ord.id)}
                          className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition-colors"
                          title="Cancel Pending Order"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB 3: CLOSED TRADES HISTORY */}
          {activeTab === 'history' && (
            trades.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                <span>No closed trades in this session yet.</span>
                <span className="text-[10px] text-slate-400">
                  Trades will appear here when closed manually or when hitting SL/TP.
                </span>
              </div>
            ) : (
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] border-b border-[#141E2E] pb-1">
                    <th className="py-1 px-2 font-bold">#</th>
                    <th className="py-1 px-2 font-bold">SIDE</th>
                    <th className="py-1 px-2 font-bold">LOTS</th>
                    <th className="py-1 px-2 font-bold">ENTRY</th>
                    <th className="py-1 px-2 font-bold">EXIT</th>
                    <th className="py-1 px-2 font-bold">REASON</th>
                    <th className="py-1 px-2 font-bold text-right">PNL ($)</th>
                    <th className="py-1 px-2 font-bold text-right">RETURN (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F1726]">
                  {trades.slice(-50).reverse().map((t, idx) => (
                    <tr key={t.tradeId} className="hover:bg-[#0D1524] transition-colors">
                      <td className="py-1 px-2 text-slate-400 font-mono">#{idx + 1}</td>
                      <td className="py-1 px-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            t.side === 'LONG'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td className="py-1 px-2 font-bold text-slate-200">{t.quantity.toFixed(2)}</td>
                      <td className="py-1 px-2 text-slate-300 font-mono">{t.entryPrice.toFixed(decimals)}</td>
                      <td className="py-1 px-2 text-slate-300 font-mono">{t.exitPrice.toFixed(decimals)}</td>
                      <td className="py-1 px-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                            t.exitReason === 'TP'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : t.exitReason === 'SL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {t.exitReason || 'MANUAL'}
                        </span>
                      </td>
                      <td
                        className={`py-1 px-2 font-black font-mono text-right ${
                          (t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(t.pnl || 0) >= 0 ? `+$${(t.pnl || 0).toFixed(2)}` : `-$${Math.abs(t.pnl || 0).toFixed(2)}`}
                      </td>
                      <td
                        className={`py-1 px-2 font-black font-mono text-right ${
                          (t.pnlPercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(t.pnlPercent || 0) >= 0 ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
export default BottomOrdersBlotter;
