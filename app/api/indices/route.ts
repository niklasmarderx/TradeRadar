import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/api/yahoo-finance";

/** Indices/ETFs to track in the ticker bar */
const TRACKED_INDICES = [
  { ticker: "^GSPC", label: "S&P 500", symbol: "SPX" },
  { ticker: "IWDA.AS", label: "MSCI World", symbol: "MSCI W" },
  { ticker: "SOXX", label: "Semiconductor", symbol: "SOXX" },
  { ticker: "VWRL.AS", label: "Vanguard FTSE AW", symbol: "VWRL" },
  { ticker: "EEM", label: "MSCI Emerging Markets", symbol: "MSCI EM" },
  { ticker: "EXSA.DE", label: "Core STOXX Europe 600", symbol: "SX600" },
];

export async function GET() {
  try {
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
        const direction = quote.changePercent >= 0 ? "up" as const : "down" as const;
        const changeStr = `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`;
        // Use EUR price for display
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

    return NextResponse.json(results, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
