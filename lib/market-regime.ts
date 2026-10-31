/**
 * Market Regime Detection
 *
 * Detects bull/bear/sideways/volatile market phases from SPY data.
 * Used by the scanner to dynamically adjust quality thresholds,
 * position sizing, stop/target multipliers, and cache TTLs.
 */

import { SMA, ATR } from "technicalindicators";

import type { MacroSnapshot } from "@/lib/api/fred";

export type MarketRegime = "bull" | "bear" | "sideways" | "volatile";

export interface MarketRegimeData {
  regime: MarketRegime;
  spyTrend: "up" | "down" | "flat";
  vixProxy: number;
  breadth: number;
  confidence: number;
  detectedAt: string;
}

export interface RegimeAdjustments {
  qualityThresholdMin: number;
  kellySizeMultiplier: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  convergenceMinimum: number;
}

/**
 * Detect market regime from SPY (or equivalent broad market) data.
 *
 * Signals:
 *   1. SPY Trend: SMA50 vs SMA200 alignment + price position
 *   2. VIX Proxy: ATR(14) of SPY as percentage of price (volatility)
 *   3. Market Breadth: % of scanned stocks above their SMA200
 *
 * Voting: majority wins. High volatility overrides sideways.
 */
export function detectMarketRegime(
  spyCloses: number[],
  spyHighs: number[],
  spyLows: number[],
  breadthAboveSma200?: number,
  macroData?: MacroSnapshot | null,
): MarketRegimeData {
  const n = spyCloses.length;
  const now = new Date().toISOString();

  if (n < 200) {
    return {
      regime: "sideways",
      spyTrend: "flat",
      vixProxy: 0,
      breadth: breadthAboveSma200 ?? 50,
      confidence: 0,
      detectedAt: now,
    };
  }

  // ── 1. SPY Trend ──
  const sma50 = SMA.calculate({ period: 50, values: spyCloses });
  const sma200 = SMA.calculate({ period: 200, values: spyCloses });
  const latestSma50 = sma50[sma50.length - 1];
  const latestSma200 = sma200[sma200.length - 1];
  const price = spyCloses[n - 1];

  let spyTrend: "up" | "down" | "flat" = "flat";
  let bullVotes = 0;
  let bearVotes = 0;

  if (price > latestSma50 && latestSma50 > latestSma200) {
    spyTrend = "up";
    bullVotes += 2; // Strong signal
  } else if (price > latestSma200) {
    spyTrend = "up";
    bullVotes += 1;
  } else if (price < latestSma50 && latestSma50 < latestSma200) {
    spyTrend = "down";
    bearVotes += 2;
  } else if (price < latestSma200) {
    spyTrend = "down";
    bearVotes += 1;
  }

  // ── 2. VIX Proxy (ATR% of SPY) ──
  const atrValues = ATR.calculate({
    period: 14,
    high: spyHighs,
    low: spyLows,
    close: spyCloses,
  });
  const latestAtr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;
  const vixProxy = price > 0 ? (latestAtr / price) * 100 : 0;

  let isVolatile = false;
  if (vixProxy > 2.5) {
    isVolatile = true;
  } else if (vixProxy < 1.0) {
    bullVotes += 1; // Low vol = complacency, typically bullish
  }

  // ── 3. Market Breadth ──
  const breadth = breadthAboveSma200 ?? 50;
  if (breadth > 65) bullVotes += 1;
  else if (breadth < 35) bearVotes += 1;

  // ── 4. FRED Macro Data (optional) ──
  if (macroData) {
    // Real VIX overrides the ATR proxy
    if (macroData.vix != null) {
      if (macroData.vix > 30) {
        isVolatile = true;
      } else if (macroData.vix < 15) {
        bullVotes += 1;
      }
    }
    // Inverted yield curve = recession signal
    if (macroData.treasurySpread != null && macroData.treasurySpread < 0) {
      bearVotes += 2;
    }
  }

  // ── Voting ──
  let regime: MarketRegime;
  if (isVolatile && bearVotes >= 2) {
    regime = "volatile";
  } else if (bullVotes >= 3) {
    regime = "bull";
  } else if (bearVotes >= 3) {
    regime = "bear";
  } else if (bullVotes >= 2 && bearVotes === 0) {
    regime = "bull";
  } else if (bearVotes >= 2 && bullVotes === 0) {
    regime = "bear";
  } else if (isVolatile) {
    regime = "volatile";
  } else {
    regime = "sideways";
  }

  const totalVotes = bullVotes + bearVotes + (isVolatile ? 1 : 0);
  const confidence = totalVotes > 0
    ? Math.min(1, Math.max(bullVotes, bearVotes, isVolatile ? 1 : 0) / totalVotes)
    : 0.5;

  return {
    regime,
    spyTrend,
    vixProxy: Math.round(vixProxy * 100) / 100,
    breadth: Math.round(breadth),
    confidence: Math.round(confidence * 100) / 100,
    detectedAt: now,
  };
}

/**
 * Get dynamic threshold adjustments based on market regime.
 */
export function getRegimeAdjustments(regime: MarketRegime): RegimeAdjustments {
  switch (regime) {
    case "bull":
      return {
        qualityThresholdMin: 30,
        kellySizeMultiplier: 1.0,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 4.5,
        convergenceMinimum: 2,
      };
    case "bear":
      return {
        qualityThresholdMin: 45,
        kellySizeMultiplier: 0.5,
        atrStopMultiplier: 3.0,
        atrTargetMultiplier: 3.0,
        convergenceMinimum: 3,
      };
    case "volatile":
      return {
        qualityThresholdMin: 40,
        kellySizeMultiplier: 0.6,
        atrStopMultiplier: 2.5,
        atrTargetMultiplier: 3.5,
        convergenceMinimum: 3,
      };
    case "sideways":
    default:
      return {
        qualityThresholdMin: 35,
        kellySizeMultiplier: 0.8,
        atrStopMultiplier: 2.0,
        atrTargetMultiplier: 4.0,
        convergenceMinimum: 2,
      };
  }
}
