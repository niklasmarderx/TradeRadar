import type { FinancialStatements } from "@/lib/api/yahoo-finance";

/* ── Altman Z-Score ── */

export interface AltmanZResult {
  score: number;
  zone: "safe" | "grey" | "distress";
}

/**
 * Proper Altman Z-Score:
 * Z = 1.2×(WC/TA) + 1.4×(RE/TA) + 3.3×(EBIT/TA) + 0.6×(MV/TL) + 1.0×(Sales/TA)
 * safe > 2.99, distress < 1.81
 */
export function calculateAltmanZ(
  fs: FinancialStatements,
  marketCap: number
): AltmanZResult | null {
  const { workingCapital, totalAssets, retainedEarnings, ebit, totalLiabilities, totalRevenue } = fs;
  if (!totalAssets || totalAssets <= 0) return null;
  if (!totalLiabilities || totalLiabilities <= 0) return null;

  const wc = workingCapital ?? 0;
  const re = retainedEarnings ?? 0;
  const eb = ebit ?? 0;
  const rev = totalRevenue ?? 0;

  const z =
    1.2 * (wc / totalAssets) +
    1.4 * (re / totalAssets) +
    3.3 * (eb / totalAssets) +
    0.6 * (marketCap / totalLiabilities) +
    1.0 * (rev / totalAssets);

  const score = Math.round(z * 100) / 100;
  const zone: AltmanZResult["zone"] =
    score > 2.99 ? "safe" : score < 1.81 ? "distress" : "grey";

  return { score, zone };
}

/* ── Piotroski F-Score ── */

export interface PiotroskiFResult {
  score: number;
  criteria: boolean[];
  labels: string[];
}

/**
 * Piotroski F-Score (0-9):
 * 1. Positive net income
 * 2. Positive operating cash flow
 * 3. Improving ROA
 * 4. OCF > Net Income (accruals quality)
 * 5. Decreasing debt ratio
 * 6. Improving current ratio
 * 7. No new share issuance
 * 8. Improving gross margin
 * 9. Improving asset turnover
 */
export function calculatePiotroskiF(fs: FinancialStatements): PiotroskiFResult | null {
  const {
    netIncome, operatingCashFlow, totalAssets, totalDebt,
    currentAssets, currentLiabilities, grossProfit, totalRevenue,
    sharesOutstanding,
    prevCurrentRatio, prevDebtRatio, prevGrossMargin, prevAssetTurnover, prevSharesOutstanding,
    prevNetIncome, prevTotalAssets,
  } = fs;

  if (!totalAssets || totalAssets <= 0) return null;

  const labels = [
    "Positives Nettoeinkommen",
    "Positiver operativer Cashflow",
    "Steigende Kapitalrendite (ROA)",
    "Cashflow > Nettoeinkommen",
    "Sinkende Verschuldungsquote",
    "Steigende Liquidität",
    "Keine Aktienverwässerung",
    "Steigende Bruttomarge",
    "Steigende Kapitaleffizienz",
  ];

  const criteria: boolean[] = [];

  // 1. Positive net income
  criteria.push(netIncome != null && netIncome > 0);

  // 2. Positive operating cash flow
  criteria.push(operatingCashFlow != null && operatingCashFlow > 0);

  // 3. Improving ROA (net income / total assets)
  const currentRoa = netIncome != null ? netIncome / totalAssets : null;
  const prevRoa = prevNetIncome != null && prevTotalAssets != null && prevTotalAssets > 0
    ? prevNetIncome / prevTotalAssets
    : null;
  criteria.push(
    currentRoa != null && prevRoa != null
      ? currentRoa > prevRoa
      : currentRoa != null && currentRoa > 0
  );

  // 4. OCF > Net Income (accruals quality)
  criteria.push(
    operatingCashFlow != null && netIncome != null && operatingCashFlow > netIncome
  );

  // 5. Decreasing debt ratio
  const currentDebtRatio = totalDebt != null ? totalDebt / totalAssets : null;
  criteria.push(
    currentDebtRatio != null && prevDebtRatio != null
      ? currentDebtRatio < prevDebtRatio
      : currentDebtRatio != null && currentDebtRatio < 0.5
  );

  // 6. Improving current ratio
  const currentCR =
    currentAssets != null && currentLiabilities != null && currentLiabilities > 0
      ? currentAssets / currentLiabilities
      : null;
  criteria.push(
    currentCR != null && prevCurrentRatio != null
      ? currentCR > prevCurrentRatio
      : currentCR != null && currentCR > 1
  );

  // 7. No new share issuance
  criteria.push(
    sharesOutstanding != null && prevSharesOutstanding != null
      ? sharesOutstanding <= prevSharesOutstanding
      : true // benefit of doubt
  );

  // 8. Improving gross margin
  const currentGM =
    grossProfit != null && totalRevenue != null && totalRevenue > 0
      ? grossProfit / totalRevenue
      : null;
  criteria.push(
    currentGM != null && prevGrossMargin != null
      ? currentGM > prevGrossMargin
      : currentGM != null && currentGM > 0.3
  );

  // 9. Improving asset turnover
  const currentAT = totalRevenue != null ? totalRevenue / totalAssets : null;
  criteria.push(
    currentAT != null && prevAssetTurnover != null
      ? currentAT > prevAssetTurnover
      : currentAT != null && currentAT > 0.5
  );

  const score = criteria.filter(Boolean).length;
  return { score, criteria, labels };
}

