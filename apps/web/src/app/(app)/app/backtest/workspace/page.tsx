'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, PanelRightClose, PanelRightOpen, CheckCircle2 } from 'lucide-react';
import type { OpenAlgoBar, ReplayStateUpdate, OpenAlgoChartApi, ChartTrade } from '@backtest-ai/chart';
import { ReplayDataManager } from '@backtest-ai/chart';
import { useSessionStore, calculateReplayPnl } from '@/stores/sessionStore';
import type { BacktestSession, ReplayPosition, PendingOrder, Trade } from '@backtest-ai/domain';
import { OrderPod } from '@/components/tradingview/OrderPod';
import { ChartOrderOverlay } from '@/components/tradingview/ChartOrderOverlay';
import { BottomOrdersBlotter } from '@/components/tradingview/BottomOrdersBlotter';
import { SessionDoneDialog } from '@/components/session/SessionDoneDialog';
import { AIWatcherSlot } from '@/components/tradingview/AIWatcherSlot';

// Dynamically import OpenAlgoChart to prevent SSR canvas issues
const OpenAlgoChart = dynamic(
  () => import('@backtest-ai/chart').then((mod) => mod.OpenAlgoChart),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] bg-[#080D15] rounded-xl border border-[#1A2538] flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        <span className="text-xs text-slate-400">INITIALIZING OPENALGO REPLAY ENGINE...</span>
      </div>
    ),
  }
);

/**
 * Active Workspace Replay Session component.
 * Integrates Chart, OrderPod, On-Chart Draggable SL/TP Overlay, and Bottom Orders Blotter.
 */
