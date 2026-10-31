import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { scanQuick, type ScanResult } from "@/lib/scanner";
import { fetchFundamentals } from "@/lib/api/yahoo-finance";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export interface HeatmapTile {
  name: string;       // ticker
  fullName: string;   // company name
  value: number;      // market cap or 1 (equal weight)
  score: number;      // -100 to +100
  signal: string;
  price: number;
  grade: string;
}

export interface HeatmapSector {
  name: string;
  children: HeatmapTile[];
}

const HEATMAP_KEY = "heatmap-data";
const HEATMAP_TTL = 30 * 60 * 1000; // 30 min

/** Sector mapping for common crypto tickers */
function getSectorForCrypto(): string {
  return "Crypto";
}

/** Fallback sector based on known tickers when no fundamentals available */
const KNOWN_SECTORS: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", AMZN: "Consumer Cyclical",
  NVDA: "Technology", META: "Technology", TSLA: "Consumer Cyclical", JPM: "Financial Services",
  V: "Financial Services", MA: "Financial Services", UNH: "Healthcare", JNJ: "Healthcare",
  LLY: "Healthcare", XOM: "Energy", CVX: "Energy", PG: "Consumer Defensive",
  KO: "Consumer Defensive", PEP: "Consumer Defensive", WMT: "Consumer Defensive",
  HD: "Consumer Cyclical", DIS: "Communication Services", NFLX: "Communication Services",
  NKE: "Consumer Cyclical", BA: "Industrials", CAT: "Industrials", GE: "Industrials",
  LMT: "Industrials", NEE: "Utilities", DUK: "Utilities", AMT: "Real Estate",
  PLD: "Real Estate", FCX: "Basic Materials", NEM: "Basic Materials",
};

export async function GET() {
  try {
    // Try cache first
    const cached = await getCached<{ sectors: HeatmapSector[]; meta: { total: number; scannedAt: string } }>(
      HEATMAP_KEY,
      HEATMAP_TTL
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    // Load scanner results
    let results: ScanResult[] =
      (await getCached<ScanResult[]>("scanner-latest", 2 * 60 * 60 * 1000)) ?? [];

    if (results.length === 0) {
      // Try top picks
      const picks = await getCached<{ buys: ScanResult[]; shorts: ScanResult[]; holds: ScanResult[] }>(
        "scanner-top-picks",
        2 * 60 * 60 * 1000
      );
      if (picks) {
        results = [...picks.buys, ...picks.shorts, ...picks.holds];
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ sectors: [], meta: { total: 0, scannedAt: "" } });
    }

    // Enrich missing sector data in parallel batches
    const needsSector = results.filter((r) => !r.sector && !r.isCrypto);
    const BATCH_SIZE = 10;

    for (let i = 0; i < needsSector.length; i += BATCH_SIZE) {
      const batch = needsSector.slice(i, i + BATCH_SIZE);
      const fundamentals = await Promise.all(
        batch.map((r) => fetchFundamentals(r.ticker).catch(() => null))
      );
      for (let j = 0; j < batch.length; j++) {
        const f = fundamentals[j];
        if (f?.sector) {
          batch[j].sector = f.sector;
          batch[j].industry = f.industry;
          batch[j].marketCap = f.marketCap;
        } else {
          // Use known sectors fallback
          batch[j].sector = KNOWN_SECTORS[batch[j].ticker] ?? "Sonstige";
        }
      }
      // Small delay between batches
      if (i + BATCH_SIZE < needsSector.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Group by sector
    const sectorMap = new Map<string, HeatmapTile[]>();

    for (const r of results) {
      const sector = r.isCrypto ? getSectorForCrypto() : (r.sector ?? KNOWN_SECTORS[r.ticker] ?? "Sonstige");

      if (!sectorMap.has(sector)) sectorMap.set(sector, []);
      sectorMap.get(sector)!.push({
        name: r.ticker.replace(/-USD$/, ""),
        fullName: r.name,
        value: r.marketCap ?? 1,
        score: r.score,
        signal: r.signal,
        price: r.price,
        grade: r.grade,
      });
    }

    // Sort sectors by total market cap descending, and tiles within each sector by market cap
    const sectors: HeatmapSector[] = [...sectorMap.entries()]
      .map(([name, children]) => ({
        name,
        children: children.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => {
        const sumA = a.children.reduce((s, c) => s + c.value, 0);
        const sumB = b.children.reduce((s, c) => s + c.value, 0);
        return sumB - sumA;
      });

    const result = {
      sectors,
      meta: {
        total: results.length,
        scannedAt: results[0]?.scannedAt ?? new Date().toISOString(),
      },
    };

    await setCache(HEATMAP_KEY, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Heatmap API error:", error);
    return NextResponse.json({ sectors: [], meta: { total: 0, scannedAt: "" } }, { status: 500 });
  }
}
