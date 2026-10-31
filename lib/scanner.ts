import { getTimeframeConfig, type ScanTimeframe } from "@/lib/timeframe-config";
import { fetchHistoricalData, fetchQuote, fetchFundamentals, fetchFinancialStatements, fetchExtendedData, fetchOptionsData, type OptionsData } from "@/lib/api/yahoo-finance";
import { getNewsSentiment, isMassiveConfigured, fetchTickerDetails, fetchMarketNews } from "@/lib/api/massive";
import { fetchCongressTrades, fetchInsiderData, WHALE_LIST, fetchWhalePortfolio } from "@/lib/api/smart-money";
import { isFredConfigured, fetchMacroSnapshot, type MacroSnapshot } from "@/lib/api/fred";
import { isFinnhubConfigured, fetchSocialSentiment } from "@/lib/api/finnhub";
import { isLiteLLMConfigured, analyzePickBatch, type PickSummary, type PickAIAnalysis } from "@/lib/api/claude";
import { calculateIndicators } from "@/lib/indicators";
import { getCached, setCache, getScannerTtl } from "@/lib/cache";
import { calculateValuation } from "@/lib/valuation";
import { calculateAltmanZ, calculatePiotroskiF } from "@/lib/financial-health";
import { calculatePeriodReturns } from "@/lib/momentum";
import { detectMarketRegime, getRegimeAdjustments, type MarketRegime, type MarketRegimeData } from "@/lib/market-regime";
import { calculateSectorMomentum, getSectorBoost, SECTOR_ETF_MAP, type SectorMomentumData } from "@/lib/sector-analysis";
import type { CompositeScore } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════
   SCAN UNIVERSE — ~500 core + dynamic trending
   Tiers:
     T1 (Priority): Mega-caps, popular, high-volume — scanned first
     T2 (Extended): Mid-caps, sector breadth — scanned second
     T3 (Exploratory): Small-caps, speculative, international — background
     Crypto: Major + alt coins
     Dynamic: Trending tickers discovered at runtime
   ══════════════════════════════════════════════════════════════ */

const T1_CORE = [
  // US Mega-Cap Tech
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "CRM",
  "ADBE", "CSCO", "ACN", "IBM", "INTU", "NOW", "UBER", "ABNB", "DASH",
  // US Semiconductors
  "AMD", "INTC", "QCOM", "MU", "MRVL", "AMAT", "LRCX", "KLAC", "NXPI", "ON",
  "SWKS", "TXN", "ADI", "MCHP", "ARM",
  // US Growth / Cloud / SaaS
  "PLTR", "SNOW", "NET", "DDOG", "CRWD", "ZS", "PANW", "COIN", "SQ", "SHOP",
  "ROKU", "PINS", "SNAP", "TTD", "MDB", "HUBS", "OKTA", "TWLO",
  // US Finance Top
  "JPM", "GS", "MS", "BAC", "V", "MA", "AXP", "BLK", "PYPL",
  // US Healthcare Top
  "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE",
  // US Consumer Top
  "NKE", "NFLX", "DIS", "COST", "WMT",
  // Speculative / Hype
  "NBIS", "IONQ", "RKLB", "SOFI", "HOOD", "MSTR", "SMCI", "APP",
  "RIVN", "LCID", "GME", "AMC",
];

const T2_EXTENDED = [
  // More Tech / Software
  "DOCN", "U", "RBLX", "DUOL", "PATH", "FROG", "BILL", "MNDY", "ZI", "ESTC",
  "CFLT", "S", "GTLB", "TOST", "GRAB", "SE", "MELI", "NU", "GLOB",
  // More Semis
  "GFS", "WOLF", "CRUS", "MPWR", "RMBS", "ONTO", "ACLS", "DIOD",
  // More Finance
  "WFC", "C", "USB", "PNC", "TFC", "SCHW", "KKR", "APO", "FIS", "GPN",
  "AFRM", "UPST", "LC", "ALLY", "IBKR",
  // More Healthcare / Biotech
  "TMO", "ABT", "AMGN", "GILD", "BMY", "VRTX", "REGN", "ISRG", "MDT", "SYK",
  "BSX", "DHR", "ZTS", "MRNA", "CRSP", "NTLA", "BEAM", "EDIT", "EXAS", "DXCM",
  "HIMS", "DOCS", "OSCR", "ACCD",
  // More Consumer / Retail
  "HD", "LOW", "TGT", "BKNG", "MAR", "CMG", "LULU", "DECK", "CROX", "EL",
  "PG", "KO", "PEP", "MCD", "SBUX", "YUM", "DPZ", "WING", "CAVA", "BROS",
  "ONON", "BIRD", "CELH", "MNST",
  // US Energy / Industrial / Defense
  "XOM", "CVX", "COP", "SLB", "EOG",
  "CAT", "BA", "GE", "LMT", "RTX", "NOC", "GD", "HII",
  "UNP", "UPS", "FDX", "DE", "HON",
  // US REIT / Utilities
  "AMT", "PLD", "CCI", "EQIX", "SPG", "O", "DLR",
  "NEE", "DUK", "SO", "AEP",
  // EU / DE Blue Chips
  "SAP", "ASML", "SIEGY", "TTE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE",
  "ADS.DE", "MBG.DE", "BMW.DE", "VOW3.DE", "RHM.DE", "IFX.DE",
  "SHEL", "AZN", "RIO", "BP",
  "MC.PA", "OR.PA", "AI.PA", "SAN.PA", "BNP.PA",
  "NOVN.SW", "NESN.SW", "ROG.SW",
];

const T3_EXPLORATORY = [
  // US Small / Mid Caps
  "SOFI", "CHPT", "PLUG", "FCEL", "BLNK", "QS", "LAZR", "VLDR",
  "OPEN", "OFPD", "PAYO", "SOUN", "BBAI", "JOBY", "LILM", "EVTL",
  "DNA", "ASTS", "RDW", "LUNR", "ASTR", "MNTS",
  "AI", "BIGC", "BMBL", "COUR", "DKNG", "FTNT", "GDRX", "LMND",
  "LYFT", "MAPS", "MTTR", "NKLA", "PCT", "PUBM", "RELY", "SNPS",
  "STEM", "VRT", "WDAY", "WKHS", "XPEV", "LI", "ZIM", "ZM",
  // Biotech Small Cap
  "AGEN", "ARCT", "FATE", "IOVA", "PCVX", "SAVA", "SGEN", "SRPT",
  // Cannabis / Alternative
  "TLRY", "CGC", "ACB", "CRON",
  // Mining / Materials
  "FCX", "NEM", "GOLD", "WPM", "FNV", "VALE", "BHP",
  "ALB", "LAC", "PLL", "MP", "UUUU", "CCJ", "LEU", "SMR",
  // EU / International Extended
  "HSBA.L", "ULVR.L", "GSK", "RDSB.L",
  "BABA", "JD", "PDD", "BIDU", "NIO", "TSM", "SONY", "TM",
  "GRAB", "CPNG", "BILL", "DOCU",
  // ETFs that represent sectors (scan for sector momentum)
  "XLK", "XLF", "XLV", "XLE", "XLI", "XLC", "XLRE", "XLP", "XLU", "XLB", "XLY",
  "SMH", "ARKK", "ARKG", "ARKF", "ARKW", "ARKQ",
  "TAN", "ICLN", "LIT", "REMX", "URA",
  // More international
  "RACE", "NVO", "LIN", "UL", "DEO", "BTI", "PM", "MO",
  "INFY", "WIT", "HDB", "IBN",
  "MELI", "NU", "STNE", "PAGS",
  "KWEBS", "FXI", "EWZ", "EWJ", "EWG",
  // SPACs / Recent IPOs (these rotate frequently)
  "IONQ", "RKLB", "JOBY", "AEHR", "VRT", "TOST",
];

