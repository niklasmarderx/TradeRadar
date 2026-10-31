import { Crypto } from "@/lib/types";
import { SparklineChart } from "@/components/charts";

export default function CryptoPanel({ crypto }: { crypto: Crypto[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
        Krypto
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {crypto.map((c) => {
          const color = c.direction === "up" ? "text-up" : "text-down";
          const arrow = c.direction === "up" ? "\u25B2" : "\u25BC";
          return (
            <div
              key={c.symbol}
              className="rounded-lg bg-card border border-card-border p-3 card-interactive"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted font-semibold">
                  {c.symbol}
                </span>
                <span className={`font-mono-num text-xs ${color}`}>
                  {arrow} {c.change_24h}
                </span>
              </div>
              <span className="font-mono-num text-base font-semibold">
                {c.price_eur}
              </span>
              <p className="text-xs text-muted mt-0.5">{c.name}</p>
              {c.sparkline && c.sparkline.length > 1 && (
                <div className="mt-2">
                  <SparklineChart
                    data={c.sparkline}
                    width={140}
                    height={24}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
