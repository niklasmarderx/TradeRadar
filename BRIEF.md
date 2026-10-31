# Berry Terminal — Stock Analyse Tool

## Vision
Professionelles, KI-gestütztes Stock-Analyse-Dashboard für Privatanleger.
Einfach, klar, auf einen Blick: Was kaufen, was verkaufen, warum.

## Zielgruppe
Privatanleger mit Trade Republic (oder ähnlichen Brokern), die:
- Keine Zeit haben den ganzen Tag Charts zu analysieren
- Klare Kauf/Verkauf-Signale wollen mit Entry, Target, Stop-Loss
- Wissenschaftlich fundierte Strategien bevorzugen
- Alles auf Deutsch und in Euro brauchen

## Core Features (MVP)

### 1. Action Board (ganz oben, sofort sichtbar)
- Große farbige Cards: BUY (grün), SELL (rot), HOLD (grau)
- Jede Card: Ticker, aktueller Kurs in €, Entry, Target, Stop-Loss
- Risk/Reward Ratio, Konfidenz (hoch/mittel/niedrig)
- Strategie-Tag (Momentum, Mean Reversion, Catalyst, Value)
- Zeitrahmen: kurzfristig (1-5d), mittelfristig (2-4w), langfristig (3-12m)

### 2. Markt-Überblick
- Ticker-Leiste: S&P 500, NASDAQ, DAX — in EUR oder Punkte
- Krypto: BTC, ETH, SOL in EUR mit 24h Change
- Marktphase-Indikator: BULLISH / BEARISH / NEUTRAL / VOLATILE

### 3. News-Feed
- Top 5-7 marktrelevante News auf Deutsch
- Impact-Tags: BULL / BEAR / NEUTRAL
- Betroffene Ticker verlinkt

### 4. Analyse-Methodik (wissenschaftlich)
- Momentum (Jegadeesh & Titman 1993)
- Mean Reversion (De Bondt & Thaler 1985)
- Catalyst-Driven (Event Studies)
- Relative Strength (Levy 1967)
- Risk/Reward via Kelly Criterion
- Multi-Modell Validation (Opus + GPT-5 Gegencheck)

### 5. Risiko-Assessment
- Geopolitik, Bewertungsniveau, Sektor-Risiken
- Ampelsystem: LOW / MEDIUM / HIGH

## Tech Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS
- **Daten:** JSON-Datei die von Cron-Jobs aktualisiert wird (später: eigene API)
- **Styling:** Dark Theme, Terminal-Ästhetik, Monospace für Zahlen
- **Sprache:** Deutsch, Euro (€), deutsche Zahlformatierung (1.000,00)
- **Deployment:** Zunächst lokal (localhost:3000), später Vercel/Cloudflare

## Design-Regeln
- KEINE Emojis
- Monospace-Font für alle Zahlen
- Grün = positiv/kaufen, Rot = negativ/verkaufen, Grau = neutral
- Mobile-first (Trade Republic User sind oft am Handy)
- Professionell wie Bloomberg Terminal, aber einfacher zu verstehen
- Umlaute (äöü) korrekt
- Alle Kurse in Euro

## Datenfluss
1. Berry's Cron-Job (4x täglich) → sammelt Marktdaten + analysiert
2. GPT-5 Gegencheck (15 Min später) → validiert Picks
3. JSON wird geschrieben → Frontend liest und rendert
4. Später: Eigene API, Echtzeit-Kurse, Portfolio-Tracking

## Projektstruktur
```
berry-terminal/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard
│   ├── layout.tsx         # Layout + Fonts
│   └── globals.css        # Tailwind + Custom Styles
├── components/
│   ├── ActionBoard.tsx    # Kauf/Verkauf Cards
│   ├── TickerBar.tsx      # Index-Leiste
│   ├── CryptoPanel.tsx    # Krypto-Übersicht
│   ├── NewsFeed.tsx       # News mit Impact-Tags
│   ├── RiskPanel.tsx      # Risiko-Assessment
│   └── MarketPhase.tsx    # Bull/Bear Indikator
├── lib/
│   ├── types.ts           # TypeScript Interfaces
│   └── data.ts            # Daten laden
├── public/
│   └── trading-data.json  # Von Cron aktualisiert
├── BRIEF.md               # Diese Datei
├── package.json
└── README.md
```

## Name-Ideen
- Berry Terminal
- BerryTrade
- SignalBoard
- TradeRadar
</content>
</invoke>