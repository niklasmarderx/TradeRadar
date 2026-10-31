import { addPosition } from "@/lib/portfolio";

export interface Pick {
  id: string;
  ticker: string;
  name: string;
  buyPrice: number;
  shares: number;
  buyDate: string;
  notes: string;
  archived: boolean;
  archivedAt?: string;
  sellPrice?: number;
}

const PICKS_KEY = "traderadar-picks";

function readPicks(): Pick[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PICKS_KEY);
    return raw ? (JSON.parse(raw) as Pick[]) : [];
  } catch {
    return [];
  }
}

function writePicks(picks: Pick[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
}

export function getPicks(): Pick[] {
  return readPicks();
}

export function getActivePicks(): Pick[] {
  return readPicks().filter((p) => !p.archived);
}

export function getArchivedPicks(): Pick[] {
  return readPicks().filter((p) => p.archived);
}

export function addPick(pick: Omit<Pick, "id" | "archived">): Pick {
  const list = readPicks();
  const newPick: Pick = {
    ...pick,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    archived: false,
  };
  list.push(newPick);
  writePicks(list);

  // Auto-sync to portfolio
  addPosition({
    ticker: pick.ticker,
    name: pick.name,
    shares: pick.shares,
    avgPrice: pick.buyPrice,
  });

  return newPick;
}

export function updatePick(id: string, updates: Partial<Pick>): void {
  const list = readPicks();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  writePicks(list);
}

export function archivePick(id: string, sellPrice?: number): void {
  updatePick(id, {
    archived: true,
    archivedAt: new Date().toISOString(),
    sellPrice,
  });
}

export function deletePick(id: string): void {
  const list = readPicks().filter((p) => p.id !== id);
  writePicks(list);
}
