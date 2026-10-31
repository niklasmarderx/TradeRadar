# TradeRadar

KI-gestütztes Stock-Analyse-Dashboard für Privatanleger. Technische Analyse, AI-Picks, Smart Money, Screener und Performance-Tracking — alles auf einen Blick, auf Deutsch.

## Features

- **Action Board** — BUY/SELL/HOLD-Empfehlungen mit Entry, Target, Stop-Loss, Risk/Reward
- **KI-Analyse** — Claude-gestützte Vollanalyse mit SWOT, Moat, Bull/Bear-Thesis, Szenario-Wahrscheinlichkeiten und Preis-Zeitreihe (1W/1M/3M)
- **Scanner** — 500+ Ticker in Prioritäts-Tiers (T1/T2/T3/Crypto), Composite Score (-100 bis +100)
- **Smart Money** — Insider-Trades, Congress-Trades, Whale-Portfolios
- **Screener** — Filterbare Aktiensuche nach technischen und fundamentalen Kriterien
- **Heatmap** — Markt-Übersicht nach Sektoren
- **Performance** — Historische Trefferquote der KI-Picks (Win-Rate, Ø Gewinn/Verlust)
- **Portfolio** — Eigene Positionen tracken mit Live-P&L
- **Bewertungsmodelle** — DCF, Graham Number, Lynch Fair Value
- **Markt-Regime** — Automatische Bull/Bear/Sideways/Volatile Erkennung

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- Yahoo Finance, Alpha Vantage, Massive.com für Marktdaten
- LiteLLM / OpenAI-kompatible API für KI-Analyse
- `technicalindicators` für RSI, MACD, Bollinger Bands, ADX, ATR u.v.m.

## Setup

```bash
git clone https://github.com/niklasmarderx/TradeRadar.git
cd TradeRadar
npm install
```

Erstelle `.env.local`:

```env
# KI-Analyse (OpenAI-kompatible API — z.B. LiteLLM, OpenAI, Anthropic-Proxy)
LITELLM_BASE_URL=https://api.openai.com/v1
LITELLM_API_KEY=sk-...
LITELLM_MODEL=gpt-4o

# Alpha Vantage (kostenloser Key auf alphavantage.co)
ALPHA_VANTAGE_API_KEY=...

# Massive.com (optional — für erweiterte Marktdaten)
MASSIVE_API_KEY=...
```

```bash
npm run dev
# http://localhost:3000
```

Ohne API-Keys läuft der Scanner mit Yahoo Finance-Daten. KI-Analyse und erweiterte Datenquellen sind deaktiviert bis die Keys gesetzt sind.

## Automatischer Refresh (optional)

```bash
# Scanner 4x täglich aktualisieren (Mo–Fr, Börsenzeiten)
# In crontab -e eintragen:
0 9,12,15,18 * * 1-5 /pfad/zu/TradeRadar/scripts/refresh-picks.sh
```

## Lizenz

MIT
