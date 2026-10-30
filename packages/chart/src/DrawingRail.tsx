'use client';

import React from 'react';
import {
  MousePointer2,
  TrendingUp,
  TrendingDown,
  Slash,
  Minus,
  Square,
  AlignJustify,
  ArrowUpRight,
  Ruler,
  Undo2,
  Trash2,
} from 'lucide-react';

export interface DrawingRailProps {
  activeTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  onUndo: () => void;
  onClear: () => void;
}

interface ToolItem {
  id: string | null;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  isAction?: boolean;
}

export const DrawingRail: React.FC<DrawingRailProps> = ({
  activeTool,
  onSelectTool,
  onUndo,
  onClear,
}) => {
  const tools: ToolItem[] = [
    {
      id: null,
      label: 'Cursor / Pan (Esc)',
      icon: <MousePointer2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'long-position',
      label: 'Long Position Risk/Reward',
      icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
      badge: 'POS',
    },
    {
      id: 'short-position',
      label: 'Short Position Risk/Reward',
      icon: <TrendingDown className="w-3.5 h-3.5 text-crimson-risk" />,
      badge: 'POS',
    },
    {
      id: 'trend-line',
      label: 'Trend Line',
      icon: <Slash className="w-3.5 h-3.5 -rotate-12" />,
    },
    {
      id: 'horizontal-line',
      label: 'Horizontal Price Line',
      icon: <Minus className="w-3.5 h-3.5" />,
    },
    {
      id: 'rectangle',
      label: 'Rectangle / S&R Zone',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: 'fib-retracement',
      label: 'Fibonacci Retracement',
      icon: <AlignJustify className="w-3.5 h-3.5" />,
    },
    {
      id: 'ray',
      label: 'Ray Projection',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
    },
    {
      id: 'measure',
      label: 'Measure Distance & Bars',
      icon: <Ruler className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <aside className="w-10 border-r border-[#202A38] bg-[#0A0E15] flex flex-col items-center py-2 select-none z-10 shrink-0 gap-1 font-mono">
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id ?? 'cursor'}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={tool.label}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all relative group ${
              isActive
                ? 'bg-cyan-accent text-obsidian-base font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] scale-105'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#151C27]'
            }`}
          >
            {tool.icon}
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#151C27] border border-[#202A38] rounded shadow-xl text-[10px] text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {tool.label}
            </span>
          </button>
        );
      })}

      <div className="w-5 h-px bg-[#202A38] my-1" />

      {/* Undo Drawing */}
      <button
        type="button"
        onClick={onUndo}
        title="Undo Last Drawing"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-accent hover:bg-[#151C27] transition-all relative group"
      >
        <Undo2 className="w-3.5 h-3.5" />
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#151C27] border border-[#202A38] rounded shadow-xl text-[10px] text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Undo Drawing
        </span>
      </button>

      {/* Clear All Drawings */}
      <button
        type="button"
        onClick={onClear}
        title="Clear All Drawings"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-[#151C27] transition-all relative group"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#151C27] border border-[#202A38] rounded shadow-xl text-[10px] text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Clear All Drawings
        </span>
      </button>
    </aside>
  );
};
