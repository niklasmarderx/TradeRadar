"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/components/NotificationProvider";

export default function NotificationSettings() {
  const { permissionGranted, requestPermission } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-1.5 rounded transition-colors ${
          permissionGranted ? "text-accent hover:bg-accent/10" : "text-muted hover:text-foreground"
        }`}
        title="Benachrichtigungen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {permissionGranted && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-up" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-card border border-card-border rounded-lg shadow-lg p-3 space-y-3">
            <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
              Benachrichtigungen
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Browser-Push</span>
                {permissionGranted ? (
                  <span className="text-[10px] text-up">Aktiv</span>
                ) : (
                  <button
                    onClick={requestPermission}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Aktivieren
                  </button>
                )}
              </div>
              <p className="text-[9px] text-muted leading-relaxed">
                Signal-Aenderungen werden als Browser-Benachrichtigung angezeigt (10-22 Uhr).
              </p>
            </div>

            <div className="border-t border-card-border pt-2">
              <p className="text-[9px] text-muted leading-relaxed">
                Auto-Refresh prueft stuendlich deine Watchlist-Aktien auf Signal-Aenderungen.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
