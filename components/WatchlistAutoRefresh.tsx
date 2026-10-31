"use client";

import { useState, useEffect } from "react";
import { getWatchlist } from "@/lib/watchlist";
import AutoRefresh from "@/components/AutoRefresh";

export default function WatchlistAutoRefresh() {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    setTickers(getWatchlist().map((w) => w.ticker));
  }, []);

  if (tickers.length === 0) return null;

  return <AutoRefresh tickers={tickers} intervalMinutes={60} />;
}
