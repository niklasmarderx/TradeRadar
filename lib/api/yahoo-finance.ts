import YahooFinance from "yahoo-finance2";
import type { OHLCVPoint } from "@/lib/types";
import { getCached, setCache, TTL } from "@/lib/cache";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/* ── EUR/USD Exchange Rate ── */

async function getUsdToEurRate(): Promise<number> {
  const cacheKey = "yf-fx-usdeur";
  const cached = await getCached<number>(cacheKey, 30 * 60 * 1000); // 30min cache
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote("EURUSD=X");
    if (!result?.regularMarketPrice) return 0.92; // fallback rate
    // EURUSD=X gives how many USD per 1 EUR → to convert USD→EUR we divide
    const rate = 1 / result.regularMarketPrice;
    await setCache(cacheKey, rate);
    return rate;
  } catch {
    return 0.92; // reasonable fallback
  }
}

async function getGbpToEurRate(): Promise<number> {
  const cacheKey = "yf-fx-gbpeur";
  const cached = await getCached<number>(cacheKey, 30 * 60 * 1000);
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote("EURGBP=X");
    if (!result?.regularMarketPrice) return 1.17; // fallback
    // EURGBP=X gives how many GBP per 1 EUR → to convert GBP→EUR we invert
    const rate = 1 / result.regularMarketPrice;
    await setCache(cacheKey, rate);
    return rate;
  } catch {
    return 1.17;
  }
}

async function getChfToEurRate(): Promise<number> {
  const cacheKey = "yf-fx-chfeur";
  const cached = await getCached<number>(cacheKey, 30 * 60 * 1000);
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote("EURCHF=X");
    if (!result?.regularMarketPrice) return 0.94; // fallback
    // EURCHF=X gives how many CHF per 1 EUR → to convert CHF→EUR we invert
    const rate = 1 / result.regularMarketPrice;
    await setCache(cacheKey, rate);
    return rate;
  } catch {
    return 0.94;
  }
}

/** Convert any currency price to EUR */
async function toEur(price: number, currency: string): Promise<number> {
  switch (currency) {
    case "USD":
      return price * await getUsdToEurRate();
    case "GBp":
    case "GBX":
      // GBp/GBX = British pence, divide by 100 to get GBP first
      return (price / 100) * await getGbpToEurRate();
    case "GBP":
      return price * await getGbpToEurRate();
    case "CHF":
      return price * await getChfToEurRate();
    case "EUR":
      return price;
    default:
      // For unknown currencies, try USD conversion as best guess
      return price * await getUsdToEurRate();
  }
}

/** Detect currency for a ticker (cached) */
async function getTickerCurrency(ticker: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote(ticker);
    return (result?.currency as string) ?? "USD";
  } catch {
    return "USD";
  }
}

function applyFxRate(point: OHLCVPoint, rate: number): OHLCVPoint {
  return {
    ...point,
    open: point.open * rate,
    high: point.high * rate,
    low: point.low * rate,
    close: point.close * rate,
  };
}

/* ── Historical OHLCV (5+ years) ── */

export async function fetchHistoricalData(
  ticker: string,
  years = 5
): Promise<OHLCVPoint[]> {
  const cacheKey = `yf-${ticker}-${years}y`;
  const cached = await getCached<OHLCVPoint[]>(cacheKey, TTL.YAHOO_OHLCV);
  if (cached) return cached;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, {
    period1: startDate.toISOString().slice(0, 10),
    period2: endDate.toISOString().slice(0, 10),
    interval: "1d",
  });

  const quotes = result?.quotes;
  if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
    throw new Error(`Keine Yahoo Finance Daten fuer ${ticker}`);
  }

  const points: OHLCVPoint[] = quotes
    .filter((q: Record<string, unknown>) => q.open != null && q.high != null && q.low != null && q.close != null)
    .map((q: Record<string, unknown>) => ({
      time: new Date(q.date as string).toISOString().slice(0, 10),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume as number) ?? 0,
    }));

  // Convert to EUR
  const currency = await getTickerCurrency(ticker);
  let eurPoints = points;
  if (currency !== "EUR") {
    const sampleEur = await toEur(1, currency);
    eurPoints = points.map((p) => applyFxRate(p, sampleEur));
  }

  await setCache(cacheKey, eurPoints);
  return eurPoints;
}

/* ── Intraday OHLCV (1min, 5min, 15min) ── */

export type IntradayInterval = "1m" | "5m" | "15m";

