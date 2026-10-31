"use client";

import { useState, useEffect } from "react";

interface HealthData {
  altmanZ: { score: number; zone: "safe" | "grey" | "distress" } | null;
  piotroskiF: { score: number; criteria: boolean[]; labels: string[] } | null;
  interestCoverage: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  healthGrade: string;
  dividendSafety: { yield: number | null; payoutRatio: number | null; rating: string; fiveYearAvg: number | null };
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

interface Props {
  ticker: string;
  currentPrice: number;
}

const ZONE_COLORS = {
  safe: "bg-up/15 text-up border-up/30",
  grey: "bg-gold/15 text-gold border-gold/30",
  distress: "bg-down/15 text-down border-down/30",
};

const ZONE_LABELS = { safe: "Sicher", grey: "Grauzone", distress: "Gefährdet" };

const SAFETY_COLORS: Record<string, string> = {
  "Very Safe": "text-up",
  "Safe": "text-up",
  "Caution": "text-gold",
  "At Risk": "text-down",
  "N/A": "text-muted",
};

export default function FinancialHealthPanel({ ticker, currentPrice }: Props) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-card-border/50 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-card-border/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pos52w = data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
    ? Math.round(((currentPrice - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Health Grade */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider">Finanzielle Gesundheit</h3>
          <span className={`text-lg font-bold px-3 py-1 rounded ${
            data.healthGrade.startsWith("A") ? "bg-up/15 text-up" :
            data.healthGrade.startsWith("B") ? "bg-accent/15 text-accent" :
            data.healthGrade.startsWith("C") ? "bg-gold/15 text-gold" :
            "bg-down/15 text-down"
          }`}>{data.healthGrade}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Altman Z */}
          {data.altmanZ && (
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Altman Z-Score</div>
              <div className="text-sm font-mono-num text-bright mt-0.5">{data.altmanZ.score.toFixed(2)}</div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border mt-1 inline-block ${ZONE_COLORS[data.altmanZ.zone]}`}>
                {ZONE_LABELS[data.altmanZ.zone]}
              </span>
            </div>
          )}

          {/* Piotroski F */}
          {data.piotroskiF && (
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Piotroski F-Score</div>
              <div className="text-sm font-mono-num text-bright mt-0.5">{data.piotroskiF.score}/9</div>
              <span className={`text-[9px] mt-1 inline-block ${
                data.piotroskiF.score >= 7 ? "text-up" : data.piotroskiF.score >= 5 ? "text-gold" : "text-down"
              }`}>
                {data.piotroskiF.score >= 7 ? "Stark" : data.piotroskiF.score >= 5 ? "Mittel" : "Schwach"}
              </span>
            </div>
          )}

          {/* Current Ratio */}
          {data.currentRatio != null && (
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Current Ratio</div>
              <div className={`text-sm font-mono-num mt-0.5 ${
                data.currentRatio > 1.5 ? "text-up" : data.currentRatio > 1 ? "text-gold" : "text-down"
              }`}>{data.currentRatio.toFixed(2)}</div>
            </div>
          )}

          {/* Quick Ratio */}
          {data.quickRatio != null && (
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Quick Ratio</div>
              <div className={`text-sm font-mono-num mt-0.5 ${
                data.quickRatio > 1 ? "text-up" : data.quickRatio > 0.8 ? "text-gold" : "text-down"
              }`}>{data.quickRatio.toFixed(2)}</div>
            </div>
          )}

          {/* Interest Coverage */}
          {data.interestCoverage != null && (
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Zinsdeckung</div>
              <div className={`text-sm font-mono-num mt-0.5 ${
                data.interestCoverage > 5 ? "text-up" : data.interestCoverage > 2 ? "text-gold" : "text-down"
              }`}>{data.interestCoverage.toFixed(1)}x</div>
            </div>
          )}

          {/* 52W Position */}
          <div className="bg-background rounded px-3 py-2">
            <div className="text-[10px] text-muted">52-Wochen Position</div>
            <div className="text-sm font-mono-num text-bright mt-0.5">{pos52w}%</div>
            <div className="w-full h-1.5 bg-card-border/50 rounded mt-1.5">
              <div className="h-full bg-accent rounded" style={{ width: `${Math.min(100, Math.max(0, pos52w))}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Piotroski Criteria */}
      {data.piotroskiF && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Piotroski-Kriterien</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
            {data.piotroskiF.labels.map((label, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                  data.piotroskiF!.criteria[i] ? "bg-up/20 text-up" : "bg-down/20 text-down"
                }`}>
                  {data.piotroskiF!.criteria[i] ? "\u2713" : "\u2717"}
                </span>
                <span className="text-sub">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dividend Safety */}
      {data.dividendSafety.rating !== "N/A" && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Dividenden-Sicherheit</h3>
          <div className="flex flex-wrap gap-4">
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Rendite</div>
              <div className="text-sm font-mono-num text-bright mt-0.5">
                {data.dividendSafety.yield != null ? (data.dividendSafety.yield * 100).toFixed(2) + "%" : "–"}
              </div>
            </div>
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Ausschüttungsquote</div>
              <div className="text-sm font-mono-num text-bright mt-0.5">
                {data.dividendSafety.payoutRatio != null ? (data.dividendSafety.payoutRatio * 100).toFixed(1) + "%" : "–"}
              </div>
            </div>
            <div className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">Sicherheit</div>
              <div className={`text-sm font-semibold mt-0.5 ${SAFETY_COLORS[data.dividendSafety.rating]}`}>
                {data.dividendSafety.rating}
              </div>
            </div>
            {data.dividendSafety.fiveYearAvg != null && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">5J-Durchschnitt</div>
                <div className="text-sm font-mono-num text-sub mt-0.5">{data.dividendSafety.fiveYearAvg.toFixed(2)}%</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
