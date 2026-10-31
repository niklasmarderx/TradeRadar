"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getPortfolio,
  addPosition,
  removePosition,
  type PortfolioPosition,
} from "@/lib/portfolio";
import TickerAutocomplete from "@/components/TickerAutocomplete";

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PortfolioPage() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ticker: "", name: "", shares: "", avgPrice: "" });

  const refresh = useCallback(() => setPositions(getPortfolio()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch live EUR prices
  useEffect(() => {
    if (positions.length === 0) return;
    const tickers = [...new Set(positions.map((p) => p.ticker))];
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
  }, [positions]);

  function handleAdd() {
    if (!form.ticker || !form.shares || !form.avgPrice) return;
    addPosition({
      ticker: form.ticker.toUpperCase(),
      name: form.name || form.ticker.toUpperCase(),
      shares: parseFloat(form.shares),
      avgPrice: parseFloat(form.avgPrice),
    });
    setForm({ ticker: "", name: "", shares: "", avgPrice: "" });
    setShowAdd(false);
    refresh();
  }

  function handleRemove(id: string) {
    removePosition(id);
    refresh();
  }

  // Portfolio totals
  let totalInvested = 0;
  let totalCurrent = 0;
  const positionsWithPnL = positions.map((p) => {
    const livePrice = prices.get(p.ticker);
    const invested = p.avgPrice * p.shares;
    const current = livePrice ? livePrice * p.shares : invested;
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    totalInvested += invested;
    totalCurrent += current;
    return { ...p, livePrice, invested, current, pnl, pnlPct };
  });

  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // Allocation percentages
  const positionsWithAllocation = positionsWithPnL.map((p) => ({
    ...p,
    allocation: totalCurrent > 0 ? (p.current / totalCurrent) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-bright">Portfolio</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 text-xs font-semibold bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20 transition-colors"
        >
          + Position hinzufuegen
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
              placeholder="Durchschnittspreis (EUR)"
              type="number"
              step="0.01"
              value={form.avgPrice}
              onChange={(e) => setForm({ ...form, avgPrice: e.target.value })}
              className="bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Anzahl Stueck"
              type="number"
              step="0.001"
              value={form.shares}
              onChange={(e) => setForm({ ...form, shares: e.target.value })}
              className="bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent"
            />
          </div>
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
          <p className="text-[9px] text-muted">
            Gleicher Ticker wird zusammengefuehrt (Durchschnittspreis berechnet).
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {positions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Gesamtwert</span>
            <span className="font-mono-num text-lg text-bright">{fmt(totalCurrent)} €</span>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Investiert</span>
            <span className="font-mono-num text-lg text-muted">{fmt(totalInvested)} €</span>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Gewinn/Verlust</span>
            <span className={`font-mono-num text-lg ${totalPnl >= 0 ? "text-up" : "text-down"}`}>
              {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)} €
            </span>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4 text-center">
            <span className="text-[10px] text-muted uppercase block">Performance</span>
            <span className={`font-mono-num text-lg ${totalPnlPct >= 0 ? "text-up" : "text-down"}`}>
              {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Allocation Bar */}
      {positionsWithAllocation.length > 1 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <span className="text-[10px] text-muted uppercase tracking-wider block mb-2">Allokation</span>
          <div className="flex h-6 rounded overflow-hidden">
            {positionsWithAllocation.map((p, i) => {
              const colors = ["bg-accent", "bg-up", "bg-info", "bg-gold", "bg-purple", "bg-down", "bg-muted"];
              return (
                <div
                  key={p.id}
                  className={`${colors[i % colors.length]} flex items-center justify-center`}
                  style={{ width: `${p.allocation}%` }}
                  title={`${p.ticker}: ${p.allocation.toFixed(1)}%`}
                >
                  {p.allocation > 8 && (
                    <span className="text-[9px] font-bold text-background truncate px-1">
                      {p.ticker} {p.allocation.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positions Table */}
      {positions.length === 0 && !showAdd && (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted">Noch keine Positionen. Klicke &ldquo;+ Position hinzufuegen&rdquo; um dein Portfolio zu tracken.</p>
        </div>
      )}

      {positionsWithAllocation.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-right px-4 py-2">Stueck</th>
                <th className="text-right px-4 py-2">Ø Preis</th>
                <th className="text-right px-4 py-2">Aktuell</th>
                <th className="text-right px-4 py-2">Wert</th>
                <th className="text-right px-4 py-2">P&L</th>
                <th className="text-right px-4 py-2">P&L %</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">Anteil</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {positionsWithAllocation
                .sort((a, b) => b.current - a.current)
                .map((p) => {
                  const color = !p.livePrice ? "text-muted" : p.pnl >= 0 ? "text-up" : "text-down";
                  return (
                    <tr key={p.id} className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/stock/${p.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                          {p.ticker}
                        </Link>
                        <span className="block text-[10px] text-sub">{p.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num">{p.shares}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-muted">{fmt(p.avgPrice)} €</td>
                      <td className={`px-4 py-3 text-right font-mono-num ${color}`}>
                        {p.livePrice ? `${fmt(p.livePrice)} €` : "–"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-bright">{fmt(p.current)} €</td>
                      <td className={`px-4 py-3 text-right font-mono-num ${color}`}>
                        {p.livePrice ? `${p.pnl >= 0 ? "+" : ""}${fmt(p.pnl)} €` : "–"}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono-num ${color}`}>
                        {p.livePrice ? `${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(2)}%` : "–"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-muted hidden md:table-cell">
                        {p.allocation.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(p.id)}
                          className="text-[10px] text-down hover:underline"
                          title="Position entfernen"
                        >
                          X
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
