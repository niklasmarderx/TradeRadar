import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TradingData, Action, NewsItem, StockPageData, OHLCVPoint } from "./types";
import { fetchOHLCV, fetchCompanyData, fetchCurrentPrice } from "./api/data-sources";

export async function loadTradingData(): Promise<TradingData> {
  const filePath = join(process.cwd(), "public", "trading-data.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as TradingData;
}

export async function getActionByTicker(
  ticker: string
): Promise<{ action: Action; relatedNews: NewsItem[] } | null> {
  const data = await loadTradingData();
  const action = data.actions.find(
    (a) => a.ticker.toUpperCase() === ticker.toUpperCase()
  );
  if (!action) return null;
  const relatedNews = data.news.filter((n) =>
    n.affected
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .includes(ticker.toUpperCase())
  );
  return { action, relatedNews };
}

export async function getRelatedNews(ticker: string): Promise<NewsItem[]> {
  const data = await loadTradingData();
  return data.news.filter((n) =>
    n.affected
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .includes(ticker.toUpperCase())
  );
}

/**
 * Fetches stock data from Alpha Vantage with fallback to static JSON.
 * Returns a unified StockPageData object for both live and static stocks.
 */
export async function getOrFetchStockData(ticker: string): Promise<StockPageData | null> {
  const data = await loadTradingData();
  const upperTicker = ticker.toUpperCase();

  // Try to find in static data first
  const staticAction = data.actions.find(
    (a) => a.ticker.toUpperCase() === upperTicker
  );
  const relatedNews = data.news.filter((n) =>
    n.affected
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .includes(upperTicker)
  );

  // Try to fetch live OHLCV data (Yahoo Finance primary, Alpha Vantage fallback)
  let ohlcvData: OHLCVPoint[] = [];
  let companyOverview = undefined;

  try {
    ohlcvData = await fetchOHLCV(upperTicker, 20);
    const { overview } = await fetchCompanyData(upperTicker);
    companyOverview = overview;
  } catch {
    // No static fallback — if all sources fail, ohlcvData stays empty
  }

  // If we have neither live data nor static data, this ticker doesn't exist
  if (ohlcvData.length === 0 && !staticAction) return null;

  // ALWAYS use realtime EUR quote — never use stale prices
  let currentPrice = 0;

  try {
    const realtimePrice = await fetchCurrentPrice(upperTicker);
    if (realtimePrice !== null) {
      currentPrice = realtimePrice;
    } else if (ohlcvData.length > 0) {
      // Last resort: use last OHLCV close (still live data, just not realtime quote)
      currentPrice = ohlcvData[ohlcvData.length - 1].close;
    }
  } catch {
    if (ohlcvData.length > 0) {
      currentPrice = ohlcvData[ohlcvData.length - 1].close;
    }
  }

  return {
    ticker: upperTicker,
    name: companyOverview?.name ?? staticAction?.name ?? upperTicker,
    currentPrice,
    ohlcvData,
    companyOverview,
    action: staticAction,
    relatedNews,
    marketPhase: data.market_phase,
  };
}
