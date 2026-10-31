"use client";

import { useState, useEffect } from "react";
import type {
  YahooExtendedData,
  UpgradeDowngradeEntry,
} from "@/lib/api/yahoo-finance";

interface Props {
  ticker: string;
}

interface FundamentalsResponse {
  extended: YahooExtendedData | null;
}

export default function CatalystsPanel({ ticker }: Props) {
  const [data, setData] = useState<FundamentalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stock/${encodeURIComponent(ticker)}/fundamentals`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-card-border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-card-border/50 rounded w-1/4 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-card-border/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const ext = data?.extended;
  if (!ext) return null;

  const hasEarnings = ext.calendarEvents.earningsDate != null;
  const hasDividend = ext.calendarEvents.exDividendDate != null;
  const hasUpgrades = ext.upgradeDowngradeHistory.length > 0;

  if (!hasEarnings && !hasDividend && !hasUpgrades) return null;

  const earningsDays = hasEarnings
    ? Math.ceil((new Date(ext.calendarEvents.earningsDate!).getTime() - Date.now()) / 86_400_000)
    : null;

  // Group recent upgrades as catalysts (last 90 days)
  const recentActions = ext.upgradeDowngradeHistory
    .filter((u: UpgradeDowngradeEntry) => {
      const d = new Date(u.date);
      return Date.now() - d.getTime() < 90 * 86_400_000;
    })
    .slice(0, 5);

  return (
    <div className="bg-card border border-card-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-bright uppercase tracking-wider mb-3">Katalysatoren</h3>
      <div className="space-y-3">
        {/* Earnings Countdown */}
        {hasEarnings && (
          <div className={`flex items-center gap-3 p-3 rounded border ${
            earningsDays != null && earningsDays >= 0 && earningsDays <= 14
              ? "bg-gold/5 border-gold/20"
              : "bg-background border-card-border/50"
          }`}>
            <div className="text-xl">
              {earningsDays != null && earningsDays >= 0 && earningsDays <= 14 ? "\u26A0" : "\uD83D\uDCC5"}
            </div>
            <div>
              <div className="text-xs text-bright font-semibold">Earnings Report</div>
              <div className="text-[10px] text-muted">
                {ext.calendarEvents.earningsDate} —{" "}
                {earningsDays != null && earningsDays > 0
                  ? `in ${earningsDays} Tagen`
                  : earningsDays === 0
                  ? "Heute"
                  : "Vergangen"}
              </div>
            </div>
            {earningsDays != null && earningsDays >= 0 && earningsDays <= 14 && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">
                Bald
              </span>
            )}
          </div>
        )}

        {/* Ex-Dividend */}
        {hasDividend && (
          <div className="flex items-center gap-3 p-3 rounded border bg-background border-card-border/50">
            <div className="text-xl">{"\uD83D\uDCB0"}</div>
            <div>
              <div className="text-xs text-bright font-semibold">Ex-Dividende</div>
              <div className="text-[10px] text-muted">{ext.calendarEvents.exDividendDate}</div>
            </div>
          </div>
        )}

        {/* Recent Analyst Actions */}
        {recentActions.length > 0 && (
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Aktuelle Analysten-Aktionen</div>
            {recentActions.map((u: UpgradeDowngradeEntry, i: number) => (
              <div key={i} className={`flex items-center gap-2 py-1.5 text-xs ${
                i < recentActions.length - 1 ? "border-b border-card-border/30" : ""
              }`}>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  u.action === "upgrade" ? "bg-up/10 text-up border-up/30" :
                  u.action === "downgrade" ? "bg-down/10 text-down border-down/30" :
                  u.action === "init" ? "bg-accent/10 text-accent border-accent/30" :
                  "bg-muted/10 text-muted border-muted/30"
                }`}>{u.action}</span>
                <span className="text-sub">{u.firm}</span>
                {u.toGrade && (
                  <span className="text-[10px] text-muted ml-auto">{u.fromGrade ? `${u.fromGrade} → ` : ""}{u.toGrade}</span>
                )}
                <span className="text-[10px] text-muted">{u.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
