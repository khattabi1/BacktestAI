import type { OpenAlgoBar } from './types';

export interface DataManagerConfig {
  apiBaseUrl?: string;
  defaultLookbackBars?: number;
}

export interface TimeframeCacheEntry {
  symbol: string;
  timeframe: string;
  startSec: number;
  endSec: number;
  bars: OpenAlgoBar[];
  lastUpdated: number;
}

export interface GetBarsOptions {
  symbol: string;
  timeframe: string;
  anchorTimeSec?: number | null;
  sessionStartDate?: string | null;
  forceRefresh?: boolean;
}

export interface GetBarsResult {
  bars: OpenAlgoBar[];
  anchorIndex: number;
  anchorTimeSec: number;
  isFromCache: boolean;
}

export interface SubTimeframeConfig {
  subTf: string;
  expectedSteps: number;
  label: string;
}

export function getSubTimeframeConfig(parentTf: string): SubTimeframeConfig | null {
  switch (parentTf.toLowerCase()) {
    case '5m':
      return { subTf: '1m', expectedSteps: 5, label: '1m' };
    case '15m':
      return { subTf: '1m', expectedSteps: 15, label: '1m' };
    case '30m':
      return { subTf: '5m', expectedSteps: 6, label: '5m' };
    case '1h':
      return { subTf: '5m', expectedSteps: 12, label: '5m' };
    case '4h':
      return { subTf: '15m', expectedSteps: 16, label: '15m' };
    case '1d':
    case 'd':
      return { subTf: '1h', expectedSteps: 24, label: '1h' };
    case '1w':
    case 'w':
      return { subTf: '1d', expectedSteps: 7, label: '1d' };
    default:
      return null;
  }
}

/**
 * Returns candle duration in seconds for standard timeframes
 */
export function getTimeframeSeconds(tf: string): number {
  switch (tf.toLowerCase()) {
    case '1m':
      return 60;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '30m':
      return 1800;
    case '1h':
      return 3600;
    case '4h':
      return 14400;
    case '1d':
    case 'd':
      return 86400;
    case '1w':
    case 'w':
      return 604800;
    default:
      return 3600;
  }
}

/**
 * Calculates exact Broker Time timestamp given bar open time and sub-step index
 */
export function calculateExactBrokerTime(
  barStartTime: number,
  subIndex: number,
  tf: string,
  isSubActive: boolean
): number {
  if (!isSubActive) return barStartTime;
  const config = getSubTimeframeConfig(tf);
  if (!config) return barStartTime;
  const totalSec = getTimeframeSeconds(tf);
  const stepSec = Math.floor(totalSec / config.expectedSteps);
  return barStartTime + (subIndex * stepSec);
}

/**
 * Calculates the exact sub-step index for a forming candle given exact Broker Time
 */
export function calculateSubIndexFromBrokerTime(
  barStartTime: number,
  exactTime: number,
  tf: string
): number {
  const config = getSubTimeframeConfig(tf);
  if (!config) return 0;
  const elapsed = Math.max(0, exactTime - barStartTime);
  const totalSec = getTimeframeSeconds(tf);
  const stepSec = Math.floor(totalSec / config.expectedSteps);
  if (stepSec <= 0) return 0;
  const step = Math.floor(elapsed / stepSec);
  return Math.min(config.expectedSteps - 1, Math.max(0, step));
}

/**
 * Returns historical lookback in seconds prior to current replay time.
 * Provides ~500 bars of historical context before anchor time.
 */
export function getTimeframeLookbackSec(tf: string, lookbackBars = 500): number {
  return lookbackBars * getTimeframeSeconds(tf);
}

/**
 * Returns forward replay candle headroom limit.
 */
export function getTimeframeFetchLimit(tf: string): number {
  switch (tf.toLowerCase()) {
    case '1m':
      return 10000; // ~7 days of continuous 1-minute replay forward
    case '5m':
      return 8000;  // ~28 days forward
    case '15m':
      return 6000;  // ~62 days forward
    case '30m':
      return 4000;  // ~83 days forward
    case '1h':
      return 3000;  // ~125 days forward
    case '4h':
      return 2000;  // ~333 days forward
    case '1d':
    case 'd':
      return 1000;  // ~3+ years forward
    default:
      return 5000;
  }
}

/**
 * Professional Frontend Replay Data Manager
 * - Manages multi-timeframe caching with temporal window verification
 * - Single immutable Broker Time reference
 * - Forward-biased weekend gap protection
 * - Sanitizes, deduplicates, and validates monotonic candle sequences
 */
export class ReplayDataManager {
  private cache = new Map<string, TimeframeCacheEntry>();
  private currentAnchorTimeSec: number | null = null;
  private apiBaseUrl: string;
  private defaultLookbackBars: number;