export const CRYPTO = [
  "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD",
  "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "MATIC-USD",
  "LINK-USD", "UNI-USD", "ATOM-USD", "APT-USD", "ARB-USD",
  "OP-USD", "SUI-USD", "NEAR-USD", "FTM-USD", "INJ-USD",
  "AAVE-USD", "MKR-USD", "LDO-USD", "RNDR-USD", "FET-USD",
  "PEPE-USD", "WIF-USD", "BONK-USD", "FLOKI-USD", "SHIB-USD",
];

/* ── Long-term instruments (Gold, Bonds, Commodities, Dividend ETFs) ── */
export const LONG_TERM_INSTRUMENTS = [
  // Gold / Precious Metals
  "GLD", "IAU", "SLV", "GDX", "GDXJ",
  // Bonds / Treasuries
  "TLT", "IEF", "BND", "AGG", "TIP", "SHY", "LQD", "HYG",
  // Commodities
  "USO", "DBA", "DBC", "PDBC",
  // REITs
  "VNQ", "O", "SPG",
  // Dividend / Value ETFs
  "SCHD", "DVY", "HDV", "JEPI", "NOBL", "VIG", "VYM",
  // International Broad
  "VEA", "VWO", "EFA", "EEM",
];

/** Full universe deduplicated */
function getFullUniverse(): string[] {
  return [...new Set([...T1_CORE, ...T2_EXTENDED, ...T3_EXPLORATORY, ...CRYPTO])];
}

/** Get universe for a specific scan timeframe */
function getUniverseForTimeframe(tf: ScanTimeframe): string[] {
  switch (tf) {
    case "short":
      return [...new Set([...T1_CORE, ...CRYPTO])];
    case "long": {
      // Blue chips (T1 without speculative) + T2 blue chips + long-term instruments
      const speculative = new Set(["GME", "AMC", "MSTR", "SMCI", "IONQ", "RKLB", "RIVN", "LCID", "NBIS"]);
      const blueChips = [...T1_CORE, ...T2_EXTENDED].filter((t) => !speculative.has(t));
      return [...new Set([...blueChips, ...LONG_TERM_INSTRUMENTS])];
    }
    case "medium":
    default:
      return getFullUniverse();
  }
}

export const SCAN_UNIVERSE = getFullUniverse();

export interface ScanResult {
  ticker: string;
  name: string;
  price: number;
  signal: CompositeScore["signal"];
  score: number;
  confidence: CompositeScore["confidence"];
  convergence: number;
  entry: number;
  target: number;
  stop: number;
  kellySize: number;
  breakdown: CompositeScore["breakdown"];
  scannedAt: string;
  isCrypto: boolean;
  tier: "T1" | "T2" | "T3" | "crypto" | "trending";
  scanTimeframe: ScanTimeframe;
  // Extended data for smart timeframes & quality scoring
  atrPercent: number | null;
  trendStrength: "strong" | "moderate" | "weak" | "no_trend";
  rsiValue: number | null;
  volumeSignal: "high_volume" | "low_volume" | "normal";
  timeframe: string;
  riskReward: number;
  qualityScore: number;
  // Letter grade (A+ to F) — intuitive quality indicator
  grade: string;
  // Scenario analysis
  scenarios: {
    bull: number;   // optimistic target
    base: number;   // most likely target
    bear: number;   // pessimistic target
  };
  // Human-readable analysis
  reasonText: string;
  // Fundamentals (enriched for top picks)
  fundamentals?: {
    peRatio: number | null;
    revenueGrowth: number | null;
    profitMargin: number | null;
    analystRating: string | null;
    analystTarget: number | null;
    altmanZ?: number | null;
    piotroskiF?: number | null;
  };
  // News (enriched for top picks during full scan)
  newsHeadline?: string;
  newsImpact?: "bullish" | "bearish" | "neutral";
  // Sector data (from fundamentals enrichment)
  sector?: string;
  industry?: string;
  marketCap?: number;
  // Valuation (enriched for top picks)
  valuation?: {
    fairValue: number | null;
    marginOfSafety: number;
    verdict: "Unterbewertet" | "Fair bewertet" | "Überbewertet";
    models: { dcf: number | null; graham: number | null; lynch: number | null };
  };
  // Momentum returns (enriched for top picks)
  momentum?: {
    return1M: number | null;
    return3M: number | null;
    return12M: number | null;
  };
  // Market regime at time of scan
  regime?: MarketRegime;
  // Earnings data (Phase 3)
  earningsRevisions?: { currentQ: number; nextQ: number };
  earningsSurprises?: { consecutiveBeats: number; lastSurprise: number | null };
  recentUpgrades?: { net: number; count: number };
  earningsSoon?: boolean;
  // Options data (Phase 6)
  optionsData?: OptionsData;
  // Short interest & ownership data
  shortInterest?: {
    shortPercentOfFloat: number | null;
    shortRatio: number | null;
  };
  ownership?: {
    insiderPercent: number | null;
    institutionalPercent: number | null;
  };
  // Smart Money data (Phase 2)
  smartMoney?: {
    congressBuys: number;
    congressSells: number;
    insiderBuys: number;
    insiderSells: number;
    whaleHolders: string[];
  };
  // Social Sentiment (Phase 4)
  socialSentiment?: {
    score: number;
    buzz: "high" | "moderate" | "low";
    mentions: number;
  };
  // Company details (Phase 5)
  companyDetails?: {
    description: string;
    logoUrl: string | null;
    homepageUrl: string;
    employees: number;
  };
  // AI Analysis (Phase 6)
  aiAnalysis?: {
    justification: string;
    confidenceAdjustment: number;
    redFlags: string[];
    aiVerdict: "BESTAETIGT" | "VORSICHT" | "ABGELEHNT";
  };
}

export interface ScanSnapshot {
  date: string;
  results: ScanResult[];
  scannedAt: string;
  regime?: MarketRegimeData;
  macroSnapshot?: MacroSnapshot;
  marketNews?: { headline: string; sentiment: string }[];
}



/**
 * Discovers currently trending / most-active tickers via Yahoo Finance.
 * These rotate daily based on volume spikes, news, social media buzz.
 */
async function discoverTrending(): Promise<string[]> {
  const cacheKey = "scanner-trending";
  const cached = await getCached<string[]>(cacheKey, 4 * 60 * 60 * 1000); // 4h cache
  if (cached) return cached;

  try {
    const { default: YahooFinance } = await import("yahoo-finance2");
    const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trending: any = await yf.trendingSymbols("US", { count: 50 });
    const symbols: string[] = (trending?.quotes ?? [])
      .map((q: { symbol?: string }) => q.symbol)
      .filter(Boolean);

    await setCache(cacheKey, symbols);
    return symbols;
  } catch {
    return [];
  }
}

