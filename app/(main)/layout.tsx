import { loadTradingData } from "@/lib/data";
import { fetchQuote } from "@/lib/api/yahoo-finance";
import Header from "@/components/Header";
import TickerBar from "@/components/TickerBar";
import type { Index } from "@/lib/types";

/** Indices/ETFs tracked in the ticker bar — live from Yahoo Finance */
const TRACKED_INDICES = [
  { ticker: "^GSPC", label: "S&P 500", symbol: "SPX" },
  { ticker: "IWDA.AS", label: "MSCI World", symbol: "MSCI W" },
  { ticker: "SOXX", label: "Semiconductor", symbol: "SOXX" },
  { ticker: "VWRL.AS", label: "Vanguard FTSE AW", symbol: "VWRL" },
  { ticker: "EEM", label: "MSCI Emerging Markets", symbol: "MSCI EM" },
  { ticker: "EXSA.DE", label: "Core STOXX Europe 600", symbol: "SX600" },
];

async function fetchLiveIndices(): Promise<Index[]> {
  const results = await Promise.all(
    TRACKED_INDICES.map(async (idx) => {
      const quote = await fetchQuote(idx.ticker).catch(() => null);
      if (!quote) {
        return {
          name: idx.label,
          symbol: idx.symbol,
          value: "–",
          change: "–",
          direction: "up" as const,
        };
      }
      const direction = quote.changePercent >= 0 ? ("up" as const) : ("down" as const);
      const changeStr = `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`;
      const valueStr = quote.priceEur.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return {
        name: idx.label,
        symbol: idx.symbol,
        value: valueStr,
        change: changeStr,
        direction,
      };
    })
  );
  return results;
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadTradingData();
  const liveIndices = await fetchLiveIndices();

  const updated = new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header marketPhase={data.market_phase} updated={updated} />
      <TickerBar indices={liveIndices} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 page-enter">
        {children}
      </main>
      <footer className="border-t border-card-border py-4">
        <p className="text-xs text-muted text-center">
          {data.disclaimer}
        </p>
      </footer>
    </div>
  );
}
