import { loadTradingData, getOrFetchStockData } from "@/lib/data";
import { calculateIndicators } from "@/lib/indicators";
import { getDailyPicksCached } from "@/lib/daily-picks";
import { scanQuick, getTopPicks } from "@/lib/scanner";
import { dailyPickToAction, scanResultToAction, fmt } from "@/lib/scan-helpers";
import type { Action } from "@/lib/types";
import ActionBoard from "@/components/ActionBoard";
import BatchAnalysis from "@/components/BatchAnalysis";
import LiveCryptoPanel from "@/components/LiveCryptoPanel";
import LiveNewsFeed from "@/components/LiveNewsFeed";
import NewsFeed from "@/components/NewsFeed";
import RiskPanel from "@/components/RiskPanel";
import Watchlist from "@/components/Watchlist";
import WatchlistAutoRefresh from "@/components/WatchlistAutoRefresh";
import ScannerAlerts from "@/components/ScannerAlerts";
import ScheduledScanner from "@/components/ScheduledScanner";

/**
 * Load actions for the ActionBoard:
 * 1. Try cached daily picks (fast, no scan triggered)
 * 2. Fallback: quick scan (~1-2 min, T1 + crypto)
 * 3. Last resort: static trading-data.json
 */
async function getScannerActions(): Promise<Action[]> {
  try {
    // 1. Try daily picks cache (read-only, never triggers a full scan)
    const snapshot = await getDailyPicksCached();
    if (snapshot && snapshot.picks.length > 0) {
      const addedTickers = new Set(snapshot.changelog.added.map((a) => a.ticker));
      const changedTickers = new Set(snapshot.changelog.changed.map((c) => c.ticker));

      return snapshot.picks.map((p) =>
        dailyPickToAction(p, addedTickers.has(p.ticker), changedTickers.has(p.ticker)),
      );
    }

    // 2. Fallback: quick scan (fast, cached 30min/4h)
    const results = await scanQuick();
    if (results.length > 0) {
      const picks = getTopPicks(results, 10);
      return [...picks.buys, ...picks.shorts].map(scanResultToAction);
    }

    return [];
  } catch (error) {
    console.error("Scanner failed, falling back to static data:", error);
    return [];
  }
}

export default async function Home() {
  const data = await loadTradingData();

  const scannerActions = await getScannerActions();

  let actionsForBoard: Action[];

  if (scannerActions.length > 0) {
    actionsForBoard = scannerActions;
  } else {
    // Fallback: enrich static actions with live data
    const stockDataArr = await Promise.all(
      data.actions.map((a) => getOrFetchStockData(a.ticker).catch(() => null))
    );

    actionsForBoard = data.actions.map((a, i) => {
      const sd = stockDataArr[i];
      if (!sd || sd.currentPrice === 0) {
        return { ...a, price: "Keine Daten", price_numeric: 0 };
      }

      const closes = sd.ohlcvData.map((d) => d.close);
      const volumes = sd.ohlcvData.map((d) => d.volume);
      const highs = sd.ohlcvData.map((d) => d.high);
      const lows = sd.ohlcvData.map((d) => d.low);
      const indicators = closes.length > 20 ? calculateIndicators(closes, volumes, highs, lows) : null;
      const cs = indicators?.compositeScore;

      return {
        ...a,
        price: `${fmt(sd.currentPrice)} €`,
        price_numeric: sd.currentPrice,
        signal: cs?.signal ?? a.signal,
        confidence: cs?.confidence ?? a.confidence,
        entry: cs ? `${fmt(cs.suggestedEntry)} €` : a.entry,
        target: cs ? `${fmt(cs.suggestedTarget)} €` : a.target,
        stop: cs ? `${fmt(cs.suggestedStop)} €` : a.stop,
        entry_numeric: cs?.suggestedEntry ?? a.entry_numeric,
        target_numeric: cs?.suggestedTarget ?? a.target_numeric,
        stop_numeric: cs?.suggestedStop ?? a.stop_numeric,
      };
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex-1"><Watchlist /></div>
        <WatchlistAutoRefresh />
      </div>

      <BatchAnalysis />

      <ScheduledScanner />
      <ScannerAlerts />

      <ActionBoard actions={actionsForBoard} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LiveCryptoPanel />
        <RiskPanel risks={data.risks} />
      </div>

      <LiveNewsFeed fallbackNews={data.news} />

      <section className="rounded-lg bg-card border border-card-border p-4">
        <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-2 section-header">
          Analyse
        </h2>
        <p className="text-sm text-foreground leading-relaxed mt-4">
          {data.analysis}
        </p>
      </section>
    </div>
  );
}
