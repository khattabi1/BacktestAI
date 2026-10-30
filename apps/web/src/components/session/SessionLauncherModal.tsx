'use client';

import React, { useState } from 'react';
import {
  X,
  Play,
  Plus,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight,
  Shield,
  Clock,
  Wallet,
  Pencil,
  Trash2,
  Check,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import type { BacktestSession } from '@backtest-ai/domain';

interface SessionLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewSessionModal: () => void;
}

export function SessionLauncherModal({
  isOpen,
  onClose,
  onOpenNewSessionModal,
}: SessionLauncherModalProps) {
  const { sessions, activeSessionId, switchSession, renameSession, deleteSession, clearAllSessions } = useSessionStore();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectSession = (sessionId: string) => {
    switchSession(sessionId);
    onClose();
  };

  const handleStartRename = (e: React.MouseEvent, session: BacktestSession) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const handleSaveRename = (e: React.MouseEvent | React.FormEvent, sessionId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingName.trim()) {
      renameSession(sessionId, editingName.trim());
    }
    setEditingSessionId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleStartDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setConfirmDeleteId(sessionId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-obsidian-base/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl p-6 z-10 space-y-5 animate-in fade-in zoom-in-95 font-mono select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-obsidian-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-accent/15 border border-cyan-accent/40 flex items-center justify-center text-cyan-accent shadow-hud">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-text tracking-tight">
                Session Manager
              </h2>
              <p className="text-xs text-slate-muted">
                Manage, rename, or switch between backtest replay sandboxes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-obsidian-sub text-slate-muted hover:text-slate-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-muted uppercase tracking-wider">
              Available Sessions ({sessions.length})
            </span>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete all replay sessions?')) {
                    clearAllSessions();
                  }
                }}
                className="text-[10px] text-crimson-risk hover:underline transition-all flex items-center gap-1 font-sans cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear All Sessions
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-obsidian-sub/40 border border-dashed border-obsidian-border rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-accent/10 border border-cyan-accent/20 flex items-center justify-center text-cyan-accent">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-text">No Existing Sessions</h3>
                <p className="text-xs text-slate-muted max-w-sm">
                  Start from scratch by initializing a clean replay session with real historical market data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewSessionModal();
                }}
                className="mt-1 flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-accent text-obsidian-base font-bold text-xs hover:bg-cyan-accent/90 shadow-hud transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Session</span>
              </button>
            </div>
          ) : (
            sessions.map((session: BacktestSession) => {
              const isActive = session.id === activeSessionId;
              const netPnl = session.currentBalance - session.initialBalance;
              const isProfit = netPnl >= 0;
              const winRate = session.metrics?.winRate ?? 0;
              const tradeCount = session.trades?.length ?? 0;
              const isEditing = editingSessionId === session.id;
              const isDeleting = confirmDeleteId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && !isDeleting && handleSelectSession(session.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between relative ${
                    isActive
                      ? 'bg-cyan-accent/10 border-cyan-accent/50 shadow-hud'
                      : 'bg-obsidian-sub/70 hover:bg-obsidian-elevated/70 border-obsidian-border hover:border-slate-border'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 pr-3 flex-1">
                    {/* Session Name & Inline Edit */}
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveRename(e, session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          className="px-2 py-1 rounded bg-obsidian-card border border-cyan-accent text-slate-100 text-xs font-bold focus:outline-none w-full max-w-xs"
                        />
                        <button
                          type="submit"
                          className="p-1 rounded bg-emerald-edge/20 text-emerald-edge hover:bg-emerald-edge/30 transition-colors"
                          title="Save Name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="p-1 rounded bg-obsidian-card text-slate-400 hover:text-slate-100 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-text text-sm truncate group-hover:text-cyan-accent transition-colors">
                          {session.name}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-accent text-obsidian-base font-bold shrink-0">
                            ACTIVE
                          </span>
                        )}
                        {/* Quick Rename Icon */}
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, session)}
                          className="p-1 rounded hover:bg-obsidian-card text-slate-500 hover:text-cyan-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Rename Session"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Metadata Subtitle */}
                    <div className="flex items-center flex-wrap gap-2 text-xs text-slate-muted">
                      <span className="text-slate-text font-semibold">{session.symbol}</span>
                      <span>·</span>
                      <span className="text-cyan-accent">{session.timeframe}</span>
                      {session.startDate && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-cyan-accent/70" />
                            {session.startDate.split('T')[0]}
                            {session.endDate && ` → ${session.endDate.split('T')[0]}`}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{tradeCount} Trades</span>
                      <span>·</span>
                      <span>WR: {winRate}%</span>
                    </div>
                  </div>

                  {/* Actions & Balance / Delete Confirmation */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isDeleting ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 p-1 rounded-lg bg-crimson-risk/10 border border-crimson-risk/30 animate-in fade-in"
                      >
                        <span className="text-[10px] text-crimson-risk font-bold px-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Delete?
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleConfirmDelete(e, session.id)}
                          className="px-2 py-0.5 rounded bg-crimson-risk hover:bg-crimson-risk/90 text-white font-bold text-[10px] transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelDelete}
                          className="px-1.5 py-0.5 rounded bg-obsidian-card hover:bg-obsidian-elevated text-slate-300 text-[10px] transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-right">
                          <div className="font-bold text-sm text-slate-text">
                            ${session.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </div>
                          <div className={`text-[11px] font-semibold ${isProfit ? 'text-emerald-edge' : 'text-crimson-risk'}`}>
                            {isProfit ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleStartDelete(e, session.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-crimson-risk hover:bg-crimson-risk/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Continue Button */}
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-accent/15 group-hover:bg-cyan-accent text-cyan-accent group-hover:text-obsidian-base font-bold text-xs border border-cyan-accent/30 transition-all shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Continue</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-obsidian-border flex items-center justify-between">
          <span className="text-xs text-slate-muted">
            All session trades and states are saved automatically.
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewSessionModal();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-accent text-obsidian-base font-bold text-xs hover:bg-cyan-accent/90 shadow-hud transition-all hover:scale-105 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
