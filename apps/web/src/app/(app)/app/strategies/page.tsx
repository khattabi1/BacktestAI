'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers,
  Search,
  Sliders,
  Play,
  Code2,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  ArrowRight,
  Shield,
  Sparkles,
  Info,
  X,
  Copy,
  Check,
  Plus,
  RefreshCw,
  FileCode,
  Terminal,
  ExternalLink,
  AlertCircle,
  Filter,
  Trash2,
  RotateCcw,
  Clock,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Cpu,
  BarChart3,
  GitCommit,
  DollarSign,
  Target,
  Award,
  LayoutGrid,
  ListFilter,
  Globe,
} from 'lucide-react';
import { Mt5Icon } from '@/components/icons/Mt5Icon';
import { PublishStrategyModal } from '@/components/community/PublishStrategyModal';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface StrategyParam {
  name: string;
  label?: string;
  type?: string;
  default?: any;
  description?: string;
  min_value?: number | null;
  max_value?: number | null;
}

export interface StrategyVersionItem {
  id: string;
  strategy_id: string;
  version_num: number;
  commit_message: string;
  created_at: string;
  code_length?: number;
}

export interface BacktestRunSummary {
  id: string;
  strategy_id: string;
  strategy_name: string;
  version_num?: number;
  symbol: string;
  timeframe: string;
  status: string;
  start_date?: string;
  end_date?: string;
  duration_seconds?: number;
  config?: {
    initial_capital?: number;
    parameters?: Record<string, any>;
  };
  metrics?: {
    initialCapital?: number;
    initial_capital?: number;
    ending_equity?: number;
    net_profit?: number;
    net_profit_pct?: number;
    total_trades?: number;
    winning_trades?: number;
    losing_trades?: number;
    win_rate?: number;
    profit_factor?: number;
    expectancy?: number;
    payoff_ratio?: number;
    max_drawdown?: number;
    max_drawdown_pct?: number;
    sharpe_ratio?: number;
    execution_time_ms?: number;
  } | null;
  created_at: string;
}

export interface DetailedBacktestRun extends BacktestRunSummary {
  trades?: {
    trade_id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    pnl: number;
    pnl_percent?: number;
  }[];
  equity_curve?: {
    timestamp: string;
    balance: number;
    equity: number;
    drawdown: number;
    drawdown_pct: number;
  }[];
}

