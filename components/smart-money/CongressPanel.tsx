"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CongressTrade } from "@/lib/api/smart-money-types";

interface CongressPanelProps {
  trades: CongressTrade[];
}

const PARTY_COLORS: Record<string, string> = {
  D: "bg-info/15 text-info border-info/30",
  R: "bg-down/15 text-down border-down/30",
};

function formatDate(d: string): string {
  if (!d) return "–";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function TransactionBadge({ type }: { type: string }) {
  const isPurchase = type.toLowerCase().includes("purchase");
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
        isPurchase
          ? "bg-up/15 text-up border-up/30"
          : "bg-down/15 text-down border-down/30"
      }`}
    >
      {isPurchase ? "Kauf" : "Verkauf"}
    </span>
  );
}

export default function CongressPanel({ trades }: CongressPanelProps) {
  const [partyFilter, setPartyFilter] = useState<"ALL" | "D" | "R">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "Purchase" | "Sale">("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = [...trades];
    if (partyFilter !== "ALL") result = result.filter((t) => t.party === partyFilter);
    if (typeFilter === "Purchase") result = result.filter((t) => t.transaction.toLowerCase().includes("purchase"));
    if (typeFilter === "Sale") result = result.filter((t) => t.transaction.toLowerCase().includes("sale"));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.ticker.toLowerCase().includes(q) || t.representative.toLowerCase().includes(q)
      );
    }
    return result;
  }, [trades, partyFilter, typeFilter, search]);

  // Top traded tickers
  const tickerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    trades.forEach((t) => counts.set(t.ticker, (counts.get(t.ticker) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [trades]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["ALL", "D", "R"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPartyFilter(p)}
              className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                partyFilter === p
                  ? p === "D" ? "border-info text-info bg-info/10"
                    : p === "R" ? "border-down text-down bg-down/10"
                    : "border-accent text-accent bg-accent/10"
                  : "border-card-border text-muted hover:text-foreground"
              }`}
            >
              {p === "ALL" ? "Alle" : p === "D" ? "Democrats" : "Republicans"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["ALL", "Purchase", "Sale"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                typeFilter === t
                  ? "border-accent text-accent bg-accent/10"
                  : "border-card-border text-muted hover:text-foreground"
              }`}
            >
              {t === "ALL" ? "Alle" : t === "Purchase" ? "Käufe" : "Verkäufe"}
            </button>
          ))}
        </div>
        <input
          placeholder="Ticker oder Politiker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background border border-card-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent min-w-[150px]"
        />
        <span className="text-[10px] text-muted ml-auto">{filtered.length} Trades</span>
      </div>

      {/* Top tickers */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted">Häufig gehandelt:</span>
        {tickerCounts.map(([ticker, count]) => (
          <Link
            key={ticker}
            href={`/stock/${ticker}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-background border border-card-border rounded hover:border-accent transition-colors"
          >
            <span className="font-mono-num font-bold text-accent">{ticker}</span>
            <span className="text-muted">({count})</span>
          </Link>
        ))}
      </div>

      {/* Trades table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
              <th className="text-left px-3 py-2">Datum</th>
              <th className="text-left px-3 py-2">Politiker</th>
              <th className="text-left px-3 py-2">Ticker</th>
              <th className="text-left px-3 py-2">Typ</th>
              <th className="text-right px-3 py-2 hidden sm:table-cell">Betrag</th>
              <th className="text-center px-3 py-2 hidden md:table-cell">Kammer</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((t, i) => (
              <tr
                key={`${t.representative}-${t.ticker}-${t.transactionDate}-${i}`}
                className="border-b border-card-border last:border-0 hover:bg-card-hover transition-colors"
              >
                <td className="px-3 py-2 font-mono-num text-sub whitespace-nowrap">
                  {formatDate(t.transactionDate)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-4 text-center text-[9px] font-bold rounded px-0.5 ${
                        PARTY_COLORS[t.party] ?? "bg-muted/15 text-muted"
                      }`}
                    >
                      {t.party}
                    </span>
                    <span className="text-foreground truncate max-w-[180px]">{t.representative}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/stock/${t.ticker}`}
                    className="font-mono-num font-bold text-accent hover:underline"
                  >
                    {t.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <TransactionBadge type={t.transaction} />
                </td>
                <td className="px-3 py-2 text-right font-mono-num text-sub hidden sm:table-cell whitespace-nowrap">
                  {t.range}
                </td>
                <td className="px-3 py-2 text-center text-muted hidden md:table-cell">
                  {t.house}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted text-sm">
          Keine Trades gefunden.
        </div>
      )}
    </div>
  );
}
