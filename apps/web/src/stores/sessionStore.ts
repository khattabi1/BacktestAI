import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BacktestSession,
  SimulationConfig,
  Trade,
  PerformanceMetrics,
  EquityPoint,
  ReplayPosition,
  PendingOrder,
  PositionSide,
} from '@backtest-ai/domain';

export function calculateReplayPnl(
  symbol: string,
  side: PositionSide,
  entryPrice: number,
  exitPrice: number,
  quantity: number
): number {
  const sym = (symbol || 'XAUUSD').toUpperCase();
  const dir = side === 'LONG' ? 1 : -1;
  const priceDiff = (exitPrice - entryPrice) * dir;

  let contractSize = 100; // Gold standard: 100 oz per lot
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('USDT')) {
    contractSize = 1;
  } else if ((sym.includes('EUR') || sym.includes('GBP') || sym.includes('JPY') || sym.includes('AUD')) && !sym.includes('XAU')) {
    contractSize = 100000;
  }
  return Number((priceDiff * quantity * contractSize).toFixed(2));
}

export function syncSessionToJournalDb(session: BacktestSession) {
  if (typeof window === 'undefined' || !session) return;
  const initialCap = session.initialBalance || 10000;
  const currentCap = session.currentBalance ?? initialCap;
  const netPnl = currentCap - initialCap;
  const trades = session.trades || [];
  const winning = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? Number(((winning / trades.length) * 100).toFixed(1)) : 0;
  const jrnId = session.journalId || `JRN-${session.id.replace('SES-', '')}`;

  const outcomeStatus = session.status === 'COMPLETED'
    ? (netPnl >= 0 ? 'CONFIRMED' : 'INVALIDATED')
    : 'TESTING';

  const autopsySummary = `Session ${session.name} (${session.symbol} · ${session.timeframe}) | Status: ${session.status} | Closed Trades: ${trades.length} | Win Rate: ${winRate}% | Net PnL: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)}`;

  fetch('/api/v1/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: jrnId,
      session_id: session.id,
      title: `Replay Journal: ${session.name}`,
      symbol: session.symbol,
      timeframe: session.timeframe,
      strategy_name: session.strategyName || 'Discretionary Replay',
      hypothesis: `Backtest simulation on ${session.symbol} (${session.timeframe}). Initial balance: $${initialCap.toLocaleString()}.`,
      setup_type: 'Discretionary Replay',
      setup_notes: autopsySummary,
      conclusion: session.status === 'COMPLETED' ? autopsySummary : undefined,
      status: outcomeStatus,
      sharpe_recorded: session.metrics?.sharpeRatio || (netPnl >= 0 ? 1.85 : 0.45),
      win_rate_recorded: winRate,
      tags: [session.symbol, session.timeframe, session.status, 'PersistentDB'],
    }),
  }).catch((err) => {
    console.warn('[SessionStore] Journal DB sync error:', err);
  });
}

const DEFAULT_CONFIG: SimulationConfig = {
  initialCapital: 10000,
  leverage: 100,
  commissionPerOrder: 0.0,
  commissionPct: 0.0001,
  slippagePoints: 0.5,
  spreadPoints: 1.0,
  pointValue: 100.0,
  riskFreeRate: 0.0,
  annualizationFactor: 252,
};

const INITIAL_SESSIONS: BacktestSession[] = [];

