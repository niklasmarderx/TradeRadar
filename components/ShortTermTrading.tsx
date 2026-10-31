"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface IntradaySignal {
  composite: string;
  score: number;
  confidence: string;
  convergence: number;
  breakdown: { trend: number; momentum: number; volatility: number; volume: number };
  entry: number;
  target: number;
  stop: number;
  kellySize: number;
}

interface IntradayIndicators {
  rsi: number | null;
  macdHistogram: number | null;
  macdSignal: string;
  stochasticK: number | null;
  stochasticD: number | null;
  adx: number | null;
  atr: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  sma20: number | null;
  sma50: number | null;
}

interface IntradayData {
  ticker: string;
  interval: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  dataPoints: number;
  signal: IntradaySignal;
  indicators: IntradayIndicators;
  signals: Record<string, string>;
  supportResistance: { support: number; resistance: number };
  updatedAt: string;
}

interface ShortTermTradingProps {
  ticker: string;
}

const INTERVALS = [
  { value: "1m", label: "1 Min" },
  { value: "5m", label: "5 Min" },
  { value: "15m", label: "15 Min" },
];

const REFRESH_OPTIONS = [
  { value: 60, label: "1 Min" },
  { value: 120, label: "2 Min" },
  { value: 300, label: "5 Min" },
  { value: 600, label: "10 Min" },
];

