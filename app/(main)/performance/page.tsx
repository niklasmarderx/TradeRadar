"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PerformanceData, ClosedPick, ActivePickSnapshot } from "@/app/api/performance/route";

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function PctBadge({ value }: { value: number }) {
  const color = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted";
  return (
    <span className={`font-mono-num ${color}`}>
      {value > 0 ? "+" : ""}{fmt(value)}%
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-4 text-center">
      <span className="text-[10px] text-muted uppercase tracking-wider block mb-1">{label}</span>
      <span className="font-mono-num text-lg text-bright block">{value}</span>
      {sub && <span className="text-[10px] text-sub">{sub}</span>}
    </div>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "winners" | "losers">("all");

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then((d) => { setData(d as PerformanceData); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-bright">KI-Scanner Performance</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 text-center">
        <p className="text-sm text-down">{error ?? "Fehler beim Laden"}</p>
      </div>
    );
  }

  const { stats, activePicks, closedPicks } = data;

  const filtered = closedPicks.filter((p) => {
    if (filter === "winners") return p.finalPerformance > 0;
    if (filter === "losers") return p.finalPerformance <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-bright">KI-Scanner Performance</h1>
        <span className="text-[10px] text-muted">
          Stand: {new Date(data.generatedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Win-Rate"
          value={`${fmt(stats.winRate, 1)}%`}
          sub={`${stats.winners}W / ${stats.losers}L`}
        />
        <StatCard
          label="Ø Gewinn"
          value={stats.avgGain > 0 ? `+${fmt(stats.avgGain)}%` : "–"}
          sub="bei Gewinnern"
        />
        <StatCard
          label="Ø Verlust"
          value={stats.avgLoss < 0 ? `${fmt(stats.avgLoss)}%` : "–"}
          sub="bei Verlierern"
        />
        <StatCard
          label="Ø Haltedauer"
          value={`${fmt(stats.avgHoldDays, 1)} T`}
          sub={`${stats.totalClosed} abgeschlossene Picks`}
        />
      </div>

      {/* Best / Worst */}
      {(stats.bestPick ?? stats.worstPick) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.bestPick && (
            <div className="bg-up/5 border border-up/20 rounded-lg p-4">
              <span className="text-[10px] text-up uppercase tracking-wider block mb-1">Bester Pick</span>
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/stock/${stats.bestPick.ticker}`} className="font-mono-num font-bold text-up hover:underline">
                    {stats.bestPick.ticker}
                  </Link>
                  <span className="text-[10px] text-sub block">{stats.bestPick.name}</span>
                </div>
                <span className="font-mono-num text-xl text-up">+{fmt(stats.bestPick.finalPerformance)}%</span>
              </div>
              <span className="text-[10px] text-muted">{stats.bestPick.addedDate} · {stats.bestPick.daysOnList}T gehalten</span>
            </div>
          )}
          {stats.worstPick && (
            <div className="bg-down/5 border border-down/20 rounded-lg p-4">
              <span className="text-[10px] text-down uppercase tracking-wider block mb-1">Schlechtester Pick</span>
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/stock/${stats.worstPick.ticker}`} className="font-mono-num font-bold text-down hover:underline">
                    {stats.worstPick.ticker}
                  </Link>
                  <span className="text-[10px] text-sub block">{stats.worstPick.name}</span>
                </div>
                <span className="font-mono-num text-xl text-down">{fmt(stats.worstPick.finalPerformance)}%</span>
              </div>
              <span className="text-[10px] text-muted">{stats.worstPick.addedDate} · {stats.worstPick.daysOnList}T gehalten</span>
            </div>
          )}
        </div>
      )}

      {/* Active Picks */}
      {activePicks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-bright mb-3">Aktuelle Scanner-Picks ({activePicks.length})</h2>
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Ticker</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Sektor</th>
                  <th className="text-right px-4 py-2">Kaufkurs</th>
                  <th className="text-right px-4 py-2">Aktuell</th>
                  <th className="text-right px-4 py-2">Perf.</th>
                  <th className="text-right px-4 py-2">Tage</th>
                  <th className="text-right px-4 py-2 hidden md:table-cell">Grade</th>
                </tr>
              </thead>
              <tbody>
                {activePicks.map((p: ActivePickSnapshot) => (
                  <tr key={p.ticker} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/stock/${p.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                        {p.ticker}
                      </Link>
                      <span className="block text-[10px] text-sub">{p.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sub hidden md:table-cell">{p.sector ?? "–"}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted">{fmt(p.addedPrice)} €</td>
                    <td className="px-4 py-3 text-right font-mono-num">{fmt(p.currentPrice)} €</td>
                    <td className="px-4 py-3 text-right"><PctBadge value={p.performancePercent} /></td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted">{p.daysOnList}T</td>
                    <td className="px-4 py-3 text-right font-mono-num hidden md:table-cell">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        (p.grade ?? "").startsWith("A") ? "bg-up/15 text-up" :
                        (p.grade ?? "").startsWith("B") ? "bg-accent/15 text-accent" :
                        "bg-muted/10 text-muted"
                      }`}>{p.grade ?? "–"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Closed Picks History */}
      {closedPicks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-bright">Abgeschlossene Picks ({closedPicks.length})</h2>
            <div className="flex gap-1">
              {(["all", "winners", "losers"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    filter === f
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Alle" : f === "winners" ? "Gewinner" : "Verlierer"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Ticker</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Signal</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Sektor</th>
                  <th className="text-right px-4 py-2">Kaufkurs</th>
                  <th className="text-right px-4 py-2">Perf.</th>
                  <th className="text-right px-4 py-2">Tage</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Entfernt</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Grund</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: ClosedPick, i: number) => (
                  <tr key={`${p.ticker}-${i}`} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/stock/${p.ticker}`} className="font-mono-num font-bold text-foreground hover:text-accent transition-colors">
                        {p.ticker}
                      </Link>
                      <span className="block text-[10px] text-sub">{p.name}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.signal.includes("BUY") ? "bg-up/10 text-up" : "bg-down/10 text-down"
                      }`}>{p.signal}</span>
                    </td>
                    <td className="px-4 py-3 text-sub hidden lg:table-cell">{p.sector ?? "–"}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted">
                      {p.addedPrice > 0 ? `${fmt(p.addedPrice)} €` : "–"}
                    </td>
                    <td className="px-4 py-3 text-right"><PctBadge value={p.finalPerformance} /></td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted">{p.daysOnList}T</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{p.removedDate}</td>
                    <td className="px-4 py-3 text-[10px] text-sub hidden lg:table-cell max-w-[180px] truncate" title={p.reason}>
                      {p.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {closedPicks.length === 0 && activePicks.length === 0 && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted">
            Noch keine Daten. Der Scanner muss mindestens einmal gelaufen sein.
          </p>
          <p className="text-[10px] text-sub mt-1">
            Starte einen Scan auf der <Link href="/" className="text-accent hover:underline">Startseite</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
