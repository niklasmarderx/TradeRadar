/**
 * Daily Picks System — Unified curated hot list.
 *
 * Runs one combined scan (medium universe + long-term ETFs),
 * applies strict quality filters, tracks picks over time,
 * and generates daily changelogs.
 */

import {
  scanUniverse,
  scanBatch,
  saveDailySnapshot,
  LONG_TERM_INSTRUMENTS,
  CRYPTO,
  type ScanResult,
} from "@/lib/scanner";
import { getCached, setCache, getScannerTtl } from "@/lib/cache";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

export type PickTimeframeTag = "Kurzfristig" | "Mittelfristig" | "Langfristig";

export interface DailyPick {
  // Identity
  ticker: string;
  name: string;
  sector?: string;
  isCrypto: boolean;
  timeframeTag: PickTimeframeTag;
  // Current scan data
  signal: string;
  score: number;
  qualityScore: number;
  grade: string;
  confidence: string;
  convergence: number;
  price: number;
  entry: number;
  target: number;
  stop: number;
  riskReward: number;
  reasonText: string;
  scenarios?: { bull: number; base: number; bear: number };
  valuation?: ScanResult["valuation"];
  aiAnalysis?: ScanResult["aiAnalysis"];
  fundamentals?: ScanResult["fundamentals"];
  // Tracking
  addedDate: string; // YYYY-MM-DD
  addedPrice: number;
  daysOnList: number;
  performancePercent: number; // (price - addedPrice) / addedPrice * 100
}

export interface DailyChangelog {
  added: { ticker: string; name: string; signal: string; qualityScore: number }[];
  removed: {
    ticker: string;
    name: string;
    reason: string;
    daysOnList: number;
    finalPerformance: number;
  }[];
  changed: {
    ticker: string;
    name: string;
    field: string;
    from: string;
    to: string;
  }[];
  summary: string;
}

export interface DailyPicksSnapshot {
  date: string; // YYYY-MM-DD
  picks: DailyPick[];
  changelog: DailyChangelog;
  regime: string | null;
  totalScanned: number;
  generatedAt: string; // ISO timestamp
}

interface PickTrackingState {
  activePicks: Record<string, { addedDate: string; addedPrice: number }>;
  lastUpdated: string;
}

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const MIN_QUALITY_SCORE = 45;
const MIN_CONVERGENCE = 2;
const MAX_PICKS = 15;
const MAX_PER_SECTOR = 3;

