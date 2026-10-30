'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  createWidget,
  registerWidgetDialogs,
  WIDGET_DIALOGS,
  injectWidgetStyles,
  WIDGET_COMPONENT_CSS,
  type Widget,
} from 'openalgo-charts/widget';
import { registerBuiltinDrawingTools } from 'openalgo-charts/draw';
import { registerBuiltinIndicators } from 'openalgo-charts/indicators';
import type { CrosshairMoveEvent, SeriesMarkers } from 'openalgo-charts';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Layers,
  Pencil,
  Zap,
} from 'lucide-react';
import { OpenAlgoChartProps, OpenAlgoBar, ChartTrade, OpenAlgoChartApi } from './types';
import { buildOpenAlgoTradeMarkers } from './markers';
import { ReplayController } from './ReplayController';
import { QuantLoader, QuantLoaderIcon } from './QuantLoader';

import {
  getSubTimeframeConfig,
  calculateExactBrokerTime,
  calculateSubIndexFromBrokerTime,
  getTimeframeSeconds,
  type SubTimeframeConfig,
} from './ReplayDataManager';


/**
 * Helper to find the bar index corresponding to a given target timestamp.
 * Returns the largest index whose candle timestamp is <= targetTime,
 * ensuring the chart stays at the exact same point in time across timeframe changes.
 */
