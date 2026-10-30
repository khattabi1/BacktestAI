'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  Tag,
  CheckCircle2,
  X,
  ExternalLink,
  Edit3,
  Bookmark,
  Sparkles,
  Download,
  Trash2,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Pencil,
  Percent,
  AlertCircle,
} from 'lucide-react';
import type { ChartTrade } from '@backtest-ai/chart';
import type { ReplayPosition } from '@backtest-ai/domain';
import { useSessionStore, calculateReplayPnl } from '@/stores/sessionStore';

export interface TradeJournalNote {
  setupType: string;
  discipline: 'A_PLUS' | 'DISCIPLINED' | 'FOMO' | 'HESITATED';
  notes: string;
  annotatedAt: string;
}

interface ReplayJournalDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  trades: ChartTrade[];
  activePositions?: ReplayPosition[];
  activePosition?: ReplayPosition | null; // legacy fallback
  currentPrice?: number;
  bidPrice?: number;
  askPrice?: number;
  decimals?: number;
  onClosePosition?: (positionId: string) => void;
  onCloseAllPositions?: () => void;
  onUpdatePositionSLTP?: (positionId: string, sl?: number, tp?: number) => void;
  onPartialClosePosition?: (positionId: string, quantity: number) => void;
  symbol: string;
  timeframe: string;
  runStats: {
    netProfit: number;
    netProfitPct: number;
    winRate: number;
    sharpeRatio: number;
    profitFactor: number;
    maxDrawdownPct: number;
    totalTrades: number;
    durationMs: number;
  } | null;
  onClearTrades?: () => void;
}

const SETUP_CATEGORIES = [
  'Breakout',
  'Order Block / FVG',
  'Liquidity Sweep',
  'Trend Continuation',
  'Mean Reversion',
  'Support / Resistance Bounce',
];

