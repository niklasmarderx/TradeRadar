import { getCached, setCache } from "@/lib/cache";

/**
 * FRED API Client (Federal Reserve Economic Data)
 * Free API: https://fred.stlouisfed.org/docs/api/api_key.html
 * Provides macro data: Fed Funds Rate, Treasury Spread, VIX, Consumer Confidence.
 */

const FRED_API_KEY = process.env.FRED_API_KEY ?? "";
const BASE = "https://api.stlouisfed.org/fred";
const FRED_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function isFredConfigured(): boolean {
  return !!FRED_API_KEY;
}

export interface MacroSnapshot {
  fedFundsRate: number | null;
  treasurySpread: number | null; // 10Y-2Y, negative = inverted yield curve
  vix: number | null;
  consumerConfidence: number | null;
  fetchedAt: string;
}

async function fetchFredSeries(seriesId: string, limit = 1): Promise<number | null> {
  const cacheKey = `fred-${seriesId}`;
  const cached = await getCached<number>(cacheKey, FRED_TTL);
  if (cached !== null) return cached;

  try {
    const url = `${BASE}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 14400 } });
    if (!res.ok) return null;

    const data = await res.json();
    const obs = data.observations;
    if (!obs || obs.length === 0) return null;

    // FRED returns "." for missing values
    const val = parseFloat(obs[0].value);
    if (isNaN(val)) return null;

    await setCache(cacheKey, val);
    return val;
  } catch {
    return null;
  }
}

export async function fetchMacroSnapshot(): Promise<MacroSnapshot> {
  const [fedFundsRate, treasurySpread, vix, consumerConfidence] = await Promise.all([
    fetchFredSeries("DFF"),        // Federal Funds Rate (daily)
    fetchFredSeries("T10Y2Y"),     // 10Y-2Y Treasury Spread (daily)
    fetchFredSeries("VIXCLS"),     // VIX Close (daily)
    fetchFredSeries("UMCSENT"),    // U of Michigan Consumer Sentiment (monthly)
  ]);

  return {
    fedFundsRate,
    treasurySpread,
    vix,
    consumerConfidence,
    fetchedAt: new Date().toISOString(),
  };
}