function getTier(ticker: string): ScanResult["tier"] {
  if (ticker.endsWith("-USD")) return "crypto";
  if (T1_CORE.includes(ticker)) return "T1";
  if (T2_EXTENDED.includes(ticker)) return "T2";
  if (T3_EXPLORATORY.includes(ticker)) return "T3";
  return "trending";
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert quality score (0-100) to letter grade (A+ to F).
 * Inspired by Nipun AI's grading system.
 */
function qualityToGrade(q: number): string {
  if (q >= 90) return "A+";
  if (q >= 82) return "A";
  if (q >= 75) return "A-";
  if (q >= 68) return "B+";
  if (q >= 60) return "B";
  if (q >= 53) return "B-";
  if (q >= 46) return "C+";
  if (q >= 40) return "C";
  if (q >= 33) return "C-";
  if (q >= 25) return "D+";
  if (q >= 18) return "D";
  if (q >= 10) return "D-";
  return "F";
}

/**
 * Calculate Bull/Base/Bear scenario targets based on ATR and score.
 * - Bull: aggressive target using 6× ATR
 * - Base: standard target using 4× ATR (same as suggestedTarget)
 * - Bear: conservative / worst-case using stop loss area
 */
function calcScenarios(
  price: number,
  atr: number,
  isBullish: boolean,
  mult?: { bull: number; base: number; bear: number },
): { bull: number; base: number; bear: number } {
  const m = mult ?? { bull: 6, base: 4, bear: 1.5 };
  if (isBullish) {
    return {
      bull: Math.round((price + atr * m.bull) * 100) / 100,
      base: Math.round((price + atr * m.base) * 100) / 100,
      bear: Math.round((price - atr * m.bear) * 100) / 100,
    };
  }
  // Bearish/short
  return {
    bull: Math.round((price - atr * m.bull) * 100) / 100,
    base: Math.round((price - atr * m.base) * 100) / 100,
    bear: Math.round((price + atr * m.bear) * 100) / 100,
  };
}

/**
 * Calculate a smart timeframe based on indicator data.
 * Factors: ATR volatility, trend strength, signal strength, asset type.
 */
function calcTimeframe(
  atrPercent: number | null,
  trendStrength: string,
  score: number,
  isCrypto: boolean,
): string {
  // Base: how volatile is this asset?
  const vol = atrPercent ?? 2.5;
  let baseDays: number;

  if (vol > 5) baseDays = 5;        // Very volatile → short-term
  else if (vol > 3) baseDays = 12;   // Moderate volatility
  else if (vol > 1.5) baseDays = 25; // Low volatility
  else baseDays = 40;                // Very stable

  // Trend strength modifier
  if (trendStrength === "strong") baseDays *= 1.3;      // Strong trends last longer
  else if (trendStrength === "weak" || trendStrength === "no_trend") baseDays *= 0.7;

  // Score magnitude — higher conviction → can hold longer
  const absScore = Math.abs(score);
  if (absScore >= 50) baseDays *= 1.2;
  else if (absScore < 25) baseDays *= 0.8;

  // Crypto moves faster
  if (isCrypto) baseDays *= 0.6;

  baseDays = Math.round(baseDays);

  // Convert to human-readable ranges
  if (baseDays <= 3) return "1–3 Tage";
  if (baseDays <= 7) return "3–7 Tage";
  if (baseDays <= 14) return "1–2 Wochen";
  if (baseDays <= 21) return "2–3 Wochen";
  if (baseDays <= 35) return "3–5 Wochen";
  if (baseDays <= 56) return "6–8 Wochen";
  return "2–3 Monate";
}

/**
 * Calculate a quality score (0-100) for ranking results.
 * Considers: signal strength, convergence, R/R ratio, confidence, volume confirmation.
 */
function calcQualityScore(
  score: number,
  convergence: number,
  riskReward: number,
  confidence: string,
  volumeSignal: string,
  trendStrength: string,
): number {
  let quality = 0;

  // Signal strength (0-30)
  quality += Math.min(30, Math.abs(score) * 0.3);

  // Convergence (0-25) — all 4 indicators agreeing is rare and valuable
  quality += convergence * 6.25;

  // Risk/Reward ratio (0-20) — higher is better, diminishing returns
  quality += Math.min(20, riskReward * 5);

  // Confidence (0-15)
  if (confidence === "hoch") quality += 15;
  else if (confidence === "mittel") quality += 8;

  // Volume confirmation (0-10) — high volume = more reliable signal
  if (volumeSignal === "high_volume") quality += 10;
  else if (volumeSignal === "normal") quality += 3;

  return Math.round(Math.min(100, quality));
}

/**
 * Generates a human-readable explanation of why this stock is a buy/sell/hold.
 * Translates raw indicator data into understandable text.
 */
function generateReason(
  signal: string,
  score: number,
  breakdown: CompositeScore["breakdown"],
  trendStrength: string,
  volumeSignal: string,
  rsiValue: number | null,
  atrPercent: number | null,
  convergence: number,
  riskReward: number,
  isCrypto: boolean,
): string {
  const parts: string[] = [];
  const isBuy = signal.includes("BUY");
  const isSell = signal.includes("SELL");

  // Trend description
  if (breakdown.trend >= 15) parts.push("Starker Aufwärtstrend");
  else if (breakdown.trend >= 5) parts.push("Aufwärtstrend");
  else if (breakdown.trend <= -15) parts.push("Starker Abwärtstrend");
  else if (breakdown.trend <= -5) parts.push("Abwärtstrend");
  else parts.push("Seitwärtsbewegung");

  // Trend strength qualifier
  if (trendStrength === "strong") parts[0] += " (klar bestätigt)";

  // Momentum
  if (breakdown.momentum >= 10) parts.push("Momentum steigt");
  else if (breakdown.momentum <= -10) parts.push("Momentum fällt");
  else if (breakdown.momentum >= 5) parts.push("leichtes Aufwärtsmomentum");
  else if (breakdown.momentum <= -5) parts.push("leichtes Abwärtsmomentum");

  // RSI context
  if (rsiValue !== null) {
    if (rsiValue > 70) parts.push(`RSI ${rsiValue.toFixed(0)} (überkauft)`);
    else if (rsiValue < 30) parts.push(`RSI ${rsiValue.toFixed(0)} (überverkauft)`);
    else if (isBuy && rsiValue < 50) parts.push(`RSI ${rsiValue.toFixed(0)} — Raum nach oben`);
    else if (isSell && rsiValue > 50) parts.push(`RSI ${rsiValue.toFixed(0)} — Raum nach unten`);
  }

  // Volume
  if (volumeSignal === "high_volume") {
    parts.push(isBuy ? "hohes Kaufvolumen bestätigt" : isSell ? "hohes Verkaufsvolumen" : "hohes Volumen");
  } else if (volumeSignal === "low_volume") {
    parts.push("geringes Volumen — Vorsicht");
  }

  // Volatility/Risk context
  if (atrPercent !== null) {
    if (atrPercent > 5) parts.push(`hohe Volatilität (${atrPercent.toFixed(1)}%/Tag)`);
    else if (atrPercent > 3) parts.push(`moderate Volatilität`);
    else parts.push(`geringe Volatilität — stabiler Kurs`);
  }

  // Convergence
  if (convergence >= 4) parts.push("alle 4 Indikatoren einig");
  else if (convergence >= 3) parts.push(`${convergence}/4 Indikatoren einig`);

  // R/R
  if (riskReward >= 3) parts.push(`starkes R/R 1:${riskReward.toFixed(1)}`);
  else if (riskReward >= 2) parts.push(`gutes R/R 1:${riskReward.toFixed(1)}`);

  return parts.join(". ") + ".";
}

/**
 * Scans a batch of tickers and returns results.
 * Core building block used by both quick and full scans.
 * Uses small batches with delays to avoid Yahoo Finance rate limiting.
 */
export async function scanBatch(tickers: string[], delayMs = 1500, timeframe: ScanTimeframe = "medium"): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const batchSize = 5; // Small batches to stay under rate limits
  let failed = 0;
  const tfConfig = getTimeframeConfig(timeframe);
  const indicatorParams = {
    smaPeriods: tfConfig.smaPeriods,
    rsiPeriod: tfConfig.rsiPeriod,
    stochPeriod: tfConfig.stochPeriod,
    stochSignalPeriod: tfConfig.stochSignalPeriod,
    macdPeriods: tfConfig.macdPeriods,
    atrPeriod: tfConfig.atrPeriod,
    bbPeriod: tfConfig.bbPeriod,
    atrStopMultiplier: tfConfig.atrStopMultiplier,
    atrTargetMultiplier: tfConfig.atrTargetMultiplier,
  };

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          // fetchQuote returns shortName from the same yf.quote() call
          // so we only need 2 Yahoo calls per ticker (chart + quote) instead of 3
          const [ohlcv, quote] = await Promise.all([
            fetchHistoricalData(ticker, tfConfig.dataYears),
            fetchQuote(ticker),
          ]);

          if (ohlcv.length < tfConfig.minDataPoints || !quote) return null;

          const closes = ohlcv.map((d) => d.close);
          const volumes = ohlcv.map((d) => d.volume);
          const highs = ohlcv.map((d) => d.high);
          const lows = ohlcv.map((d) => d.low);
          const indicators = calculateIndicators(closes, volumes, highs, lows, indicatorParams);
          const cs = indicators.compositeScore;
          const v = indicators.latestValues;
          const s = indicators.signals;

          // Calculate R/R ratio
          const isShort = cs.score < 0;
          let riskReward = 0;
          if (isShort) {
            const risk = cs.suggestedStop - cs.suggestedEntry;
            const reward = cs.suggestedEntry - cs.suggestedTarget;
            riskReward = risk > 0 && reward > 0 ? reward / risk : 0;
          } else {
            const risk = cs.suggestedEntry - cs.suggestedStop;
            const reward = cs.suggestedTarget - cs.suggestedEntry;
            riskReward = risk > 0 && reward > 0 ? reward / risk : 0;
          }

          const atrPercent = v.atrPercent;
          const trendStrength = s.trendStrength;
          const volumeSignal = s.volumeSignal;
          const rsiValue = v.rsi;

          const holdingTimeframe = timeframe === "medium"
            ? calcTimeframe(atrPercent, trendStrength, cs.score, ticker.endsWith("-USD"))
            : tfConfig.holdingPeriod;
          const qualityScore = calcQualityScore(cs.score, cs.convergence, riskReward, cs.confidence, volumeSignal, trendStrength);
          const reasonText = generateReason(cs.signal, cs.score, cs.breakdown, trendStrength, volumeSignal, rsiValue, atrPercent, cs.convergence, riskReward, ticker.endsWith("-USD"));
          const grade = qualityToGrade(qualityScore);
          const atr = v.atr ?? quote.priceEur * 0.02;
          const scenarios = calcScenarios(quote.priceEur, atr, cs.score > 0, {
            bull: tfConfig.scenarioBull,
            base: tfConfig.scenarioBase,
            bear: tfConfig.scenarioBear,
          });

          return {
            ticker,
            name: quote.shortName,
            price: quote.priceEur,
            signal: cs.signal,
            score: cs.score,
            confidence: cs.confidence,
            convergence: cs.convergence,
            entry: cs.suggestedEntry,
            target: cs.suggestedTarget,
            stop: cs.suggestedStop,
            kellySize: cs.kellySize,
            breakdown: cs.breakdown,
            scannedAt: new Date().toISOString(),
            isCrypto: ticker.endsWith("-USD"),
            tier: getTier(ticker),
            scanTimeframe: timeframe,
            atrPercent,
            trendStrength,
            rsiValue,
            volumeSignal,
            timeframe: holdingTimeframe,
            riskReward: Math.round(riskReward * 10) / 10,
            qualityScore,
            grade,
            scenarios,
            reasonText,
          } satisfies ScanResult;
        } catch {
          failed++;
          return null;
        }
      })
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < tickers.length) {
      await sleep(delayMs);
    }
  }

  if (failed > 0) {
    console.log(`Scanner: ${results.length} OK, ${failed} fehlgeschlagen von ${tickers.length} Tickern`);
  }

  return results;
}

