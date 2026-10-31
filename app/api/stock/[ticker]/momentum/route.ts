import { NextResponse } from "next/server";
import { fetchHistoricalData, fetchFundamentals } from "@/lib/api/yahoo-finance";
import {
  calculatePeriodReturns,
  calculateRelativeStrength,
  calculateBeta,
  classifyValueGrowth,
} from "@/lib/momentum";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const [stockData, spxData, fundamentals] = await Promise.all([
    fetchHistoricalData(ticker, 5).catch(() => []),
    fetchHistoricalData("^GSPC", 5).catch(() => []),
    fetchFundamentals(ticker).catch(() => null),
  ]);

  if (stockData.length < 21) {
    return NextResponse.json(
      { error: "Nicht genug historische Daten" },
      { status: 404 }
    );
  }

  const stockCloses = stockData.map((d) => d.close);
  const stockDates = stockData.map((d) => d.time);
  const spxCloses = spxData.map((d) => d.close);

  const returns = calculatePeriodReturns(stockCloses, stockDates);
  const relativeStrength = spxCloses.length > 21
    ? calculateRelativeStrength(stockCloses, spxCloses)
    : null;
  const beta = spxCloses.length > 21
    ? calculateBeta(stockCloses, spxCloses)
    : null;
  const valueGrowth = fundamentals
    ? classifyValueGrowth(fundamentals)
    : null;

  return NextResponse.json({
    returns,
    relativeStrength,
    beta,
    valueGrowth,
  });
}