function ActiveWorkspaceSession({ session }: { session: BacktestSession }) {
  const router = useRouter();
  const saveSessionProgress = useSessionStore((s) => s.saveSessionProgress);

  const symbol = session.symbol || 'EURUSD';
  const sessionName = session.name || 'Replay Studio';
  const balance = session.currentBalance ?? session.initialBalance ?? 100000;
  const startDate = session.startDate || '2023-01-01T00:00:00Z';
  const initialTf = session.timeframe || '1h';

  // Initial checkpoint timestamp: fixed on mount so progress updates NEVER mutate initial props
  const [initialCheckpoint] = useState<number | null>(() => {
    return session.lastReplayTime && session.lastReplayTime > 0 ? session.lastReplayTime : null;
  });

  // Active state
  const [currentTimeframe, setCurrentTimeframe] = useState<string>(initialTf);
  const [bars, setBars] = useState<OpenAlgoBar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOrderPodOpen, setIsOrderPodOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return false;
    }
    return true;
  });

  // Chart Coordinate & Layout API (for interactive drag & drop lines)
  const [chartApi, setChartApi] = useState<OpenAlgoChartApi | null>(null);
  const chartApiRef = useRef<OpenAlgoChartApi | null>(null);
  chartApiRef.current = chartApi;

  // Asset Specifications & Formats
  const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
  const isCrypto = symbol.toUpperCase().includes('BTC') || symbol.toUpperCase().includes('ETH') || symbol.toUpperCase().includes('SOL');
  const isJpy = symbol.toUpperCase().includes('JPY');
  const defaultDecimals = isGold ? 2 : isCrypto ? 2 : isJpy ? 3 : 5;
  const pipSize = isGold ? 0.10 : isCrypto ? 1.0 : isJpy ? 0.01 : 0.0001;
  const defaultBasePrice = isGold ? 2650.00 : isCrypto ? 65000.00 : isJpy ? 150.00 : 1.08500;
  const defaultSpread = isGold ? 0.20 : isCrypto ? 2.0 : isJpy ? 0.015 : 0.00015;

  const [currentPrice, setCurrentPrice] = useState<{ bid: number; ask: number }>(() => ({
    bid: Number(defaultBasePrice.toFixed(defaultDecimals)),
    ask: Number((defaultBasePrice + defaultSpread).toFixed(defaultDecimals)),
  }));

  // Trading State: Active Positions, Pending Orders, Closed Trades History, and Account Balance
  const [activePositions, setActivePositions] = useState<ReplayPosition[]>(() => session.activePositions || []);
  const activePositionsRef = useRef<ReplayPosition[]>(activePositions);
  activePositionsRef.current = activePositions;

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(() => session.pendingOrders || []);
  const pendingOrdersRef = useRef<PendingOrder[]>(pendingOrders);
  pendingOrdersRef.current = pendingOrders;

  const [trades, setTrades] = useState<Trade[]>(() => session.trades || []);
  const chartTrades = useMemo<ChartTrade[]>(() => {
    return trades.map((t) => ({
      ...t,
      id: t.id || t.tradeId,
    }));
  }, [trades]);
  const [currentBalance, setCurrentBalance] = useState<number>(() => session.currentBalance ?? balance);
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'PAUSED' | 'COMPLETED'>(() => session.status || 'ACTIVE');
  const [isDoneDialogOpen, setIsDoneDialogOpen] = useState<boolean>(false);

  // Closed trades metrics for Session Done summary
  const closedTradesCount = trades.length;
  const winningTradesCount = useMemo(() => trades.filter((t) => t.pnl > 0).length, [trades]);
  const sessionWinRate = closedTradesCount > 0 ? (winningTradesCount / closedTradesCount) * 100 : 0;
  const sessionNetPnl = currentBalance - (session.initialBalance || 10000);

  // Synchronize active session ID in sessionStore
  useEffect(() => {
    if (session?.id) {
      useSessionStore.getState().switchSession(session.id);
    }
  }, [session?.id]);

  // Real-time live Floating PnL and Equity across active positions
  const totalFloatingPnl = useMemo(() => {
    return activePositions.reduce((sum, pos) => {
      const exitPrice = pos.side === 'LONG' ? currentPrice.bid : currentPrice.ask;
      return sum + calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
    }, 0);
  }, [activePositions, currentPrice.bid, currentPrice.ask]);

  const currentEquity = Number((currentBalance + totalFloatingPnl).toFixed(2));

  // Dedicated Frontend Replay Data Manager instance
  const dataManagerRef = useRef<ReplayDataManager | null>(null);
  if (!dataManagerRef.current) {
    dataManagerRef.current = new ReplayDataManager();
  }

  // Pure source of truth for the latest replay anchor timestamp
  const anchorTimeRef = useRef<number | null>(initialCheckpoint);

  // Track latest progress for flushing
  const latestProgressRef = useRef<{
    lastReplayTime: number;
    lastBarIndex: number;
    totalBars: number;
    progressPct: number;
  }>({
    lastReplayTime: initialCheckpoint || 0,
    lastBarIndex: session.lastBarIndex || session.replayIndex || 0,
    totalBars: session.totalBars || 0,
    progressPct: session.progressPct || 0,
  });

  const lastFlushTimeRef = useRef<number>(0);
  const currentTimeframeRef = useRef<string>(currentTimeframe);
  currentTimeframeRef.current = currentTimeframe;

  // Track whether the replay has anchored at or beyond the initial checkpoint
  const isAnchoredRef = useRef<boolean>(initialCheckpoint === null);

  // Synchronous flush to sessionStore & localStorage
  const flushProgress = useCallback(() => {
    const prog = latestProgressRef.current;
    if (!session.id || !prog || prog.lastReplayTime <= 0) return;

    // Safety guard: never flush an unanchored Day 1 timestamp over a forward checkpoint
    if (initialCheckpoint && !isAnchoredRef.current && prog.lastReplayTime < initialCheckpoint) {

    }

    saveSessionProgress(
      {
        lastReplayTime: prog.lastReplayTime,
        lastBarIndex: prog.lastBarIndex,
        replayIndex: prog.lastBarIndex,
        totalBars: prog.totalBars,
        progressPct: prog.progressPct,
        timeframe: currentTimeframeRef.current,
      },
      session.id
    );
    lastFlushTimeRef.current = Date.now();
  }, [saveSessionProgress, session.id, initialCheckpoint]);

  // High precision timeframe switching handler
  const handleTimeframeChange = useCallback(
    (newTf: string, anchorTime?: number | null) => {
      if (!newTf || newTf === currentTimeframe) return;
      if (anchorTime && anchorTime > 0) {
        anchorTimeRef.current = anchorTime;
        dataManagerRef.current?.updateReplayTime(anchorTime);
        if (latestProgressRef.current) {
          latestProgressRef.current.lastReplayTime = anchorTime;
        }
      }
      setCurrentTimeframe(newTf);
      currentTimeframeRef.current = newTf;
      flushProgress();
    },
    [currentTimeframe, flushProgress]
  );

  // Order Execution Handler: Validates and opens Market positions or places Pending orders
  const handleExecuteOrder = useCallback(
    (details: {
      side: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'LIMIT' | 'STOP';
      entryPrice: number;
      lots: number;
      slPrice: number;
      tpPrice: number;
      slPips: number;
      tpPips: number;
      riskAmount: number;
    }) => {
      const posSide = details.side === 'BUY' ? 'LONG' : 'SHORT';
      const entryPrice = Number(details.entryPrice.toFixed(defaultDecimals));
      const slDist = details.slPips * pipSize;
      const tpDist = details.tpPips * pipSize;

      // Smart Safety Validation:
      // LONG: Stop Loss must be strictly below entry, Take Profit must be strictly above entry
      // SHORT: Stop Loss must be strictly above entry, Take Profit must be strictly below entry
      let finalSL = details.slPrice;
      let finalTP = details.tpPrice;

      if (posSide === 'LONG') {
        if (!finalSL || finalSL >= entryPrice) {
          finalSL = Number((entryPrice - slDist).toFixed(defaultDecimals));
        }
        if (!finalTP || finalTP <= entryPrice) {
          finalTP = Number((entryPrice + tpDist).toFixed(defaultDecimals));
        }
      } else {
        if (!finalSL || finalSL <= entryPrice) {
          finalSL = Number((entryPrice + slDist).toFixed(defaultDecimals));
        }
        if (!finalTP || finalTP >= entryPrice) {
          finalTP = Number((entryPrice - tpDist).toFixed(defaultDecimals));
        }
      }

      const currentBarTime = latestProgressRef.current.lastReplayTime
        ? new Date(latestProgressRef.current.lastReplayTime * 1000).toISOString()
        : new Date().toISOString();

      const store = useSessionStore.getState();

      if (details.orderType === 'MARKET') {
        const newPos = store.openReplayPosition(
          {
            symbol,
            side: posSide,
            entryPrice,
            quantity: details.lots,
            stopLoss: finalSL,
            takeProfit: finalTP,
            entryTime: currentBarTime,
            initialBalance: currentBalance,
          },
          session.id
        );

        if (newPos) {
          setActivePositions((prev) => [...prev, newPos]);
        }
      } else {
        const newOrd = store.addPendingOrder(
          {
            symbol,
            side: posSide,
            orderType: details.orderType as 'LIMIT' | 'STOP',
            targetPrice: entryPrice,
            quantity: details.lots,
            stopLoss: finalSL,
            takeProfit: finalTP,
            createdAtTime: currentBarTime,
          },
          session.id
        );

        if (newOrd) {
          setPendingOrders((prev) => [...prev, newOrd]);
        }
      }
    },
    [symbol, defaultDecimals, pipSize, currentBalance, session.id]
  );

  // Capture TradeCard snapshot for AI Watcher coach & cloner
  const recordTradeCardForAIWatcher = useCallback(
    (closed: Trade) => {
      const store = useSessionStore.getState();
      const snapshot = chartApiRef.current?.getCanvasSnapshot?.({
        symbol: closed.symbol || symbol,
        timeframe: currentTimeframe || '1h',
        direction: (closed.side === 'LONG' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
        entryPrice: closed.entryPrice,
        exitPrice: closed.exitPrice,
        stopLoss: closed.stopLoss,
        takeProfit: closed.takeProfit,
        pnl: closed.pnl,
        quantity: closed.quantity,
      }) || null;

      const tid = closed.tradeId || (closed as any).id;
      const cardPayload = {
        id: tid,
        trade_id: tid,
        symbol: closed.symbol || symbol,
        direction: (closed.side === 'LONG' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
        entry_price: closed.entryPrice,
        exit_price: closed.exitPrice,
        stop_loss: closed.stopLoss,
        take_profit: closed.takeProfit,
        quantity: closed.quantity,
        lot_size: closed.quantity,
        pnl: closed.pnl,
        canvas_snapshot_base64: snapshot || undefined,
        screenshot_base64: snapshot || undefined,
        entry_time: closed.entryTime,
        exit_time: closed.exitTime,
        status: 'RAW',
      };
      store.addAITradeCard(session.id, cardPayload);

      fetch('/api/v1/ai-watcher/trade-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, trade: cardPayload }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error('[AI Watcher] trade-card upload failed with HTTP', res.status, await res.text());
          } else {
            const data = await res.json();
            console.log('[AI Watcher] trade-card screenshot persisted:', data);
          }
        })
        .catch((err) => console.error('[AI Watcher] Upload snapshot network error:', err));
    },
    [session.id, symbol, currentTimeframe]
  );

  // Close Position Handler (Full)
  const handleClosePosition = useCallback(
    (positionId: string) => {
      const pos = activePositionsRef.current.find((p) => p.id === positionId);
      if (!pos) return;

      const exitPrice = pos.side === 'LONG' ? currentPrice.bid : currentPrice.ask;
      const exitTime = latestProgressRef.current.lastReplayTime
        ? new Date(latestProgressRef.current.lastReplayTime * 1000).toISOString()
        : new Date().toISOString();

      const store = useSessionStore.getState();
      const closed = store.closeReplayPosition(positionId, exitPrice, exitTime, 'MANUAL', session.id);
      if (closed) {
        setActivePositions((prev) => prev.filter((p) => p.id !== positionId));
        setTrades((prev) => [...prev, closed]);
        recordTradeCardForAIWatcher(closed);
        const updatedSession = store.sessions.find((s) => s.id === session.id);
        if (updatedSession) {
          setCurrentBalance(updatedSession.currentBalance);
        }
      }
    },
    [currentPrice, session.id, recordTradeCardForAIWatcher]
  );

  // Partial Close Position Handler
  const handlePartialClosePosition = useCallback(
    (positionId: string, closeLots: number) => {
      const pos = activePositionsRef.current.find((p) => p.id === positionId);
      if (!pos || closeLots <= 0) return;

      const exitPrice = pos.side === 'LONG' ? currentPrice.bid : currentPrice.ask;
      const exitTime = latestProgressRef.current.lastReplayTime
        ? new Date(latestProgressRef.current.lastReplayTime * 1000).toISOString()
        : new Date().toISOString();

      const store = useSessionStore.getState();
      const closedTrade = store.partialCloseReplayPosition(
        positionId,
        closeLots,
        exitPrice,
        exitTime,
        'PARTIAL',
        session.id
      );

      if (closedTrade) {
        setTrades((prev) => [...prev, closedTrade]);
        recordTradeCardForAIWatcher(closedTrade);
        const remainingQty = Number((pos.quantity - closeLots).toFixed(2));
        if (remainingQty <= 0.001) {
          setActivePositions((prev) => prev.filter((p) => p.id !== positionId));
        } else {
          setActivePositions((prev) =>
            prev.map((p) => (p.id === positionId ? { ...p, quantity: remainingQty } : p))
          );
        }

        const updatedSession = store.sessions.find((s) => s.id === session.id);
        if (updatedSession) {
          setCurrentBalance(updatedSession.currentBalance);
        }
      }
    },
    [currentPrice, session.id, recordTradeCardForAIWatcher]
  );

  // Cancel Pending Order Handler
  const handleCancelPendingOrder = useCallback(
    (orderId: string) => {
      useSessionStore.getState().cancelPendingOrder(orderId, session.id);
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    },
    [session.id]
  );

  // Update Position SL/TP (Called from drag & drop on chart or modal)
  const handleUpdateSLTP = useCallback(
    (positionId: string, sl?: number, tp?: number) => {
      useSessionStore.getState().updatePositionSLTP(positionId, sl, tp, session.id);
      setActivePositions((prev) =>
        prev.map((p) => (p.id === positionId ? { ...p, stopLoss: sl ?? p.stopLoss, takeProfit: tp ?? p.takeProfit } : p))
      );
    },
    [session.id]
  );

  // Synchronize replay state & process real-time SL/TP hits on each candle tick
  const handleReplayStateChange = useCallback(
    (state: ReplayStateUpdate) => {
      // 1. ALWAYS synchronize current price with the chart's active candle in real time
      if (state.currentBar) {
        const c = state.currentBar.close;
        const spr = isGold ? 0.20 : isCrypto ? 2.0 : isJpy ? 0.015 : 0.00015;

        setCurrentPrice((prev) => {
          if (prev.bid === c) return prev;
          return {
            bid: Number(c.toFixed(defaultDecimals)),
            ask: Number((c + spr).toFixed(defaultDecimals)),
          };
        });
      }

      if (state.currentTime && state.currentTime > 0) {
        anchorTimeRef.current = state.currentTime;
        dataManagerRef.current?.updateReplayTime(state.currentTime);

        // Mark anchored once state reaches or moves past the checkpoint
        if (!isAnchoredRef.current) {
          if (!initialCheckpoint || state.currentTime >= initialCheckpoint) {
            isAnchoredRef.current = true;
          } else {
      
          }
        }

        latestProgressRef.current = {
          lastReplayTime: state.currentTime,
          lastBarIndex: state.barIndex ?? 0,
          totalBars: state.totalBars || bars.length,
          progressPct: state.progressPct ?? 0,
        };

        if (state.currentBar) {
          const bar = state.currentBar;

          // Process SL / TP hits and Pending Order fills on candle
          const barTimeStr = new Date(bar.time * 1000).toISOString();
          const store = useSessionStore.getState();

          // 1. Check SL / TP for active positions
          const currentPositions = activePositionsRef.current;
          for (const pos of currentPositions) {
            let exitPrice: number | null = null;
            let exitReason: 'SL' | 'TP' | null = null;

            if (pos.side === 'LONG') {
              if (pos.stopLoss && bar.low <= pos.stopLoss) {
                exitPrice = pos.stopLoss;
                exitReason = 'SL';
              } else if (pos.takeProfit && bar.high >= pos.takeProfit) {
                exitPrice = pos.takeProfit;
                exitReason = 'TP';
              }
            } else {
              if (pos.stopLoss && bar.high >= pos.stopLoss) {
                exitPrice = pos.stopLoss;
                exitReason = 'SL';
              } else if (pos.takeProfit && bar.low <= pos.takeProfit) {
                exitPrice = pos.takeProfit;
                exitReason = 'TP';
              }
            }

            if (exitPrice !== null && exitReason !== null) {
              const closed = store.closeReplayPosition(pos.id, exitPrice, barTimeStr, exitReason, session.id);
              if (closed) {
                setActivePositions((prev) => prev.filter((p) => p.id !== pos.id));
                setTrades((prev) => [...prev, closed]);
        recordTradeCardForAIWatcher(closed);
                const updatedSession = store.sessions.find((s) => s.id === session.id);
                if (updatedSession) {
                  setCurrentBalance(updatedSession.currentBalance);
                }
              }
            }
          }

          // 2. Check pending orders trigger
          const currentOrders = pendingOrdersRef.current;
          for (const ord of currentOrders) {
            let triggered = false;
            if (ord.orderType === 'LIMIT') {
              if (ord.side === 'LONG' && bar.low <= ord.targetPrice) triggered = true;
              if (ord.side === 'SHORT' && bar.high >= ord.targetPrice) triggered = true;
            } else if (ord.orderType === 'STOP') {
              if (ord.side === 'LONG' && bar.high >= ord.targetPrice) triggered = true;
              if (ord.side === 'SHORT' && bar.low <= ord.targetPrice) triggered = true;
            }

            if (triggered) {
              store.cancelPendingOrder(ord.id, session.id);
              setPendingOrders((prev) => prev.filter((o) => o.id !== ord.id));
              const filledPos = store.openReplayPosition(
                {
                  symbol: ord.symbol,
                  side: ord.side,
                  entryPrice: ord.targetPrice,
                  quantity: ord.quantity,
                  stopLoss: ord.stopLoss,
                  takeProfit: ord.takeProfit,
                  entryTime: barTimeStr,
                  initialBalance: currentBalance,
                },
                session.id
              );
              if (filledPos) {
                setActivePositions((prev) => [...prev, filledPos]);
              }
            }
          }
        }

        // If playback reached 100% and session is active, automatically complete session and prompt user
        if ((state.progressPct ?? 0) >= 100 && sessionStatus !== 'COMPLETED') {
          useSessionStore.getState().completeSession(session.id);
          setSessionStatus('COMPLETED');
          flushProgress();
          setIsDoneDialogOpen(true);
        }

        // If playback paused or stepping, flush immediately
        if (!state.isPlaying) {
          flushProgress();
        } else {
          const now = Date.now();
          if (now - lastFlushTimeRef.current > 2000) {
            flushProgress();
          }
        }
      }
    },
    [bars.length, flushProgress, initialCheckpoint, isGold, isCrypto, isJpy, defaultDecimals, session.id, sessionStatus, recordTradeCardForAIWatcher]
  );

  // Pull market bars through ReplayDataManager
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const anchorToUse = anchorTimeRef.current || initialCheckpoint;

    dataManagerRef.current
      ?.getBarsForReplay({
        symbol,
        timeframe: currentTimeframe,
        anchorTimeSec: anchorToUse,
        sessionStartDate: startDate,
      })
      .then((result) => {
        if (!isCancelled) {
          anchorTimeRef.current = result.anchorTimeSec;
          setBars(result.bars);
          setIsLoading(false);
          if (result.bars.length > 0) {
            let activeBar = result.bars[result.bars.length - 1];
            if (initialCheckpoint) {
              const found = result.bars.find((b) => b.time >= initialCheckpoint);
              if (found) activeBar = found;
            }
            const c = activeBar.close;
            const spr = isGold ? 0.20 : isCrypto ? 2.0 : isJpy ? 0.015 : 0.00015;
            setCurrentPrice({
              bid: Number(c.toFixed(defaultDecimals)),
              ask: Number((c + spr).toFixed(defaultDecimals)),
            });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load replay bars:', err);
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [symbol, currentTimeframe, startDate, initialCheckpoint, isGold, isCrypto, isJpy, defaultDecimals]);

  // Flush on exit, tab hide, page refresh, or unmount
  useEffect(() => {
    const onBeforeUnload = () => {
      flushProgress();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushProgress();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      flushProgress();
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [flushProgress]);

  const handleKeepInDone = useCallback(() => {
    useSessionStore.getState().completeSession(session.id);
    setSessionStatus('COMPLETED');
    flushProgress();
  }, [session.id, flushProgress]);

  const handleCreateNewSession = useCallback(() => {
    flushProgress();
    router.push('/app/backtest');
    setTimeout(() => {
      useSessionStore.getState().setNewSessionModalOpen(true);
    }, 150);
  }, [flushProgress, router]);

  const handleResetSession = useCallback(() => {
    // 1. Invalidate latestProgressRef so unmount or in-flight flush doesn't write stale progress
    if (latestProgressRef.current) {
      latestProgressRef.current = {
        lastReplayTime: 0,
        lastBarIndex: 0,
        totalBars: 0,
        progressPct: 0,
      };
    }
    // 2. Dismiss dialog
    setIsDoneDialogOpen(false);
    // 3. Trigger session reset in store (drops trades, positions, progress, increments version, and clears journal DB)
    useSessionStore.getState().resetSession(session.id);
  }, [session.id]);

  const handleExit = () => {
    flushProgress();
    router.push('/app/backtest');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#070B12] text-slate-200 overflow-hidden font-mono select-none relative">
      {/* 1. Top Workspace Navigation Strip */}
      <div className="h-11 px-2.5 sm:px-3 bg-[#0A0F18] border-b border-[#1A2538] flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Back to Sessions Hub */}
          <button
            onClick={handleExit}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Return to Sessions Hub"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Sessions Hub</span>
            <span className="sm:hidden">Hub</span>
          </button>

          <div className="h-4 w-px bg-[#1E2E44] hidden sm:block" />

          {/* Instrument & Timeframe Tag */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="font-extrabold text-xs sm:text-sm text-slate-100 max-w-[80px] sm:max-w-[160px] md:max-w-[200px] truncate" title={sessionName}>
              {sessionName}
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-[11px] font-bold shrink-0">
              {symbol} · {currentTimeframe.toUpperCase()}
            </span>

            {/* Session Status & Done Action */}
            <button
              type="button"
              onClick={() => setIsDoneDialogOpen(true)}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                sessionStatus === 'COMPLETED'
                  ? 'bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                  : 'bg-[#121A28] hover:bg-emerald-950/50 border border-[#1E2E44] hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300'
              }`}
              title={sessionStatus === 'COMPLETED' ? 'Session is Completed. Click to inspect or manage options' : 'Mark session as Complete / Done'}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${sessionStatus === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{sessionStatus === 'COMPLETED' ? 'DONE' : 'Finish Session'}</span>
              <span className="sm:hidden">{sessionStatus === 'COMPLETED' ? 'DONE' : 'Finish'}</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Real-time Balance, Equity, Floating & Order Pod Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono">
            {/* Realized Balance */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">Balance:</span>
              <span className="font-bold text-slate-100 font-mono text-[11px] sm:text-xs">
                ${Number(currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="h-3 w-px bg-[#1E2E44] hidden md:block" />

            {/* Live Unrealized Equity */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-slate-400">Equity:</span>
              <span className="font-bold text-cyan-300 font-mono text-[11px] sm:text-xs">
                ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Live Floating PnL Badge */}
            {activePositions.length > 0 && (
              <span
                className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-mono font-bold ${
                  totalFloatingPnl >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {totalFloatingPnl >= 0 ? `+$${totalFloatingPnl.toFixed(2)}` : `-$${Math.abs(totalFloatingPnl).toFixed(2)}`}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-[#1E2E44]" />

          {/* Order Pod Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOrderPodOpen(!isOrderPodOpen)}
            className={`px-2 sm:px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${
              isOrderPodOpen
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-[#121A28] hover:bg-[#1A2538] border-[#1E2E44] text-slate-300 hover:text-white'
            }`}
            title={isOrderPodOpen ? 'Collapse Order Pod' : 'Open Order Pod'}
          >
            {isOrderPodOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Order Pod</span>
            <span className="sm:hidden">Pod</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Body: Chart Viewport + Bottom Blotter + Collapsible Right Sidebar */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-row relative overflow-hidden bg-[#080D15]">
        {/* Left Column: Chart on top, Blotter on bottom */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden">
          {/* Main Chart Viewport */}
          <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-[#080D15]">
            <OpenAlgoChart
              bars={bars}
              trades={chartTrades}
              symbol={symbol}
              timeframe={currentTimeframe}
              isLoading={isLoading}
              initialReplayTime={initialCheckpoint || undefined}
              showVolume={true}
              showReplayScrubber={true}
              onTimeframeChange={handleTimeframeChange}
              onReplayStateChange={handleReplayStateChange}
              activeSessionId={session.id}
              onChartApi={setChartApi}
              isCompleted={sessionStatus === 'COMPLETED'}
            />

            {/* Draggable On-Chart SL / TP Order Lines Overlay */}
            <ChartOrderOverlay
              symbol={symbol}
              activePositions={activePositions}
              pendingOrders={pendingOrders}
              currentPrice={currentPrice.bid}
              bidPrice={currentPrice.bid}
              askPrice={currentPrice.ask}
              chartApi={chartApi}
              decimals={defaultDecimals}
              tickSize={pipSize}
              onUpdateSLTP={handleUpdateSLTP}
              onClosePosition={handleClosePosition}
              onCancelPendingOrder={handleCancelPendingOrder}
            />
          </div>

          {/* Bottom Orders, Positions & Trades History Blotter */}
          <BottomOrdersBlotter
            activePositions={activePositions}
            pendingOrders={pendingOrders}
            trades={trades}
            currentPrice={currentPrice.bid}
            bidPrice={currentPrice.bid}
            askPrice={currentPrice.ask}
            decimals={defaultDecimals}
            balance={currentBalance}
            symbol={symbol}
            onClosePosition={handleClosePosition}
            onPartialClosePosition={handlePartialClosePosition}
            onCancelPendingOrder={handleCancelPendingOrder}
          />
        </div>

        {/* Mobile Backdrop when Order Pod is Open on small screens */}
        {isOrderPodOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setIsOrderPodOpen(false)}
          />
        )}

        {/* Right Sidebar: Mobile Slide-Over Drawer / Desktop Collapsible Sidebar */}
        <div
          className={`transition-all duration-300 ease-in-out z-50 md:z-20 overflow-hidden ${
            isOrderPodOpen
              ? 'fixed inset-y-0 right-0 w-[90vw] max-w-[380px] bg-[#070B14] shadow-2xl border-l border-[#1A2538] flex flex-col md:relative md:inset-auto md:w-[360px] lg:w-[380px] md:shadow-none'
              : 'hidden md:flex md:w-10 md:shrink-0 md:border-l md:border-[#1A2538] md:bg-[#070B14]/95 md:flex-col'
          }`}
        >
          {isOrderPodOpen ? (
            <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between pb-1 border-b border-[#141E2E]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-black text-slate-200 tracking-wider">
                    EXECUTION POD · {symbol}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderPodOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#141E2E] transition-colors cursor-pointer"
                  title="Collapse Panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* Variation 5.1 Flagship Hairline Pod (Top ~50%) */}
              <div className="space-y-3">
                <OrderPod
                  balance={currentBalance}
                  symbol={symbol}
                  bid={currentPrice.bid}
                  ask={currentPrice.ask}
                  onExecuteOrder={handleExecuteOrder}
                />
              </div>

              {/* Bottom ~50% Free Space (Reserved for future ideas / clean breathing room) */}
              <AIWatcherSlot
                sessionId={session.id}
                symbol={symbol}
                timeframe={currentTimeframe}
              trades={trades}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 h-full justify-between select-none">
              <button
                type="button"
                onClick={() => setIsOrderPodOpen(true)}
                className="p-2 rounded-lg bg-[#121A28] hover:bg-[#1A2538] border border-[#1E2E44] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Expand Order Pod"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOrderPodOpen(true)}
                className="text-[10px] font-black tracking-widest text-slate-400 uppercase cursor-pointer [writing-mode:vertical-rl] rotate-180 hover:text-cyan-300 transition-colors py-4"
              >
                ORDER POD · {symbol}
              </button>

              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
          )}
        </div>
      </div>

      {/* Session Completed / Done Interactive Dialog */}
      <SessionDoneDialog
        isOpen={isDoneDialogOpen}
        onClose={handleExit}
        onExitToStudio={handleExit}
        session={{ ...session, status: sessionStatus }}
        currentBalance={currentBalance}
        tradesCount={closedTradesCount}
        winRate={sessionWinRate}
        netPnl={sessionNetPnl}
        onKeepInDone={handleKeepInDone}
        onCreateNewSession={handleCreateNewSession}
        onResetSession={handleResetSession}
      />
    </div>
  );
}

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  // Hydration guard: ensures client-only rendering after session store hydrates from localStorage
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Retrieve the target session and track its version for clean remounts on reset
  const activeSession = useSessionStore((state) => {
    const allSessions = state.sessions;
    if (sessionParam) {
      return allSessions.find((s) => s.id === sessionParam) || null;
    }
    const activeId = state.activeSessionId;
    return allSessions.find((s) => s.id === activeId) || allSessions[0] || null;
  });

  if (!mounted || !activeSession) {
    return (
      <div className="w-full h-screen bg-[#070B12] flex items-center justify-center font-mono text-cyan-400 text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="tracking-widest uppercase">Initializing Backtest Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <ActiveWorkspaceSession
      key={`${activeSession.id}_v${activeSession.version || 0}`}
      session={activeSession}
    />
  );
}

export default function BacktestWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#070B12] flex items-center justify-center font-mono text-cyan-400 text-xs">
          Loading Replay Studio Workspace...
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
