import { getOrFetchStockData } from "@/lib/data";
import { calculateIndicators } from "@/lib/indicators";
import { researchStock } from "@/lib/api/research";
import { fetchFundamentals } from "@/lib/api/yahoo-finance";
import { calculateValuation } from "@/lib/valuation";
import type { AIAnalysisRequest } from "@/lib/types";

/**
 * Prepares a full AIAnalysisRequest for a given ticker.
 * Shared between single analyze and batch analyze endpoints.
 */
export async function prepareAnalysisRequest(ticker: string): Promise<AIAnalysisRequest> {
  const stockData = await getOrFetchStockData(ticker);
  if (!stockData || stockData.ohlcvData.length < 20) {
    throw new Error(`Nicht genug Daten fuer ${ticker}`);
  }

  const closes = stockData.ohlcvData.map((d) => d.close);
  const volumes = stockData.ohlcvData.map((d) => d.volume);
  const highs = stockData.ohlcvData.map((d) => d.high);
  const lows = stockData.ohlcvData.map((d) => d.low);
  const indicators = calculateIndicators(closes, volumes, highs, lows);

  const [research, fundamentals] = await Promise.all([
    researchStock(ticker, stockData.name).catch(() => undefined),
    fetchFundamentals(ticker).catch(() => undefined),
  ]);

  // Calculate valuation models if fundamentals available
  const valuation = fundamentals
    ? calculateValuation(fundamentals, stockData.currentPrice, fundamentals.beta)
    : undefined;

  return {
    ticker: stockData.ticker,
    name: stockData.name,
    currentPrice: stockData.currentPrice,
    ohlcvData: stockData.ohlcvData.slice(-200),
    indicators,
    companyOverview: stockData.companyOverview,
    relatedNews: stockData.relatedNews,
    marketPhase: stockData.marketPhase ?? "neutral",
    research: research ?? undefined,
    fundamentals: fundamentals
      ? {
          peRatio: fundamentals.peRatio,
          forwardPE: fundamentals.forwardPE,
          pegRatio: fundamentals.pegRatio,
          dividendYield: fundamentals.dividendYield,
          profitMargin: fundamentals.profitMargin,
          operatingMargin: fundamentals.operatingMargin,
          returnOnEquity: fundamentals.returnOnEquity,
          debtToEquity: fundamentals.debtToEquity,
          revenueGrowth: fundamentals.revenueGrowth,
          earningsGrowth: fundamentals.earningsGrowth,
          targetMeanPrice: fundamentals.targetMeanPrice,
          recommendationKey: fundamentals.recommendationKey,
          numberOfAnalysts: fundamentals.numberOfAnalysts,
        }
      : undefined,
    valuation: valuation && valuation.consensus.fairValue !== null
      ? {
          dcfFairValue: valuation.dcf.fairValue,
          grahamFairValue: valuation.graham.fairValue,
          lynchFairValue: valuation.lynch.fairValue,
          consensusFairValue: valuation.consensus.fairValue,
          marginOfSafety: valuation.consensus.marginOfSafety,
          verdict: valuation.consensus.verdict,
        }
      : undefined,
  };
}
