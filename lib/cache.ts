import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const CACHE_DIR = join(process.cwd(), ".cache");

interface CacheEntry<T> {
  fetchedAt: string;
  data: T;
}

interface RateLimit {
  date: string;
  count: number;
}

const MAX_DAILY_REQUESTS = 23; // Buffer from 25 limit

async function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await readFile(cacheFilePath(key), "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age < ttlMs) return entry.data;
    return null;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  await ensureCacheDir();
  const entry: CacheEntry<T> = { fetchedAt: new Date().toISOString(), data };
  await writeFile(cacheFilePath(key), JSON.stringify(entry), "utf-8");
}

/* ── Rate limiting ── */

const RATE_LIMIT_PATH = join(CACHE_DIR, "_rate-limit.json");

async function getRateLimit(): Promise<RateLimit> {
  try {
    const raw = await readFile(RATE_LIMIT_PATH, "utf-8");
    const rl: RateLimit = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (rl.date !== today) return { date: today, count: 0 };
    return rl;
  } catch {
    return { date: new Date().toISOString().slice(0, 10), count: 0 };
  }
}

export async function canMakeRequest(): Promise<boolean> {
  const rl = await getRateLimit();
  return rl.count < MAX_DAILY_REQUESTS;
}

export async function trackRequest(): Promise<void> {
  await ensureCacheDir();
  const rl = await getRateLimit();
  rl.count += 1;
  await writeFile(RATE_LIMIT_PATH, JSON.stringify(rl), "utf-8");
}

export async function getRemainingRequests(): Promise<number> {
  const rl = await getRateLimit();
  return MAX_DAILY_REQUESTS - rl.count;
}

/* ── TTL constants ── */
export const TTL = {
  DAILY_OHLCV: 4 * 60 * 60 * 1000,       // 4 hours
  COMPANY_OVERVIEW: 24 * 60 * 60 * 1000,  // 24 hours
  SEARCH: 7 * 24 * 60 * 60 * 1000,        // 7 days
  INTRADAY: 30 * 60 * 1000,               // 30 minutes
  YAHOO_OHLCV: 2 * 60 * 60 * 1000,        // 2 hours
  YAHOO_QUOTE: 5 * 60 * 1000,             // 5 minutes (realtime quotes)
} as const;

/**
 * Check if US markets are currently open (Mon-Fri 15:30-22:00 CET).
 */
export function isMarketHours(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false; // Weekend
  // US market: 14:30-21:00 UTC (9:30-16:00 ET)
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const minutesSinceMidnight = utcHour * 60 + utcMin;
  return minutesSinceMidnight >= 14 * 60 + 30 && minutesSinceMidnight <= 21 * 60;
}

/**
 * Returns dynamic scanner cache TTL based on market hours.
 * Shorter during market hours for fresher data.
 */
export function getScannerTtl(): number {
  return isMarketHours()
    ? 30 * 60 * 1000   // 30 minutes during market hours
    : 4 * 60 * 60 * 1000; // 4 hours off-hours
}
