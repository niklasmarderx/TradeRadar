import Link from "next/link";
import { NewsItem } from "@/lib/types";

function ImpactTag({ impact }: { impact: NewsItem["impact"] }) {
  const styles: Record<string, string> = {
    bullish: "bg-up/10 text-up",
    bearish: "bg-down/10 text-down",
    neutral: "bg-muted/10 text-sub",
  };
  const labels: Record<string, string> = {
    bullish: "BULL",
    bearish: "BEAR",
    neutral: "NEUTRAL",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded ${styles[impact]}`}
    >
      {labels[impact]}
    </span>
  );
}

function TickerLinks({ affected }: { affected: string }) {
  const tickers = affected.split(",").map((t) => t.trim());
  return (
    <span className="inline-flex gap-1.5 flex-wrap">
      {tickers.map((ticker) => (
        <Link
          key={ticker}
          href={`/stock/${ticker}`}
          className="text-accent hover:text-bright transition-colors font-mono-num px-1.5 py-0.5 rounded bg-accent/5 hover:bg-accent/15 border border-accent/20"
        >
          {ticker}
        </Link>
      ))}
    </span>
  );
}

export default function NewsFeed({ news }: { news: NewsItem[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
        Nachrichten
      </h2>
      <div className="space-y-2">
        {news.map((item, i) => {
          const primaryTicker = item.affected.split(",")[0]?.trim();
          return (
            <div
              key={i}
              className="rounded-lg bg-card border border-card-border p-3 flex flex-col gap-1.5"
            >
              <div className="flex items-start gap-2">
                <ImpactTag impact={item.impact} />
                {primaryTicker ? (
                  <Link
                    href={`/stock/${primaryTicker}`}
                    className="text-sm leading-snug flex-1 hover:text-accent transition-colors cursor-pointer"
                  >
                    {item.headline}
                  </Link>
                ) : (
                  <p className="text-sm leading-snug flex-1">{item.headline}</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{item.source}</span>
                <TickerLinks affected={item.affected} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
