"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface ScanResultSnapshot {
  ticker: string;
  name: string;
  price: number;
  signal: string;
  score: number;
  confidence: string;
  convergence: number;
  entry: number;
  target: number;
  stop: number;
  kellySize: number;
  breakdown: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  };
  scannedAt: string;
}

interface Snapshot {
  date: string;
  results: ScanResultSnapshot[];
  scannedAt: string;
}

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SIGNAL_COLOR: Record<string, string> = {
  "STRONG BUY": "text-up bg-up/10 border-up/30",
  "BUY": "text-up bg-up/5 border-up/20",
  "HOLD": "text-gold bg-gold/5 border-gold/20",
  "SELL": "text-down bg-down/5 border-down/20",
  "STRONG SELL": "text-down bg-down/10 border-down/30",
};

const SIGNAL_LABEL: Record<string, string> = {
  "STRONG BUY": "STRONG BUY",
  "BUY": "BUY",
  "HOLD": "HOLD",
  "SELL": "SHORT",
  "STRONG SELL": "STRONG SHORT",
};

/* ── Archive Stats Calculation ── */

interface TickerTrack {
  ticker: string;
  name: string;
  signal: string;
  signalDate: string;
  signalPrice: number;
  entry: number;
  target: number;
  stop: number;
  livePrice: number | null;
  pnl: number | null;
  pnlPct: number | null;
  hitTarget: boolean;
  hitStop: boolean;
}

interface ArchiveStats {
  totalSignals: number;
  totalBuys: number;
  totalShorts: number;
  winners: number;
  losers: number;
  winRate: number;
  avgPnlPct: number;
  bestPick: TickerTrack | null;
  worstPick: TickerTrack | null;
  avgBuyScore: number;
  avgShortScore: number;
  uniqueTickers: number;
  totalScansRun: number;
  targetHitRate: number;
  stopHitRate: number;
}

function computeStats(tracks: TickerTrack[], snapshots: Snapshot[]): ArchiveStats {
  const withPerf = tracks.filter((t) => t.pnlPct !== null);
  const winners = withPerf.filter((t) => (t.pnlPct ?? 0) > 0);
  const losers = withPerf.filter((t) => (t.pnlPct ?? 0) <= 0);

  const allBuys = tracks.filter((t) => t.signal.includes("BUY"));
  const allShorts = tracks.filter((t) => t.signal.includes("SELL"));

  const targetHits = withPerf.filter((t) => t.hitTarget);
  const stopHits = withPerf.filter((t) => t.hitStop);

  const buyScores = allBuys.map(() => 0); // We'll compute from snapshots
  const shortScores = allShorts.map(() => 0);

  // Get unique tickers from all snapshots
  const allTickers = new Set<string>();
  let totalSigs = 0;
  for (const snap of snapshots) {
    for (const r of snap.results) {
      allTickers.add(r.ticker);
      if (r.signal !== "HOLD") totalSigs++;
    }
  }

  const avgPnlArr = withPerf.map((t) => t.pnlPct ?? 0);
  const avgPnl = avgPnlArr.length > 0 ? avgPnlArr.reduce((a, b) => a + b, 0) / avgPnlArr.length : 0;

  const sorted = [...withPerf].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));

  return {
    totalSignals: totalSigs,
    totalBuys: allBuys.length,
    totalShorts: allShorts.length,
    winners: winners.length,
    losers: losers.length,
    winRate: withPerf.length > 0 ? (winners.length / withPerf.length) * 100 : 0,
    avgPnlPct: avgPnl,
    bestPick: sorted[0] ?? null,
    worstPick: sorted[sorted.length - 1] ?? null,
    avgBuyScore: buyScores.length > 0 ? buyScores.reduce((a, b) => a + b, 0) / buyScores.length : 0,
    avgShortScore: shortScores.length > 0 ? shortScores.reduce((a, b) => a + b, 0) / shortScores.length : 0,
    uniqueTickers: allTickers.size,
    totalScansRun: snapshots.length,
    targetHitRate: withPerf.length > 0 ? (targetHits.length / withPerf.length) * 100 : 0,
    stopHitRate: withPerf.length > 0 ? (stopHits.length / withPerf.length) * 100 : 0,
  };
}

