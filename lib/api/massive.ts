import { getCached, setCache, TTL } from "@/lib/cache";
import type { OHLCVPoint } from "@/lib/types";

/**
 * Massive API Client (massive.com)
 * Professional financial data — OHLCV, news with sentiment, technical indicators.
 * Free tier: aggregates, news, technicals, reference data.
 * Base URL: https://api.massive.com
 * Auth: Bearer token in Authorization header.
 */

const BASE = "https://api.massive.com";
const API_KEY = process.env.MASSIVE_API_KEY ?? "";

async function massiveFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    next: { revalidate: 300 }, // 5min ISR cache
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Massive API ${res.status}: ${body}`);
  }
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   OHLCV Aggregates
   GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
   ══════════════════════════════════════════════════════════════ */

interface MassiveAggResult {
  v: number;   // volume
  vw: number;  // volume-weighted avg price
  o: number;   // open
  c: number;   // close
  h: number;   // high
  l: number;   // low
  t: number;   // timestamp (ms)
  n: number;   // number of trades
}

interface MassiveAggsResponse {
  ticker: string;
  status: string;
  resultsCount: number;
  results: MassiveAggResult[];
  next_url?: string;
}

export async function fetchMassiveOHLCV(
  ticker: string,
  years = 2,
): Promise<OHLCVPoint[]> {
  const cacheKey = `massive-ohlcv-${ticker}-${years}y`;
  const cached = await getCached<OHLCVPoint[]>(cacheKey, TTL.YAHOO_OHLCV);
  if (cached) return cached;

  if (!API_KEY) throw new Error("MASSIVE_API_KEY not configured");

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date();
  from.setFullYear(from.getFullYear() - years);
  const fromStr = from.toISOString().slice(0, 10);

  const data = await massiveFetch<MassiveAggsResponse>(
    `/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${to}?adjusted=true&sort=asc&limit=50000`
  );

  if (!data.results || data.results.length === 0) {
    throw new Error(`No Massive data for ${ticker}`);
  }

  const points: OHLCVPoint[] = data.results.map((r) => ({
    time: new Date(r.t).toISOString().slice(0, 10),
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));

  await setCache(cacheKey, points);
  return points;
}

/* ══════════════════════════════════════════════════════════════
   News with Sentiment Analysis
   GET /v2/reference/news?ticker={ticker}&limit={n}
   ══════════════════════════════════════════════════════════════ */

export interface MassiveNewsInsight {
  ticker: string;
  sentiment: "positive" | "negative" | "neutral";
  sentiment_reasoning: string;
}

export interface MassiveNewsArticle {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  image_url?: string;
  description: string;
  tickers: string[];
  keywords: string[];
  insights: MassiveNewsInsight[];
  publisher: {
    name: string;
    homepage_url: string;
    logo_url?: string;
    favicon_url?: string;
  };
}

interface MassiveNewsResponse {
  results: MassiveNewsArticle[];
  status: string;
  count: number;
  next_url?: string;
}

export async function fetchMassiveNews(
  ticker?: string,
  limit = 10,
): Promise<MassiveNewsArticle[]> {
  const cacheKey = `massive-news-${ticker ?? "market"}-${limit}`;
  const cached = await getCached<MassiveNewsArticle[]>(cacheKey, 15 * 60 * 1000); // 15min
  if (cached) return cached;

  if (!API_KEY) return [];

  const params = new URLSearchParams({ limit: String(limit) });
  if (ticker) params.set("ticker", ticker);

  try {
    const data = await massiveFetch<MassiveNewsResponse>(
      `/v2/reference/news?${params}`
    );
    const articles = data.results ?? [];
    await setCache(cacheKey, articles);
    return articles;
  } catch {
    return [];
  }
}

/**
 * Get sentiment summary for a ticker from recent news.
 * Returns: { bullish, bearish, neutral } counts + overall sentiment.
 */
export async function getNewsSentiment(
  ticker: string,
): Promise<{
  overall: "bullish" | "bearish" | "neutral" | "mixed";
  bullish: number;
  bearish: number;
  neutral: number;
  topHeadline: string | null;
  topSentiment: string | null;
}> {
  const articles = await fetchMassiveNews(ticker, 10);
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let topHeadline: string | null = null;
  let topSentiment: string | null = null;

  for (const article of articles) {
    const insight = article.insights.find((i) => i.ticker === ticker);
    if (!insight) continue;

    if (!topHeadline) {
      topHeadline = article.title;
      topSentiment = insight.sentiment;
    }

    if (insight.sentiment === "positive") bullish++;
    else if (insight.sentiment === "negative") bearish++;
    else neutral++;
  }

  const total = bullish + bearish + neutral;
  let overall: "bullish" | "bearish" | "neutral" | "mixed" = "neutral";
  if (total > 0) {
    if (bullish > bearish * 2) overall = "bullish";
    else if (bearish > bullish * 2) overall = "bearish";
    else if (bullish > 0 && bearish > 0) overall = "mixed";
  }

  return { overall, bullish, bearish, neutral, topHeadline, topSentiment };
}

/* ══════════════════════════════════════════════════════════════
   Technical Indicators (server-side calculated)
   GET /v1/indicators/{indicator}/{ticker}
   ══════════════════════════════════════════════════════════════ */

interface MassiveIndicatorValue {
  timestamp: number;
  value: number;
}

interface MassiveIndicatorResponse {
  results: {
    values: MassiveIndicatorValue[];
  };
  status: string;
  next_url?: string;
}

export async function fetchMassiveRSI(
  ticker: string,
  window = 14,
  limit = 5,
): Promise<number | null> {
  const cacheKey = `massive-rsi-${ticker}`;
  const cached = await getCached<number>(cacheKey, 60 * 60 * 1000); // 1h
  if (cached !== null) return cached;

  if (!API_KEY) return null;

  try {
    const data = await massiveFetch<MassiveIndicatorResponse>(
      `/v1/indicators/rsi/${ticker}?timespan=day&window=${window}&limit=${limit}&sort=desc`
    );
    const val = data.results?.values?.[0]?.value ?? null;
    if (val !== null) await setCache(cacheKey, val);
    return val;
  } catch {
    return null;
  }
}

export async function fetchMassiveSMA(
  ticker: string,
  window = 50,
): Promise<number | null> {
  if (!API_KEY) return null;

  try {
    const data = await massiveFetch<MassiveIndicatorResponse>(
      `/v1/indicators/sma/${ticker}?timespan=day&window=${window}&limit=1&sort=desc`
    );
    return data.results?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function fetchMassiveMACD(
  ticker: string,
): Promise<{ value: number; signal: number; histogram: number } | null> {
  if (!API_KEY) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await massiveFetch<any>(
      `/v1/indicators/macd/${ticker}?timespan=day&limit=1&sort=desc`
    );
    const v = data.results?.values?.[0];
    if (!v) return null;
    return {
      value: v.value ?? 0,
      signal: v.signal ?? 0,
      histogram: v.histogram ?? 0,
    };
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   Ticker Details (company info)
   GET /v3/reference/tickers/{ticker}
   ══════════════════════════════════════════════════════════════ */

export interface MassiveTickerDetails {
  ticker: string;
  name: string;
  description: string;
  market_cap: number;
  sic_description: string;
  homepage_url: string;
  total_employees: number;
  list_date: string;
  branding?: {
    logo_url: string;
    icon_url: string;
  };
}

export async function fetchTickerDetails(
  ticker: string,
): Promise<MassiveTickerDetails | null> {
  const cacheKey = `massive-details-${ticker}`;
  const cached = await getCached<MassiveTickerDetails>(cacheKey, 7 * 24 * 60 * 60 * 1000); // 7 days
  if (cached) return cached;

  if (!API_KEY) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await massiveFetch<any>(`/v3/reference/tickers/${ticker}`);
    const r = data.results;
    if (!r) return null;

    const details: MassiveTickerDetails = {
      ticker: r.ticker,
      name: r.name ?? ticker,
      description: r.description ?? "",
      market_cap: r.market_cap ?? 0,
      sic_description: r.sic_description ?? "",
      homepage_url: r.homepage_url ?? "",
      total_employees: r.total_employees ?? 0,
      list_date: r.list_date ?? "",
      branding: r.branding ? {
        logo_url: r.branding.logo_url ?? "",
        icon_url: r.branding.icon_url ?? "",
      } : undefined,
    };

    await setCache(cacheKey, details);
    return details;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   Market-wide News Feed (no ticker filter)
   ══════════════════════════════════════════════════════════════ */

export async function fetchMarketNews(limit = 20): Promise<MassiveNewsArticle[]> {
  return fetchMassiveNews(undefined, limit);
}

/* ══════════════════════════════════════════════════════════════
   Helper: Check if Massive API is available
   ══════════════════════════════════════════════════════════════ */

export function isMassiveConfigured(): boolean {
  return !!API_KEY;
}
