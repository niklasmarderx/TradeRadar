import Link from "next/link";
import { fetchMarketNews, isMassiveConfigured, type MassiveNewsArticle } from "@/lib/api/massive";

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const styles: Record<string, string> = {
    positive: "bg-up/10 text-up",
    negative: "bg-down/10 text-down",
    neutral: "bg-muted/10 text-sub",
  };
  const labels: Record<string, string> = {
    positive: "BULL",
    negative: "BEAR",
    neutral: "NEUTRAL",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded ${styles[sentiment] ?? styles.neutral}`}>
      {labels[sentiment] ?? "—"}
    </span>
  );
}

function timeAgo(utc: string): string {
  const ms = Date.now() - new Date(utc).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function ArticleCard({ article }: { article: MassiveNewsArticle }) {
  // Find first insight with sentiment
  const primaryInsight = article.insights[0];
  const primaryTicker = article.tickers[0];

  return (
    <div className="rounded-lg bg-card border border-card-border p-3 flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        {primaryInsight && <SentimentBadge sentiment={primaryInsight.sentiment} />}
        <a
          href={article.article_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm leading-snug flex-1 hover:text-accent transition-colors cursor-pointer"
        >
          {article.title}
        </a>
        <span className="text-[10px] text-muted shrink-0 font-mono-num">
          {timeAgo(article.published_utc)}
        </span>
      </div>

      {article.description && (
        <p className="text-[10px] text-sub leading-relaxed line-clamp-2">
          {article.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
        <span className="flex items-center gap-1">
          {article.publisher.favicon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.publisher.favicon_url} alt="" className="w-3 h-3" />
          )}
          {article.publisher.name}
        </span>
        <span className="inline-flex gap-1.5 flex-wrap">
          {article.tickers.slice(0, 5).map((ticker) => (
            <Link
              key={ticker}
              href={`/stock/${ticker}`}
              className="text-accent hover:text-bright transition-colors font-mono-num px-1.5 py-0.5 rounded bg-accent/5 hover:bg-accent/15 border border-accent/20"
            >
              {ticker}
            </Link>
          ))}
          {article.tickers.length > 5 && (
            <span className="text-[10px] text-muted">+{article.tickers.length - 5}</span>
          )}
        </span>
      </div>

      {/* Sentiment reasoning for primary ticker */}
      {primaryInsight?.sentiment_reasoning && (
        <p className="text-[10px] text-muted italic leading-snug mt-0.5 line-clamp-2">
          {primaryInsight.sentiment_reasoning}
        </p>
      )}
    </div>
  );
}

interface LiveNewsFeedProps {
  /** Optional: only show news for this ticker */
  ticker?: string;
  /** Number of articles to show */
  limit?: number;
  /** Fallback static news to show if Massive is not configured */
  fallbackNews?: { headline: string; source: string; impact: "bullish" | "bearish" | "neutral"; affected: string }[];
}

export default async function LiveNewsFeed({ ticker, limit = 15, fallbackNews }: LiveNewsFeedProps) {
  let articles: MassiveNewsArticle[] = [];

  if (isMassiveConfigured()) {
    try {
      articles = await fetchMarketNews(limit);
      if (ticker) {
        // Filter to articles mentioning this ticker, then show rest
        const relevant = articles.filter((a) => a.tickers.includes(ticker));
        const others = articles.filter((a) => !a.tickers.includes(ticker));
        articles = [...relevant, ...others].slice(0, limit);
      }
    } catch {
      articles = [];
    }
  }

  // Fallback to static news
  if (articles.length === 0 && fallbackNews) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-sub uppercase tracking-widest mb-3 section-header">
          Nachrichten
        </h2>
        <div className="space-y-2">
          {fallbackNews.map((item, i) => (
            <div key={i} className="rounded-lg bg-card border border-card-border p-3 flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <SentimentBadge sentiment={item.impact === "bullish" ? "positive" : item.impact === "bearish" ? "negative" : "neutral"} />
                <p className="text-sm leading-snug flex-1">{item.headline}</p>
              </div>
              <span className="text-xs text-muted">{item.source}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  // Count sentiments
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const a of articles) {
    const s = a.insights[0]?.sentiment;
    if (s && s in sentimentCounts) sentimentCounts[s as keyof typeof sentimentCounts]++;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-sub uppercase tracking-widest section-header">
          Live Nachrichten
        </h2>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-up">{sentimentCounts.positive} Bullish</span>
          <span className="text-down">{sentimentCounts.negative} Bearish</span>
          <span className="text-muted">{sentimentCounts.neutral} Neutral</span>
        </div>
      </div>
      <div className="space-y-2">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
