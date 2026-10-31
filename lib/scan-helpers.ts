import type { Action } from "@/lib/types";
import type { ScanResult } from "@/lib/scanner";
import type { DailyPick } from "@/lib/daily-picks";

export const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Convert a ScanResult from the scanner into an Action for ActionBoard / Screener.
 */
export function scanResultToAction(r: ScanResult): Action {
  const strategy = r.breakdown.trend > 10
    ? "Momentum"
    : r.breakdown.momentum < -10
      ? "Mean Reversion"
      : "Relative Strength";

  let reason = r.reasonText;
  if (r.newsHeadline) {
    reason = `${r.newsHeadline} — ${reason}`;
  }

  return {
    ticker: r.ticker,
    name: r.name,
    price: `${fmt(r.price)} €`,
    price_numeric: r.price,
    signal: r.signal,
    confidence: r.confidence,
    strategy: strategy as Action["strategy"],
    validated: !!r.fundamentals,
    reason,
    entry: `${fmt(r.entry)} €`,
    target: `${fmt(r.target)} €`,
    stop: `${fmt(r.stop)} €`,
    entry_numeric: r.entry,
    target_numeric: r.target,
    stop_numeric: r.stop,
    timeframe: r.timeframe,
    catalyst: r.fundamentals
      ? `KGV ${r.fundamentals.peRatio?.toFixed(1) ?? "–"} | Analysten: ${r.fundamentals.analystRating ?? "–"} | Kursziel: ${r.fundamentals.analystTarget?.toFixed(0) ?? "–"}$`
      : `Q ${r.qualityScore}/100 | K ${r.kellySize.toFixed(1)}% | Konv. ${r.convergence}/4`,
    sparkline: [],
    chart_data: [],
    isCrypto: r.isCrypto,
    grade: r.grade,
    scanTimeframe: r.scanTimeframe,
    scenarios: r.scenarios ? {
      bull: `${fmt(r.scenarios.bull)} €`,
      base: `${fmt(r.scenarios.base)} €`,
      bear: `${fmt(r.scenarios.bear)} €`,
    } : undefined,
    valuation: r.valuation ? {
      fairValue: `${fmt(r.valuation.fairValue ?? 0)} €`,
      marginOfSafety: `${r.valuation.marginOfSafety > 0 ? "+" : ""}${r.valuation.marginOfSafety.toFixed(1)}%`,
      verdict: r.valuation.verdict,
    } : undefined,
  };
}

/**
 * Convert a DailyPick into an Action for ActionBoard.
 * Includes tracking info (days on list, performance since added).
 */
export function dailyPickToAction(p: DailyPick, isNew = false, isChanged = false): Action {
  const strategy: Action["strategy"] = p.isCrypto
    ? "Momentum"
    : p.timeframeTag === "Langfristig"
    ? "Value Investing"
    : "Relative Strength";

  let reason = p.reasonText;
  if (p.daysOnList > 1) {
    const perf = p.performancePercent >= 0 ? `+${p.performancePercent.toFixed(1)}` : p.performancePercent.toFixed(1);
    reason = `Tag ${p.daysOnList} | ${perf}% seit Aufnahme — ${reason}`;
  }

  return {
    ticker: p.ticker,
    name: p.name,
    price: `${fmt(p.price)} €`,
    price_numeric: p.price,
    signal: p.signal as Action["signal"],
    confidence: p.confidence as Action["confidence"],
    strategy,
    validated: !!p.fundamentals,
    reason,
    entry: `${fmt(p.entry)} €`,
    target: `${fmt(p.target)} €`,
    stop: `${fmt(p.stop)} €`,
    entry_numeric: p.entry,
    target_numeric: p.target,
    stop_numeric: p.stop,
    timeframe: p.timeframeTag,
    catalyst: p.fundamentals
      ? `KGV ${p.fundamentals.peRatio?.toFixed(1) ?? "–"} | Analysten: ${p.fundamentals.analystRating ?? "–"}`
      : `Q ${p.qualityScore}/100 | Konv. ${p.convergence}/4`,
    sparkline: [],
    chart_data: [],
    isCrypto: p.isCrypto,
    grade: p.grade,
    sector: p.sector,
    // Daily Picks tracking
    daysOnList: p.daysOnList,
    performancePercent: p.performancePercent,
    addedDate: p.addedDate,
    addedPrice: p.addedPrice,
    changelogStatus: isNew ? "new" : isChanged ? "changed" : null,
    timeframeTag: p.timeframeTag,
    scenarios: p.scenarios ? {
      bull: `${fmt(p.scenarios.bull)} €`,
      base: `${fmt(p.scenarios.base)} €`,
      bear: `${fmt(p.scenarios.bear)} €`,
    } : undefined,
    valuation: p.valuation ? {
      fairValue: `${fmt(p.valuation.fairValue ?? 0)} €`,
      marginOfSafety: `${p.valuation.marginOfSafety > 0 ? "+" : ""}${p.valuation.marginOfSafety.toFixed(1)}%`,
      verdict: p.valuation.verdict,
    } : undefined,
  };
}
