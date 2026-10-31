"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getPicks,
  addPick,
  archivePick,
  deletePick,
  type Pick,
} from "@/lib/picks";
import TickerAutocomplete from "@/components/TickerAutocomplete";

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SIGNAL_COLORS: Record<string, string> = {
  profit: "text-up",
  loss: "text-down",
  neutral: "text-muted",
};

export default function PicksPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [showAdd, setShowAdd] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [sellId, setSellId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [form, setForm] = useState({ ticker: "", name: "", buyPrice: "", shares: "", notes: "" });

  const refresh = useCallback(() => setPicks(getPicks()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch live EUR prices for all active picks
  useEffect(() => {
    const active = picks.filter((p) => !p.archived);
    if (active.length === 0) return;

    const tickers = [...new Set(active.map((p) => p.ticker))];
    Promise.all(
      tickers.map(async (t) => {
        try {
          const res = await fetch(`/api/stock/${t}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { ticker: t, price: data.currentPrice as number };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const map = new Map<string, number>();
      for (const r of results) {
        if (r) map.set(r.ticker, r.price);
      }
      setPrices(map);
    });
  }, [picks]);

  function handleAdd() {
    if (!form.ticker || !form.buyPrice || !form.shares) return;
    addPick({
      ticker: form.ticker.toUpperCase(),
      name: form.name || form.ticker.toUpperCase(),
      buyPrice: parseFloat(form.buyPrice),
      shares: parseFloat(form.shares),
      buyDate: new Date().toISOString().slice(0, 10),
      notes: form.notes,
    });
    setForm({ ticker: "", name: "", buyPrice: "", shares: "", notes: "" });
    setShowAdd(false);
    refresh();
  }

  function handleArchive(id: string) {
    const sp = sellPrice ? parseFloat(sellPrice) : undefined;
    archivePick(id, sp);
    setSellId(null);
    setSellPrice("");
    refresh();
  }

  function handleDelete(id: string) {
    deletePick(id);
    refresh();
  }

  const activePicks = picks.filter((p) => !p.archived);
  const archivedPicks = picks.filter((p) => p.archived);

  // Calculate total P&L
  let totalInvested = 0;
  let totalCurrent = 0;
  for (const p of activePicks) {
    totalInvested += p.buyPrice * p.shares;
    const livePrice = prices.get(p.ticker);
    if (livePrice) totalCurrent += livePrice * p.shares;
    else totalCurrent += p.buyPrice * p.shares;
  }
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-bright">Meine Picks</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 text-xs font-semibold bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20 transition-colors"
        >
          + Neuer Pick
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-card border border-card-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TickerAutocomplete
              value={form.ticker}
              onChange={(ticker, name) => setForm({ ...form, ticker, name: name ?? form.name })}
              placeholder="Ticker suchen..."
              className="w-full"
            />
            <input
              placeholder="Name (optional)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Kaufpreis (EUR)"
              type="number"
              step="0.01"
              value={form.buyPrice}
              onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
              className="bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Anzahl Aktien"
              type="number"
              step="0.001"
              value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              className="bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent"
            />
          </div>
          <input
            placeholder="Notizen (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs font-semibold bg-up/10 text-up border border-up/30 rounded hover:bg-up/20 transition-colors"
            >
              Hinzufuegen
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {activePicks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Investiert</span>
            <span className="font-mono-num text-lg text-bright">{fmt(totalInvested)} €</span>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Aktueller Wert</span>
            <span className="font-mono-num text-lg text-bright">{fmt(totalCurrent)} €</span>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Gewinn/Verlust</span>
            <span className={`font-mono-num text-lg ${totalPnl >= 0 ? "text-up" : "text-down"}`}>
              {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)} € ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      )}

      {/* Active Picks */}
      {activePicks.length === 0 && !showAdd && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted">Noch keine Picks. Klicke &ldquo;+ Neuer Pick&rdquo; um einen Kauf zu tracken.</p>
        </div>
      )}

      {activePicks.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-right px-4 py-2">Kaufpreis</th>
                <th className="text-right px-4 py-2">Aktuell</th>
                <th className="text-right px-4 py-2">Stueck</th>
                <th className="text-right px-4 py-2">Investiert</th>
                <th className="text-right px-4 py-2">Wert</th>
                <th className="text-right px-4 py-2">P&L</th>
                <th className="text-right px-4 py-2">P&L %</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Datum</th>
                <th className="text-right px-4 py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {activePicks.map((p) => {
                const livePrice = prices.get(p.ticker);
                const pnl = livePrice ? (livePrice - p.buyPrice) * p.shares : 0;
                const pnlPct = livePrice ? ((livePrice - p.buyPrice) / p.buyPrice) * 100 : 0;
                const color = !livePrice ? "neutral" : pnl >= 0 ? "profit" : "loss";

                return (
                  <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/stock/${p.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                        {p.ticker}
                      </Link>
                      <span className="block text-[10px] text-sub">{p.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num">{fmt(p.buyPrice)} €</td>
                    <td className={`px-4 py-3 text-right font-mono-num ${SIGNAL_COLORS[color]}`}>
                      {livePrice ? `${fmt(livePrice)} €` : "–"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num">{p.shares}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted">{fmt(p.buyPrice * p.shares)} €</td>
                    <td className="px-4 py-3 text-right font-mono-num">
                      {livePrice ? `${fmt(livePrice * p.shares)} €` : "–"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono-num ${SIGNAL_COLORS[color]}`}>
                      {livePrice ? `${pnl >= 0 ? "+" : ""}${fmt(pnl)} €` : "–"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono-num ${SIGNAL_COLORS[color]}`}>
                      {livePrice ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "–"}
                    </td>
                    <td className="px-4 py-3 text-left text-muted hidden md:table-cell">{p.buyDate}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {sellId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              placeholder="Verkaufspreis"
                              type="number"
                              step="0.01"
                              value={sellPrice}
                              onChange={(e) => setSellPrice(e.target.value)}
                              className="w-20 bg-background border border-card-border rounded px-1.5 py-0.5 text-[10px] font-mono-num focus:outline-none focus:border-accent"
                            />
                            <button
                              onClick={() => handleArchive(p.id)}
                              className="text-[10px] text-up hover:underline"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => { setSellId(null); setSellPrice(""); }}
                              className="text-[10px] text-muted hover:text-foreground"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setSellId(p.id)}
                              className="text-[10px] text-accent hover:underline"
                              title="Verkaufen / Archivieren"
                            >
                              Verkaufen
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="text-[10px] text-down hover:underline ml-2"
                              title="Loeschen"
                            >
                              X
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived Picks */}
      {archivedPicks.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors mb-3"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showArchive ? "rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Archiv ({archivedPicks.length})
          </button>

          {showArchive && (
            <div className="bg-card border border-card-border rounded-lg overflow-hidden opacity-70">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Ticker</th>
                    <th className="text-right px-4 py-2">Kaufpreis</th>
                    <th className="text-right px-4 py-2">Verkaufspreis</th>
                    <th className="text-right px-4 py-2">Stueck</th>
                    <th className="text-right px-4 py-2">P&L</th>
                    <th className="text-left px-4 py-2">Verkauft am</th>
                    <th className="text-right px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {archivedPicks.map((p) => {
                    const pnl = p.sellPrice ? (p.sellPrice - p.buyPrice) * p.shares : 0;
                    const color = pnl >= 0 ? "profit" : "loss";
                    return (
                      <tr key={p.id} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono-num font-bold">{p.ticker}</td>
                        <td className="px-4 py-2 text-right font-mono-num">{fmt(p.buyPrice)} €</td>
                        <td className="px-4 py-2 text-right font-mono-num">
                          {p.sellPrice ? `${fmt(p.sellPrice)} €` : "–"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono-num">{p.shares}</td>
                        <td className={`px-4 py-2 text-right font-mono-num ${SIGNAL_COLORS[color]}`}>
                          {p.sellPrice ? `${pnl >= 0 ? "+" : ""}${fmt(pnl)} €` : "–"}
                        </td>
                        <td className="px-4 py-2 text-muted">{p.archivedAt?.slice(0, 10) ?? "–"}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleDelete(p.id)} className="text-[10px] text-down hover:underline">X</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
