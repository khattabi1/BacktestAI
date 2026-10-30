'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2, X, MoreVertical } from 'lucide-react';

export interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  version_num?: number;
  symbol: string;
  timeframe: string;
  start_date?: string;
  end_date?: string;
  config?: any;
  status: string;
  metrics?: any;
  created_at: string;
}

export function formatRunLabel(r: BacktestRunSummary, idx: number, total: number, isCompact?: boolean): string {
  const runNumber = total - idx;
  const isMt5 = r.id.startsWith('mt5_');
  const engineTag = isMt5 ? 'MT5' : 'Sim';
  const sym = r.symbol || 'XAUUSD';
  const tf = (r.timeframe || 'M15').toUpperCase();

  let perfStr = '';
  const net = r.metrics?.netProfit ?? r.metrics?.net_profit;
  const wr = r.metrics?.winRate ?? r.metrics?.win_rate;
  if (net !== undefined && wr !== undefined) {
    const netFormatted = Number(net) >= 0 ? `+$${Number(net).toFixed(0)}` : `-$${Math.abs(Number(net)).toFixed(0)}`;
    const wrFormatted = Number(wr) <= 1 && Number(wr) > 0 ? `${(Number(wr) * 100).toFixed(0)}%` : `${Number(wr).toFixed(0)}%`;
    perfStr = isCompact ? ` (${netFormatted} · ${wrFormatted})` : ` (${netFormatted} · ${wrFormatted} WR)`;
  }

  if (isCompact) {
    return `Test #${runNumber} [${engineTag}] · ${sym} ${tf}${perfStr}`;
  }

  const cleanDate = (val: any) => {
    if (!val) return null;
    const s = String(val).trim().replace(/\./g, '-');
    return s.split('T')[0].split(' ')[0];
  };

  const rawStart =
    (r.config as any)?.from_date ||
    (r.config as any)?.start_date ||
    (r.config as any)?.startDate ||
    r.start_date;
  const rawEnd =
    (r.config as any)?.to_date ||
    (r.config as any)?.end_date ||
    (r.config as any)?.endDate ||
    r.end_date;

  let dateRangeStr = '';
  const s = cleanDate(rawStart);
  const e = cleanDate(rawEnd);
  if (s && e) {
    dateRangeStr = ` · ${s} → ${e}`;
  }

  return `Test #${runNumber} [${engineTag}] · ${sym} ${tf}${dateRangeStr}${perfStr}`;
}

export interface CentralBacktestSubHeaderProps {
  strategyName?: string;
  versionNum?: number;
  strategyVersions?: any[];
  onSelectVersion?: (v: number) => void;
  availableRuns: BacktestRunSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun?: (runId: string) => Promise<void> | void;
  onRefresh: () => void;
  onReRun?: () => void;
  isRunning?: boolean;
  isLoading?: boolean;
  isReplayPlaying?: boolean;
}

