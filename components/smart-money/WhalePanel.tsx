"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WHALE_LIST, type WhalePortfolio } from "@/lib/api/smart-money-types";

export default function WhalePanel() {
  const [selectedWhale, setSelectedWhale] = useState("buffett");
  const [portfolio, setPortfolio] = useState<WhalePortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async (whaleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/smart-money/whales/${whaleId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPortfolio(data);
    } catch {
      setError("Portfolio konnte nicht geladen werden.");
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio(selectedWhale);
  }, [selectedWhale, loadPortfolio]);

  const fmt = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
    return `$${n.toFixed(0)}M`;
  };

  const fmtShares = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const whale = WHALE_LIST.find((w) => w.id === selectedWhale);

  return (
    <div className="space-y-4">
      {/* Whale selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedWhale}
          onChange={(e) => setSelectedWhale(e.target.value)}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
        >
          {WHALE_LIST.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} / {w.entity}
            </option>
          ))}
        </select>
        {portfolio && (
          <span className="text-[10px] text-muted">
            Filing: {portfolio.filingDate} | {portfolio.holdings.length} Holdings | Total: {fmt(portfolio.totalValue)}
          </span>
        )}
      </div>

      {/* Whale description */}
      {whale && (
        <p className="text-[10px] text-sub">{whale.description}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">13F-Daten werden geladen...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-8 text-down text-sm">{error}</div>
      )}

      {/* Holdings table */}
      {portfolio && !loading && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Unternehmen</th>
                <th className="text-left px-3 py-2">Ticker</th>
                <th className="text-right px-3 py-2">Wert</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">Shares</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">% Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.slice(0, 50).map((h, i) => {
                const pct = portfolio.totalValue > 0
                  ? ((h.value / portfolio.totalValue) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr
                    key={`${h.cusip}-${i}`}
                    className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-3 py-2 font-mono-num text-muted">{i + 1}</td>
                    <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{h.name}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/stock/${h.ticker}`}
                        className="font-mono-num font-bold text-accent hover:underline"
                      >
                        {h.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono-num text-bright">{fmt(h.value)}</td>
                    <td className="px-3 py-2 text-right font-mono-num text-sub hidden sm:table-cell">
                      {fmtShares(h.shares)}
                    </td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-16 h-1.5 bg-card-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                          />
                        </div>
                        <span className="font-mono-num text-muted w-10 text-right">{pct}%</span>
                      </div>
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