const SIGNAL_STYLES: Record<string, string> = {
  "STRONG BUY": "bg-up/20 text-up border-up/40",
  BUY: "bg-up/10 text-up border-up/30",
  SELL: "bg-down/20 text-down border-down/40",
  "STRONG SELL": "bg-down/30 text-down border-down/50",
  HOLD: "bg-muted/20 text-muted border-muted/40",
};

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function ShortTermTrading({ ticker }: ShortTermTradingProps) {
  const [interval, setInterval] = useState("5m");
  const [refreshSec, setRefreshSec] = useState(120);
  const [data, setData] = useState<IntradayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [history, setHistory] = useState<Array<{ time: string; price: number; signal: string; score: number }>>([]);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock/${ticker}/intraday?interval=${interval}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Fehler ${res.status}`);
      }
      const newData: IntradayData = await res.json();
      setData(newData);

      // Track signal history
      setHistory((prev) => {
        const entry = {
          time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          price: newData.currentPrice,
          signal: newData.signal.composite,
          score: newData.signal.score,
        };
        return [...prev.slice(-29), entry]; // Keep last 30 updates
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [ticker, interval]);

  // Auto-refresh timer
  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    fetchData();
    setCountdown(refreshSec);

    timerRef.current = globalThis.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return refreshSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, refreshSec, fetchData]);

  const s = data?.signal;
  const ind = data?.indicators;

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <div className="flex items-center gap-2">
          <h3 className="section-header text-xs font-semibold uppercase tracking-widest text-sub">
            Short-Term Trading
          </h3>
          {active && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
              <span className="text-[9px] text-up">LIVE</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Interval Selector */}
          <div className="flex gap-0.5">
            {INTERVALS.map((i) => (
              <button
                key={i.value}
                onClick={() => setInterval(i.value)}
                className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                  interval === i.value
                    ? "bg-accent/20 text-accent border border-accent/40"
                    : "text-muted hover:text-foreground border border-transparent"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>

          {/* Refresh Interval */}
          <select
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value))}
            className="text-[9px] bg-background border border-card-border rounded px-1 py-0.5 text-muted"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Start/Stop */}
          <button
            onClick={() => setActive(!active)}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
              active
                ? "bg-down/20 text-down border border-down/40"
                : "bg-up/20 text-up border border-up/40"
            }`}
          >
            {active ? "Stop" : "Start"}
          </button>
        </div>
      </div>

      {!data && !loading && !error && (
        <div className="p-6 text-center">
          <p className="text-xs text-muted">
            Klicke &ldquo;Start&rdquo; fuer Echtzeit-Intraday-Signale mit automatischen Updates.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4">
          <div className="bg-down/10 border border-down/30 rounded p-2 text-xs text-down">{error}</div>
        </div>
      )}

      {data && s && ind && (
        <div className="p-4 space-y-3">
          {/* Price + Signal */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono-num text-2xl font-bold text-bright">
                {fmt(data.currentPrice)}
              </span>
              <span className={`ml-2 font-mono-num text-sm ${data.change >= 0 ? "text-up" : "text-down"}`}>
                {data.change >= 0 ? "+" : ""}{fmt(data.change)} ({fmt(data.changePercent, 2)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 text-sm font-bold rounded border ${SIGNAL_STYLES[s.composite] ?? ""}`}>
                {s.composite}
              </span>
              <span className="font-mono-num text-lg font-bold text-bright">
                {s.score > 0 ? "+" : ""}{s.score}
              </span>
            </div>
          </div>

          {/* Countdown + Timestamp */}
          <div className="flex items-center justify-between text-[9px] text-muted">
            <span>Intervall: {interval} | {data.dataPoints} Datenpunkte</span>
            <span>
              {active && <>Naechstes Update: {countdown}s | </>}
              Stand: {new Date(data.updatedAt).toLocaleTimeString("de-DE")}
            </span>
          </div>

          {/* Quick Indicators Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">RSI</span>
              <span className={`font-mono-num text-sm ${
                ind.rsi !== null && ind.rsi > 70 ? "text-down" :
                ind.rsi !== null && ind.rsi < 30 ? "text-up" : "text-bright"
              }`}>{fmt(ind.rsi, 1)}</span>
            </div>
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">MACD</span>
              <span className={`font-mono-num text-sm ${
                ind.macdHistogram !== null && ind.macdHistogram >= 0 ? "text-up" : "text-down"
              }`}>{fmt(ind.macdHistogram, 3)}</span>
            </div>
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">ADX</span>
              <span className="font-mono-num text-sm text-bright">{fmt(ind.adx, 1)}</span>
            </div>
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">ATR</span>
              <span className="font-mono-num text-sm text-bright">{fmt(ind.atr, 3)}</span>
            </div>
          </div>

          {/* Entry / Target / Stop */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">Entry</span>
              <span className="font-mono-num text-xs text-accent">{fmt(s.entry)}</span>
            </div>
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">Target</span>
              <span className="font-mono-num text-xs text-up">{fmt(s.target)}</span>
            </div>
            <div className="bg-background rounded px-2 py-1.5 text-center">
              <span className="text-[8px] text-muted uppercase block">Stop</span>
              <span className="font-mono-num text-xs text-down">{fmt(s.stop)}</span>
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="grid grid-cols-4 gap-2">
            {(["trend", "momentum", "volatility", "volume"] as const).map((key) => {
              const val = s.breakdown[key];
              return (
                <div key={key} className="text-center">
                  <span className="text-[8px] text-muted uppercase block">{key === "volatility" ? "Vola" : key}</span>
                  <span className={`font-mono-num text-xs ${val > 5 ? "text-up" : val < -5 ? "text-down" : "text-muted"}`}>
                    {val > 0 ? "+" : ""}{val}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Signal History */}
          {history.length > 1 && (
            <div className="border-t border-card-border pt-2">
              <span className="text-[9px] text-muted uppercase tracking-wider block mb-1">Signal-Verlauf</span>
              <div className="flex gap-1 flex-wrap">
                {history.slice(-15).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 bg-background rounded px-1.5 py-0.5"
                    title={`${h.time}: ${h.signal} (${h.score}) @ ${fmt(h.price)}`}
                  >
                    <span className="text-[8px] text-muted">{h.time.slice(0, 5)}</span>
                    <span className={`text-[8px] font-bold ${
                      h.signal.includes("BUY") ? "text-up" :
                      h.signal.includes("SELL") ? "text-down" : "text-muted"
                    }`}>
                      {h.score > 0 ? "+" : ""}{h.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support / Resistance */}
          <div className="flex items-center justify-between text-[10px]">
            <span>
              <span className="text-muted">Support: </span>
              <span className="font-mono-num text-up">{fmt(data.supportResistance.support)}</span>
            </span>
            <span>
              <span className="text-muted">Resistance: </span>
              <span className="font-mono-num text-down">{fmt(data.supportResistance.resistance)}</span>
            </span>
            <span>
              <span className="text-muted">Kelly: </span>
              <span className="font-mono-num text-bright">{s.kellySize}%</span>
            </span>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="p-4 space-y-2">
          <div className="skeleton h-8 w-1/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-2/3 rounded" />
        </div>
      )}
    </div>
  );
}
