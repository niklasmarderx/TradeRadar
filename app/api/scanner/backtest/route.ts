import { NextResponse } from "next/server";
import { loadArchive } from "@/lib/scanner";
import { backtest, calculateBacktestStats } from "@/lib/backtesting";
import { fetchQuote } from "@/lib/api/yahoo-finance";
import { getCached, setCache } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BACKTEST_CACHE_KEY = "scanner-backtest";
const BACKTEST_TTL = 4 * 60 * 60 * 1000; // 4 hours

/**
 * GET /api/scanner/backtest
 * Runs a backtest on archived scanner picks.
 * Query params:
 *   ?days=30   — how many days of archives to backtest (default 30)
 *   ?force=true — bypass cache
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);
    const force = url.searchParams.get("force") === "true";

    if (!force) {
      const cached = await getCached<unknown>(BACKTEST_CACHE_KEY, BACKTEST_TTL);
      if (cached) return NextResponse.json({ ...cached as Record<string, unknown>, fromCache: true });
    }

    const archives = await loadArchive(days);
    if (archives.length === 0) {
      return NextResponse.json({ error: "Keine Archive vorhanden", results: [], stats: null });
    }

    // Collect unique tickers from archives
    const tickers = new Set<string>();
    for (const snap of archives) {
      for (const r of snap.results) {
        if (r.signal !== "HOLD" && r.qualityScore >= 30) {
          tickers.add(r.ticker);
        }
      }
    }

    // Fetch current prices in batches
    const priceMap = new Map<string, number>();
    const tickerArray = [...tickers];
    for (let i = 0; i < tickerArray.length; i += 5) {
      const batch = tickerArray.slice(i, i + 5);
      const quotes = await Promise.all(batch.map((t) => fetchQuote(t).catch(() => null)));
      for (let j = 0; j < batch.length; j++) {
        if (quotes[j]?.priceEur) {
          priceMap.set(batch[j], quotes[j]!.priceEur);
        }
      }
    }

    const results = backtest(archives, priceMap);
    const stats = calculateBacktestStats(results);

    const response = {
      archiveDays: archives.length,
      tickersEvaluated: priceMap.size,
      results: results.slice(0, 100), // Cap for response size
      stats,
      backtestAt: new Date().toISOString(),
    };

    await setCache(BACKTEST_CACHE_KEY, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Backtest error:", error);
    return NextResponse.json(
      { error: "Backtest fehlgeschlagen", details: String(error) },
      { status: 500 },
    );
  }
}