/**
 * Quick scan: T1 core + crypto only (~100 tickers, ~1-2 min).
 * Used for fast dashboard loads. Returns cached if available.
 */
export async function scanQuick(timeframe: ScanTimeframe = "short"): Promise<ScanResult[]> {
  const cacheKey = `scanner-quick-${timeframe}`;
  const cached = await getCached<ScanResult[]>(cacheKey, getScannerTtl());
  if (cached) return cached;

  const tickers = getUniverseForTimeframe(timeframe).slice(0, 150); // Cap for speed
  const results = await scanBatch(tickers, 1500, timeframe);
  results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  await setCache(cacheKey, results);
  return results;
}

/**
 * Full scan: All tiers + trending (~500+ tickers, ~10-30 min).
 * Detects market regime from SPY data and adjusts thresholds dynamically.
 * Pass force=true to bypass cache (used by manual "Scan jetzt" button).
 */
export async function scanUniverse(
  tickers?: string[],
  force = false,
  timeframe: ScanTimeframe = "medium",
): Promise<{ results: ScanResult[]; regime: MarketRegimeData | null }> {
  const cacheKey = `scanner-latest-${timeframe}`;
  if (!force) {
    const cached = await getCached<ScanResult[]>(cacheKey, getScannerTtl());
    if (cached && !tickers) {
      const cachedRegime = await getCached<MarketRegimeData>("scanner-regime", getScannerTtl());
      return { results: cached, regime: cachedRegime };
    }
  }

  // ── Load FRED macro data (before regime) ──
  let macroData: MacroSnapshot | null = null;
  if (isFredConfigured()) {
    try {
      macroData = await fetchMacroSnapshot();
      console.log(`Scanner: FRED Macro — VIX: ${macroData.vix}, Spread: ${macroData.treasurySpread}, Fed Rate: ${macroData.fedFundsRate}`);
    } catch {
      console.log("Scanner: FRED fetch failed, continuing without macro data");
    }
  }

  // ── Detect market regime from SPY ──
  let regimeData: MarketRegimeData | null = null;
  try {
    const spyOhlcv = await fetchHistoricalData("SPY", 2);
    if (spyOhlcv.length > 200) {
      const spyCloses = spyOhlcv.map((d) => d.close);
      const spyHighs = spyOhlcv.map((d) => d.high);
      const spyLows = spyOhlcv.map((d) => d.low);
      regimeData = detectMarketRegime(spyCloses, spyHighs, spyLows, undefined, macroData);
      console.log(`Scanner: Market Regime = ${regimeData.regime} (VIX proxy: ${regimeData.vixProxy}%, breadth: ${regimeData.breadth}%)`);
    }
  } catch {
    console.log("Scanner: Could not detect market regime, using defaults");
  }

  let universe: string[];

  if (tickers) {
    universe = tickers;
  } else {
    // Trending discovery only for medium timeframe
    const trending = timeframe === "medium" ? await discoverTrending() : [];
    const base = getUniverseForTimeframe(timeframe);
    universe = [...new Set([...base, ...trending])];
  }

  const results = await scanBatch(universe, undefined, timeframe);

  // ── Calculate breadth and update regime ──
  if (regimeData && results.length > 50) {
    let aboveSma200 = 0;
    let total = 0;
    for (const r of results) {
      if (!r.isCrypto && r.score !== 0) {
        total++;
        // Stocks in uptrend (above SMA200) contribute to breadth
        if (r.breakdown.trend > 0) aboveSma200++;
      }
    }
    const breadth = total > 0 ? (aboveSma200 / total) * 100 : 50;
    // Re-detect regime with actual breadth data
    try {
      const spyOhlcv = await fetchHistoricalData("SPY", 2);
      if (spyOhlcv.length > 200) {
        regimeData = detectMarketRegime(
          spyOhlcv.map((d) => d.close),
          spyOhlcv.map((d) => d.high),
          spyOhlcv.map((d) => d.low),
          breadth,
          macroData,
        );
        console.log(`Scanner: Updated Regime = ${regimeData.regime} (breadth: ${Math.round(breadth)}%)`);
      }
    } catch {
      // Keep initial regime
    }
  }

  // Apply regime to results
  if (regimeData) {
    for (const r of results) r.regime = regimeData.regime;
  }

  // ── Calculate sector momentum from ETF results ──
  const sectorMomentum = new Map<string, SectorMomentumData>();
  const sectorReturns = new Map<string, number>();
  for (const [sector, etf] of Object.entries(SECTOR_ETF_MAP)) {
    const etfResult = results.find((r) => r.ticker === etf);
    if (etfResult && etfResult.breakdown.trend !== 0) {
      // Use trend score as a proxy for 1M return direction
      sectorReturns.set(sector, etfResult.breakdown.trend);
    }
  }
  if (sectorReturns.size >= 3) {
    const momData = calculateSectorMomentum(sectorReturns);
    for (const [k, v] of momData) sectorMomentum.set(k, v);
    console.log(`Scanner: Sector momentum calculated for ${sectorMomentum.size} sectors`);
  }

  results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  // Enrich top candidates with fundamentals + research
  const topCandidates = results
    .filter((r) => r.signal !== "HOLD")
    .slice(0, 25);

  if (topCandidates.length > 0) {
    console.log(`Scanner: Enriching ${topCandidates.length} top candidates with fundamentals...`);
    await enrichWithFundamentals(topCandidates, sectorMomentum);

    // Re-sort by quality after fundamental boost
    results.sort((a, b) => b.qualityScore - a.qualityScore);

    // News sentiment enrichment for the very best (only full scan, not custom tickers)
    if (!tickers) {
      const topForNews = results
        .filter((r) => r.signal !== "HOLD" && r.qualityScore >= 40)
        .slice(0, 15);
      if (topForNews.length > 0) {
        console.log(`Scanner: Fetching news sentiment for ${topForNews.length} top picks via Massive...`);
        await enrichWithNewsSentiment(topForNews);
      }
    }

    // Options data enrichment for top non-crypto picks
    const topForOptions = results
      .filter((r) => !r.isCrypto && r.signal !== "HOLD" && r.qualityScore >= 40)
      .slice(0, 10);
    if (topForOptions.length > 0) {
      console.log(`Scanner: Fetching options data for ${topForOptions.length} top picks...`);
      await enrichWithOptionsData(topForOptions);
    }

    // Smart Money enrichment (Congress, Insider, Whales)
    const topForSmartMoney = results
      .filter((r) => !r.isCrypto && r.signal !== "HOLD" && r.qualityScore >= 35)
      .slice(0, 15);
    if (topForSmartMoney.length > 0) {
      console.log(`Scanner: Enriching ${topForSmartMoney.length} picks with Smart Money data...`);
      await enrichWithSmartMoney(topForSmartMoney);
    }

    // Social Sentiment enrichment (Finnhub)
    if (isFinnhubConfigured()) {
      const topForSocial = results
        .filter((r) => !r.isCrypto && r.signal !== "HOLD" && r.qualityScore >= 35)
        .slice(0, 15);
      if (topForSocial.length > 0) {
        console.log(`Scanner: Fetching social sentiment for ${topForSocial.length} picks...`);
        await enrichWithSocialSentiment(topForSocial);
      }
    }

    // Company details enrichment (Massive API)
    if (isMassiveConfigured()) {
      const topForDetails = results
        .filter((r) => !r.isCrypto && r.signal !== "HOLD" && r.qualityScore >= 40)
        .slice(0, 15);
      if (topForDetails.length > 0) {
        console.log(`Scanner: Fetching company details for ${topForDetails.length} picks...`);
        await enrichWithCompanyDetails(topForDetails);
      }
    }

    // AI Batch Analysis (LAST — uses all enriched data)
    if (isLiteLLMConfigured()) {
      const topForAI = results
        .filter((r) => r.signal !== "HOLD" && r.qualityScore >= 40)
        .slice(0, 15);
      if (topForAI.length > 0) {
        console.log(`Scanner: Running AI analysis for ${topForAI.length} top picks...`);
        await enrichWithAIAnalysis(topForAI, regimeData);
      }
    }

    // Final re-sort after all enrichment
    results.sort((a, b) => b.qualityScore - a.qualityScore);
  }

  if (!tickers) {
    await setCache(cacheKey, results);
    if (regimeData) await setCache("scanner-regime", regimeData);
  }

  return { results, regime: regimeData };
}

