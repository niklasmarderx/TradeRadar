import { NextResponse } from "next/server";
import { scanUniverse, getTopPicks, saveDailySnapshot } from "@/lib/scanner";
import { setCache } from "@/lib/cache";
import { isValidTimeframe, type ScanTimeframe } from "@/lib/timeframe-config";
import { generateDailyPicks } from "@/lib/daily-picks";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 min

/**
 * POST /api/scanner/full
 * Body: { mode?: "daily" | "legacy", timeframe?: "short" | "medium" | "long" }
 *
 * mode=daily (default): Unified daily picks scan with changelog.
 * mode=legacy: Raw scanUniverse for specific timeframe (backward compat).
 */
export async function POST(request: Request) {
  try {
    const startTime = Date.now();

    let mode = "daily";
    let timeframe: ScanTimeframe = "medium";
    try {
      const body = await request.json();
      if (body?.mode === "legacy") mode = "legacy";
      if (body?.timeframe && isValidTimeframe(body.timeframe)) {
        timeframe = body.timeframe;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Daily Picks mode — unified curated hot list
    if (mode === "daily") {
      const snapshot = await generateDailyPicks(true);
      const durationSec = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        totalScanned: snapshot.totalScanned,
        picksCount: snapshot.picks.length,
        changelog: snapshot.changelog,
        regime: snapshot.regime,
        durationSeconds: durationSec,
        generatedAt: snapshot.generatedAt,
      });
    }

    // Legacy mode — raw scanUniverse
    const cacheKey = `scanner-top-picks-${timeframe}`;
    const scan = await scanUniverse(undefined, true, timeframe);
    const { results, regime } = scan;
    const picks = getTopPicks(results, 15, regime?.regime);

    await saveDailySnapshot(results);

    const response = {
      ...picks,
      totalScanned: results.length,
      scannedAt: new Date().toISOString(),
      fromCache: false,
      mode: "full",
      timeframe,
    };

    await setCache(cacheKey, response);

    const durationSec = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      totalScanned: results.length,
      buys: picks.buys.length,
      shorts: picks.shorts.length,
      holds: picks.holds.length,
      durationSeconds: durationSec,
      scannedAt: new Date().toISOString(),
      timeframe,
    });
  } catch (error) {
    console.error("Full scan error:", error);
    return NextResponse.json(
      { error: "Voller Scan fehlgeschlagen", details: String(error) },
      { status: 500 }
    );
  }
}