  constructor(config: DataManagerConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl || '';
    this.defaultLookbackBars = config.defaultLookbackBars || 500;
  }

  /**
   * Updates the active replay temporal position in O(1) time without re-fetching
   */
  public updateReplayTime(timeSec: number | null): void {
    if (timeSec && timeSec > 0) {
      this.currentAnchorTimeSec = timeSec;
    }
  }

  /**
   * Returns current anchor replay timestamp in Broker Time
   */
  public getReplayTime(): number | null {
    return this.currentAnchorTimeSec;
  }

  /**
   * Generates a unique cache key for symbol and timeframe
   */
  private getCacheKey(symbol: string, timeframe: string): string {
    return `${symbol.toUpperCase()}_${timeframe.toLowerCase()}`;
  }

  /**
   * Binary search for exact temporal anchor index.
   * Forward-biased gap guard: If targetTimeSec falls on a Monday/session open
   * but market opens later in the day, clamps forward to Monday open instead of jumping back to Friday!
   */
  public findAnchorIndex(bars: OpenAlgoBar[], targetTimeSec: number): number {
    if (bars.length === 0) return 0;
    if (targetTimeSec <= bars[0].time) return 0;
    if (targetTimeSec >= bars[bars.length - 1].time) return bars.length - 1;

    let low = 0;
    let high = bars.length - 1;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (bars[mid].time <= targetTimeSec) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Weekend / Session Gap Guard:
    // If best points to Friday (gap to next bar is > 36 hours) and targetTimeSec
    // is closer to the Monday opening bar (best + 1), choose Monday opening bar!
    if (best < bars.length - 1) {
      const currentBarTime = bars[best].time;
      const nextBarTime = bars[best + 1].time;
      const gapSec = nextBarTime - currentBarTime;

      // Detected weekend or session gap (> 36 hours)
      if (gapSec >= 36 * 3600) {
        // If targetTimeSec is beyond Friday close (more than 4 hours after Friday candle),
        // snap forward to Monday opening bar instead of dragging back to Friday!
        if (targetTimeSec - currentBarTime > 4 * 3600) {
          best = best + 1;
        }
      }
    }

    return best;
  }

  /**
   * Sanitizes, sorts, and deduplicates raw bars into a pure monotonic sequence.
   * Ensures high >= max(open, close), low <= min(open, close), and filters corrupted records.
   */
  public sanitizeBars(raw: any[]): OpenAlgoBar[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    const mapped: OpenAlgoBar[] = [];

    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      let sec: number;
      if (typeof b.time === 'number') {
        sec = b.time > 1e11 ? Math.floor(b.time / 1000) : Math.floor(b.time);
      } else if (typeof b.timestamp === 'number') {
        sec = b.timestamp > 1e11 ? Math.floor(b.timestamp / 1000) : Math.floor(b.timestamp);
      } else if (b.timestamp) {
        sec = Math.floor(new Date(b.timestamp).getTime() / 1000);
      } else {
        continue;
      }

      if (isNaN(sec) || sec <= 0) continue;

      const open = Number(b.open);
      let high = Number(b.high);
      let low = Number(b.low);
      const close = Number(b.close);
      const volume = Number(b.volume || b.tick_volume || 0);

      if (isNaN(open) || isNaN(close) || open <= 0 || close <= 0) continue;

      // Price sanity enforcement
      high = Math.max(isNaN(high) ? open : high, open, close);
      low = Math.min(isNaN(low) ? open : low, open, close);

      mapped.push({
        time: sec,
        open,
        high,
        low,
        close,
        volume: isNaN(volume) ? 0 : volume,
      });
    }

    if (mapped.length === 0) return [];

    // Sort chronologically ascending
    mapped.sort((a, b) => a.time - b.time);

    // Deduplicate identical timestamps (take the latest bar in case of conflict)
    const deduped: OpenAlgoBar[] = [mapped[0]];
    for (let i = 1; i < mapped.length; i++) {
      const current = mapped[i];
      const prev = deduped[deduped.length - 1];
      if (current.time === prev.time) {
        deduped[deduped.length - 1] = current;
      } else if (current.time > prev.time) {
        deduped.push(current);
      }
    }

