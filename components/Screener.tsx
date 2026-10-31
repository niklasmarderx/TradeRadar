"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Action } from "@/lib/types";
import { SparklineChart } from "@/components/charts";
import {
  getAllStrategies,
  saveStrategy,
  deleteStrategy,
  type ScreenerStrategy,
} from "@/lib/screener-strategies";

interface ScreenerProps {
  actions: Action[];
}

const SIGNAL_ORDER: Record<string, number> = { "STRONG BUY": 0, BUY: 1, SELL: 2, "STRONG SELL": 3, HOLD: 4 };
const CONFIDENCE_ORDER = { hoch: 0, mittel: 1, niedrig: 2 };

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "bg-up/20 text-up border-up/40",
  BUY: "bg-up/10 text-up border-up/30",
  SELL: "bg-down/10 text-down border-down/30",
  "STRONG SELL": "bg-down/20 text-down border-down/40",
  HOLD: "bg-muted/20 text-muted border-muted/40",
};

const STRATEGY_COLORS: Record<string, string> = {
  Momentum: "text-accent",
  "Mean Reversion": "text-purple",
  Catalyst: "text-gold",
  "Value Investing": "text-blue",
  "Relative Strength": "text-up",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-up", "A": "text-up", "A-": "text-up",
  "B+": "text-accent", "B": "text-accent", "B-": "text-accent",
  "C+": "text-gold", "C": "text-gold", "C-": "text-gold",
  "D+": "text-down", "D": "text-down", "F": "text-down",
};

function calcRR(a: Action): number {
  if (!a.entry_numeric || !a.target_numeric || !a.stop_numeric) return 0;
  const isShort = a.signal === "SELL" || a.signal === "STRONG SELL";
  if (isShort) {
    const risk = a.stop_numeric - a.entry_numeric;
    const reward = a.entry_numeric - a.target_numeric;
    return risk > 0 && reward > 0 ? reward / risk : 0;
  }
  const risk = a.entry_numeric - a.stop_numeric;
  const reward = a.target_numeric - a.entry_numeric;
  return risk > 0 && reward > 0 ? reward / risk : 0;
}

