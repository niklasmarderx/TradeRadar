"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LiveCrypto {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const CRYPTO_TICKERS = [
  { ticker: "BTC-USD", name: "Bitcoin" },
  { ticker: "ETH-USD", name: "Ethereum" },
  { ticker: "SOL-USD", name: "Solana" },
  { ticker: "BNB-USD", name: "BNB" },
  { ticker: "XRP-USD", name: "XRP" },
  { ticker: "ADA-USD", name: "Cardano" },
  { ticker: "DOGE-USD", name: "Dogecoin" },
  { ticker: "AVAX-USD", name: "Avalanche" },
];

const fmt = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LiveCryptoPanel() {
  const [cryptos, setCryptos] = useState<LiveCrypto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCrypto() {
      setLoading(true);
      const results = await Promise.all(
        CRYPTO_TICKERS.map(async ({ ticker, name }) => {
          try {
            const res = await fetch(`/api/stock/${ticker}`);
            if (!res.ok) return null;
            const data = await res.json();
            return {
              ticker,
              name,
              price: data.currentPrice as number,
              change: 0,
              changePercent: 0,
            };
          } catch {
            return null;
          }
        })
      );
      setCryptos(results.filter((r): r is LiveCrypto => r !== null));
      setLoading(false);
    }
    fetchCrypto();
    // Refresh every 5 min
    const interval = setInterval(fetchCrypto, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && cryptos.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
          Krypto
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-lg bg-card border border-card-border p-3 animate-pulse">
              <div className="h-3 bg-card-border rounded w-12 mb-2" />
              <div className="h-5 bg-card-border rounded w-20" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
        Krypto
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cryptos.map((c) => {
          const displayTicker = c.ticker.replace("-USD", "");
          return (
            <Link
              key={c.ticker}
              href={`/stock/${c.ticker}`}
              className="rounded-lg bg-card border border-card-border p-3 card-interactive block"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted font-semibold font-mono-num">
                  {displayTicker}
                </span>
              </div>
              <span className="font-mono-num text-base font-semibold text-bright">
                {fmt(c.price)} €
              </span>
              <p className="text-[10px] text-sub mt-0.5">{c.name}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
