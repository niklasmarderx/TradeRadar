"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
} from "lightweight-charts";
import { OHLCPoint, PriceLevel } from "@/lib/types";

interface ChartWidgetProps {
  data: OHLCPoint[];
  priceLevels?: PriceLevel[];
  height?: number;
}

export default function ChartWidget({
  data,
  priceLevels,
  height = 400,
}: ChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "#1a2235" },
        textColor: "#94a3b8",
        fontFamily:
          "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 45, 69, 0.5)" },
        horzLines: { color: "rgba(30, 45, 69, 0.5)" },
      },
      crosshair: {
        vertLine: { color: "#06b6d4", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "#06b6d4", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "#1e2d45",
      },
      timeScale: {
        borderColor: "#1e2d45",
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(data);

    if (priceLevels) {
      for (const level of priceLevels) {
        series.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.label,
        });
      }
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, priceLevels, height]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-card-border"
      aria-label="Kursdiagramm"
    />
  );
}
