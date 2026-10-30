'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, GripHorizontal, Plus } from 'lucide-react';
import type { ReplayPosition, PendingOrder } from '@backtest-ai/domain';
import type { OpenAlgoChartApi } from '@backtest-ai/chart';
import { calculateReplayPnl } from '@/stores/sessionStore';

interface ChartOrderOverlayProps {
  symbol?: string;
  activePositions?: ReplayPosition[];
  activePosition?: ReplayPosition | null; // legacy fallback
  pendingOrders?: PendingOrder[];
  currentPrice: number;
  bidPrice?: number;
  askPrice?: number;
  chartApi?: OpenAlgoChartApi | null;
  decimals?: number;
  tickSize?: number;
  onUpdateSLTP?: (positionId: string, sl?: number, tp?: number) => void;
  onClosePosition?: (positionId: string) => void;
  onCancelPendingOrder?: (orderId: string) => void;
}

export function ChartOrderOverlay({
  symbol,
  activePositions: propActivePositions,
  activePosition: propActivePosition,
  pendingOrders = [],
  currentPrice,
  bidPrice,
  askPrice,
  chartApi,
  decimals = 2,
  tickSize = 0.1,
  onUpdateSLTP,
  onClosePosition,
  onCancelPendingOrder,
}: ChartOrderOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Track precise position & dimensions of .oac-chart relative to overlay parent
  // This ensures 100% pixel-perfect alignment without fragile portals or DOM mutations
  const [chartBounds, setChartBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const updateBounds = useCallback(() => {
    const chartEl = chartApi?.getChartElement() || (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.oac-chart') : null);
    const parentEl = overlayRef.current?.parentElement;
    if (chartEl && parentEl) {
      const cRect = chartEl.getBoundingClientRect();
      const pRect = parentEl.getBoundingClientRect();
      const newBounds = {
        top: Math.round(cRect.top - pRect.top),
        left: Math.round(cRect.left - pRect.left),
        width: Math.round(cRect.width),
        height: Math.round(cRect.height),
      };
      setChartBounds((prev) => {
        if (
          prev &&
          prev.top === newBounds.top &&
          prev.left === newBounds.left &&
          prev.width === newBounds.width &&
          prev.height === newBounds.height
        ) {
          return prev;
        }
        return newBounds;
      });
    }
  }, [chartApi]);

  useEffect(() => {
    updateBounds();
    const interval = setInterval(updateBounds, 100);
    window.addEventListener('resize', updateBounds, { passive: true });
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateBounds);
    };
  }, [updateBounds]);

  // Normalize positions: support both array and single prop
  const activePositions: ReplayPosition[] = propActivePositions || (propActivePosition ? [propActivePosition] : []);

  const activePositionsRef = useRef(activePositions);
  activePositionsRef.current = activePositions;
  const onUpdateSLTPRef = useRef(onUpdateSLTP);
  onUpdateSLTPRef.current = onUpdateSLTP;

  // Dragging state tracking
  const [draggingState, setDraggingState] = useState<{
    positionId: string;
    type: 'SL' | 'TP';
    dragY: number;
    tempPrice: number;
  } | null>(null);

  const draggingRef = useRef<{
    positionId: string;
    type: 'SL' | 'TP';
    dragY: number;
    tempPrice: number;
  } | null>(null);

  // Focus & Selection tracking across multi-orders
  const [hoveredPosId, setHoveredPosId] = useState<string | null>(null);
  const [selectedPosId, setSelectedPosId] = useState<string | null>(null);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const activeFocusId = draggingState?.positionId || hoveredPosId || selectedPosId;
  const activeOrderFocusId = hoveredOrderId || selectedOrderId;

  // Clear selection on click outside pills/lines
  useEffect(() => {
    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.order-interactive-pill') && !target?.closest('.order-interactive-line')) {
        setSelectedPosId(null);
        setSelectedOrderId(null);
      }
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // Coordinate conversion
  const priceToY = useCallback(
    (price: number): number | null => {
      if (chartApi) {
        const coord = chartApi.priceToCoordinate(price);
        if (coord !== null && !isNaN(coord)) return coord;
      }
      return null;
    },
    [chartApi]
  );

  const yToPrice = useCallback(
    (y: number): number => {
      if (chartApi) {
        const raw = chartApi.coordinateToPrice(y);
        if (raw !== null && !isNaN(raw)) {
          const snapped = Math.round(raw / tickSize) * tickSize;
          return Number(snapped.toFixed(decimals));
        }
      }
      return Number(currentPrice.toFixed(decimals));
    },
    [chartApi, tickSize, decimals, currentPrice]
  );

  // Efficient scale tracking on chart pan/zoom without runaway loops
  const [, setScaleTick] = useState<number>(0);

  useEffect(() => {
    if (!chartApi) return;
    const onScale = () => {
      updateBounds();
      setScaleTick((t) => (t + 1) % 1000000);
    };

    const unsub = chartApi.subscribeScaleChange?.(onScale);

    return () => {
      unsub?.();
    };
  }, [chartApi]);

  // Robust Left-Click Drag Handler with Native Event Isolation
  const startDrag = useCallback(
    (positionId: string, type: 'SL' | 'TP', e: PointerEvent | React.PointerEvent) => {
      // STRICTLY LEFT CLICK ONLY! (button 0)
      if (e.button !== 0) return;

      // Stop native propagation so OpenAlgo canvas never initiates chart drag/pan
      e.preventDefault();
      e.stopPropagation();
      if ('stopImmediatePropagation' in e) {
        (e as any).stopImmediatePropagation();
      }
      if ((e as any).nativeEvent) {
        (e as any).nativeEvent.stopPropagation();
        (e as any).nativeEvent.stopImmediatePropagation();
        (e as any).nativeEvent.preventDefault();
      }

      const chartEl = chartApi?.getChartElement() || overlayRef.current;
      const rect = chartEl ? chartEl.getBoundingClientRect() : { top: 0, height: 600 };
      const relativeY = Math.max(10, Math.min(rect.height - 10, e.clientY - rect.top));
      const initialPrice = yToPrice(relativeY);

      const state = { positionId, type, dragY: relativeY, tempPrice: initialPrice };
      draggingRef.current = state;
      setDraggingState(state);

      const onWindowMove = (moveEv: PointerEvent) => {
        // Prevent canvas from stealing pointer events during drag
        moveEv.preventDefault();
        moveEv.stopPropagation();
        moveEv.stopImmediatePropagation();

        const currentChartEl = chartApi?.getChartElement() || overlayRef.current;
        if (!currentChartEl) return;
        const currentRect = currentChartEl.getBoundingClientRect();
        const currY = Math.max(10, Math.min(currentRect.height - 10, moveEv.clientY - currentRect.top));
        const rawPrice = yToPrice(currY);

        const pos = activePositionsRef.current.find((p) => p.id === positionId);
        if (!pos) return;

        // Strictly enforce impossibility boundaries:
        // LONG: SL must be strictly below entry price; TP must be strictly above entry price
        // SHORT: SL must be strictly above entry price; TP must be strictly below entry price
        let clampedPrice = rawPrice;
        if (pos.side === 'LONG') {
          if (type === 'SL') {
            clampedPrice = Math.min(pos.entryPrice - tickSize, rawPrice);
          } else {
            clampedPrice = Math.max(pos.entryPrice + tickSize, rawPrice);
          }
        } else {
          // SHORT
          if (type === 'SL') {
            clampedPrice = Math.max(pos.entryPrice + tickSize, rawPrice);
          } else {
            clampedPrice = Math.min(pos.entryPrice - tickSize, rawPrice);
          }
        }
        clampedPrice = Number(clampedPrice.toFixed(decimals));

        const clampedY = priceToY(clampedPrice);
        const updated = {
          positionId,
          type,
          dragY: clampedY !== null && !isNaN(clampedY) ? clampedY : currY,
          tempPrice: clampedPrice,
        };
        draggingRef.current = updated;
        setDraggingState(updated);
      };

      const onWindowUp = (upEv: PointerEvent) => {
        upEv.preventDefault();
        upEv.stopPropagation();
        upEv.stopImmediatePropagation();

        window.removeEventListener('pointermove', onWindowMove, { capture: true });
        window.removeEventListener('pointerup', onWindowUp, { capture: true });
        window.removeEventListener('pointercancel', onWindowUp, { capture: true });

        const finalState = draggingRef.current;
        draggingRef.current = null;
        setDraggingState(null);

        if (finalState && onUpdateSLTPRef.current) {
          const pos = activePositionsRef.current.find((p) => p.id === finalState.positionId);
          if (pos) {
            let clampedFinal = finalState.tempPrice;
            if (pos.side === 'LONG') {
              if (finalState.type === 'SL') {
                clampedFinal = Math.min(pos.entryPrice - tickSize, clampedFinal);
              } else {
                clampedFinal = Math.max(pos.entryPrice + tickSize, clampedFinal);
              }
            } else {
              if (finalState.type === 'SL') {
                clampedFinal = Math.max(pos.entryPrice + tickSize, clampedFinal);
              } else {
                clampedFinal = Math.min(pos.entryPrice - tickSize, clampedFinal);
              }
            }
            clampedFinal = Number(clampedFinal.toFixed(decimals));

            if (finalState.type === 'SL') {
              onUpdateSLTPRef.current(finalState.positionId, clampedFinal, pos.takeProfit);
            } else {
              onUpdateSLTPRef.current(finalState.positionId, pos.stopLoss, clampedFinal);
            }
          }
        }
      };

      window.addEventListener('pointermove', onWindowMove, { capture: true });
      window.addEventListener('pointerup', onWindowUp, { capture: true });
      window.addEventListener('pointercancel', onWindowUp, { capture: true });
    },
    [chartApi, yToPrice]
  );

  // Symbol telemetry
  const sym = symbol || activePositions[0]?.symbol || pendingOrders[0]?.symbol || 'XAUUSD';
  const isForex = sym.includes('EUR') || sym.includes('GBP') || (sym.length === 6 && !sym.includes('XAU'));
  const isGold = sym.toUpperCase().includes('XAU') || sym.toUpperCase().includes('GOLD');
  const contractSize = isGold ? 100 : isForex ? 100000 : 1;

  // Only render overlay when active positions or pending orders exist
  if (activePositions.length === 0 && pendingOrders.length === 0) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      id="chart-interactive-order-overlay"
      className="pointer-events-none z-20 overflow-hidden font-mono select-none"
      style={
        chartBounds
          ? {
              position: 'absolute',
              top: `${chartBounds.top}px`,
              left: `${chartBounds.left}px`,
              width: `${chartBounds.width}px`,
              height: `${chartBounds.height}px`,
            }
          : {
              position: 'absolute',
              inset: 0,
            }
      }
    >
      {/* ======================================================== */}
      {/* 1. MULTI-ORDERS: RENDER ALL ACTIVE POSITIONS AT ONCE     */}
      {/* ======================================================== */}
      {activePositions.map((pos, posIdx) => {
        const entryY = priceToY(pos.entryPrice);

        // SL coordinate: if actively dragging this position's SL, follow drag; otherwise follow chart scale
        const isDraggingThisSL = draggingState?.positionId === pos.id && draggingState?.type === 'SL';
        const slPrice = isDraggingThisSL ? draggingState.tempPrice : pos.stopLoss;
        const slY = isDraggingThisSL
          ? draggingState.dragY
          : (pos.stopLoss ? priceToY(pos.stopLoss) : null);

        // TP coordinate: if actively dragging this position's TP, follow drag; otherwise follow chart scale
        const isDraggingThisTP = draggingState?.positionId === pos.id && draggingState?.type === 'TP';
        const tpPrice = isDraggingThisTP ? draggingState.tempPrice : pos.takeProfit;
        const tpY = isDraggingThisTP
          ? draggingState.dragY
          : (pos.takeProfit ? priceToY(pos.takeProfit) : null);

        // Focus & Dimming state calculation
        const isPosFocused = activeFocusId === pos.id;

        // Lines and Entry Badge are ALWAYS completely visible (100% opacity at all times)
        const orderLineClass = 'opacity-100 z-20';

        const entryPillClass = isPosFocused
          ? 'opacity-100 ring-1 ring-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.4)] scale-[1.01] z-30'
          : 'opacity-100 z-25';

        // ONLY TP and SL Badges change display when away (soft 35% ghost opacity) to avoid cluttering candles ("avoid plein chart")
        const slBadgeClass = isDraggingThisSL
          ? 'opacity-100 ring-2 ring-rose-400 ring-offset-1 ring-offset-black scale-105 shadow-[0_0_12px_rgba(244,63,94,0.6)] z-40'
          : isPosFocused
          ? 'opacity-100 ring-1 ring-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.35)] scale-[1.01] z-30'
          : 'opacity-35 hover:opacity-100 transition-all duration-150 z-20';

        const tpBadgeClass = isDraggingThisTP
          ? 'opacity-100 ring-2 ring-emerald-400 ring-offset-1 ring-offset-black scale-105 shadow-[0_0_12px_rgba(16,185,129,0.6)] z-40'
          : isPosFocused
          ? 'opacity-100 ring-1 ring-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.35)] scale-[1.01] z-30'
          : 'opacity-35 hover:opacity-100 transition-all duration-150 z-20';

        // Real-time floating PnL for this position (MT5: LONG exits at Bid, SHORT exits at Ask)
        const currentMarketExit = pos.side === 'LONG' ? (bidPrice ?? currentPrice) : (askPrice ?? currentPrice);
        const posFloatingPnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, currentMarketExit, pos.quantity);

        // SL distance & dollar loss (strictly loss)
        const slTicks = slPrice ? Math.abs(slPrice - pos.entryPrice) / tickSize : 0;
        const slLoss = slPrice
          ? Math.abs(slPrice - pos.entryPrice) * pos.quantity * contractSize
          : 0;

        // TP distance & dollar profit (strictly profit)
        const tpTicks = tpPrice ? Math.abs(tpPrice - pos.entryPrice) / tickSize : 0;
        const tpProfit = tpPrice
          ? Math.abs(tpPrice - pos.entryPrice) * pos.quantity * contractSize
          : 0;

        // Vertical bracket linking coords when this position is focused
        const validYCoords = [entryY, slY, tpY].filter((y): y is number => y !== null && !isNaN(y));
        const minY = validYCoords.length > 0 ? Math.min(...validYCoords) : null;
        const maxY = validYCoords.length > 0 ? Math.max(...validYCoords) : null;

        return (
          <React.Fragment key={pos.id}>
            {/* C-1. VERTICAL LINKING BRACKET (Shows on focus to connect Entry + SL + TP) */}
            {isPosFocused && validYCoords.length >= 2 && minY !== null && maxY !== null && (
              <div
                className="pointer-events-none absolute z-20 transition-opacity duration-150"
                style={{
                  top: `${Math.round(minY)}px`,
                  height: `${Math.max(2, Math.round(maxY - minY))}px`,
                  left: `${6 + (posIdx * 10)}px`,
                  width: '6px',
                }}
              >
                <div
                  className={`h-full border-l-[1.5px] border-dashed ${
                    pos.side === 'LONG'
                      ? 'border-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                      : 'border-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  }`}
                />
              </div>
            )}

            {/* A. ENTRY LINE (Always Completely Visible) */}
            {entryY !== null && !isNaN(entryY) && (
              <div
                onPointerEnter={() => setHoveredPosId(pos.id)}
                onPointerLeave={() => setHoveredPosId(null)}
                className={`order-interactive-line absolute left-0 right-[56px] flex items-center transition-opacity duration-150 ${orderLineClass}`}
                style={{ top: `${Math.round(entryY)}px`, transform: 'translateY(-50%)' }}
              >
                {/* 1px Hairline Dashed Order Line */}
                <div
                  className={`w-full border-b border-dashed ${
                    pos.side === 'LONG' ? 'border-cyan-400/80' : 'border-rose-400/80'
                  }`}
                />

                {/* Entry Badge: Always completely visible & sharp */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPosId((prev) => (prev === pos.id ? null : pos.id));
                  }}
                  className={`pointer-events-auto order-interactive-pill absolute flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] bg-[#07131e]/95 border border-cyan-500/40 text-cyan-200 text-[9.5px] font-medium shadow-md backdrop-blur-sm transition-all duration-150 cursor-pointer ${entryPillClass}`}
                  style={{ left: `${14 + (posIdx * 10)}px` }}
                  title="Click to focus this order and its SL/TP"
                >
                  {/* Order Index Tag */}
                  <span className="px-1 py-0 rounded text-[8px] font-black bg-cyan-500/25 text-cyan-300 border border-cyan-400/30">
                    #{posIdx + 1}
                  </span>

                  <span
                    className={`px-1 py-0 rounded text-[8.5px] font-bold ${
                      pos.side === 'LONG' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {pos.side}
                  </span>

                  <span className="text-slate-200 font-mono">
                    {pos.quantity}L @ {pos.entryPrice.toFixed(decimals)}
                  </span>

                  {/* Real-time floating PnL badge */}
                  <span
                    className={`text-[9px] px-1 py-0 rounded font-mono font-semibold ${
                      posFloatingPnl >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {posFloatingPnl >= 0 ? `+$${posFloatingPnl.toFixed(2)}` : `-$${Math.abs(posFloatingPnl).toFixed(2)}`}
                  </span>

                  {/* Add SL quick button if none (default 100 pips) */}
                  {!pos.stopLoss && onUpdateSLTP && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const delta = 100 * (isForex ? 0.0001 : isGold ? 0.1 : tickSize);
                        const newSL = pos.side === 'LONG' ? pos.entryPrice - delta : pos.entryPrice + delta;
                        onUpdateSLTP(pos.id, Number(newSL.toFixed(decimals)), pos.takeProfit);
                      }}
                      className="flex items-center gap-0.5 px-1 py-0 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 text-[8.5px] cursor-pointer"
                      title="Add Stop Loss (100 pips)"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>SL</span>
                    </button>
                  )}

                  {/* Add TP quick button if none (default 100 pips) */}
                  {!pos.takeProfit && onUpdateSLTP && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const delta = 100 * (isForex ? 0.0001 : isGold ? 0.1 : tickSize);
                        const newTP = pos.side === 'LONG' ? pos.entryPrice + delta : pos.entryPrice - delta;
                        onUpdateSLTP(pos.id, pos.stopLoss, Number(newTP.toFixed(decimals)));
                      }}
                      className="flex items-center gap-0.5 px-1 py-0 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[8.5px] cursor-pointer"
                      title="Add Take Profit (100 pips)"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>TP</span>
                    </button>
                  )}

                  {/* Close this Position [X] */}
                  {onClosePosition && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClosePosition(pos.id);
                      }}
                      className="p-0.5 hover:bg-rose-500/30 rounded text-slate-400 hover:text-rose-300 transition-colors ml-0.5 cursor-pointer"
                      title="Close this position at market"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Right Price Axis Tag: Always completely visible */}
                <div
                  className={`absolute -right-[56px] w-[54px] h-[18px] flex items-center justify-center bg-cyan-400 text-black text-[9.5px] font-semibold font-mono tracking-tight shadow-sm rounded-l-[2px] opacity-100 ${
                    isPosFocused ? 'ring-1 ring-white/60 z-30' : 'z-20'
                  }`}
                >
                  {pos.entryPrice.toFixed(decimals)}
                </div>
              </div>
            )}

            {/* B. STOP LOSS LINE (Soft Red, Line Always Visible, Badge Soft Opacity when Idle) */}
            {slPrice && slY !== null && !isNaN(slY) && (
              <div
                onPointerEnter={() => setHoveredPosId(pos.id)}
                onPointerLeave={() => setHoveredPosId(null)}
                className={`order-interactive-line absolute left-0 right-[56px] h-5 flex items-center transition-opacity duration-150 ${orderLineClass}`}
                style={{ top: `${Math.round(slY)}px`, transform: 'translateY(-50%)' }}
              >
                {/* 1px Hairline Dashed Line: Soft Red */}
                <div
                  onPointerDown={(e) => {
                    if (e.button === 0) startDrag(pos.id, 'SL', e);
                  }}
                  className="w-full border-b border-dashed border-rose-500/75 pointer-events-auto cursor-ns-resize h-3 flex items-center"
                />

                {/* SL Pill: Soft Red Badge, Soft Idle Opacity to Keep Chart Calm */}
                <div
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('button')) return;
                    if (e.button === 0) startDrag(pos.id, 'SL', e);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPosId((prev) => (prev === pos.id ? null : pos.id));
                  }}
                  className={`pointer-events-auto order-interactive-pill absolute flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#18090f]/90 border border-rose-500/40 text-rose-300 text-[9.5px] font-medium shadow-md cursor-ns-resize hover:bg-rose-950/90 transition-all select-none backdrop-blur-sm ${slBadgeClass}`}
                  style={{ left: `${14 + (posIdx * 10)}px` }}
                  title="Click to focus order | Left-click and drag vertically to adjust Stop Loss"
                >
                  {/* Order Index Tag */}
                  <span className="px-1 py-0 rounded text-[8px] font-black bg-rose-500/25 text-rose-300 border border-rose-500/30">
                    #{posIdx + 1}
                  </span>

                  <GripHorizontal className="w-2.5 h-2.5 text-rose-400/80" />
                  <span className="font-semibold text-rose-200">SL: {slPrice.toFixed(decimals)}</span>

                  <span className="text-[9px] font-mono px-1 py-0 rounded bg-rose-950/70 text-rose-300/90">
                    -${slLoss.toFixed(2)} ({slTicks.toFixed(0)}t)
                  </span>

                  {/* Remove SL button */}
                  {onUpdateSLTP && !draggingState && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSLTP(pos.id, undefined, pos.takeProfit);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-0.5 hover:bg-rose-500/30 rounded text-rose-400/70 hover:text-white transition-colors ml-0.5 cursor-pointer"
                      title="Remove Stop Loss"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Right Price Axis Tag: Soft Red, Always completely visible */}
                <div
                  className={`absolute -right-[56px] w-[54px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[9.5px] font-semibold font-mono tracking-tight shadow-sm rounded-l-[2px] opacity-100 ${
                    isPosFocused ? 'ring-1 ring-white/60 z-30' : 'z-20'
                  }`}
                >
                  {slPrice.toFixed(decimals)}
                </div>
              </div>
            )}

            {/* C. TAKE PROFIT LINE (Soft Green, Line Always Visible, Badge Soft Opacity when Idle) */}
            {tpPrice && tpY !== null && !isNaN(tpY) && (
              <div
                onPointerEnter={() => setHoveredPosId(pos.id)}
                onPointerLeave={() => setHoveredPosId(null)}
                className={`order-interactive-line absolute left-0 right-[56px] h-5 flex items-center transition-opacity duration-150 ${orderLineClass}`}
                style={{ top: `${Math.round(tpY)}px`, transform: 'translateY(-50%)' }}
              >
                {/* 1px Hairline Dashed Line: Soft Green */}
                <div
                  onPointerDown={(e) => {
                    if (e.button === 0) startDrag(pos.id, 'TP', e);
                  }}
                  className="w-full border-b border-dashed border-emerald-500/75 pointer-events-auto cursor-ns-resize h-3 flex items-center"
                />

                {/* TP Pill: Soft Green Badge, Soft Idle Opacity to Keep Chart Calm */}
                <div
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('button')) return;
                    if (e.button === 0) startDrag(pos.id, 'TP', e);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPosId((prev) => (prev === pos.id ? null : pos.id));
                  }}
                  className={`pointer-events-auto order-interactive-pill absolute flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#061710]/90 border border-emerald-500/40 text-emerald-300 text-[9.5px] font-medium shadow-md cursor-ns-resize hover:bg-emerald-950/90 transition-all select-none backdrop-blur-sm ${tpBadgeClass}`}
                  style={{ left: `${14 + (posIdx * 10)}px` }}
                  title="Click to focus order | Left-click and drag vertically to adjust Take Profit"
                >
                  {/* Order Index Tag */}
                  <span className="px-1 py-0 rounded text-[8px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/30">
                    #{posIdx + 1}
                  </span>

                  <GripHorizontal className="w-2.5 h-2.5 text-emerald-400/80" />
                  <span className="font-semibold text-emerald-200">TP: {tpPrice.toFixed(decimals)}</span>

                  <span className="text-[9px] font-mono px-1 py-0 rounded bg-emerald-950/70 text-emerald-300/90">
                    +${tpProfit.toFixed(2)} ({tpTicks.toFixed(0)}t)
                  </span>

                  {/* Remove TP button */}
                  {onUpdateSLTP && !draggingState && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSLTP(pos.id, pos.stopLoss, undefined);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-0.5 hover:bg-emerald-500/30 rounded text-emerald-400/70 hover:text-white transition-colors ml-0.5 cursor-pointer"
                      title="Remove Take Profit"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Right Price Axis Tag: Soft Green, Always completely visible */}
                <div
                  className={`absolute -right-[56px] w-[54px] h-[18px] flex items-center justify-center bg-emerald-500 text-black text-[9.5px] font-semibold font-mono tracking-tight shadow-sm rounded-l-[2px] opacity-100 ${
                    isPosFocused ? 'ring-1 ring-white/60 z-30' : 'z-20'
                  }`}
                >
                  {tpPrice.toFixed(decimals)}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* ======================================================== */}
      {/* 2. PENDING ORDERS (Limit / Stop Orders) */}
      {/* ======================================================== */}
      {pendingOrders.map((order, orderIdx) => {
        const orderY = priceToY(order.targetPrice);
        if (orderY === null || isNaN(orderY)) return null;

        const isOrderFocused = activeOrderFocusId === order.id;
        const isOtherOrderFocused = activeOrderFocusId !== null && !isOrderFocused;

        const lineOpacityClass = 'opacity-100 z-15';

        const pillFocusBase = isOrderFocused
          ? 'opacity-100 scale-[1.01] z-30 ring-1 ring-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
          : 'opacity-100 z-20';

        return (
          <div
            key={order.id}
            onPointerEnter={() => setHoveredOrderId(order.id)}
            onPointerLeave={() => setHoveredOrderId(null)}
            className={`order-interactive-line absolute left-0 right-[56px] flex items-center transition-opacity duration-150 ${lineOpacityClass}`}
            style={{ top: `${Math.round(orderY)}px`, transform: 'translateY(-50%)' }}
          >
            {/* 1px Hairline Dashed Amber Line */}
            <div className="w-full border-b border-dashed border-amber-400/70" />

            {/* Compact & Gentle Pending Order Badge */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrderId((prev) => (prev === order.id ? null : order.id));
              }}
              className={`pointer-events-auto order-interactive-pill absolute flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] bg-[#140e06]/92 border border-amber-400/40 text-amber-200 text-[9.5px] font-medium shadow-md backdrop-blur-sm transition-all duration-150 cursor-pointer ${pillFocusBase}`}
              style={{ left: `${14 + (orderIdx * 10)}px` }}
            >
              <span className="px-1 py-0 rounded text-[8px] font-black bg-amber-500/25 text-amber-300 border border-amber-400/30">
                P#{orderIdx + 1}
              </span>
              <span className="bg-amber-500/20 text-amber-300 px-1 py-0 rounded text-[8.5px] uppercase font-bold">
                {order.orderType}
              </span>
              <span className="text-slate-200">
                {order.side} {order.quantity}L @ {order.targetPrice.toFixed(decimals)}
              </span>
              {onCancelPendingOrder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelPendingOrder(order.id);
                  }}
                  className="p-0.5 hover:bg-rose-500/30 rounded text-slate-400 hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                  title="Cancel Pending Order"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Right Price Axis Tag: Always completely visible */}
            <div
              className={`absolute -right-[56px] w-[54px] h-[18px] flex items-center justify-center bg-amber-400 text-black text-[9.5px] font-semibold font-mono tracking-tight shadow-sm rounded-l-[2px] opacity-100 ${
                isOrderFocused ? 'ring-1 ring-white/60 z-30' : 'z-20'
              }`}
            >
              {order.targetPrice.toFixed(decimals)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