export async function fetchIntradayData(
  ticker: string,
  interval: IntradayInterval = "5m"
): Promise<OHLCVPoint[]> {
  const cacheKey = `yf-intraday-${ticker}-${interval}`;
  // Short cache: 1min for 1m, 3min for 5m, 5min for 15m
  const ttlMs = interval === "1m" ? 60_000 : interval === "5m" ? 180_000 : 300_000;
  const cached = await getCached<OHLCVPoint[]>(cacheKey, ttlMs);
  if (cached) return cached;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.chart(ticker, {
    period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    interval,
  });

  const quotes = result?.quotes;
  if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
    throw new Error(`Keine Intraday-Daten fuer ${ticker}`);
  }

  const points: OHLCVPoint[] = quotes
    .filter((q: Record<string, unknown>) => q.open != null && q.close != null)
    .map((q: Record<string, unknown>) => ({
      time: new Date(q.date as string).toISOString().slice(0, 19).replace("T", " "),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume as number) ?? 0,
    }));

  // Convert to EUR
  const currency = await getTickerCurrency(ticker);
  let eurPoints = points;
  if (currency !== "EUR") {
    const sampleEur = await toEur(1, currency);
    eurPoints = points.map((p) => applyFxRate(p, sampleEur));
  }

  await setCache(cacheKey, eurPoints);
  return eurPoints;
}

export interface YahooQuote {
  price: number;
  priceEur: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  currency: string;
  shortName: string;
}

export async function fetchQuote(ticker: string): Promise<YahooQuote | null> {
  const cacheKey = `yf-quote-${ticker}`;
  const cached = await getCached<YahooQuote>(cacheKey, TTL.YAHOO_QUOTE);
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote(ticker);
    if (!result?.regularMarketPrice) return null;

    const currency: string = result.currency ?? "USD";
    const priceRaw = result.regularMarketPrice;

    // Convert to EUR using unified converter
    const priceEur = await toEur(priceRaw, currency);

    const quote: YahooQuote = {
      price: priceRaw,
      priceEur,
      change: result.regularMarketChange ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      marketCap: result.marketCap ?? 0,
      volume: result.regularMarketVolume ?? 0,
      avgVolume: result.averageDailyVolume3Month ?? 0,
      currency,
      shortName: (result.shortName as string) ?? (result.longName as string) ?? ticker,
    };

    await setCache(cacheKey, quote);
    return quote;
  } catch {
    return null;
  }
}

/* ── Short Name / Company Name ── */

export async function fetchShortName(ticker: string): Promise<string> {
  const cacheKey = `yf-name-${ticker}`;
  const cached = await getCached<string>(cacheKey, 7 * 24 * 60 * 60 * 1000); // 7 days
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quote(ticker);
    const name = (result?.shortName as string) ?? (result?.longName as string) ?? ticker;
    await setCache(cacheKey, name);
    return name;
  } catch {
    return ticker;
  }
}

/* ── Quote Summary (Fundamentals) ── */

export interface YahooFundamentals {
  sector: string;
  industry: string;
  marketCap: number;
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
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  targetMeanPrice: number | null;
  recommendationMean: number | null;
  recommendationKey: string | null;
  numberOfAnalysts: number;
  // Valuation fields
  freeCashflow: number | null;
  bookValue: number | null;
  sharesOutstanding: number | null;
  trailingEps: number | null;
  totalRevenue: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  ebitda: number | null;
  // Dividend safety
  payoutRatio: number | null;
  fiveYearAvgDividendYield: number | null;
  // Liquidity ratios (from financialData module)
  currentRatio: number | null;
  quickRatio: number | null;
  // Risk & Short Interest (from defaultKeyStatistics)
  beta: number | null;
  shortPercentOfFloat: number | null;
  sharesShort: number | null;
  shortRatio: number | null;
  // Enterprise valuation
  enterpriseValue: number | null;
  enterpriseToRevenue: number | null;
  enterpriseToEbitda: number | null;
  // Ownership (from majorHoldersBreakdown)
  heldPercentInsiders: number | null;
  heldPercentInstitutions: number | null;
}

