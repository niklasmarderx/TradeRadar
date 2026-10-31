import OpenAI from "openai";
import type { AIAnalysisRequest, AIAnalysisResponse } from "@/lib/types";

const client = new OpenAI({
  baseURL: process.env.LITELLM_BASE_URL,
  apiKey: process.env.LITELLM_API_KEY,
});

const model = process.env.LITELLM_MODEL ?? "anthropic--claude-4.6-opus";

const SYSTEM_PROMPT = `Du bist ein professioneller, quantitativer Aktienanalyst. Du gibst auf Deutsch praezise, wissenschaftlich fundierte Handelsempfehlungen mit klaren Begruendungen.

## ANALYSE-FRAMEWORK (6 Saeulen)

Du bewertest JEDE Aktie nach diesen Saeulen:

### 1. TREND (-25 bis +25)
- SMA-Alignment (20 > 50 > 200 = bullish Trend-Regime)
- Trend-Staerke via ADX (>25 = Trend vorhanden, >40 = starker Trend)
- Golden Cross / Death Cross (SMA50 vs SMA200)

### 2. MOMENTUM (-25 bis +25)
- RSI (14): <30 = ueberverkauft (Kaufgelegenheit), >70 = ueberkauft (Verkaufssignal)
- MACD: Bullish/Bearish Cross, Histogramm-Divergenz
- Stochastik: K/D Crossovers in Extremzonen

### 3. VOLATILITAET (-25 bis +25)
- Bollinger Bands: Preis an unterer Band = potentieller Bounce
- ATR: Niedrige Volatilitaet = besseres Risiko fuer Entry
- Support/Resistance: Naehe zu Schluessellevels

### 4. VOLUMEN (-25 bis +25)
- Hohes Volumen bestaetigt Trendbewegung
- Niedriges Volumen = geringe Ueberzeugung

### 5. FUNDAMENTALANALYSE (Bonus-Saule)
- KGV vs. Branchendurchschnitt: Unter-/Ueberbewertung
- PEG-Ratio: <1 = unterbewertet relativ zum Wachstum
- Verschuldungsgrad (Debt/Equity): Finanzielle Stabilitaet
- Margen-Trend: Steigende Margen = operativer Hebel
- ROE: >15% = starke Kapitalrendite
- Analysten-Konsens: Buy/Hold/Sell-Verteilung + Kursziel vs. aktueller Kurs

### 6. NEWS & SENTIMENT (Bonus-Saule)
- Aktuelle Nachrichtenlage: Katalysatoren oder Risiken
- Markt-Sentiment: VIX, Fear/Greed Index
- Sektor-Performance: Relative Staerke zum Gesamtmarkt
- Kommende Events: Earnings, Konferenzen, regulatorische Entscheidungen

Gesamtscore (technisch): -100 bis +100
- >= 50: STRONG BUY | >= 20: BUY | -20 bis 20: HOLD | <= -20: SELL | <= -50: STRONG SELL
- Fundamentale und Sentiment-Analyse koennen den technischen Score bestaetigen oder relativieren

## KONFIDENZ

Hoch: >= 3 von 4 tech. Saeulen + Fundamentals + Sentiment stimmen ueberein
Mittel: >= 2 Saeulen stimmen ueberein, keine Widersprueche zu Fundamentals
Niedrig: Widersprueche zwischen Technik, Fundamentals und/oder Sentiment

## RISIKO-MANAGEMENT (PFLICHT)

- Stop-Loss: IMMER via ATR berechnen (2x ATR unter Entry fuer Long)
- Target: Minimum 2:1 Risk/Reward, idealerweise ATR-basiert (4x ATR ueber Entry)
- Positionsgroesse: Nach Kelly Criterion (nie mehr als 5% bei niedrigem Konfidenz)
- Max-Verlust pro Trade: Nie mehr als 2% des Gesamtportfolios
- Analysten-Kursziel als Plausibilitaets-Check fuer eigenes Target

## WIDERSPRUCH-AUFLOESSUNG

1. Staerkerer Zeitrahmen gewinnt (Trend > Momentum)
2. ADX-Staerke als Tie-Breaker (starker Trend = Trend-Signal priorisieren)
3. Volumen als Bestaetigung (ohne Volumen = Signal schwaecher)
4. Fundamentals widersprechen Technik: Vorsicht geboten, Konfidenz senken
5. Negatives Sentiment bei positivem Signal: Kursfristiges Risiko beachten
6. Im Zweifel: HOLD empfehlen, nie in Widersprueche hinein-traden

## QUELLENANGABEN

Referenziere die recherchierten News mit Quelle und Datum in deiner Begruendung.

## DISCLAIMER-PFLICHT

Erwaehne IMMER: Dies ist keine Anlageberatung. Eigenrecherche ist Pflicht.

Antworte IMMER als valides JSON:
{
  "recommendation": "STRONG BUY" | "BUY" | "SELL" | "HOLD",
  "confidence": "hoch" | "mittel" | "niedrig",
  "entry": <number>,
  "target": <number>,
  "stopLoss": <number>,
  "riskReward": "1:X.X",
  "summary": "<2-3 Saetze Zusammenfassung>",
  "reasoning": "<8-12 Saetze detaillierte Begruendung mit Indikator-Referenzen, Fundamentaldaten und News-Quellen>",
  "methodology": "<Primaere Strategie + wissenschaftliche Referenz>",
  "risks": ["<Risiko 1>", "<Risiko 2>", "<Risiko 3>", "<Risiko 4>"],
  "timeframe": "<1-5 Tage | 2-4 Wochen | 3-12 Monate>",
  "swot": {
    "strengths": ["Staerke 1", "Staerke 2", "Staerke 3"],
    "weaknesses": ["Schwaeche 1", "Schwaeche 2"],
    "opportunities": ["Chance 1", "Chance 2"],
    "threats": ["Bedrohung 1", "Bedrohung 2"]
  },
  "moat": {
    "type": "wide" | "narrow" | "none",
    "sources": ["Netzwerkeffekte", "Markenstaerke", "Kostenvorteile", "Wechselkosten", "Patente"],
    "explanation": "Kurze Begruendung des Moat-Typs"
  },
  "thesis": {
    "bullCase": "Optimistisches Szenario in 2-3 Saetzen",
    "bearCase": "Pessimistisches Szenario in 2-3 Saetzen"
  },
  "contrarian": {
    "argument": "Was denkt die Mehrheit? Und warum koennte sie falsch liegen?",
    "counterPoints": ["Gegenargument 1", "Gegenargument 2"]
  },
  "factAudit": {
    "claims": [
      { "claim": "Aussage aus der Analyse", "status": "grounded" | "speculative" | "unverifiable" }
    ]
  },
  "scenarioProbabilities": {
    "bull": <0-100: Wahrscheinlichkeit des Bull-Szenarios in %>,
    "base": <0-100: Wahrscheinlichkeit des Base-Szenarios in %>,
    "bear": <0-100: Wahrscheinlichkeit des Bear-Szenarios in %>,
    "rationale": "<1-2 Saetze: Warum diese Verteilung?>"
  },
  "priceTargets": {
    "week1": <number: realistischer Kurs in 1 Woche>,
    "month1": <number: realistischer Kurs in 1 Monat>,
    "month3": <number: realistischer Kurs in 3 Monaten>,
    "rationale": "<1-2 Saetze: Grundlage der Zeitreihen-Schaetzung>"
  }
}

## ERWEITERTE ANALYSE-REGELN

SWOT:
- Strengths/Weaknesses = interne Faktoren (Finanzen, Produkte, Management, Technologie)
- Opportunities/Threats = externe Faktoren (Markt, Regulierung, Wettbewerb, Makro)
- Mindestens 2 pro Kategorie, maximal 4

Moat-Bewertung:
- "wide": Nachhaltiger Wettbewerbsvorteil 10+ Jahre (z.B. Apple Oekosystem, ASML Monopol, Visa Netzwerk)
- "narrow": Temporaerer Vorteil 3-5 Jahre (z.B. Technologievorsprung, Regulatorischer Schutz)
- "none": Kein erkennbarer Vorteil, leicht replizierbar
- Moat-Quellen: Netzwerkeffekte, Markenstaerke, Kostenvorteile, Wechselkosten, Patente/IP, Regulatorischer Burggraben

Contrarian:
- Beschreibe das vorherrschende Narrativ und warum es falsch sein koennte
- Mindestens 2 konkrete Gegenargumente

Fact Audit:
- Pruefe 3-5 zentrale Behauptungen aus deiner eigenen Analyse
- "grounded": Durch vorliegende Daten/Kennzahlen belegt
- "speculative": Plausibel aber unsicher, abhaengig von Annahmen
- "unverifiable": Kann mit vorliegenden Daten nicht geprueft werden

Szenario-Wahrscheinlichkeiten:
- bull + base + bear MUSS exakt 100 ergeben
- bull >= 10%, bear >= 10% (niemals 0% — Maerkte sind unsicher)
- Orientierung: BUY-Signal → base 40-50%, bull 30-40%, bear 15-25%
- Begruende die Verteilung mit konkreten Faktoren (Volatilitaet, Trend, Fundamentals)

Preis-Zeitreihe:
- week1/month1/month3 sind KEINE Garantien, sondern wahrscheinlichste Kurshoehe
- Nutze ATR, Trendstaerke und Fundamentals als Grundlage
- Bleibe konservativ — lieber unter- als ueberschaetzen`;