const LONG_TERM_SET = new Set(LONG_TERM_INSTRUMENTS);
const CRYPTO_SET = new Set(CRYPTO);

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(dateStr: string, today: string): number {
  const a = new Date(dateStr);
  const b = new Date(today);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function assignTimeframeTag(ticker: string, isCrypto: boolean): PickTimeframeTag {
  if (isCrypto || CRYPTO_SET.has(ticker)) return "Kurzfristig";
  if (LONG_TERM_SET.has(ticker)) return "Langfristig";
  return "Mittelfristig";
}

function scanResultToDailyPick(
  r: ScanResult,
  tracking: PickTrackingState,
  today: string,
): DailyPick {
  const existing = tracking.activePicks[r.ticker];
  const addedDate = existing?.addedDate ?? today;
  const addedPrice = existing?.addedPrice ?? r.price;
  const daysOnList = daysBetween(addedDate, today);
  const performancePercent =
    addedPrice > 0 ? ((r.price - addedPrice) / addedPrice) * 100 : 0;

  return {
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    isCrypto: r.isCrypto,
    timeframeTag: assignTimeframeTag(r.ticker, r.isCrypto),
    signal: r.signal,
    score: r.score,
    qualityScore: r.qualityScore,
    grade: r.grade,
    confidence: r.confidence,
    convergence: r.convergence,
    price: r.price,
    entry: r.entry,
    target: r.target,
    stop: r.stop,
    riskReward: r.riskReward,
    reasonText: r.reasonText,
    scenarios: r.scenarios,
    valuation: r.valuation,
    aiAnalysis: r.aiAnalysis,
    fundamentals: r.fundamentals,
    addedDate,
    addedPrice,
    daysOnList,
    performancePercent,
  };
}

function buildChangelog(
  todayPicks: DailyPick[],
  yesterdayPicks: DailyPick[] | undefined,
): DailyChangelog {
  if (!yesterdayPicks || yesterdayPicks.length === 0) {
    // First run — all picks are "added"
    return {
      added: todayPicks.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        signal: p.signal,
        qualityScore: p.qualityScore,
      })),
      removed: [],
      changed: [],
      summary:
        todayPicks.length > 0
          ? `${todayPicks.length} neu`
          : "Keine Picks",
    };
  }

  const yesterdayMap = new Map(yesterdayPicks.map((p) => [p.ticker, p]));
  const todayMap = new Map(todayPicks.map((p) => [p.ticker, p]));

  const added: DailyChangelog["added"] = [];
  const removed: DailyChangelog["removed"] = [];
  const changed: DailyChangelog["changed"] = [];

  // New additions
  for (const p of todayPicks) {
    if (!yesterdayMap.has(p.ticker)) {
      added.push({
        ticker: p.ticker,
        name: p.name,
        signal: p.signal,
        qualityScore: p.qualityScore,
      });
    }
  }

  // Removals
  for (const p of yesterdayPicks) {
    if (!todayMap.has(p.ticker)) {
      removed.push({
        ticker: p.ticker,
        name: p.name,
        reason: "Qualitaet unter Schwelle gefallen",
        daysOnList: p.daysOnList,
        finalPerformance: p.performancePercent,
      });
    }
  }

  // Signal or score changes
  for (const p of todayPicks) {
    const prev = yesterdayMap.get(p.ticker);
    if (!prev) continue;

    if (prev.signal !== p.signal) {
      changed.push({
        ticker: p.ticker,
        name: p.name,
        field: "Signal",
        from: prev.signal,
        to: p.signal,
      });
    } else if (Math.abs(p.qualityScore - prev.qualityScore) >= 10) {
      changed.push({
        ticker: p.ticker,
        name: p.name,
        field: "Score",
        from: String(prev.qualityScore),
        to: String(p.qualityScore),
      });
    }
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} neu`);
  if (removed.length > 0) parts.push(`${removed.length} entfernt`);
  if (changed.length > 0) parts.push(`${changed.length} geaendert`);

  return {
    added,
    removed,
    changed,
    summary: parts.length > 0 ? parts.join(", ") : "Keine Aenderungen",
  };
}

/* ═══════════════════════════════════════════════════════
   Main: generateDailyPicks
   ═══════════════════════════════════════════════════════ */

export async function generateDailyPicks(
  force = false,
): Promise<DailyPicksSnapshot> {
  // 1. Cache check
  if (!force) {
    const cached = await getCached<DailyPicksSnapshot>(
      "daily-picks-latest",
      getScannerTtl(),
    );
    if (cached) return cached;
  }

  const today = getToday();

  // 2. Run medium scan (main universe with full enrichment)
  console.log("Daily Picks: Running medium universe scan...");
  const { results: mediumResults, regime } = await scanUniverse(
    undefined,
    force,
    "medium",
  );

  // 3. Long-term supplement: ETFs not already in medium results
  const scannedTickers = new Set(mediumResults.map((r) => r.ticker));
  const longOnlyTickers = LONG_TERM_INSTRUMENTS.filter(
    (t) => !scannedTickers.has(t),
  );

  let allResults = [...mediumResults];

  if (longOnlyTickers.length > 0) {
    console.log(
      `Daily Picks: Scanning ${longOnlyTickers.length} long-term instruments...`,
    );
    const longResults = await scanBatch(longOnlyTickers, 1500, "long");
    allResults = [...allResults, ...longResults];
  }

  // Save full results to archive (backward compat)
  await saveDailySnapshot(allResults);

  // 4. Quality filter with progressive fallback
  const nonHold = allResults.filter((r) => r.signal !== "HOLD");
  const actionable = allResults.filter((r) => r.signal !== "HOLD" && r.score !== 0);

  // Log quality distribution for debugging
  if (actionable.length > 0) {
    const qualityDist = actionable.map((r) => r.qualityScore).sort((a, b) => b - a);
    const convDist = actionable.map((r) => r.convergence).sort((a, b) => b - a);
    console.log(
      `Daily Picks: ${allResults.length} total, ${nonHold.length} non-HOLD, ${actionable.length} actionable`,
    );
    console.log(
      `Daily Picks: Quality top-10: [${qualityDist.slice(0, 10).join(", ")}] | Convergence top-10: [${convDist.slice(0, 10).join(", ")}]`,
    );
  }

  // Try strict filter first, then progressively loosen
  let qualified = actionable
    .filter((r) => r.qualityScore >= MIN_QUALITY_SCORE && r.convergence >= MIN_CONVERGENCE)
    .sort((a, b) => b.qualityScore - a.qualityScore);

  // Fallback 1: lower convergence requirement
  if (qualified.length < 3) {
    console.log("Daily Picks: Strict filter too aggressive, loosening convergence...");
    qualified = actionable
      .filter((r) => r.qualityScore >= MIN_QUALITY_SCORE)
      .sort((a, b) => b.qualityScore - a.qualityScore);
  }

  // Fallback 2: lower quality requirement
  if (qualified.length < 3) {
    console.log("Daily Picks: Still too few, lowering quality threshold to 30...");
    qualified = actionable
      .filter((r) => r.qualityScore >= 30)
      .sort((a, b) => b.qualityScore - a.qualityScore);
  }

  // Fallback 3: just take the best actionable results by score
  if (qualified.length < 3 && actionable.length > 0) {
    console.log("Daily Picks: Using top actionable results by absolute score...");
    qualified = actionable.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  // Sector diversification
  const sectorCount = new Map<string, number>();
  const filtered: ScanResult[] = [];
  for (const r of qualified) {
    if (filtered.length >= MAX_PICKS) break;
    const sector = r.sector ?? "Unknown";
    const count = sectorCount.get(sector) ?? 0;
    if (count >= MAX_PER_SECTOR) continue;
    filtered.push(r);
    sectorCount.set(sector, count + 1);
  }

  console.log(
    `Daily Picks: ${allResults.length} scanned → ${qualified.length} qualified → ${filtered.length} final picks`,
  );

  // 5. Load tracking state
  const tracking: PickTrackingState = (await getCached<PickTrackingState>(
    "daily-picks-tracking",
    Infinity,
  )) ?? { activePicks: {}, lastUpdated: today };

  // 6. Convert to DailyPick with tracking
  const dailyPicks = filtered.map((r) =>
    scanResultToDailyPick(r, tracking, today),
  );

  // 7. Update tracking state
  const newActivePicks: PickTrackingState["activePicks"] = {};
  for (const p of dailyPicks) {
    newActivePicks[p.ticker] = {
      addedDate: p.addedDate,
      addedPrice: p.addedPrice,
    };
  }
  const updatedTracking: PickTrackingState = {
    activePicks: newActivePicks,
    lastUpdated: today,
  };

  // 8. Build changelog vs. yesterday
  const yesterday = getYesterday();
  const prevSnapshot = await getCached<DailyPicksSnapshot>(
    `daily-picks-${yesterday}`,
    Infinity,
  );
  const changelog = buildChangelog(dailyPicks, prevSnapshot?.picks);

  // 9. Build snapshot
  const snapshot: DailyPicksSnapshot = {
    date: today,
    picks: dailyPicks,
    changelog,
    regime: regime?.regime ?? null,
    totalScanned: allResults.length,
    generatedAt: new Date().toISOString(),
  };

  // 10. Persist
  await Promise.all([
    setCache("daily-picks-latest", snapshot),
    setCache(`daily-picks-${today}`, snapshot),
    setCache("daily-picks-tracking", updatedTracking),
  ]);

  return snapshot;
}

/* ═══════════════════════════════════════════════════════
   Load history
   ═══════════════════════════════════════════════════════ */

export async function loadDailyPicksHistory(
  days = 30,
): Promise<DailyPicksSnapshot[]> {
  const snapshots: DailyPicksSnapshot[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const snap = await getCached<DailyPicksSnapshot>(
      `daily-picks-${dateStr}`,
      Infinity,
    );
    if (snap) snapshots.push(snap);
  }

  return snapshots;
}

/**
 * Read-only: returns cached daily picks without triggering a scan.
 * Use this for page rendering — never blocks for 10+ minutes.
 */
export async function getDailyPicksCached(): Promise<DailyPicksSnapshot | null> {
  return getCached<DailyPicksSnapshot>("daily-picks-latest", getScannerTtl());
}
