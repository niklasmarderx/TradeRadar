"use client";

import { useState, useEffect } from "react";
import type { YahooFundamentals, YahooExtendedData } from "@/lib/api/yahoo-finance";

interface Props {
  ticker: string;
}

interface FundamentalsResponse {
  fundamentals: YahooFundamentals;
  extended: YahooExtendedData | null;
}

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "–";
  return v.toFixed(2) + suffix;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "–";
  return (v * 100).toFixed(1) + "%";
}

function fmtLarge(v: number | null | undefined): string {
  if (v == null) return "–";
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + " T";
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + " Mrd";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + " Mio";
  return v.toLocaleString("de-DE");
}

export default function FundamentalsPanel({ ticker }: Props) {
  const [data, setData] = useState<FundamentalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/stock/${encodeURIComponent(ticker)}/fundamentals`)
      .then((r) => {
        if (!r.ok) throw new Error("Keine Daten");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-card-border/50 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-card-border/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 text-center text-muted text-sm">
        Fundamentaldaten nicht verfuegbar.
      </div>
    );
  }

  const f = data.fundamentals;
  const ext = data.extended;

  const metrics = [
    { label: "KGV (trailing)", value: fmt(f.peRatio) },
    { label: "Forward KGV", value: fmt(f.forwardPE) },
    { label: "PEG Ratio", value: fmt(f.pegRatio) },
    { label: "ROE", value: fmtPct(f.returnOnEquity) },
    { label: "Gewinnmarge", value: fmtPct(f.profitMargin) },
    { label: "Op. Marge", value: fmtPct(f.operatingMargin) },
    { label: "Debt/Equity", value: fmt(f.debtToEquity) },
    { label: "Dividende", value: f.dividendYield != null ? (f.dividendYield * 100).toFixed(2) + "%" : "–" },
    { label: "Payout Ratio", value: fmtPct(f.payoutRatio) },
    { label: "Umsatzwachstum", value: fmtPct(f.revenueGrowth) },
    { label: "Gewinnwachstum", value: fmtPct(f.earningsGrowth) },
    { label: "Marktkapitalisierung", value: fmtLarge(f.marketCap) },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Kennzahlen</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-background rounded px-3 py-2">
              <div className="text-[10px] text-muted">{m.label}</div>
              <div className="text-sm font-mono-num text-bright mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Analyst Consensus */}
      {f.recommendationKey && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Analysten-Konsens</h3>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-bold uppercase px-2 py-1 rounded ${
              f.recommendationKey === "buy" || f.recommendationKey === "strong_buy"
                ? "bg-up/15 text-up"
                : f.recommendationKey === "sell" || f.recommendationKey === "strong_sell"
                ? "bg-down/15 text-down"
                : "bg-muted/15 text-muted"
            }`}>
              {f.recommendationKey.replace("_", " ")}
            </span>
            <span className="text-xs text-muted">{f.numberOfAnalysts} Analysten</span>
            {f.targetMeanPrice != null && (
              <span className="text-xs font-mono-num text-sub">Kursziel: {f.targetMeanPrice.toFixed(2)}</span>
            )}
          </div>
        </div>
      )}

      {/* Earnings History */}
      {ext && ext.earningsHistory.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Earnings History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border text-[10px] text-muted uppercase tracking-wider">
                  <th className="text-left px-2 py-1.5">Quartal</th>
                  <th className="text-right px-2 py-1.5">EPS Erwartet</th>
                  <th className="text-right px-2 py-1.5">EPS Tatsächlich</th>
                  <th className="text-right px-2 py-1.5">Überraschung</th>
                  <th className="text-center px-2 py-1.5">Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {ext.earningsHistory.map((e, i) => {
                  const beat = e.epsActual != null && e.epsEstimate != null && e.epsActual >= e.epsEstimate;
                  return (
                    <tr key={i} className="border-b border-card-border/50 last:border-0">
                      <td className="px-2 py-1.5 font-mono-num text-sub">{e.quarter}</td>
                      <td className="px-2 py-1.5 text-right font-mono-num text-muted">{fmt(e.epsEstimate)}</td>
                      <td className="px-2 py-1.5 text-right font-mono-num text-bright">{fmt(e.epsActual)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono-num ${
                        e.surprisePercent != null && e.surprisePercent > 0 ? "text-up" : e.surprisePercent != null && e.surprisePercent < 0 ? "text-down" : "text-muted"
                      }`}>
                        {e.surprisePercent != null ? (e.surprisePercent > 0 ? "+" : "") + e.surprisePercent.toFixed(1) + "%" : "–"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {e.epsActual != null && e.epsEstimate != null ? (
                          <span className={beat ? "text-up" : "text-down"}>{beat ? "Beat" : "Miss"}</span>
                        ) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EPS Revision Trend */}
      {ext && ext.earningsTrend.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">EPS Revision Trend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ext.earningsTrend.map((t, i) => (
              <div key={i} className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted mb-1">{t.period}</div>
                {t.growth != null && (
                  <div className={`text-xs font-mono-num ${t.growth >= 0 ? "text-up" : "text-down"}`}>
                    Wachstum: {(t.growth * 100).toFixed(1)}%
                  </div>
                )}
                <div className="flex gap-2 mt-1 text-[10px]">
                  <span className="text-up">{t.epsRevisions.upLast30} up</span>
                  <span className="text-down">{t.epsRevisions.downLast30} down</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation Trend */}
      {ext && ext.recommendationTrend.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Analysten-Trend</h3>
          <div className="space-y-2">
            {ext.recommendationTrend.map((r, i) => {
              const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
              if (total === 0) return null;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                    <span>{r.period}</span>
                    <span>{total} Analysten</span>
                  </div>
                  <div className="flex h-4 rounded overflow-hidden text-[9px] font-mono-num">
                    {r.strongBuy > 0 && (
                      <div className="bg-up flex items-center justify-center text-background" style={{ width: `${(r.strongBuy / total) * 100}%` }}>
                        {r.strongBuy}
                      </div>
                    )}
                    {r.buy > 0 && (
                      <div className="bg-up/60 flex items-center justify-center text-background" style={{ width: `${(r.buy / total) * 100}%` }}>
                        {r.buy}
                      </div>
                    )}
                    {r.hold > 0 && (
                      <div className="bg-muted/40 flex items-center justify-center text-foreground" style={{ width: `${(r.hold / total) * 100}%` }}>
                        {r.hold}
                      </div>
                    )}
                    {r.sell > 0 && (
                      <div className="bg-down/60 flex items-center justify-center text-background" style={{ width: `${(r.sell / total) * 100}%` }}>
                        {r.sell}
                      </div>
                    )}
                    {r.strongSell > 0 && (
                      <div className="bg-down flex items-center justify-center text-background" style={{ width: `${(r.strongSell / total) * 100}%` }}>
                        {r.strongSell}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 text-[9px] text-muted mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-up inline-block" /> Strong Buy</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-up/60 inline-block" /> Buy</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted/40 inline-block" /> Hold</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-down/60 inline-block" /> Sell</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-down inline-block" /> Strong Sell</span>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade/Downgrade History */}
      {ext && ext.upgradeDowngradeHistory.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Analysten-Aktionen</h3>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {ext.upgradeDowngradeHistory.slice(0, 15).map((u, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono-num text-muted text-[10px] w-20 shrink-0">{u.date}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  u.action === "upgrade" ? "bg-up/10 text-up border-up/30" :
                  u.action === "downgrade" ? "bg-down/10 text-down border-down/30" :
                  u.action === "init" ? "bg-accent/10 text-accent border-accent/30" :
                  "bg-muted/10 text-muted border-muted/30"
                }`}>
                  {u.action}
                </span>
                <span className="text-sub truncate">{u.firm}</span>
                {u.fromGrade && u.toGrade && (
                  <span className="text-[10px] text-muted shrink-0">{u.fromGrade} → {u.toGrade}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Events */}
      {ext && (ext.calendarEvents.earningsDate || ext.calendarEvents.exDividendDate) && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Kalender</h3>
          <div className="flex flex-wrap gap-4">
            {ext.calendarEvents.earningsDate && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">Nächste Earnings</div>
                <div className="text-sm font-mono-num text-bright mt-0.5">{ext.calendarEvents.earningsDate}</div>
                <div className="text-[10px] text-accent mt-0.5">
                  {(() => {
                    const d = Math.ceil((new Date(ext.calendarEvents.earningsDate!).getTime() - Date.now()) / 86_400_000);
                    return d > 0 ? `in ${d} Tagen` : d === 0 ? "Heute" : "Vergangen";
                  })()}
                </div>
              </div>
            )}
            {ext.calendarEvents.exDividendDate && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">Ex-Dividende</div>
                <div className="text-sm font-mono-num text-bright mt-0.5">{ext.calendarEvents.exDividendDate}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Balance Sheet Snapshot */}
      {(f.totalCash != null || f.totalDebt != null || f.ebitda != null) && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Bilanz-Überblick</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {f.totalCash != null && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">Cash</div>
                <div className="text-sm font-mono-num text-up mt-0.5">{fmtLarge(f.totalCash)}</div>
              </div>
            )}
            {f.totalDebt != null && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">Schulden</div>
                <div className="text-sm font-mono-num text-down mt-0.5">{fmtLarge(f.totalDebt)}</div>
              </div>
            )}
            {f.freeCashflow != null && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">Free Cashflow</div>
                <div className={`text-sm font-mono-num mt-0.5 ${f.freeCashflow >= 0 ? "text-up" : "text-down"}`}>{fmtLarge(f.freeCashflow)}</div>
              </div>
            )}
            {f.ebitda != null && (
              <div className="bg-background rounded px-3 py-2">
                <div className="text-[10px] text-muted">EBITDA</div>
                <div className="text-sm font-mono-num text-bright mt-0.5">{fmtLarge(f.ebitda)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
