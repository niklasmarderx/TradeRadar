import OpenAI from "openai";
import type { ResearchResult } from "@/lib/types";
import { getCached, setCache, TTL } from "@/lib/cache";

const client = new OpenAI({
  baseURL: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
});

const RESEARCH_MODEL = "sonar-pro";

const RESEARCH_PROMPT = `Du bist ein Finanz-Recherche-Assistent. Recherchiere die Aktie und liefere aktuelle, verifizierte Informationen.

Antworte IMMER als valides JSON mit dieser Struktur:
{
  "news": [
    {
      "headline": "Titel der Nachricht",
      "url": "https://...",
      "source": "Reuters/Bloomberg/etc",
      "date": "YYYY-MM-DD",
      "impact": "bullish" | "bearish" | "neutral",
      "summary": "1-2 Sätze Zusammenfassung"
    }
  ],
  "analystConsensus": {
    "rating": "Strong Buy/Buy/Hold/Sell/Strong Sell",
    "targetPrice": 123.45,
    "numberOfAnalysts": 30,
    "buyCount": 20,
    "holdCount": 8,
    "sellCount": 2
  },
  "sectorComparison": {
    "sectorPerformance": "Tech-Sektor +2.3% letzte Woche, outperformt S&P 500",
    "relativeStrength": "Aktie +5% vs Sektor +2.3% = relative Stärke",
    "spComparison": "S&P 500 YTD +12%, Aktie YTD +18%"
  },
  "marketSentiment": {
    "vixLevel": "VIX bei 15.2 (niedrig, Markt ruhig)",
    "fearGreed": "Fear & Greed Index: 62 (Greed)",
    "marketTrend": "Bullish - S&P 500 nahe Allzeithoch"
  },
  "upcomingEvents": ["Earnings Report am 2026-05-01", "WWDC am 2026-06-09"]
}

Regeln:
- Liefere 3-5 aktuelle News mit ECHTEN URLs und Daten
- Analysten-Konsens von aktuellen Wall Street Ratings
- Vergleiche Performance mit Sektor und S&P 500
- Nenne kommende Events (Earnings, Konferenzen, etc.)
- Alle Daten muessen aktuell und verifiziert sein
- Wenn keine Daten verfuegbar: null fuer das Feld`;

export async function researchStock(
  ticker: string,
  name: string
): Promise<ResearchResult> {
  const cacheKey = `research-${ticker}`;
  const cached = await getCached<ResearchResult>(cacheKey, TTL.YAHOO_OHLCV);
  if (cached) return cached;

  const response = await client.chat.completions.create({
    model: RESEARCH_MODEL,
    max_tokens: 2000,
    messages: [
      { role: "system", content: RESEARCH_PROMPT },
      {
        role: "user",
        content: `Recherchiere aktuelle Informationen zur Aktie ${ticker} (${name}). Heute ist ${new Date().toISOString().slice(0, 10)}. Liefere News, Analysten-Ratings, Sektor-Vergleich, Markt-Sentiment und kommende Events.`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return emptyResearch();
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result: ResearchResult = {
      news: Array.isArray(parsed.news) ? parsed.news : [],
      analystConsensus: parsed.analystConsensus ?? null,
      sectorComparison: parsed.sectorComparison ?? null,
      marketSentiment: parsed.marketSentiment ?? null,
      upcomingEvents: Array.isArray(parsed.upcomingEvents) ? parsed.upcomingEvents : [],
      searchedAt: new Date().toISOString(),
    };

    await setCache(cacheKey, result);
    return result;
  } catch {
    return emptyResearch();
  }
}

function emptyResearch(): ResearchResult {
  return {
    news: [],
    analystConsensus: null,
    sectorComparison: null,
    marketSentiment: null,
    upcomingEvents: [],
    searchedAt: new Date().toISOString(),
  };
}
