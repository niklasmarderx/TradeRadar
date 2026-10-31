import { getCached, setCache } from "@/lib/cache";

/**
 * Finnhub API Client (Social Sentiment)
 * Free tier: 60 calls/min. https://finnhub.io/register
 * Provides Reddit/Twitter sentiment per ticker.
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";
const BASE = "https://finnhub.io/api/v1";
const FINNHUB_TTL = 2 * 60 * 60 * 1000; // 2 hours

export function isFinnhubConfigured(): boolean {
  return !!FINNHUB_API_KEY;
}

export interface SocialSentiment {
  overallScore: number; // -1 to +1
  buzz: "high" | "moderate" | "low";
  totalMentions: number;
  positiveRatio: number;
}

export async function fetchSocialSentiment(ticker: string): Promise<SocialSentiment | null> {
  const cacheKey = `finnhub-social-${ticker}`;
  const cached = await getCached<SocialSentiment>(cacheKey, FINNHUB_TTL);
  if (cached) return cached;

  if (!FINNHUB_API_KEY) return null;

  try {
    const res = await fetch(
      `${BASE}/stock/social-sentiment?symbol=${ticker}&from=${getDateDaysAgo(7)}&to=${todayStr()}&token=${FINNHUB_API_KEY}`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const reddit = data.reddit ?? [];
    const twitter = data.twitter ?? [];

    let totalPos = 0;
    let totalNeg = 0;
    let totalMentions = 0;

    for (const entry of [...reddit, ...twitter]) {
      totalPos += entry.positiveMention ?? 0;
      totalNeg += entry.negativeMention ?? 0;
      totalMentions += (entry.positiveMention ?? 0) + (entry.negativeMention ?? 0);
    }

    const total = totalPos + totalNeg;
    const overallScore = total > 0 ? (totalPos - totalNeg) / total : 0;
    const positiveRatio = total > 0 ? totalPos / total : 0.5;

    let buzz: SocialSentiment["buzz"] = "low";
    if (totalMentions > 100) buzz = "high";
    else if (totalMentions > 20) buzz = "moderate";

    const result: SocialSentiment = { overallScore, buzz, totalMentions, positiveRatio };
    await setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
