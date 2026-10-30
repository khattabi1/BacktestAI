'use client';

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';

export interface ReplayControllerProps {
  currentIndex: number;
  totalBars: number;
  isPlaying: boolean;
  speed: number;
  currentTimestamp?: string;
  buildCandles?: boolean;
  subStepLabel?: string;
  isSubTimeframeAvailable?: boolean;
  isCompleted?: boolean;
  onToggleBuildCandles?: (enabled: boolean) => void;
  onPlayToggle: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onCandleForward?: () => void;
  onCandleBackward?: () => void;
  onSeek?: (index: number) => void;
  onSpeedChange: (speed: number) => void;
}

export const ReplayController: React.FC<ReplayControllerProps> = ({
  currentIndex,
  totalBars,
  isPlaying,
  speed,
  currentTimestamp,
  buildCandles = true,
  isCompleted = false,
  onPlayToggle,
  onStepForward,
  onStepBackward,
  onCandleForward,
  onCandleBackward,
  onSeek,
  onSpeedChange,
}) => {
  const isDone = isCompleted || currentIndex >= totalBars - 1;

  return (
    <div className="inline-flex items-center bg-[#111722] border border-[#202A38] rounded-md px-2 py-1 text-xs font-mono select-none gap-2 shrink-0 whitespace-nowrap shadow-sm">
      {/* 1. Current Candle Timestamp Display */}
      {currentTimestamp && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-accent text-[10px] font-mono whitespace-nowrap shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-cyan-accent/80 shrink-0" />
          <span className="font-semibold tabular-nums tracking-wide">{currentTimestamp}</span>
        </div>
      )}

      {/* 2. Playback Step & Play Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Candle (Jump 1 Full Bar Backward) */}
        <button
          type="button"
          onClick={onCandleBackward || (() => onSeek?.(Math.max(0, currentIndex - 1)))}
          disabled={currentIndex <= 0}
          title="Previous Candle (Jump 1 Full Bar)"
          className="p-1 hover:bg-[#1A2332] disabled:opacity-20 text-slate-400 hover:text-white rounded transition-colors"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Step Backward (1 Intrabar Sub-Step) */}
        <button
          type="button"
          onClick={onStepBackward}
          disabled={currentIndex <= 0}
          title="Step Backward (Intrabar Sub-Step)"
          className="p-1 hover:bg-[#1A2332] disabled:opacity-20 text-slate-300 hover:text-white rounded transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Play / Pause Toggle */}
        <button
          type="button"
          onClick={onPlayToggle}
          disabled={isDone}
          title={isDone ? 'Session Replay Completed' : isPlaying ? 'Pause Replay' : 'Play Replay'}
          className={`px-2.5 py-0.5 font-bold text-[10px] min-w-[56px] justify-center rounded transition-colors flex items-center gap-1.5 ${
            isDone
              ? 'bg-slate-800/40 text-slate-500 border border-slate-700/40 opacity-40 cursor-not-allowed'
              : isPlaying
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-accent border border-cyan-accent/40 hover:bg-cyan-500/30'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3 h-3 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Step Forward (1 Intrabar Sub-Step) */}
        <button
          type="button"
          onClick={onStepForward}
          disabled={isDone}
          title="Step Forward (Intrabar Sub-Step)"
          className="p-1 hover:bg-[#1A2332] disabled:opacity-20 text-slate-300 hover:text-white rounded transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Next Candle (Jump 1 Full Bar Forward) */}
        <button
          type="button"
          onClick={onCandleForward || (() => onSeek?.(Math.min(totalBars - 1, currentIndex + 1)))}
          disabled={isDone}
          title="Next Candle (Jump 1 Full Bar)"
          className="p-1 hover:bg-[#1A2332] disabled:opacity-20 text-slate-400 hover:text-white rounded transition-colors"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-[#202A38]" />

      {/* 3. Speed Slider (1x to 50x) */}
      <div
        className="flex items-center gap-1.5 pl-0.5"
        title={`Playback Speed: ${speed}x`}
      >
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-14 h-1 bg-[#202A38] rounded cursor-pointer accent-[#22D3EE]"
        />
        <span className="text-[10px] font-bold min-w-[24px] text-right font-mono tabular-nums text-cyan-accent">
          {speed}x
        </span>
      </div>
    </div>
  );
};
