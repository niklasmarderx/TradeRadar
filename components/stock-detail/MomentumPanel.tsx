"use client";

import { useState, useEffect } from "react";

interface PeriodReturns {
  oneMonth: number | null;
  threeMonth: number | null;
  sixMonth: number | null;
  twelveMonth: number | null;
  ytd: number | null;
}

interface RSPeriod {
  period: string;
  stockReturn: number | null;
  benchmarkReturn: number | null;
  excess: number | null;
}

interface ValueGrowthResult {
  classification: string;
  valueScore: number;
  growthScore: number;
}

interface MomentumData {
  returns: PeriodReturns;
  relativeStrength: { periods: RSPeriod[]; comparison: string } | null;
  beta: number | null;
  valueGrowth: ValueGrowthResult | null;
}

interface Props {
  ticker: string;
}

function ReturnBadge({ value, label }: { value: number | null; label: string }) {
  if (value == null) return (
    <div className="bg-background rounded px-3 py-2 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-sm font-mono-num text-muted mt-0.5">–</div>
    </div>
  );
  return (
    <div className="bg-background rounded px-3 py-2 text-center">
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`text-sm font-mono-num font-semibold mt-0.5 ${value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted"}`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </div>
    </div>
  );
}

const STYLE_LABELS: Record<string, string> = {
  "deep-value": "Deep Value",
  "value": "Value",
  "blend": "Blend",
  "growth": "Growth",
  "hyper-growth": "Hyper Growth",
};

export default function MomentumPanel({ ticker }: Props) {
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}/momentum`)
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
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card-border/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 text-center text-muted text-sm">
        Momentum-Daten nicht verfuegbar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Returns */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Kurs-Performance</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <ReturnBadge value={data.returns.oneMonth} label="1 Monat" />
          <ReturnBadge value={data.returns.threeMonth} label="3 Monate" />
          <ReturnBadge value={data.returns.sixMonth} label="6 Monate" />
          <ReturnBadge value={data.returns.twelveMonth} label="12 Monate" />
          <ReturnBadge value={data.returns.ytd} label="YTD" />
        </div>
      </div>

      {/* Relative Strength */}
      {data.relativeStrength && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-bright uppercase tracking-wider">Relative Stärke vs S&P 500</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${
              data.relativeStrength.comparison === "outperforming"
                ? "bg-up/10 text-up border-up/30"
                : data.relativeStrength.comparison === "underperforming"
                ? "bg-down/10 text-down border-down/30"
                : "bg-muted/10 text-muted border-muted/30"
            }`}>
              {data.relativeStrength.comparison === "outperforming" ? "Outperforming" :
               data.relativeStrength.comparison === "underperforming" ? "Underperforming" : "Tracking"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                  <th className="text-left px-2 py-1.5">Periode</th>
                  <th className="text-right px-2 py-1.5">Aktie</th>
                  <th className="text-right px-2 py-1.5">S&P 500</th>
                  <th className="text-right px-2 py-1.5">Differenz</th>
                </tr>
              </thead>
              <tbody>
                {data.relativeStrength.periods.map((p) => (
                  <tr key={p.period} className="border-b border-card-border/50 last:border-0">
                    <td className="px-2 py-1.5 text-sub">{p.period}</td>
                    <td className={`px-2 py-1.5 text-right font-mono-num ${
                      p.stockReturn != null && p.stockReturn > 0 ? "text-up" : p.stockReturn != null && p.stockReturn < 0 ? "text-down" : "text-muted"
                    }`}>
                      {p.stockReturn != null ? (p.stockReturn > 0 ? "+" : "") + p.stockReturn.toFixed(1) + "%" : "–"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono-num ${
                      p.benchmarkReturn != null && p.benchmarkReturn > 0 ? "text-up" : p.benchmarkReturn != null && p.benchmarkReturn < 0 ? "text-down" : "text-muted"
                    }`}>
                      {p.benchmarkReturn != null ? (p.benchmarkReturn > 0 ? "+" : "") + p.benchmarkReturn.toFixed(1) + "%" : "–"}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono-num font-semibold ${
                      p.excess != null && p.excess > 0 ? "text-up" : p.excess != null && p.excess < 0 ? "text-down" : "text-muted"
                    }`}>
                      {p.excess != null ? (p.excess > 0 ? "+" : "") + p.excess.toFixed(1) + "%" : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Beta + Value/Growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Beta */}
        {data.beta != null && (
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-2">Beta</h3>
            <div className="text-2xl font-mono-num text-bright">{data.beta.toFixed(2)}</div>
            <p className="text-[10px] text-muted mt-1">
              {data.beta > 1.3 ? "Hohe Volatilität — bewegt sich stärker als der Markt" :
               data.beta > 0.8 ? "Marktnahe Volatilität" :
               "Niedrige Volatilität — defensiver Charakter"}
            </p>
          </div>
        )}

        {/* Value/Growth */}
        {data.valueGrowth && (
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-bright uppercase tracking-wider">Investment-Stil</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                data.valueGrowth.classification.includes("growth") ? "bg-purple/15 text-purple" :
                data.valueGrowth.classification.includes("value") ? "bg-info/15 text-info" :
                "bg-muted/15 text-muted"
              }`}>
                {STYLE_LABELS[data.valueGrowth.classification] ?? data.valueGrowth.classification}
              </span>
            </div>
            <div className="space-y-2 mt-3">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-info">Value</span>
                  <span className="font-mono-num text-muted">{data.valueGrowth.valueScore}</span>
                </div>
                <div className="h-2 bg-card-border/30 rounded">
                  <div className="h-full bg-info/60 rounded" style={{ width: `${data.valueGrowth.valueScore}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-purple">Growth</span>
                  <span className="font-mono-num text-muted">{data.valueGrowth.growthScore}</span>
                </div>
                <div className="h-2 bg-card-border/30 rounded">
                  <div className="h-full bg-purple/60 rounded" style={{ width: `${data.valueGrowth.growthScore}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
