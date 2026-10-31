"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/NotificationProvider";

interface ScanAlert {
  ticker: string;
  name: string;
  signal: string;
  score: number;
  price: number;
  entry: number;
  target: number;
  stop: number;
  kellySize: number;
  scannedAt: string;
  isCrypto?: boolean;
}

interface ScannerResponse {
  buys: ScanAlert[];
  shorts: ScanAlert[];
  holds: ScanAlert[];
  totalScanned: number;
  scannedAt: string;
  fromCache: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SIGNAL_LABEL: Record<string, string> = {
  "STRONG BUY": "STRONG BUY",
  "BUY": "BUY",
  "SELL": "SHORT",
  "STRONG SELL": "STRONG SHORT",
};

const SIGNAL_CLASS: Record<string, string> = {
  "STRONG BUY": "text-up border-up/40 bg-up/10",
  "BUY": "text-up border-up/30 bg-up/5",
  "SELL": "text-down border-down/30 bg-down/5",
  "STRONG SELL": "text-down border-down/40 bg-down/10",
};

function playAlertSound(type: "buy" | "sell") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "buy") {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.setValueAtTime(350, ctx.currentTime + 0.1);
    }

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available
  }
}

const ALERTS_STORAGE_KEY = "traderadar-seen-alerts";

function getSeenAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markAlertsSeen(keys: string[]) {
  try {
    const existing = getSeenAlerts();
    for (const k of keys) existing.add(k);
    const arr = [...existing].slice(-200);
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore
  }
}

function alertKey(a: ScanAlert): string {
  return `${a.ticker}-${a.signal}-${a.scannedAt.slice(0, 13)}`;
}

export default function ScannerAlerts() {
  const { notify } = useNotifications();
  const [alerts, setAlerts] = useState<ScanAlert[]>([]);
  const [newAlerts, setNewAlerts] = useState<ScanAlert[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const hasPlayedRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scanner?mode=quick");
      if (!res.ok) return;
      const data: ScannerResponse = await res.json();

      const allPicks = [...data.buys, ...data.shorts];
      setAlerts(allPicks);
      setLastCheck(data.scannedAt);

      const seen = getSeenAlerts();
      const fresh = allPicks.filter((a) => !seen.has(alertKey(a)));

      if (fresh.length > 0) {
        setNewAlerts(fresh);
        setDismissed(false);

        const strongBuys = fresh.filter((a) => a.signal === "STRONG BUY");
        const strongShorts = fresh.filter((a) => a.signal === "STRONG SELL");

        if (!hasPlayedRef.current && (strongBuys.length > 0 || strongShorts.length > 0)) {
          hasPlayedRef.current = true;
          if (strongBuys.length > 0) {
            playAlertSound("buy");
            for (const a of strongBuys) {
              notify(
                `STRONG BUY: ${a.ticker}`,
                `Score +${a.score} | Entry ${fmt(a.entry)} € | Ziel ${fmt(a.target)} €`,
                { type: "success", url: `/stock/${a.ticker}` }
              );
            }
          }
          if (strongShorts.length > 0) {
            setTimeout(() => playAlertSound("sell"), 400);
            for (const a of strongShorts) {
              notify(
                `STRONG SHORT: ${a.ticker}`,
                `Score ${a.score} | Entry ${fmt(a.entry)} € | Ziel ${fmt(a.target)} €`,
                { type: "warning", url: `/stock/${a.ticker}` }
              );
            }
          }
        }

        markAlertsSeen(fresh.map(alertKey));
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    hasPlayedRef.current = false;
  }, [lastCheck]);

  const triggerDailyScan = useCallback(async () => {
    setScanRunning(true);
    try {
      await fetch("/api/scanner/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "daily" }),
      });
      await fetchAlerts();
    } catch {
      // Silent fail
    } finally {
      setScanRunning(false);
    }
  }, [fetchAlerts]);

  if (dismissed || newAlerts.length === 0) {
    if (alerts.length > 0) {
      const buyCount = alerts.filter((a) => a.signal.includes("BUY")).length;
      const shortCount = alerts.filter((a) => a.signal.includes("SELL")).length;
      return (
        <div className="flex items-center gap-3 text-[10px] text-muted flex-wrap">
          {loading && (
            <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-up" />
            {buyCount} Kauf
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-down" />
            {shortCount} Short
          </span>
          {lastCheck && (
            <span className="font-mono-num">
              Scan: {new Date(lastCheck).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={fetchAlerts} className="hover:text-accent transition-colors" title="Quick Scan">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={triggerDailyScan}
            disabled={scanRunning}
            className={`px-2 py-0.5 rounded border text-[10px] transition-colors ${
              scanRunning
                ? "border-accent/30 text-accent animate-pulse"
                : "border-card-border hover:border-accent hover:text-accent"
            }`}
            title="Tages-Scan — analysiert alle Aktien + ETFs und aktualisiert die Hot List"
          >
            {scanRunning ? "Scannt..." : "Tages-Scan"}
          </button>
        </div>
      );
    }
    return null;
  }

  const buyAlerts = newAlerts.filter((a) => a.signal.includes("BUY"));
  const shortAlerts = newAlerts.filter((a) => a.signal.includes("SELL"));

  return (
    <div className="space-y-2 animate-in">
      {buyAlerts.length > 0 && (
        <div className="bg-up/5 border border-up/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
              <span className="text-xs font-bold text-up">
                {buyAlerts.length} neue Kaufsignal{buyAlerts.length > 1 ? "e" : ""}
              </span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-[10px] text-muted hover:text-foreground transition-colors"
            >
              Ausblenden
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {buyAlerts.map((a) => (
              <Link
                key={a.ticker}
                href={`/stock/${a.ticker}`}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs transition-colors hover:bg-up/15 ${SIGNAL_CLASS[a.signal]}`}
              >
                <span className="font-mono-num font-bold">{a.ticker}</span>
                <span className="text-[10px] opacity-70 truncate max-w-[120px]">{a.name}</span>
                <span className="text-[10px] font-semibold border rounded px-1 py-0.5 border-current/30">
                  {SIGNAL_LABEL[a.signal]}
                </span>
                <span className="font-mono-num text-[10px]">{fmt(a.price)} €</span>
                <span className="font-mono-num text-[10px] opacity-70">Score +{a.score}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shortAlerts.length > 0 && (
        <div className="bg-down/5 border border-down/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-down animate-pulse" />
              <span className="text-xs font-bold text-down">
                {shortAlerts.length} neue Shortsignal{shortAlerts.length > 1 ? "e" : ""}
              </span>
            </div>
            {buyAlerts.length === 0 && (
              <button
                onClick={() => setDismissed(true)}
                className="text-[10px] text-muted hover:text-foreground transition-colors"
              >
                Ausblenden
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {shortAlerts.map((a) => (
              <Link
                key={a.ticker}
                href={`/stock/${a.ticker}`}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs transition-colors hover:bg-down/15 ${SIGNAL_CLASS[a.signal]}`}
              >
                <span className="font-mono-num font-bold">{a.ticker}</span>
                <span className="text-[10px] opacity-70 truncate max-w-[120px]">{a.name}</span>
                <span className="text-[10px] font-semibold border rounded px-1 py-0.5 border-current/30">
                  {SIGNAL_LABEL[a.signal]}
                </span>
                <span className="font-mono-num text-[10px]">{fmt(a.price)} €</span>
                <span className="font-mono-num text-[10px] opacity-70">Score {a.score}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
