import { notFound } from "next/navigation";
import Link from "next/link";
import { getListById } from "@/lib/curated-lists";
import { scanResultToAction } from "@/lib/scan-helpers";
import { getCached } from "@/lib/cache";
import { scanQuick, type ScanResult } from "@/lib/scanner";
import { fetchQuote } from "@/lib/api/yahoo-finance";
import type { Action } from "@/lib/types";
import Screener from "@/components/Screener";

interface ListDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ListDetailPageProps) {
  const { id } = await params;
  const list = getListById(id);
  if (!list) return { title: "Liste nicht gefunden — TradeRadar" };
  return {
    title: `${list.name} — TradeRadar`,
    description: list.description,
  };
}

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const { id } = await params;
  const list = getListById(id);
  if (!list) notFound();

  // Load scanner cache and filter to this list's tickers
  const allResults =
    (await getCached<ScanResult[]>("scanner-latest", 2 * 60 * 60 * 1000)) ??
    (await getCached<{ buys: ScanResult[]; shorts: ScanResult[]; holds: ScanResult[] }>(
      "scanner-top-picks",
      2 * 60 * 60 * 1000
    ).then((p) => (p ? [...p.buys, ...p.shorts, ...p.holds] : null))) ??
    [];

  const tickerSet = new Set(list.tickers.map((t) => t.toUpperCase()));
  const matchedResults = allResults.filter((r) => tickerSet.has(r.ticker.toUpperCase()));
  const matchedTickers = new Set(matchedResults.map((r) => r.ticker.toUpperCase()));

  // For tickers not in scanner cache, create minimal actions from live quotes
  const missingTickers = list.tickers.filter((t) => !matchedTickers.has(t.toUpperCase()));
  const fallbackActions: Action[] = [];

  if (missingTickers.length > 0) {
    const quotes = await Promise.all(
      missingTickers.map((t) => fetchQuote(t).catch(() => null))
    );

    for (let i = 0; i < missingTickers.length; i++) {
      const q = quotes[i];
      const ticker = missingTickers[i];
      const fmt = (n: number) =>
        n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      fallbackActions.push({
        ticker,
        name: q?.shortName ?? ticker,
        price: q ? `${fmt(q.priceEur)} €` : "–",
        price_numeric: q?.priceEur ?? 0,
        signal: "HOLD",
        confidence: "niedrig",
        strategy: "Relative Strength",
        reason: "Keine Scanner-Daten verfügbar. Führe einen Scan durch für vollständige Analyse.",
        entry: "–",
        target: "–",
        stop: "–",
        timeframe: "–",
        catalyst: "–",
        sparkline: [],
        chart_data: [],
      });
    }
  }

  const actions = [...matchedResults.map(scanResultToAction), ...fallbackActions];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted">
        <Link href="/lists" className="hover:text-accent transition-colors">
          Listen
        </Link>
        <span>/</span>
        <span className="text-foreground">{list.name}</span>
      </nav>

      {/* List header */}
      <div className="bg-card border border-card-border rounded-lg p-4">
        <h1 className="text-lg font-bold text-bright">{list.name}</h1>
        <p className="text-sm text-sub mt-1">{list.description}</p>
        <p className="text-xs text-muted mt-2">
          {list.tickers.length} Aktien — {matchedResults.length} mit Scanner-Daten
        </p>
      </div>

      <Screener actions={actions} />
    </div>
  );
}