export function CentralBacktestSubHeader({
  strategyName,
  versionNum,
  availableRuns = [],
  selectedRunId,
  onSelectRun,
  onDeleteRun,
  onRefresh,
  isLoading = false,
  isReplayPlaying = false,
}: CentralBacktestSubHeaderProps) {
  const [isManualSpinning, setIsManualSpinning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMob = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 1024);
    checkMob();
    window.addEventListener('resize', checkMob);
    return () => window.removeEventListener('resize', checkMob);
  }, []);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleRefreshClick = () => {
    setIsManualSpinning(true);
    try {
      onRefresh();
    } finally {
      setTimeout(() => {
        setIsMenuOpen(false);
      }, 200);
      setTimeout(() => {
        setIsManualSpinning(false);
      }, 1000);
    }
  };

  // Strictly filter out zero-trade runs (considered failed test / broken code, never shown as completed)
  const validRuns = availableRuns.filter((r) => {
    const trades = Number(r.metrics?.total_trades ?? r.metrics?.totalTrades ?? (r as any).total_trades ?? 0);
    return trades > 0;
  });

  const currentSelectedRun = validRuns.find((r) => r.id === selectedRunId) || validRuns[0];
  const currentRunIndex = currentSelectedRun ? validRuns.indexOf(currentSelectedRun) : 0;
  const currentRunLabel = currentSelectedRun
    ? formatRunLabel(currentSelectedRun, currentRunIndex, validRuns.length)
    : '';

  return (
    <div className="h-8 sm:h-11 border-b border-[#182334] bg-gradient-to-r from-[#0B0F18] via-[#0D1422] to-[#0B0F18] px-2 sm:px-4 flex items-center justify-between shrink-0 font-mono z-20 select-none shadow-sm relative">
      {/* Left: Test Run Selector + 3-Dot Options Menu */}
      <div className="flex items-center min-w-0 flex-1 mr-1.5 sm:mr-3">
        {validRuns.length > 0 ? (
          <div className="relative flex items-center min-w-0 w-full max-w-full gap-1.5 sm:gap-2">
            <select
              value={selectedRunId || ''}
              onChange={(e) => onSelectRun(e.target.value)}
              disabled={isReplayPlaying}
              style={{ width: '100%', maxWidth: '100%' }}
              className={`bg-[#0B0F16] border rounded-md sm:rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[9.5px] sm:text-[10.5px] font-mono uppercase tracking-wider outline-none transition-all w-full min-w-0 truncate shadow-sm overflow-hidden ${
                isReplayPlaying
                  ? 'border-[#202A38] text-slate-400/80 cursor-not-allowed bg-[#0B0F16] opacity-70'
                  : 'border-[#202A38] hover:border-[#2E3C50] focus:border-cyan-500/50 text-slate-300 cursor-pointer'
              }`}
              title={
                isReplayPlaying
                  ? 'Chart replay is playing. Click PAUSE to switch test runs.'
                  : 'Select a backtest telemetry run'
              }
            >
              {validRuns.map((r, idx) => (
                <option
                  key={r.id}
                  value={r.id}
                  className="bg-[#0B0F16] text-slate-300 font-mono text-[9.5px] sm:text-[10.5px] uppercase tracking-wider py-1 sm:py-1.5"
                >
                  {formatRunLabel(r, idx, validRuns.length, isMobile)}
                </option>
              ))}
            </select>

            {/* 3-Dot Options Menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                disabled={isLoading || isDeleting}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#0E1524] hover:bg-[#131D31] text-slate-300 hover:text-cyan-300 border border-[#1E2D44] hover:border-cyan-500/40 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isMenuOpen ? 'border-cyan-500/50 text-cyan-300 bg-[#131D31]' : ''
                }`}
                title="More actions for this test run"
              >
                {isLoading || isManualSpinning ? (
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-spin" />
                ) : (
                  <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>

              {/* Dropdown Menu (Refresh & Delete only) */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 max-w-[calc(100vw-1.5rem)] rounded-xl bg-[#0D1118] border border-[#202A38] shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-mono text-xs">
                  {/* Option 1: Refresh Telemetry */}
                  <button
                    type="button"
                    onClick={handleRefreshClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-300 hover:text-cyan-300 hover:bg-[#151D2C] transition-colors cursor-pointer text-[11px]"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-cyan-400 ${
                        isLoading || isManualSpinning ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Refresh Telemetry</span>
                  </button>

                  {/* Divider */}
                  {onDeleteRun && selectedRunId && <div className="h-px bg-[#202A38] my-1" />}

                  {/* Option 2: Delete Test Run */}
                  {onDeleteRun && selectedRunId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsConfirmOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer text-[11px] font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete Test Run</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[10px] sm:text-[10.5px] text-slate-500 italic font-mono uppercase tracking-wider">
            No historical test runs found
          </span>
        )}
      </div>

      {/* Right: Actions / Spacer */}
      <div className="flex items-center gap-2 shrink-0" />

      {/* Delete Test Run Confirmation Modal */}
      {isConfirmOpen && currentSelectedRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 font-mono select-none"
          onClick={() => !isDeleting && setIsConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#0D1118] border border-[#202A38] shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center justify-between">
                  <span>Delete Test Run</span>
                  <button
                    type="button"
                    onClick={() => !isDeleting && setIsConfirmOpen(false)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure you want to permanently delete this backtest run?
                </p>
                <div className="mt-2.5 p-2 rounded-lg bg-[#080B10] border border-[#1A2333] text-[11px] text-cyan-300 font-mono break-all leading-relaxed">
                  {currentRunLabel}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  All trade history, equity curves, drawdown telemetry, and metrics for this test will be permanently removed.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#202A38] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#111722] hover:bg-[#151D2B] border border-[#202A38] text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!selectedRunId) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteRun?.(selectedRunId);
                    setIsConfirmOpen(false);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
