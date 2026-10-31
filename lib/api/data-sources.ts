import type { OHLCVPoint, CompanyOverview } from "@/lib/types";
import { fetchHistoricalData, fetchQuote, fetchFundamentals } from "./yahoo-finance";
import { fetchDailyOHLCV, fetchCompanyOverview } from "./alpha-vantage";
import type { YahooFundamentals } from "./yahoo-finance";

/**
 * Unified data orchestrator: Yahoo Finance primary, Alpha Vantage fallback.
 */

/* ── OHLCV Data ── */

export async function fetchOHLCV(ticker: string, years = 20): Promise<OHLCVPoint[]> {
  // Try Yahoo Finance first (unlimited, 5+ years)
  try {
    const data = await fetchHistoricalData(ticker, years);
    if (data.length > 0) return data;
  } catch (err) {
    console.warn(`[DataSources] Yahoo OHLCV failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }

  // Fallback: Alpha Vantage
  try {
    return await fetchDailyOHLCV(ticker);
  } catch (err) {
    console.warn(`[DataSources] Alpha Vantage OHLCV failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }

  return [];
}

/* ── Company Overview / Fundamentals ── */

export async function fetchCompanyData(ticker: string): Promise<{
  overview: CompanyOverview | undefined;
  fundamentals: YahooFundamentals | undefined;
}> {
  let overview: CompanyOverview | undefined;
  let fundamentals: YahooFundamentals | undefined;

  // Yahoo Finance fundamentals (richer data, no rate limit)
  try {
    fundamentals = (await fetchFundamentals(ticker)) ?? undefined;
  } catch (err) {
    console.warn(`[DataSources] Yahoo fundamentals failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }

  // Alpha Vantage company overview (description, exchange info)
  try {
    overview = (await fetchCompanyOverview(ticker)) ?? undefined;
  } catch (err) {
    console.warn(`[DataSources] AV overview failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }

  // If AV failed but Yahoo worked, build a basic overview from Yahoo data
  if (!overview && fundamentals) {
    overview = {
      ticker,
      name: ticker,
      description: "",
      sector: fundamentals.sector,
      industry: fundamentals.industry,
      marketCap: fundamentals.marketCap.toLocaleString(),
      peRatio: fundamentals.peRatio?.toFixed(2) ?? "N/A",
      dividendYield: fundamentals.dividendYield
        ? (fundamentals.dividendYield * 100).toFixed(2)
        : "0",
      fiftyTwoWeekHigh: fundamentals.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: fundamentals.fiftyTwoWeekLow,
      exchange: "",
      currency: "USD",
    };
  }

  return { overview, fundamentals };
}

/* ── Realtime Price (EUR) ── */

export async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const quote = await fetchQuote(ticker);
    return quote?.priceEur ?? null;
  } catch {
    return null;
  }
}

export { type YahooFundamentals } from "./yahoo-finance";
