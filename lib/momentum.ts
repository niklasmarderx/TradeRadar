import type { YahooFundamentals } from "@/lib/api/yahoo-finance";

/* ── Period Returns ── */

export interface PeriodReturns {
  oneMonth: number | null;
  threeMonth: number | null;
  sixMonth: number | null;
  twelveMonth: number | null;
  ytd: number | null;
}

/**
 * Calculates period returns from a closes array.
 * Assumes daily data (newest at end).
 */
export function calculatePeriodReturns(
  closes: number[],
  dates?: string[]
): PeriodReturns {
  const n = closes.length;
  if (n < 2) return { oneMonth: null, threeMonth: null, sixMonth: null, twelveMonth: null, ytd: null };

  const current = closes[n - 1];

  function ret(daysAgo: number): number | null {
    const idx = n - 1 - daysAgo;
    if (idx < 0) return null;
    const prev = closes[idx];
    if (prev <= 0) return null;
    return ((current - prev) / prev) * 100;
  }

  // YTD: find first trading day of the year
  let ytd: number | null = null;
  if (dates && dates.length === n) {
    const currentYear = new Date().getFullYear().toString();
    for (let i = 0; i < n; i++) {
      if (dates[i].startsWith(currentYear)) {
        const prev = closes[i];
        if (prev > 0) ytd = ((current - prev) / prev) * 100;
        break;
      }
    }
  }

  return {
    oneMonth: ret(21),
    threeMonth: ret(63),
    sixMonth: ret(126),
    twelveMonth: ret(252),
    ytd,
  };
}

/* ── Relative Strength vs Benchmark ── */

export interface RelativeStrengthResult {
  periods: { period: string; stockReturn: number | null; benchmarkReturn: number | null; excess: number | null }[];
  comparison: "outperforming" | "tracking" | "underperforming";
}

export function calculateRelativeStrength(
  stockCloses: number[],
  benchmarkCloses: number[]
): RelativeStrengthResult {
  const sn = stockCloses.length;
  const bn = benchmarkCloses.length;

  function stockRet(daysAgo: number): number | null {
    const idx = sn - 1 - daysAgo;
    if (idx < 0 || sn < 2) return null;
    const prev = stockCloses[idx];
    if (prev <= 0) return null;
    return ((stockCloses[sn - 1] - prev) / prev) * 100;
  }

  function benchRet(daysAgo: number): number | null {
    const idx = bn - 1 - daysAgo;
    if (idx < 0 || bn < 2) return null;
    const prev = benchmarkCloses[idx];
    if (prev <= 0) return null;
    return ((benchmarkCloses[bn - 1] - prev) / prev) * 100;
  }

  const periodsConfig = [
    { period: "1M", days: 21 },
    { period: "3M", days: 63 },
    { period: "6M", days: 126 },
    { period: "12M", days: 252 },
  ];

  const periods = periodsConfig.map(({ period, days }) => {
    const sr = stockRet(days);
    const br = benchRet(days);
    return {
      period,
      stockReturn: sr != null ? Math.round(sr * 10) / 10 : null,
      benchmarkReturn: br != null ? Math.round(br * 10) / 10 : null,
      excess: sr != null && br != null ? Math.round((sr - br) * 10) / 10 : null,
    };
  });

  // Overall comparison based on 3M excess
  const threeM = periods.find((p) => p.period === "3M")?.excess;
  const comparison: RelativeStrengthResult["comparison"] =
    threeM != null && threeM > 5 ? "outperforming" :
    threeM != null && threeM < -5 ? "underperforming" : "tracking";

  return { periods, comparison };
}

/* ── Beta ── */

export function calculateBeta(
  stockCloses: number[],
  benchmarkCloses: number[],
  period = 252
): number | null {
  const sn = Math.min(stockCloses.length, period + 1);
  const bn = Math.min(benchmarkCloses.length, period + 1);
  const n = Math.min(sn, bn);
  if (n < 30) return null;

  // Align from the end
  const sSlice = stockCloses.slice(-n);
  const bSlice = benchmarkCloses.slice(-n);

  // Daily returns
  const sReturns: number[] = [];
  const bReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (sSlice[i - 1] > 0 && bSlice[i - 1] > 0) {
      sReturns.push((sSlice[i] - sSlice[i - 1]) / sSlice[i - 1]);
      bReturns.push((bSlice[i] - bSlice[i - 1]) / bSlice[i - 1]);
    }
  }

  if (sReturns.length < 20) return null;

  const meanS = sReturns.reduce((s, v) => s + v, 0) / sReturns.length;
  const meanB = bReturns.reduce((s, v) => s + v, 0) / bReturns.length;

  let cov = 0;
  let varB = 0;
  for (let i = 0; i < sReturns.length; i++) {
    const ds = sReturns[i] - meanS;
    const db = bReturns[i] - meanB;
    cov += ds * db;
    varB += db * db;
  }

  if (varB === 0) return null;
  return Math.round((cov / varB) * 100) / 100;
}

/* ── Value vs Growth Classification ── */

export interface ValueGrowthResult {
  classification: "deep-value" | "value" | "blend" | "growth" | "hyper-growth";
  valueScore: number;
  growthScore: number;
}

export function classifyValueGrowth(
  f: YahooFundamentals
): ValueGrowthResult {
  let valueScore = 50;
  let growthScore = 50;

  // PE-based signals
  if (f.peRatio != null && f.peRatio > 0) {
    if (f.peRatio < 12) { valueScore += 20; growthScore -= 10; }
    else if (f.peRatio < 20) { valueScore += 10; }
    else if (f.peRatio > 35) { growthScore += 15; valueScore -= 10; }
    else if (f.peRatio > 50) { growthScore += 25; valueScore -= 15; }
  }

  // PEG
  if (f.pegRatio != null && f.pegRatio > 0) {
    if (f.pegRatio < 1) { valueScore += 15; }
    else if (f.pegRatio > 2) { growthScore += 10; }
  }

  // Dividend yield
  if (f.dividendYield != null && f.dividendYield > 0.03) {
    valueScore += 15;
  } else if (f.dividendYield == null || f.dividendYield === 0) {
    growthScore += 5;
  }

  // Revenue growth
  if (f.revenueGrowth != null) {
    if (f.revenueGrowth > 0.25) { growthScore += 20; }
    else if (f.revenueGrowth > 0.1) { growthScore += 10; }
    else if (f.revenueGrowth < 0) { valueScore += 5; growthScore -= 10; }
  }

  // Earnings growth
  if (f.earningsGrowth != null) {
    if (f.earningsGrowth > 0.25) { growthScore += 15; }
    else if (f.earningsGrowth > 0.1) { growthScore += 8; }
  }

  // P/B (book value)
  if (f.bookValue != null && f.bookValue > 0 && f.marketCap > 0 && f.sharesOutstanding != null && f.sharesOutstanding > 0) {
    const pb = (f.marketCap / f.sharesOutstanding) / f.bookValue;
    if (pb < 1.5) { valueScore += 15; }
    else if (pb > 5) { growthScore += 10; }
  }

  valueScore = Math.max(0, Math.min(100, valueScore));
  growthScore = Math.max(0, Math.min(100, growthScore));

  let classification: ValueGrowthResult["classification"];
  const diff = growthScore - valueScore;
  if (diff > 30) classification = "hyper-growth";
  else if (diff > 10) classification = "growth";
  else if (diff > -10) classification = "blend";
  else if (diff > -30) classification = "value";
  else classification = "deep-value";

  return { classification, valueScore, growthScore };
}
