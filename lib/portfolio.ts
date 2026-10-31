export interface PortfolioPosition {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  avgPrice: number;
  addedAt: string;
}

const PORTFOLIO_KEY = "traderadar-portfolio";

function readPortfolio(): PortfolioPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? (JSON.parse(raw) as PortfolioPosition[]) : [];
  } catch {
    return [];
  }
}

function writePortfolio(positions: PortfolioPosition[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions));
}

export function getPortfolio(): PortfolioPosition[] {
  return readPortfolio();
}

export function addPosition(pos: Omit<PortfolioPosition, "id" | "addedAt">): PortfolioPosition {
  const list = readPortfolio();
  // If same ticker exists, merge (average price)
  const existing = list.find((p) => p.ticker === pos.ticker.toUpperCase());
  if (existing) {
    const totalShares = existing.shares + pos.shares;
    existing.avgPrice =
      (existing.avgPrice * existing.shares + pos.avgPrice * pos.shares) / totalShares;
    existing.shares = totalShares;
    writePortfolio(list);
    return existing;
  }

  const newPos: PortfolioPosition = {
    ...pos,
    ticker: pos.ticker.toUpperCase(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
  };
  list.push(newPos);
  writePortfolio(list);
  return newPos;
}

export function updatePosition(id: string, updates: Partial<PortfolioPosition>): void {
  const list = readPortfolio();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  writePortfolio(list);
}

export function removePosition(id: string): void {
  const list = readPortfolio().filter((p) => p.id !== id);
  writePortfolio(list);
}
