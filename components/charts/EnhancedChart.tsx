"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { OHLCVPoint, PriceLevel, IndicatorResults } from "@/lib/types";

interface EnhancedChartProps {
  data: OHLCVPoint[];
  priceLevels?: PriceLevel[];
  indicators?: IndicatorResults;
  activeOverlays?: string[];
  activeIndicators?: string[];
  height?: number;
}

const CHART_BG = "#1a2235";
const GRID_COLOR = "rgba(30, 45, 69, 0.5)";
const FONT_FAMILY = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";

export default function EnhancedChart({
  data,
  priceLevels,
  indicators,
  activeOverlays = [],
  activeIndicators = ["volume"],
  height = 450,
}: EnhancedChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const buildChart = useCallback(() => {
    if (!containerRef.current || data.length === 0) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const showVolume = activeIndicators.includes("volume");
    const showRSI = activeIndicators.includes("rsi");
    const showMACD = activeIndicators.includes("macd");

    // Calculate total height - sub-panes take space from total
    const subPaneCount = [showVolume, showRSI, showMACD].filter(Boolean).length;
    const totalHeight = height + subPaneCount * 120;

    const chart = createChart(containerRef.current, {
      height: totalHeight,
      layout: {
        background: { color: CHART_BG },
        textColor: "#94a3b8",
        fontFamily: FONT_FAMILY,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        vertLine: { color: "#06b6d4", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "#06b6d4", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: "#1e2d45" },
      timeScale: { borderColor: "#1e2d45", timeVisible: false },
    });

    chartRef.current = chart;

    // ── Pane 0: Candlesticks ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    candleSeries.setData(
      data.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Price levels (Entry/Target/Stop)
    if (priceLevels) {
      for (const level of priceLevels) {
        candleSeries.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.label,
        });
      }
    }

    // ── Overlays on Pane 0 ──
    if (indicators) {
      const overlayConfigs: Record<string, { data: (number | null)[]; color: string; lineWidth?: number; style?: number }> = {
        sma20: { data: indicators.sma20, color: "#3b82f6" },
        sma50: { data: indicators.sma50, color: "#8b5cf6" },
        sma200: { data: indicators.sma200, color: "#f59e0b" },
        ema20: { data: indicators.ema20, color: "#06b6d4", style: LineStyle.Dashed },
      };

      for (const overlayId of activeOverlays) {
        const config = overlayConfigs[overlayId];
        if (!config) continue;

        const series = chart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: 1,
          lineStyle: config.style ?? LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        series.setData(
          data
            .map((d, i) => ({
              time: d.time,
              value: config.data[i],
            }))
            .filter((p): p is { time: string; value: number } => p.value !== null)
        );
      }

      // Bollinger Bands
      if (activeOverlays.includes("bb") && indicators.bollingerBands) {
        const bbUpper = chart.addSeries(LineSeries, {
          color: "rgba(148,163,184,0.5)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        const bbLower = chart.addSeries(LineSeries, {
          color: "rgba(148,163,184,0.5)",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        bbUpper.setData(
          data
            .map((d, i) => ({
              time: d.time,
              value: indicators.bollingerBands[i]?.upper ?? null,
            }))
            .filter((p): p is { time: string; value: number } => p.value !== null)
        );
        bbLower.setData(
          data
            .map((d, i) => ({
              time: d.time,
              value: indicators.bollingerBands[i]?.lower ?? null,
            }))
            .filter((p): p is { time: string; value: number } => p.value !== null)
        );
      }
    }

    // ── Track pane index ──
    let nextPane = 1;

    // ── Volume Pane ──
    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "volume" },
      }, nextPane);

      volSeries.setData(
        data.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
        }))
      );
      nextPane++;
    }

    // ── RSI Pane ──
    if (showRSI && indicators?.rsi14) {
      const rsiSeries = chart.addSeries(LineSeries, {
        color: "#eab308",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
      }, nextPane);

      rsiSeries.setData(
        data
          .map((d, i) => ({
            time: d.time,
            value: indicators.rsi14[i],
          }))
          .filter((p): p is { time: string; value: number } => p.value !== null)
      );

      // Overbought/oversold lines
      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(239,68,68,0.4)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "",
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(34,197,94,0.4)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "",
      });
      nextPane++;
    }

    // ── MACD Pane ──
    if (showMACD && indicators?.macd) {
      // MACD Line
      const macdLine = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      }, nextPane);

      macdLine.setData(
        data
          .map((d, i) => ({
            time: d.time,
            value: indicators.macd[i]?.macd ?? null,
          }))
          .filter((p): p is { time: string; value: number } => p.value !== null)
      );

      // Signal Line
      const signalLine = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      }, nextPane);

      signalLine.setData(
        data
          .map((d, i) => ({
            time: d.time,
            value: indicators.macd[i]?.signal ?? null,
          }))
          .filter((p): p is { time: string; value: number } => p.value !== null)
      );

      // Histogram
      const histSeries = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      }, nextPane);

      histSeries.setData(
        data
          .map((d, i) => {
            const h = indicators.macd[i]?.histogram;
            if (h === null || h === undefined) return null;
            return {
              time: d.time,
              value: h,
              color: h >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
            };
          })
          .filter((p): p is { time: string; value: number; color: string } => p !== null)
      );
    }

    chart.timeScale().fitContent();

    // Responsive
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
  }, [data, priceLevels, indicators, activeOverlays, activeIndicators, height]);

  useEffect(() => {
    const cleanup = buildChart();
    return cleanup;
  }, [buildChart]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-b-lg overflow-hidden border border-t-0 border-card-border"
      aria-label="Erweitertes Kursdiagramm"
    />
  );
}
