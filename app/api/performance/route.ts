import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ClosedPick {
  ticker: string;
  name: string;
  signal: string;
  addedDate: string;
  removedDate: string;
  daysOnList: number;
  addedPrice: number;
  finalPerformance: number; // %
  reason: string;
  sector?: string;
  grade?: string;
  isCrypto: boolean;
}

export interface ActivePickSnapshot {
  ticker: string;
  name: string;
  signal: string;
  addedDate: string;
  addedPrice: number;
  currentPrice: number;
  performancePercent: number;
  daysOnList: number;
  sector?: string;
  grade?: string;
  isCrypto: boolean;
}

export interface PerformanceData {
  activePicks: ActivePickSnapshot[];
  closedPicks: ClosedPick[];
  stats: {
    totalClosed: number;
    winners: number;
    losers: number;
    winRate: number;
    avgGain: number;
    avgLoss: number;
    avgHoldDays: number;
    bestPick: ClosedPick | null;
    worstPick: ClosedPick | null;
  };
  generatedAt: string;
}

const CACHE_DIR = path.join(process.cwd(), ".cache");

async function loadSnapshot(file: string) {
  try {
    const raw = await readFile(path.join(CACHE_DIR, file), "utf8");
    const wrapper = JSON.parse(raw);
    return wrapper.data ?? wrapper;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Load all daily picks snapshots to reconstruct closed picks history
    const files = await readdir(CACHE_DIR).catch(() => [] as string[]);
    const snapshotFiles = files
      .filter((f) => /^daily-picks-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();

    const closedByTicker = new Map<string, ClosedPick>();

    for (const file of snapshotFiles) {
      const snap = await loadSnapshot(file);
      if (!snap?.changelog?.removed) continue;

      const date = file.replace("daily-picks-", "").replace(".json", "");

      for (const removed of snap.changelog.removed) {
        if (removed.finalPerformance === 0 && removed.daysOnList <= 1) continue; // skip 0-day artifacts

        // Find the pick data from that snapshot (for sector/grade/price info)
        const pickData = snap.picks?.find((p: { ticker: string }) => p.ticker === removed.ticker);
        const previousSnaps = snapshotFiles.slice(0, snapshotFiles.indexOf(file));
        let addedPrice = 0;
        for (const prev of [...previousSnaps].reverse()) {
          const prevSnap = await loadSnapshot(prev);
          const prevPick = prevSnap?.picks?.find((p: { ticker: string }) => p.ticker === removed.ticker);
          if (prevPick?.addedPrice) { addedPrice = prevPick.addedPrice; break; }
        }

        closedByTicker.set(removed.ticker + "_" + date, {
          ticker: removed.ticker,
          name: removed.name,
          signal: pickData?.signal ?? "BUY",
          addedDate: pickData?.addedDate ?? date,
          removedDate: date,
          daysOnList: removed.daysOnList,
          addedPrice: addedPrice || pickData?.addedPrice || 0,
          finalPerformance: removed.finalPerformance,
          reason: removed.reason,
          sector: pickData?.sector,
          grade: pickData?.grade,
          isCrypto: pickData?.isCrypto ?? false,
        });
      }
    }

    const closedPicks = [...closedByTicker.values()].sort(
      (a, b) => b.removedDate.localeCompare(a.removedDate),
    );

    // Load active picks from latest snapshot
    const latest = await loadSnapshot("daily-picks-latest.json");
    const activePicks: ActivePickSnapshot[] = (latest?.picks ?? []).map(
      (p: {
        ticker: string; name: string; signal: string; addedDate: string;
        addedPrice: number; price: number; performancePercent: number;
        daysOnList: number; sector?: string; grade?: string; isCrypto: boolean;
      }) => ({
        ticker: p.ticker,
        name: p.name,
        signal: p.signal,
        addedDate: p.addedDate,
        addedPrice: p.addedPrice,
        currentPrice: p.price,
        performancePercent: p.performancePercent,
        daysOnList: p.daysOnList,
        sector: p.sector,
        grade: p.grade,
        isCrypto: p.isCrypto,
      }),
    );

    // Stats
    const winners = closedPicks.filter((p) => p.finalPerformance > 0);
    const losers = closedPicks.filter((p) => p.finalPerformance <= 0);
    const avgGain = winners.length > 0
      ? winners.reduce((s, p) => s + p.finalPerformance, 0) / winners.length : 0;
    const avgLoss = losers.length > 0
      ? losers.reduce((s, p) => s + p.finalPerformance, 0) / losers.length : 0;
    const avgHoldDays = closedPicks.length > 0
      ? closedPicks.reduce((s, p) => s + p.daysOnList, 0) / closedPicks.length : 0;
    const bestPick = closedPicks.length > 0
      ? closedPicks.reduce((a, b) => a.finalPerformance > b.finalPerformance ? a : b) : null;
    const worstPick = closedPicks.length > 0
      ? closedPicks.reduce((a, b) => a.finalPerformance < b.finalPerformance ? a : b) : null;

    const data: PerformanceData = {
      activePicks,
      closedPicks,
      stats: {
        totalClosed: closedPicks.length,
        winners: winners.length,
        losers: losers.length,
        winRate: closedPicks.length > 0 ? (winners.length / closedPicks.length) * 100 : 0,
        avgGain,
        avgLoss,
        avgHoldDays,
        bestPick,
        worstPick,
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