export async function fetchFundamentals(
  ticker: string
): Promise<YahooFundamentals | null> {
  const cacheKey = `yf-fundamentals-${ticker}`;
  const cached = await getCached<YahooFundamentals>(cacheKey, TTL.COMPANY_OVERVIEW);
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quoteSummary(ticker, {
      modules: ["summaryProfile", "financialData", "defaultKeyStatistics", "price", "summaryDetail", "majorHoldersBreakdown"],
    });

    const profile = result?.summaryProfile;
    const financial = result?.financialData;
    const stats = result?.defaultKeyStatistics;
    const price = result?.price;
    const detail = result?.summaryDetail;
    const majorHolders = result?.majorHoldersBreakdown;

    const fundamentals: YahooFundamentals = {
      sector: profile?.sector ?? "Unknown",
      industry: profile?.industry ?? "Unknown",
      marketCap: price?.marketCap ?? 0,
      peRatio: stats?.trailingPE ?? null,
      forwardPE: stats?.forwardPE ?? null,
      pegRatio: stats?.pegRatio ?? null,
      dividendYield: stats?.dividendYield ?? null,
      profitMargin: financial?.profitMargins ?? null,
      operatingMargin: financial?.operatingMargins ?? null,
      returnOnEquity: financial?.returnOnEquity ?? null,
      debtToEquity: financial?.debtToEquity ?? null,
      revenueGrowth: financial?.revenueGrowth ?? null,
      earningsGrowth: financial?.earningsGrowth ?? null,
      fiftyTwoWeekHigh: stats?.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: stats?.fiftyTwoWeekLow ?? 0,
      targetMeanPrice: financial?.targetMeanPrice ?? null,
      recommendationMean: financial?.recommendationMean ?? null,
      recommendationKey: financial?.recommendationKey ?? null,
      numberOfAnalysts: financial?.numberOfAnalystOpinions ?? 0,
      // Valuation fields
      freeCashflow: financial?.freeCashflow ?? null,
      bookValue: stats?.bookValue ?? null,
      sharesOutstanding: stats?.sharesOutstanding ?? null,
      trailingEps: stats?.trailingEps ?? null,
      totalRevenue: financial?.totalRevenue ?? null,
      totalCash: financial?.totalCash ?? null,
      totalDebt: financial?.totalDebt ?? null,
      ebitda: financial?.ebitda ?? null,
      // Dividend safety
      payoutRatio: detail?.payoutRatio ?? null,
      fiveYearAvgDividendYield: detail?.fiveYearAvgDividendYield ?? null,
      // Liquidity ratios
      currentRatio: financial?.currentRatio ?? null,
      quickRatio: financial?.quickRatio ?? null,
      // Risk & Short Interest (from defaultKeyStatistics)
      beta: stats?.beta ?? null,
      shortPercentOfFloat: stats?.shortPercentOfFloat ?? null,
      sharesShort: stats?.sharesShort ?? null,
      shortRatio: stats?.shortRatio ?? null,
      // Enterprise valuation
      enterpriseValue: stats?.enterpriseValue ?? null,
      enterpriseToRevenue: stats?.enterpriseToRevenue ?? null,
      enterpriseToEbitda: stats?.enterpriseToEbitda ?? null,
      // Ownership (from majorHoldersBreakdown)
      heldPercentInsiders: majorHolders?.insidersPercentHeld ?? null,
      heldPercentInstitutions: majorHolders?.institutionsPercentHeld ?? null,
    };

    await setCache(cacheKey, fundamentals);
    return fundamentals;
  } catch {
    return null;
  }
}

/* ── Extended Data (Earnings, Upgrades, Calendar) ── */

export interface EarningsHistoryEntry {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
}

export interface EarningsTrendEntry {
  period: string;
  growth: number | null;
  epsRevisions: { upLast30: number; downLast30: number };
}

export interface UpgradeDowngradeEntry {
  date: string;
  firm: string;
  toGrade: string;
  fromGrade: string;
  action: string;
}

