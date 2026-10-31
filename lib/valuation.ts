import type { YahooFundamentals } from "@/lib/api/yahoo-finance";

/* ══════════════════════════════════════════════════════════════
   Valuation Models — DCF, Graham Number, Lynch Fair Value
   Pure math, no API calls, no side effects.
   ══════════════════════════════════════════════════════════════ */

export interface DCFResult {
  fairValue: number | null;
  discount: number; // % difference from current price (positive = undervalued)
  assumptions: {
    fcfPerShare: number;
    growthRate: number;
    discountRate: number;
    terminalGrowth: number;
  } | null;
}

export interface GrahamResult {
  fairValue: number | null;
  discount: number;
}

export interface LynchResult {
  fairValue: number | null;
  peg: number | null;
  discount: number;
}

export interface ValuationConsensus {
  fairValue: number | null;
  marginOfSafety: number; // % (positive = undervalued)
  verdict: "Unterbewertet" | "Fair bewertet" | "Überbewertet";
  modelsUsed: number;
}

export interface ValuationResult {
  dcf: DCFResult;
  graham: GrahamResult;
  lynch: LynchResult;
  consensus: ValuationConsensus;
}

const RISK_FREE_RATE = 0.04;
const EQUITY_RISK_PREMIUM = 0.055;

/**
 * Calculate dynamic discount rate based on CAPM.
 * discountRate = riskFreeRate + beta × equityRiskPremium
 * Clamped to [0.06, 0.20], fallback 0.10 if no beta.
 */
function dynamicDiscountRate(beta: number | null): number {
  if (beta == null || beta <= 0) return 0.10;
  const rate = RISK_FREE_RATE + beta * EQUITY_RISK_PREMIUM;
  return Math.max(0.06, Math.min(0.20, rate));
}

/**
 * Volatility-adjusted margin of safety thresholds.
 * Higher volatility → need higher margin to compensate for uncertainty.
 */
function volatilityAdjustedMoS(atrPercent: number | null): number {
  if (atrPercent == null) return 20; // Default
  if (atrPercent > 4) return 25;     // High vol → need 25% margin
  if (atrPercent > 2) return 20;     // Moderate vol
  return 15;                          // Low vol → 15% is enough
}

// Sectors where Graham Number is inappropriate (growth companies with low/no book value)
const GROWTH_SECTORS = new Set([
  "Technology",
  "Communication Services",
]);

const FINANCIAL_SECTORS = new Set([
  "Financial Services",
  "Financial",
  "Banking",
]);

// ── DCF (Simplified 10-Year Discounted Cash Flow) ──

function calculateDCF(
  fcf: number | null,
  sharesOutstanding: number | null,
  earningsGrowth: number | null,
  discountRate = 0.10,
  terminalGrowth = 0.025,
): DCFResult {
  if (
    fcf == null || fcf <= 0 ||
    sharesOutstanding == null || sharesOutstanding <= 0
  ) {
    return { fairValue: null, discount: 0, assumptions: null };
  }

  const fcfPerShare = fcf / sharesOutstanding;

  // Cap growth rate to prevent absurd projections
  let g = earningsGrowth ?? 0.05; // default 5% if unknown
  g = Math.max(-0.10, Math.min(0.25, g)); // clamp -10% to +25%

  // Ensure discount rate > terminal growth (model requirement)
  if (discountRate <= terminalGrowth) {
    return { fairValue: null, discount: 0, assumptions: null };
  }

  // Sum of 10-year projected FCFs
  let pvSum = 0;
  let projectedFCF = fcfPerShare;
  for (let year = 1; year <= 10; year++) {
    projectedFCF *= 1 + g;
    pvSum += projectedFCF / Math.pow(1 + discountRate, year);
  }

  // Terminal value (Gordon Growth Model)
  const terminalFCF = projectedFCF * (1 + terminalGrowth);
  const terminalValue = terminalFCF / (discountRate - terminalGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, 10);

  const fairValue = pvSum + pvTerminal;

  return {
    fairValue: fairValue > 0 ? fairValue : null,
    discount: 0, // set by caller
    assumptions: { fcfPerShare, growthRate: g, discountRate, terminalGrowth },
  };
}

// ── Graham Number ──
// √(22.5 × EPS × Book Value per Share)

function calculateGraham(
  eps: number | null,
  bookValue: number | null,
): GrahamResult {
  if (eps == null || eps <= 0 || bookValue == null || bookValue <= 0) {
    return { fairValue: null, discount: 0 };
  }

  const fairValue = Math.sqrt(22.5 * eps * bookValue);
  return { fairValue, discount: 0 };
}

