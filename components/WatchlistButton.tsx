"use client";

import { useState, useEffect } from "react";
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/watchlist";

interface WatchlistButtonProps {
  ticker: string;
  name: string;
}

export default function WatchlistButton({ ticker, name }: WatchlistButtonProps) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(isInWatchlist(ticker));
  }, [ticker]);

  const toggle = () => {
    if (inList) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker, name);
    }
    setInList(!inList);
  };

  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded transition-colors ${
        inList
          ? "text-gold hover:text-gold/80"
          : "text-muted hover:text-gold"
      }`}
      aria-label={inList ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufuegen"}
      title={inList ? "Aus Watchlist entfernen" : "Zur Watchlist hinzufuegen"}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={inList ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </button>
  );
}
