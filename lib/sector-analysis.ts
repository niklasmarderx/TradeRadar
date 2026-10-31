/**
 * Sector Analysis — Momentum & Diversification
 *
 * Calculates sector momentum from ETF returns and provides
 * diversification logic for top picks (max N per sector).
 */

const SECTOR_ETF_MAP: Record<string, string> = {
  "Technology": "XLK",
  "Financial Services": "XLF",
  "Healthcare": "XLV",
  "Energy": "XLE",
  "Industrials": "XLI",
  "Communication Services": "XLC",
  "Real Estate": "XLRE",
  "Consumer Defensive": "XLP",
  "Utilities": "XLU",
  "Basic Materials": "XLB",
  "Consumer Cyclical": "XLY",
};

export type SectorMomentum = "strong" | "neutral" | "weak";

export interface SectorMomentumData {
  sector: string;
  etf: string;
  return1M: number;
  momentum: SectorMomentum;
}

/**
 * Classify sector momentum from ETF 1-month returns.
 * Top 25% = strong, bottom 25% = weak, rest = neutral.
 */
export function calculateSectorMomentum(
  sectorReturns: Map<string, number>,
): Map<string, SectorMomentumData> {
  const entries = [...sectorReturns.entries()]
    .map(([sector, ret]) => ({ sector, etf: SECTOR_ETF_MAP[sector] ?? "", return1M: ret }))
    .sort((a, b) => b.return1M - a.return1M);

  const n = entries.length;
  const topCutoff = Math.floor(n * 0.25);
  const bottomCutoff = Math.floor(n * 0.75);

  const result = new Map<string, SectorMomentumData>();
  entries.forEach((e, i) => {
    const momentum: SectorMomentum = i < topCutoff ? "strong" : i >= bottomCutoff ? "weak" : "neutral";
    result.set(e.sector, { ...e, momentum });
  });

  return result;
}

/**
 * Get quality score boost/penalty based on sector momentum.
 */
export function getSectorBoost(momentum: SectorMomentum): number {
  switch (momentum) {
    case "strong": return 4;
    case "weak": return -4;
    default: return 0;
  }
}

export { SECTOR_ETF_MAP };
