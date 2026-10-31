import { NextResponse } from "next/server";
import { fetchFundamentals, fetchFinancialStatements, fetchExtendedData } from "@/lib/api/yahoo-finance";
import { calculateAltmanZ, calculatePiotroskiF } from "@/lib/financial-health";
import { calculateInvestmentScore } from "@/lib/investment-score";
import { calculateValuation } from "@/lib/valuation";
import { getOrFetchStockData } from "@/lib/data";
import { calculateIndicators } from "@/lib/indicators";
import { getCached } from "@/lib/cache";
import type { MarketRegimeData } from "@/lib/market-regime";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const [fundamentals, statements, stockData, extendedData, cachedRegime] = await Promise.all([
    fetchFundamentals(ticker).catch(() => null),
    fetchFinancialStatements(ticker).catch(() => null),
    getOrFetchStockData(ticker).catch(() => null),
    fetchExtendedData(ticker).catch(() => null),
    getCached<MarketRegimeData>("scanner-regime", 4 * 60 * 60 * 1000).catch(() => null),
  ]);

  if (!fundamentals || !stockData) {
    return NextResponse.json(
      { error: "Nicht genug Daten fuer Score-Berechnung" },
      { status: 404 }
    );
  }

  const closes = stockData.ohlcvData.map((d) => d.close);
  const volumes = stockData.ohlcvData.map((d) => d.volume);
  const highs = stockData.ohlcvData.map((d) => d.high);
  const lows = stockData.ohlcvData.map((d) => d.low);
  const indicators = closes.length > 20
    ? calculateIndicators(closes, volumes, highs, lows)
    : null;

  const altmanZ = statements
    ? calculateAltmanZ(statements, fundamentals.marketCap)
    : null;
  const piotroskiF = statements
    ? calculatePiotroskiF(statements)
    : null;

  const valuation = calculateValuation(
    fundamentals, stockData.currentPrice,
    fundamentals.beta, indicators?.latestValues.atrPercent ?? null, fundamentals.sector,
  );

  // Calculate earnings revision score from extended data
  let earningsRevisionScore = 0;
  if (extendedData) {
    const currentQ = extendedData.earningsTrend.find((t) => t.period === "0q");
    const nextQ = extendedData.earningsTrend.find((t) => t.period === "+1q");
    earningsRevisionScore =
      (currentQ ? currentQ.epsRevisions.upLast30 - currentQ.epsRevisions.downLast30 : 0) +
      (nextQ ? nextQ.epsRevisions.upLast30 - nextQ.epsRevisions.downLast30 : 0);
  }

  const score = calculateInvestmentScore({
    peRatio: fundamentals.peRatio,
    returnOnEquity: fundamentals.returnOnEquity,
    profitMargin: fundamentals.profitMargin,
    revenueGrowth: fundamentals.revenueGrowth,
    earningsGrowth: fundamentals.earningsGrowth,
    debtToEquity: fundamentals.debtToEquity,
    sector: fundamentals.sector,
    compositeScore: indicators?.compositeScore.score ?? 0,
    convergence: indicators?.compositeScore.convergence ?? 0,
    trendStrength: indicators?.signals.trendStrength ?? "no_trend",
    bollingerSqueeze: indicators?.signals.bollingerSqueeze ?? false,
    analystRating: fundamentals.recommendationKey,
    numberOfAnalysts: fundamentals.numberOfAnalysts,
    earningsRevisionScore,
    altmanZScore: altmanZ?.score ?? null,
    altmanZZone: altmanZ?.zone ?? null,
    piotroskiFScore: piotroskiF?.score ?? null,
    atrPercent: indicators?.latestValues.atrPercent ?? null,
    currentRatio: fundamentals.currentRatio,
    marginOfSafety: valuation.consensus.fairValue != null ? valuation.consensus.marginOfSafety : null,
    valuationVerdict: valuation.consensus.fairValue != null ? valuation.consensus.verdict : null,
    regime: cachedRegime?.regime ?? null,
  });

  return NextResponse.json(score);
}
