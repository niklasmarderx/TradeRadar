"use client";

import { useState, useEffect } from "react";
import type { InvestmentScore } from "@/lib/investment-score";

interface Props {
  ticker: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-up/15 text-up", "A": "bg-up/15 text-up", "A-": "bg-up/15 text-up",
  "B+": "bg-accent/15 text-accent", "B": "bg-accent/15 text-accent", "B-": "bg-accent/15 text-accent",
  "C+": "bg-gold/15 text-gold", "C": "bg-gold/15 text-gold", "C-": "bg-gold/15 text-gold",
  "D+": "bg-down/15 text-down", "D": "bg-down/15 text-down", "F": "bg-down/15 text-down",
};

const DIM_LABELS: Record<string, { label: string; color: string }> = {
  fundamentals: { label: "Fundamentals", color: "bg-accent" },
  technicals: { label: "Technicals", color: "bg-purple" },
  sentiment: { label: "Sentiment", color: "bg-gold" },
  risk: { label: "Risiko (↑ = sicherer)", color: "bg-up" },
  value: { label: "Bewertung", color: "bg-info" },
};

export default function InvestmentScorePanel({ ticker }: Props) {
  const [data, setData] = useState<InvestmentScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}/score`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-card-border/50 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-card-border/50 rounded w-1/4 mb-2" />
            <div className="h-3 bg-card-border/30 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-card border border-card-border rounded-lg p-4">
      {/* Score Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-card-border/30" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke="currentColor"
              className={data.overall >= 70 ? "text-up" : data.overall >= 50 ? "text-accent" : data.overall >= 30 ? "text-gold" : "text-down"}
              strokeWidth="4"
              strokeDasharray={`${(data.overall / 100) * 175.9} 175.9`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-lg font-bold font-mono-num text-bright">{data.overall}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-bright uppercase tracking-wider">Investment Score</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${GRADE_COLORS[data.grade] ?? "bg-muted/15 text-muted"}`}>
              {data.grade}
            </span>
          </div>
          <p className="text-xs text-sub mt-1">{data.verdict}</p>
        </div>
      </div>

      {/* Dimension Bars */}
      <div className="space-y-2">
        {(Object.entries(data.dimensions) as [string, { score: number; maxScore: number; detail: string }][]).map(([key, dim]) => {
          const config = DIM_LABELS[key];
          if (!config) return null;
          const pct = (dim.score / dim.maxScore) * 100;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-sub">{config.label}</span>
                <span className="font-mono-num text-muted">{dim.score}/{dim.maxScore}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-card-border/30 rounded">
                  <div className={`h-full rounded ${config.color}`} style={{ width: `${pct}%` }} />
                </div>
                {dim.detail && dim.detail !== "Neutral" && (
                  <span className="text-[9px] text-muted shrink-0 max-w-[120px] truncate">{dim.detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