function buildAnalysisPrompt(req: AIAnalysisRequest): string {
  const { ticker, name, currentPrice, indicators, companyOverview, relatedNews, marketPhase } = req;
  const { latestValues: v, signals: s, compositeScore: cs } = indicators;

  // Price context - recent performance
  const ohlcv = req.ohlcvData;
  const priceChange1d = ohlcv.length >= 2
    ? ((ohlcv[ohlcv.length - 1].close - ohlcv[ohlcv.length - 2].close) / ohlcv[ohlcv.length - 2].close * 100).toFixed(2)
    : "N/A";
  const priceChange5d = ohlcv.length >= 6
    ? ((ohlcv[ohlcv.length - 1].close - ohlcv[ohlcv.length - 6].close) / ohlcv[ohlcv.length - 6].close * 100).toFixed(2)
    : "N/A";
  const priceChange20d = ohlcv.length >= 21
    ? ((ohlcv[ohlcv.length - 1].close - ohlcv[ohlcv.length - 21].close) / ohlcv[ohlcv.length - 21].close * 100).toFixed(2)
    : "N/A";

  // 52-week range
  const recent252 = ohlcv.slice(-252);
  const yearHigh = recent252.length > 0 ? Math.max(...recent252.map((d) => d.high)) : 0;
  const yearLow = recent252.length > 0 ? Math.min(...recent252.map((d) => d.low)) : 0;
  const positionInRange = yearHigh > yearLow
    ? ((currentPrice - yearLow) / (yearHigh - yearLow) * 100).toFixed(1)
    : "N/A";

  // Volume trend
  const avgVol20 = ohlcv.length >= 20
    ? Math.round(ohlcv.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20)
    : 0;
  const lastVol = ohlcv.length > 0 ? ohlcv[ohlcv.length - 1].volume : 0;
  const volRatio = avgVol20 > 0 ? (lastVol / avgVol20).toFixed(2) : "N/A";

  const newsText = relatedNews.length > 0
    ? relatedNews.map((n) => `- [${n.impact.toUpperCase()}] ${n.headline} (${n.source})`).join("\n")
    : "Keine relevanten News verfuegbar.";

  const fundamentals = companyOverview
    ? `\nFUNDAMENTALDATEN (Basis):\n- Sektor: ${companyOverview.sector} / ${companyOverview.industry}\n- Marktkapitalisierung: ${companyOverview.marketCap}\n- KGV: ${companyOverview.peRatio}\n- Dividendenrendite: ${companyOverview.dividendYield}%\n- 52-Wochen-Hoch: ${companyOverview.fiftyTwoWeekHigh}, Tief: ${companyOverview.fiftyTwoWeekLow}`
    : "";

  // Extended fundamentals from Yahoo Finance
  const f = req.fundamentals;
  const extFundamentals = f
    ? `\nERWEITERTE FUNDAMENTALDATEN:\n- KGV (trailing): ${f.peRatio?.toFixed(1) ?? "N/A"} | Forward-KGV: ${f.forwardPE?.toFixed(1) ?? "N/A"} | PEG-Ratio: ${f.pegRatio?.toFixed(2) ?? "N/A"}\n- Gewinnmarge: ${f.profitMargin ? (f.profitMargin * 100).toFixed(1) + "%" : "N/A"} | Operative Marge: ${f.operatingMargin ? (f.operatingMargin * 100).toFixed(1) + "%" : "N/A"}\n- ROE: ${f.returnOnEquity ? (f.returnOnEquity * 100).toFixed(1) + "%" : "N/A"} | Debt/Equity: ${f.debtToEquity?.toFixed(1) ?? "N/A"}\n- Umsatzwachstum: ${f.revenueGrowth ? (f.revenueGrowth * 100).toFixed(1) + "%" : "N/A"} | Gewinnwachstum: ${f.earningsGrowth ? (f.earningsGrowth * 100).toFixed(1) + "%" : "N/A"}\n- Dividendenrendite: ${f.dividendYield ? (f.dividendYield * 100).toFixed(2) + "%" : "N/A"}\n- Analysten-Konsens: ${f.recommendationKey ?? "N/A"} (${f.numberOfAnalysts} Analysten) | Kursziel: ${f.targetMeanPrice?.toFixed(2) ?? "N/A"}`
    : "";

  // Valuation models
  const val = req.valuation;
  const valuationText = val
    ? `\nBEWERTUNGSMODELLE:\n- DCF Fair Value: ${val.dcfFairValue?.toFixed(2) ?? "N/A"} EUR\n- Graham Number: ${val.grahamFairValue?.toFixed(2) ?? "N/A"} EUR\n- Lynch Fair Value (PEG): ${val.lynchFairValue?.toFixed(2) ?? "N/A"} EUR\n- Konsens Fair Value: ${val.consensusFairValue?.toFixed(2) ?? "N/A"} EUR\n- Margin of Safety: ${val.marginOfSafety.toFixed(1)}%\n- Bewertung: ${val.verdict}`
    : "";

  // Sonar-Pro research data
  const research = req.research;
  let researchText = "";
  if (research) {
    const newsLines = research.news.length > 0
      ? research.news.map((n) => `- [${n.impact.toUpperCase()}] ${n.headline} (${n.source}, ${n.date}) ${n.url}`).join("\n")
      : "Keine aktuellen News gefunden.";

    const consensus = research.analystConsensus
      ? `\nANALYSTEN-KONSENS:\n- Rating: ${research.analystConsensus.rating} | Kursziel: ${research.analystConsensus.targetPrice ?? "N/A"}\n- Buy: ${research.analystConsensus.buyCount} | Hold: ${research.analystConsensus.holdCount} | Sell: ${research.analystConsensus.sellCount} (${research.analystConsensus.numberOfAnalysts} Analysten)`
      : "";

    const sector = research.sectorComparison
      ? `\nSEKTOR-VERGLEICH:\n- ${research.sectorComparison.sectorPerformance}\n- ${research.sectorComparison.relativeStrength}\n- ${research.sectorComparison.spComparison}`
      : "";

    const sentiment = research.marketSentiment
      ? `\nMARKT-SENTIMENT:\n- ${research.marketSentiment.vixLevel}\n- ${research.marketSentiment.fearGreed}\n- ${research.marketSentiment.marketTrend}`
      : "";

    const events = research.upcomingEvents.length > 0
      ? `\nKOMMENDE EVENTS:\n${research.upcomingEvents.map((e) => `- ${e}`).join("\n")}`
      : "";

    researchText = `\nAKTUELLE WEB-RECHERCHE (${research.searchedAt.slice(0, 16)}):\n${newsLines}${consensus}${sector}${sentiment}${events}`;
  }

  return `Analysiere ${ticker} (${name}).

KURS-KONTEXT:
- Aktueller Kurs: ${currentPrice.toFixed(2)} EUR
- Veraenderung 1T: ${priceChange1d}% | 5T: ${priceChange5d}% | 20T: ${priceChange20d}%
- 52W-Hoch: ${yearHigh.toFixed(2)} | 52W-Tief: ${yearLow.toFixed(2)} | Position: ${positionInRange}%
- Volumen heute vs. 20T-Schnitt: ${volRatio}x (${s.volumeSignal})
- Marktphase: ${marketPhase}
${fundamentals}
${extFundamentals}
${valuationText}

TECHNISCHE INDIKATOREN:
- RSI (14): ${v.rsi?.toFixed(1) ?? "N/A"} — Signal: ${s.rsiSignal}
- Stochastik: K=${v.stochasticK?.toFixed(1) ?? "N/A"}, D=${v.stochasticD?.toFixed(1) ?? "N/A"} — Signal: ${s.stochasticSignal}
- MACD: Linie ${v.macdLine?.toFixed(3) ?? "N/A"}, Signal ${v.macdSignal?.toFixed(3) ?? "N/A"}, Hist ${v.macdHistogram?.toFixed(3) ?? "N/A"} — Signal: ${s.macdSignal}
- ADX: ${v.adx?.toFixed(1) ?? "N/A"} — Trend-Staerke: ${s.trendStrength}
- ATR (14): ${v.atr?.toFixed(2) ?? "N/A"} (${v.atrPercent?.toFixed(2) ?? "N/A"}% vom Kurs)
- Bollinger Bands: Obere ${v.bollingerUpper?.toFixed(2) ?? "N/A"}, Mitte ${v.bollingerMiddle?.toFixed(2) ?? "N/A"}, Untere ${v.bollingerLower?.toFixed(2) ?? "N/A"} — ${s.bollingerSignal}
- SMA 20: ${v.sma20?.toFixed(2) ?? "N/A"} | SMA 50: ${v.sma50?.toFixed(2) ?? "N/A"} | SMA 200: ${v.sma200?.toFixed(2) ?? "N/A"} — Trend: ${s.trendSignal}
- Support: ${indicators.supportResistance.support.toFixed(2)} | Resistance: ${indicators.supportResistance.resistance.toFixed(2)}

ALGORITHMISCHER COMPOSITE SCORE (vorab berechnet):
- Gesamtscore: ${cs.score}/100
- Signal: ${cs.signal} (Konfidenz: ${cs.confidence})
- Breakdown: Trend ${cs.breakdown.trend} | Momentum ${cs.breakdown.momentum} | Volatilitaet ${cs.breakdown.volatility} | Volumen ${cs.breakdown.volume}
- Indikator-Konvergenz: ${cs.convergence}/4 Saeulen stimmen ueberein
- Vorgeschlagener Entry: ${cs.suggestedEntry} | Target: ${cs.suggestedTarget} | Stop: ${cs.suggestedStop}
- Kelly-Positionsgroesse: ${cs.kellySize}%

NEWS:
${newsText}
${researchText}

Analysiere die Daten und gib deine Empfehlung als JSON. Begruende detailliert warum du dem algorithmischen Score zustimmst oder abweichst. Beruecksichtige Fundamentaldaten, Bewertungsmodelle, Analysten-Konsens und aktuelle Nachrichtenlage. Erstelle eine vollstaendige SWOT-Analyse, bewerte den Wettbewerbsvorteil (Moat), formuliere Bull/Bear-Thesis, liefere eine Contrarian-Perspektive und pruefe deine eigenen Aussagen im Fact Audit.`;
}

