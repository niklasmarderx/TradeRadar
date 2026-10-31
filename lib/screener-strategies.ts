export interface ScreenerStrategy {
  id: string;
  name: string;
  signal: string;       // "ALL" | "BUY" | "SELL,STRONG SELL" etc.
  strategy: string;     // "ALL" | "Momentum" | ...
  confidence: string;   // "ALL" | "hoch" | "mittel" | "niedrig"
  sort: string;         // "quality" | "rr" | "confidence" | "signal"
  isBuiltIn?: boolean;
  createdAt: string;
}

const STORAGE_KEY = "traderadar-screener-strategies";

const BUILT_IN: ScreenerStrategy[] = [
  {
    id: "builtin-aggressive",
    name: "Aggressive Growth",
    signal: "STRONG BUY",
    strategy: "ALL",
    confidence: "hoch",
    sort: "quality",
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "builtin-shorts",
    name: "Short Opportunities",
    signal: "SELL,STRONG SELL",
    strategy: "ALL",
    confidence: "ALL",
    sort: "quality",
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "builtin-value",
    name: "Value Picks",
    signal: "BUY",
    strategy: "Value Investing",
    confidence: "hoch",
    sort: "quality",
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "builtin-momentum",
    name: "Momentum Plays",
    signal: "BUY,STRONG BUY",
    strategy: "Momentum",
    confidence: "ALL",
    sort: "signal",
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "builtin-conviction",
    name: "High Conviction",
    signal: "ALL",
    strategy: "ALL",
    confidence: "hoch",
    sort: "confidence",
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

function readStrategies(): ScreenerStrategy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScreenerStrategy[]) : [];
  } catch {
    return [];
  }
}

function writeStrategies(items: ScreenerStrategy[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getBuiltInStrategies(): ScreenerStrategy[] {
  return BUILT_IN;
}

export function getStrategies(): ScreenerStrategy[] {
  return readStrategies();
}

export function getAllStrategies(): ScreenerStrategy[] {
  return [...BUILT_IN, ...readStrategies()];
}

export function saveStrategy(s: Omit<ScreenerStrategy, "id" | "createdAt">): void {
  const list = readStrategies();
  list.push({
    ...s,
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  });
  writeStrategies(list);
}

export function deleteStrategy(id: string): void {
  const list = readStrategies().filter((s) => s.id !== id);
  writeStrategies(list);
}
