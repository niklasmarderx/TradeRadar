import { OHLCVPoint, CompanyOverview, SearchResult } from "@/lib/types";
import { getCached, setCache, canMakeRequest, trackRequest, TTL } from "@/lib/cache";

const BASE_URL = "https://www.alphavantage.co/query";

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY nicht gesetzt");
  return key;
}

async function fetchAV(params: Record<string, string>): Promise<Record<string, unknown>> {
  if (!(await canMakeRequest())) {
    throw new Error("Alpha Vantage Rate Limit erreicht (23/Tag). Versuche es morgen erneut.");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Alpha Vantage Fehler: ${res.status}`);

  const data = await res.json();

  // Alpha Vantage returns a "Note" key when rate-limited
  if (data["Note"] || data["Information"]) {
    throw new Error(data["Note"] || data["Information"]);
  }

  await trackRequest();
  return data;
}

/* ── Daily OHLCV ── */

export async function fetchDailyOHLCV(ticker: string): Promise<OHLCVPoint[]> {
  const cacheKey = `${ticker}-daily`;
  const cached = await getCached<OHLCVPoint[]>(cacheKey, TTL.DAILY_OHLCV);
  if (cached) return cached;

  const data = await fetchAV({
    function: "TIME_SERIES_DAILY",
    symbol: ticker,
    outputsize: "full",
  });

  const timeSeries = data["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) throw new Error(`Keine Daten fuer ${ticker}`);

  const points: OHLCVPoint[] = Object.entries(timeSeries)
    .map(([date, values]) => ({
      time: date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: parseFloat(values["5. volume"]),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  await setCache(cacheKey, points);
  return points;
}

/* ── Company Overview ── */

export async function fetchCompanyOverview(ticker: string): Promise<CompanyOverview | null> {
  const cacheKey = `${ticker}-overview`;
  const cached = await getCached<CompanyOverview>(cacheKey, TTL.COMPANY_OVERVIEW);
  if (cached) return cached;

  const data = await fetchAV({
    function: "OVERVIEW",
    symbol: ticker,
  });

  if (!data["Symbol"]) return null;

  const overview: CompanyOverview = {
    ticker: data["Symbol"] as string,
    name: data["Name"] as string,
    description: data["Description"] as string,
    sector: data["Sector"] as string,
    industry: data["Industry"] as string,
    marketCap: data["MarketCapitalization"] as string,
    peRatio: data["PERatio"] as string,
    dividendYield: data["DividendYield"] as string,
    fiftyTwoWeekHigh: parseFloat(data["52WeekHigh"] as string) || 0,
    fiftyTwoWeekLow: parseFloat(data["52WeekLow"] as string) || 0,
    exchange: data["Exchange"] as string,
    currency: data["Currency"] as string,
  };

  await setCache(cacheKey, overview);
  return overview;
}

/* ── Symbol Search ── */

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];

  const cacheKey = `search-${query.toLowerCase()}`;
  const cached = await getCached<SearchResult[]>(cacheKey, TTL.SEARCH);
  if (cached) return cached;

  const data = await fetchAV({
    function: "SYMBOL_SEARCH",
    keywords: query,
  });

  const matches = data["bestMatches"] as Record<string, string>[] | undefined;
  if (!matches) return [];

  const results: SearchResult[] = matches.map((m) => ({
    ticker: m["1. symbol"],
    name: m["2. name"],
    type: m["3. type"],
    region: m["4. region"],
    currency: m["8. currency"],
  }));

  await setCache(cacheKey, results);
  return results;
}