export async function analyzeStock(req: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: 4000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildAnalysisPrompt(req) },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("KI-Antwort konnte nicht geparst werden");
  return JSON.parse(jsonMatch[0]) as AIAnalysisResponse;
}

export async function* analyzeStockStream(req: AIAnalysisRequest): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 4000,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildAnalysisPrompt(req) },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   Lightweight Batch Analysis for Scanner Top Picks
   ~500 tokens per pick, parallel execution
   ══════════════════════════════════════════════════════════════ */

export interface PickSummary {
  ticker: string;
  price: number;
  signal: string;
  score: number;
  qualityScore: number;
  reasonText: string;
  fundamentals?: string;
  smartMoney?: string;
  regime?: string;
}

export interface PickAIAnalysis {
  justification: string;
  confidenceAdjustment: number; // -15 to +15
  redFlags: string[];
  aiVerdict: "BESTAETIGT" | "VORSICHT" | "ABGELEHNT";
}

const BATCH_SYSTEM_PROMPT = `Du bist ein quantitativer Aktienanalyst. Bewerte ob ein Scanner-Pick valide ist.
Antworte NUR als valides JSON:
{
  "justification": "<2-3 Saetze: Warum ist dieser Pick gut/schlecht?>",
  "confidenceAdjustment": <-15 bis +15: Wie stark aendert sich deine Konfidenz?>,
  "redFlags": ["<Warnung 1>", ...],
  "aiVerdict": "BESTAETIGT" | "VORSICHT" | "ABGELEHNT"
}

Regeln:
- BESTAETIGT: Signal, Fundamentals, Sentiment stimmen ueberein, keine Red Flags
- VORSICHT: Teilweise Uebereinstimmung, aber Risiken vorhanden
- ABGELEHNT: Widersprueche oder schwere Red Flags (hohe Bewertung + Kaufsignal, etc.)
- confidenceAdjustment: +10 bis +15 = sehr ueberzeugend, -10 bis -15 = stark fragwuerdig
- Beruecksichtige Smart Money, Regime, Fundamentals, Short Interest`;