export interface RealStrategy {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  code: string;
  parameters: StrategyParam[];
  is_built_in: boolean;
  default_symbol: string;
  default_timeframe: string;
  tags: string[];
  version?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BestRunInfo {
  run: BacktestRunSummary;
  versionNum: number;
  testNum: number;
  globalTestNum: number;
}

export interface EnhancedStrategy extends RealStrategy {
  cleanName: string;
  latestVersionNum: number;
  versions: StrategyVersionItem[];
  allRuns: BacktestRunSummary[];
  latestRun: BacktestRunSummary | null;
  bestRunInfo: BestRunInfo | null;
}

// ---------------------------------------------------------------------------
// Responsive Vector Equity & Drawdown Chart
// ---------------------------------------------------------------------------

interface ChartProps {
  data: { timestamp: string; balance: number; equity: number; drawdown: number; drawdown_pct: number }[];
  viewMode: 'equity' | 'underwater';
  initialCapital: number;
}

function StrategyVersionEquityChart({ data, viewMode, initialCapital }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 750, height: 260 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length <= 250) return data;
    const step = Math.floor(data.length / 250);
    const result: typeof data = [];
    for (let i = 0; i < data.length; i += step) {
      result.push(data[i]);
    }
    if (result[result.length - 1] !== data[data.length - 1]) {
      result.push(data[data.length - 1]);
    }
    return result;
  }, [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) {
        setDims({
          width: Math.round(w),
          height: Math.round(h > 40 ? h : 260),
        });
      }
    };
    measure();

    const ro = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0) {
            setDims({
              width: Math.round(width),
              height: Math.round(height > 40 ? height : 260),
            });
          }
        }
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = dims.width || 750;
  const height = dims.height || 260;

  const padLeft = viewMode === 'underwater' ? 42 : 50;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 22;

  const chartW = Math.max(10, width - padLeft - padRight);
  const chartH = Math.max(10, height - padTop - padBottom);

  const { minVal, maxVal, highWaterMark } = useMemo(() => {
    if (sampledData.length === 0) {
      return { minVal: initialCapital * 0.99, maxVal: initialCapital * 1.01, highWaterMark: initialCapital };
    }
    if (viewMode === 'underwater') {
      let maxDD = 0.1;
      for (let i = 0; i < sampledData.length; i++) {
        const dd = sampledData[i].drawdown_pct || 0;
        if (dd > maxDD) maxDD = dd;
      }
      return { minVal: -maxDD * 1.02, maxVal: 0, highWaterMark: 0 };
    } else {
      let rawMin = initialCapital;
      let rawMax = initialCapital;
      let isFirst = true;
      for (let i = 0; i < sampledData.length; i++) {
        const val = sampledData[i].balance || sampledData[i].equity || initialCapital;
        if (isFirst) {
          rawMin = val;
          rawMax = val;
          isFirst = false;
        } else {
          if (val < rawMin) rawMin = val;
          if (val > rawMax) rawMax = val;
        }
      }
      const span = Math.max(rawMax - rawMin, 1);
      const min = rawMin - span * 0.015;
      const max = rawMax + span * 0.015;
      return { minVal: min, maxVal: max, highWaterMark: rawMax };
    }
  }, [sampledData, viewMode, initialCapital]);

  const getY = useCallback(
    (val: number) => {
      if (maxVal === minVal) return padTop + chartH / 2;
      return padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
    },
    [maxVal, minVal, chartH, padTop]
  );

  const getX = useCallback(
    (idx: number) => {
      if (sampledData.length <= 1) return padLeft;
      return padLeft + (idx / (sampledData.length - 1)) * chartW;
    },
    [sampledData.length, chartW, padLeft]
  );

  const dateTicks = useMemo(() => {
    if (sampledData.length < 2) return [];
    const count = width < 450 ? 3 : width < 700 ? 4 : 5;
    const ticks: { index: number; x: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = [];
    for (let i = 0; i < count; i++) {
      const fraction = i / (count - 1);
      const idx = Math.min(sampledData.length - 1, Math.round(fraction * (sampledData.length - 1)));
      const pt = sampledData[idx];
      const x = getX(idx);
      let label = '';
      if (pt && pt.timestamp) {
        const raw = String(pt.timestamp).replace(/\./g, '-').replace('T', ' ').trim();
        const parts = raw.split(' ');
        label = parts[0] || raw;
      } else {
        label = `#${idx + 1}`;
      }
      const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
      ticks.push({ index: idx, x, label, anchor });
    }
    return ticks;
  }, [sampledData, getX, width]);

  const { linePath, areaPath } = useMemo(() => {
    if (sampledData.length === 0) return { linePath: '', areaPath: '' };

    let lPath = '';
    sampledData.forEach((d, idx) => {
      const val = viewMode === 'underwater' ? -(d.drawdown_pct || 0) : d.balance || d.equity || initialCapital;
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) lPath += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else lPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const baselineY = getY(viewMode === 'underwater' ? 0 : minVal);
    const firstX = getX(0);
    const lastX = getX(sampledData.length - 1);
    const aPath = `${lPath} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [sampledData, viewMode, initialCapital, getX, getY, minVal]);

  const hwmY = getY(viewMode === 'underwater' ? 0 : highWaterMark);
  const initCapY = getY(viewMode === 'underwater' ? 0 : initialCapital);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (sampledData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    const svgX = (xRel / rect.width) * width;
    if (svgX < padLeft || svgX > width - padRight) {
      setHoverIndex(null);
      return;
    }
    const ratio = (svgX - padLeft) / chartW;
    const idx = Math.round(ratio * (sampledData.length - 1));
    setHoverIndex(Math.max(0, Math.min(sampledData.length - 1, idx)));
  };

  const activePoint = hoverIndex !== null && hoverIndex < sampledData.length ? sampledData[hoverIndex] : null;
  const activeX = hoverIndex !== null ? getX(hoverIndex) : 0;
  const activeY =
    activePoint && hoverIndex !== null
      ? getY(viewMode === 'underwater' ? -(activePoint.drawdown_pct || 0) : activePoint.balance || activePoint.equity || initialCapital)
      : 0;

  if (!data || data.length === 0 || sampledData.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[220px] flex flex-col items-center justify-center text-slate-500 text-xs bg-[#090D15] rounded-xl border border-[#162030]/60"
      >
        <Activity className="w-5 h-5 mb-1.5 text-slate-600 animate-pulse" />
        <span className="font-medium text-slate-400">No Equity Curve Recorded</span>
        <span className="text-[11px] text-slate-500 mt-0.5">Execute a backtest run to view historical trajectory.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[220px] select-none">
      <svg
        key={`chart_${sampledData.length}_${viewMode}_${sampledData[0]?.balance || 0}_${sampledData[sampledData.length - 1]?.balance || 0}`}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block overflow-visible select-none cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <style>{`
            @keyframes chartLineDraw {
              0% {
                stroke-dashoffset: 1200;
                opacity: 0.2;
              }
              100% {
                stroke-dashoffset: 0;
                opacity: 1;
              }
            }
            @keyframes chartAreaFadeIn {
              0% {
                opacity: 0;
              }
              100% {
                opacity: 1;
              }
            }
            @keyframes scanLaserSweep {
              0% {
                transform: translateX(0px);
                opacity: 0;
              }
              10% {
                opacity: 0.9;
              }
              90% {
                opacity: 0.9;
              }
              100% {
                transform: translateX(${chartW}px);
                opacity: 0;
              }
            }
            .anim-chart-path {
              stroke-dasharray: 1200;
              stroke-dashoffset: 1200;
              animation: chartLineDraw 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .anim-chart-area-fill {
              animation: chartAreaFadeIn 1.6s ease-out forwards;
            }
            .anim-laser-beam {
              animation: scanLaserSweep 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              pointer-events: none;
            }
            .anim-chip-expand {
              animation: chipSmoothExpand 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
              transform-origin: left center;
              will-change: transform, opacity;
            }
            @keyframes chipSmoothExpand {
              0% {
                opacity: 0;
                transform: scale(0.92) translateX(-4px);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateX(0);
              }
            }
          `}</style>
          <linearGradient id="stratLibEquityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="stratLibDrawdownGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.30" />
          </linearGradient>
          <linearGradient id="scanLaserGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padTop + chartH * pct;
          const val = maxVal - pct * (maxVal - minVal);
          return (
            <g key={pct}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#16202E"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                {viewMode === 'underwater' ? `${val.toFixed(1)}%` : `$${Math.round(val).toLocaleString('en-US')}`}
              </text>
            </g>
          );
        })}

        {/* X-Axis Baseline */}
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={width - padRight}
          y2={padTop + chartH}
          stroke="#1E2B3E"
          strokeWidth="1.2"
        />

        {/* Vertical Grid Lines & Date Ticks */}
        {dateTicks.map((tick, i) => (
          <g key={`dt-${i}`}>
            <line
              x1={tick.x}
              y1={padTop}
              x2={tick.x}
              y2={padTop + chartH}
              stroke="#16202E"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={tick.x}
              y1={padTop + chartH}
              x2={tick.x}
              y2={padTop + chartH + 4}
              stroke="#334155"
              strokeWidth="1.2"
            />
            <text
              x={tick.x}
              y={padTop + chartH + 14}
              textAnchor={tick.anchor}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* High Water Mark Line */}
        {viewMode !== 'underwater' && hwmY >= padTop && hwmY <= padTop + chartH && (
          <line
            x1={padLeft}
            y1={hwmY}
            x2={width - padRight}
            y2={hwmY}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.65"
          />
        )}

        {/* Initial Capital Line */}
        {viewMode !== 'underwater' && initCapY >= padTop && initCapY <= padTop + chartH && (
          <line
            x1={padLeft}
            y1={initCapY}
            x2={width - padRight}
            y2={initCapY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        )}

        {/* Area Gradient Fill with Fade In Animation */}
        <path
          d={areaPath}
          className="anim-chart-area-fill"
          fill={viewMode === 'underwater' ? 'url(#stratLibDrawdownGrad)' : 'url(#stratLibEquityGrad)'}
        />

        {/* Dynamic Launch Scan Laser Beam (1.6s) */}
        <g className="anim-laser-beam">
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + chartH}
            stroke="url(#scanLaserGrad)"
            strokeWidth="2"
          />
        </g>

        {/* Curve Line with 1.6s Draw-in Motion */}
        <path
          d={linePath}
          pathLength={1200}
          className="anim-chart-path"
          fill="none"
          stroke={viewMode === 'underwater' ? '#f43f5e' : '#10b981'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair on Hover */}
        {activePoint && hoverIndex !== null && (
          <g>
            <line
              x1={activeX}
              y1={padTop}
              x2={activeX}
              y2={padTop + chartH}
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={activeX} cy={activeY} r="4" fill="#38bdf8" stroke="#080B11" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {activePoint && hoverIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded-xl bg-[#0D1420]/95 border border-cyan-500/50 shadow-2xl text-xs font-mono text-slate-100 backdrop-blur-md transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${Math.max(80, Math.min(width - 80, activeX))}px`,
            top: `${Math.max(45, activeY)}px`,
          }}
        >
          <div className="text-[10px] text-slate-400 border-b border-[#1E2C3F] pb-1 mb-1 font-sans flex items-center justify-between gap-3">
            <span>Fill #{hoverIndex + 1}</span>
            <span className="text-cyan-400 font-mono">
              {activePoint.timestamp ? activePoint.timestamp.replace('T', ' ').slice(0, 16) : ''}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-sans text-[11px]">Balance:</span>
              <span className="font-bold text-slate-100 font-mono">
                ${Number(activePoint.balance || activePoint.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-sans text-[11px]">Drawdown:</span>
              <span className="font-bold text-rose-400 font-mono">
                -{Number(activePoint.drawdown_pct || 0).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(val?: string | null): string {
  if (!val) return 'Recently';
  try {
    const s = String(val).replace(/\./g, '-').replace(' ', 'T');
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(val).slice(0, 10);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(val).slice(0, 10);
  }
}

function calcDuration(entry?: string, exit?: string): string {
  if (!entry || !exit) return '—';
  try {
    const s1 = String(entry).replace(/\./g, '-').replace(' ', 'T');
    const s2 = String(exit).replace(/\./g, '-').replace(' ', 'T');
    const d1 = new Date(s1).getTime();
    const d2 = new Date(s2).getTime();
    if (isNaN(d1) || isNaN(d2) || d2 < d1) return '—';
    const diffMins = Math.round((d2 - d1) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  } catch {
    return '—';
  }
}

function getRunDateRange(r: BacktestRunSummary): string {
  const cfg = r.config as any;
  const start = cfg?.from_date || cfg?.start_date || r.start_date;
  const end = cfg?.to_date || cfg?.end_date || r.end_date;
  if (start && end) {
    const s = String(start).slice(0, 10).replace(/\./g, '-');
    const e = String(end).slice(0, 10).replace(/\./g, '-');
    return `${s} → ${e}`;
  }
  if (start) return `From ${String(start).slice(0, 10).replace(/\./g, '-')}`;
  if (r.created_at) return formatDate(r.created_at);
  return 'Full Period';
}

function getRunStartDate(r: BacktestRunSummary): string {
  const cfg = r.config as any;
  const start = cfg?.from_date || cfg?.start_date || r.start_date;
  if (start) return String(start).slice(0, 10).replace(/\./g, '-');
  if (r.created_at) return formatDate(r.created_at);
  return '2025-01-01';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function StrategyLibraryPage() {
  const [strategies, setStrategies] = useState<EnhancedStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Deep Dive Explorer State
  const [exploringStrategy, setExploringStrategy] = useState<EnhancedStrategy | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(1);
  const [versionDetailTab, setVersionDetailTab] = useState<'tests' | 'code' | 'milestones'>('tests');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);

  // Selected Version's Code & Detailed Test State
  const [versionCode, setVersionCode] = useState<string>('');
  const [isLoadingVersionCode, setIsLoadingVersionCode] = useState<boolean>(false);
  const [activeBacktestRunId, setActiveBacktestRunId] = useState<string | null>(null);
  const [detailedBacktest, setDetailedBacktest] = useState<DetailedBacktestRun | null>(null);
  const [isLoadingBacktestDetail, setIsLoadingBacktestDetail] = useState<boolean>(false);
  const [chartViewMode, setChartViewMode] = useState<'equity' | 'underwater'>('equity');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [testsViewMode, setTestsViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Interactive 3D Perspective Tilt on Strategy Architecture Art
  const [artTilt, setArtTilt] = useState<{ x: number; y: number; isHovered: boolean }>({ x: 0, y: 0, isHovered: false });

  const handleArtMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setArtTilt({ x: relX * 18, y: -relY * 18, isHovered: true });
  }, []);

  const handleArtMouseLeave = useCallback(() => {
    setArtTilt({ x: 0, y: 0, isHovered: false });
  }, []);

  // Load Strategies & All Backtest Telemetry from API
  const fetchLibraryData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = useAuthStore.getState().token;
      const authHeaders: Record<string, string> = { Accept: 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      // 1. Fetch Strategies
      let rawStrats: RealStrategy[] = [];
      try {
        const res = await fetch('/api/v1/strategies', { headers: authHeaders, credentials: 'include' });
        if (res.ok) rawStrats = await res.json();
      } catch {
        const res2 = await fetch('/api/v1/strategies', { headers: authHeaders, credentials: 'include' });
        if (res2.ok) rawStrats = await res2.json();
      }

      // 2. Fetch Backtest Runs
      let rawRuns: BacktestRunSummary[] = [];
      try {
        const resRuns = await fetch('/api/v1/backtests?limit=100', { headers: authHeaders, credentials: 'include' });
        if (resRuns.ok) rawRuns = await resRuns.json();
      } catch {
        const resRuns2 = await fetch('/api/v1/backtests?limit=100', { headers: authHeaders, credentials: 'include' });
        if (resRuns2.ok) rawRuns = await resRuns2.json();
      }

      // 3. For each strategy, query versions & associate runs
      const enhancedList: EnhancedStrategy[] = await Promise.all(
        rawStrats.map(async (strat) => {
          const cleanName = strat.name.replace(/\.[^/.]+$/, '').trim();

          // Fetch versions
          let versions: StrategyVersionItem[] = [];
          try {
            const vRes = await fetch(`/api/v1/strategies/${encodeURIComponent(cleanName)}/versions`, { headers: authHeaders, credentials: 'include' });
            if (vRes.ok) {
              const vData = await vRes.json();
              if (Array.isArray(vData) && vData.length > 0) versions = vData;
            }
          } catch {
            // fallback
          }

          if (versions.length === 0) {
            versions = [
              {
                id: `v1_${cleanName}`,
                strategy_id: strat.id,
                version_num: 1,
                commit_message: 'Version 1 baseline',
                created_at: strat.created_at || new Date().toISOString(),
                code_length: strat.code?.length || 0,
              },
            ];
          }

          const latestVersionNum = Math.max(...versions.map((v) => v.version_num || 1), 1);

          // Find matching backtest runs
          const matchingRuns = rawRuns.filter((r) => {
            const baseName = cleanName.toLowerCase();
            const rStrat = (r.strategy_name || '').toLowerCase();
            const rId = (r.strategy_id || '').toLowerCase();
            return (
              rStrat === baseName ||
              rId === baseName ||
              rStrat.includes(baseName) ||
              baseName.includes(rStrat) ||
              r.strategy_id === strat.id
            );
          });

          // Sort runs by date descending
          matchingRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const latestRun = matchingRuns.length > 0 ? matchingRuns[0] : null;

          // Compute Chronological Order for Test Indexing & Identifying Best Performance
          const chronoRuns = [...matchingRuns].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          // Index tests sequentially per version and overall
          const versionRunCounts: Record<number, number> = {};
          const indexedRuns: BestRunInfo[] = chronoRuns.map((r, globalIdx) => {
            const vNum = r.version_num ?? 1;
            versionRunCounts[vNum] = (versionRunCounts[vNum] || 0) + 1;
            return {
              run: r,
              versionNum: vNum,
              testNum: versionRunCounts[vNum],
              globalTestNum: globalIdx + 1,
            };
          });

          // Identify the best performing backtest run across all recorded runs
          let bestRunInfo: BestRunInfo | null = null;
          for (const item of indexedRuns) {
            const m = item.run.metrics;
            if (!m) continue;
            const netProfit = typeof m.net_profit === 'number' ? m.net_profit : -Infinity;
            const pf = typeof m.profit_factor === 'number' ? m.profit_factor : 0;
            const wr = typeof m.win_rate === 'number' ? m.win_rate : 0;

            if (!bestRunInfo) {
              bestRunInfo = item;
            } else {
              const bestM = bestRunInfo.run.metrics;
              const curBestProfit = typeof bestM?.net_profit === 'number' ? bestM.net_profit : -Infinity;
              const curBestPf = typeof bestM?.profit_factor === 'number' ? bestM.profit_factor : 0;
              const curBestWr = typeof bestM?.win_rate === 'number' ? bestM.win_rate : 0;

              if (netProfit > curBestProfit) {
                bestRunInfo = item;
              } else if (netProfit === curBestProfit) {
                if (pf > curBestPf) {
                  bestRunInfo = item;
                } else if (pf === curBestPf && wr > curBestWr) {
                  bestRunInfo = item;
                }
              }
            }
          }

          // Fallback: if runs exist but none have parsed metrics, pick the most recent run
          if (!bestRunInfo && indexedRuns.length > 0) {
            bestRunInfo = indexedRuns[indexedRuns.length - 1];
          }

          return {
            ...strat,
            cleanName,
            latestVersionNum,
            versions,
            allRuns: matchingRuns,
            latestRun,
            bestRunInfo,
          };
        })
      );

      setStrategies(enhancedList);
    } catch (err: any) {
      console.warn('[StrategyLibrary] Failed to load library:', err);
      setError(err?.message || 'Failed to fetch strategy library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  // When opening a strategy into Deep Dive, initialize its version
  const handleOpenExplorer = useCallback(
    (strat: EnhancedStrategy) => {
      setExploringStrategy(strat);
      const initialV = strat.latestVersionNum || (strat.versions[0]?.version_num ?? 1);
      setSelectedVersionNum(initialV);
      setVersionDetailTab('tests');
      setDetailedBacktest(null);

      // Find initial run for this version (by default last/newest test selected once open a version)
      const vRuns = strat.allRuns.filter((r) => (r.version_num ?? 1) === initialV);
      if (vRuns.length > 0) {
        const lastRun = vRuns[0];
        setActiveBacktestRunId(lastRun.id);
        setExpandedRunId(lastRun.id);
      } else if (strat.allRuns.length > 0) {
        const lastRun = strat.allRuns[0];
        setActiveBacktestRunId(lastRun.id);
        setExpandedRunId(lastRun.id);
      } else {
        setActiveBacktestRunId(null);
        setExpandedRunId(null);
      }
    },
    []
  );

  // Fetch version code whenever selected strategy or version changes
  useEffect(() => {
    if (!exploringStrategy) return;
    let isCancelled = false;
    setIsLoadingVersionCode(true);

    const loadCode = async () => {
      try {
        let codeText = '';
        const token = useAuthStore.getState().token;
        try {
          const res = await fetch(
            `/api/v1/strategies/${encodeURIComponent(exploringStrategy.cleanName)}/versions/${selectedVersionNum}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' }
          );
          if (res.ok) {
            const data = await res.json();
            codeText = data.code || '';
          }
        } catch {
          // fallback
        }

        if (!codeText && selectedVersionNum === exploringStrategy.latestVersionNum) {
          codeText = exploringStrategy.code || '';
        }

        if (!isCancelled) {
          setVersionCode(codeText || '// No code recorded for this checkpoint');
        }
      } catch {
        if (!isCancelled) setVersionCode(exploringStrategy.code || '');
      } finally {
        if (!isCancelled) setIsLoadingVersionCode(false);
      }
    };

    loadCode();
    return () => {
      isCancelled = true;
    };
  }, [exploringStrategy, selectedVersionNum]);

  // Load detailed backtest run (with equity curve & trades) whenever activeBacktestRunId changes
  useEffect(() => {
    if (!activeBacktestRunId) {
      setDetailedBacktest(null);
      return;
    }
    let isCancelled = false;
    setIsLoadingBacktestDetail(true);

    const fetchDetail = async () => {
      try {
        let runData: DetailedBacktestRun | null = null;
        const token = useAuthStore.getState().token;
        try {
          const res = await fetch(`/api/v1/backtests/${activeBacktestRunId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' });
          if (res.ok) runData = await res.json();
        } catch {
          const res2 = await fetch(`/api/v1/backtests/${activeBacktestRunId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' });
          if (res2.ok) runData = await res2.json();
        }

        if (!isCancelled) {
          setDetailedBacktest(runData);
        }
      } catch (err) {
        console.warn('Failed to load detailed run:', err);
      } finally {
        if (!isCancelled) setIsLoadingBacktestDetail(false);
      }
    };

    fetchDetail();
    return () => {
      isCancelled = true;
    };
  }, [activeBacktestRunId]);

  // When version changes in Explorer, switch the active run to match that version (by default last test selected)
  const handleVersionChange = (vNum: number) => {
    setSelectedVersionNum(vNum);
    if (!exploringStrategy) return;
    const matching = exploringStrategy.allRuns.filter((r) => (r.version_num ?? 1) === vNum);
    if (matching.length > 0) {
      const lastRun = matching[0];
      setActiveBacktestRunId(lastRun.id);
      setExpandedRunId(lastRun.id);
    } else {
      setActiveBacktestRunId(null);
      setExpandedRunId(null);
      setDetailedBacktest(null);
    }
  };

  // Revert active strategy to selected version in workspace
  const handleRevertVersion = async () => {
    if (!exploringStrategy) return;
    try {
      const res = await fetch(
        `/api/v1/strategies/${encodeURIComponent(exploringStrategy.cleanName)}/revert/${selectedVersionNum}`,
        { method: 'POST', headers: typeof window !== 'undefined' && useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : undefined, credentials: 'include' }
      );
      if (res.ok) {
        await fetchLibraryData();
      }
    } catch (err) {
      console.error('Failed to revert version:', err);
    }
  };

  const handleCopyCode = () => {
    if (!versionCode) return;
    navigator.clipboard.writeText(versionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>(['ALL']);
    strategies.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [strategies]);

  // Filtered strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        s.cleanName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.default_symbol.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [strategies, selectedCategory, searchQuery]);

  // Active version's runs in Explorer
  const currentVersionRuns = useMemo(() => {
    if (!exploringStrategy) return [];
    return exploringStrategy.allRuns.filter((r) => (r.version_num ?? 1) === selectedVersionNum);
  }, [exploringStrategy, selectedVersionNum]);

  // By default, last (latest) test selected once a version is opened or changed
  useEffect(() => {
    if (currentVersionRuns.length > 0) {
      const exists = currentVersionRuns.some((r) => r.id === activeBacktestRunId);
      if (!exists || !activeBacktestRunId) {
        const lastRun = currentVersionRuns[0];
        setActiveBacktestRunId(lastRun.id);
        setExpandedRunId(lastRun.id);
      }
    }
  }, [currentVersionRuns, activeBacktestRunId]);

  // Sorted versions ascending for chronological evolution timeline
  const sortedVersions = useMemo(() => {
    if (!exploringStrategy) return [];
    return [...exploringStrategy.versions].sort((a, b) => (a.version_num || 0) - (b.version_num || 0));
  }, [exploringStrategy]);

  // Filtered displayed trades (up to 50)
  const displayedTrades = useMemo(() => {
    if (!detailedBacktest?.trades) return [];
    let list = detailedBacktest.trades;
    if (tradeFilter === 'WIN') list = list.filter((t) => t.pnl > 0);
    else if (tradeFilter === 'LOSS') list = list.filter((t) => t.pnl < 0);
    return list.slice(0, 50);
  }, [detailedBacktest?.trades, tradeFilter]);

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 - DEEP DIVE EXPLORER STUDIO
  // ---------------------------------------------------------------------------
  if (exploringStrategy) {
    const isMql5 = exploringStrategy.language === 'mql5' || exploringStrategy.name.endsWith('.mq5');
    const activeMetrics = detailedBacktest?.metrics;
    const netProfit = activeMetrics?.net_profit ?? 0;
    const isProfit = netProfit >= 0;

    return (
      <div className="space-y-5 pb-16 animate-fadeIn">
        {/* Studio Top Navigation Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0C121D] via-[#0E1524] to-[#0C121D] border border-[#1A2538] shadow-hud flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setExploringStrategy(null)}
              className="p-2 rounded-xl bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Return to Strategy Repository Catalog"
            >
              <ChevronLeft className="w-4 h-4 text-cyan-400" />
              <span>Repository Catalog</span>
            </button>

            <div className="h-4 w-px bg-[#1E2B3E] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#141E2E] border border-[#1E2B3E] flex items-center justify-center shrink-0">
                {isMql5 ? <Mt5Icon className="w-4 h-4" /> : <Code2 className="w-4 h-4 text-emerald-400" />}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-100 font-mono tracking-tight">
                    {exploringStrategy.name}
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold">
                    v{selectedVersionNum} {selectedVersionNum === exploringStrategy.latestVersionNum ? '(Active)' : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#131B29] border border-[#1E2B3E] text-slate-400 text-[11px] font-mono">
                    {exploringStrategy.default_symbol} · {exploringStrategy.default_timeframe.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl line-clamp-1">
                  {exploringStrategy.description || 'Deterministic algorithmic trading model.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Launch Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Publish to Community Button */}
            <button
              type="button"
              onClick={() => setIsPublishModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#111927] hover:bg-[#182335] text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 font-mono font-semibold text-xs transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
              title="Publish this strategy to the Social Quant Community"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Publish to Community</span>
            </button>

            <Link
              href={`/app/quant?file=${encodeURIComponent(exploringStrategy.cleanName)}&version=${selectedVersionNum}`}
              onClick={() => {
                try {
                  localStorage.setItem('quantlab_active_file', exploringStrategy.cleanName);
                  localStorage.setItem('quantlab_active_version', String(selectedVersionNum));
                } catch {}
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#070B12] font-bold text-xs transition-all flex items-center gap-2 shadow-hud hover:shadow-cyan-glow"
              title="Open and edit this strategy in QuantLab code editor"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open in QuantLab</span>
            </Link>
          </div>
        </div>

        {/* Architecture Versions Header (Out of the box on top) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                VERSIONS ({sortedVersions.length})
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <span className="text-slate-500">Active:</span>
              <span className="text-cyan-300 font-bold">Version {selectedVersionNum}</span>
            </div>
          </div>

          {/* Clean Version Architecture Stepper Box */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#080D15] border border-[#162232] shadow-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
              {sortedVersions.map((ver, idx) => {
                const isSelected = ver.version_num === selectedVersionNum;
                const isLatest = ver.version_num === exploringStrategy.latestVersionNum;
                const runCount = exploringStrategy.allRuns.filter((r) => (r.version_num ?? 1) === ver.version_num).length;

                return (
                  <React.Fragment key={ver.id || ver.version_num}>
                    <button
                      onClick={() => handleVersionChange(ver.version_num)}
                      className={`group shrink-0 h-8 px-2.5 rounded-lg border text-left transition-all flex items-center gap-2 font-mono ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#101E30] to-[#0A1422] border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/30 shadow-sm'
                          : 'bg-[#0B101A] hover:bg-[#0E1624] border-[#182538] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                          isSelected
                            ? 'bg-cyan-500 text-[#070B12] font-black'
                            : 'bg-[#121A28] border border-[#1E2E44] text-slate-300'
                        }`}
                      >
                        v{ver.version_num}
                      </span>

                      <span className={`text-xs font-semibold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                        Version {ver.version_num}
                      </span>

                      {isLatest && (
                        <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                          Latest
                        </span>
                      )}

                      <span className="text-[10px] text-slate-500 border-l border-[#19273A] pl-1.5">
                        {runCount} {runCount === 1 ? 'Test' : 'Tests'}
                      </span>
                    </button>

                    {idx < sortedVersions.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center overflow-x-auto no-scrollbar border-b border-[#182335] pb-2 max-w-full">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setVersionDetailTab('tests')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                versionDetailTab === 'tests'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verification Tests & Equity ({currentVersionRuns.length})</span>
            </button>

            <button
              onClick={() => setVersionDetailTab('code')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                versionDetailTab === 'code'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Source Code & Parameters Schema</span>
            </button>

            <button
              onClick={() => setVersionDetailTab('milestones')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                versionDetailTab === 'milestones'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
              <span>Version History & Revert</span>
            </button>
          </div>
        </div>

        {/* TAB 1: VERIFICATION TESTS & EQUITY CURVE */}
        {versionDetailTab === 'tests' && (
          <div className="space-y-4">
            {currentVersionRuns.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#090D15] border border-[#182335] text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">No Backtests Run for Version {selectedVersionNum}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This version milestone hasn&apos;t been simulated yet. You can launch an institutional backtest simulation on historical tick data directly from QuantLab.
                  </p>
                </div>
                <Link
                  href={`/app/quant?file=${encodeURIComponent(exploringStrategy.cleanName)}&version=${selectedVersionNum}`}
                  onClick={() => {
                    try {
                      localStorage.setItem('quantlab_active_file', exploringStrategy.cleanName);
                      localStorage.setItem('quantlab_active_version', String(selectedVersionNum));
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#070B12] font-bold text-xs transition-all shadow-hud"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch Simulation in QuantLab</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Test Runs Header (Out of the box on top) */}
                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-cyan-300">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300">
                        RUNS ({currentVersionRuns.length})
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <span className="text-slate-500">Selected:</span>
                      <span className="text-cyan-300 font-bold">
                        Test #{currentVersionRuns.length - Math.max(0, currentVersionRuns.findIndex((r) => r.id === activeBacktestRunId))}
                      </span>
                    </div>
                  </div>

                  {/* Clean Test Runs Box */}
                  <div className="p-2 sm:p-2.5 rounded-xl bg-[#080D15] border border-[#162232] shadow-sm">
                    <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin">
                      {currentVersionRuns.map((r, i) => {
                        const isSelected = r.id === activeBacktestRunId;
                        const runNum = currentVersionRuns.length - i;
                        const isMT5 = r.id.startsWith('mt5_');
                        const pnl = r.metrics?.net_profit ?? 0;
                        const winRate = r.metrics?.win_rate ?? 0;
                        const pf = r.metrics?.profit_factor ?? 0;
                        const isPnlPositive = pnl >= 0;
                        const dateRange = getRunDateRange(r);
                        const startDate = getRunStartDate(r);

                        // As requested:
                        // "first display like this elestartion on click it becume like curent style"
                        // Expanded when clicked/selected; compact illustration when unselected (or toggleable)
                        const isExpanded = expandedRunId === null ? isSelected : expandedRunId === r.id;

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              if (r.id === activeBacktestRunId) {
                                setExpandedRunId(isExpanded ? '__none__' : r.id);
                              } else {
                                setActiveBacktestRunId(r.id);
                                setExpandedRunId(r.id);
                              }
                            }}
                            title={isExpanded ? 'Click to collapse test details' : 'Click to inspect & expand full run telemetry'}
                            className={`group shrink-0 h-8 px-2.5 rounded-lg border text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-2 font-mono text-xs overflow-hidden ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#101E30] to-[#0A1422] border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/30 shadow-sm'
                                : 'bg-[#0B101A] hover:bg-[#0E1624] border-[#182538] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {/* Test Number Badge (Identical to Version number badge) */}
                            <span
                              className={`min-w-5 h-5 px-1 rounded flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                                isSelected
                                  ? 'bg-cyan-500 text-[#070B12] font-black'
                                  : 'bg-[#121A28] border border-[#1E2E44] text-slate-300'
                              }`}
                            >
                              #{runNum}
                            </span>

                            {/* Test Label (White text like Version, not cyan) */}
                            <span className={`text-xs font-semibold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                              Test #{runNum}
                            </span>

                            {/* Engine Badge: clean dark pill, no harsh cyan background */}
                            {isExpanded && (
                              <span
                                className="anim-chip-expand flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded border bg-[#121A28] border-[#1E2E44] text-slate-300"
                              >
                                {isMT5 ? <Mt5Icon className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                                <span>{isMT5 ? 'MT5' : 'Vector'}</span>
                              </span>
                            )}

                            {/* Date Range */}
                            {isExpanded && (
                              <div className="anim-chip-expand flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#060A12] border border-[#141F30] text-slate-300 text-[10px]">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-200">
                                  {dateRange}
                                </span>
                              </div>
                            )}

                            {/* Asset & TF */}
                            <span className="text-[10px] text-slate-400 border-l border-[#19273A] pl-1.5">
                              {r.symbol}·{r.timeframe || '1H'}
                            </span>

                            {/* Win Rate & PF: In expanded mode shows WR + PF; in non-selected minimal mode shows WR only */}
                            <span className="text-[10px] text-slate-400 transition-all duration-300">
                              {isExpanded ? `${winRate}% WR · PF ${pf}` : `${winRate}% WR`}
                            </span>

                            {/* Net PnL Badge */}
                            {isExpanded && (
                              <span
                                className={`anim-chip-expand font-bold px-2 py-0.5 rounded border shrink-0 text-xs ${
                                  isPnlPositive
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {isPnlPositive
                                  ? `+$${Number(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `-$${Math.abs(Number(pnl)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                            )}

                            {/* Latest Badge if newest run, matching Version */}
                            {isExpanded && i === 0 && (
                              <span className="anim-chip-expand text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                                Latest
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Performance Metrics Summary Strip */}
                {activeMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Net Profit</span>
                      <span
                        className={`text-base font-bold font-mono mt-1 block ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit
                          ? `+$${Number(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `-$${Math.abs(Number(netProfit)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {activeMetrics.net_profit_pct ? `${activeMetrics.net_profit_pct.toFixed(2)}% ROI` : 'Balance return'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Win Rate</span>
                      <span className="text-base font-bold font-mono text-slate-100 mt-1 block">
                        {activeMetrics.win_rate ?? 0}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {activeMetrics.winning_trades ?? 0}W · {activeMetrics.losing_trades ?? 0}L
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Profit Factor</span>
                      <span
                        className={`text-base font-bold font-mono mt-1 block ${
                          (activeMetrics.profit_factor ?? 0) >= 1.5
                            ? 'text-emerald-400'
                            : (activeMetrics.profit_factor ?? 0) >= 1.0
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {activeMetrics.profit_factor ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        Payoff {activeMetrics.payoff_ratio ? `${Number(activeMetrics.payoff_ratio).toFixed(2)}:1` : '0.00:1'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Max Drawdown</span>
                      <span className="text-base font-bold font-mono text-rose-400 mt-1 block">
                        -{activeMetrics.max_drawdown_pct ?? 0}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {activeMetrics.max_drawdown ? `-$${Math.round(activeMetrics.max_drawdown).toLocaleString('en-US')}` : 'From peak'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Executed Fills</span>
                      <span className="text-base font-bold font-mono text-slate-100 mt-1 block">
                        {activeMetrics.total_trades ?? detailedBacktest?.trades?.length ?? 0}
                      </span>
                      <span className="text-[10px] text-cyan-400 font-mono mt-0.5 block">
                        {detailedBacktest?.id.startsWith('mt5_') ? 'MT5 Real Fills' : 'Verified Fills'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C121D] border border-[#1A2538]">
                      <span className="text-[11px] text-slate-400 font-medium block">Expectancy</span>
                      <span
                        className={`text-base font-bold font-mono mt-1 block ${
                          (activeMetrics.expectancy ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(activeMetrics.expectancy ?? 0) >= 0 ? '+' : ''}$
                        {Number(activeMetrics.expectancy ?? 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Per trade fill</span>
                    </div>
                  </div>
                )}

                {/* Equity Curve Card Header & Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      Portfolio Capital & Drawdown Trajectory (v{selectedVersionNum})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      High-resolution verified equity curve from execution simulation
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0E1522] p-1 rounded-lg border border-[#1E2B3E]">
                    <button
                      onClick={() => setChartViewMode('equity')}
                      className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                        chartViewMode === 'equity'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Equity Curve
                    </button>
                    <button
                      onClick={() => setChartViewMode('underwater')}
                      className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                        chartViewMode === 'underwater'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Underwater (DD %)
                    </button>
                  </div>
                </div>

                {/* Responsive SVG Chart Canvas */}
                <div className="w-full h-[270px] sm:h-[300px] bg-[#0A0E17] border border-[#1A2538] rounded-xl p-1.5 sm:p-2 relative overflow-hidden shadow-lg flex flex-col">
                  {isLoadingBacktestDetail ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-xs font-mono">Loading simulation telemetry...</span>
                    </div>
                  ) : (
                    <StrategyVersionEquityChart
                      data={detailedBacktest?.equity_curve || []}
                      viewMode={chartViewMode}
                      initialCapital={detailedBacktest?.config?.initial_capital || 100000}
                    />
                  )}
                </div>

                {/* Executed Trades Audit Table (Expanded to 50 Trades with Filters) */}
                {detailedBacktest?.trades && detailedBacktest.trades.length > 0 && (() => {
                  const winCount = detailedBacktest.trades.filter((t) => t.pnl > 0).length;
                  const lossCount = detailedBacktest.trades.filter((t) => t.pnl < 0).length;

                  return (
                    <div className="rounded-xl bg-[#090D15] border border-[#182335] overflow-hidden space-y-0">
                      <div className="p-3 bg-[#0C121D] border-b border-[#182335] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100 font-mono">
                            Executed Fills Audit
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300">
                            Showing {displayedTrades.length} of {detailedBacktest.trades.length} Trades
                          </span>
                        </div>

                        {/* Trade Filters */}
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <button
                            onClick={() => setTradeFilter('ALL')}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              tradeFilter === 'ALL'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                                : 'bg-[#121A26] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            All ({detailedBacktest.trades.length})
                          </button>
                          <button
                            onClick={() => setTradeFilter('WIN')}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              tradeFilter === 'WIN'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : 'bg-[#121A26] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Wins ({winCount})
                          </button>
                          <button
                            onClick={() => setTradeFilter('LOSS')}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                              tradeFilter === 'LOSS'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                                : 'bg-[#121A26] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Losses ({lossCount})
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[440px] scrollbar-thin">
                        <table className="w-full text-left font-mono text-[11px]">
                          <thead className="bg-[#0A0F19] text-slate-400 sticky top-0 border-b border-[#182335] z-10">
                            <tr>
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Side</th>
                              <th className="py-2.5 px-3">Entry Time</th>
                              <th className="py-2.5 px-3">Exit Time</th>
                              <th className="py-2.5 px-3">Duration</th>
                              <th className="py-2.5 px-3 text-right">Entry Price</th>
                              <th className="py-2.5 px-3 text-right">Exit Price</th>
                              <th className="py-2.5 px-3 text-right">PnL ($)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#141E2E]">
                            {displayedTrades.map((t, idx) => {
                              const pnlPos = t.pnl >= 0;
                              return (
                                <tr key={t.trade_id || idx} className="hover:bg-[#0E1522] transition-colors">
                                  <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        t.side === 'BUY' || (t.side as string) === 'LONG'
                                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                      }`}
                                    >
                                      {t.side}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-slate-300">{t.entry_time?.slice(0, 16)}</td>
                                  <td className="py-2 px-3 text-slate-400">{t.exit_time?.slice(0, 16)}</td>
                                  <td className="py-2 px-3 text-slate-400">{calcDuration(t.entry_time, t.exit_time)}</td>
                                  <td className="py-2 px-3 text-right text-slate-300 font-mono">
                                    {Number(t.entry_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-300 font-mono">
                                    {Number(t.exit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-bold font-mono ${
                                      pnlPos ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {pnlPos
                                      ? `+$${Number(t.pnl).toFixed(2)}`
                                      : `-$${Math.abs(Number(t.pnl)).toFixed(2)}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SOURCE CODE & PARAMETERS SCHEMA */}
        {versionDetailTab === 'code' && (
          <div className="space-y-4">
            {/* Causal Parameters Table */}
            {exploringStrategy.parameters && exploringStrategy.parameters.length > 0 && (
              <div className="p-4 rounded-xl bg-[#090D15] border border-[#182335] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Causal Strategy Parameters ({exploringStrategy.parameters.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Boundaries for zero look-ahead bias</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {exploringStrategy.parameters.map((p) => (
                    <div key={p.name} className="p-2.5 rounded-lg bg-[#0C121D] border border-[#1A2538] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300 text-[11px]">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-[#121A26]">
                          {p.type || 'number'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-[11px] text-slate-400">Default:</span>
                        <span className="font-mono font-bold text-slate-100">{String(p.default ?? 0)}</span>
                      </div>
                      {p.description && <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code Block Container */}
            <div className="rounded-xl bg-[#090D15] border border-[#182335] overflow-hidden">
              <div className="p-3 bg-[#0C121D] border-b border-[#182335] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {exploringStrategy.name} (v{selectedVersionNum})
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#162030] text-slate-400">
                    {versionCode.split('\n').length} lines
                  </span>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 text-xs font-mono transition-colors flex items-center gap-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto scrollbar-thin">
                {isLoadingVersionCode ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    Loading code snapshot for version {selectedVersionNum}...
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                    <code>{versionCode}</code>
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VERSION HISTORY & MILESTONES */}
        {versionDetailTab === 'milestones' && (
          <div className="p-5 rounded-2xl bg-[#090D15] border border-[#182335] space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Milestone Checkpoint Audit</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every code evolution, parameter tuning, and prompt refinement is stored as a deterministic version.
              </p>
            </div>

            <div className="space-y-3">
              {exploringStrategy.versions.map((ver) => {
                const isSelected = ver.version_num === selectedVersionNum;
                const isLatest = ver.version_num === exploringStrategy.latestVersionNum;

                return (
                  <div
                    key={ver.id || ver.version_num}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-[#0E1522] border-cyan-500/50 shadow-md'
                        : 'bg-[#0C121D] border-[#182335]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">Version {ver.version_num}</span>
                        {isLatest && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                            CURRENT ACTIVE
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">· {formatDate(ver.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-300">{ver.commit_message || `Version ${ver.version_num}`}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVersionChange(ver.version_num)}
                        className="px-3 py-1.5 rounded-lg bg-[#141E2E] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-200 text-xs font-mono font-medium transition-colors"
                      >
                        Inspect v{ver.version_num}
                      </button>

                      <Link
                        href={`/app/quant?file=${encodeURIComponent(exploringStrategy.name)}&version=${ver.version_num}`}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>Edit in Lab</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Publish Strategy Modal */}
        <PublishStrategyModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          strategyName={exploringStrategy.cleanName}
          versionNum={selectedVersionNum}
          initialCode={versionCode || undefined}
          initialMetrics={detailedBacktest?.metrics || undefined}
          testedSymbol={detailedBacktest?.symbol || (exploringStrategy.cleanName.toLowerCase().includes('xau') ? 'XAUUSD' : 'EURUSD')}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 - STRATEGY REPOSITORY CATALOG (MAIN GRID)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-16">
      {/* 1. Page Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#0C121D] via-[#0E1524] to-[#0C121D] border border-[#1A2538] shadow-hud flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                strategies.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              QUANT STRATEGY REPOSITORY · {strategies.length} SAVED ARCHITECTURES
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            Algorithmic Strategy Library
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Institutional quantitative models with causal parameter boundaries, multi-version audit history,
            and verified MetaTrader 5 execution telemetry.
          </p>
        </div>

        {/* Institutional Algorithmic Architecture Vector Art (Slow, Pure Geometric Motion) */}
        <div
          onMouseMove={handleArtMouseMove}
          onMouseLeave={handleArtMouseLeave}
          className="shrink-0 flex items-center justify-center md:justify-end relative group cursor-pointer select-none"
          style={{ perspective: 1000 }}
          title="Algorithmic Strategy Architecture"
        >
          <div
            className="transition-transform duration-500 ease-out"
            style={{
              transform: `rotateX(${artTilt.y * 0.6}deg) rotateY(${artTilt.x * 0.6}deg) scale(${artTilt.isHovered ? 1.03 : 1})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <svg
              viewBox="0 0 280 120"
              className="w-60 sm:w-72 md:w-80 h-auto select-none overflow-visible"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Algorithmic Strategy Architecture"
            >
              <defs>
                <style>{`
                  @keyframes floatIsoTop {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-4px); }
                  }
                  @keyframes floatIsoMid {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-2px); }
                  }
                  @keyframes floatIsoBot {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-0.8px); }
                  }
                  @keyframes floatIsoKernel {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-5px); }
                  }
                  @keyframes pulseBeam {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 0.75; }
                  }
                  .anim-iso-top {
                    animation: floatIsoTop 11s ease-in-out infinite;
                  }
                  .anim-iso-mid {
                    animation: floatIsoMid 13s ease-in-out infinite 0.6s;
                  }
                  .anim-iso-bot {
                    animation: floatIsoBot 15s ease-in-out infinite 1.2s;
                  }
                  .anim-iso-kernel {
                    animation: floatIsoKernel 10s ease-in-out infinite 0.3s;
                  }
                  .anim-iso-beam {
                    animation: pulseBeam 6s ease-in-out infinite;
                  }
                `}</style>

                {/* Subtle Monochrome Ambient Radial Glow */}
                <radialGradient id="isoAmbientGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.14" />
                  <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>

                {/* Laser Beam Gradients */}
                <linearGradient id="laserPillarGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#0e2439" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                </linearGradient>

                {/* Plane Gradients */}
                <linearGradient id="plateBottomGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0e2038" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#091424" stopOpacity="0.15" />
                </linearGradient>

                <linearGradient id="plateMidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a2a44" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#091c30" stopOpacity="0.25" />
                </linearGradient>

                <linearGradient id="plateTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0e3a5a" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#082236" stopOpacity="0.35" />
                </linearGradient>

                {/* Neon Glow Filters */}
                <filter id="coreGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* 1. Ambient Background Glow */}
              <ellipse cx="140" cy="60" rx="100" ry="45" fill="url(#isoAmbientGlow)" />

              {/* 2. Layer 1: Base Execution Plane (Creation) */}
              <g className="anim-iso-bot transition-transform duration-700 ease-out group-hover:translate-y-1">
                {/* Skirt */}
                <path
                  d="M 82 82 L 140 108 L 140 113 L 82 87 Z"
                  fill="#061220"
                  opacity="0.8"
                />
                <path
                  d="M 140 108 L 198 82 L 198 87 L 140 113 Z"
                  fill="#08182b"
                  opacity="0.8"
                />
                {/* Top Face */}
                <path
                  d="M 140 56 L 198 82 L 140 108 L 82 82 Z"
                  fill="url(#plateBottomGrad)"
                  stroke="#1B3352"
                  strokeWidth="1"
                />
                {/* Base Grid Inset */}
                <path
                  d="M 111 69 L 169 95 M 169 69 L 111 95"
                  stroke="#1E3A5F"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                  opacity="0.4"
                />
                {/* Layer 1 Operation Label (Left side, no dots) */}
                <line x1="82" y1="82" x2="74" y2="82" stroke="#0284c7" strokeWidth="0.8" strokeOpacity="0.5" />
                <text x="70" y="85" textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace" fontWeight="600" letterSpacing="1.2">
                  CREATION
                </text>
              </g>

              {/* 3. Layer 2: Strategy Architecture Layer (Improvement) */}
              <g className="anim-iso-mid transition-transform duration-700 ease-out group-hover:-translate-y-1.5">
                {/* Corner Vertical Light Beams linking L1 to L2 */}
                <line x1="82" y1="82" x2="82" y2="58" stroke="url(#laserPillarGrad)" strokeWidth="1" strokeDasharray="2 2" className="anim-iso-beam" />
                <line x1="198" y1="82" x2="198" y2="58" stroke="url(#laserPillarGrad)" strokeWidth="1" strokeDasharray="2 2" className="anim-iso-beam" />
                <line x1="140" y1="108" x2="140" y2="84" stroke="url(#laserPillarGrad)" strokeWidth="1.2" className="anim-iso-beam" />

                {/* Skirt */}
                <path
                  d="M 82 58 L 140 84 L 140 89 L 82 63 Z"
                  fill="#081e33"
                  opacity="0.85"
                />
                <path
                  d="M 140 84 L 198 58 L 198 63 L 140 89 Z"
                  fill="#0b2844"
                  opacity="0.85"
                />
                {/* Top Face */}
                <path
                  d="M 140 32 L 198 58 L 140 84 L 82 58 Z"
                  fill="url(#plateMidGrad)"
                  stroke="#0284c7"
                  strokeWidth="1.2"
                  strokeOpacity="0.7"
                />
                {/* Circuit Traces on L2 */}
                <path
                  d="M 98 51 L 126 63 L 154 51 L 182 63"
                  stroke="#06b6d4"
                  strokeWidth="0.9"
                  strokeOpacity="0.5"
                />
                {/* Layer 2 Operation Label (Right side, no dots) */}
                <line x1="198" y1="58" x2="206" y2="58" stroke="#0ea5e9" strokeWidth="0.8" strokeOpacity="0.5" />
                <text x="210" y="61" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="600" letterSpacing="1.2">
                  IMPROVEMENT
                </text>
              </g>

              {/* 4. Layer 3: Risk & Parameter Boundaries (Validation) */}
              <g className="anim-iso-top transition-transform duration-700 ease-out group-hover:-translate-y-3">
                {/* Vertical Beams linking L2 to L3 */}
                <line x1="82" y1="58" x2="82" y2="34" stroke="url(#laserPillarGrad)" strokeWidth="1" strokeDasharray="2 2" className="anim-iso-beam" />
                <line x1="198" y1="58" x2="198" y2="34" stroke="url(#laserPillarGrad)" strokeWidth="1" strokeDasharray="2 2" className="anim-iso-beam" />
                <line x1="140" y1="84" x2="140" y2="60" stroke="url(#laserPillarGrad)" strokeWidth="1.2" className="anim-iso-beam" />

                {/* Skirt */}
                <path
                  d="M 82 34 L 140 60 L 140 65 L 82 39 Z"
                  fill="#0b2c49"
                  opacity="0.9"
                />
                <path
                  d="M 140 60 L 198 34 L 198 39 L 140 65 Z"
                  fill="#0f3c63"
                  opacity="0.9"
                />
                {/* Top Face */}
                <path
                  d="M 140 8 L 198 34 L 140 60 L 82 34 Z"
                  fill="url(#plateTopGrad)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                />

                {/* Top Plate Isometric Holographic Grid */}
                <path
                  d="M 111 21 L 169 47 M 169 21 L 111 47"
                  stroke="#38bdf8"
                  strokeWidth="0.8"
                  strokeOpacity="0.35"
                />

                {/* Central Precision Target Reticle */}
                <ellipse
                  cx="140"
                  cy="34"
                  rx="28"
                  ry="12"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="0.8"
                  strokeDasharray="4 3"
                  strokeOpacity="0.7"
                />
                <ellipse
                  cx="140"
                  cy="34"
                  rx="42"
                  ry="18"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="0.6"
                  strokeDasharray="2 4"
                  strokeOpacity="0.4"
                />
                {/* Layer 3 Operation Label (Left side, no dots) */}
                <line x1="82" y1="34" x2="74" y2="34" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.5" />
                <text x="70" y="37" textAnchor="end" fill="#7dd3fc" fontSize="8" fontFamily="monospace" fontWeight="600" letterSpacing="1.2">
                  VALIDATION
                </text>
              </g>

              {/* 5. The Floating Strategy Kernel Core (Isometric Glowing Cube) */}
              <g className="anim-iso-kernel transition-transform duration-700 ease-out group-hover:-translate-y-4">
                <g filter="url(#coreGlow)">
                  {/* Top Face */}
                  <path
                    d="M 140 16 L 149 21 L 140 26 L 131 21 Z"
                    fill="#38bdf8"
                  />
                  {/* Left Face */}
                  <path
                    d="M 131 21 L 140 26 L 140 36 L 131 31 Z"
                    fill="#0284c7"
                  />
                  {/* Right Face */}
                  <path
                    d="M 140 26 L 149 21 L 149 31 L 140 36 Z"
                    fill="#0ea5e9"
                  />
                </g>
              </g>
            </svg>

            {/* Bottom Title Badge retained */}
            <div className="flex justify-center mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#0E1726] border border-[#1E2E44] text-[10px] font-mono text-cyan-300 font-semibold uppercase tracking-wider shadow-sm">
                Multi-Layer Version Evolution
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filter Bar */}
      {strategies.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-xl bg-[#090D15] border border-[#182335]">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by strategy name, asset, or tag..."
              className="w-full pl-9 pr-3.5 py-2 sm:py-1.5 rounded-lg bg-[#0E1522] border border-[#1E2B3E] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 text-xs font-mono min-h-[40px] sm:min-h-0"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto no-scrollbar pb-1 max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 sm:py-1 rounded-lg transition-colors capitalize shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-[#070B12] font-bold shadow-hud'
                    : 'text-slate-400 hover:text-slate-200 bg-[#0E1522] border border-[#1E2B3E]/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-[#090D15] border border-[#182335] space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-[#141E2E] rounded w-24" />
                <div className="h-4 bg-[#141E2E] rounded w-20" />
              </div>
              <div className="h-6 bg-[#141E2E] rounded w-3/4" />
              <div className="h-14 bg-[#141E2E]/60 rounded-xl" />
              <div className="h-10 bg-[#141E2E]/40 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* 4. Empty State */}
      {!isLoading && strategies.length === 0 && (
        <div className="rounded-2xl bg-[#090D15] border border-[#182335] p-10 md:p-14 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-hud">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Strategy Repository is Empty</h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Synthesize your first institutional MQL5 or Python strategy with Quant AI Copilot, or run an MT5 strategy tester simulation to populate your library.
            </p>
          </div>
          <Link
            href="/app/quant"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#070B12] font-bold text-xs transition-all shadow-hud"
          >
            <Terminal className="w-4 h-4" />
            <span>Launch Quant Lab</span>
          </Link>
        </div>
      )}

      {/* 5. Strategy Cards Grid */}
      {!isLoading && filteredStrategies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredStrategies.map((strat) => {
            const isMql5 = strat.language === 'mql5' || strat.name.endsWith('.mq5');
            const bestRun = strat.bestRunInfo?.run;
            const metrics = bestRun?.metrics;
            const hasRun = Boolean(bestRun && metrics);
            const netProfit = metrics?.net_profit ?? 0;
            const isProfit = netProfit >= 0;

            return (
              <div
                key={strat.id}
                className="p-5 sm:p-6 rounded-2xl bg-[#090D15] border border-[#182335] hover:border-cyan-500/40 transition-all shadow-md space-y-4 flex flex-col justify-between group"
              >
                {/* Header Row */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#141E2E] border border-[#1E2B3E] flex items-center justify-center shrink-0">
                        {isMql5 ? <Mt5Icon className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                        v{strat.latestVersionNum}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#101724] text-slate-400 border border-[#1A2538]">
                        {strat.versions.length} {strat.versions.length === 1 ? 'Version' : 'Versions'}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-0.5 rounded font-semibold">
                      {strat.default_symbol} · {strat.default_timeframe.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-cyan-300 transition-colors font-mono">
                      {strat.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {strat.description || 'Deterministic quantitative trading model with zero look-ahead bias.'}
                    </p>
                  </div>
                </div>

                {/* Best Performance Strip */}
                {hasRun ? (
                  <div className="p-3 rounded-xl bg-[#0C121D] border border-[#1A2538] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-b border-[#16202E] pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-200 font-sans font-semibold">
                          Best Performance - V{strat.bestRunInfo?.versionNum} Test #{strat.bestRunInfo?.testNum}
                        </span>
                      </div>
                      <span>Tested {formatDate(bestRun?.created_at)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block">NET PROFIT</span>
                        <span
                          className={`text-xs sm:text-sm font-bold block ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? `+$${Math.round(netProfit).toLocaleString('en-US')}` : `-$${Math.abs(Math.round(netProfit)).toLocaleString('en-US')}`}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">WIN RATE</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                          {metrics?.win_rate ?? 0}%
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">PROFIT FACTOR</span>
                        <span
                          className={`text-xs sm:text-sm font-bold block ${
                            (metrics?.profit_factor ?? 0) >= 1.2 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {metrics?.profit_factor ?? 0}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">MAX DD</span>
                        <span className="text-xs sm:text-sm font-bold text-rose-400 block">
                          -{metrics?.max_drawdown_pct ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#0C121D]/70 border border-[#1A2538] flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>No Backtest Executed Yet</span>
                    </span>
                    <span className="text-[10px] text-cyan-400">Ready for simulation</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-[#182335] flex items-center justify-between gap-2.5">
                  <button
                    onClick={() => handleOpenExplorer(strat)}
                    className="px-3.5 py-2 rounded-xl bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] hover:border-cyan-500/40 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 group/btn"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                    <span>Explore Architecture</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/quant?file=${encodeURIComponent(strat.name)}`}
                      className="px-3 py-2 rounded-xl bg-[#121A26] hover:bg-[#1A2538] border border-[#1E2B3E] text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="Open and edit strategy code in QuantLab"
                    >
                      <Terminal className="w-3 h-3 text-cyan-400" />
                      <span>QuantLab</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
