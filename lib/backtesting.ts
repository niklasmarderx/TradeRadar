/**
 * Backtesting — Compare archived picks with actual outcomes.
 * Evaluates win rates, indicator attribution, and per-grade performance.
 */

import type { ScanResult, ScanSnapshot } from "./scanner";

export interface BacktestResult {
  ticker: string;
  signal: string;
  grade: string;
  signalDate: string;
  entry: number;
  target: number;
  stop: number;
  currentPrice: number;
  hitTarget: boolean;
  hitStop: boolean;
  holdingDays: number;
  returnPct: number;
  breakdown: { trend: number; momentum: number; volatility: number; volume: number };
}

export interface BacktestStats {
  totalPicks: number;
  winRate: number;
  avgReturn: number;
  avgHoldingDays: number;
  bySignal: Record<string, { count: number; winRate: number; avgReturn: number }>;
  byGrade: Record<string, { count: number; winRate: number; avgReturn: number }>;
  indicatorAttribution: {
    trend: { winnerAvg: number; loserAvg: number };
    momentum: { winnerAvg: number; loserAvg: number };
    volatility: { winnerAvg: number; loserAvg: number };
    volume: { winnerAvg: number; loserAvg: number };
  };
}

/**
 * Run backtest on archived picks, comparing entry/target/stop with current prices.
 */
export function backtest(
  archives: ScanSnapshot[],
  priceMap: Map<string, number>,
): BacktestResult[] {
  const results: BacktestResult[] = [];

  for (const snap of archives) {
    const signalDate = snap.date;
    const daysAgo = Math.round(
      (Date.now() - new Date(signalDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    // Only evaluate picks that had a clear signal
    const picks = snap.results.filter(
      (r) => r.signal !== "HOLD" && r.qualityScore >= 30,
    );

    for (const pick of picks) {
      const currentPrice = priceMap.get(pick.ticker);
      if (currentPrice == null || currentPrice <= 0) continue;

      const isBullish = pick.signal.includes("BUY");
      const entry = pick.entry;
      const target = pick.target;
      const stop = pick.stop;

      let hitTarget = false;
      let hitStop = false;
      let returnPct: number;

      if (isBullish) {
        hitTarget = currentPrice >= target;
        hitStop = currentPrice <= stop;
        returnPct = entry > 0 ? ((currentPrice - entry) / entry) * 100 : 0;
      } else {
        // Short: profit when price drops
        hitTarget = currentPrice <= target;
        hitStop = currentPrice >= stop;
        returnPct = entry > 0 ? ((entry - currentPrice) / entry) * 100 : 0;
      }

      results.push({
        ticker: pick.ticker,
        signal: pick.signal,
        grade: pick.grade,
        signalDate,
        entry,
        target,
        stop,
        currentPrice,
        hitTarget,
        hitStop,
        holdingDays: daysAgo,
        returnPct: Math.round(returnPct * 100) / 100,
        breakdown: pick.breakdown,
      });
    }
  }

  return results;
}

/**
 * Calculate aggregate statistics from backtest results.
 */
export function calculateBacktestStats(results: BacktestResult[]): BacktestStats {
  if (results.length === 0) {
    return {
      totalPicks: 0,
      winRate: 0,
      avgReturn: 0,
      avgHoldingDays: 0,
      bySignal: {},
      byGrade: {},
      indicatorAttribution: {
        trend: { winnerAvg: 0, loserAvg: 0 },
        momentum: { winnerAvg: 0, loserAvg: 0 },
        volatility: { winnerAvg: 0, loserAvg: 0 },
        volume: { winnerAvg: 0, loserAvg: 0 },
      },
    };
  }

  const winners = results.filter((r) => r.returnPct > 0);
  const losers = results.filter((r) => r.returnPct <= 0);

  const totalPicks = results.length;
  const winRate = Math.round((winners.length / totalPicks) * 100);
  const avgReturn = Math.round(results.reduce((s, r) => s + r.returnPct, 0) / totalPicks * 100) / 100;
  const avgHoldingDays = Math.round(results.reduce((s, r) => s + r.holdingDays, 0) / totalPicks);

  // Per signal type
  const bySignal: BacktestStats["bySignal"] = {};
  for (const r of results) {
    if (!bySignal[r.signal]) bySignal[r.signal] = { count: 0, winRate: 0, avgReturn: 0 };
    bySignal[r.signal].count++;
    bySignal[r.signal].avgReturn += r.returnPct;
  }
  for (const [sig, data] of Object.entries(bySignal)) {
    const sigResults = results.filter((r) => r.signal === sig);
    const sigWinners = sigResults.filter((r) => r.returnPct > 0);
    data.winRate = Math.round((sigWinners.length / data.count) * 100);
    data.avgReturn = Math.round((data.avgReturn / data.count) * 100) / 100;
  }

  // Per grade
  const byGrade: BacktestStats["byGrade"] = {};
  for (const r of results) {
    if (!byGrade[r.grade]) byGrade[r.grade] = { count: 0, winRate: 0, avgReturn: 0 };
    byGrade[r.grade].count++;
    byGrade[r.grade].avgReturn += r.returnPct;
  }
  for (const [grade, data] of Object.entries(byGrade)) {
    const gradeResults = results.filter((r) => r.grade === grade);
    const gradeWinners = gradeResults.filter((r) => r.returnPct > 0);
    data.winRate = Math.round((gradeWinners.length / data.count) * 100);
    data.avgReturn = Math.round((data.avgReturn / data.count) * 100) / 100;
  }

  // Indicator attribution
  function avgBreakdown(items: BacktestResult[], key: keyof BacktestResult["breakdown"]): number {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((s, r) => s + r.breakdown[key], 0) / items.length * 10) / 10;
  }

  const indicatorAttribution = {
    trend: { winnerAvg: avgBreakdown(winners, "trend"), loserAvg: avgBreakdown(losers, "trend") },
    momentum: { winnerAvg: avgBreakdown(winners, "momentum"), loserAvg: avgBreakdown(losers, "momentum") },
    volatility: { winnerAvg: avgBreakdown(winners, "volatility"), loserAvg: avgBreakdown(losers, "volatility") },
    volume: { winnerAvg: avgBreakdown(winners, "volume"), loserAvg: avgBreakdown(losers, "volume") },
  };

  return {
    totalPicks,
    winRate,
    avgReturn,
    avgHoldingDays,
    bySignal,
    byGrade,
    indicatorAttribution,
  };
}
