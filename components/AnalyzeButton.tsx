"use client";

import { useState } from "react";
import type { AIAnalysisResponse } from "@/lib/types";

interface AnalyzeButtonProps {
  ticker: string;
  compact?: boolean;
}

export default function AnalyzeButton({ ticker, compact = false }: AnalyzeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleAnalyze(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Kein Stream");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) fullText += parsed.text;
            if (parsed.error) throw new Error(parsed.error);
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setResult(JSON.parse(jsonMatch[0]) as AIAnalysisResponse);
      } else {
        throw new Error("Konnte Analyse nicht parsen");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  const SIGNAL_COLORS: Record<string, string> = {
    "STRONG BUY": "bg-up/20 text-up border-up/40",
    BUY: "bg-up/10 text-up border-up/30",
    SELL: "bg-down/20 text-down border-down/40",
    HOLD: "bg-muted/20 text-muted border-muted/40",
  };

  if (result && !expanded) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[result.recommendation] ?? ""}`}
        title={result.summary}
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {result.recommendation}
      </button>
    );
  }

  if (result && expanded) {
    return (
      <div
        className="bg-card border border-card-border rounded-lg p-3 mt-2 text-xs space-y-2"
        onClick={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${SIGNAL_COLORS[result.recommendation] ?? ""}`}>
            {result.recommendation}
          </span>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(false); }} className="text-muted hover:text-foreground">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sub leading-relaxed">{result.summary}</p>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div><span className="text-muted">Entry: </span><span className="font-mono-num text-accent">{result.entry?.toFixed(2)}</span></div>
          <div><span className="text-muted">Target: </span><span className="font-mono-num text-up">{result.target?.toFixed(2)}</span></div>
          <div><span className="text-muted">Stop: </span><span className="font-mono-num text-down">{result.stopLoss?.toFixed(2)}</span></div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
        title="KI-Analyse starten"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analysiere...
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            KI-Analyse
          </>
        )}
      </button>
      {error && <p className="text-[10px] text-down mt-1">{error}</p>}
    </div>
  );
}