/**
 * Returns the top N buy and short opportunities, filtered by quality.
 * Uses regime-aware thresholds when market regime is provided.
 * Enforces sector diversification: max 3 per sector.
 */
export function getTopPicks(results: ScanResult[], n = 8, regime?: MarketRegime) {
  const adj = regime ? getRegimeAdjustments(regime) : { qualityThresholdMin: 35, convergenceMinimum: 2 };
  const minQuality = adj.qualityThresholdMin;
  const minConvergence = adj.convergenceMinimum;
  const maxPerSector = 3;

  function diversifiedTopN(items: ScanResult[], limit: number): ScanResult[] {
    const sectorCount = new Map<string, number>();
    const picked: ScanResult[] = [];
    for (const r of items) {
      if (picked.length >= limit) break;
      const sector = r.sector ?? "Unknown";
      const count = sectorCount.get(sector) ?? 0;
      if (count >= maxPerSector) continue;
      picked.push(r);
      sectorCount.set(sector, count + 1);
    }
    return picked;
  }

  const buys = diversifiedTopN(
    results
      .filter((r) => (r.signal === "STRONG BUY" || r.signal === "BUY") && r.qualityScore >= minQuality && r.convergence >= minConvergence)
      .sort((a, b) => b.qualityScore - a.qualityScore),
    n,
  );

  const shorts = diversifiedTopN(
    results
      .filter((r) => (r.signal === "STRONG SELL" || r.signal === "SELL") && r.qualityScore >= minQuality && r.convergence >= minConvergence)
      .sort((a, b) => b.qualityScore - a.qualityScore),
    n,
  );

  const holds = results
    .filter((r) => r.signal === "HOLD")
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 3);

  return { buys, shorts, holds };
}

/**
 * Enriches top picks with fundamental data from Yahoo Finance.
 * Called after the technical scan to add PE, growth, margins, analyst ratings.
 * Boosts quality score for fundamentally strong stocks.
 */
