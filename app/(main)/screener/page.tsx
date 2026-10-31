import { scanQuick, getTopPicks, scanUniverse, type ScanResult } from "@/lib/scanner";
import { getCached } from "@/lib/cache";
import { scanResultToAction } from "@/lib/scan-helpers";
import type { Action } from "@/lib/types";
import Screener from "@/components/Screener";

export const metadata = {
  title: "Screener — TradeRadar",
  description: "Aktien filtern und sortieren nach Signal, Strategie und Konfidenz",
};

export default async function ScreenerPage() {
  let results: ScanResult[] = [];

  // Try full scan cache first (has all tiers), then quick scan
  const fullCached = await getCached<ScanResult[]>("scanner-latest", 2 * 60 * 60 * 1000);
  if (fullCached && fullCached.length > 0) {
    results = fullCached;
  } else {
    try {
      results = await scanQuick();
    } catch {
      results = [];
    }
  }

  // Convert all results (not just top picks) so screener can filter them all
  const actions = results
    .filter((r) => r.score !== 0)
    .map(scanResultToAction);

  return <Screener actions={actions} />;
}
