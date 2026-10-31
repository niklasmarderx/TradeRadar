"use client";

interface ChartToolbarProps {
  activeTimeframe: string;
  activeOverlays: string[];
  activeIndicators: string[];
  onTimeframeChange: (tf: string) => void;
  onOverlayToggle: (overlay: string) => void;
  onIndicatorToggle: (indicator: string) => void;
}

const TIMEFRAMES = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "20Y", "ALL"];

const OVERLAYS = [
  { id: "sma20", label: "SMA 20" },
  { id: "sma50", label: "SMA 50" },
  { id: "sma200", label: "SMA 200" },
  { id: "ema20", label: "EMA 20" },
  { id: "bb", label: "Bollinger" },
];

const INDICATORS = [
  { id: "volume", label: "Vol" },
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
];

export default function ChartToolbar({
  activeTimeframe,
  activeOverlays,
  activeIndicators,
  onTimeframeChange,
  onOverlayToggle,
  onIndicatorToggle,
}: ChartToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-card border border-card-border rounded-t-lg">
      {/* Timeframe */}
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-2 py-0.5 text-[10px] font-mono-num rounded transition-colors ${
              activeTimeframe === tf
                ? "bg-accent/20 text-accent border border-accent/40"
                : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-card-border" />

      {/* Overlays */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-muted uppercase tracking-widest mr-1">
          Overlay
        </span>
        {OVERLAYS.map((o) => (
          <button
            key={o.id}
            onClick={() => onOverlayToggle(o.id)}
            className={`px-1.5 py-0.5 text-[10px] font-mono-num rounded transition-colors ${
              activeOverlays.includes(o.id)
                ? "bg-blue/15 text-blue border border-blue/30"
                : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-card-border" />

      {/* Indicators */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-muted uppercase tracking-widest mr-1">
          Indikator
        </span>
        {INDICATORS.map((ind) => (
          <button
            key={ind.id}
            onClick={() => onIndicatorToggle(ind.id)}
            className={`px-1.5 py-0.5 text-[10px] font-mono-num rounded transition-colors ${
              activeIndicators.includes(ind.id)
                ? "bg-purple/15 text-purple border border-purple/30"
                : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
            }`}
          >
            {ind.label}
          </button>
        ))}
      </div>
    </div>
  );
}
