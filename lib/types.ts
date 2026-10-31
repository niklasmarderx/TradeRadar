export interface SparklinePoint {
  date: string;
  value: number;
}

export interface OHLCPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceLevel {
  price: number;
  label: string;
  color: string;
}

export interface Index {
  name: string;
  symbol: string;
  value: string;
  change: string;
  direction: "up" | "down";
  sparkline?: SparklinePoint[];
}

export interface Crypto {
  name: string;
  symbol: string;
  price_eur: string;
  change_24h: string;
  direction: "up" | "down";
  sparkline?: SparklinePoint[];
}

export type Strategy =
  | "Momentum"
  | "Mean Reversion"
  | "Catalyst"
  | "Value Investing"
  | "Relative Strength";

export interface Action {
  ticker: string;
  name: string;
  price: string;
  price_numeric: number;
  signal: "STRONG BUY" | "BUY" | "SELL" | "STRONG SELL" | "HOLD";
  confidence: "hoch" | "mittel" | "niedrig";
  strategy: Strategy;
  methodology?: string;
  validated?: boolean;
  reason: string;
  entry: string;
  target: string;
  stop: string;
  entry_numeric?: number;
  target_numeric?: number;
  stop_numeric?: number;
  timeframe: string;
  catalyst: string;
  sector?: string;
  industry?: string;
  isCrypto?: boolean;
  grade?: string;
  scanTimeframe?: "short" | "medium" | "long";
  // Daily Picks tracking
  daysOnList?: number;
  performancePercent?: number;
  addedDate?: string;
  addedPrice?: number;
  changelogStatus?: "new" | "changed" | null;
  timeframeTag?: string;
  scenarios?: { bull: string; base: string; bear: string };
  valuation?: { fairValue: string; marginOfSafety: string; verdict: string };
  sparkline: SparklinePoint[];
  chart_data: OHLCPoint[];
}

export interface NewsItem {
  headline: string;
  source: string;
  impact: "bullish" | "bearish" | "neutral";
  affected: string;
}

export interface Risk {
  type: string;
  level: "low" | "medium" | "high";
  detail: string;
}

export interface TradingData {
  updated: string;
  market_phase: "bullish" | "bearish" | "neutral" | "volatile";
  indices: Index[];
  crypto: Crypto[];
  actions: Action[];
  news: NewsItem[];
  risks: Risk[];
  analysis: string;
  disclaimer: string;
}

/* ── Alpha Vantage types ── */

export interface OHLCVPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CompanyOverview {
  ticker: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  dividendYield: string;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  exchange: string;
  currency: string;
}