async function enrichWithFundamentals(
  results: ScanResult[],
  sectorMomentum?: Map<string, SectorMomentumData>,
): Promise<void> {
  const batchSize = 3;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        try {
          if (r.isCrypto) return;
          const [f, statements] = await Promise.all([
            fetchFundamentals(r.ticker),
            fetchFinancialStatements(r.ticker).catch(() => null),
          ]);
          if (!f) return;

          // Use proper calculations when we have full financial statements
          const altmanZ = statements ? calculateAltmanZ(statements, f.marketCap) : null;
          const piotroskiF = statements ? calculatePiotroskiF(statements) : null;

          r.fundamentals = {
            peRatio: f.peRatio,
            revenueGrowth: f.revenueGrowth,
            profitMargin: f.profitMargin,
            analystRating: f.recommendationKey,
            analystTarget: f.targetMeanPrice,
            altmanZ: altmanZ?.score ?? null,
            piotroskiF: piotroskiF?.score ?? null,
          };

          // Store sector data for heatmap
          r.sector = f.sector || undefined;
          r.industry = f.industry || undefined;
          r.marketCap = f.marketCap || undefined;

          // Sector momentum boost
          if (sectorMomentum && r.sector) {
            const sm = sectorMomentum.get(r.sector);
            if (sm) {
              const sectorBoost = getSectorBoost(sm.momentum);
              r.qualityScore = Math.min(100, Math.max(0, r.qualityScore + sectorBoost));
            }
          }

          // Momentum returns from OHLCV data already in memory
          try {
            const ohlcv = await fetchHistoricalData(r.ticker, 2);
            if (ohlcv.length > 50) {
              const closes = ohlcv.map((d) => d.close);
              const returns = calculatePeriodReturns(closes);
              r.momentum = {
                return1M: returns.oneMonth,
                return3M: returns.threeMonth,
                return12M: returns.twelveMonth,
              };
            }
          } catch {
            // Momentum optional
          }

          // Earnings revisions, surprises, analyst upgrades (Phase 3)
          try {
            const ext = await fetchExtendedData(r.ticker);
            if (ext) {
              // EPS Revision Momentum
              const currentQ = ext.earningsTrend.find((t) => t.period === "0q");
              const nextQ = ext.earningsTrend.find((t) => t.period === "+1q");
              const revCurrent = currentQ ? currentQ.epsRevisions.upLast30 - currentQ.epsRevisions.downLast30 : 0;
              const revNext = nextQ ? nextQ.epsRevisions.upLast30 - nextQ.epsRevisions.downLast30 : 0;
              r.earningsRevisions = { currentQ: revCurrent, nextQ: revNext };

              // Earnings Surprise Pattern (consecutive beats/misses)
              const history = ext.earningsHistory.filter((e) => e.surprisePercent !== null);
              let consecutiveBeats = 0;
              for (let j = history.length - 1; j >= 0; j--) {
                if (history[j].surprisePercent! > 0) consecutiveBeats++;
                else break;
              }
              const lastSurprise = history.length > 0 ? history[history.length - 1].surprisePercent : null;
              r.earningsSurprises = { consecutiveBeats, lastSurprise };

              // Analyst Upgrades/Downgrades (last 30 days)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              const recentActions = ext.upgradeDowngradeHistory.filter(
                (u) => new Date(u.date) >= thirtyDaysAgo
              );
              let upgrades = 0;
              let downgrades = 0;
              for (const u of recentActions) {
                if (u.action === "upgrade" || u.action === "init" || u.action === "reiterated") upgrades++;
                else if (u.action === "downgrade") downgrades++;
              }
              r.recentUpgrades = { net: upgrades - downgrades, count: recentActions.length };

              // Earnings proximity (within 14 days)
              if (ext.calendarEvents.earningsDate) {
                const earningsDate = new Date(ext.calendarEvents.earningsDate);
                const daysToEarnings = (earningsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                if (daysToEarnings >= 0 && daysToEarnings <= 14) {
                  r.earningsSoon = true;
                }
              }
            }
          } catch {
            // Extended data optional
          }

          // Boost quality score based on fundamentals
          let boost = 0;

          // Analyst consensus aligns with technical signal
          if (r.signal.includes("BUY") && (f.recommendationKey === "buy" || f.recommendationKey === "strong_buy")) {
            boost += 8;
          } else if (r.signal.includes("SELL") && (f.recommendationKey === "sell" || f.recommendationKey === "underperform")) {
            boost += 8;
          }

          // Reasonable valuation for buys
          if (r.signal.includes("BUY")) {
            if (f.peRatio !== null && f.peRatio > 0 && f.peRatio < 25) boost += 5;
            if (f.revenueGrowth !== null && f.revenueGrowth > 0.1) boost += 5;
            if (f.profitMargin !== null && f.profitMargin > 0.15) boost += 3;
          }

          // For sells, high valuation confirms bearish thesis
          if (r.signal.includes("SELL")) {
            if (f.peRatio !== null && f.peRatio > 50) boost += 5;
            if (f.revenueGrowth !== null && f.revenueGrowth < 0) boost += 5;
          }

          // Analyst target confirms direction
          if (f.targetMeanPrice !== null && r.price > 0) {
            const targetDiff = (f.targetMeanPrice - r.price) / r.price;
            if (r.signal.includes("BUY") && targetDiff > 0.15) boost += 5;
            if (r.signal.includes("SELL") && targetDiff < -0.1) boost += 5;
          }

          // Financial health boost (now using proper scores)
          const altZ = r.fundamentals.altmanZ;
          const pioF = r.fundamentals.piotroskiF;
          if (altZ != null && altZ > 2.99) boost += 4;  // Safe zone (proper threshold)
          else if (altZ != null && altZ < 1.81) boost -= 3;  // Distress zone
          if (pioF != null && pioF >= 7) boost += 4;  // Strong financials
          else if (pioF != null && pioF <= 3) boost -= 3;  // Weak financials

          // Earnings revision momentum boost
          if (r.earningsRevisions) {
            const { currentQ, nextQ } = r.earningsRevisions;
            if (currentQ > 2 && nextQ > 2) boost += 8;      // Both quarters upward revisions
            else if (currentQ > 2 || nextQ > 2) boost += 5;  // One quarter strong
            else if (currentQ < -2 || nextQ < -2) boost -= 5; // Downward revisions
          }

          // Earnings surprise pattern boost
          if (r.earningsSurprises) {
            if (r.earningsSurprises.consecutiveBeats >= 4) boost += 6;
            else if (r.earningsSurprises.consecutiveBeats >= 2) boost += 3;
            if (r.earningsSurprises.lastSurprise !== null && r.earningsSurprises.lastSurprise > 10) boost += 4;
            if (r.earningsSurprises.lastSurprise !== null && r.earningsSurprises.lastSurprise < -5) boost -= 4;
          }

          // Recent analyst upgrades/downgrades
          if (r.recentUpgrades) {
            if (r.recentUpgrades.net >= 2) boost += 5;
            else if (r.recentUpgrades.net <= -2) boost -= 5;
          }

          // Short interest scoring
          if (f.shortPercentOfFloat != null) {
            r.shortInterest = { shortPercentOfFloat: f.shortPercentOfFloat, shortRatio: f.shortRatio };
            if (f.shortPercentOfFloat > 0.15 && r.signal.includes("BUY")) {
              boost += 4; // Short squeeze potential
            }
            if (f.shortRatio != null && f.shortRatio > 5) {
              boost += 3; // High days-to-cover
            }
          }

          // Enterprise valuation scoring
          if (f.enterpriseToRevenue != null && f.enterpriseToRevenue > 0 && f.enterpriseToRevenue < 3) {
            boost += 3; // Cheap enterprise valuation
          }

          // Ownership scoring
          if (f.heldPercentInsiders != null || f.heldPercentInstitutions != null) {
            r.ownership = { insiderPercent: f.heldPercentInsiders, institutionalPercent: f.heldPercentInstitutions };
            if (f.heldPercentInsiders != null && f.heldPercentInsiders > 0.10) {
              boost += 2; // Management aligned
            }
          }

          // Valuation models (DCF, Graham, Lynch)
          const val = calculateValuation(f, r.price, f.beta, r.atrPercent, f.sector);
          if (val.consensus.fairValue !== null) {
            r.valuation = {
              fairValue: val.consensus.fairValue,
              marginOfSafety: val.consensus.marginOfSafety,
              verdict: val.consensus.verdict,
              models: {
                dcf: val.dcf.fairValue,
                graham: val.graham.fairValue,
                lynch: val.lynch.fairValue,
              },
            };
            // Valuation aligning with signal boosts quality
            if (r.signal.includes("BUY") && val.consensus.verdict === "Unterbewertet") {
              boost += 8;
            } else if (r.signal.includes("SELL") && val.consensus.verdict === "Überbewertet") {
              boost += 8;
            } else if (
              (r.signal.includes("BUY") && val.consensus.verdict === "Überbewertet") ||
              (r.signal.includes("SELL") && val.consensus.verdict === "Unterbewertet")
            ) {
              boost -= 5;
            }
          }

          r.qualityScore = Math.min(100, Math.max(0, r.qualityScore + boost));
          r.grade = qualityToGrade(r.qualityScore); // Recalculate grade

          // Append fundamental context to reason
          const fParts: string[] = [];
          if (f.peRatio !== null && f.peRatio > 0) fParts.push(`KGV ${f.peRatio.toFixed(1)}`);
          if (f.revenueGrowth !== null) fParts.push(`Umsatz ${f.revenueGrowth > 0 ? "+" : ""}${(f.revenueGrowth * 100).toFixed(0)}%`);
          if (f.recommendationKey) {
            const labels: Record<string, string> = { strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", underperform: "Sell", sell: "Strong Sell" };
            fParts.push(`Analysten: ${labels[f.recommendationKey] ?? f.recommendationKey}`);
          }
          if (f.targetMeanPrice !== null) fParts.push(`Kursziel ${f.targetMeanPrice.toFixed(0)}$`);
          if (altZ != null) fParts.push(`Z-Score ${altZ.toFixed(1)}${altmanZ ? ` (${altmanZ.zone === "safe" ? "sicher" : altmanZ.zone === "grey" ? "grau" : "gefährdet"})` : ""}`);
          if (pioF != null) fParts.push(`Piotroski ${pioF}/9`);
          if (r.valuation?.fairValue != null) {
            fParts.push(`Fair Value ${r.valuation.fairValue.toFixed(1)} (${r.valuation.verdict})`);
          }
          if (r.momentum?.return1M != null) {
            fParts.push(`1M ${r.momentum.return1M > 0 ? "+" : ""}${r.momentum.return1M.toFixed(1)}%`);
          }
          if (r.earningsRevisions) {
            const netRev = r.earningsRevisions.currentQ + r.earningsRevisions.nextQ;
            if (netRev > 0) fParts.push(`EPS Revisionen ↑${netRev}`);
            else if (netRev < 0) fParts.push(`EPS Revisionen ↓${Math.abs(netRev)}`);
          }
          if (r.earningsSurprises && r.earningsSurprises.consecutiveBeats >= 2) {
            fParts.push(`${r.earningsSurprises.consecutiveBeats}× Beat`);
          }
          if (r.recentUpgrades && r.recentUpgrades.net !== 0) {
            fParts.push(`${r.recentUpgrades.net > 0 ? "+" : ""}${r.recentUpgrades.net} Upgrades (30T)`);
          }
          if (r.earningsSoon) {
            fParts.push("⚡ Earnings bald");
          }
          if (sectorMomentum && r.sector) {
            const sm = sectorMomentum.get(r.sector);
            if (sm && sm.momentum !== "neutral") {
              fParts.push(`Sektor ${sm.momentum === "strong" ? "↑ stark" : "↓ schwach"}`);
            }
          }
          if (r.shortInterest?.shortPercentOfFloat != null && r.shortInterest.shortPercentOfFloat > 0.10) {
            fParts.push(`Short ${(r.shortInterest.shortPercentOfFloat * 100).toFixed(0)}%`);
          }
          if (f.enterpriseToRevenue != null && f.enterpriseToRevenue > 0 && f.enterpriseToRevenue < 3) {
            fParts.push(`EV/Rev ${f.enterpriseToRevenue.toFixed(1)}`);
          }
          if (r.ownership?.insiderPercent != null && r.ownership.insiderPercent > 0.05) {
            fParts.push(`Insider ${(r.ownership.insiderPercent * 100).toFixed(0)}%`);
          }
          if (fParts.length > 0) {
            r.reasonText += ` | ${fParts.join(", ")}`;
          }
        } catch {
          // Fundamentals optional
        }
      })
    );
    if (i + batchSize < results.length) await sleep(1000);
  }
}