/* ── Main Component ── */

export default function ArchivePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [livePrices, setLivePrices] = useState<Map<string, number>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Load archive snapshots
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/scanner/archive?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("Archiv konnte nicht geladen werden");
        return res.json();
      })
      .then((data) => {
        const snaps: Snapshot[] = data.snapshots ?? [];
        snaps.sort((a, b) => b.date.localeCompare(a.date));
        setSnapshots(snaps);
        if (snaps.length > 0 && !selectedDate) {
          setSelectedDate(snaps[0].date);
        }
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSnapshot = snapshots.find((s) => s.date === selectedDate);

  // Fetch live prices for all tickers across all snapshots (for stats)
  useEffect(() => {
    if (snapshots.length === 0) return;

    // Collect all unique tickers with non-HOLD signals
    const allTickers = new Set<string>();
    for (const snap of snapshots) {
      for (const r of snap.results) {
        if (r.signal !== "HOLD") allTickers.add(r.ticker);
      }
    }
    // Plus current snapshot tickers
    if (activeSnapshot) {
      for (const r of activeSnapshot.results) allTickers.add(r.ticker);
    }

    const tickers = [...allTickers];
    if (tickers.length === 0) return;

    setPricesLoading(true);
    // Batch fetch in groups of 15
    const batchSize = 15;
    const batches: string[][] = [];
    for (let i = 0; i < tickers.length; i += batchSize) {
      batches.push(tickers.slice(i, i + batchSize));
    }

    (async () => {
      const map = new Map<string, number>();
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map(async (t) => {
            try {
              const res = await fetch(`/api/stock/${t}`);
              if (!res.ok) return null;
              const data = await res.json();
              return { ticker: t, price: data.currentPrice as number };
            } catch {
              return null;
            }
          })
        );
        for (const r of results) {
          if (r && r.price > 0) map.set(r.ticker, r.price);
        }
      }
      setLivePrices(map);
      setPricesLoading(false);
    })();
  }, [snapshots, activeSnapshot]);

  // Build tracks: for each unique ticker+signal across all snapshots, track performance
  const allTracks = useMemo<TickerTrack[]>(() => {
    if (snapshots.length === 0) return [];

    // Use the FIRST appearance of each ticker with a non-HOLD signal
    const seen = new Map<string, TickerTrack>();

    // Process oldest first
    const chronological = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    for (const snap of chronological) {
      for (const r of snap.results) {
        if (r.signal === "HOLD") continue;
        const key = `${r.ticker}-${r.signal}`;
        if (seen.has(key)) continue;

        const livePrice = livePrices.get(r.ticker) ?? null;
        const isShort = r.signal.includes("SELL");
        let pnl: number | null = null;
        let pnlPct: number | null = null;
        let hitTarget = false;
        let hitStop = false;

        if (livePrice && r.price > 0) {
          pnl = isShort ? (r.price - livePrice) : (livePrice - r.price);
          pnlPct = (pnl / r.price) * 100;

          if (isShort) {
            hitTarget = livePrice <= r.target;
            hitStop = livePrice >= r.stop;
          } else {
            hitTarget = livePrice >= r.target;
            hitStop = livePrice <= r.stop;
          }
        }

        seen.set(key, {
          ticker: r.ticker,
          name: r.name || r.ticker,
          signal: r.signal,
          signalDate: snap.date,
          signalPrice: r.price,
          entry: r.entry,
          target: r.target,
          stop: r.stop,
          livePrice,
          pnl,
          pnlPct,
          hitTarget,
          hitStop,
        });
      }
    }

    return [...seen.values()].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  }, [snapshots, livePrices]);

  const stats = useMemo(() => computeStats(allTracks, snapshots), [allTracks, snapshots]);

  // Per-snapshot helpers
  const currentIdx = snapshots.findIndex((s) => s.date === selectedDate);
  const prevSnapshot = currentIdx >= 0 && currentIdx < snapshots.length - 1
    ? snapshots[currentIdx + 1] : null;

  function getSignalChange(ticker: string): string | null {
    if (!prevSnapshot || !activeSnapshot) return null;
    const prev = prevSnapshot.results.find((r) => r.ticker === ticker);
    const curr = activeSnapshot.results.find((r) => r.ticker === ticker);
    if (!prev || !curr || prev.signal === curr.signal) return null;
    return `${prev.signal} → ${curr.signal}`;
  }

  function getPerformance(r: ScanResultSnapshot): { pnl: number; pnlPct: number } | null {
    const livePrice = livePrices.get(r.ticker);
    if (!livePrice || r.price === 0) return null;
    const isShort = r.signal === "SELL" || r.signal === "STRONG SELL";
    const pnl = isShort ? (r.price - livePrice) : (livePrice - r.price);
    const pnlPct = (pnl / r.price) * 100;
    return { pnl, pnlPct };
  }

  const buys = activeSnapshot?.results.filter((r) => r.signal === "STRONG BUY" || r.signal === "BUY") ?? [];
  const shorts = activeSnapshot?.results.filter((r) => r.signal === "SELL" || r.signal === "STRONG SELL") ?? [];
  const holds = activeSnapshot?.results.filter((r) => r.signal === "HOLD") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-bright">ActionBoard Archiv</h1>
        <div className="flex items-center gap-3">
          {pricesLoading && (
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              Kurse laden...
            </div>
          )}
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="bg-card border border-card-border rounded px-2 py-1 text-xs text-foreground"
          >
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={60}>60 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-muted">Archiv wird geladen...</p>
        </div>
      )}

      {error && (
        <div className="bg-card border border-down/30 rounded-lg p-4 text-center">
          <p className="text-xs text-down">{error}</p>
        </div>
      )}

      {!loading && snapshots.length === 0 && !error && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted">
            Noch keine Archiv-Eintraege. Das Archiv wird automatisch erstellt, wenn der Scanner laeuft.
          </p>
        </div>
      )}

      {/* ══════════════ STATISTICS SUMMARY ══════════════ */}
      {snapshots.length > 0 && (
        <div>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 text-xs font-semibold text-sub uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showStats ? "rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Gesamtstatistik ({days} Tage)
          </button>

          {showStats && (
            <div className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-card border border-card-border rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Scans</span>
                  <span className="font-mono-num text-lg text-bright">{stats.totalScansRun}</span>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Aktien gescannt</span>
                  <span className="font-mono-num text-lg text-bright">{stats.uniqueTickers}</span>
                </div>
                <div className="bg-card border border-up/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Kaufsignale</span>
                  <span className="font-mono-num text-lg text-up">{stats.totalBuys}</span>
                </div>
                <div className="bg-card border border-down/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Shortsignale</span>
                  <span className="font-mono-num text-lg text-down">{stats.totalShorts}</span>
                </div>
                <div className="bg-card border border-up/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Win-Rate</span>
                  <span className={`font-mono-num text-lg ${stats.winRate >= 50 ? "text-up" : "text-down"}`}>
                    {stats.winRate.toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-muted block">{stats.winners}W / {stats.losers}L</span>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Ø Performance</span>
                  <span className={`font-mono-num text-lg ${stats.avgPnlPct >= 0 ? "text-up" : "text-down"}`}>
                    {stats.avgPnlPct >= 0 ? "+" : ""}{stats.avgPnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Target/Stop Hit Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <span className="text-[10px] text-muted uppercase block mb-1">Kursziel erreicht</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-up rounded-full transition-all"
                        style={{ width: `${stats.targetHitRate}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-xs text-up">{stats.targetHitRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <span className="text-[10px] text-muted uppercase block mb-1">Stop-Loss ausgeloest</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-down rounded-full transition-all"
                        style={{ width: `${stats.stopHitRate}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-xs text-down">{stats.stopHitRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Best & Worst Picks */}
              {(stats.bestPick || stats.worstPick) && (
                <div className="grid grid-cols-2 gap-3">
                  {stats.bestPick && (
                    <Link href={`/stock/${stats.bestPick.ticker}`} className="bg-card border border-up/20 rounded-lg p-3 hover:bg-card-hover transition-colors">
                      <span className="text-[10px] text-muted uppercase block mb-1">Bester Pick</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-accent">{stats.bestPick.ticker}</span>
                        <span className="text-[10px] text-sub truncate">{stats.bestPick.name}</span>
                      </div>
                      <span className="font-mono-num text-up text-sm font-bold">
                        +{stats.bestPick.pnlPct?.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-muted block">
                        Signal: {stats.bestPick.signal} am {stats.bestPick.signalDate} | {fmt(stats.bestPick.signalPrice)} € → {stats.bestPick.livePrice ? `${fmt(stats.bestPick.livePrice)} €` : "–"}
                      </span>
                    </Link>
                  )}
                  {stats.worstPick && stats.worstPick.pnlPct !== null && stats.worstPick.pnlPct < 0 && (
                    <Link href={`/stock/${stats.worstPick.ticker}`} className="bg-card border border-down/20 rounded-lg p-3 hover:bg-card-hover transition-colors">
                      <span className="text-[10px] text-muted uppercase block mb-1">Schlechtester Pick</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-accent">{stats.worstPick.ticker}</span>
                        <span className="text-[10px] text-sub truncate">{stats.worstPick.name}</span>
                      </div>
                      <span className="font-mono-num text-down text-sm font-bold">
                        {stats.worstPick.pnlPct?.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-muted block">
                        Signal: {stats.worstPick.signal} am {stats.worstPick.signalDate} | {fmt(stats.worstPick.signalPrice)} € → {stats.worstPick.livePrice ? `${fmt(stats.worstPick.livePrice)} €` : "–"}
                      </span>
                    </Link>
                  )}
                </div>
              )}

              {/* All Tracked Signals Table */}
              {allTracks.length > 0 && (
                <details>
                  <summary className="text-xs text-muted hover:text-foreground cursor-pointer transition-colors mb-2">
                    Alle {allTracks.length} getrackte Signale anzeigen
                  </summary>
                  <div className="bg-card border border-card-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                          <th className="text-left px-3 py-2">Ticker</th>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-center px-3 py-2">Signal</th>
                          <th className="text-left px-3 py-2">Datum</th>
                          <th className="text-right px-3 py-2">Signal-Preis</th>
                          <th className="text-right px-3 py-2">Aktuell</th>
                          <th className="text-right px-3 py-2">Performance</th>
                          <th className="text-center px-3 py-2">Ziel</th>
                          <th className="text-center px-3 py-2">Stop</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTracks.map((t) => (
                          <tr key={`${t.ticker}-${t.signal}-${t.signalDate}`} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                            <td className="px-3 py-2">
                              <Link href={`/stock/${t.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                                {t.ticker}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-sub text-[10px] max-w-[150px] truncate">{t.name}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SIGNAL_COLOR[t.signal] ?? "text-muted"}`}>
                                {SIGNAL_LABEL[t.signal] ?? t.signal}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono-num text-muted">{t.signalDate}</td>
                            <td className="px-3 py-2 text-right font-mono-num text-muted">{fmt(t.signalPrice)} €</td>
                            <td className="px-3 py-2 text-right font-mono-num">
                              {t.livePrice ? `${fmt(t.livePrice)} €` : "–"}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono-num font-bold ${t.pnlPct !== null ? (t.pnlPct >= 0 ? "text-up" : "text-down") : "text-muted"}`}>
                              {t.pnlPct !== null ? `${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%` : "–"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {t.hitTarget ? (
                                <span className="text-up text-[10px] font-bold">HIT</span>
                              ) : (
                                <span className="text-[10px] text-muted">–</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {t.hitStop ? (
                                <span className="text-down text-[10px] font-bold">HIT</span>
                              ) : (
                                <span className="text-[10px] text-muted">–</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DAILY SNAPSHOTS ══════════════ */}
      {snapshots.length > 0 && (
        <div className="flex gap-6">
          {/* Date sidebar */}
          <div className="w-40 shrink-0 space-y-1">
            <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Datum</span>
            {snapshots.map((s) => {
              const buyCount = s.results.filter((r) => r.signal.includes("BUY")).length;
              const shortCount = s.results.filter((r) => r.signal.includes("SELL")).length;
              return (
                <button
                  key={s.date}
                  onClick={() => setSelectedDate(s.date)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                    s.date === selectedDate
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "text-muted hover:text-foreground hover:bg-card-hover"
                  }`}
                >
                  <span className="font-mono-num">{s.date}</span>
                  <span className="flex items-center gap-2 text-[9px] text-muted">
                    <span>{s.results.length} total</span>
                    {buyCount > 0 && <span className="text-up">{buyCount} buy</span>}
                    {shortCount > 0 && <span className="text-down">{shortCount} short</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Snapshot content */}
          {activeSnapshot && (
            <div className="flex-1 space-y-4">
              {/* Day summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border border-card-border rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Gescannt</span>
                  <span className="font-mono-num text-lg text-bright">{activeSnapshot.results.length}</span>
                </div>
                <div className="bg-card border border-up/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Kaufsignale</span>
                  <span className="font-mono-num text-lg text-up">{buys.length}</span>
                </div>
                <div className="bg-card border border-down/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Shortsignale</span>
                  <span className="font-mono-num text-lg text-down">{shorts.length}</span>
                </div>
                <div className="bg-card border border-gold/20 rounded-lg p-3 text-center">
                  <span className="text-[10px] text-muted uppercase block">Halten</span>
                  <span className="font-mono-num text-lg text-gold">{holds.length}</span>
                </div>
              </div>

              {/* Buy Signals Table */}
              {buys.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-up uppercase tracking-wider mb-2">Kaufsignale ({buys.length})</h3>
                  <div className="bg-card border border-card-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                          <th className="text-left px-3 py-2">Ticker</th>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-center px-3 py-2">Signal</th>
                          <th className="text-right px-3 py-2">Score</th>
                          <th className="text-right px-3 py-2">Signal-Preis</th>
                          <th className="text-right px-3 py-2">Aktuell</th>
                          <th className="text-right px-3 py-2">Perf.</th>
                          <th className="text-right px-3 py-2">Entry</th>
                          <th className="text-right px-3 py-2">Ziel</th>
                          <th className="text-right px-3 py-2">Stop</th>
                          <th className="text-left px-3 py-2">Aend.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buys.sort((a, b) => b.score - a.score).map((r) => {
                          const change = getSignalChange(r.ticker);
                          const perf = getPerformance(r);
                          const livePrice = livePrices.get(r.ticker);
                          return (
                            <tr key={r.ticker} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                              <td className="px-3 py-2">
                                <Link href={`/stock/${r.ticker}`} className="font-mono-num font-bold text-accent hover:underline">{r.ticker}</Link>
                              </td>
                              <td className="px-3 py-2 text-[10px] text-sub max-w-[120px] truncate">{r.name !== r.ticker ? r.name : ""}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SIGNAL_COLOR[r.signal]}`}>{SIGNAL_LABEL[r.signal]}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono-num text-up">+{r.score}</td>
                              <td className="px-3 py-2 text-right font-mono-num text-muted">{fmt(r.price)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num">{livePrice ? `${fmt(livePrice)} €` : "–"}</td>
                              <td className={`px-3 py-2 text-right font-mono-num font-bold ${perf ? (perf.pnl >= 0 ? "text-up" : "text-down") : "text-muted"}`}>
                                {perf ? `${perf.pnlPct >= 0 ? "+" : ""}${perf.pnlPct.toFixed(2)}%` : "–"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono-num text-muted">{fmt(r.entry)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num text-up">{fmt(r.target)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num text-down">{fmt(r.stop)} €</td>
                              <td className="px-3 py-2">{change && <span className="text-[10px] text-gold font-semibold">{change}</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Short Signals Table */}
              {shorts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-down uppercase tracking-wider mb-2">Shortsignale ({shorts.length})</h3>
                  <div className="bg-card border border-card-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                          <th className="text-left px-3 py-2">Ticker</th>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-center px-3 py-2">Signal</th>
                          <th className="text-right px-3 py-2">Score</th>
                          <th className="text-right px-3 py-2">Signal-Preis</th>
                          <th className="text-right px-3 py-2">Aktuell</th>
                          <th className="text-right px-3 py-2">Perf.</th>
                          <th className="text-right px-3 py-2">Short Entry</th>
                          <th className="text-right px-3 py-2">Ziel</th>
                          <th className="text-right px-3 py-2">Stop</th>
                          <th className="text-left px-3 py-2">Aend.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shorts.sort((a, b) => a.score - b.score).map((r) => {
                          const change = getSignalChange(r.ticker);
                          const perf = getPerformance(r);
                          const livePrice = livePrices.get(r.ticker);
                          return (
                            <tr key={r.ticker} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                              <td className="px-3 py-2">
                                <Link href={`/stock/${r.ticker}`} className="font-mono-num font-bold text-accent hover:underline">{r.ticker}</Link>
                              </td>
                              <td className="px-3 py-2 text-[10px] text-sub max-w-[120px] truncate">{r.name !== r.ticker ? r.name : ""}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${SIGNAL_COLOR[r.signal]}`}>{SIGNAL_LABEL[r.signal]}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono-num text-down">{r.score}</td>
                              <td className="px-3 py-2 text-right font-mono-num text-muted">{fmt(r.price)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num">{livePrice ? `${fmt(livePrice)} €` : "–"}</td>
                              <td className={`px-3 py-2 text-right font-mono-num font-bold ${perf ? (perf.pnl >= 0 ? "text-up" : "text-down") : "text-muted"}`}>
                                {perf ? `${perf.pnlPct >= 0 ? "+" : ""}${perf.pnlPct.toFixed(2)}%` : "–"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono-num text-muted">{fmt(r.entry)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num text-down">{fmt(r.target)} €</td>
                              <td className="px-3 py-2 text-right font-mono-num text-up">{fmt(r.stop)} €</td>
                              <td className="px-3 py-2">{change && <span className="text-[10px] text-gold font-semibold">{change}</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HOLD collapsed */}
              {holds.length > 0 && (
                <details>
                  <summary className="text-xs text-muted hover:text-foreground cursor-pointer transition-colors">
                    HOLD ({holds.length} Aktien)
                  </summary>
                  <div className="mt-2 bg-card border border-card-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0">
                      {holds.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).map((r) => {
                        const livePrice = livePrices.get(r.ticker);
                        const pnlPct = livePrice && r.price > 0 ? ((livePrice - r.price) / r.price) * 100 : null;
                        return (
                          <div key={r.ticker} className="px-3 py-2 border-b border-r border-card-border">
                            <Link href={`/stock/${r.ticker}`} className="font-mono-num text-[11px] font-bold text-accent hover:underline">{r.ticker}</Link>
                            {r.name !== r.ticker && <span className="block text-[8px] text-sub truncate">{r.name}</span>}
                            <span className="block text-[9px] text-muted font-mono-num">
                              {fmt(r.price)} €
                              {pnlPct !== null && (
                                <span className={pnlPct >= 0 ? "text-up" : "text-down"}> {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              )}

              <p className="text-[9px] text-muted">
                Scan vom {activeSnapshot.scannedAt.slice(0, 16).replace("T", " ")} UTC
                {livePrices.size > 0 && ` | Kurse fuer ${livePrices.size} Aktien geladen`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