export interface SearchResult {
  ticker: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

/* ── Indicator types ── */

export interface IndicatorResults {
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  ema20: (number | null)[];
  rsi14: (number | null)[];
  stochastic: { k: number | null; d: number | null }[];
  adx: (number | null)[];
  atr14: (number | null)[];
  macd: { macd: number | null; signal: number | null; histogram: number | null }[];
  bollingerBands: { upper: number | null; middle: number | null; lower: number | null }[];
  supportResistance: { support: number; resistance: number; supportStrength: number; resistanceStrength: number };
  latestValues: {
    rsi: number | null;
    stochasticK: number | null;
    stochasticD: number | null;
    adx: number | null;
    atr: number | null;
    atrPercent: number | null;
    macdLine: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
    bollingerMiddle: number | null;
  };
  signals: {
    rsiSignal: "overbought" | "oversold" | "neutral";
    stochasticSignal: "overbought" | "oversold" | "bullish_cross" | "bearish_cross" | "neutral";
    macdSignal: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "neutral";
    trendSignal: "strong_uptrend" | "uptrend" | "downtrend" | "strong_downtrend" | "neutral";
    trendStrength: "strong" | "moderate" | "weak" | "no_trend";
    bollingerSignal: "upper_squeeze" | "lower_squeeze" | "expanding" | "neutral";
    volumeSignal: "high_volume" | "low_volume" | "normal";
    rsiDivergence: "bullish_divergence" | "bearish_divergence" | "none";
    macdDivergence: "bullish_divergence" | "bearish_divergence" | "none";
    rsiMidlineCross: "bullish_cross" | "bearish_cross" | "none";
    macdHistogramMomentum: "accelerating" | "decelerating" | "none";
    bollingerSqueeze: boolean;
  };
  compositeScore: CompositeScore;
}

export interface CompositeScore {
  /** -100 (extreme bearish) to +100 (extreme bullish) */
  score: number;
  signal: "STRONG BUY" | "BUY" | "SELL" | "STRONG SELL" | "HOLD";
  confidence: "hoch" | "mittel" | "niedrig";
  /** How many indicators agree with the signal direction */
  convergence: number;
  /** Individual indicator scores */
  breakdown: {
    trend: number;       // -25 to +25
    momentum: number;    // -25 to +25
    volatility: number;  // -25 to +25
    volume: number;      // -25 to +25
  };
  /** Kelly Criterion suggested position size (0-25% of portfolio) */
  kellySize: number;
  /** ATR-based stop-loss distance */
  suggestedStop: number;
  /** Risk-reward based target */
  suggestedTarget: number;
  /** ATR-based entry */
  suggestedEntry: number;
}

/* ── Stock page data (merges static + live) ── */

export interface StockPageData {
  ticker: string;
  name: string;
  currentPrice: number;
  ohlcvData: OHLCVPoint[];
  companyOverview?: CompanyOverview;
  action?: Action;
  relatedNews: NewsItem[];
  indicators?: IndicatorResults;
  marketPhase?: TradingData["market_phase"];
}

/* ── AI Analysis types ── */

export interface ResearchNews {
  headline: string;
  url: string;
  source: string;
  date: string;
  impact: "bullish" | "bearish" | "neutral";
  summary: string;
}

export interface ResearchResult {
  news: ResearchNews[];
  analystConsensus: {
    rating: string;
    targetPrice: number | null;
    numberOfAnalysts: number;
    buyCount: number;
    holdCount: number;
    sellCount: number;
  } | null;
  sectorComparison: {
    sectorPerformance: string;
    relativeStrength: string;
    spComparison: string;
  } | null;
  marketSentiment: {
    vixLevel: string;
    fearGreed: string;
    marketTrend: string;
  } | null;
  upcomingEvents: string[];
  searchedAt: string;
}

export interface AIAnalysisRequest {
  ticker: string;
  name: string;
  currentPrice: number;
  ohlcvData: OHLCVPoint[];
  indicators: IndicatorResults;
  companyOverview?: CompanyOverview;
  relatedNews: NewsItem[];
  marketPhase: string;
  research?: ResearchResult;
  fundamentals?: {
    peRatio: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    dividendYield: number | null;
    profitMargin: number | null;
    operatingMargin: number | null;
    returnOnEquity: number | null;
    debtToEquity: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    targetMeanPrice: number | null;
    recommendationKey: string | null;
    numberOfAnalysts: number;
  };
  valuation?: {
    dcfFairValue: number | null;
    grahamFairValue: number | null;
    lynchFairValue: number | null;
    consensusFairValue: number | null;
    marginOfSafety: number;
    verdict: string;
  };
}

export interface AIAnalysisResponse {
  recommendation: "STRONG BUY" | "BUY" | "SELL" | "HOLD";
  confidence: "hoch" | "mittel" | "niedrig";
  entry: number;
  target: number;
  stopLoss: number;
  riskReward: string;
  summary: string;
  reasoning: string;
  methodology: string;
  risks: string[];
  timeframe: string;
  // Extended analysis (optional — may not be present in older responses)
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  moat?: {
    type: "wide" | "narrow" | "none";
    sources: string[];
    explanation: string;
  };
  thesis?: {
    bullCase: string;
    bearCase: string;
  };
  contrarian?: {
    argument: string;
    counterPoints: string[];
  };
  factAudit?: {
    claims: { claim: string; status: "grounded" | "speculative" | "unverifiable" }[];
  };
}