/**
 * Enriches top picks with options data (IV, Put/Call Ratio, Max Pain).
 * Uses contrarian P/C signals to adjust quality score.
 */
async function enrichWithOptionsData(results: ScanResult[]): Promise<void> {
  for (const r of results) {
    try {
      const opts = await fetchOptionsData(r.ticker);
      if (!opts) continue;

      r.optionsData = opts;

      // Contrarian Put/Call signals
      if (opts.putCallRatio !== null) {
        const isBuy = r.signal.includes("BUY");
        const isSell = r.signal.includes("SELL");

        if (opts.putCallRatio > 1.5) {
          // High P/C = lots of puts = contrarian bullish
          if (isBuy) r.qualityScore = Math.min(100, r.qualityScore + 4);
          else if (isSell) r.qualityScore = Math.max(0, r.qualityScore - 2);
        } else if (opts.putCallRatio < 0.5) {
          // Low P/C = lots of calls = contrarian bearish
          if (isSell) r.qualityScore = Math.min(100, r.qualityScore + 4);
          else if (isBuy) r.qualityScore = Math.max(0, r.qualityScore - 2);
        }
      }

      r.grade = qualityToGrade(r.qualityScore);
    } catch {
      // Options data optional
    }
    await sleep(500);
  }
}

/**
 * Enriches top picks with Massive API news sentiment.
 * Uses built-in AI sentiment analysis from massive.com — no extra LLM calls needed.
 */
async function enrichWithNewsSentiment(results: ScanResult[]): Promise<void> {
  if (!isMassiveConfigured()) return;

  for (const r of results) {
    try {
      const sentiment = await getNewsSentiment(r.ticker);
      if (sentiment.topHeadline) {
        r.newsHeadline = sentiment.topHeadline;
        r.newsImpact = sentiment.overall === "bullish" ? "bullish"
          : sentiment.overall === "bearish" ? "bearish"
          : "neutral";

        // News aligning with signal boosts quality; contradicting penalizes
        if (r.signal.includes("BUY") && sentiment.overall === "bullish") {
          r.qualityScore = Math.min(100, r.qualityScore + 7);
        } else if (r.signal.includes("SELL") && sentiment.overall === "bearish") {
          r.qualityScore = Math.min(100, r.qualityScore + 7);
        } else if (
          (r.signal.includes("BUY") && sentiment.overall === "bearish") ||
          (r.signal.includes("SELL") && sentiment.overall === "bullish")
        ) {
          r.qualityScore = Math.max(0, r.qualityScore - 10);
          r.reasonText += ` ⚠ News-Sentiment widerspricht Signal (${sentiment.bullish}× bullish, ${sentiment.bearish}× bearish)`;
        }
      }
    } catch {
      // News optional
    }
    await sleep(500); // Gentle with API
  }
}

/**
 * Enriches top picks with Smart Money data (Congress, Insider, Whales).
 */
async function enrichWithSmartMoney(results: ScanResult[]): Promise<void> {
  // Load congress trades once (cached 4h)
  let congressTrades: Awaited<ReturnType<typeof fetchCongressTrades>> = [];
  try {
    congressTrades = await fetchCongressTrades();
  } catch {
    // Congress API optional
  }

  // Load whale portfolios once (cached 7d)
  const whaleTickerMap = new Map<string, string[]>();
  try {
    const portfolios = await Promise.all(
      WHALE_LIST.map((w) => fetchWhalePortfolio(w.id).catch(() => null))
    );
    for (const p of portfolios) {
      if (!p) continue;
      for (const h of p.holdings.slice(0, 50)) {
        const existing = whaleTickerMap.get(h.ticker) ?? [];
        existing.push(p.whale.name);
        whaleTickerMap.set(h.ticker, existing);
      }
    }
  } catch {
    // Whale data optional
  }

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const r of results) {
    try {
      let boost = 0;
      const smParts: string[] = [];
      let congressBuys = 0;
      let congressSells = 0;
      let insiderBuys = 0;
      let insiderSells = 0;
      const whaleHolders: string[] = whaleTickerMap.get(r.ticker) ?? [];

      // Congress trades (last 60 days)
      const tickerCongress = congressTrades.filter(
        (t) => t.ticker === r.ticker && new Date(t.transactionDate) >= sixtyDaysAgo
      );
      for (const t of tickerCongress) {
        if (t.transaction.toLowerCase().includes("purchase")) congressBuys++;
        else if (t.transaction.toLowerCase().includes("sale")) congressSells++;
      }

      // Insider data (cached 24h)
      try {
        const insider = await fetchInsiderData(r.ticker);
        if (insider) {
          const recentTxns = insider.transactions.filter(
            (t) => t.date && new Date(t.date) >= ninetyDaysAgo
          );
          for (const t of recentTxns) {
            if (t.type === "buy") insiderBuys++;
            else if (t.type === "sell") insiderSells++;
          }
        }
      } catch {
        // Insider data optional
      }

      // Scoring
      if (insiderBuys >= 3 && insiderSells === 0) { boost += 8; smParts.push(`${insiderBuys}× Insider Buy`); }
      else if (insiderBuys >= 2) { boost += 4; smParts.push(`${insiderBuys}× Insider Buy`); }
      if (insiderSells > insiderBuys * 2 && insiderSells >= 3) { boost -= 6; smParts.push("Insider Selling"); }

      if (congressBuys > 0) { boost += 5; smParts.push(`Congress Buy (${congressBuys}×)`); }
      if (congressSells > congressBuys) { boost -= 3; smParts.push("Congress Selling"); }

      if (whaleHolders.length > 0) { boost += 4; smParts.push(whaleHolders.slice(0, 2).join(", ")); }

      if (boost !== 0 || whaleHolders.length > 0) {
        r.smartMoney = { congressBuys, congressSells, insiderBuys, insiderSells, whaleHolders };
        r.qualityScore = Math.min(100, Math.max(0, r.qualityScore + boost));
        r.grade = qualityToGrade(r.qualityScore);
        if (smParts.length > 0) {
          r.reasonText += ` | Smart Money: ${smParts.join(", ")}`;
        }
      }
    } catch {
      // Smart money optional
    }
  }
}