function buildBatchPrompt(pick: PickSummary): string {
  let prompt = `Bewerte: ${pick.ticker} @ ${pick.price.toFixed(2)} EUR
Signal: ${pick.signal} | Score: ${pick.score} | Quality: ${pick.qualityScore}
Analyse: ${pick.reasonText}`;

  if (pick.fundamentals) prompt += `\nFundamentals: ${pick.fundamentals}`;
  if (pick.smartMoney) prompt += `\nSmart Money: ${pick.smartMoney}`;
  if (pick.regime) prompt += `\nMarkt-Regime: ${pick.regime}`;

  return prompt;
}

export async function analyzePickBatch(picks: PickSummary[]): Promise<Map<string, PickAIAnalysis>> {
  const results = new Map<string, PickAIAnalysis>();

  const promises = picks.map(async (pick) => {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 500,
        messages: [
          { role: "system", content: BATCH_SYSTEM_PROMPT },
          { role: "user", content: buildBatchPrompt(pick) },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const parsed = JSON.parse(jsonMatch[0]) as PickAIAnalysis;
      // Clamp adjustment
      parsed.confidenceAdjustment = Math.max(-15, Math.min(15, parsed.confidenceAdjustment));
      results.set(pick.ticker, parsed);
    } catch {
      // AI analysis optional per pick
    }
  });

  await Promise.all(promises);
  return results;
}

export function isLiteLLMConfigured(): boolean {
  return !!(process.env.LITELLM_BASE_URL && process.env.LITELLM_API_KEY);
}
