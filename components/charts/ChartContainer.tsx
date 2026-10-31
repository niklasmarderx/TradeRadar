"use client";

import { useState, useMemo } from "react";
import ChartToolbar from "./ChartToolbar";
import EnhancedChart from "./EnhancedChart";
import type { OHLCVPoint, PriceLevel, IndicatorResults } from "@/lib/types";

interface ChartContainerProps {
  data: OHLCVPoint[];
  priceLevels?: PriceLevel[];
  indicators?: IndicatorResults;
}

export default function ChartContainer({
  data,
  priceLevels,
  indicators,
}: ChartContainerProps) {
  const [timeframe, setTimeframe] = useState("ALL");
  const [overlays, setOverlays] = useState<string[]>([]);
  const [indicatorPanes, setIndicatorPanes] = useState<string[]>(["volume"]);

  const filteredData = useMemo(() => {
    if (timeframe === "ALL") return data;

    const now = new Date();
    let cutoff: Date;
    switch (timeframe) {
      case "1M":
        cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "3M":
        cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "6M":
        cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case "1Y":
        cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case "2Y":
        cutoff = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        break;
      case "5Y":
        cutoff = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        break;
      case "10Y":
        cutoff = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
        break;
      case "20Y":
        cutoff = new Date(now.getFullYear() - 20, now.getMonth(), now.getDate());
        break;
      default:
        return data;
    }

    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter((d) => d.time >= cutoffStr);
  }, [data, timeframe]);

  // Slice indicator arrays to match filtered data range
  const filteredIndicators = useMemo(() => {
    if (!indicators || timeframe === "ALL") return indicators;

    const startIdx = data.length - filteredData.length;

    // Slice all time-series arrays
    const sma20 = indicators.sma20.slice(startIdx);
    const sma50 = indicators.sma50.slice(startIdx);
    const sma200 = indicators.sma200.slice(startIdx);
    const ema20 = indicators.ema20.slice(startIdx);
    const rsi14 = indicators.rsi14.slice(startIdx);
    const stochastic = indicators.stochastic.slice(startIdx);
    const adx = indicators.adx.slice(startIdx);
    const atr14 = indicators.atr14.slice(startIdx);
    const macd = indicators.macd.slice(startIdx);
    const bollingerBands = indicators.bollingerBands.slice(startIdx);

    // Recalculate latestValues from sliced arrays
    const last = <T,>(arr: (T | null)[]): T | null => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] !== null) return arr[i];
      }
      return null;
    };

    const price = filteredData[filteredData.length - 1]?.close ?? 0;
    const latestMacd = macd[macd.length - 1];
    const latestBB = bollingerBands[bollingerBands.length - 1];
    const latestStoch = stochastic[stochastic.length - 1];
    const latestAtr = last(atr14);

    const latestValues: typeof indicators.latestValues = {
      rsi: last(rsi14),
      stochasticK: latestStoch?.k ?? null,
      stochasticD: latestStoch?.d ?? null,
      adx: last(adx),
      atr: latestAtr,
      atrPercent: latestAtr !== null && price > 0 ? (latestAtr / price) * 100 : null,
      macdLine: latestMacd?.macd ?? null,
      macdSignal: latestMacd?.signal ?? null,
      macdHistogram: latestMacd?.histogram ?? null,
      sma20: last(sma20),
      sma50: last(sma50),
      sma200: last(sma200),
      bollingerUpper: latestBB?.upper ?? null,
      bollingerLower: latestBB?.lower ?? null,
      bollingerMiddle: latestBB?.middle ?? null,
    };

    return {
      ...indicators,
      sma20, sma50, sma200, ema20, rsi14, stochastic, adx, atr14, macd, bollingerBands,
      latestValues,
    };
  }, [indicators, data, filteredData, timeframe]);

  const toggleOverlay = (id: string) => {
    setOverlays((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  const toggleIndicator = (id: string) => {
    setIndicatorPanes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <ChartToolbar
        activeTimeframe={timeframe}
        activeOverlays={overlays}
        activeIndicators={indicatorPanes}
        onTimeframeChange={setTimeframe}
        onOverlayToggle={toggleOverlay}
        onIndicatorToggle={toggleIndicator}
      />
      <EnhancedChart
        data={filteredData}
        priceLevels={priceLevels}
        indicators={filteredIndicators}
        activeOverlays={overlays}
        activeIndicators={indicatorPanes}
      />
    </div>
  );
}
