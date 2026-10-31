"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWatchlist, removeFromWatchlist, type WatchlistItem } from "@/lib/watchlist";

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    setItems(getWatchlist());
  }, []);

  const handleRemove = (ticker: string) => {
    removeFromWatchlist(ticker);
    setItems(getWatchlist());
  };

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="section-header text-xs font-semibold uppercase tracking-widest text-sub mb-3">
        Watchlist
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.ticker}
            className="flex items-center gap-2 bg-card border border-card-border rounded-lg px-3 py-1.5 card-interactive group"
          >
            <Link
              href={`/stock/${item.ticker}`}
              className="flex items-center gap-2 hover:text-accent transition-colors"
            >
              <span className="font-mono-num text-xs font-bold text-accent">
                {item.ticker}
              </span>
              <span className="text-[10px] text-sub">{item.name}</span>
            </Link>
            <button
              onClick={() => handleRemove(item.ticker)}
              className="text-muted hover:text-down transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`${item.ticker} entfernen`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
