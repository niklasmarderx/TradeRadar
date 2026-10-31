import { NextResponse } from "next/server";
import { fetchIntradayData, fetchQuote, type IntradayInterval } from "@/lib/api/yahoo-finance";
import { calculateIndicators } from "@/lib/indicators";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const url = new URL(request.url);
  const interval = (url.searchParams.get("interval") ?? "5m") as IntradayInterval;

  if (!["1m", "5m", "15m"].includes(interval)) {
    return NextResponse.json({ error: "Ungültiges Intervall. Erlaubt: 1m, 5m, 15m" }, { status: 400 });
  }

  try {
    const [intraday, quote] = await Promise.all([
      fetchIntradayData(ticker.toUpperCase(), interval),
      fetchQuote(ticker.toUpperCase()),
    ]);

    if (intraday.length < 20) {
      return NextResponse.json({ error: `Nicht genug Intraday-Daten fuer ${ticker}` }, { status: 404 });
    }

    // Calculate indicators on intraday data
    const closes = intraday.map((d) => d.close);
    const volumes = intraday.map((d) => d.volume);
    const highs = intraday.map((d) => d.high);
    const lows = intraday.map((d) => d.low);
    const indicators = calculateIndicators(closes, volumes, highs, lows);

    // Quick signal summary for short-term trading
    const cs = indicators.compositeScore;
    const v = indicators.latestValues;

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      interval,
      currentPrice: quote?.price ?? intraday[intraday.length - 1].close,
      change: quote?.change ?? 0,
      changePercent: quote?.changePercent ?? 0,
      dataPoints: intraday.length,
      ohlcvData: intraday,
      signal: {
        composite: cs.signal,
        score: cs.score,
        confidence: cs.confidence,
        convergence: cs.convergence,
        breakdown: cs.breakdown,
        entry: cs.suggestedEntry,
        target: cs.suggestedTarget,
        stop: cs.suggestedStop,
        kellySize: cs.kellySize,
      },
      indicators: {
        rsi: v.rsi,
        macdHistogram: v.macdHistogram,
        macdSignal: indicators.signals.macdSignal,
        stochasticK: v.stochasticK,
        stochasticD: v.stochasticD,
        adx: v.adx,
        atr: v.atr,
        bollingerUpper: v.bollingerUpper,
        bollingerLower: v.bollingerLower,
        sma20: v.sma20,
        sma50: v.sma50,
      },
      signals: indicators.signals,
      supportResistance: indicators.supportResistance,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
