"use client";

import { useState, useEffect, useMemo } from "react";
import type { YahooFundamentals } from "@/lib/api/yahoo-finance";
import { calculateValuation, type ValuationResult } from "@/lib/valuation";

interface Props {
  ticker: string;
  currentPrice: number;
}

function fmtEur(v: number | null): string {
  if (v == null) return "–";
  return v.toFixed(2) + " EUR";
}

function BarChart({ label, fairValue, currentPrice, color }: {
  label: string;
  fairValue: number | null;
  currentPrice: number;
  color: string;
}) {
  if (fairValue == null || fairValue <= 0) return null;
  const max = Math.max(fairValue, currentPrice) * 1.3;
  const fvPct = (fairValue / max) * 100;
  const cpPct = (currentPrice / max) * 100;
  const discount = ((fairValue - currentPrice) / currentPrice * 100);

  return (
    <div className="bg-background rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-bright">{label}</span>
        <span className="text-xs font-mono-num text-sub">{fmtEur(fairValue)}</span>
      </div>
      <div className="relative h-6 bg-card-border/30 rounded overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded opacity-40"
          style={{ width: `${fvPct}%`, backgroundColor: color }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground"
          style={{ left: `${cpPct}%` }}
          title={`Aktueller Kurs: ${currentPrice.toFixed(2)}`}
        />
        <div
          className="absolute top-0 text-[9px] font-mono-num text-foreground"
          style={{ left: `${Math.min(cpPct + 1, 85)}%`, lineHeight: "24px" }}
        >
          Kurs
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted">0</span>
        <span className={`text-[10px] font-mono-num font-semibold ${discount > 0 ? "text-up" : discount < 0 ? "text-down" : "text-muted"}`}>
          {discount > 0 ? "+" : ""}{discount.toFixed(1)}% Potenzial
        </span>
      </div>
    </div>
  );
}

export default function ValuationPanel({ ticker, currentPrice }: Props) {
  const [fundamentals, setFundamentals] = useState<YahooFundamentals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}/fundamentals`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.fundamentals) setFundamentals(d.fundamentals);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  const valuation: ValuationResult | null = useMemo(() => {
    if (!fundamentals) return null;
    return calculateValuation(fundamentals, currentPrice, fundamentals.beta);
  }, [fundamentals, currentPrice]);

  if (loading) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-card-border/50 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-card-border/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!valuation || valuation.consensus.fairValue == null) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 text-center text-muted text-sm">
        Bewertungsdaten nicht verfuegbar.
      </div>
    );
  }

  const { dcf, graham, lynch, consensus } = valuation;

  return (
    <div className="space-y-6">
      {/* Consensus */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider">Konsens-Bewertung</h3>
          <span className={`text-sm font-bold px-3 py-1 rounded ${
            consensus.verdict === "Unterbewertet"
              ? "bg-up/15 text-up"
              : consensus.verdict === "Überbewertet"
              ? "bg-down/15 text-down"
              : "bg-muted/15 text-muted"
          }`}>
            {consensus.verdict}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[10px] text-muted">Aktueller Kurs</div>
            <div className="text-lg font-mono-num text-bright">{currentPrice.toFixed(2)} EUR</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Fair Value</div>
            <div className="text-lg font-mono-num text-accent">{consensus.fairValue!.toFixed(2)} EUR</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Margin of Safety</div>
            <div className={`text-lg font-mono-num ${consensus.marginOfSafety > 0 ? "text-up" : consensus.marginOfSafety < 0 ? "text-down" : "text-muted"}`}>
              {consensus.marginOfSafety > 0 ? "+" : ""}{consensus.marginOfSafety.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Model Bars */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Bewertungsmodelle</h3>
        <div className="space-y-3">
          <BarChart label="DCF (Discounted Cash Flow)" fairValue={dcf.fairValue} currentPrice={currentPrice} color="#06b6d4" />
          <BarChart label="Graham Number" fairValue={graham.fairValue} currentPrice={currentPrice} color="#8b5cf6" />
          <BarChart label="Lynch Fair Value (PEG)" fairValue={lynch.fairValue} currentPrice={currentPrice} color="#f59e0b" />
        </div>
        <p className="text-[10px] text-muted mt-3">
          Die vertikale Linie markiert den aktuellen Kurs. Balken zeigen den berechneten Fair Value je Modell.
        </p>
      </div>

      {/* Model Details */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Modell-Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DCF */}
          <div className="bg-background rounded p-3">
            <div className="text-xs font-semibold text-accent mb-2">DCF</div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between"><span className="text-muted">Fair Value</span><span className="font-mono-num text-bright">{fmtEur(dcf.fairValue)}</span></div>
              {dcf.assumptions && (
                <>
                  <div className="flex justify-between"><span className="text-muted">Wachstumsrate</span><span className="font-mono-num text-sub">{(dcf.assumptions.growthRate * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted">Diskontierungsrate</span><span className="font-mono-num text-sub">{(dcf.assumptions.discountRate * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted">Terminal Growth</span><span className="font-mono-num text-sub">{(dcf.assumptions.terminalGrowth * 100).toFixed(1)}%</span></div>
                </>
              )}
            </div>
          </div>
          {/* Graham */}
          <div className="bg-background rounded p-3">
            <div className="text-xs font-semibold text-purple mb-2">Graham Number</div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between"><span className="text-muted">Fair Value</span><span className="font-mono-num text-bright">{fmtEur(graham.fairValue)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Formel</span><span className="text-sub">&radic;(22.5 x EPS x BVPS)</span></div>
            </div>
          </div>
          {/* Lynch */}
          <div className="bg-background rounded p-3">
            <div className="text-xs font-semibold text-gold mb-2">Lynch (PEG)</div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between"><span className="text-muted">Fair Value</span><span className="font-mono-num text-bright">{fmtEur(lynch.fairValue)}</span></div>
              <div className="flex justify-between"><span className="text-muted">PEG Ratio</span><span className="font-mono-num text-sub">{lynch.peg != null ? lynch.peg.toFixed(2) : "–"}</span></div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-muted text-center">
        Bewertungsmodelle sind vereinfachte Annäherungen. Sie ersetzen keine professionelle Finanzanalyse.
      </p>
    </div>
  );
}