/** Extract quality score from reason string "... Qualität 75/100" */
function extractQuality(a: Action): number {
  const m = a.reason?.match(/Qualität (\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export default function Screener({ actions }: ScreenerProps) {
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [strategyFilter, setStrategyFilter] = useState("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"quality" | "rr" | "confidence" | "signal">("quality");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Strategy save/load
  const [savedStrategies, setSavedStrategies] = useState<ScreenerStrategy[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [strategyName, setStrategyName] = useState("");

  useEffect(() => {
    setSavedStrategies(getAllStrategies());
  }, []);

  function handleLoadStrategy(id: string) {
    const strat = savedStrategies.find((s) => s.id === id);
    if (!strat) return;
    setSignalFilter(strat.signal);
    setStrategyFilter(strat.strategy);
    setConfidenceFilter(strat.confidence);
    setSortBy(strat.sort as typeof sortBy);
  }

  function handleSaveStrategy() {
    if (!strategyName.trim()) return;
    saveStrategy({
      name: strategyName.trim(),
      signal: signalFilter,
      strategy: strategyFilter,
      confidence: confidenceFilter,
      sort: sortBy,
    });
    setSavedStrategies(getAllStrategies());
    setStrategyName("");
    setShowSaveDialog(false);
  }

  function handleDeleteStrategy(id: string) {
    deleteStrategy(id);
    setSavedStrategies(getAllStrategies());
  }

  const strategies = useMemo(
    () => [...new Set(actions.map((a) => a.strategy))],
    [actions]
  );

  const filtered = useMemo(() => {
    let result = [...actions];
    if (signalFilter !== "ALL") {
      const signals = signalFilter.split(",");
      result = result.filter((a) => signals.includes(a.signal));
    }
    if (strategyFilter !== "ALL") result = result.filter((a) => a.strategy === strategyFilter);
    if (confidenceFilter !== "ALL") result = result.filter((a) => a.confidence === confidenceFilter);

    result.sort((a, b) => {
      if (sortBy === "quality") return extractQuality(b) - extractQuality(a);
      if (sortBy === "rr") return calcRR(b) - calcRR(a);
      if (sortBy === "confidence") return (CONFIDENCE_ORDER[a.confidence] ?? 3) - (CONFIDENCE_ORDER[b.confidence] ?? 3);
      return (SIGNAL_ORDER[a.signal] ?? 4) - (SIGNAL_ORDER[b.signal] ?? 4);
    });

    return result;
  }, [actions, signalFilter, strategyFilter, confidenceFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-card-border rounded-lg px-4 py-3">
        {/* Signal */}
        <select
          value={signalFilter}
          onChange={(e) => setSignalFilter(e.target.value)}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent"
        >
          <option value="ALL">Alle Signale</option>
          <option value="STRONG BUY">STRONG BUY</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
          <option value="STRONG SELL">STRONG SELL</option>
          <option value="HOLD">HOLD</option>
        </select>

        {/* Strategy */}
        <select
          value={strategyFilter}
          onChange={(e) => setStrategyFilter(e.target.value)}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
        >
          <option value="ALL">Alle Strategien</option>
          {strategies.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Confidence */}
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value)}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
        >
          <option value="ALL">Alle Konfidenz</option>
          <option value="hoch">Hoch</option>
          <option value="mittel">Mittel</option>
          <option value="niedrig">Niedrig</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "quality" | "rr" | "confidence" | "signal")}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
        >
          <option value="quality">Nach Qualität</option>
          <option value="signal">Nach Signal</option>
          <option value="rr">Nach R/R Ratio</option>
          <option value="confidence">Nach Konfidenz</option>
        </select>

        {/* Strategy presets */}
        <div className="flex items-center gap-1.5">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleLoadStrategy(e.target.value);
              e.target.value = "";
            }}
            className="bg-background border border-accent/30 rounded px-2 py-1 text-xs text-accent focus:outline-none focus:border-accent"
          >
            <option value="">Strategie laden...</option>
            {savedStrategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.isBuiltIn ? "★ " : ""}{s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className="px-2 py-1 text-[10px] text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors"
            title="Aktuelle Filter als Strategie speichern"
          >
            Speichern
          </button>
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1 rounded ${viewMode === "grid" ? "text-accent" : "text-muted"}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1 rounded ${viewMode === "list" ? "text-accent" : "text-muted"}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="2" width="14" height="2" rx="0.5" />
              <rect x="1" y="7" width="14" height="2" rx="0.5" />
              <rect x="1" y="12" width="14" height="2" rx="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Save strategy dialog */}
      {showSaveDialog && (
        <div className="flex flex-wrap items-center gap-2 bg-card border border-accent/20 rounded-lg px-4 py-3">
          <input
            placeholder="Name der Strategie..."
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveStrategy()}
            className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent flex-1 min-w-[150px]"
            autoFocus
          />
          <button
            onClick={handleSaveStrategy}
            disabled={!strategyName.trim()}
            className="px-3 py-1 text-xs text-up border border-up/30 rounded hover:bg-up/10 transition-colors disabled:opacity-30"
          >
            OK
          </button>
          <button
            onClick={() => { setShowSaveDialog(false); setStrategyName(""); }}
            className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            Abbrechen
          </button>
          {/* Manage saved strategies */}
          {savedStrategies.filter((s) => !s.isBuiltIn).length > 0 && (
            <div className="w-full flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-card-border/50">
              <span className="text-[10px] text-muted">Gespeichert:</span>
              {savedStrategies.filter((s) => !s.isBuiltIn).map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-background border border-card-border rounded">
                  <span className="text-foreground">{s.name}</span>
                  <button
                    onClick={() => handleDeleteStrategy(s.id)}
                    className="text-muted hover:text-down transition-colors ml-1"
                    title="Löschen"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted">
        {filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}
      </p>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <Link
              key={a.ticker}
              href={`/stock/${a.ticker}`}
              className="bg-card border border-card-border rounded-lg p-4 card-interactive block"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-sm font-bold text-bright">{a.ticker}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[a.signal]}`}>
                    {a.signal}
                  </span>
                </div>
                <span className="font-mono-num text-sm text-bright">{a.price}</span>
              </div>
              <p className="text-[10px] text-sub mb-2">{a.name}</p>
              <div className="flex items-center gap-4 mb-2">
                <span className={`text-[10px] ${STRATEGY_COLORS[a.strategy] ?? "text-muted"}`}>{a.strategy}</span>
                <span className="text-[10px] text-muted">{a.timeframe}</span>
                {a.grade && (
                  <span className={`text-[10px] font-bold ${GRADE_COLORS[a.grade] ?? "text-muted"}`}>{a.grade}</span>
                )}
                {a.valuation && (
                  <span className={`text-[10px] font-semibold ${
                    a.valuation.verdict === "Unterbewertet" ? "text-up" :
                    a.valuation.verdict === "Überbewertet" ? "text-down" : "text-muted"
                  }`}>{a.valuation.verdict === "Unterbewertet" ? "↑Unterbew." : a.valuation.verdict === "Überbewertet" ? "↓Überbew." : "Fair"}</span>
                )}
                {extractQuality(a) > 0 && (
                  <span className="text-[10px] font-mono-num text-muted">Q:{extractQuality(a)}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-[10px]">
                  <span className="text-accent">E: {a.entry}</span>
                  <span className="text-up">T: {a.target}</span>
                  <span className="text-down">SL: {a.stop}</span>
                </div>
                {a.sparkline && <SparklineChart data={a.sparkline} width={80} height={24} />}
              </div>
              {calcRR(a) > 0 && (
                <div className="mt-2 text-[10px] font-mono-num text-muted">
                  R/R: 1:{calcRR(a).toFixed(1)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left px-3 py-2">Ticker</th>
                <th className="text-left px-3 py-2">Signal</th>
                <th className="text-center px-3 py-2 hidden sm:table-cell">Grade</th>
                <th className="text-right px-3 py-2">Kurs</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">Entry</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">Target</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">Stop</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">R/R</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Strategie</th>
                <th className="text-center px-3 py-2 hidden lg:table-cell">Bewertung</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.ticker} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/stock/${a.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                      {a.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[a.signal]}`}>
                      {a.signal}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">
                    <span className={`font-bold text-[10px] ${GRADE_COLORS[a.grade ?? ""] ?? "text-muted"}`}>
                      {a.grade ?? "–"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-num text-bright">{a.price}</td>
                  <td className="px-3 py-2 text-right font-mono-num text-accent hidden sm:table-cell">{a.entry}</td>
                  <td className="px-3 py-2 text-right font-mono-num text-up hidden sm:table-cell">{a.target}</td>
                  <td className="px-3 py-2 text-right font-mono-num text-down hidden md:table-cell">{a.stop}</td>
                  <td className="px-3 py-2 text-right font-mono-num text-muted hidden md:table-cell">
                    {calcRR(a) > 0 ? `1:${calcRR(a).toFixed(1)}` : "–"}
                  </td>
                  <td className={`px-3 py-2 hidden lg:table-cell ${STRATEGY_COLORS[a.strategy] ?? "text-muted"}`}>
                    {a.strategy}
                  </td>
                  <td className="px-3 py-2 text-center hidden lg:table-cell">
                    {a.valuation ? (
                      <span className={`text-[10px] font-semibold ${
                        a.valuation.verdict === "Unterbewertet" ? "text-up" :
                        a.valuation.verdict === "Überbewertet" ? "text-down" : "text-muted"
                      }`}>
                        {a.valuation.verdict === "Unterbewertet" ? "↑Unterbew." : a.valuation.verdict === "Überbewertet" ? "↓Überbew." : "Fair"}
                      </span>
                    ) : <span className="text-muted">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">
          Keine Aktien gefunden mit diesen Filtern.
        </div>
      )}
    </div>
  );
}