// ── Lynch Fair Value (PEG-based) ──
// If PEG = 1, stock is fairly valued relative to growth
// Fair Value = Price / PEG (i.e., what price would make PEG = 1)

function calculateLynch(
  price: number,
  pegRatio: number | null,
): LynchResult {
  if (pegRatio == null || pegRatio <= 0 || pegRatio > 10) {
    return { fairValue: null, peg: pegRatio, discount: 0 };
  }

  const fairValue = price / pegRatio;
  return { fairValue, peg: pegRatio, discount: 0 };
}

// ── Consensus Valuation ──

function clampFairValue(
  fv: number | null,
  currentPrice: number,
): number | null {
  if (fv == null || fv <= 0) return null;
  // Reject outliers: fair value must be within 0.1x – 10x current price
  if (fv < currentPrice * 0.1 || fv > currentPrice * 10) return null;
  return fv;
}

/**
 * Calculate valuation using DCF, Graham, and Lynch models.
 * Enhanced with dynamic discount rate, sector-aware Graham, and weighted consensus.
 */
export function calculateValuation(
  f: YahooFundamentals,
  currentPrice: number,
  beta?: number | null,
  atrPercent?: number | null,
  sector?: string,
): ValuationResult {
  const effectiveSector = sector ?? f.sector;
  const isFinancial = FINANCIAL_SECTORS.has(effectiveSector);
  const isGrowth = GROWTH_SECTORS.has(effectiveSector);

  // Dynamic discount rate based on beta (CAPM)
  const discountRate = dynamicDiscountRate(beta ?? null);

  // DCF — skip for financial sector (FCF not meaningful)
  const dcf = isFinancial
    ? { fairValue: null, discount: 0, assumptions: null }
    : calculateDCF(f.freeCashflow, f.sharesOutstanding, f.earningsGrowth, discountRate);
  dcf.fairValue = clampFairValue(dcf.fairValue, currentPrice);
  if (dcf.fairValue != null) {
    dcf.discount = ((dcf.fairValue - currentPrice) / currentPrice) * 100;
  }

  // Graham — skip for growth sectors (book value doesn't capture intangible value)
  const graham = isGrowth
    ? { fairValue: null, discount: 0 }
    : calculateGraham(f.trailingEps, f.bookValue);
  graham.fairValue = clampFairValue(graham.fairValue, currentPrice);
  if (graham.fairValue != null) {
    graham.discount = ((graham.fairValue - currentPrice) / currentPrice) * 100;
  }

  // Lynch
  const lynch = calculateLynch(currentPrice, f.pegRatio);
  lynch.fairValue = clampFairValue(lynch.fairValue, currentPrice);
  if (lynch.fairValue != null) {
    lynch.discount = ((lynch.fairValue - currentPrice) / currentPrice) * 100;
  }

  // Weighted consensus — DCF gets highest weight when available
  // DCF: weight 3, Graham: weight 2, Lynch: weight 2
  const modelWeights: { fv: number; weight: number }[] = [];
  if (dcf.fairValue != null) modelWeights.push({ fv: dcf.fairValue, weight: 3 });
  if (graham.fairValue != null) modelWeights.push({ fv: graham.fairValue, weight: 2 });
  if (lynch.fairValue != null) modelWeights.push({ fv: lynch.fairValue, weight: 2 });

  const modelsUsed = modelWeights.length;

  let consensusFV: number | null = null;
  let marginOfSafety = 0;
  let verdict: ValuationConsensus["verdict"] = "Fair bewertet";

  if (modelsUsed > 0) {
    const totalWeight = modelWeights.reduce((sum, m) => sum + m.weight, 0);
    consensusFV = modelWeights.reduce((sum, m) => sum + m.fv * m.weight, 0) / totalWeight;
    marginOfSafety = ((consensusFV - currentPrice) / currentPrice) * 100;

    // Dynamic MoS threshold based on volatility
    const mosThreshold = volatilityAdjustedMoS(atrPercent ?? null);
    if (marginOfSafety > mosThreshold) verdict = "Unterbewertet";
    else if (marginOfSafety < -mosThreshold) verdict = "Überbewertet";
    else verdict = "Fair bewertet";
  }

  return {
    dcf,
    graham,
    lynch,
    consensus: { fairValue: consensusFV, marginOfSafety, verdict, modelsUsed },
  };
}