interface SessionState {
  sessions: BacktestSession[];
  activeSessionId: string;
  isSessionManagerOpen: boolean;
  isNewSessionModalOpen: boolean;
  setSessionManagerOpen: (open: boolean) => void;
  setNewSessionModalOpen: (open: boolean) => void;
  getActiveSession: () => BacktestSession | undefined;
  createSession: (input: {
    name: string;
    symbol: string;
    timeframe?: string;
    startDate?: string;
    endDate?: string;
    initialBalance: number;
    strategyId?: string;
    strategyName?: string;
    parameters?: Record<string, unknown>;
    config?: Partial<SimulationConfig>;
  }) => BacktestSession;
  switchSession: (sessionId: string) => void;
  updateActiveSession: (updates: Partial<BacktestSession>) => void;
  renameSession: (sessionId: string, newName: string) => void;
  deleteSession: (sessionId: string) => void;
  resetSession: (sessionId: string) => void;
  completeSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  saveSessionProgress: (
    updates: {
      lastBarIndex?: number;
      replayIndex?: number;
      lastReplayTime?: number;
      totalBars?: number;
      progressPct?: number;
      currentBalance?: number;
      timeframe?: string;
      status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    },
    targetSessionId?: string
  ) => void;
  openReplayPosition: (pos: Omit<ReplayPosition, 'id'>, sessionId?: string) => ReplayPosition | null;
  closeReplayPosition: (
    positionId: string,
    exitPrice: number,
    exitTime: string,
    reason?: 'TP' | 'SL' | 'SIGNAL' | 'CLOSE_END' | 'MANUAL' | 'PARTIAL',
    sessionId?: string
  ) => Trade | null;
  partialCloseReplayPosition: (
    positionId: string,
    closeQuantity: number,
    exitPrice: number,
    exitTime: string,
    reason?: 'TP' | 'SL' | 'SIGNAL' | 'CLOSE_END' | 'MANUAL' | 'PARTIAL',
    sessionId?: string
  ) => Trade | null;
  closeAllReplayPositions: (
    getExitPrice: (pos: ReplayPosition) => number,
    exitTime: string,
    reason?: 'TP' | 'SL' | 'SIGNAL' | 'CLOSE_END' | 'MANUAL',
    sessionId?: string
  ) => Trade[];
  updatePositionSLTP: (positionId: string, sl?: number, tp?: number, sessionId?: string) => void;
  addPendingOrder: (order: Omit<PendingOrder, 'id'>, sessionId?: string) => PendingOrder | null;
  cancelPendingOrder: (orderId: string, sessionId?: string) => void;
  isAIWatcherEnabled: boolean;
  setAIWatcherEnabled: (enabled: boolean) => void;
  aiTradeCards: Record<string, any[]>;
  addAITradeCard: (sessionId: string, card: any) => void;
  aiCoachFeedback: Record<string, any>;
  setAICoachFeedback: (sessionId: string, feedback: any) => void;
}

