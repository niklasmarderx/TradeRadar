export interface WatchlistItem {
  ticker: string;
  name: string;
  addedAt: string;
}

const STORAGE_KEY = "traderadar-watchlist";

function readList(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function writeList(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getWatchlist(): WatchlistItem[] {
  return readList();
}

export function addToWatchlist(ticker: string, name: string): void {
  const list = readList();
  if (list.some((i) => i.ticker === ticker.toUpperCase())) return;
  list.push({ ticker: ticker.toUpperCase(), name, addedAt: new Date().toISOString() });
  writeList(list);
}

export function removeFromWatchlist(ticker: string): void {
  const list = readList().filter((i) => i.ticker !== ticker.toUpperCase());
  writeList(list);
}

export function isInWatchlist(ticker: string): boolean {
  return readList().some((i) => i.ticker === ticker.toUpperCase());
}
