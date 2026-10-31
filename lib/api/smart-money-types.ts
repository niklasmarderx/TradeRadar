/* ══════════════════════════════════════════════════════════════
   Smart Money — Types & Constants (safe for client components)
   ══════════════════════════════════════════════════════════════ */

// ── Types ──

export interface CongressTrade {
  representative: string;
  party: "D" | "R" | string;
  house: "House" | "Senate";
  ticker: string;
  transaction: string; // "Purchase", "Sale (Full)", "Sale (Partial)"
  transactionDate: string;
  reportDate: string;
  range: string; // "$1,001 - $15,000"
  rangeMin: number;
  rangeMax: number;
}

export interface WhaleHolding {
  name: string;       // e.g. "APPLE INC"
  ticker: string;     // resolved ticker symbol
  value: number;      // in millions USD
  shares: number;     // total shares
  cusip: string;
}

export interface WhalePortfolio {
  whale: WhaleInfo;
  filingDate: string;
  periodOfReport: string;
  holdings: WhaleHolding[];
  totalValue: number; // in millions USD
}

export interface WhaleInfo {
  id: string;
  name: string;
  entity: string;
  cik: string;
  description: string;
}

export interface InsiderTrade {
  date: string;
  name: string;
  title: string;
  transactionText: string;
  shares: number;
  value: number | null;
  type: "buy" | "sell" | "gift" | "other";
}

export interface InstitutionalHolder {
  organization: string;
  pctHeld: number;
  position: number;
}

export interface InsiderData {
  ticker: string;
  insiderPercent: number | null;
  institutionPercent: number | null;
  transactions: InsiderTrade[];
  topHolders: InstitutionalHolder[];
}

// ── Whale Definitions ──

export const WHALE_LIST: WhaleInfo[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    entity: "Berkshire Hathaway",
    cik: "0001067983",
    description: "Value-Investor, CEO von Berkshire Hathaway. Fokus auf Qualitätsunternehmen mit dauerhaftem Wettbewerbsvorteil.",
  },
  {
    id: "soros",
    name: "George Soros",
    entity: "Soros Fund Management",
    cik: "0001029160",
    description: "Makro-Investor, bekannt für Währungsspekulation. Soros Fund Management verwaltet sein Vermögen.",
  },
  {
    id: "dalio",
    name: "Ray Dalio",
    entity: "Bridgewater Associates",
    cik: "0001350694",
    description: "Gründer des weltgrößten Hedgefonds. Bekannt für All-Weather-Strategie und Risikoparität.",
  },
  {
    id: "ackman",
    name: "Bill Ackman",
    entity: "Pershing Square",
    cik: "0001336528",
    description: "Aktivist-Investor mit konzentrierten Positionen. Bekannt für öffentliche Short-Kampagnen.",
  },
  {
    id: "citadel",
    name: "Ken Griffin",
    entity: "Citadel Advisors",
    cik: "0001423053",
    description: "Quantitativer Hedgefonds mit Multi-Strategie-Ansatz. Einer der größten Market Maker.",
  },
  {
    id: "renaissance",
    name: "Jim Simons",
    entity: "Renaissance Technologies",
    cik: "0001037389",
    description: "Legender quantitativer Hedgefonds. Medallion Fund gilt als erfolgreichster Fonds aller Zeiten.",
  },
];
