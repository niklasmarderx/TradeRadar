"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { InsiderData } from "@/lib/api/smart-money-types";

function formatDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export default function InsiderPanel() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<InsiderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (t: string) => {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/smart-money/insider/${t.trim().toUpperCase()}`);
      if (!res.ok) throw new Error("Not found");
      setData(await res.json());
    } catch {
      setError("Keine Insider-Daten gefunden.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const buys = data?.transactions.filter((t) => t.type === "buy") ?? [];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          placeholder="Ticker eingeben (z.B. AAPL)..."
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && search(ticker)}
          className="bg-background border border-card-border rounded px-3 py-1.5 text-xs text-foreground font-mono-num focus:outline-none focus:border-accent w-48"
        />
        <button
          onClick={() => search(ticker)}
          disabled={!ticker.trim() || loading}
          className="px-3 py-1.5 text-xs text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors disabled:opacity-30"
        >
          Suchen
        </button>
        {loading && (
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        )}
      </div>

      {error && <p className="text-sm text-down">{error}</p>}

      {data && !loading && (
        <>
          {/* Ownership breakdown */}
          <div className="flex items-center gap-4 bg-card border border-card-border rounded-lg px-4 py-3">
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Insider</span>
              <p className="font-mono-num text-sm text-bright">
                {data.insiderPercent != null ? `${(data.insiderPercent * 100).toFixed(1)}%` : "–"}
              </p>
            </div>
            <div className="w-px h-8 bg-card-border" />
            <div>
              <span className="text-[10px] text-muted uppercase tracking-wider">Institutionell</span>
              <p className="font-mono-num text-sm text-bright">
                {data.institutionPercent != null ? `${(data.institutionPercent * 100).toFixed(1)}%` : "–"}
              </p>
            </div>
            {buys.length > 0 && (
              <>
                <div className="w-px h-8 bg-card-border" />
                <div>
                  <span className="text-[10px] text-muted uppercase tracking-wider">Insider-Käufe</span>
                  <p className="font-mono-num text-sm text-up">{buys.length}</p>
                </div>
              </>
            )}
          </div>

          {/* Insider transactions */}
          {data.transactions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">
                Insider-Transaktionen
              </h3>
              <div className="bg-card border border-card-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                      <th className="text-left px-3 py-2">Datum</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2 hidden sm:table-cell">Titel</th>
                      <th className="text-left px-3 py-2">Typ</th>
                      <th className="text-right px-3 py-2">Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.slice(0, 30).map((t, i) => (
                      <tr
                        key={`${t.name}-${t.date}-${i}`}
                        className={`border-b border-card-border last:border-0 hover:bg-card-hover transition-colors ${
                          t.type === "buy" ? "bg-up/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono-num text-sub whitespace-nowrap">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-3 py-2 text-foreground truncate max-w-[180px]">{t.name}</td>
                        <td className="px-3 py-2 text-muted hidden sm:table-cell truncate max-w-[120px]">
                          {t.title}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                              t.type === "buy"
                                ? "bg-up/15 text-up border-up/30"
                                : t.type === "sell"
                                  ? "bg-down/15 text-down border-down/30"
                                  : "bg-muted/15 text-muted border-muted/30"
                            }`}
                          >
                            {t.type === "buy" ? "Kauf" : t.type === "sell" ? "Verkauf" : t.type === "gift" ? "Gift" : t.transactionText.slice(0, 15)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono-num text-sub">
                          {t.shares.toLocaleString("de-DE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top institutional holders */}
          {data.topHolders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">
                Top Institutionelle Halter
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.topHolders.map((h) => (
                  <div
                    key={h.organization}
                    className="bg-card border border-card-border rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span className="text-xs text-foreground truncate">{h.organization}</span>
                    <span className="font-mono-num text-xs text-accent ml-2 shrink-0">
                      {(h.pctHeld * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="text-center py-12 text-muted text-sm">
          Gib einen Ticker ein, um Insider-Daten und institutionelle Halter zu sehen.
        </div>
      )}
    </div>
  );
}
