export interface CuratedList {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "thematic" | "strategy" | "regional" | "crypto";
  tickers: string[];
}

export const CURATED_LISTS: CuratedList[] = [
  // ── Thematic ──
  {
    id: "ai-stocks",
    name: "AI & Machine Learning",
    description: "Unternehmen an der Spitze der KI-Revolution",
    icon: "AI",
    category: "thematic",
    tickers: [
      "NVDA", "MSFT", "GOOGL", "META", "PLTR", "SNOW", "AI", "SOUN",
      "BBAI", "IONQ", "CRM", "ADBE", "NOW", "CRWD", "DDOG",
    ],
  },
  {
    id: "semiconductor-leaders",
    name: "Semiconductor Leaders",
    description: "Die wichtigsten Chip-Hersteller und Zulieferer",
    icon: "CHIP",
    category: "thematic",
    tickers: [
      "NVDA", "AMD", "INTC", "QCOM", "AVGO", "TSM", "ASML", "AMAT",
      "LRCX", "KLAC", "ARM", "MU", "ON", "TXN", "ADI", "IFX.DE",
    ],
  },
  {
    id: "growth-tech",
    name: "Growth Tech",
    description: "Wachstumsstarke Tech-Unternehmen mit hohem Momentum",
    icon: "GROWTH",
    category: "thematic",
    tickers: [
      "SHOP", "NET", "DDOG", "CRWD", "SNOW", "MDB", "HUBS", "ZS",
      "PANW", "BILL", "OKTA", "TWLO", "MNDY", "CFLT",
    ],
  },
  {
    id: "clean-energy",
    name: "Clean Energy",
    description: "Erneuerbare Energien und Cleantech",
    icon: "SOLAR",
    category: "thematic",
    tickers: [
      "TAN", "ICLN", "PLUG", "FCEL", "CHPT", "NEE", "SEDG",
      "ALB", "LAC", "MP", "LEU", "SMR",
    ],
  },
  {
    id: "biotech-leaders",
    name: "Biotech Leaders",
    description: "Führende Biotechnologie- und Pharma-Unternehmen",
    icon: "BIO",
    category: "thematic",
    tickers: [
      "LLY", "ABBV", "AMGN", "GILD", "VRTX", "REGN", "MRNA",
      "CRSP", "NTLA", "BEAM", "ISRG", "DXCM",
    ],
  },
  {
    id: "space-defense",
    name: "Space & Defense",
    description: "Raumfahrt, Verteidigung und Luft- & Raumfahrttechnik",
    icon: "ROCKET",
    category: "thematic",
    tickers: [
      "LMT", "RTX", "NOC", "GD", "BA", "RKLB", "JOBY", "ASTS",
      "LUNR", "HII", "GE",
    ],
  },

  // ── Strategy ──
  {
    id: "dividend-kings",
    name: "Dividend Kings",
    description: "Zuverlässige Dividendenzahler mit langer Historie",
    icon: "DIV",
    category: "strategy",
    tickers: [
      "JNJ", "PG", "KO", "PEP", "MCD", "WMT", "HD", "ABT",
      "O", "NEE", "DUK", "SO", "AEP",
    ],
  },
  {
    id: "mega-cap-value",
    name: "Mega-Cap Value",
    description: "Die größten und stabilsten Blue-Chip-Aktien",
    icon: "VALUE",
    category: "strategy",
    tickers: [
      "AAPL", "MSFT", "GOOGL", "AMZN", "JPM", "V", "MA", "UNH",
      "JNJ", "PG", "BRK-B", "XOM", "CVX",
    ],
  },

  // ── Regional ──
  {
    id: "german-blue-chips",
    name: "German Blue Chips",
    description: "Die größten deutschen DAX-Unternehmen",
    icon: "DE",
    category: "regional",
    tickers: [
      "SAP", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE", "ADS.DE",
      "MBG.DE", "BMW.DE", "VOW3.DE", "RHM.DE", "IFX.DE",
    ],
  },
  {
    id: "european-champions",
    name: "European Champions",
    description: "Europas führende Unternehmen aus verschiedenen Sektoren",
    icon: "EU",
    category: "regional",
    tickers: [
      "ASML", "SAP", "MC.PA", "OR.PA", "NOVN.SW", "NESN.SW",
      "SHEL", "AZN", "SIE.DE", "BNP.PA", "SAN.PA",
    ],
  },

  // ── Crypto ──
  {
    id: "top-crypto",
    name: "Top Crypto",
    description: "Die größten Kryptowährungen nach Marktkapitalisierung",
    icon: "COIN",
    category: "crypto",
    tickers: [
      "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD",
      "ADA-USD", "DOGE-USD", "AVAX-USD", "LINK-USD", "UNI-USD",
    ],
  },
  {
    id: "defi-tokens",
    name: "DeFi Tokens",
    description: "Dezentrale Finanzprotokolle und DeFi-Ökosystem",
    icon: "DEFI",
    category: "crypto",
    tickers: [
      "UNI-USD", "AAVE-USD", "MKR-USD", "LDO-USD", "LINK-USD",
      "ATOM-USD", "INJ-USD", "FET-USD", "RNDR-USD",
    ],
  },
];

export function getListById(id: string): CuratedList | undefined {
  return CURATED_LISTS.find((l) => l.id === id);
}

export function getListsByCategory(category: CuratedList["category"]): CuratedList[] {
  return CURATED_LISTS.filter((l) => l.category === category);
}

const CATEGORY_LABELS: Record<CuratedList["category"], string> = {
  thematic: "Thematisch",
  strategy: "Strategie",
  regional: "Regional",
  crypto: "Crypto",
};

export function getCategoryLabel(category: CuratedList["category"]): string {
  return CATEGORY_LABELS[category];
}
