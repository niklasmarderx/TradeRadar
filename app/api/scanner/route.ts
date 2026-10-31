import { NextResponse } from "next/server";
import { scanQuick, scanUniverse, getTopPicks, saveDailySnapshot, type ScanResult } from "@/lib/scanner";
import { getCached, setCache } from "@/lib/cache";
import { isValidTimeframe, type ScanTimeframe } from "@/lib/timeframe-config";
import { generateDailyPicks, getDailyPicksCached } from "@/lib/daily-picks";

const TOP_PICKS_TTL = 2 * 60 * 60 * 1000; // 2 hours

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

/**
 * GET /api/scanner
 * Query params:
 *   ?mode=daily   — unified daily picks with changelog + tracking (DEFAULT)
 *   ?mode=quick   — quick scan (T1 + crypto only, ~1 min)
 *   ?mode=full    — full scan (all tiers + trending, ~10 min)
 *   ?force=true   — bypass cache
 *   ?timeframe=short|medium|long — scan timeframe (for quick/full modes)
 *   ?n=10         — number of top picks per category (for quick/full modes)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const mode = url.searchParams.get("mode") ?? "daily";

    // Daily Picks mode — unified curated hot list
    if (mode === "daily") {
      if (force) {
        // Force: trigger full scan
        const snapshot = await generateDailyPicks(true);
        return NextResponse.json(snapshot);
      }
      // Default: read cache only (full scan triggered via POST /api/scanner/full)
      const cached = await getDailyPicksCached();
      if (cached) return NextResponse.json(cached);
      return NextResponse.json({ date: null, picks: [], changelog: { added: [], removed: [], changed: [], summary: "Noch kein Tages-Scan durchgefuehrt" }, regime: null, totalScanned: 0, generatedAt: null });
    }

    // Legacy modes (quick/full) — used by screener, heatmap, etc.
    const n = parseInt(url.searchParams.get("n") ?? "10", 10);
    const tfParam = url.searchParams.get("timeframe") ?? "medium";
    const timeframe: ScanTimeframe = isValidTimeframe(tfParam) ? tfParam : "medium";

    const cacheKey = `scanner-top-picks-${timeframe}`;

    if (!force) {
      const cached = await getCached<{
        buys: ScanResult[];
        shorts: ScanResult[];
        holds: ScanResult[];
        scannedAt: string;
        totalScanned: number;
      }>(cacheKey, TOP_PICKS_TTL);
      if (cached) {
        return NextResponse.json({ ...cached, fromCache: true, timeframe });
      }
    }

    let results: ScanResult[];
    let regime = null;
    if (mode === "full") {
      const scan = await scanUniverse(undefined, false, timeframe);
      results = scan.results;
      regime = scan.regime;
    } else {
      results = await scanQuick(timeframe);
    }

    const picks = getTopPicks(results, n, regime?.regime);
    await saveDailySnapshot(results);

    const response = {
      ...picks,
      totalScanned: results.length,
      scannedAt: new Date().toISOString(),
      fromCache: false,
      mode,
      timeframe,
      regime: regime?.regime ?? null,
    };

    await setCache(cacheKey, response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Scanner error:", error);
    return NextResponse.json(
      { error: "Scanner fehlgeschlagen", details: String(error) },
      { status: 500 }
    );
  }
}
