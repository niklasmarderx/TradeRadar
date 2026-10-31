/* ── Investment Score ── */

import type { MarketRegime } from "./market-regime";

export interface InvestmentScoreDimension {
  score: number;
  maxScore: number;
  detail: string;
}

export interface InvestmentScore {
  overall: number;
  grade: string;
  dimensions: {
    fundamentals: InvestmentScoreDimension;
    technicals: InvestmentScoreDimension;
    sentiment: InvestmentScoreDimension;
    risk: InvestmentScoreDimension;
    value: InvestmentScoreDimension;
  };
  verdict: string;
}

export interface InvestmentScoreInput {
  // Fundamentals
  peRatio: number | null;
  returnOnEquity: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  sector?: string | null;
  // Technicals
  compositeScore: number;
  convergence: number;
  trendStrength: string;
  bollingerSqueeze?: boolean;
  // Sentiment
  analystRating: string | null;
  numberOfAnalysts: number;
  earningsRevisionScore?: number;
  sectorMomentum?: "strong" | "neutral" | "weak";
  // Risk
  altmanZScore: number | null;
  altmanZZone: string | null;
  piotroskiFScore: number | null;
  atrPercent: number | null;
  currentRatio: number | null;
  putCallRatio?: number | null;
  // Value
  marginOfSafety: number | null;
  valuationVerdict: string | null;
  // Macro (FRED)
  vixLevel?: number | null;
  yieldCurveSpread?: number | null;
  // Social Sentiment (Finnhub)
  socialSentimentScore?: number | null;
  socialBuzz?: "high" | "moderate" | "low" | null;
  // Context
  regime?: MarketRegime | null;
}

const GRADE_THRESHOLDS = [
  [90, "A+"], [85, "A"], [80, "A-"],
  [75, "B+"], [70, "B"], [65, "B-"],
  [60, "C+"], [55, "C"], [50, "C-"],
  [45, "D+"], [40, "D"],
] as const;

function toGrade(score: number): string {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return "F";
}

/**
 * Regime-aware dimension weights.
 * Each dimension base is 20, weights rescale contributions.
 */
function getRegimeWeights(regime?: MarketRegime | null): { fund: number; tech: number; sent: number; risk: number; val: number } {
  switch (regime) {
    case "bull":
      return { fund: 20, tech: 25, sent: 20, risk: 15, val: 20 };
    case "bear":
      return { fund: 20, tech: 15, sent: 15, risk: 25, val: 25 };
    case "volatile":
      return { fund: 15, tech: 20, sent: 15, risk: 30, val: 20 };
    case "sideways":
    default:
      return { fund: 20, tech: 20, sent: 20, risk: 20, val: 20 };
  }
}

/**
 * Sector-aware PE thresholds.
 * Growth sectors naturally trade at higher multiples.
 */
function getPeThresholds(sector?: string | null): { cheap: number; fair: number } {
  switch (sector) {
    case "Technology":
    case "Communication Services":
      return { cheap: 25, fair: 35 };
    case "Financial Services":
    case "Financial":
    case "Banking":
      return { cheap: 10, fair: 18 };
    case "Utilities":
    case "Real Estate":
      return { cheap: 12, fair: 20 };
    default:
      return { cheap: 15, fair: 25 };
  }
}

