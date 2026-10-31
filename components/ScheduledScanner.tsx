"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useNotifications } from "@/components/NotificationProvider";

/**
 * Scheduled scanner that triggers daily picks scans at strategic times:
 *   - 08:00  Morning scan (EU pre-market)
 *   - 15:00  Pre-US-open scan (US market opens 15:30 CET)
 *   - 20:00  Evening scan (after-hours analysis)
 *
 * Also runs a quick signal check every 30min during market hours (9-22).
 */

const FULL_SCAN_HOURS = [8, 15, 20];
const SIGNAL_CHECK_INTERVAL = 30 * 60 * 1000; // 30 min

interface ScanStatus {
  lastFullScan: string | null;
  lastQuickCheck: string | null;
  nextFullScan: string | null;
  isRunning: boolean;
  mode: "daily" | "quick" | "idle";
}

function getNextFullScanTime(): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const hour of FULL_SCAN_HOURS) {
    const scanTime = new Date(today.getTime() + hour * 60 * 60 * 1000);
    if (scanTime > now) return scanTime;
  }

  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return new Date(tomorrow.getTime() + FULL_SCAN_HOURS[0] * 60 * 60 * 1000);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "jetzt";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function ScheduledScanner() {
  const { notify } = useNotifications();
  const [status, setStatus] = useState<ScanStatus>({
    lastFullScan: null,
    lastQuickCheck: null,
    nextFullScan: formatTime(getNextFullScanTime()),
    isRunning: false,
    mode: "idle",
  });
  const [countdown, setCountdown] = useState("");
  const fullScanDoneToday = useRef<Set<number>>(new Set());
  const prevSignals = useRef<Map<string, string>>(new Map());

  const runDailyScan = useCallback(async () => {
    setStatus((s) => ({ ...s, isRunning: true, mode: "daily" }));
    try {
      const res = await fetch("/api/scanner/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "daily" }),
      });
      if (res.ok) {
        const data = await res.json();
        const dur = data.durationSeconds ? ` in ${Math.floor(data.durationSeconds / 60)}min ${data.durationSeconds % 60}s` : "";
        const cl = data.changelog?.summary ?? "";
        setStatus((s) => ({
          ...s,
          lastFullScan: formatTime(new Date()),
          nextFullScan: formatTime(getNextFullScanTime()),
          isRunning: false,
          mode: "idle",
        }));
        notify(
          "Tages-Scan abgeschlossen",
          `${data.totalScanned} Aktien analysiert${dur} — ${data.picksCount} Picks${cl ? ` (${cl})` : ""}`,
          { type: "info" }
        );
      } else {
        setStatus((s) => ({ ...s, isRunning: false, mode: "idle" }));
      }
    } catch {
      setStatus((s) => ({ ...s, isRunning: false, mode: "idle" }));
    }
  }, [notify]);

  const runQuickCheck = useCallback(async () => {
    if (document.hidden) return;
    const hour = new Date().getHours();
    if (hour < 9 || hour >= 22) return;

    setStatus((s) => ({ ...s, isRunning: true, mode: "quick" }));
    try {
      const res = await fetch("/api/scanner?mode=quick");
      if (!res.ok) return;
      const data = await res.json();

      const allPicks = [...(data.buys ?? []), ...(data.shorts ?? [])];

      for (const pick of allPicks) {
        const prev = prevSignals.current.get(pick.ticker);
        if (prev && prev !== pick.signal) {
          const isBuy = pick.signal.includes("BUY");
          const isShort = pick.signal.includes("SELL");
          notify(
            `${pick.ticker}: ${pick.name}`,
            `Signal: ${prev} → ${pick.signal} | ${pick.price?.toFixed(2)} €`,
            {
              type: isBuy ? "success" : isShort ? "warning" : "info",
              url: `/stock/${pick.ticker}`,
            }
          );
        }
        prevSignals.current.set(pick.ticker, pick.signal);
      }

      setStatus((s) => ({
        ...s,
        lastQuickCheck: formatTime(new Date()),
        isRunning: false,
        mode: "idle",
      }));
    } catch {
      setStatus((s) => ({ ...s, isRunning: false, mode: "idle" }));
    }
  }, [notify]);

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();

      if (FULL_SCAN_HOURS.includes(hour) && min < 5 && !fullScanDoneToday.current.has(hour)) {
        fullScanDoneToday.current.add(hour);
        runDailyScan();
      }

      if (hour === 0 && min < 2) {
        fullScanDoneToday.current.clear();
      }

      const next = getNextFullScanTime();
      const diff = next.getTime() - Date.now();
      setCountdown(formatCountdown(diff));
    };

    checkSchedule();
    const scheduleInterval = setInterval(checkSchedule, 60 * 1000);
    const quickInterval = setInterval(runQuickCheck, SIGNAL_CHECK_INTERVAL);
    runQuickCheck();

    return () => {
      clearInterval(scheduleInterval);
      clearInterval(quickInterval);
    };
  }, [runDailyScan, runQuickCheck]);

  return (
    <div className="flex items-center gap-3 text-[10px] text-muted flex-wrap">
      <div className="flex items-center gap-1">
        {status.isRunning ? (
          <>
            <div className="w-2 h-2 border border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-accent">
              {status.mode === "daily" ? "Tages-Scan..." : "Quick Check..."}
            </span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-up" />
            <span>Scanner aktiv</span>
          </>
        )}
      </div>

      <span className="font-mono-num">
        Naechster: {status.nextFullScan} ({countdown})
      </span>

      <span className="hidden md:inline opacity-60">
        Scans: {FULL_SCAN_HOURS.map((h) => `${h}:00`).join(", ")}
      </span>

      {status.lastFullScan && (
        <span className="hidden md:inline opacity-60">
          Letzter: {status.lastFullScan}
        </span>
      )}

      <button
        onClick={runDailyScan}
        disabled={status.isRunning}
        className={`px-2 py-0.5 rounded border text-[10px] transition-colors ${
          status.isRunning && status.mode === "daily"
            ? "border-accent/30 text-accent animate-pulse"
            : "border-card-border hover:border-accent hover:text-accent disabled:opacity-50"
        }`}
        title="Tages-Scan starten — analysiert alle Aktien + ETFs und aktualisiert die Hot List"
      >
        Tages-Scan
      </button>
    </div>
  );
}
