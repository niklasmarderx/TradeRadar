import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActionByTicker, getOrFetchStockData, loadTradingData } from "@/lib/data";
import { PriceLevel } from "@/lib/types";
import { calculateIndicators } from "@/lib/indicators";
import { ChartContainer } from "@/components/charts";
import IndicatorPanel from "@/components/IndicatorPanel";
import AIAnalysis from "@/components/AIAnalysis";
import ShortTermTrading from "@/components/ShortTermTrading";
import WatchlistButton from "@/components/WatchlistButton";
import {
  StockHeader,
  AnalysisSection,
  TradingLevels,
  RelatedNews,
  TabContainer,
  FundamentalsPanel,
  ValuationPanel,
  PeersPanel,
  FinancialHealthPanel,
  MomentumPanel,
  InvestmentScorePanel,
  CatalystsPanel,
} from "@/components/stock-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const result = await getActionByTicker(ticker);
  if (!result) {
    return { title: `${ticker.toUpperCase()} — TradeRadar` };
  }
  const { action } = result;
  return {
    title: `${action.ticker} ${action.signal} — ${action.name} | TradeRadar`,
    description: action.reason,
  };
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  // Fetch both static and live data
  const [stockData, staticResult, tradingData] = await Promise.all([
    getOrFetchStockData(ticker),
    getActionByTicker(ticker),
    loadTradingData().catch(() => null),
  ]);

  if (!stockData && !staticResult) {
    notFound();
  }

  const action = staticResult?.action ?? stockData?.action;
  const relatedNews = staticResult?.relatedNews ?? stockData?.relatedNews ?? [];
  const allActions = tradingData?.actions ?? [];

  // Use live OHLCV data only — no static chart_data fallback
  const ohlcvData = stockData?.ohlcvData && stockData.ohlcvData.length > 0
    ? stockData.ohlcvData
    : [];

  // Calculate technical indicators (with highs/lows for ATR, ADX, Stochastic)
  const closes = ohlcvData.map((d) => d.close);
  const volumes = ohlcvData.map((d) => d.volume);
  const highs = ohlcvData.map((d) => d.high);
  const lows = ohlcvData.map((d) => d.low);
  const indicators = closes.length > 20 ? calculateIndicators(closes, volumes, highs, lows) : undefined;
  const currentPrice = stockData?.currentPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0);

  // Use composite score price levels if no static action, or static levels
  const priceLevels: PriceLevel[] = [];
  if (indicators?.compositeScore && !action?.entry_numeric) {
    const cs = indicators.compositeScore;
    priceLevels.push({ price: cs.suggestedEntry, label: "Entry", color: "#06b6d4" });
    priceLevels.push({ price: cs.suggestedTarget, label: "Target", color: "#22c55e" });
    priceLevels.push({ price: cs.suggestedStop, label: "Stop-Loss", color: "#ef4444" });
  } else {
    if (action?.entry_numeric != null) {
      priceLevels.push({ price: action.entry_numeric, label: "Entry", color: "#06b6d4" });
    }
    if (action?.target_numeric != null) {
      priceLevels.push({ price: action.target_numeric, label: "Target", color: "#22c55e" });
    }
    if (action?.stop_numeric != null) {
      priceLevels.push({ price: action.stop_numeric, label: "Stop-Loss", color: "#ef4444" });
    }
  }

  const displayName = stockData?.name ?? action?.name ?? ticker.toUpperCase();
  const tickerUpper = action?.ticker ?? ticker.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Watchlist */}
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-accent transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground font-mono-num">{tickerUpper}</span>
        </div>
        <WatchlistButton ticker={tickerUpper} name={displayName} />
      </nav>

      {action && <StockHeader action={action} />}

      {!action && (
        <div className="bg-card border border-card-border rounded-lg p-6">
          <h1 className="text-2xl font-bold font-mono-num text-bright">{ticker.toUpperCase()}</h1>
          <p className="text-sub mt-1">{displayName}</p>
          {stockData?.companyOverview && (
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-card-border text-muted">
                {stockData.companyOverview.sector}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-card-border text-muted">
                {stockData.companyOverview.industry}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Chart — always visible */}
      {ohlcvData.length > 0 && (
        <ChartContainer
          data={ohlcvData}
          priceLevels={priceLevels}
          indicators={indicators}
        />
      )}

      {/* Tab Layout */}
      <TabContainer
        tabs={[
          {
            id: "uebersicht",
            label: "Übersicht",
            content: (
              <div className="space-y-6">
                {/* Investment Score at the top */}
                <InvestmentScorePanel ticker={tickerUpper} />

                {/* Analysis + Trading Levels + Indicators grid */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {action && (
                    <div className="lg:col-span-2">
                      <AnalysisSection action={action} />
                    </div>
                  )}
                  {action && (
                    <div>
                      <TradingLevels action={action} />
                    </div>
                  )}
                  {indicators && (
                    <div>
                      <IndicatorPanel indicators={indicators} currentPrice={currentPrice} />
                    </div>
                  )}
                </div>

                {/* Short-Term Trading */}
                <ShortTermTrading ticker={tickerUpper} />

                {/* Catalysts */}
                <CatalystsPanel ticker={tickerUpper} />

                {/* Related News */}
                <RelatedNews news={relatedNews} />
              </div>
            ),
          },
          {
            id: "fundamentals",
            label: "Fundamentaldaten",
            content: (
              <div className="space-y-6">
                <FundamentalsPanel ticker={tickerUpper} />
                <FinancialHealthPanel ticker={tickerUpper} currentPrice={currentPrice} />
              </div>
            ),
          },
          {
            id: "bewertung",
            label: "Bewertung",
            content: <ValuationPanel ticker={tickerUpper} currentPrice={currentPrice} />,
          },
          {
            id: "momentum",
            label: "Momentum",
            content: <MomentumPanel ticker={tickerUpper} />,
          },
          {
            id: "ki",
            label: "KI-Analyse",
            content: <AIAnalysis ticker={tickerUpper} />,
          },
          {
            id: "peers",
            label: "Peer-Vergleich",
            content: <PeersPanel currentTicker={tickerUpper} actions={allActions} />,
          },
        ]}
      />
    </div>
  );
}
