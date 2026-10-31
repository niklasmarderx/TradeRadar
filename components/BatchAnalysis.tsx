"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWatchlist } from "@/lib/watchlist";
import type { AIAnalysisResponse } from "@/lib/types";

interface BatchResult {
  ticker: string;
  status: "researching" | "analyzing" | "done" | "error";
  result?: AIAnalysisResponse;
  error?: string;
}

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "bg-up/20 text-up border-up/40",
  BUY: "bg-up/10 text-up border-up/30",
  SELL: "bg-down/20 text-down border-down/40",
  HOLD: "bg-muted/20 text-muted border-muted/40",
};

export default function BatchAnalysis() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Map<string, BatchResult>>(new Map());
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const watchlist = getWatchlist();
    setTickers(watchlist.map((w) => w.ticker));
  }, []);

  async function runBatch() {
    setRunning(true);
    setResults(new Map());
    setProgress(0);

    try {
      const res = await fetch("/api/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
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
            if (parsed.ticker && parsed.status) {
              setResults((prev) => {
                const next = new Map(prev);
                next.set(parsed.ticker, {
                  ticker: parsed.ticker,
                  status: parsed.status,
                  result: parsed.result,
                  error: parsed.error,
                });
                return next;
              });
            }
            if (typeof parsed.progress === "number") {
              setProgress(parsed.progress);
            }
          } catch {
            // Skip non-JSON
          }
        }
      }
    } catch (err) {
      console.error("Batch analysis error:", err);
    } finally {
      setRunning(false);
      setProgress(1);
    }
  }

  const doneResults = [...results.values()].filter((r) => r.status === "done" && r.result);
  const errorResults = [...results.values()].filter((r) => r.status === "error");
  const currentTicker = [...results.values()].find(
    (r) => r.status === "researching" || r.status === "analyzing"
  );

  if (tickers.length === 0) return null;

  return (
    <section className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <h2 className="text-xs font-semibold text-sub uppercase tracking-widest section-header">
          Batch-Analyse
        </h2>
        <button
          onClick={runBatch}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold rounded transition-colors disabled:opacity-50 bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20"
        >
          {running ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Laeuft... ({Math.round(progress * 100)}%)
            </>
          ) : doneResults.length > 0 ? (
            "Erneut analysieren"
          ) : (
            <>Alle {tickers.length} Aktien analysieren</>
          )}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="px-4 py-2 space-y-1.5">
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {currentTicker && (
            <p className="text-[10px] text-muted">
              {currentTicker.status === "researching"
                ? `Web-Recherche fuer ${currentTicker.ticker}...`
                : `KI-Analyse fuer ${currentTicker.ticker}...`}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {doneResults.length > 0 && (
        <div className="divide-y divide-card-border">
          {doneResults.map((r) => {
            const res = r.result!;
            const isExpanded = expanded === r.ticker;
            return (
              <div key={r.ticker} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/stock/${r.ticker}`}
                      className="font-mono-num text-sm font-bold text-accent hover:underline"
                    >
                      {r.ticker}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[res.recommendation] ?? ""}`}>
                      {res.recommendation}
                    </span>
                    <span className="text-[10px] text-muted capitalize">{res.confidence}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-[10px] font-mono-num">
                      <span className="text-accent">E: {res.entry?.toFixed(2)}</span>
                      <span className="text-up">T: {res.target?.toFixed(2)}</span>
                      <span className="text-down">SL: {res.stopLoss?.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : r.ticker)}
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                {!isExpanded && (
                  <p className="text-[10px] text-sub mt-1 line-clamp-1">{res.summary}</p>
                )}
                {isExpanded && (
                  <div className="mt-2 space-y-2 text-xs">
                    <p className="text-sub leading-relaxed">{res.summary}</p>
                    <p className="text-sub leading-relaxed">{res.reasoning}</p>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-muted">R/R: <span className="font-mono-num text-accent">{res.riskReward}</span></span>
                      <span className="text-muted">Zeitrahmen: <span className="text-foreground">{res.timeframe}</span></span>
                      <span className="text-muted">Methodik: <span className="text-foreground">{res.methodology}</span></span>
                    </div>
                    {res.risks && res.risks.length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-muted">Risiken: </span>
                        <span className="text-sub">{res.risks.join(" | ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Errors */}
      {errorResults.length > 0 && (
        <div className="px-4 py-2 space-y-1">
          {errorResults.map((r) => (
            <p key={r.ticker} className="text-[10px] text-down">
              {r.ticker}: {r.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