/**
 * Enriches top picks with Finnhub social sentiment data.
 */
async function enrichWithSocialSentiment(results: ScanResult[]): Promise<void> {
  for (const r of results) {
    try {
      const sentiment = await fetchSocialSentiment(r.ticker);
      if (!sentiment) continue;

      r.socialSentiment = {
        score: sentiment.overallScore,
        buzz: sentiment.buzz,
        mentions: sentiment.totalMentions,
      };

      let boost = 0;
      // High buzz + aligned sentiment boosts quality
      if (sentiment.buzz === "high" && sentiment.overallScore > 0.3 && r.signal.includes("BUY")) {
        boost += 4;
      } else if (sentiment.buzz === "high" && sentiment.overallScore < -0.3 && r.signal.includes("SELL")) {
        boost += 4;
      }
      // Contradiction penalizes
      if (sentiment.overallScore > 0.3 && r.signal.includes("SELL")) boost -= 2;
      if (sentiment.overallScore < -0.3 && r.signal.includes("BUY")) boost -= 2;

      if (boost !== 0) {
        r.qualityScore = Math.min(100, Math.max(0, r.qualityScore + boost));
        r.grade = qualityToGrade(r.qualityScore);
      }

      if (sentiment.buzz !== "low") {
        r.reasonText += ` | Social: ${sentiment.overallScore > 0 ? "bullish" : sentiment.overallScore < 0 ? "bearish" : "neutral"} (${sentiment.totalMentions} Mentions)`;
      }
    } catch {
      // Social sentiment optional
    }
    await sleep(300); // Rate limit: 60/min
  }
}

/**
 * Enriches top picks with company details from Massive API.
 */
async function enrichWithCompanyDetails(results: ScanResult[]): Promise<void> {
  for (const r of results) {
    try {
      const details = await fetchTickerDetails(r.ticker);
      if (!details) continue;

      r.companyDetails = {
        description: details.description.slice(0, 500),
        logoUrl: details.branding?.logo_url ?? null,
        homepageUrl: details.homepage_url,
        employees: details.total_employees,
      };
    } catch {
      // Company details optional
    }
    await sleep(200);
  }
}

/**
 * Enriches top picks with AI batch analysis via Claude/LiteLLM.
 * This is the LAST enrichment step — uses all previous data.
 */
async function enrichWithAIAnalysis(
  results: ScanResult[],
  regimeData: MarketRegimeData | null,
): Promise<void> {
  const picks: PickSummary[] = results.map((r) => {
    let fundamentalsStr = "";
    if (r.fundamentals) {
      const f = r.fundamentals;
      fundamentalsStr = [
        f.peRatio != null ? `KGV ${f.peRatio.toFixed(1)}` : null,
        f.revenueGrowth != null ? `Umsatz ${(f.revenueGrowth * 100).toFixed(0)}%` : null,
        f.profitMargin != null ? `Marge ${(f.profitMargin * 100).toFixed(0)}%` : null,
        f.analystRating,
        f.altmanZ != null ? `Z-Score ${f.altmanZ.toFixed(1)}` : null,
        f.piotroskiF != null ? `Piotroski ${f.piotroskiF}/9` : null,
      ].filter(Boolean).join(", ");
    }

    let smartMoneyStr = "";
    if (r.smartMoney) {
      const sm = r.smartMoney;
      const parts: string[] = [];
      if (sm.insiderBuys > 0) parts.push(`${sm.insiderBuys}× Insider Buy`);
      if (sm.insiderSells > 0) parts.push(`${sm.insiderSells}× Insider Sell`);
      if (sm.congressBuys > 0) parts.push(`${sm.congressBuys}× Congress Buy`);
      if (sm.whaleHolders.length > 0) parts.push(`Whales: ${sm.whaleHolders.join(", ")}`);
      smartMoneyStr = parts.join(", ");
    }

    return {
      ticker: r.ticker,
      price: r.price,
      signal: r.signal,
      score: r.score,
      qualityScore: r.qualityScore,
      reasonText: r.reasonText,
      fundamentals: fundamentalsStr || undefined,
      smartMoney: smartMoneyStr || undefined,
      regime: regimeData?.regime ?? undefined,
    };
  });

  try {
    const aiResults = await analyzePickBatch(picks);

    for (const r of results) {
      const analysis = aiResults.get(r.ticker);
      if (!analysis) continue;

      r.aiAnalysis = analysis;
      r.qualityScore = Math.min(100, Math.max(0, r.qualityScore + analysis.confidenceAdjustment));
      r.grade = qualityToGrade(r.qualityScore);

      // Add AI verdict to reason text
      const verdictLabel = analysis.aiVerdict === "BESTAETIGT" ? "✓ KI bestätigt"
        : analysis.aiVerdict === "VORSICHT" ? "⚠ KI: Vorsicht"
        : "✗ KI abgelehnt";
      r.reasonText += ` | ${verdictLabel}: ${analysis.justification}`;
      if (analysis.redFlags.length > 0) {
        r.reasonText += ` [Red Flags: ${analysis.redFlags.join("; ")}]`;
      }
    }
  } catch (error) {
    console.error("Scanner: AI batch analysis failed:", error);
  }
}

/**
 * Saves a daily snapshot for the archive.
 */
export async function saveDailySnapshot(results: ScanResult[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const snapshot: ScanSnapshot = {
    date: today,
    results,
    scannedAt: new Date().toISOString(),
  };
  await setCache(`scanner-archive-${today}`, snapshot);

  const index = await getCached<string[]>("scanner-archive-index", Infinity) ?? [];
  if (!index.includes(today)) {
    index.push(today);
    while (index.length > 90) index.shift();
    await setCache("scanner-archive-index", index);
  }
}

/**
 * Loads archived snapshots.
 */
export async function loadArchive(days = 30): Promise<ScanSnapshot[]> {
  const index = await getCached<string[]>("scanner-archive-index", Infinity) ?? [];
  const recent = index.slice(-days);
  const snapshots: ScanSnapshot[] = [];

  for (const date of recent) {
    const snap = await getCached<ScanSnapshot>(`scanner-archive-${date}`, Infinity);
    if (snap) snapshots.push(snap);
  }

  return snapshots;
}