export function calculateInvestmentScore(input: InvestmentScoreInput): InvestmentScore {
  const weights = getRegimeWeights(input.regime);
  const peThresholds = getPeThresholds(input.sector);

  // ── Fundamentals (0-20) ──
  let fundScore = 0;
  const fundParts: string[] = [];

  if (input.peRatio != null && input.peRatio > 0) {
    if (input.peRatio < peThresholds.cheap) { fundScore += 5; fundParts.push("günstiges KGV"); }
    else if (input.peRatio < peThresholds.fair) { fundScore += 3; fundParts.push("faires KGV"); }
    else { fundScore += 1; fundParts.push("hohes KGV"); }
  }

  if (input.returnOnEquity != null) {
    if (input.returnOnEquity > 0.2) { fundScore += 5; fundParts.push("starke ROE"); }
    else if (input.returnOnEquity > 0.1) { fundScore += 3; }
    else if (input.returnOnEquity > 0) { fundScore += 1; }
  }

  if (input.profitMargin != null) {
    if (input.profitMargin > 0.2) { fundScore += 4; fundParts.push("hohe Marge"); }
    else if (input.profitMargin > 0.1) { fundScore += 2; }
    else if (input.profitMargin > 0) { fundScore += 1; }
  }

  if (input.revenueGrowth != null) {
    if (input.revenueGrowth > 0.15) { fundScore += 3; fundParts.push("starkes Wachstum"); }
    else if (input.revenueGrowth > 0.05) { fundScore += 2; }
    else if (input.revenueGrowth > 0) { fundScore += 1; }
  }

  if (input.earningsGrowth != null && input.earningsGrowth > 0.1) {
    fundScore += 3;
  }

  fundScore = Math.min(20, fundScore);

  // ── Technicals (0-20) ──
  let techScore = 0;
  const techParts: string[] = [];

  // Composite score: -100 to +100 → 0 to 20
  const normalized = (input.compositeScore + 100) / 200; // 0 to 1
  techScore += Math.round(normalized * 12);

  // Convergence: 0-4 → 0-5
  techScore += Math.round((input.convergence / 4) * 5);

  // Trend strength bonus
  if (input.trendStrength === "strong") { techScore += 3; techParts.push("starker Trend"); }
  else if (input.trendStrength === "moderate") { techScore += 1; }

  // Bollinger Squeeze bonus (imminent breakout)
  if (input.bollingerSqueeze) { techScore += 2; techParts.push("Squeeze-Breakout"); }

  techScore = Math.min(20, techScore);
  if (input.compositeScore > 30) techParts.push("bullishes Signal");
  else if (input.compositeScore < -30) techParts.push("bearishes Signal");

  // ── Sentiment (0-20) ──
  let sentScore = 10; // neutral baseline
  const sentParts: string[] = [];

  if (input.analystRating) {
    const r = input.analystRating.toLowerCase().replace(/[\s-]/g, "_");
    if (r === "strong_buy" || r === "strongbuy") { sentScore += 8; sentParts.push("Strong Buy Konsens"); }
    else if (r === "buy" || r === "outperform" || r === "overweight" || r === "accumulate") { sentScore += 5; sentParts.push("Buy Konsens"); }
    else if (r === "hold" || r === "neutral" || r === "equal_weight" || r === "market_perform") { sentScore += 0; sentParts.push("Hold Konsens"); }
    else if (r === "underperform" || r === "underweight" || r === "reduce") { sentScore -= 3; sentParts.push("Underperform Konsens"); }
    else if (r === "sell" || r === "strong_sell" || r === "strongsell") { sentScore -= 5; sentParts.push("Sell Konsens"); }
  }

  if (input.numberOfAnalysts > 20) sentScore += 2;
  else if (input.numberOfAnalysts > 10) sentScore += 1;

  // Earnings revision score
  if (input.earningsRevisionScore != null) {
    if (input.earningsRevisionScore > 3) { sentScore += 3; sentParts.push("EPS Revisionen ↑"); }
    else if (input.earningsRevisionScore < -3) { sentScore -= 3; sentParts.push("EPS Revisionen ↓"); }
  }

  // Sector momentum
  if (input.sectorMomentum === "strong") { sentScore += 2; sentParts.push("Sektor-Momentum ↑"); }
  else if (input.sectorMomentum === "weak") { sentScore -= 2; sentParts.push("Sektor-Momentum ↓"); }

  // Social Sentiment (Finnhub)
  if (input.socialSentimentScore != null) {
    if (input.socialSentimentScore > 0.3) { sentScore += 2; sentParts.push("Social bullish"); }
    else if (input.socialSentimentScore < -0.3) { sentScore -= 2; sentParts.push("Social bearish"); }
  }
  if (input.socialBuzz === "high") { sentScore += 1; }

  sentScore = Math.max(0, Math.min(20, sentScore));

  // ── Risk (0-20, higher = safer) ──
  let riskScore = 10; // neutral
  const riskParts: string[] = [];

  if (input.altmanZZone === "safe") { riskScore += 5; riskParts.push("finanziell stabil"); }
  else if (input.altmanZZone === "grey") { riskScore += 0; }
  else if (input.altmanZZone === "distress") { riskScore -= 5; riskParts.push("Insolvenzrisiko"); }

  if (input.piotroskiFScore != null) {
    if (input.piotroskiFScore >= 7) { riskScore += 4; riskParts.push("starke Finanzen"); }
    else if (input.piotroskiFScore >= 5) { riskScore += 2; }
    else { riskScore -= 2; }
  }

  if (input.atrPercent != null) {
    if (input.atrPercent < 2) riskScore += 2;
    else if (input.atrPercent > 5) riskScore -= 2;
  }

  if (input.currentRatio != null) {
    if (input.currentRatio > 1.5) riskScore += 2;
    else if (input.currentRatio < 1) riskScore -= 2;
  }

  // Put/Call contrarian risk signal
  if (input.putCallRatio != null) {
    if (input.putCallRatio > 1.5) { riskScore -= 1; riskParts.push("hohe Put-Aktivität"); }
    else if (input.putCallRatio < 0.5) { riskScore += 1; }
  }

  // Macro risk signals (FRED)
  if (input.vixLevel != null) {
    if (input.vixLevel > 30) { riskScore -= 3; riskParts.push("VIX hoch"); }
    else if (input.vixLevel < 15) { riskScore += 1; }
  }
  if (input.yieldCurveSpread != null && input.yieldCurveSpread < 0) {
    riskScore -= 3; riskParts.push("Zinskurve invertiert");
  }

  riskScore = Math.max(0, Math.min(20, riskScore));

  // ── Value (0-20) ──
  let valScore = 10; // neutral
  const valParts: string[] = [];

  if (input.marginOfSafety != null) {
    if (input.marginOfSafety > 30) { valScore += 8; valParts.push("stark unterbewertet"); }
    else if (input.marginOfSafety > 15) { valScore += 5; valParts.push("unterbewertet"); }
    else if (input.marginOfSafety > 0) { valScore += 2; }
    else if (input.marginOfSafety < -30) { valScore -= 8; valParts.push("stark überbewertet"); }
    else if (input.marginOfSafety < -15) { valScore -= 5; valParts.push("überbewertet"); }
  }

  if (input.valuationVerdict === "Unterbewertet") valScore += 2;
  else if (input.valuationVerdict === "Überbewertet") valScore -= 2;

  valScore = Math.max(0, Math.min(20, valScore));

  // ── Regime-weighted overall ──
  const totalWeight = weights.fund + weights.tech + weights.sent + weights.risk + weights.val;
  const rawOverall =
    (fundScore / 20) * weights.fund +
    (techScore / 20) * weights.tech +
    (sentScore / 20) * weights.sent +
    (riskScore / 20) * weights.risk +
    (valScore / 20) * weights.val;
  const overall = Math.round((rawOverall / totalWeight) * 100);
  const grade = toGrade(overall);

  // Build verdict
  const allParts = [...fundParts, ...techParts, ...sentParts, ...riskParts, ...valParts];
  const topPositive = allParts.slice(0, 2).join(", ");
  const verdict = overall >= 70
    ? `Starke Investmentqualität — ${topPositive || "solide Gesamtbewertung"}.`
    : overall >= 50
    ? `Solide Bewertung — ${topPositive || "ausgeglichenes Profil"}.`
    : `Vorsicht geboten — ${allParts.find(p => p.includes("Risiko") || p.includes("über") || p.includes("bear")) || "gemischte Signale"}.`;

  return {
    overall,
    grade,
    dimensions: {
      fundamentals: { score: fundScore, maxScore: 20, detail: fundParts.join(", ") || "Neutral" },
      technicals: { score: techScore, maxScore: 20, detail: techParts.join(", ") || "Neutral" },
      sentiment: { score: sentScore, maxScore: 20, detail: sentParts.join(", ") || "Neutral" },
      risk: { score: riskScore, maxScore: 20, detail: riskParts.join(", ") || "Neutral" },
      value: { score: valScore, maxScore: 20, detail: valParts.join(", ") || "Neutral" },
    },
    verdict,
  };
}
