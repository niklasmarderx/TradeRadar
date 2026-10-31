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

export default function RelatedNews({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return null;

  return (
    <div className="rounded-lg bg-card border border-card-border p-5">
      <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-4 section-header">
        Verwandte Nachrichten
      </h2>
      <div className="space-y-3 mt-6">
        {news.map((item, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <ImpactTag impact={item.impact} />
              <p className="text-sm leading-snug flex-1">{item.headline}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{item.source}</span>
              <span className="inline-flex gap-1.5">
                {item.affected.split(",").map((t) => {
                  const ticker = t.trim();
                  return (
                    <Link
                      key={ticker}
                      href={`/stock/${ticker}`}
                      className="text-accent hover:text-bright transition-colors font-mono-num"
                    >
                      {ticker}
                    </Link>
                  );
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