    return deduped;
  }

  /**
   * Retrieves market bars for replay with automatic caching, lookback centering,
   * and precision anchor calculation.
   */
  public async getBarsForReplay(options: GetBarsOptions): Promise<GetBarsResult> {
    const { symbol, timeframe, sessionStartDate, forceRefresh } = options;
    const targetAnchor = options.anchorTimeSec ?? this.currentAnchorTimeSec;
    const cacheKey = this.getCacheKey(symbol, timeframe);
    const barSec = getTimeframeSeconds(timeframe);

    // 1. Check in-memory cache if not forced refresh
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.bars.length > 0) {
        // Safe cache hit if anchor is safely between start and end (with at least 50 forward bars)
        if (
          !targetAnchor ||
          (targetAnchor >= cached.startSec && targetAnchor <= cached.endSec - 50 * barSec)
        ) {
          const anchorIdx = targetAnchor
            ? this.findAnchorIndex(cached.bars, targetAnchor)
            : Math.min(4, cached.bars.length - 1);

          // CRITICAL: NEVER degrade the precise targetAnchor to the bar open time!
          const finalAnchorTime = targetAnchor && targetAnchor > 0 ? targetAnchor : cached.bars[anchorIdx].time;
          this.currentAnchorTimeSec = finalAnchorTime;

          return {
            bars: [...cached.bars], // Shallow copy guarantees React re-render
            anchorIndex: anchorIdx,
            anchorTimeSec: finalAnchorTime,
            isFromCache: true,
          };
        }
      }
    }

    // 2. Fetch centered window from DuckDB backend API
    const limit = getTimeframeFetchLimit(timeframe);
    let queryStart: string;

    if (targetAnchor && targetAnchor > 0) {
      const lookbackSec = getTimeframeLookbackSec(timeframe, this.defaultLookbackBars);
      const startSec = Math.max(0, targetAnchor - lookbackSec);
      queryStart = new Date(startSec * 1000).toISOString();
    } else {
      queryStart = sessionStartDate || '2023-01-01T00:00:00Z';
    }

    const params = new URLSearchParams({
      symbol,
      timeframe,
      limit: String(limit),
      start_date: queryStart,
    });

    const url = `${this.apiBaseUrl}/api/v1/market-data/bars?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      let bars = this.sanitizeBars(raw);

      // Fallback query if date window yielded no partitions
      if (bars.length === 0) {
        const fallbackUrl = `${this.apiBaseUrl}/api/v1/market-data/bars?symbol=${symbol}&timeframe=${timeframe}&limit=2000`;
        const fbRes = await fetch(fallbackUrl);
        const fbRaw = await fbRes.json();
        bars = this.sanitizeBars(fbRaw);
      }

      // Final synthetic safeguard to prevent empty screens
      if (bars.length === 0) {
        bars = this.generateSyntheticBars(500, symbol.includes('BTC') ? 65000 : 2650.0);
      }

      // Store sanitized bars in cache
      this.cache.set(cacheKey, {
        symbol,
        timeframe,
        startSec: bars[0].time,
        endSec: bars[bars.length - 1].time,
        bars,
        lastUpdated: Date.now(),
      });

      // Calculate exact anchor index
      const anchorIdx = targetAnchor
        ? this.findAnchorIndex(bars, targetAnchor)
        : Math.min(4, bars.length - 1);

      // CRITICAL: NEVER degrade the precise targetAnchor to the bar open time!
      const finalAnchorTime = targetAnchor && targetAnchor > 0 ? targetAnchor : bars[anchorIdx].time;
      this.currentAnchorTimeSec = finalAnchorTime;

      return {
        bars,
        anchorIndex: anchorIdx,
        anchorTimeSec: finalAnchorTime,
        isFromCache: false,
      };
    } catch (err) {
      console.error(`[ReplayDataManager] Failed to load ${symbol} ${timeframe}:`, err);
      const fallback = this.generateSyntheticBars(500, 2650.0);
      return {
        bars: fallback,
        anchorIndex: 4,
        anchorTimeSec: fallback[4].time,
        isFromCache: false,
      };
    }
  }

  /**
   * Generates clean synthetic market bars if completely offline
   */
  public generateSyntheticBars(count = 500, basePrice = 2650.0): OpenAlgoBar[] {
    const bars: OpenAlgoBar[] = [];
    const startSec = 1704067200; // 2024-01-01 00:00:00 UTC
    let currentPrice = basePrice;

    for (let i = 0; i < count; i++) {
      const time = startSec + i * 3600;
      const delta = Math.sin(i * 0.12) * 3.5 + (Math.random() - 0.49) * 4.0;
      const open = Number(currentPrice.toFixed(2));
      const close = Number((open + delta).toFixed(2));
      const high = Number((Math.max(open, close) + Math.random() * 2.5 + 0.2).toFixed(2));
      const low = Number((Math.min(open, close) - Math.random() * 2.5 - 0.2).toFixed(2));
      const volume = Math.floor(Math.random() * 800) + 150;

      bars.push({ time, open, high, low, close, volume });
      currentPrice = close;
    }
    return bars;
  }

  /**
   * Clears internal cache
   */
  public clearCache(symbol?: string): void {
    if (symbol) {
      const symUpper = symbol.toUpperCase();
      for (const key of this.cache.keys()) {
        if (key.startsWith(symUpper)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
