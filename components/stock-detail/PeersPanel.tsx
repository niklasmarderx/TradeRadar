"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Action } from "@/lib/types";

interface Props {
  currentTicker: string;
  actions: Action[];
}

const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY": "bg-up/20 text-up border-up/40",
  BUY: "bg-up/10 text-up border-up/30",
  SELL: "bg-down/10 text-down border-down/30",
  "STRONG SELL": "bg-down/20 text-down border-down/40",
  HOLD: "bg-muted/20 text-muted border-muted/40",
};

export default function PeersPanel({ currentTicker, actions }: Props) {
  const current = useMemo(
    () => actions.find((a) => a.ticker === currentTicker),
    [actions, currentTicker]
  );

  const peers = useMemo(() => {
    if (!current?.sector) return [];
    return actions
      .filter(
        (a) =>
          a.ticker !== currentTicker &&
          (a.sector === current.sector || a.industry === current.industry)
      )
      .slice(0, 15);
  }, [actions, current, currentTicker]);

  if (peers.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 text-center text-muted text-sm">
        Keine Peer-Unternehmen im aktuellen Scanner-Cache gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-1">
          Peer-Vergleich
        </h3>
        <p className="text-[10px] text-muted mb-3">
          {current?.sector} / {current?.industry} — {peers.length} Peers gefunden
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                <th className="text-left px-2 py-1.5">Ticker</th>
                <th className="text-left px-2 py-1.5">Name</th>
                <th className="text-center px-2 py-1.5">Signal</th>
                <th className="text-right px-2 py-1.5">Kurs</th>
                <th className="text-right px-2 py-1.5 hidden sm:table-cell">Entry</th>
                <th className="text-right px-2 py-1.5 hidden sm:table-cell">Target</th>
                <th className="text-center px-2 py-1.5 hidden md:table-cell">Bewertung</th>
                <th className="text-center px-2 py-1.5 hidden md:table-cell">Grade</th>
              </tr>
            </thead>
            <tbody>
              {/* Current stock highlighted */}
              {current && (
                <tr className="border-b border-accent/20 bg-accent/5">
                  <td className="px-2 py-1.5 font-mono-num font-bold text-accent">{current.ticker}</td>
                  <td className="px-2 py-1.5 text-bright truncate max-w-[150px]">{current.name}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[current.signal]}`}>
                      {current.signal}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-bright">{current.price}</td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-accent hidden sm:table-cell">{current.entry}</td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-up hidden sm:table-cell">{current.target}</td>
                  <td className="px-2 py-1.5 text-center hidden md:table-cell">
                    {current.valuation ? (
                      <span className={`text-[10px] font-semibold ${
                        current.valuation.verdict === "Unterbewertet" ? "text-up" :
                        current.valuation.verdict === "Überbewertet" ? "text-down" : "text-muted"
                      }`}>{current.valuation.verdict}</span>
                    ) : "–"}
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold hidden md:table-cell">{current.grade ?? "–"}</td>
                </tr>
              )}
              {/* Peers */}
              {peers.map((a) => (
                <tr key={a.ticker} className="border-b border-card-border/50 last:border-0 hover:bg-card-hover transition-colors">
                  <td className="px-2 py-1.5">
                    <Link href={`/stock/${a.ticker}`} className="font-mono-num font-bold text-accent hover:underline">
                      {a.ticker}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-sub truncate max-w-[150px]">{a.name}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SIGNAL_COLORS[a.signal]}`}>
                      {a.signal}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-bright">{a.price}</td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-accent hidden sm:table-cell">{a.entry}</td>
                  <td className="px-2 py-1.5 text-right font-mono-num text-up hidden sm:table-cell">{a.target}</td>
                  <td className="px-2 py-1.5 text-center hidden md:table-cell">
                    {a.valuation ? (
                      <span className={`text-[10px] font-semibold ${
                        a.valuation.verdict === "Unterbewertet" ? "text-up" :
                        a.valuation.verdict === "Überbewertet" ? "text-down" : "text-muted"
                      }`}>{a.valuation.verdict}</span>
                    ) : "–"}
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold hidden md:table-cell">
                    <span className={
                      a.grade?.startsWith("A") ? "text-up" :
                      a.grade?.startsWith("B") ? "text-accent" :
                      a.grade?.startsWith("C") ? "text-gold" : "text-down"
                    }>{a.grade ?? "–"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