export interface RecommendationTrendEntry {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface YahooExtendedData {
  earningsHistory: EarningsHistoryEntry[];
  earningsTrend: EarningsTrendEntry[];
  calendarEvents: { earningsDate: string | null; exDividendDate: string | null };
  upgradeDowngradeHistory: UpgradeDowngradeEntry[];
  recommendationTrend: RecommendationTrendEntry[];
}

export async function fetchExtendedData(
  ticker: string
): Promise<YahooExtendedData | null> {
  const cacheKey = `yf-extended-${ticker}`;
  const cached = await getCached<YahooExtendedData>(cacheKey, TTL.COMPANY_OVERVIEW);
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.quoteSummary(ticker, {
      modules: [
        "earningsHistory",
        "earningsTrend",
        "calendarEvents",
        "upgradeDowngradeHistory",
        "recommendationTrend",
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eh = result?.earningsHistory?.history ?? [];
    const earningsHistory: EarningsHistoryEntry[] = eh.slice(-8).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => ({
        quarter: e.quarter ?? e.period ?? "",
        epsActual: e.epsActual ?? null,
        epsEstimate: e.epsEstimate ?? null,
        surprisePercent: e.surprisePercent != null ? e.surprisePercent * 100 : null,
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const et = result?.earningsTrend?.trend ?? [];
    const earningsTrend: EarningsTrendEntry[] = et.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => ({
        period: t.period ?? "",
        growth: t.growth ?? null,
        epsRevisions: {
          upLast30: t.revisions?.upLast30days ?? t.revisions?.upLast30Days ?? 0,
          downLast30: t.revisions?.downLast30days ?? t.revisions?.downLast30Days ?? 0,
        },
      })
    );

    const cal = result?.calendarEvents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const earningsDateRaw = cal?.earnings?.earningsDate?.[0];
    const calendarEvents = {
      earningsDate: earningsDateRaw
        ? new Date(earningsDateRaw).toISOString().slice(0, 10)
        : null,
      exDividendDate: cal?.exDividendDate
        ? new Date(cal.exDividendDate).toISOString().slice(0, 10)
        : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const udh = result?.upgradeDowngradeHistory?.history ?? [];
    const upgradeDowngradeHistory: UpgradeDowngradeEntry[] = udh
      .slice(0, 20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => ({
        date: u.epochGradeDate
          ? new Date(u.epochGradeDate * 1000).toISOString().slice(0, 10)
          : u.date ?? "",
        firm: u.firm ?? "",
        toGrade: u.toGrade ?? "",
        fromGrade: u.fromGrade ?? "",
        action: u.action ?? "",
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = result?.recommendationTrend?.trend ?? [];
    const recommendationTrend: RecommendationTrendEntry[] = rt.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        period: r.period ?? "",
        strongBuy: r.strongBuy ?? 0,
        buy: r.buy ?? 0,
        hold: r.hold ?? 0,
        sell: r.sell ?? 0,
        strongSell: r.strongSell ?? 0,
      })
    );

    const extended: YahooExtendedData = {
      earningsHistory,
      earningsTrend,
      calendarEvents,
      upgradeDowngradeHistory,
      recommendationTrend,
    };

    await setCache(cacheKey, extended);
    return extended;
  } catch {
    return null;
  }
}

/* ── Financial Statements (Balance Sheet, Income, Cash Flow) ── */

export interface FinancialStatements {
  workingCapital: number | null;
  totalAssets: number | null;
  retainedEarnings: number | null;
  ebit: number | null;
  totalLiabilities: number | null;
  totalRevenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  interestExpense: number | null;
  grossProfit: number | null;
  sharesOutstanding: number | null;
  // Previous period for Piotroski comparisons
  prevCurrentRatio: number | null;
  prevDebtRatio: number | null;
  prevGrossMargin: number | null;
  prevAssetTurnover: number | null;
  prevSharesOutstanding: number | null;
  prevNetIncome: number | null;
  prevTotalAssets: number | null;
}

export async function fetchFinancialStatements(
  ticker: string
): Promise<FinancialStatements | null> {
  const cacheKey = `yf-financials-${ticker}`;
  const cached = await getCached<FinancialStatements>(cacheKey, TTL.COMPANY_OVERVIEW);
  if (cached) return cached;

  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await yf.fundamentalsTimeSeries(ticker, {
      period1: twoYearsAgo.toISOString().slice(0, 10),
      type: "quarterly",
      module: "all",
    });

    if (!data || data.length === 0) return null;

    // Sort by date descending, pick latest and previous quarter
    const sorted = [...data].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];
    const prev = sorted.length > 1 ? sorted[1] : null;

    // Helper: first non-null from latest entries
    const v = (field: string): number | null => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const entry of sorted) {
        // Try unprefixed first, then with quarterly prefix (API format varies)
        const val = entry[field] ?? entry[`quarterly${field.charAt(0).toUpperCase()}${field.slice(1)}`];
        if (val != null && typeof val === "number") return val;
      }
      return null;
    };

    const totalAssets = v("totalAssets");
    const totalRevenue = v("totalRevenue");
    const currentAssets = v("currentAssets");
    const currentLiabilities = v("currentLiabilities");
    const totalDebt = v("totalDebt");
    const grossProfit = v("grossProfit");
    const sharesOutstanding = latest?.ordinarySharesNumber ?? latest?.shareIssued ?? null;

    // Previous period helpers
    const pv = (field: string): number | null => {
      if (!prev) return null;
      return prev[field] ?? prev[`quarterly${field.charAt(0).toUpperCase()}${field.slice(1)}`] ?? null;
    };

    const prevTA = pv("totalAssets");
    const prevCA = pv("currentAssets");
    const prevCL = pv("currentLiabilities");
    const prevTD = pv("totalDebt");
    const prevGP = pv("grossProfit");
    const prevRev = pv("totalRevenue");
    const prevShares = prev?.ordinarySharesNumber ?? prev?.shareIssued ?? null;

    const result: FinancialStatements = {
      workingCapital: v("workingCapital") ?? (currentAssets != null && currentLiabilities != null ? currentAssets - currentLiabilities : null),
      totalAssets,
      retainedEarnings: v("retainedEarnings"),
      ebit: v("EBIT") ?? v("operatingIncome"),
      totalLiabilities: v("totalLiabilitiesNetMinorityInterest"),
      totalRevenue,
      netIncome: v("netIncome"),
      operatingCashFlow: v("operatingCashFlow"),
      currentAssets,
      currentLiabilities,
      totalDebt,
      interestExpense: v("interestExpense") ?? v("interestExpenseNonOperating"),
      grossProfit,
      sharesOutstanding,
      // Previous period ratios
      prevCurrentRatio: prevCA != null && prevCL != null && prevCL > 0 ? prevCA / prevCL : null,
      prevDebtRatio: prevTD != null && prevTA != null && prevTA > 0 ? prevTD / prevTA : null,
      prevGrossMargin: prevGP != null && prevRev != null && prevRev > 0 ? prevGP / prevRev : null,
      prevAssetTurnover: prevRev != null && prevTA != null && prevTA > 0 ? prevRev / prevTA : null,
      prevSharesOutstanding: prevShares,
      prevNetIncome: pv("netIncome"),
      prevTotalAssets: prevTA,
    };

    await setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/* ── Options Data (IV, Put/Call Ratio, Max Pain) ── */

export interface OptionsData {
  impliedVolatility: number | null;
  putCallRatio: number | null;
  maxPainStrike: number | null;
  nearestExpiry: string | null;
}

export async function fetchOptionsData(
  ticker: string,
): Promise<OptionsData | null> {
  const cacheKey = `yf-options-${ticker}`;
  const cached = await getCached<OptionsData>(cacheKey, 60 * 60 * 1000); // 1h cache
  if (cached) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.options(ticker);
    if (!result?.options?.[0]) return null;

    const chain = result.options[0];
    const calls = chain.calls ?? [];
    const puts = chain.puts ?? [];

    if (calls.length === 0 && puts.length === 0) return null;

    // Nearest expiry date
    const nearestExpiry = chain.expirationDate
      ? new Date(chain.expirationDate).toISOString().slice(0, 10)
      : null;

    // Put/Call ratio (by volume)
    const totalCallVol = calls.reduce((s: number, c: { volume?: number }) => s + (c.volume ?? 0), 0);
    const totalPutVol = puts.reduce((s: number, p: { volume?: number }) => s + (p.volume ?? 0), 0);
    const putCallRatio = totalCallVol > 0 ? totalPutVol / totalCallVol : null;

    // Find ATM options for IV (closest to current price)
    const currentPrice = result.quote?.regularMarketPrice ?? 0;
    let bestIV: number | null = null;
    if (currentPrice > 0 && calls.length > 0) {
      let minDist = Infinity;
      for (const c of calls) {
        const strike = c.strike ?? 0;
        const dist = Math.abs(strike - currentPrice);
        if (dist < minDist && c.impliedVolatility != null) {
          minDist = dist;
          bestIV = c.impliedVolatility;
        }
      }
    }

    // Max Pain: strike where total option value (calls + puts) is minimized
    let maxPainStrike: number | null = null;
    const strikes = new Set<number>();
    for (const c of calls) if (c.strike) strikes.add(c.strike);
    for (const p of puts) if (p.strike) strikes.add(p.strike);

    if (strikes.size > 0) {
      let minPain = Infinity;
      for (const strike of strikes) {
        let pain = 0;
        for (const c of calls) {
          if (c.strike < strike) pain += (strike - c.strike) * (c.openInterest ?? 0);
        }
        for (const p of puts) {
          if (p.strike > strike) pain += (p.strike - strike) * (p.openInterest ?? 0);
        }
        if (pain < minPain) {
          minPain = pain;
          maxPainStrike = strike;
        }
      }
    }

    const data: OptionsData = {
      impliedVolatility: bestIV,
      putCallRatio: putCallRatio !== null ? Math.round(putCallRatio * 100) / 100 : null,
      maxPainStrike,
      nearestExpiry,
    };

    await setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}