/* ── Interest Coverage ── */

export function calculateInterestCoverage(
  ebit: number | null,
  interestExpense: number | null
): number | null {
  if (ebit == null || interestExpense == null || interestExpense === 0) return null;
  return Math.round((ebit / Math.abs(interestExpense)) * 10) / 10;
}

/* ── Dividend Safety ── */

export interface DividendSafety {
  yield: number | null;
  payoutRatio: number | null;
  rating: "Very Safe" | "Safe" | "Caution" | "At Risk" | "N/A";
  fiveYearAvg: number | null;
}

export function assessDividendSafety(
  dividendYield: number | null,
  payoutRatio: number | null,
  fiveYearAvg: number | null
): DividendSafety {
  let rating: DividendSafety["rating"] = "N/A";
  if (payoutRatio != null && dividendYield != null && dividendYield > 0) {
    if (payoutRatio < 0.4) rating = "Very Safe";
    else if (payoutRatio < 0.6) rating = "Safe";
    else if (payoutRatio < 0.8) rating = "Caution";
    else rating = "At Risk";
  }
  return { yield: dividendYield, payoutRatio, rating, fiveYearAvg };
}

/* ── Health Grade ── */

const GRADE_THRESHOLDS = [
  [95, "A+"], [90, "A"], [85, "A-"],
  [80, "B+"], [75, "B"], [70, "B-"],
  [65, "C+"], [60, "C"], [55, "C-"],
  [50, "D+"], [45, "D"],
] as const;

export function calculateHealthGrade(
  altmanZ: AltmanZResult | null,
  piotroskiF: PiotroskiFResult | null,
  interestCov: number | null,
  currentRatio: number | null
): string {
  let score = 50; // neutral baseline
  let factors = 0;

  if (altmanZ) {
    factors++;
    if (altmanZ.zone === "safe") score += 20;
    else if (altmanZ.zone === "grey") score += 5;
    else score -= 15;
  }

  if (piotroskiF) {
    factors++;
    score += (piotroskiF.score / 9) * 30 - 10; // 0-9 → -10 to +20
  }

  if (interestCov != null) {
    factors++;
    if (interestCov > 10) score += 15;
    else if (interestCov > 5) score += 10;
    else if (interestCov > 2) score += 5;
    else if (interestCov > 1) score -= 5;
    else score -= 15;
  }

  if (currentRatio != null) {
    factors++;
    if (currentRatio > 2) score += 10;
    else if (currentRatio > 1.5) score += 7;
    else if (currentRatio > 1) score += 3;
    else score -= 10;
  }

  if (factors === 0) return "–";

  const normalized = Math.max(0, Math.min(100, score));
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (normalized >= threshold) return grade;
  }
  return "F";
}