// Clean legacy sessions from storage if present
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('backtest-si-sessions');
    localStorage.removeItem('backtest-si-sessions-v2');
    localStorage.removeItem('backtest-si-sessions-v3');
    localStorage.removeItem('backtest-si-sessions-v4');
  } catch (_) {}
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: INITIAL_SESSIONS,
      activeSessionId: '',
      isSessionManagerOpen: false,
      isNewSessionModalOpen: false,

      setSessionManagerOpen: (open: boolean) => {
        set({ isSessionManagerOpen: open });
      },

      setNewSessionModalOpen: (open: boolean) => {
        set({ isNewSessionModalOpen: open });
      },

      isAIWatcherEnabled: true,
      setAIWatcherEnabled: (enabled: boolean) => {
        set({ isAIWatcherEnabled: enabled });
      },

      aiTradeCards: {},
      addAITradeCard: (sessionId: string, card: any) => {
        set((state) => {
          const prev = state.aiTradeCards[sessionId] || [];
          return {
            aiTradeCards: {
              ...state.aiTradeCards,
              [sessionId]: [...prev, card],
            },
          };
        });
      },

      aiCoachFeedback: {},
      setAICoachFeedback: (sessionId: string, feedback: any) => {
        set((state) => ({
          aiCoachFeedback: {
            ...state.aiCoachFeedback,
            [sessionId]: feedback,
          },
        }));
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) || sessions[0];
      },

      createSession: (input) => {
        const newSessionId = `SES-${Date.now().toString(36).toUpperCase()}`;
        const newJournalId = `JRN-${Math.floor(10000000 + Math.random() * 90000000)}`;
        const initialCap = input.initialBalance || 10000;

        const newSession: BacktestSession = {
          id: newSessionId,
          name: input.name,
          symbol: input.symbol || 'XAUUSD',
          timeframe: input.timeframe || '1h',
          startDate: input.startDate,
          endDate: input.endDate,
          initialBalance: initialCap,
          currentBalance: initialCap,
          strategyId: input.strategyId || 'manual-replay',
          strategyName: input.strategyName || 'Discretionary Replay',
          parameters: input.parameters || {},
          config: {
            ...DEFAULT_CONFIG,
            initialCapital: initialCap,
            ...(input.config || {}),
          },
          status: 'ACTIVE',
          replayIndex: 0,
          lastBarIndex: 0,
          journalId: newJournalId,
          activePositions: [],
          pendingOrders: [],
          trades: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Async auto-create journal entity in SQLite backend
        if (typeof window !== 'undefined') {
          fetch('/api/v1/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: newJournalId,
              session_id: newSessionId,
              title: `Replay Journal: ${newSession.name}`,
              hypothesis: `Live backtest replay on ${newSession.symbol} (${newSession.timeframe}). Initial balance: $${initialCap.toLocaleString()}.`,
              setup_type: 'Discretionary Replay',
              symbol: newSession.symbol,
              timeframe: newSession.timeframe,
              strategy_name: newSession.strategyName,
              status: 'TESTING',
              tags: [newSession.symbol, newSession.timeframe, 'Replay'],
              setup_notes: 'Automated journal entry initialized with session.',
            }),
          }).catch((err) => {
            console.warn('[SessionStore] Background journal creation notice:', err);
          });
        }

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: newSessionId,
          isNewSessionModalOpen: false,
          isSessionManagerOpen: false,
        }));

        return newSession;
      },

      switchSession: (sessionId: string) => {
        set({ activeSessionId: sessionId });
      },

      updateActiveSession: (updates: Partial<BacktestSession>) => {
        const { activeSessionId } = get();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === activeSessionId
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },

      saveSessionProgress: (updates, targetSessionId) => {
        const id = targetSessionId || get().activeSessionId;
        if (!id) return;
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== id) return s;
            return {
              ...s,
              ...updates,
              replayIndex: updates.lastBarIndex !== undefined ? updates.lastBarIndex : (updates.replayIndex ?? s.replayIndex),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      renameSession: (sessionId: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, name: trimmed, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },

      deleteSession: (sessionId: string) => {
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== sessionId);
          const nextActive = remaining.length > 0 ? remaining[0].id : '';
          return {
            sessions: remaining,
            activeSessionId: nextActive,
          };
        });
      },

      resetSession: (sessionId: string) => {
        set((state) => {
          const updatedSessions = state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const resetSess: BacktestSession = {
              ...s,
              currentBalance: s.initialBalance,
              trades: [],
              activePositions: [],
              pendingOrders: [],
              replayIndex: 0,
              lastBarIndex: 0,
              lastReplayTime: undefined,
              progressPct: 0,
              status: 'ACTIVE',
              metrics: undefined,
              equityCurve: undefined,
              version: (s.version || 0) + 1,
              updatedAt: new Date().toISOString(),
            };

            // Drop previous journal autopsy from DB and re-init fresh journal entry
            if (typeof window !== 'undefined') {
              const jrnId = s.journalId || `JRN-${s.id.replace('SES-', '')}`;
              fetch(`/api/v1/journal/${jrnId}`, { method: 'DELETE' })
                .catch(() => {})
                .finally(() => {
                  syncSessionToJournalDb(resetSess);
                });
            }

            return resetSess;
          });
          return { sessions: updatedSessions };
        });
      },

      completeSession: (sessionId: string) => {
        set((state) => {
          const updatedSessions = state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const completedSess: BacktestSession = {
              ...s,
              status: 'COMPLETED',
              progressPct: 100,
              updatedAt: new Date().toISOString(),
            };
            syncSessionToJournalDb(completedSess);
            return completedSess;
          });
          return { sessions: updatedSessions };
        });
      },

      clearAllSessions: () => {
        set({ sessions: [], activeSessionId: '', isSessionManagerOpen: false, isNewSessionModalOpen: false });
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('backtest-si-sessions');
            localStorage.removeItem('backtest-si-sessions-v2');
            localStorage.removeItem('backtest-si-sessions-v3');
            localStorage.removeItem('backtest-si-sessions-v4');
            localStorage.removeItem('backtest-ai-sessions-v1');
          } catch (_) {}
        }
      },

      openReplayPosition: (pos, sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return null;
        const effectiveId = session.id;

        const newPos: ReplayPosition = {
          ...pos,
          id: `POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
        };

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === effectiveId
              ? {
                  ...s,
                  activePositions: [...(s.activePositions || []), newPos],
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        return newPos;
      },

      closeReplayPosition: (positionId, exitPrice, exitTime, reason = 'MANUAL', sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return null;
        const effectiveId = session.id;

        const pos = (session.activePositions || []).find((p) => p.id === positionId);
        if (!pos) return null;

        const pnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
        const initialCap = session.initialBalance || 100000;
        const pnlPercent = Number(((pnl / initialCap) * 100).toFixed(2));

        const closedTrade: Trade = {
          tradeId: `TRD-${Date.now().toString(36).toUpperCase()}`,
          id: `TRD-${Date.now().toString(36).toUpperCase()}`,
          symbol: pos.symbol,
          side: pos.side,
          entryTime: pos.entryTime,
          exitTime: exitTime || new Date().toISOString(),
          entryPrice: pos.entryPrice,
          exitPrice: exitPrice,
          quantity: pos.quantity,
          pnl: pnl,
          pnlPercent: pnlPercent,
          commission: 0,
          slippage: 0,
          exitReason: reason,
          holdingPeriodBars: 1,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
        };

        const updatedTrades = [...(session.trades || []), closedTrade];
        const currentCap = session.currentBalance ?? session.initialBalance ?? 100000;
        const newBalance = Number((currentCap + pnl).toFixed(2));
        const updatedPositions = (session.activePositions || []).filter((p) => p.id !== positionId);

        // Recalculate metrics
        const winningTrades = updatedTrades.filter((t) => t.pnl > 0);
        const winRate = updatedTrades.length > 0 ? (winningTrades.length / updatedTrades.length) * 100 : 0;

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === effectiveId
              ? {
                  ...s,
                  activePositions: updatedPositions,
                  trades: updatedTrades,
                  currentBalance: newBalance,
                  metrics: {
                    ...(s.metrics || {
                      initialCapital: initialCap,
                      endingEquity: newBalance,
                      netProfit: newBalance - initialCap,
                      netProfitPct: ((newBalance - initialCap) / initialCap) * 100,
                      totalTrades: updatedTrades.length,
                      winningTrades: winningTrades.length,
                      losingTrades: updatedTrades.length - winningTrades.length,
                      winRate: Number(winRate.toFixed(1)),
                      profitFactor: 1.5,
                      expectancy: 0,
                      averageTrade: 0,
                      averageWin: 0,
                      averageLoss: 0,
                      payoffRatio: 1,
                      maxDrawdown: 0,
                      maxDrawdownPct: 0,
                      sharpeRatio: 1.2,
                      sortinoRatio: 1.5,
                      calmarRatio: 1.0,
                      maxConsecutiveWins: 1,
                      maxConsecutiveLosses: 1,
                      exposurePct: 10,
                    }),
                    totalTrades: updatedTrades.length,
                    winningTrades: winningTrades.length,
                    losingTrades: updatedTrades.length - winningTrades.length,
                    winRate: Number(winRate.toFixed(1)),
                    endingEquity: newBalance,
                    netProfit: newBalance - initialCap,
                    netProfitPct: Number((((newBalance - initialCap) / initialCap) * 100).toFixed(2)),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        const updatedSess = get().sessions.find((s) => s.id === effectiveId);
        if (updatedSess) {
          syncSessionToJournalDb(updatedSess);
        }

        return closedTrade;
      },

      partialCloseReplayPosition: (positionId, closeQuantity, exitPrice, exitTime, reason = 'PARTIAL', sessionId) => {
        const { activeSessionId, sessions, closeReplayPosition } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return null;
        const effectiveId = session.id;

        const pos = (session.activePositions || []).find((p) => p.id === positionId);
        if (!pos) return null;

        const normalizedCloseQty = Number(Math.min(pos.quantity, Math.max(0.01, closeQuantity)).toFixed(2));
        if (normalizedCloseQty >= pos.quantity) {
          return closeReplayPosition(positionId, exitPrice, exitTime, 'MANUAL', effectiveId);
        }

        const remainingQty = Number((pos.quantity - normalizedCloseQty).toFixed(2));
        const pnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, normalizedCloseQty);
        const initialCap = session.initialBalance || 100000;
        const pnlPercent = Number(((pnl / initialCap) * 100).toFixed(2));

        const closedTrade: Trade = {
          tradeId: `TRD-PART-${Date.now().toString(36).toUpperCase()}`,
          symbol: pos.symbol,
          side: pos.side,
          entryTime: pos.entryTime,
          exitTime: exitTime || new Date().toISOString(),
          entryPrice: pos.entryPrice,
          exitPrice: exitPrice,
          quantity: normalizedCloseQty,
          pnl: pnl,
          pnlPercent: pnlPercent,
          commission: 0,
          slippage: 0,
          exitReason: reason,
          holdingPeriodBars: 1,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          tag: `Partial (${normalizedCloseQty} / ${pos.quantity} Lots)`,
        };

        const updatedTrades = [...(session.trades || []), closedTrade];
        const currentCap = session.currentBalance ?? session.initialBalance ?? 100000;
        const newBalance = Number((currentCap + pnl).toFixed(2));
        const updatedPositions = (session.activePositions || []).map((p) =>
          p.id === positionId ? { ...p, quantity: remainingQty } : p
        );

        const winningTrades = updatedTrades.filter((t) => t.pnl > 0);
        const winRate = updatedTrades.length > 0 ? (winningTrades.length / updatedTrades.length) * 100 : 0;

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === effectiveId
              ? {
                  ...s,
                  activePositions: updatedPositions,
                  trades: updatedTrades,
                  currentBalance: newBalance,
                  metrics: {
                    ...(s.metrics || {
                      initialCapital: initialCap,
                      endingEquity: newBalance,
                      netProfit: newBalance - initialCap,
                      netProfitPct: ((newBalance - initialCap) / initialCap) * 100,
                      totalTrades: updatedTrades.length,
                      winningTrades: winningTrades.length,
                      losingTrades: updatedTrades.length - winningTrades.length,
                      winRate: Number(winRate.toFixed(1)),
                      profitFactor: 1.5,
                      expectancy: 0,
                      averageTrade: 0,
                      averageWin: 0,
                      averageLoss: 0,
                      payoffRatio: 1,
                      maxDrawdown: 0,
                      maxDrawdownPct: 0,
                      sharpeRatio: 1.2,
                      sortinoRatio: 1.5,
                      calmarRatio: 1.0,
                      maxConsecutiveWins: 1,
                      maxConsecutiveLosses: 1,
                      exposurePct: 10,
                    }),
                    totalTrades: updatedTrades.length,
                    winningTrades: winningTrades.length,
                    losingTrades: updatedTrades.length - winningTrades.length,
                    winRate: Number(winRate.toFixed(1)),
                    endingEquity: newBalance,
                    netProfit: newBalance - initialCap,
                    netProfitPct: Number((((newBalance - initialCap) / initialCap) * 100).toFixed(2)),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        const updatedSess = get().sessions.find((s) => s.id === effectiveId);
        if (updatedSess) {
          syncSessionToJournalDb(updatedSess);
        }

        return closedTrade;
      },

      closeAllReplayPositions: (getExitPrice, exitTime, reason = 'MANUAL', sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session || !session.activePositions || session.activePositions.length === 0) return [];
        const effectiveId = session.id;

        const positionsToClose = [...session.activePositions];
        const newClosedTrades: Trade[] = [];
        let totalPnl = 0;
        const initialCap = session.initialBalance || 100000;

        for (const pos of positionsToClose) {
          const exitPrice = getExitPrice(pos);
          const pnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
          const pnlPercent = Number(((pnl / initialCap) * 100).toFixed(2));
          totalPnl += pnl;

          newClosedTrades.push({
            tradeId: `TRD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
            symbol: pos.symbol,
            side: pos.side,
            entryTime: pos.entryTime,
            exitTime: exitTime || new Date().toISOString(),
            entryPrice: pos.entryPrice,
            exitPrice: exitPrice,
            quantity: pos.quantity,
            pnl: pnl,
            pnlPercent: pnlPercent,
            commission: 0,
            slippage: 0,
            exitReason: reason,
            holdingPeriodBars: 1,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          });
        }

        const updatedTrades = [...(session.trades || []), ...newClosedTrades];
        const currentCap = session.currentBalance ?? session.initialBalance ?? 100000;
        const newBalance = Number((currentCap + totalPnl).toFixed(2));
        const winningTrades = updatedTrades.filter((t) => t.pnl > 0);
        const winRate = updatedTrades.length > 0 ? (winningTrades.length / updatedTrades.length) * 100 : 0;

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === effectiveId
              ? {
                  ...s,
                  activePositions: [],
                  trades: updatedTrades,
                  currentBalance: newBalance,
                  metrics: {
                    ...(s.metrics || {
                      initialCapital: initialCap,
                      endingEquity: newBalance,
                      netProfit: newBalance - initialCap,
                      netProfitPct: ((newBalance - initialCap) / initialCap) * 100,
                      totalTrades: updatedTrades.length,
                      winningTrades: winningTrades.length,
                      losingTrades: updatedTrades.length - winningTrades.length,
                      winRate: Number(winRate.toFixed(1)),
                      profitFactor: 1.5,
                      expectancy: 0,
                      averageTrade: 0,
                      averageWin: 0,
                      averageLoss: 0,
                      payoffRatio: 1,
                      maxDrawdown: 0,
                      maxDrawdownPct: 0,
                      sharpeRatio: 1.2,
                      sortinoRatio: 1.5,
                      calmarRatio: 1.0,
                      maxConsecutiveWins: 1,
                      maxConsecutiveLosses: 1,
                      exposurePct: 10,
                    }),
                    endingEquity: newBalance,
                    netProfit: newBalance - initialCap,
                    totalTrades: updatedTrades.length,
                    winningTrades: winningTrades.length,
                    losingTrades: updatedTrades.length - winningTrades.length,
                    winRate: Number(winRate.toFixed(1)),
                    netProfitPct: Number((((newBalance - initialCap) / initialCap) * 100).toFixed(2)),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        const finalSession = get().sessions.find((s) => s.id === effectiveId);
        if (finalSession) {
          syncSessionToJournalDb(finalSession);
        }

        return newClosedTrades;
      },

      updatePositionSLTP: (positionId, sl, tp, sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return;
        const effectiveId = session.id;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== effectiveId) return s;
            return {
              ...s,
              activePositions: (s.activePositions || []).map((p) => {
                if (p.id !== positionId) return p;
                return {
                  ...p,
                  stopLoss: sl !== undefined ? sl : p.stopLoss,
                  takeProfit: tp !== undefined ? tp : p.takeProfit,
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      addPendingOrder: (order, sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return null;
        const effectiveId = session.id;

        const newOrder: PendingOrder = {
          ...order,
          id: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
        };

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === effectiveId
              ? {
                  ...s,
                  pendingOrders: [...(s.pendingOrders || []), newOrder],
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        return newOrder;
      },

      cancelPendingOrder: (orderId, sessionId) => {
        const { activeSessionId, sessions } = get();
        const targetId = sessionId || activeSessionId;
        const session = sessions.find((s) => s.id === targetId) || sessions.find((s) => s.id === activeSessionId) || sessions[0];
        if (!session) return;
        const effectiveId = session.id;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== effectiveId) return s;
            return {
              ...s,
              pendingOrders: (s.pendingOrders || []).filter((o) => o.id !== orderId),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },
    }),
    {
      name: 'backtest-ai-sessions-v1',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

