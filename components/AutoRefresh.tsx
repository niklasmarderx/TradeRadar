"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useNotifications } from "@/components/NotificationProvider";

interface AutoRefreshProps {
  tickers: string[];
  intervalMinutes?: number;
}

interface ScoreSnapshot {
  ticker: string;
  signal: string;
  score: number;
}

export default function AutoRefresh({ tickers, intervalMinutes = 60 }: AutoRefreshProps) {
  const { notify } = useNotifications();
  const [enabled, setEnabled] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const prevScores = useRef<Map<string, ScoreSnapshot>>(new Map());
  const timerRef = useRef<ReturnType<typeof globalThis.setInterval>>(undefined);

  const isActiveHours = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 10 && hour < 22;
  }, []);

  const checkSignals = useCallback(async () => {
    if (!isActiveHours() || document.hidden) return;

    for (const ticker of tickers) {
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        if (!res.ok) continue;
        const data = await res.json();

        const newSignal = data.indicators?.compositeScore?.signal;
        const newScore = data.indicators?.compositeScore?.score;
        if (!newSignal || newScore === undefined) continue;

        const prev = prevScores.current.get(ticker);
        if (prev && prev.signal !== newSignal) {
          notify(`${ticker}: Signal-Aenderung`, `${prev.signal} → ${newSignal} (Score: ${newScore > 0 ? "+" : ""}${newScore})`, {
            type: newSignal.includes("BUY") ? "success" : newSignal.includes("SELL") ? "warning" : "info",
            url: `/stock/${ticker}`,
          });
        }

        prevScores.current.set(ticker, { ticker, signal: newSignal, score: newScore });
      } catch {
        // Skip failed tickers
      }
    }
  }, [tickers, notify, isActiveHours]);

  useEffect(() => {
    if (!enabled || tickers.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = intervalMinutes * 60;
    setCountdown(intervalMs);

    // Initial check to populate previous scores
    checkSignals();

    timerRef.current = globalThis.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          checkSignals();
          return intervalMs;
        }
        return prev - 1;
      });
    }, 1000);

    // Pause on tab hidden
    const handleVisibility = () => {
      if (document.hidden && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      } else if (!document.hidden && enabled) {
        setCountdown(intervalMs);
        timerRef.current = globalThis.setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              checkSignals();
              return intervalMs;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, tickers, intervalMinutes, checkSignals]);

  if (tickers.length === 0) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted">
      <button
        onClick={() => setEnabled(!enabled)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
          enabled ? "text-up" : "text-muted hover:text-foreground"
        }`}
        title={enabled ? "Auto-Refresh aktiv (10-22 Uhr)" : "Auto-Refresh deaktiviert"}
      >
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      {enabled && isActiveHours() && (
        <span className="font-mono-num">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      )}
      {enabled && !isActiveHours() && <span>Pausiert (10-22 Uhr)</span>}
    </div>
  );
}
