import type { SeriesMarker } from 'openalgo-charts';
import type { ChartTrade, OpenAlgoBar } from './types';

function toUtcSeconds(timeVal: string | number): number {
  if (typeof timeVal === 'number') {
    return timeVal > 1e11 ? Math.floor(timeVal / 1000) : Math.floor(timeVal);
  }
  let s = String(timeVal).trim().replace(/\./g, '-').replace(' ', 'T');
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) s += 'Z';
  const ms = new Date(s).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

function snapToBar(barList: OpenAlgoBar[], targetSec: number): number | null {
  if (barList.length === 0) return null;
  const firstTime = barList[0].time;
  const lastTime = barList[barList.length - 1].time;

  // Approximate bar interval (minimum 60s)
  const barInterval = barList.length > 1 ? Math.max(60, barList[1].time - barList[0].time) : 60;

  // Strict boundary check: If trade timestamp is outside the loaded bar range, return null
  // We allow a 1-bar tolerance for intra-bar execution fills
  if (targetSec < firstTime - barInterval || targetSec > lastTime + barInterval) {
    return null;
  }

  if (targetSec <= firstTime) return firstTime;
  if (targetSec >= lastTime) return lastTime;

  let low = 0;
  let high = barList.length - 1;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (barList[mid].time <= targetSec) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return barList[best].time;
}

export function buildOpenAlgoTradeMarkers(
  trades: ChartTrade[],
  bars?: OpenAlgoBar[],
  currentMaxTime?: number
): SeriesMarker[] {
  const markers: SeriesMarker[] = [];
  const maxTime = currentMaxTime ?? (bars && bars.length > 0 ? bars[bars.length - 1].time : Infinity);

  for (const trade of trades) {
    const rawEntry = toUtcSeconds(trade.entryTime);
    const rawExit = toUtcSeconds(trade.exitTime);

    // Only place entry if it has opened
    if (rawEntry > maxTime) continue;

    const entrySec = bars && bars.length > 0 ? snapToBar(bars, rawEntry) : rawEntry;
    if (entrySec == null) {
      // Trade entry does not belong to the loaded bar window -> do NOT clamp onto arbitrary candle
      continue;
    }

    const isWin = trade.pnl >= 0;
    const pnlSign = isWin ? '+' : '';
    const formattedPnl = `${pnlSign}$${trade.pnl.toFixed(2)}`;

    const isBE = Boolean(trade.isBreakEven) || /be|breakeven|break_even/i.test(trade.exitReason || '');
    const exitLabel = isBE ? '[Exit: BE]' : trade.exitReason;
    const exitColor = isBE ? '#38BDF8' : (isWin ? '#22C55E' : '#EF4444');

    if (trade.side === 'LONG') {
      // Long Entry (placed below candle)
      markers.push({
        time: entrySec,
        position: 'belowBar',
        shape: 'arrowUp',
        size: 'small',
        color: '#22C55E', // Emerald
        text: `BUY @ ${trade.entryPrice.toFixed(2)}`,
        id: `entry_${trade.id}`,
      });

      // Long Exit (only placed once trade actually exits)
      if (rawExit <= maxTime) {
        const exitSec = bars && bars.length > 0 ? snapToBar(bars, rawExit) : rawExit;
        if (exitSec != null) {
          markers.push({
            time: exitSec,
            position: isBE ? 'aboveBar' : (isWin ? 'aboveBar' : 'belowBar'),
            shape: 'arrowDown',
            size: 'small',
            color: exitColor,
            text: `${exitLabel} (${formattedPnl})`,
            id: `exit_${trade.id}`,
          });
        }
      }
    } else {
      // Short Entry (placed above candle)
      markers.push({
        time: entrySec,
        position: 'aboveBar',
        shape: 'arrowDown',
        size: 'small',
        color: '#EF4444', // Red
        text: `SHORT @ ${trade.entryPrice.toFixed(2)}`,
        id: `entry_${trade.id}`,
      });

      // Short Exit (only placed once trade actually exits)
      if (rawExit <= maxTime) {
        const exitSec = bars && bars.length > 0 ? snapToBar(bars, rawExit) : rawExit;
        if (exitSec != null) {
          markers.push({
            time: exitSec,
            // When short hits Stop Loss, price went UP -> position aboveBar! When TP, price went DOWN -> belowBar!
            position: isBE ? 'aboveBar' : (isWin ? 'belowBar' : 'aboveBar'),
            shape: 'arrowUp',
            size: 'small',
            color: exitColor,
            text: `${exitLabel} (${formattedPnl})`,
            id: `exit_${trade.id}`,
          });
        }
      }
    }
  }

  // OpenAlgo Charts markers ordered chronologically
  return markers.sort((a, b) => a.time - b.time);
}