const DISCIPLINE_TAGS = [
  { id: 'A_PLUS', label: 'A+ Perfect Setup', color: 'text-emerald-edge bg-emerald-edge/10 border-emerald-edge/30' },
  { id: 'DISCIPLINED', label: 'Disciplined Execution', color: 'text-cyan-accent bg-cyan-accent/10 border-cyan-accent/30' },
  { id: 'FOMO', label: 'FOMO / Chased Entry', color: 'text-crimson-risk bg-crimson-risk/10 border-crimson-risk/30' },
  { id: 'HESITATED', label: 'Hesitated / Late Fill', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
];

export function ReplayJournalDrawer({
  isOpen,
  onToggle,
  trades,
  activePositions: propActivePositions,
  activePosition: propActivePosition,
  currentPrice = 0,
  bidPrice,
  askPrice,
  decimals = 2,
  onClosePosition,
  onCloseAllPositions,
  onUpdatePositionSLTP,
  onPartialClosePosition,
  symbol,
  timeframe,
  runStats,
  onClearTrades,
}: ReplayJournalDrawerProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'blotter' | 'journal'>('positions');
  const [selectedTradeForNote, setSelectedTradeForNote] = useState<ChartTrade | null>(null);
  const [tradeNotes, setTradeNotes] = useState<Record<string, TradeJournalNote>>({});
  const [editingNoteText, setEditingNoteText] = useState('');
  const [selectedSetupType, setSelectedSetupType] = useState(SETUP_CATEGORIES[0]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<'A_PLUS' | 'DISCIPLINED' | 'FOMO' | 'HESITATED'>('DISCIPLINED');
  const [sessionNotes, setSessionNotes] = useState('');
  const [savedJournalNotification, setSavedJournalNotification] = useState(false);

  // Edit Position SL / TP Modal State
  const [editingLevels, setEditingLevels] = useState<{
    position: ReplayPosition;
    slStr: string;
    tpStr: string;
    error: string | null;
  } | null>(null);

  // Partial Close Modal State
  const [partialTarget, setPartialTarget] = useState<{
    position: ReplayPosition;
    closeQuantity: number;
  } | null>(null);

  const { getActiveSession } = useSessionStore();
  const activeSession = getActiveSession();

  // Normalize active positions
  const activePositions: ReplayPosition[] = propActivePositions || (propActivePosition ? [propActivePosition] : []);

  // Switch to Open Positions tab automatically when positions count increases
  const prevCountRef = useRef(activePositions.length);
  useEffect(() => {
    if (activePositions.length > prevCountRef.current) {
      setActiveTab('positions');
    }
    prevCountRef.current = activePositions.length;
  }, [activePositions.length]);

  // Total floating PnL across all open positions
  const totalOpenPnl = useMemo(() => {
    return activePositions.reduce((sum, pos) => {
      const exitPrice = pos.side === 'LONG' ? (bidPrice ?? currentPrice) : (askPrice ?? currentPrice);
      return sum + calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
    }, 0);
  }, [activePositions, bidPrice, askPrice, currentPrice]);

  const handleOpenNoteEditor = (trade: ChartTrade) => {
    setSelectedTradeForNote(trade);
    const existing = tradeNotes[trade.id];
    if (existing) {
      setEditingNoteText(existing.notes);
      setSelectedSetupType(existing.setupType);
      setSelectedDiscipline(existing.discipline);
    } else {
      setEditingNoteText('');
      setSelectedSetupType(SETUP_CATEGORIES[0]);
      setSelectedDiscipline('DISCIPLINED');
    }
  };

  const handleOpenEditLevels = (pos: ReplayPosition) => {
    setEditingLevels({
      position: pos,
      slStr: pos.stopLoss ? pos.stopLoss.toFixed(decimals) : '',
      tpStr: pos.takeProfit ? pos.takeProfit.toFixed(decimals) : '',
      error: null,
    });
  };

  const handleSaveLevels = () => {
    if (!editingLevels || !onUpdatePositionSLTP) return;
    const { position, slStr, tpStr } = editingLevels;
    const newSL = slStr.trim() ? parseFloat(slStr) : undefined;
    const newTP = tpStr.trim() ? parseFloat(tpStr) : undefined;

    // Impossible cases validation
    if (newSL !== undefined && !isNaN(newSL)) {
      if (position.side === 'LONG' && newSL >= position.entryPrice) {
        setEditingLevels((prev) => prev ? { ...prev, error: `Invalid SL: For a LONG position, Stop Loss must be strictly below entry price ($${position.entryPrice.toFixed(decimals)})` } : null);
        return;
      }
      if (position.side === 'SHORT' && newSL <= position.entryPrice) {
        setEditingLevels((prev) => prev ? { ...prev, error: `Invalid SL: For a SHORT position, Stop Loss must be strictly above entry price ($${position.entryPrice.toFixed(decimals)})` } : null);
        return;
      }
    }

    if (newTP !== undefined && !isNaN(newTP)) {
      if (position.side === 'LONG' && newTP <= position.entryPrice) {
        setEditingLevels((prev) => prev ? { ...prev, error: `Invalid TP: For a LONG position, Take Profit must be strictly above entry price ($${position.entryPrice.toFixed(decimals)})` } : null);
        return;
      }
      if (position.side === 'SHORT' && newTP >= position.entryPrice) {
        setEditingLevels((prev) => prev ? { ...prev, error: `Invalid TP: For a SHORT position, Take Profit must be strictly below entry price ($${position.entryPrice.toFixed(decimals)})` } : null);
        return;
      }
    }

    onUpdatePositionSLTP(position.id, newSL, newTP);
    setEditingLevels(null);
  };

  const handleConfirmPartialClose = () => {
    if (!partialTarget || !onPartialClosePosition) return;
    const { position, closeQuantity } = partialTarget;
    if (closeQuantity <= 0) return;
    onPartialClosePosition(position.id, closeQuantity);
    setPartialTarget(null);
  };

  const handleSaveTradeNote = () => {
    if (!selectedTradeForNote) return;
    setTradeNotes((prev) => ({
      ...prev,
      [selectedTradeForNote.id]: {
        setupType: selectedSetupType,
        discipline: selectedDiscipline,
        notes: editingNoteText,
        annotatedAt: new Date().toISOString(),
      },
    }));
    setSelectedTradeForNote(null);
  };

  const handleExportToResearchJournal = async () => {
    if (activeSession) {
      try {
        await fetch('/api/v1/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeSession.journalId || `JRN-${Date.now()}`,
            session_id: activeSession.id,
            title: `Autopsy: ${activeSession.name}`,
            hypothesis: sessionNotes || `Discretionary replay session on ${symbol} (${timeframe}).`,
            setup_type: selectedSetupType,
            symbol: symbol,
            timeframe: timeframe,
            strategy_name: activeSession.strategyName,
            status: runStats && runStats.netProfit > 0 ? 'VALIDATED' : 'TESTING',
            setup_notes: Object.values(tradeNotes).map((n) => `[${n.setupType} - ${n.discipline}] ${n.notes}`).join('\n\n'),
            tags: [symbol, timeframe, 'Replay', selectedDiscipline],
            sharpe_recorded: runStats?.sharpeRatio || 0,
            win_rate_recorded: runStats?.winRate || 0,
          }),
        });
      } catch (err) {
        console.warn('Could not sync to journal API:', err);
      }
    }
    setSavedJournalNotification(true);
    setTimeout(() => setSavedJournalNotification(false), 3000);
  };

  const handleDownloadCSV = () => {
    if (trades.length === 0) return;
    const headers = 'TradeID,Side,Quantity,EntryPrice,ExitPrice,PnL,PnLPercent,ExitReason,Setup,Discipline,Notes\n';
    const rows = trades.map((t) => {
      const note = tradeNotes[t.id];
      const setup = note ? note.setupType : 'Unassigned';
      const disc = note ? note.discipline : 'Standard';
      const userNote = note ? `"${note.notes.replace(/"/g, '""')}"` : '""';
      return `${t.id},${t.side},${t.quantity},${t.entryPrice},${t.exitPrice},${t.pnl},${t.pnlPercent},${t.exitReason},${setup},${disc},${userNote}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `replay_ledger_${symbol}_${timeframe}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border-t border-obsidian-border bg-obsidian-sub/95 backdrop-blur-md shrink-0 z-10 font-mono select-none">
      {/* Drawer Control Bar */}
      <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-obsidian-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-slate-text hover:text-cyan-accent transition-colors font-semibold shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-accent" />
            <span>Replay Session Ledger ({trades.length} trades)</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Active Open Position Badge in Bottom Bar */}
          {activePositions.length === 1 && (
            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-[#0F172A] border border-cyan-500/40 text-[11px] shadow-sm animate-in fade-in">
              <span className={`w-2 h-2 rounded-full ${activePositions[0].side === 'LONG' ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
              <span className={`font-black ${activePositions[0].side === 'LONG' ? 'text-emerald-300' : 'text-rose-300'}`}>
                {activePositions[0].side}
              </span>
              <span className="text-slate-200">{activePositions[0].quantity} Lots</span>
              <span className="text-slate-400 font-mono">@{activePositions[0].entryPrice.toFixed(decimals)}</span>
              <span className={`font-mono font-bold ${totalOpenPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toFixed(2)}
              </span>
              {onClosePosition && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClosePosition(activePositions[0].id);
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all ml-1 cursor-pointer"
                >
                  Close Position
                </button>
              )}
            </div>
          )}

          {activePositions.length > 1 && (
            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-[#0F172A] border border-cyan-500/40 text-[11px] shadow-sm animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-cyan-300">
                {activePositions.length} POSITIONS
              </span>
              <span className={`font-mono font-bold ${totalOpenPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Net: {totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toFixed(2)}
              </span>
              {onCloseAllPositions && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseAllPositions();
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all ml-1 cursor-pointer"
                >
                  Close All
                </button>
              )}
            </div>
          )}

          {/* Tab Switcher */}
          {isOpen && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-obsidian-card border border-obsidian-border text-[11px] ml-1">
              <button
                onClick={() => setActiveTab('positions')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'positions'
                    ? 'bg-cyan-accent/20 text-cyan-accent font-bold'
                    : 'text-slate-muted hover:text-slate-text'
                }`}
              >
                {activePositions.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                <span>Open Positions ({activePositions.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('blotter')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'blotter'
                    ? 'bg-cyan-accent/20 text-cyan-accent font-bold'
                    : 'text-slate-muted hover:text-slate-text'
                }`}
              >
                Trade History ({trades.length})
              </button>
              <button
                onClick={() => setActiveTab('journal')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'journal'
                    ? 'bg-violet-intel/20 text-violet-intel font-bold'
                    : 'text-slate-muted hover:text-slate-text'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Session Autopsy &amp; Notes</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Performance Stats & Action Buttons */}
        <div className="flex items-center gap-3">
          {runStats && (
            <div className="hidden md:flex items-center gap-4 text-[11px]">
              <span className="text-slate-muted">
                Net PnL:{' '}
                <span className={`font-bold ${runStats.netProfit >= 0 ? 'text-emerald-edge' : 'text-crimson-risk'}`}>
                  {runStats.netProfit >= 0 ? '+' : ''}${runStats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({runStats.netProfitPct}%)
                </span>
              </span>
              <span className="text-slate-muted">
                Win Rate: <span className="font-bold text-slate-text">{runStats.winRate}%</span>
              </span>
              <span className="text-slate-muted">
                Sharpe: <span className="font-bold text-cyan-accent">{runStats.sharpeRatio}</span>
              </span>
            </div>
          )}

          {isOpen && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadCSV}
                disabled={trades.length === 0}
                className="px-2 py-1 rounded bg-obsidian-card hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-slate-subtext hover:text-slate-text transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                title="Download CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportToResearchJournal}
                className="px-2.5 py-1 rounded bg-violet-intel/20 hover:bg-violet-intel/30 border border-violet-intel/40 text-[10px] text-violet-intel font-semibold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save to Journal</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="max-h-60 overflow-y-auto p-2">
          {/* Saved Notification Banner */}
          {savedJournalNotification && (
            <div className="mb-2 p-2 rounded-lg bg-violet-intel/15 border border-violet-intel/40 text-violet-intel text-xs flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Session autopsy saved to Research Journal!
              </span>
              <Link
                href="/app/journal"
                className="text-[11px] underline hover:text-white flex items-center gap-1"
              >
                <span>View Journal</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* TAB 1: OPEN POSITIONS */}
          {activeTab === 'positions' ? (
            activePositions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-muted">
                No active open positions. Execute BUY or SELL from the order panel or chart to open a trade.
              </div>
            ) : (
              <div>
                {activePositions.length > 1 && onCloseAllPositions && (
                  <div className="px-3 py-1.5 bg-[#0b101b] border-b border-obsidian-border/50 flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">
                      Total Floating PnL: <span className={`font-bold font-mono ${totalOpenPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toFixed(2)}</span>
                    </span>
                    <button
                      onClick={onCloseAllPositions}
                      className="px-2.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Close All ({activePositions.length})
                    </button>
                  </div>
                )}
                <table className="w-full text-left text-xs">
                  <thead className="bg-obsidian-card text-[10px] uppercase text-slate-muted border-b border-obsidian-border">
                    <tr>
                      <th className="py-1.5 px-3">Position ID</th>
                      <th className="py-1.5 px-3">Symbol</th>
                      <th className="py-1.5 px-3">Side</th>
                      <th className="py-1.5 px-3">Size</th>
                      <th className="py-1.5 px-3">Entry Price</th>
                      <th className="py-1.5 px-3">Market Price</th>
                      <th className="py-1.5 px-3">Stop Loss</th>
                      <th className="py-1.5 px-3">Take Profit</th>
                      <th className="py-1.5 px-3 text-right">Floating PnL ($)</th>
                      <th className="py-1.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-border/40 text-[11px]">
                    {activePositions.map((pos) => {
                      const exitPrice = pos.side === 'LONG' ? (bidPrice ?? currentPrice) : (askPrice ?? currentPrice);
                      const posPnl = calculateReplayPnl(pos.symbol, pos.side, pos.entryPrice, exitPrice, pos.quantity);
                      const posPnlPct = pos.entryPrice > 0 ? (((exitPrice - pos.entryPrice) / pos.entryPrice) * (pos.side === 'LONG' ? 100 : -100)).toFixed(2) : '0.00';
                      return (
                        <tr key={pos.id} className="hover:bg-obsidian-elevated/40 transition-colors bg-cyan-950/10">
                          <td className="py-2 px-3 font-semibold text-slate-text">
                            POS-{pos.id.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3 font-bold text-white">
                            {pos.symbol}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                pos.side === 'LONG'
                                  ? 'bg-emerald-edge/20 text-emerald-edge border border-emerald-edge/30'
                                  : 'bg-crimson-risk/20 text-crimson-risk border border-crimson-risk/30'
                              }`}
                            >
                              {pos.side}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-200">{pos.quantity} Lots</td>
                          <td className="py-2 px-3 text-slate-200 font-mono">${pos.entryPrice.toFixed(decimals)}</td>
                          <td className="py-2 px-3 text-cyan-300 font-mono">${exitPrice.toFixed(decimals)}</td>
                          <td className="py-2 px-3 text-rose-300 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{pos.stopLoss ? `$${pos.stopLoss.toFixed(decimals)}` : 'None'}</span>
                              {onUpdatePositionSLTP && (
                                <button
                                  onClick={() => handleOpenEditLevels(pos)}
                                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                                  title="Edit Stop Loss"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-emerald-300 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{pos.takeProfit ? `$${pos.takeProfit.toFixed(decimals)}` : 'None'}</span>
                              {onUpdatePositionSLTP && (
                                <button
                                  onClick={() => handleOpenEditLevels(pos)}
                                  className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                                  title="Edit Take Profit"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold font-mono ${
                              posPnl >= 0 ? 'text-emerald-edge' : 'text-crimson-risk'
                            }`}
                          >
                            {posPnl >= 0 ? '+' : ''}${posPnl.toFixed(2)} ({posPnlPct}%)
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onPartialClosePosition && pos.quantity > 0.01 && (
                                <button
                                  onClick={() => setPartialTarget({
                                    position: pos,
                                    closeQuantity: Number((pos.quantity * 0.5).toFixed(2)),
                                  })}
                                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                                  title="Partial Close Position"
                                >
                                  Partial
                                </button>
                              )}
                              {onClosePosition && (
                                <button
                                  onClick={() => onClosePosition(pos.id)}
                                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                                >
                                  Close
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'blotter' ? (
            /* TAB 2: CLOSED TRADES (TRADE BLOTTER) */
            trades.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-muted">
                No simulated trades placed yet. Use the on-chart Order Ticket to execute discretionary BUY or SELL orders during replay.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-obsidian-card text-[10px] uppercase text-slate-muted border-b border-obsidian-border">
                  <tr>
                    <th className="py-1.5 px-3">Trade ID</th>
                    <th className="py-1.5 px-3">Side</th>
                    <th className="py-1.5 px-3">Size</th>
                    <th className="py-1.5 px-3">Entry</th>
                    <th className="py-1.5 px-3">Exit</th>
                    <th className="py-1.5 px-3 text-right">PnL ($)</th>
                    <th className="py-1.5 px-3 text-center">Trigger</th>
                    <th className="py-1.5 px-3">Setup Tag</th>
                    <th className="py-1.5 px-3 text-center">Annotate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/40 text-[11px]">
                  {trades.map((t, idx) => {
                    const isWin = t.pnl > 0;
                    const note = tradeNotes[t.id];
                    return (
                      <tr key={t.id} className="hover:bg-obsidian-elevated/40 transition-colors">
                        <td className="py-1.5 px-3 font-semibold text-slate-text">#{idx + 1}</td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.side === 'LONG'
                                ? 'bg-emerald-edge/20 text-emerald-edge border border-emerald-edge/30'
                                : 'bg-crimson-risk/20 text-crimson-risk border border-crimson-risk/30'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-muted">{t.quantity} lot</td>
                        <td className="py-1.5 px-3 text-slate-subtext">${t.entryPrice.toLocaleString('en-US')}</td>
                        <td className="py-1.5 px-3 text-slate-subtext">${t.exitPrice.toLocaleString('en-US')}</td>
                        <td
                          className={`py-1.5 px-3 text-right font-bold ${
                            isWin ? 'text-emerald-edge' : 'text-crimson-risk'
                          }`}
                        >
                          {isWin ? '+' : ''}${t.pnl.toFixed(2)} ({t.pnlPercent}%)
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-muted text-[10px]">{t.exitReason}</td>
                        <td className="py-1.5 px-3">
                          {note ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-accent/10 border border-cyan-accent/30 text-cyan-accent truncate max-w-[120px] inline-block">
                              {note.setupType}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-muted italic">Unnoted</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            onClick={() => handleOpenNoteEditor(t)}
                            className="p-1 rounded hover:bg-obsidian-card text-slate-subtext hover:text-cyan-accent transition-colors cursor-pointer"
                            title="Annotate Setup Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* TAB 3: JOURNAL AUTOPSY */
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-text font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-violet-intel" />
                  <span>Session Trade Journal &amp; Review</span>
                </div>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Record your mindset, execution friction, adherence to the trading plan, or market condition shifts..."
                  rows={4}
                  className="w-full rounded-lg bg-obsidian-card border border-obsidian-border p-2.5 text-slate-text placeholder:text-slate-muted focus:outline-none focus:border-violet-intel transition-colors resize-none"
                />
              </div>

              {selectedTradeForNote ? (
                <div className="p-3 rounded-xl bg-obsidian-card border border-obsidian-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-text">Annotate Trade Note</span>
                    <button
                      onClick={() => setSelectedTradeForNote(null)}
                      className="p-1 hover:bg-obsidian-elevated rounded text-slate-muted hover:text-slate-text cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-muted block mb-1">Setup Categorization</label>
                      <select
                        value={selectedSetupType}
                        onChange={(e) => setSelectedSetupType(e.target.value)}
                        className="w-full rounded bg-obsidian-sub border border-obsidian-border px-2 py-1 text-slate-text focus:outline-none focus:border-cyan-accent"
                      >
                        {SETUP_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-muted block mb-1">Execution Discipline</label>
                      <select
                        value={selectedDiscipline}
                        onChange={(e) => setSelectedDiscipline(e.target.value as any)}
                        className="w-full rounded bg-obsidian-sub border border-obsidian-border px-2 py-1 text-slate-text focus:outline-none focus:border-cyan-accent"
                      >
                        {DISCIPLINE_TAGS.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-muted block mb-1 text-[11px]">Setup Notes &amp; Mistakes</label>
                    <input
                      type="text"
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      placeholder="e.g. Clean 15m order block tap after liquidity grab"
                      className="w-full rounded bg-obsidian-sub border border-obsidian-border px-2.5 py-1.5 text-slate-text placeholder:text-slate-muted focus:outline-none focus:border-cyan-accent text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setSelectedTradeForNote(null)}
                      className="px-2.5 py-1 rounded bg-obsidian-elevated text-slate-muted hover:text-slate-text text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTradeNote}
                      className="px-3 py-1 rounded bg-cyan-accent text-obsidian-base font-bold text-[11px] hover:bg-cyan-accent/90 transition-colors cursor-pointer"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-obsidian-border text-center text-slate-muted space-y-1">
                  <Tag className="w-5 h-5 text-slate-muted/60" />
                  <span className="text-xs">Click the pencil icon on any trade row to annotate your setup</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: EDIT POSITION SL / TP (Strict Impossible Case Prevention) */}
      {editingLevels && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#090E17] border border-cyan-500/40 shadow-2xl p-5 space-y-4 font-mono animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#1A2538] pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-sm text-white">Edit Position Levels</span>
              </div>
              <button
                onClick={() => setEditingLevels(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#162030]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0C1320] border border-[#1A2538] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Position:</span>
                <span className="font-bold text-white">POS-{editingLevels.position.id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Side &amp; Size:</span>
                <span className={`font-bold ${editingLevels.position.side === 'LONG' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {editingLevels.position.side} {editingLevels.position.quantity} Lots
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Entry Price:</span>
                <span className="font-bold text-slate-200">${editingLevels.position.entryPrice.toFixed(decimals)}</span>
              </div>
            </div>

            {editingLevels.error && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{editingLevels.error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-rose-300 block mb-1">
                  Stop Loss Price ({editingLevels.position.side === 'LONG' ? `< $${editingLevels.position.entryPrice.toFixed(decimals)}` : `> $${editingLevels.position.entryPrice.toFixed(decimals)}`})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={editingLevels.slStr}
                    onChange={(e) => setEditingLevels({ ...editingLevels, slStr: e.target.value, error: null })}
                    placeholder="Leave blank to remove"
                    className="flex-1 py-1.5 px-3 rounded bg-[#070B12] border border-rose-900/50 text-rose-200 font-mono text-xs focus:outline-none focus:border-rose-400"
                  />
                  <button
                    onClick={() => setEditingLevels({ ...editingLevels, slStr: '', error: null })}
                    className="px-2 py-1.5 rounded bg-rose-950/40 border border-rose-900/40 text-rose-400 text-xs hover:bg-rose-900/40"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-emerald-300 block mb-1">
                  Take Profit Price ({editingLevels.position.side === 'LONG' ? `> $${editingLevels.position.entryPrice.toFixed(decimals)}` : `< $${editingLevels.position.entryPrice.toFixed(decimals)}`})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={editingLevels.tpStr}
                    onChange={(e) => setEditingLevels({ ...editingLevels, tpStr: e.target.value, error: null })}
                    placeholder="Leave blank to remove"
                    className="flex-1 py-1.5 px-3 rounded bg-[#070B12] border border-emerald-900/50 text-emerald-200 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={() => setEditingLevels({ ...editingLevels, tpStr: '', error: null })}
                    className="px-2 py-1.5 rounded bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-xs hover:bg-emerald-900/40"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A2538]">
              <button
                onClick={() => setEditingLevels(null)}
                className="px-3 py-1.5 rounded-lg bg-[#111927] hover:bg-[#162234] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLevels}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
              >
                Save Levels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PARTIAL CLOSE POSITION */}
      {partialTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#090E17] border border-cyan-500/40 shadow-2xl p-5 space-y-4 font-mono animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#1A2538] pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-sm text-white">Partial Position Close</span>
              </div>
              <button
                onClick={() => setPartialTarget(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#162030]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0C1320] border border-[#1A2538] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Open Size:</span>
                <span className="font-bold text-white font-mono">{partialTarget.position.quantity} Lots</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Side &amp; Symbol:</span>
                <span className={`font-bold ${partialTarget.position.side === 'LONG' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {partialTarget.position.side} {partialTarget.position.symbol}
                </span>
              </div>
            </div>

            {/* Quick Percentage Chips */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Quick Close %:</label>
              <div className="grid grid-cols-3 gap-2">
                {[0.25, 0.50, 0.75].map((pct) => {
                  const qty = Number((partialTarget.position.quantity * pct).toFixed(2));
                  const isSelected = partialTarget.closeQuantity === qty;
                  return (
                    <button
                      key={pct}
                      onClick={() => setPartialTarget({ ...partialTarget, closeQuantity: qty })}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-[#0E1726] border-[#1C2C42] text-slate-300 hover:border-cyan-500/40'
                      }`}
                    >
                      {pct * 100}% ({qty}L)
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lots Stepper Input */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Lots to Close:</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPartialTarget({
                    ...partialTarget,
                    closeQuantity: Math.max(0.01, Number((partialTarget.closeQuantity - 0.01).toFixed(2))),
                  })}
                  className="w-8 h-8 rounded-lg bg-[#0E1726] border border-[#1C2C42] text-slate-300 hover:text-white flex items-center justify-center font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={partialTarget.position.quantity}
                  value={partialTarget.closeQuantity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setPartialTarget({
                      ...partialTarget,
                      closeQuantity: Math.min(partialTarget.position.quantity, Math.max(0.01, Number(val.toFixed(2)))),
                    });
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#070B12] border border-[#1C2C42] text-cyan-200 font-mono text-center font-bold text-sm focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => setPartialTarget({
                    ...partialTarget,
                    closeQuantity: Math.min(
                      partialTarget.position.quantity,
                      Number((partialTarget.closeQuantity + 0.01).toFixed(2))
                    ),
                  })}
                  className="w-8 h-8 rounded-lg bg-[#0E1726] border border-[#1C2C42] text-slate-300 hover:text-white flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Remaining Size Preview */}
            <div className="p-2.5 rounded-lg bg-[#070B12] border border-[#162030] text-xs flex items-center justify-between">
              <span className="text-slate-400">Remaining Position:</span>
              <span className="font-bold text-cyan-300 font-mono">
                {Math.max(0, Number((partialTarget.position.quantity - partialTarget.closeQuantity).toFixed(2)))} Lots
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A2538]">
              <button
                onClick={() => setPartialTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-[#111927] hover:bg-[#162234] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPartialClose}
                className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Confirm Partial Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
