"use client";

import { useState, useCallback, useRef } from "react";
import type { AIAnalysisResponse, ResearchResult } from "@/lib/types";

interface AIAnalysisProps {
  ticker: string;
}

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "bg-up/20 text-up border-up/40",
  BUY: "bg-up/10 text-up border-up/30",
  SELL: "bg-down/20 text-down border-down/40",
  HOLD: "bg-muted/20 text-muted border-muted/40",
};

const CONFIDENCE_DOTS: Record<string, number> = {
  hoch: 3,
  mittel: 2,
  niedrig: 1,
};

type AnalysisPhase = "idle" | "researching" | "analyzing" | "done" | "error";

export default function AIAnalysis({ ticker }: AIAnalysisProps) {
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loading = phase === "researching" || phase === "analyzing";

  const startAnalysis = useCallback(async () => {
    setPhase("researching");
    setStreamText("");
    setResult(null);
    setResearch(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Fehler ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream nicht verfuegbar");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          if (payload === "[DONE]") {
            try {
              const jsonMatch = fullText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                setResult(JSON.parse(jsonMatch[0]) as AIAnalysisResponse);
              }
            } catch {
              // Keep stream text as fallback
            }
            setPhase("done");
            break;
          }

          try {
            const parsed = JSON.parse(payload);

            // Research data comes as a separate event
            if (parsed.research) {
              setResearch(parsed.research as ResearchResult);
              setPhase("analyzing");
              continue;
            }

            if (parsed.error) {
              setError(parsed.error);
              setPhase("error");
              break;
            }

            if (parsed.text) {
              if (phase !== "analyzing") setPhase("analyzing");
              fullText += parsed.text;
              setStreamText(fullText);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
        setPhase("error");
      } else {
        setPhase("idle");
      }
    } finally {
      abortRef.current = null;
    }
  }, [ticker, phase]);

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <h3 className="section-header text-xs font-semibold uppercase tracking-widest text-sub">
          KI-Analyse
        </h3>
        <button
          onClick={loading ? () => abortRef.current?.abort() : startAnalysis}
          disabled={false}
          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
            loading
              ? "bg-down/20 text-down border border-down/40 hover:bg-down/30"
              : "bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30"
          }`}
        >
          {loading ? "Abbrechen" : result ? "Erneut analysieren" : "KI-Analyse starten"}
        </button>
      </div>

      {/* Loading / Streaming */}
      {loading && (
        <div className="p-4">
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] text-accent uppercase tracking-wider">
              {phase === "researching" ? "Web-Recherche via Sonar-Pro..." : "KI-Analyse laeuft..."}
            </span>
          </div>

          {streamText ? (
            <pre className="text-xs text-sub whitespace-pre-wrap font-mono-num leading-relaxed">
              {streamText}
              <span className="animate-pulse">|</span>
            </pre>
          ) : (
            <div className="space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4">
          <div className="bg-down/10 border border-down/30 rounded p-3">
            <p className="text-xs text-down">{error}</p>
            <button
              onClick={startAnalysis}
              className="mt-2 text-[10px] text-accent underline"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="p-4 space-y-4">
          {/* Signal + Confidence */}
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 text-sm font-bold rounded border ${SIGNAL_COLORS[result.recommendation] ?? ""}`}
            >
              {result.recommendation}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < (CONFIDENCE_DOTS[result.confidence] ?? 0)
                      ? "bg-accent"
                      : "bg-card-border"
                  }`}
                />
              ))}
              <span className="text-[10px] text-muted ml-1">{result.confidence}</span>
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-foreground leading-relaxed">
            {result.summary}
          </p>

          {/* Entry / Target / Stop */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-background rounded p-2 text-center">
              <span className="text-[9px] text-muted uppercase tracking-wider block">Entry</span>
              <span className="font-mono-num text-sm text-accent">{result.entry.toFixed(2)} &euro;</span>
            </div>
            <div className="bg-background rounded p-2 text-center">
              <span className="text-[9px] text-muted uppercase tracking-wider block">Target</span>
              <span className="font-mono-num text-sm text-up">{result.target.toFixed(2)} &euro;</span>
            </div>
            <div className="bg-background rounded p-2 text-center">
              <span className="text-[9px] text-muted uppercase tracking-wider block">Stop-Loss</span>
              <span className="font-mono-num text-sm text-down">{result.stopLoss.toFixed(2)} &euro;</span>
            </div>
            <div className="bg-background rounded p-2 text-center">
              <span className="text-[9px] text-muted uppercase tracking-wider block">R/R</span>
              <span className="font-mono-num text-sm text-bright">{result.riskReward}</span>
            </div>
          </div>

          {/* Timeframe */}
          <div className="flex gap-4 text-xs">
            <span className="text-muted">Zeitrahmen:</span>
            <span className="text-foreground">{result.timeframe}</span>
            <span className="text-muted">Methodik:</span>
            <span className="text-foreground">{result.methodology}</span>
          </div>

          {/* Scenario Probabilities */}
          {result.scenarioProbabilities && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Szenarien (Wahrscheinlichkeit)</span>
              <div className="space-y-1.5">
                {(["bull", "base", "bear"] as const).map((key) => {
                  const pct = result.scenarioProbabilities![key];
                  const color = key === "bull" ? "bg-up" : key === "bear" ? "bg-down" : "bg-accent";
                  const label = key === "bull" ? "Bull" : key === "bear" ? "Bear" : "Base";
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-8 shrink-0">{label}</span>
                      <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono-num text-xs text-foreground w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              {result.scenarioProbabilities.rationale && (
                <p className="text-[10px] text-muted mt-1.5 leading-relaxed">{result.scenarioProbabilities.rationale}</p>
              )}
            </div>
          )}

          {/* Price Targets Timeline */}
          {result.priceTargets && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Preis-Zeitreihe (KI-Schätzung)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background rounded p-2 text-center">
                  <span className="text-[9px] text-muted uppercase tracking-wider block">1 Woche</span>
                  <span className="font-mono-num text-sm text-bright">{result.priceTargets.week1.toFixed(2)} &euro;</span>
                </div>
                <div className="bg-background rounded p-2 text-center">
                  <span className="text-[9px] text-muted uppercase tracking-wider block">1 Monat</span>
                  <span className="font-mono-num text-sm text-bright">{result.priceTargets.month1.toFixed(2)} &euro;</span>
                </div>
                <div className="bg-background rounded p-2 text-center">
                  <span className="text-[9px] text-muted uppercase tracking-wider block">3 Monate</span>
                  <span className="font-mono-num text-sm text-bright">{result.priceTargets.month3.toFixed(2)} &euro;</span>
                </div>
              </div>
              {result.priceTargets.rationale && (
                <p className="text-[10px] text-muted mt-1.5 leading-relaxed">{result.priceTargets.rationale}</p>
              )}
            </div>
          )}

          {/* Reasoning */}
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider block mb-1">Begruendung</span>
            <p className="text-xs text-sub leading-relaxed">{result.reasoning}</p>
          </div>

          {/* Risks */}
          {result.risks.length > 0 && (
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-1">Risiken</span>
              <ul className="space-y-0.5">
                {result.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-sub flex gap-2">
                    <span className="text-down">&#8226;</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bull/Bear Thesis */}
          {result.thesis && (
            <details className="border-t border-card-border pt-3" open>
              <summary className="text-[10px] text-muted uppercase tracking-wider cursor-pointer hover:text-foreground">
                Investment Thesis
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="bg-up/5 border border-up/20 rounded-lg p-3">
                  <span className="text-[9px] text-up uppercase tracking-wider font-semibold block mb-1">Bull Case</span>
                  <p className="text-xs text-sub leading-relaxed">{result.thesis.bullCase}</p>
                </div>
                <div className="bg-down/5 border border-down/20 rounded-lg p-3">
                  <span className="text-[9px] text-down uppercase tracking-wider font-semibold block mb-1">Bear Case</span>
                  <p className="text-xs text-sub leading-relaxed">{result.thesis.bearCase}</p>
                </div>
              </div>
            </details>
          )}

          {/* SWOT Analysis */}
          {result.swot && (
            <details className="border-t border-card-border pt-3">
              <summary className="text-[10px] text-muted uppercase tracking-wider cursor-pointer hover:text-foreground">
                SWOT-Analyse
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-up/5 border border-up/20 rounded p-2">
                  <span className="text-[9px] text-up uppercase font-semibold block mb-1">Stärken</span>
                  <ul className="space-y-0.5">
                    {result.swot.strengths.map((s, i) => <li key={i} className="text-[11px] text-sub">• {s}</li>)}
                  </ul>
                </div>
                <div className="bg-down/5 border border-down/20 rounded p-2">
                  <span className="text-[9px] text-down uppercase font-semibold block mb-1">Schwächen</span>
                  <ul className="space-y-0.5">
                    {result.swot.weaknesses.map((w, i) => <li key={i} className="text-[11px] text-sub">• {w}</li>)}
                  </ul>
                </div>
                <div className="bg-info/5 border border-info/20 rounded p-2">
                  <span className="text-[9px] text-info uppercase font-semibold block mb-1">Chancen</span>
                  <ul className="space-y-0.5">
                    {result.swot.opportunities.map((o, i) => <li key={i} className="text-[11px] text-sub">• {o}</li>)}
                  </ul>
                </div>
                <div className="bg-warning/5 border border-warning/20 rounded p-2">
                  <span className="text-[9px] text-warning uppercase font-semibold block mb-1">Bedrohungen</span>
                  <ul className="space-y-0.5">
                    {result.swot.threats.map((t, i) => <li key={i} className="text-[11px] text-sub">• {t}</li>)}
                  </ul>
                </div>
              </div>
            </details>
          )}

          {/* Competitive Moat */}
          {result.moat && (
            <details className="border-t border-card-border pt-3">
              <summary className="text-[10px] text-muted uppercase tracking-wider cursor-pointer hover:text-foreground">
                Wettbewerbsvorteil (Moat)
              </summary>
              <div className="mt-2 flex items-start gap-3">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border shrink-0 ${
                  result.moat.type === "wide" ? "bg-up/15 text-up border-up/30" :
                  result.moat.type === "narrow" ? "bg-accent/15 text-accent border-accent/30" :
                  "bg-down/15 text-down border-down/30"
                }`}>
                  {result.moat.type === "wide" ? "Wide Moat" : result.moat.type === "narrow" ? "Narrow Moat" : "Kein Moat"}
                </span>
                <div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {result.moat.sources.map((s, i) => (
                      <span key={i} className="text-[9px] bg-background px-1.5 py-0.5 rounded text-muted">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-sub leading-relaxed">{result.moat.explanation}</p>
                </div>
              </div>
            </details>
          )}

          {/* Contrarian View */}
          {result.contrarian && (
            <details className="border-t border-card-border pt-3">
              <summary className="text-[10px] text-muted uppercase tracking-wider cursor-pointer hover:text-foreground">
                Contrarian-Perspektive
              </summary>
              <div className="mt-2 bg-[#2a1f3d] border border-[#6b46c1]/30 rounded-lg p-3">
                <p className="text-xs text-sub leading-relaxed mb-2">{result.contrarian.argument}</p>
                <ul className="space-y-0.5">
                  {result.contrarian.counterPoints.map((cp, i) => (
                    <li key={i} className="text-[11px] text-sub flex gap-2">
                      <span className="text-[#a78bfa]">&#9654;</span>
                      {cp}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          {/* Fact Audit */}
          {result.factAudit && result.factAudit.claims.length > 0 && (
            <details className="border-t border-card-border pt-3">
              <summary className="text-[10px] text-muted uppercase tracking-wider cursor-pointer hover:text-foreground">
                Fact Audit ({result.factAudit.claims.filter(c => c.status === "grounded").length}/{result.factAudit.claims.length} belegt)
              </summary>
              <div className="mt-2 space-y-1.5">
                {result.factAudit.claims.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      c.status === "grounded" ? "bg-up" :
                      c.status === "speculative" ? "bg-warning" : "bg-muted"
                    }`} />
                    <span className="text-sub">{c.claim}</span>
                    <span className={`text-[9px] ml-auto shrink-0 ${
                      c.status === "grounded" ? "text-up" :
                      c.status === "speculative" ? "text-warning" : "text-muted"
                    }`}>
                      {c.status === "grounded" ? "Belegt" : c.status === "speculative" ? "Spekulativ" : "Unprüfbar"}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Research Sources */}
          {research && research.news.length > 0 && (
            <div className="border-t border-card-border pt-3">
              <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">
                Quellen ({new Date(research.searchedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })})
              </span>
              <ul className="space-y-1.5">
                {research.news.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`text-[9px] px-1 py-0.5 rounded mt-0.5 shrink-0 ${
                      item.impact === "bullish" ? "bg-up/15 text-up" :
                      item.impact === "bearish" ? "bg-down/15 text-down" :
                      "bg-muted/15 text-muted"
                    }`}>
                      {item.impact === "bullish" ? "BULL" : item.impact === "bearish" ? "BEAR" : "NTRL"}
                    </span>
                    <div className="min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline line-clamp-1"
                      >
                        {item.headline}
                      </a>
                      <span className="text-[9px] text-muted block">
                        {item.source} &middot; {item.date}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Analyst Consensus */}
              {research.analystConsensus && (
                <div className="mt-3 flex items-center gap-3 bg-background rounded px-3 py-2">
                  <span className="text-[9px] text-muted uppercase">Analysten</span>
                  <span className="text-xs font-semibold text-bright">
                    {research.analystConsensus.rating}
                  </span>
                  {research.analystConsensus.targetPrice && (
                    <span className="text-xs font-mono-num text-accent">
                      Ziel: {research.analystConsensus.targetPrice.toFixed(2)}
                    </span>
                  )}
                  <span className="text-[9px] text-muted">
                    ({research.analystConsensus.numberOfAnalysts} Analysten:
                    {" "}{research.analystConsensus.buyCount} Buy,
                    {" "}{research.analystConsensus.holdCount} Hold,
                    {" "}{research.analystConsensus.sellCount} Sell)
                  </span>
                </div>
              )}

              {/* Market Sentiment */}
              {research.marketSentiment && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="bg-background rounded px-2 py-1.5">
                    <span className="text-[8px] text-muted uppercase block">VIX</span>
                    <span className="text-[10px] text-bright">{research.marketSentiment.vixLevel}</span>
                  </div>
                  <div className="bg-background rounded px-2 py-1.5">
                    <span className="text-[8px] text-muted uppercase block">Fear/Greed</span>
                    <span className="text-[10px] text-bright">{research.marketSentiment.fearGreed}</span>
                  </div>
                  <div className="bg-background rounded px-2 py-1.5">
                    <span className="text-[8px] text-muted uppercase block">Markt</span>
                    <span className="text-[10px] text-bright">{research.marketSentiment.marketTrend}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="p-4 text-center">
          <p className="text-xs text-muted">
            Klicke auf &ldquo;KI-Analyse starten&rdquo; fuer eine wissenschaftlich fundierte Handelsempfehlung.
          </p>
        </div>
      )}
    </div>
  );
}