function findIndexForTime(barList: OpenAlgoBar[], targetTime: number): number {
  if (barList.length === 0) return 0;
  if (targetTime <= barList[0].time) return 0;
  if (targetTime >= barList[barList.length - 1].time) return barList.length - 1;

  let low = 0;
  let high = barList.length - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (barList[mid].time <= targetTime) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

const OpenAlgoChartComponent: React.FC<OpenAlgoChartProps> = ({
  bars,
  trades = [],
  symbol = 'BTCUSDT',
  timeframe = '1m',
  height = '100%',
  showVolume = false,
  showReplayScrubber = true,
  onBarHover,
  onReplayStateChange,
  activeSessionId,
  activeSessionName,
  activeSessionBalance,
  initialBarIndex,
  initialReplayTime,
  onOpenSessionLauncher,
  isOrderPanelOpen,
  onToggleOrderPanel,
  activeStrategyName,
  onOpenStrategyDrawer,
  onRunSimulation,
  isRunning = false,
  isLoading = false,
  onSymbolChange,
  onTimeframeChange,
  onLoadOlderBars,
  onLoadNewerBars,
  apiBaseUrl = 'http://127.0.0.1:8000',
  onExitWorkspace,
  onChartApi,
  isCompleted = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<Widget | null>(null);
  const markersLayerRef = useRef<SeriesMarkers | null>(null);
  const [topbarSpacer, setTopbarSpacer] = useState<HTMLElement | null>(null);

  const onChartApiRef = useRef(onChartApi);
  useEffect(() => {
    onChartApiRef.current = onChartApi;
  }, [onChartApi]);

  const scaleListeners = useRef<Set<() => void>>(new Set());
  const notifyScaleChange = useCallback(() => {
    scaleListeners.current.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }, []);

  // Track preferred user zoom level (barSpacing in px) across timeframe changes
  const lastUserBarSpacingRef = useRef<number>(11);

  // Helper to maintain comfortable right margin (~32% space on right, placing current candle at ~68% width like TradingView / Image 1)
  const applyComfortableRightMargin = useCallback((w: Widget | null) => {
    if (!w || w.isDestroyed) return;
    try {
      const timeScale = (w.chart as any)?.timeScale;
      if (!timeScale) return;

      // 1. Maintain preferred candle spacing (zoom level)
      const targetSpacing = lastUserBarSpacingRef.current;
      if (typeof timeScale.setBarSpacing === 'function' && targetSpacing >= 4 && targetSpacing <= 60) {
        timeScale.setBarSpacing(targetSpacing);
      }

      // 2. Position current candle at ~68% width with comfortable right margin (~32% like Image 1)
      if (typeof timeScale.visibleRange === 'function' && typeof timeScale.setRightOffset === 'function') {
        const vr = timeScale.visibleRange();
        const span = (vr?.to ?? 0) - (vr?.from ?? 0);
        const targetOffset = span > 0 ? Math.max(25, Math.round(span * 0.32)) : 35;
        timeScale.setRightOffset(targetOffset);
      }
    } catch (err) {
      console.warn('Could not apply comfortable right margin:', err);
    }
  }, []);

  // Lightweight vertical price camera tracker: keeps current price line always inside the viewport
  // when the user has manually expanded/resized the price scale, while 100% preserving their custom scale height (span).
  const keepPriceInView = useCallback((targetWidget: Widget | null, latestBar: OpenAlgoBar | null | undefined): boolean => {
    if (!targetWidget || targetWidget.isDestroyed || !latestBar) return false;
    try {
      let ps: any = null;
      if (typeof (targetWidget.series as any)?.priceScale === 'function') {
        ps = (targetWidget.series as any).priceScale();
      }
      if (!ps && typeof (targetWidget.chart as any)?.panes === 'function') {
        const panes = (targetWidget.chart as any).panes();
        if (panes && panes.length > 0) {
          ps = panes[0].priceScale;
        }
      }
      // If native autoScale is active, the chart engine already bounds the visible bars automatically
      if (!ps || ps.autoScale) return false;

      const pr = ps.priceRange();
      if (!pr || !Number.isFinite(pr.min) || !Number.isFinite(pr.max) || pr.max <= pr.min) return false;

      const span = pr.max - pr.min;
      if (span <= 0) return false;

      const targetHigh = Math.max(latestBar.high ?? latestBar.close, latestBar.close);
      const targetLow = Math.min(latestBar.low ?? latestBar.close, latestBar.close);
      const pad = span * 0.12; // 12% padding from top and bottom borders
      const topLimit = pr.max - pad;
      const bottomLimit = pr.min + pad;

      if (targetHigh > topLimit) {
        const delta = targetHigh - topLimit;
        ps.setPriceRange({ min: pr.min + delta, max: pr.max + delta });
        return true;
      } else if (targetLow < bottomLimit) {
        const delta = bottomLimit - targetLow;
        ps.setPriceRange({ min: pr.min - delta, max: pr.max - delta });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Could not auto-track price in view:', err);
      return false;
    }
  }, []);

  const [activeInterval, setActiveInterval] = useState<string>(timeframe);

  // Mobile layout & Left Rail collapsed state
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState<boolean>(true);

  useEffect(() => {
    const check = () => {
      const mob = typeof window !== 'undefined' && window.innerWidth < 1024;
      setIsMobile(mob);
      if (!mob) {
        setIsRailCollapsed(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleRail = useCallback(() => {
    setIsRailCollapsed((prev) => {
      const next = !prev;
      setTimeout(() => {
        try {
          (widgetRef.current as any)?.resize?.();
          (widgetRef.current?.chart as any)?.resize?.();
        } catch {}
      }, 60);
      return next;
    });
  }, []);

  const onLoadOlderBarsRef = useRef(onLoadOlderBars);
  onLoadOlderBarsRef.current = onLoadOlderBars;

  const onLoadNewerBarsRef = useRef(onLoadNewerBars);
  onLoadNewerBarsRef.current = onLoadNewerBars;

  const onTimeframeChangeRef = useRef(onTimeframeChange);
  onTimeframeChangeRef.current = onTimeframeChange;

  const onSymbolChangeRef = useRef(onSymbolChange);
  onSymbolChangeRef.current = onSymbolChange;

  const lastSymbolRef = useRef<string>(symbol);

  // Ready & paint state: ensures chart never appears blank or broken
  const [isChartReady, setIsChartReady] = useState(false);
  const lastRenderedBarsRef = useRef<OpenAlgoBar[] | null>(null);
  const lastRenderedWidgetRef = useRef<Widget | null>(null);
  const lastRenderedSymbolTfRef = useRef<string>('');

  // Reset ready state on instrument or timeframe switch to show clean transition
  useEffect(() => {
    setIsChartReady(false);
  }, [symbol, timeframe]);

  // Fallback watchdog: whenever bars are loaded and available, ensure isChartReady is resolved
  useEffect(() => {
    if (bars.length > 0 && !isChartReady) {
      const timer = setTimeout(() => {
        setIsChartReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [bars.length, isChartReady]);

  // Replay playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(5);

  // Hover telemetry state
  const [hoveredBar, setHoveredBar] = useState<OpenAlgoBar | null>(null);

  // Pure source of truth for the current replay point is the candle timestamp in seconds:
  const [replayTime, setReplayTime] = useState<number | null>(null);
  const replayTimeRef = useRef<number | null>(null);
  replayTimeRef.current = replayTime;

  // Reset or initialize replay position when activeSessionId, symbol, or initialReplayTime changes
  const lastSessionSymbolRef = useRef<string>('');
  const lastInitialReplayTimePropRef = useRef<number | null>(null);

  useEffect(() => {
    const key = `${activeSessionId || ''}_${symbol}`;
    const sessionChanged = lastSessionSymbolRef.current !== key;
    const initialTimeUpdated = initialReplayTime && initialReplayTime > 0 && initialReplayTime !== lastInitialReplayTimePropRef.current;

    if (sessionChanged) {
      lastSessionSymbolRef.current = key;
      lastInitialReplayTimePropRef.current = initialReplayTime || null;
      if (initialReplayTime && initialReplayTime > 0) {
        setReplayTime(initialReplayTime);
      } else if (initialBarIndex !== undefined && initialBarIndex > 0 && bars.length > 0) {
        const clamped = Math.min(bars.length - 1, initialBarIndex);
        setReplayTime(bars[clamped].time);
      } else {
        setReplayTime(null);
      }
      setIsPlaying(false);
    } else if (initialTimeUpdated) {
      lastInitialReplayTimePropRef.current = initialReplayTime;
      setReplayTime(initialReplayTime);
    }
  }, [symbol, activeSessionId, initialReplayTime, initialBarIndex, bars]);

  // Candle Construction ("Build Candles") Replay State - Permanently active by default
  const [buildCandles, setBuildCandles] = useState<boolean>(true);
  const [currentSubIndex, setCurrentSubIndex] = useState<number>(0);

  // Sub-timeframe configuration for current active timeframe
  const subConfig = useMemo(() => getSubTimeframeConfig(timeframe), [timeframe]);
  const isSubTimeframeAvailable = subConfig !== null;

  // Calculate precision sub-index whenever symbol, timeframe, or replayTime changes
  useEffect(() => {
    if (replayTime && bars.length > 0) {
      const parentIdx = findIndexForTime(bars, replayTime);
      const barStartTime = bars[parentIdx]?.time || 0;
      const subIdx = calculateSubIndexFromBrokerTime(barStartTime, replayTime, timeframe);
      setCurrentSubIndex(subIdx);
    } else {
      setCurrentSubIndex(0);
    }
  }, [symbol, timeframe, bars, replayTime]);

  // Derived replay index for the current bars dataset - always 100% pure & synchronous
  const replayIndex = useMemo(() => {
    if (bars.length === 0) return 0;
    if (!showReplayScrubber) return bars.length - 1;
    // Initial replay state starts at beginning with 3 to 5 candles (index 4 = 5 candles)
    if (replayTime === null) return Math.min(4, bars.length - 1);
    return findIndexForTime(bars, replayTime);
  }, [bars, replayTime, showReplayScrubber]);

  // Active slice of bars (during replay: stays cleanly aligned to replayTime across any timeframe switch!)
  const activeBars = useMemo(() => {
    if (!showReplayScrubber || bars.length === 0) return bars;
    const parentIdx = Math.min(bars.length - 1, Math.max(0, replayIndex));
    const parentBar = bars[parentIdx];

    // If candle construction ("Intrabar Replay") is active:
    if (buildCandles && subConfig) {
      const totalSteps = subConfig.expectedSteps || 4;
      const stepRatio = Math.min(1, Math.max(0, currentSubIndex / Math.max(1, totalSteps - 1)));
      
      const isBullish = parentBar.close >= parentBar.open;
      let syntheticClose: number;
      let syntheticHigh: number;
      let syntheticLow: number;

      if (stepRatio <= 0.25) {
        const progress = stepRatio / 0.25;
        syntheticClose = isBullish
          ? parentBar.open - (parentBar.open - parentBar.low) * progress
          : parentBar.open + (parentBar.high - parentBar.open) * progress;
        syntheticHigh = Math.max(parentBar.open, syntheticClose);
        syntheticLow = Math.min(parentBar.open, syntheticClose);
      } else if (stepRatio <= 0.75) {
        const progress = (stepRatio - 0.25) / 0.5;
        const firstWick = isBullish ? parentBar.low : parentBar.high;
        const targetWick = isBullish ? parentBar.high : parentBar.low;
        syntheticClose = firstWick + (targetWick - firstWick) * progress;
        syntheticHigh = isBullish ? Math.max(parentBar.open, syntheticClose) : parentBar.high;
        syntheticLow = isBullish ? parentBar.low : Math.min(parentBar.open, syntheticClose);
      } else {
        const progress = (stepRatio - 0.75) / 0.25;
        const targetWick = isBullish ? parentBar.high : parentBar.low;
        syntheticClose = targetWick + (parentBar.close - targetWick) * progress;
        syntheticHigh = parentBar.high;
        syntheticLow = parentBar.low;
      }

      const formingCandle: OpenAlgoBar = {
        time: parentBar.time,
        open: parentBar.open,
        high: Math.max(parentBar.open, syntheticHigh, syntheticClose),
        low: Math.min(parentBar.open, syntheticLow, syntheticClose),
        close: syntheticClose,
        volume: Math.round((parentBar.volume || 100) * stepRatio),
      };
      return [...bars.slice(0, parentIdx), formingCandle];
    }

    // Default: full candle at current replay index
    const end = Math.min(bars.length, Math.max(1, parentIdx + 1));
    return bars.slice(0, end);
  }, [bars, replayIndex, showReplayScrubber, buildCandles, subConfig, currentSubIndex]);

  const activeBarsRef = useRef<OpenAlgoBar[]>([]);
  activeBarsRef.current = activeBars;

  // Active trades that have opened up to current replay bar (or intra-bar sub-step)
  const activeTrades = useMemo(() => {
    if (!showReplayScrubber || activeBars.length === 0) return trades;
    const currentMaxTime = activeBars[activeBars.length - 1].time;
    return trades.filter((t) => {
      let entrySec =
        typeof t.entryTime === 'number'
          ? t.entryTime > 1e11
            ? Math.floor(t.entryTime / 1000)
            : t.entryTime
          : 0;
      if (!entrySec && t.entryTime) {
        let s = String(t.entryTime).trim().replace(/\./g, '-').replace(' ', 'T');
        if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
        const ms = new Date(s).getTime();
        entrySec = isNaN(ms) ? 0 : Math.floor(ms / 1000);
      }
      // Place trade and position box as soon as position opens!
      return entrySec <= currentMaxTime;
    });
  }, [trades, activeBars, showReplayScrubber]);

  const onReplayStateChangeRef = useRef(onReplayStateChange);
  onReplayStateChangeRef.current = onReplayStateChange;

  const lastEmittedStateRef = useRef<{
    time: number | null;
    close: number;
    activeCount: number;
    isPlaying: boolean;
    barIndex: number;
    progressPct: number;
  }>({ time: null, close: 0, activeCount: -1, isPlaying: false, barIndex: -1, progressPct: -1 });

  // Synchronize current replay temporal point and candle bar with parent (guarded against duplicate renders)
  useEffect(() => {
    if (!onReplayStateChangeRef.current) return;
    const latestBar = activeBars.length > 0 ? activeBars[activeBars.length - 1] : null;
    const parentIdx = Math.min(bars.length - 1, Math.max(0, replayIndex));
    const parentBarStartTime = bars[parentIdx]?.time;
    const exactBrokerTime = parentBarStartTime !== undefined
      ? calculateExactBrokerTime(parentBarStartTime, currentSubIndex, timeframe, buildCandles && isSubTimeframeAvailable)
      : (replayTimeRef.current || (latestBar ? latestBar.time : null));

    const targetBar = latestBar;

    const calculatedProgress = bars.length > 1
      ? Number(((Math.min(bars.length - 1, Math.max(0, replayIndex)) / (bars.length - 1)) * 100).toFixed(1))
      : 0;

    const barClose = targetBar ? targetBar.close : 0;
    const prev = lastEmittedStateRef.current;
    if (
      prev.time === exactBrokerTime &&
      prev.close === barClose &&
      prev.activeCount === activeTrades.length &&
      prev.isPlaying === isPlaying &&
      prev.barIndex === replayIndex &&
      prev.progressPct === calculatedProgress
    ) {
      return;
    }

    lastEmittedStateRef.current = {
      time: exactBrokerTime,
      close: barClose,
      activeCount: activeTrades.length,
      isPlaying,
      barIndex: replayIndex,
      progressPct: calculatedProgress,
    };

    onReplayStateChangeRef.current({
      currentTime: showReplayScrubber ? exactBrokerTime : null,
      currentBar: targetBar,
      activeCount: activeTrades.length,
      isPlaying,
      barIndex: replayIndex,
      totalBars: bars.length,
      progressPct: calculatedProgress,
    });
  }, [activeBars, showReplayScrubber, buildCandles, currentSubIndex, activeTrades.length, isPlaying, replayIndex, bars.length, timeframe, isSubTimeframeAvailable]);

  // 1. Initialize Full-Power OpenAlgo Terminal Widget
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    // Ensure native price line is rendered as a continuous solid line (not dashed)
    const origSetLineDash = typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype.setLineDash : null;
    if (origSetLineDash) {
      CanvasRenderingContext2D.prototype.setLineDash = function (segments: number[]) {
        if (
          Array.isArray(segments) &&
          segments.length === 2 &&
          segments[0] > 0 &&
          segments[0] === segments[1]
        ) {
          // Native price line calls e.setLineDash([3 * n, 3 * n]) -> pass [] to render continuous solid line
          return origSetLineDash.call(this, []);
        }
        return origSetLineDash.call(this, segments);
      };
    }

    // Register all 87 drawing tools, 112 indicators, dialogs, and inject styles
    try {
      registerBuiltinDrawingTools();
      registerBuiltinIndicators();
      registerWidgetDialogs(WIDGET_DIALOGS);
      injectWidgetStyles(document, WIDGET_COMPONENT_CSS + `
        .oac-topbar {
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          overflow: hidden !important;
        }
        .oac-topbar__items {
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
        }
        .oac-topbar__spacer {
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          min-width: 0 !important;
        }
        .oac-topbar__branding-slot,
        .oac-topbar__branding,
        .oac-topbar__objects,
        .oac-topbar__data,
        .oac-topbar__alerts {
          display: none !important;
        }

        /* Permanently lock bottombar clock to unchangeable MT5 Broker Time */
        .oac-widget .oac-bottombar__clock,
        .oac-bottombar__clock {
          pointer-events: none !important;
          cursor: default !important;
          user-select: none !important;
          opacity: 0.95 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
        }
        /* Hide OpenAlgo default ticker elements and any leftover dual-clock elements */
        .oac-bottombar__clock > .oac-bottombar__time,
        .oac-bottombar__clock > small,
        .oac-custom-dual-clock {
          display: none !important;
        }
        .oac-broker-clock-time {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          color: #e2e8f0 !important;
          white-space: nowrap !important;
        }
        .oac-broker-clock-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          color: #38bdf8 !important;
          white-space: nowrap !important;
        }

        /* Left rail collapsed and stage positioning */
        .oac-rail-collapsed .oac-rail {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          overflow: hidden !important;
        }
        .oac-stage {
          position: relative !important;
          overflow: hidden !important;
        }
        .oac-rail {
          z-index: 20 !important;
          background-color: #0b0f17 !important;
          border-right: 1px solid #1e293b !important;
        }

        /* Prevent OpenAlgo mobile bottom toolbar injection */
        .oac-mobile,
        .oac-mobile__footer,
        .oac-mobile__bar,
        .oac-mobile__selection {
          display: none !important;
        }

        @media (max-width: 1023px) {
          .oac-bottombar,
          .oac-statusline,
          .oac-bottombar__ranges {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
          }
        }
      `);

      // Ensure style is also injected directly into document.head to bypass OpenAlgo cache
      let headStyle = document.getElementById('backtest-si-broker-clock-style');
      if (!headStyle) {
        headStyle = document.createElement('style');
        headStyle.id = 'backtest-si-broker-clock-style';
        document.head.appendChild(headStyle);
      }
      headStyle.textContent = `
        .oac-widget .oac-bottombar__clock,
        .oac-bottombar__clock {
          pointer-events: none !important;
          cursor: default !important;
          user-select: none !important;
          opacity: 0.95 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
        }
        .oac-bottombar__clock > .oac-bottombar__time,
        .oac-bottombar__clock > small,
        .oac-custom-dual-clock {
          display: none !important;
        }
        .oac-broker-clock-time {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          color: #e2e8f0 !important;
          white-space: nowrap !important;
        }
        .oac-broker-clock-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          color: #38bdf8 !important;
          white-space: nowrap !important;
        }

        .oac-rail-collapsed .oac-rail {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          overflow: hidden !important;
        }
        .oac-stage {
          position: relative !important;
          overflow: hidden !important;
        }
        .oac-rail {
          z-index: 20 !important;
          background-color: #0b0f17 !important;
          border-right: 1px solid #1e293b !important;
        }
        .oac-mobile,
        .oac-mobile__footer,
        .oac-mobile__bar,
        .oac-mobile__selection {
          display: none !important;
        }
        @media (max-width: 1023px) {
          .oac-bottombar,
          .oac-statusline,
          .oac-bottombar__ranges {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
          }
        }
      `;
    } catch (err) {
      console.warn('OpenAlgo registration notice:', err);
    }

    // Clean container before mount
    containerRef.current.innerHTML = '';

    // Create institutional widget instance
    let widget: Widget;
    let clockInterval: ReturnType<typeof setInterval> | null = null;
    try {
      widget = createWidget(containerRef.current, {
        symbol: symbol,
        interval: timeframe,
        intervals: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
        theme: 'dark',
        chartType: 'candlestick',
        rail: true, // Left drawing rail with 15 groups, flyout menus, and 87 tools
        topbar: true, // Topbar with symbol, interval, candle type, "+ Indicators", "Alerts", settings
        statusline: true, // Realtime OHLC readings + indicator legends with hide/gear/delete
        bottombar: true, // Range selectors (1D, 5D, 1M, 1Y, All), date navigation, timezone, log scale, % toggle
        panels: false, // Objects and Data panels removed per user request
        branding: false, // Explicitly disable OpenAlgo branding watermark and slot
        shortcutsEditor: true, // Keyboard shortcuts (? dialog)
        drawingScope: 'chart',
        persist: false, // Per-session clean state
        timezone: 'UTC', // Strictly UTC to prevent default Asia/Kolkata (+5:30) offset
        mobile: 'never', // Prevent OpenAlgo bottom mobile footer; retain left rail with collapse button
        timeScale: {
          rightOffset: 35,
          barSpacing: 11,
        },
        navigation: {
          defaultBarSpacing: 11,
        },
      });
      widgetRef.current = widget;

      // Force widget chart to UTC timezone & lock it against changes
      try {
        if (typeof (widget.chart as any)?.setTimezone === 'function') {
          (widget.chart as any).setTimezone('UTC');
        }
        widget.chart.on('timezone:changed' as any, (ev: any) => {
          if (ev?.timezone !== 'UTC') {
            try {
              (widget.chart as any).setTimezone('UTC');
            } catch {}
          }
        });
        if (typeof (widget.chart as any)?.setPriceScaleOptions === 'function') {
          (widget.chart as any).setPriceScaleOptions({
            marginTop: 0.15,
            marginBottom: 0.15,
          });
        }
      } catch (tzErr) {
        console.warn('Could not initialize UTC timezone on chart:', tzErr);
      }

      // Ensure native stable price line and price tag on candlestick series
      try {
        if (typeof widget.series?.applyOptions === 'function') {
          widget.series.applyOptions({
            priceLineVisible: true,
            lastValueVisible: true,
            color: '#38bdf8',
            lineWidth: 1,
            lineStyle: 'solid',
          });
        }
      } catch (plErr) {
        console.warn('Could not configure series price line:', plErr);
      }

      // Wrap chart.resetScale to always preserve comfortable right margin & zoom
      try {
        const originalResetScale = widget.chart.resetScale.bind(widget.chart);
        widget.chart.resetScale = () => {
          originalResetScale();
          try {
            const ts = (widget.chart as any)?.timeScale;
            if (ts) {
              const targetSpacing = lastUserBarSpacingRef.current;
              if (typeof ts.setBarSpacing === 'function' && targetSpacing >= 4 && targetSpacing <= 60) {
                ts.setBarSpacing(targetSpacing);
              }
              if (typeof ts.visibleRange === 'function' && typeof ts.setRightOffset === 'function') {
                const vr = ts.visibleRange();
                const span = (vr?.to ?? 0) - (vr?.from ?? 0);
                const targetOffset = span > 0 ? Math.max(25, Math.round(span * 0.32)) : 35;
                ts.setRightOffset(targetOffset);
              }
            }
          } catch {}
        };
      } catch (wrapErr) {
        console.warn('Could not wrap chart.resetScale:', wrapErr);
      }

      // Single Broker Time Clock: "HH:mm:ss Broker Time" (Default and only time displayed)
      const updateBrokerClock = () => {
        if (!containerRef.current) return;
        const clockContainer = containerRef.current.querySelector<HTMLElement>('.oac-bottombar__clock');
        if (!clockContainer) return;

        const now = new Date();
        let brokerTimeStr = '';
        try {
          brokerTimeStr = now.toLocaleTimeString([], {
            timeZone: 'Europe/Athens',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
        } catch {
          const utcHours = now.getUTCHours();
          const isDst = now.getMonth() > 2 && now.getMonth() < 10;
          const brokerHours = (utcHours + (isDst ? 3 : 2)) % 24;
          brokerTimeStr = `${String(brokerHours).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
        }

        // Cleanly render only the single Broker Time
        const timeEl = clockContainer.querySelector('.oac-broker-clock-time');
        const labelEl = clockContainer.querySelector('.oac-broker-clock-label');
        if (timeEl && labelEl && clockContainer.childElementCount <= 4) {
          if (timeEl.textContent !== brokerTimeStr) {
            timeEl.textContent = brokerTimeStr;
          }
        } else {
          clockContainer.innerHTML = `<span class="oac-broker-clock-time">${brokerTimeStr}</span><span class="oac-broker-clock-label">Broker Time</span>`;
        }
      };
      updateBrokerClock();
      clockInterval = setInterval(updateBrokerClock, 500);

      // If active bars are already loaded before or during widget mount, feed and fit immediately
      if (activeBarsRef.current.length > 0) {
        widget.series.setData(activeBarsRef.current);
        widget.chart.resetScale();
        applyComfortableRightMargin(widget);
        requestAnimationFrame(() => {
          if (!widget.isDestroyed) {
            widget.chart.resetScale();
            applyComfortableRightMargin(widget);
            setIsChartReady(true);
          }
        });
        setTimeout(() => {
          if (!widget.isDestroyed) {
            widget.chart.resetScale();
            applyComfortableRightMargin(widget);
            setIsChartReady(true);
          }
        }, 60);
      }
    } catch (err) {
      console.error('Failed to instantiate OpenAlgo terminal widget:', err);
      return;
    }

    // Expose chart coordinate & layout API for order overlay & tools
    const api: OpenAlgoChartApi = {
      priceToCoordinate: (price: number) => {
        if (!widgetRef.current || widgetRef.current.isDestroyed) return null;
        try {
          return widgetRef.current.chart.priceToCoordinate(price);
        } catch {
          return null;
        }
      },
      coordinateToPrice: (y: number) => {
        if (!widgetRef.current || widgetRef.current.isDestroyed) return null;
        try {
          return widgetRef.current.chart.coordinateToPrice(y);
        } catch {
          return null;
        }
      },
      getPlotRect: () => {
        if (!widgetRef.current || widgetRef.current.isDestroyed) return null;
        try {
          return widgetRef.current.chart.plotRect(0);
        } catch {
          return null;
        }
      },
      getChartElement: () => {
        return containerRef.current?.querySelector<HTMLElement>('.oac-chart') || null;
      },
      subscribeScaleChange: (cb: () => void) => {
        scaleListeners.current.add(cb);
        return () => {
          scaleListeners.current.delete(cb);
        };
      },
    };
    onChartApiRef.current?.(api);

    // Attach trade markers layer to candlestick series
    try {
      markersLayerRef.current = widget.series.createMarkers();
    } catch (err) {
      console.warn('Could not initialize trade markers layer:', err);
    }

    // Telemetry Crosshair listener
    const unsubscribeCrosshair = widget.chart.subscribeCrosshairMove((e: CrosshairMoveEvent) => {
      if (!e.bar) {
        setHoveredBar(null);
        if (onBarHover) onBarHover(null);
        return;
      }
      const b: OpenAlgoBar = {
        time: e.bar.time,
        open: e.bar.open,
        high: e.bar.high,
        low: e.bar.low,
        close: e.bar.close,
        volume: e.bar.volume,
      };
      setHoveredBar(b);
      if (onBarHover) onBarHover(b);
    });

    // Listen to interval change from topbar
    const unsubInterval = widget.on('interval', (evt) => {
      if (evt?.interval) {
        setActiveInterval(evt.interval);
        // Automatically pause replay when switching timeframe
        setIsPlaying(false);
        const anchor =
          replayTimeRef.current !== null
            ? replayTimeRef.current
            : activeBarsRef.current.length > 0
            ? activeBarsRef.current[activeBarsRef.current.length - 1].time
            : null;
        onTimeframeChangeRef.current?.(evt.interval, anchor);
      }
    });

    // Listen to symbol change from topbar
    const unsubSymbol = widget.on('symbol', (evt) => {
      if (evt?.symbol) {
        lastSymbolRef.current = evt.symbol;
        onSymbolChangeRef.current?.(evt.symbol);
      }
    });

    // Level of Detail (LoD): trigger background load of older history when scrolling back
    const unsubLazyLoad = widget.chart.on('lazy-load', () => {
      if (showReplayScrubber) return;
      onLoadOlderBarsRef.current?.();
    });

    const handleViewportChange = (evt: any) => {
      // In replay mode, bars are already strictly loaded for the session range.
      // Do not trigger background LoD paging which corrupts the replay dataset!
      if (showReplayScrubber) return;

      // Left-edge: load older bars
      if (evt?.logicalFrom !== undefined && evt.logicalFrom < 250) {
        onLoadOlderBarsRef.current?.();
      }
      // Right-edge: load newer bars (bidirectional LoD)
      const total = activeBarsRef.current.length;
      if (total > 0 && evt?.logicalTo !== undefined && evt.logicalTo > total - 250) {
        onLoadNewerBarsRef.current?.();
      }
    };

    // Real-time 60fps scale tracking loop during price scale dragging, canvas panning, and wheel zooming
    let scaleRafId: number | null = null;
    let isTrackingInteraction = false;

    const stopTrackingLoop = () => {
      isTrackingInteraction = false;
      if (scaleRafId !== null) {
        cancelAnimationFrame(scaleRafId);
        scaleRafId = null;
      }
      notifyScaleChange();
    };

    const startTrackingLoop = () => {
      if (isTrackingInteraction) return;
      isTrackingInteraction = true;

      const tick = () => {
        if (!isTrackingInteraction) return;
        notifyScaleChange();
        scaleRafId = requestAnimationFrame(tick);
      };
      scaleRafId = requestAnimationFrame(tick);
    };

    // Continuous real-time scale update while dragging price scale, time scale, or panning
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (e.buttons !== 0) {
        startTrackingLoop();
      } else if (isTrackingInteraction) {
        stopTrackingLoop();
      }
    };

    const handlePointerDown = () => {
      startTrackingLoop();
    };

    const handlePointerUp = () => {
      stopTrackingLoop();
      if (activeBarsRef.current.length > 0 && widgetRef.current) {
        const latest = activeBarsRef.current[activeBarsRef.current.length - 1];
        if (latest) {
          const shifted = keepPriceInView(widgetRef.current, latest);
          if (shifted) {
            try {
              (widgetRef.current.chart as any)?.invalidate?.((i: any) => i?.invalidateGlobal?.(1));
            } catch {}
            notifyScaleChange();
          }
        }
      }
    };

    let wheelDebounce: ReturnType<typeof setTimeout> | null = null;
    const handleWheelInteraction = () => {
      startTrackingLoop();
      if (wheelDebounce) clearTimeout(wheelDebounce);
      wheelDebounce = setTimeout(() => {
        stopTrackingLoop();
      }, 200);
    };

    const handleDblClick = () => {
      notifyScaleChange();
      setTimeout(notifyScaleChange, 30);
      setTimeout(notifyScaleChange, 100);
      setTimeout(notifyScaleChange, 200);
    };

    const cEl = containerRef.current;
    cEl?.addEventListener('pointerdown', handlePointerDown, { passive: true });
    cEl?.addEventListener('wheel', handleWheelInteraction, { passive: true });
    cEl?.addEventListener('dblclick', handleDblClick, { passive: true });
    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    const unsubPan = widget.chart.on('pan', (ev) => {
      notifyScaleChange();
      handleViewportChange(ev);
    });
    const unsubZoom = widget.chart.on('zoom', (ev) => {
      try {
        const spacing = (widget.chart as any)?.timeScale?.barSpacing;
        if (typeof spacing === 'number' && spacing >= 4 && spacing <= 60) {
          lastUserBarSpacingRef.current = spacing;
        }
      } catch {}
      notifyScaleChange();
      handleViewportChange(ev);
    });

    // Locate OpenAlgo topbar spacer and mount replay tools adjusted in the right
    const setupSpacer = () => {
      const spacer = containerRef.current?.querySelector<HTMLElement>('.oac-topbar__spacer');
      if (spacer) {
        spacer.style.display = 'flex';
        spacer.style.alignItems = 'center';
        spacer.style.justifyContent = 'flex-end'; // adjusted in right
        spacer.style.paddingRight = '10px';
        spacer.style.pointerEvents = 'auto';
        setTopbarSpacer(spacer);
        return true;
      }
      return false;
    };

    let spacerTimer: ReturnType<typeof setTimeout> | null = null;
    if (!setupSpacer()) {
      spacerTimer = setTimeout(setupSpacer, 60);
    }

    // Automatic fluid layout resize observer: handles panel dragging, drawer resizing, and window size changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (widgetRef.current && !widgetRef.current.isDestroyed) {
          try {
            (widgetRef.current as any).resize?.();
            (widgetRef.current.chart as any)?.resize?.();
            notifyScaleChange();
          } catch {}
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      onChartApiRef.current?.(null);
      if (origSetLineDash && typeof CanvasRenderingContext2D !== 'undefined') {
        CanvasRenderingContext2D.prototype.setLineDash = origSetLineDash;
      }
      stopTrackingLoop();
      if (wheelDebounce) clearTimeout(wheelDebounce);
      cEl?.removeEventListener('pointerdown', handlePointerDown);
      cEl?.removeEventListener('wheel', handleWheelInteraction);
      cEl?.removeEventListener('dblclick', handleDblClick);
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      setTopbarSpacer(null);
      if (spacerTimer) clearTimeout(spacerTimer);
      if (clockInterval) clearInterval(clockInterval);
      if (resizeObserver) resizeObserver.disconnect();
      unsubscribeCrosshair();
      unsubInterval();
      unsubSymbol();
      unsubLazyLoad();
      unsubPan();
      unsubZoom();
      if (widget && !widget.isDestroyed) {
        widget.destroy();
      }
      widgetRef.current = null;
      markersLayerRef.current = null;
      lastRenderedWidgetRef.current = null;
      lastRenderedBarsRef.current = null;
    };
  }, []);

  // Sync external symbol prop to widget
  useEffect(() => {
    if (!widgetRef.current || widgetRef.current.isDestroyed || !symbol) return;
    try {
      if (widgetRef.current.symbol() !== symbol) {
        lastSymbolRef.current = symbol;
        widgetRef.current.setSymbol(symbol);
      }
    } catch (err) {
      console.warn('Error syncing symbol to widget:', err);
    }
  }, [symbol]);

  // Sync external timeframe prop to widget
  useEffect(() => {
    if (!widgetRef.current || widgetRef.current.isDestroyed || !timeframe) return;
    try {
      if (widgetRef.current.interval() !== timeframe) {
        widgetRef.current.setInterval(timeframe);
        setActiveInterval(timeframe);
      }
    } catch (err) {
      console.warn('Error syncing interval to widget:', err);
    }
  }, [timeframe]);

  // 2. Feed Bars to Widget Series with seamless prepend and viewport preservation
  useEffect(() => {
    if (!widgetRef.current || widgetRef.current.isDestroyed || activeBars.length === 0 || isLoading) return;

    const currentSymbolTf = `${symbol}_${timeframe}`;
    const isSameWidget = lastRenderedWidgetRef.current === widgetRef.current;
    const isSameBars = lastRenderedBarsRef.current === activeBars;
    const isSameSymbolTf = lastRenderedSymbolTfRef.current === currentSymbolTf;

    // Only skip if the exact same widget has already rendered the exact same bars
    if (isSameWidget && isSameBars && isSameSymbolTf) {
      if (!isChartReady && activeBars.length > 0) {
        setIsChartReady(true);
      }
      return;
    }

    try {
      const prevBars = lastRenderedBarsRef.current || [];

      // Detect if this update is prepending older bars to existing history (LoD paging backward)
      const isPrepend =
        isSameWidget &&
        isSameSymbolTf &&
        prevBars.length > 0 &&
        activeBars.length > prevBars.length &&
        activeBars[activeBars.length - 1].time === prevBars[prevBars.length - 1].time &&
        activeBars[0].time < prevBars[0].time;

      // Detect if this update is appending newer bars (LoD paging forward or replay advancing)
      const isAppend =
        isSameWidget &&
        isSameSymbolTf &&
        prevBars.length > 0 &&
        activeBars.length > prevBars.length &&
        activeBars[0].time === prevBars[0].time &&
        activeBars[activeBars.length - 1].time > prevBars[prevBars.length - 1].time;

      // Detect if this update is stepping backward or seeking backward in replay
      const isStepBack =
        isSameWidget &&
        isSameSymbolTf &&
        prevBars.length > 0 &&
        activeBars.length < prevBars.length &&
        activeBars[0].time === prevBars[0].time;

      // Detect if this update is an intra-bar candle update (same bar count, updating forming candle)
      const isIntraBarUpdate =
        isSameWidget &&
        isSameSymbolTf &&
        prevBars.length > 0 &&
        activeBars.length === prevBars.length &&
        activeBars[0].time === prevBars[0].time;

      if (isPrepend) {
        const addedCount = activeBars.length - prevBars.length;
        const olderBars = activeBars.slice(0, addedCount);

        if (typeof widgetRef.current.series.prependData === 'function') {
          widgetRef.current.series.prependData(olderBars);
        } else {
          widgetRef.current.series.setData(activeBars);
        }
      } else if (isAppend || isIntraBarUpdate || isStepBack) {
        // Clean dataset sync: keep price line in view if scale was manually resized
        const latest = activeBars[activeBars.length - 1];
        keepPriceInView(widgetRef.current, latest);
        widgetRef.current.series.setData(activeBars);
        try {
          widgetRef.current?.series?.applyOptions?.({
            priceLineVisible: true,
            lastValueVisible: true,
            color: '#38bdf8',
            lineWidth: 1,
            lineStyle: 'solid',
          });
        } catch {}
        setIsChartReady(true);
      } else {
        // Dataset replaced: initial load or timeframe / symbol switch -> reset scale to fit active bars
        widgetRef.current.series.setData(activeBars);
        try {
          widgetRef.current?.series?.applyOptions?.({
            priceLineVisible: true,
            lastValueVisible: true,
            color: '#38bdf8',
            lineWidth: 1,
            lineStyle: 'solid',
          });
        } catch {}

        widgetRef.current.chart.resetScale();
        applyComfortableRightMargin(widgetRef.current);
        requestAnimationFrame(() => {
          if (widgetRef.current && !widgetRef.current.isDestroyed) {
            widgetRef.current.chart.resetScale();
            applyComfortableRightMargin(widgetRef.current);
            setIsChartReady(true);
          }
        });

        // Backup tick to ensure layout is 100% painted
        setTimeout(() => {
          if (widgetRef.current && !widgetRef.current.isDestroyed) {
            widgetRef.current.chart.resetScale();
            applyComfortableRightMargin(widgetRef.current);
            setIsChartReady(true);
          }
        }, 60);
      }

      lastRenderedBarsRef.current = activeBars;
      lastRenderedWidgetRef.current = widgetRef.current;
      lastRenderedSymbolTfRef.current = currentSymbolTf;
      lastSymbolRef.current = symbol;
      notifyScaleChange();
    } catch (err) {
      console.warn('Error syncing series data to OpenAlgo widget:', err);
    }
  }, [activeBars, symbol, timeframe, isLoading, notifyScaleChange]);

  // 3. Attach Trade Markers
  useEffect(() => {
    if (!markersLayerRef.current) return;
    try {
      if (activeTrades && activeTrades.length > 0 && activeBars.length > 0) {
        const currentMaxTime = activeBars[activeBars.length - 1].time;
        const markers = buildOpenAlgoTradeMarkers(activeTrades, activeBars, currentMaxTime);
        markersLayerRef.current.setMarkers(markers);
      } else {
        markersLayerRef.current.setMarkers([]);
      }
    } catch (err) {
      console.warn('Error updating trade markers:', err);
    }
  }, [activeTrades, activeBars]);

  // 4. Synchronize Institutional Position Boxes (TradingView Long/Short Position Tool with R:R header)
  const managedPosDrawingIdsRef = useRef<Set<string>>(new Set());


  useEffect(() => {
    if (!widgetRef.current) return;
    const drawCtrl = (widgetRef.current as any).draw;
    if (!drawCtrl || typeof drawCtrl.add !== 'function') return;

    if (!activeTrades || activeTrades.length === 0 || activeBars.length === 0) {
      for (const id of managedPosDrawingIdsRef.current) {
        try {
          drawCtrl.remove(id);
        } catch {}
      }
      managedPosDrawingIdsRef.current.clear();
      return;
    }

    const currentBarTime = activeBars[activeBars.length - 1].time;
    const currentActiveIds = new Set<string>();

    for (const trade of activeTrades) {
      let entrySec = typeof trade.entryTime === 'number'
        ? (trade.entryTime > 1e11 ? Math.floor(trade.entryTime / 1000) : Math.floor(trade.entryTime))
        : 0;
      if (!entrySec && trade.entryTime) {
        let s = String(trade.entryTime).trim().replace(/\./g, '-').replace(' ', 'T');
        if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
        const ms = new Date(s).getTime();
        entrySec = isNaN(ms) ? 0 : Math.floor(ms / 1000);
      }

      // Only display positions that have opened
      if (entrySec > currentBarTime) continue;

      let exitSec = typeof trade.exitTime === 'number'
        ? (trade.exitTime > 1e11 ? Math.floor(trade.exitTime / 1000) : Math.floor(trade.exitTime))
        : 0;
      if (!exitSec && trade.exitTime) {
        let s = String(trade.exitTime).trim().replace(/\./g, '-').replace(' ', 'T');
        if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
        const ms = new Date(s).getTime();
        exitSec = isNaN(ms) ? 0 : Math.floor(ms / 1000);
      }

      // The position box is placed the moment the position opens, spanning across the planned trade setup
      const endSec = Math.max(exitSec, entrySec + 60);
      const isLong = trade.side === 'LONG';
      const tool = isLong ? 'long-position' : 'short-position';
      const drawingId = `pos_${trade.id}`;
      currentActiveIds.add(drawingId);

      // Calculate Target and Stop Loss levels
      const entryPrice = trade.entryPrice;
      let targetPrice = trade.takeProfit;
      let stopPrice = trade.stopLoss;

      const isBE = Boolean(trade.isBreakEven) || (stopPrice !== undefined && Math.abs(stopPrice - entryPrice) <= entryPrice * 0.0002);

      // If trade is break-even or stop loss was moved to entry price, preserve initial planned risk height
      if (isBE) {
        stopPrice = trade.initialStopLoss ?? (isLong ? entryPrice - (entryPrice * 0.003) : entryPrice + (entryPrice * 0.003));
      }

      if (!targetPrice || !stopPrice) {
        const diff = Math.abs(trade.exitPrice - entryPrice) > (entryPrice * 0.0002)
          ? Math.abs(trade.exitPrice - entryPrice)
          : (entryPrice * 0.003);
        if (trade.pnl >= 0) {
          if (!targetPrice) targetPrice = isLong ? entryPrice + diff : entryPrice - diff;
          if (!stopPrice) stopPrice = isLong ? entryPrice - (diff / 2.0) : entryPrice + (diff / 2.0); // 2:1 R:R
        } else {
          if (!stopPrice) stopPrice = isLong ? entryPrice - diff : entryPrice + diff;
          if (!targetPrice) targetPrice = isLong ? entryPrice + (diff * 2.0) : entryPrice - (diff * 2.0); // 2:1 R:R
        }
      }

      const points = [
        { time: entrySec, price: entryPrice },
        { time: endSec, price: targetPrice },
        { time: endSec, price: stopPrice },
      ];

      const drawingDef = {
        id: drawingId,
        tool,
        points,
        props: {
          showHeader: true,       // "Short R:R 2.00" / "Long R:R 2.00" (Checked in Pic 3)
          showLossSize: false,     // Remove Loss / Size (Crossed out in Pic 3)
          showTargetLabel: false,  // Remove Target % (Crossed out in Pic 3)
          showStopLabel: false,    // Remove Stop % (Crossed out in Pic 3)
          showPrices: false,       // Clean chart without redundant prices
          profitColor: 'rgba(34, 197, 94, 0.22)',
          lossColor: 'rgba(239, 68, 68, 0.22)',
        },
        style: {
          showLabels: true,
          fillOpacity: 0.18,
          color: '#38bdf8', // Cyan entry line
          lineWidth: 1.5,
          lineStyle: 'solid',
        },
      };

      try {
        const existing = drawCtrl.get(drawingId);
        if (existing) {
          drawCtrl.update(drawingId, { points });
        } else {
          drawCtrl.add(drawingDef);
        }
      } catch (err) {
        console.warn('Could not sync position drawing:', err);
      }
    }

    // Remove any positions that are no longer active (e.g. stepped back in replay)
    for (const prevId of managedPosDrawingIdsRef.current) {
      if (!currentActiveIds.has(prevId)) {
        try {
          drawCtrl.remove(prevId);
        } catch {}
      }
    }
    managedPosDrawingIdsRef.current = currentActiveIds;
  }, [activeTrades, activeBars]);

  // 5. Replay Animation Loop driven by timestamp (and sub-steps when buildCandles is on)
  useEffect(() => {
    if (!isPlaying) return;

    // Direct replay speed (1x to 50x) preserving timing parameters
    const effectiveSpeed = Math.max(1, Math.min(50, replaySpeed));
    const targetInterval = Math.floor(1000 / (effectiveSpeed * 4));
    const intervalMs = Math.max(16, targetInterval);
    // If target interval is faster than the ~16ms browser clamp, advance multiple sub-steps per tick
    const stepsPerTick = (buildCandles && subConfig && targetInterval < 16)
      ? Math.max(1, Math.round(16 / Math.max(1, targetInterval)))
      : 1;

    const timer = setInterval(() => {
      if (bars.length === 0) return;

      if (buildCandles && subConfig) {
        setCurrentSubIndex((prevSub) => {
          const pIdx = replayTimeRef.current !== null ? findIndexForTime(bars, replayTimeRef.current) : 0;

          let remaining = stepsPerTick;
          let curSub = prevSub;
          let currentPIdx = pIdx;

          while (remaining > 0) {
            const maxSteps = subConfig.expectedSteps || 4;

            if (curSub + remaining < maxSteps) {
              curSub += remaining;
              remaining = 0;
            } else {
              // Complete current parent candle and advance to next
              const used = maxSteps - curSub;
              remaining -= used;
              curSub = 0;
              currentPIdx += 1;
              if (currentPIdx >= bars.length - 1) {
                setIsPlaying(false);
                currentPIdx = bars.length - 1;
                remaining = 0;
                break;
              }
            }
          }

          if (bars[currentPIdx]) {
            const maxSteps = subConfig.expectedSteps || 4;
            const stepSec = Math.floor(getTimeframeSeconds(timeframe) / maxSteps);
            const calculatedExactTime = bars[currentPIdx].time + (curSub * stepSec);
            setReplayTime(calculatedExactTime);
          }
          return curSub;
        });
        return;
      }

      setReplayTime((prevTime) => {
        const currentIdx = prevTime !== null ? findIndexForTime(bars, prevTime) : Math.min(4, bars.length - 1);
        if (currentIdx >= bars.length - 1) {
          setIsPlaying(false);
          return prevTime;
        }
        return bars[currentIdx + 1].time;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, replaySpeed, bars, buildCandles, subConfig]);

  const handlePlayToggle = useCallback(() => {
    if (bars.length === 0 || isCompleted) return;
    // A strategy that is done would never start over except if the user decides (via reset)
    if (replayIndex >= bars.length - 1) {
      setIsPlaying(false);
      return;
    }
    if (replayTimeRef.current === null) {
      const curIdx = Math.min(bars.length - 1, Math.max(0, replayIndex));
      setReplayTime(bars[curIdx].time);
    }
    setIsPlaying((prev) => !prev);
  }, [bars, replayIndex, isCompleted]);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    if (bars.length === 0 || isCompleted || replayIndex >= bars.length - 1) return;

    if (buildCandles && subConfig) {
      const maxSteps = subConfig.expectedSteps || 4;
      const stepDuration = Math.floor(getTimeframeSeconds(timeframe) / maxSteps);
      if (currentSubIndex + 1 < maxSteps) {
        const nextSub = currentSubIndex + 1;
        setCurrentSubIndex(nextSub);
        const pTime = bars[replayIndex]?.time || 0;
        setReplayTime(pTime + (nextSub * stepDuration));
        return;
      }
      if (replayIndex < bars.length - 1) {
        const nextIdx = replayIndex + 1;
        setReplayTime(bars[nextIdx].time);
        setCurrentSubIndex(0);
      }
      return;
    }

    const nextIdx = Math.min(bars.length - 1, replayIndex + 1);
    setReplayTime(bars[nextIdx].time);
  }, [bars, replayIndex, buildCandles, subConfig, currentSubIndex, timeframe, isCompleted]);

  const handleStepBackward = useCallback(() => {
    setIsPlaying(false);
    if (bars.length === 0) return;

    if (buildCandles && subConfig) {
      const maxSteps = subConfig.expectedSteps || 4;
      const stepDuration = Math.floor(getTimeframeSeconds(timeframe) / maxSteps);
      if (currentSubIndex > 0) {
        const prevSub = currentSubIndex - 1;
        setCurrentSubIndex(prevSub);
        const pTime = bars[replayIndex]?.time || 0;
        setReplayTime(pTime + (prevSub * stepDuration));
        return;
      }
      if (replayIndex > 0) {
        const prevIdx = replayIndex - 1;
        const prevMax = subConfig.expectedSteps || 4;
        const prevSub = Math.max(0, prevMax - 1);
        setCurrentSubIndex(prevSub);
        const pTime = bars[prevIdx].time;
        setReplayTime(pTime + (prevSub * stepDuration));
      }
      return;
    }

    const prevIdx = Math.max(0, replayIndex - 1);
    setReplayTime(bars[prevIdx].time);
  }, [bars, replayIndex, buildCandles, subConfig, currentSubIndex, timeframe]);

  const handleCandleForward = useCallback(() => {
    setIsPlaying(false);
    if (bars.length === 0 || isCompleted || replayIndex >= bars.length - 1) return;
    const nextIdx = Math.min(bars.length - 1, replayIndex + 1);
    setReplayTime(bars[nextIdx].time);
    setCurrentSubIndex(0);
  }, [bars, replayIndex, isCompleted]);

  const handleCandleBackward = useCallback(() => {
    setIsPlaying(false);
    if (bars.length === 0) return;
    const prevIdx = Math.max(0, replayIndex - 1);
    setReplayTime(bars[prevIdx].time);
    setCurrentSubIndex(0);
  }, [bars, replayIndex]);

  const handleSeek = useCallback(
    (idx: number) => {
      setIsPlaying(false);
      if (bars.length === 0) return;
      const clamped = Math.max(0, Math.min(bars.length - 1, idx));
      setReplayTime(bars[clamped].time);
      setCurrentSubIndex(0);
    },
    [bars]
  );

  const handleToggleBuildCandles = useCallback((enabled: boolean) => {
    setBuildCandles(enabled);
    if (!enabled) {
      setCurrentSubIndex(0);
    }
  }, []);

  const subStepLabel = useMemo(() => {
    if (!buildCandles || !subConfig) return undefined;
    const maxSteps = subConfig.expectedSteps || 4;
    const stepNum = Math.min(currentSubIndex + 1, maxSteps);
    return `${stepNum}/${maxSteps} (${subConfig.label})`;
  }, [buildCandles, subConfig, currentSubIndex]);

  const displayTime = hoveredBar?.time || (activeBars.length > 0 ? activeBars[activeBars.length - 1].time : null);
  const formattedDate = displayTime
    ? new Date(displayTime * 1000).toISOString().replace('T', ' ').substring(0, 19)
    : '';

  return (
    <div className={`w-full h-full flex flex-col bg-[#0D0E12] select-none relative overflow-hidden font-mono ${isRailCollapsed ? 'oac-rail-collapsed' : ''}`}>
      {/* 0. LEFT-SIDE DRAWING RAIL COLLAPSE / EXPAND TOGGLE BUTTON */}
      {isRailCollapsed ? (
        <button
          type="button"
          onClick={toggleRail}
          className="absolute left-1 top-11 z-30 flex items-center gap-1 px-1.5 py-1 rounded bg-[#131924]/90 hover:bg-[#1E293B] border border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-[11px] font-mono shadow-md backdrop-blur-sm transition-all"
          title="Open Drawing Tools"
        >
          <Pencil className="w-3.5 h-3.5 text-cyan-400" />
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      ) : (
        <button
          type="button"
          onClick={toggleRail}
          className="absolute left-[44px] top-11 z-30 flex items-center justify-center w-6 h-6 rounded-r bg-[#131924]/95 hover:bg-[#1E293B] border border-l-0 border-slate-700/80 hover:border-cyan-500/50 text-slate-400 hover:text-white text-xs shadow-md backdrop-blur-sm transition-all"
          title="Collapse Drawing Tools"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 1A. DESKTOP: REPLAY TOOLS VIA PORTAL INTO TOPBAR SPACER */}
      {showReplayScrubber && bars.length > 0 && !isMobile && topbarSpacer && createPortal(
        <div className="flex items-center gap-2">
          <ReplayController
            currentIndex={replayIndex}
            totalBars={bars.length}
            isPlaying={isPlaying}
            speed={replaySpeed}
            currentTimestamp={formattedDate}
            buildCandles={buildCandles}
            subStepLabel={subStepLabel}
            isSubTimeframeAvailable={isSubTimeframeAvailable}
            isCompleted={isCompleted}
            onToggleBuildCandles={handleToggleBuildCandles}
            onPlayToggle={handlePlayToggle}
            onStepForward={handleStepForward}
            onStepBackward={handleStepBackward}
            onCandleForward={handleCandleForward}
            onCandleBackward={handleCandleBackward}
            onSeek={handleSeek}
            onSpeedChange={setReplaySpeed}
          />
        </div>,
        topbarSpacer
      )}

      {/* 1B. OPENALGO OFFICIAL TERMINAL WIDGET MOUNT ROOT */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 relative overflow-hidden"
      />

      {/* 1C. MOBILE: DOCKED BOTTOM REPLAY BAR (CLEAN, SOLID, NO SEEK BAR) */}
      {showReplayScrubber && bars.length > 0 && isMobile && (
        <div className="w-full shrink-0 h-10 bg-[#0A0E17] border-t border-[#1C2536] px-2.5 flex items-center justify-between text-xs font-mono z-20 select-none shadow-md">
          {/* Left Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={handlePlayToggle}
              disabled={isCompleted || replayIndex >= bars.length - 1}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-black font-bold shadow-sm transition-all"
              title={isPlaying ? 'Pause' : isCompleted || replayIndex >= bars.length - 1 ? 'Replay Completed' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
            </button>

            {/* Previous Candle */}
            <button
              type="button"
              onClick={handleCandleBackward}
              disabled={replayIndex <= 0}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-[#131924] hover:bg-slate-800 disabled:opacity-20 text-slate-400 hover:text-white transition-colors"
              title="Previous Candle"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Step Backward */}
            <button
              type="button"
              onClick={handleStepBackward}
              disabled={replayIndex <= 0}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-[#131924] hover:bg-slate-800 disabled:opacity-20 text-slate-300 hover:text-white transition-colors"
              title="Step Backward"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Step Forward */}
            <button
              type="button"
              onClick={handleStepForward}
              disabled={
                replayIndex >= bars.length - 1 &&
                (!buildCandles ||
                  !subConfig ||
                  currentSubIndex >= (subConfig.expectedSteps || 4) - 1)
              }
              className="w-7 h-7 rounded-md flex items-center justify-center bg-[#131924] hover:bg-slate-800 disabled:opacity-20 text-slate-300 hover:text-white transition-colors"
              title="Step Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Next Candle */}
            <button
              type="button"
              onClick={handleCandleForward}
              disabled={replayIndex >= bars.length - 1}
              className="w-7 h-7 rounded-md flex items-center justify-center bg-[#131924] hover:bg-slate-800 disabled:opacity-20 text-slate-400 hover:text-white transition-colors"
              title="Next Candle"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Speed Selector (Cycles 1x -> 2x -> 5x -> 10x -> 25x -> 50x) */}
            <button
              type="button"
              onClick={() => {
                const speeds = [1, 2, 5, 10, 25, 50];
                const next = speeds[(speeds.indexOf(replaySpeed) + 1) % speeds.length];
                setReplaySpeed(next);
              }}
              className="h-7 px-2 rounded-md bg-[#131924] hover:bg-slate-800 border border-[#202A38] text-cyan-400 font-bold text-[11px] flex items-center transition-colors"
              title="Replay Speed (Click to cycle 1x, 2x, 5x, 10x, 25x, 50x)"
            >
              {replaySpeed}x
            </button>
          </div>

          {/* Right Controls: Timestamp */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Date (no candle counter) */}
            <div className="flex items-center min-w-0 font-mono pl-1">
              <span className="text-[10px] text-slate-200 tabular-nums truncate max-w-[110px]">
                {formattedDate ? formattedDate.substring(5, 16) : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. LOADING OVERLAY (ONLY WHEN NO BARS LOADED) */}
      {bars.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#080B10] select-none">
          {isLoading || !isChartReady ? (
            <QuantLoader size="md" label="Loading..." />
          ) : (
            <div className="flex flex-col items-center space-y-2 text-center px-4">
              <div className="text-xs font-mono text-slate-400 font-medium tracking-wider">
                No data available
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIVE TIMEFRAME/DATA SWITCH CHIP */}
      {isChartReady && isLoading && bars.length > 0 && (
        <div className="absolute top-12 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161B26]/90 border border-cyan-500/30 shadow-lg pointer-events-none backdrop-blur-sm">
          <QuantLoaderIcon size={16} />
          <span className="text-[11px] font-mono text-cyan-300 font-medium">Updating {timeframe}...</span>
        </div>
      )}
    </div>
  );
};

export const OpenAlgoChart = memo(OpenAlgoChartComponent);
