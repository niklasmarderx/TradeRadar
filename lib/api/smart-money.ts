import { getCached, setCache } from "@/lib/cache";
import { WHALE_LIST } from "@/lib/api/smart-money-types";
import type { CongressTrade, WhaleHolding, WhalePortfolio, InsiderTrade, InstitutionalHolder, InsiderData, WhaleInfo } from "@/lib/api/smart-money-types";

// Re-export all types and constants so existing server-side imports still work
export type { CongressTrade, WhaleHolding, WhalePortfolio, WhaleInfo, InsiderTrade, InstitutionalHolder, InsiderData };
export { WHALE_LIST };

/* ══════════════════════════════════════════════════════════════
   Smart Money API Client (server-only fetch functions)
   Sources:
     1. Quiver Quant — Congressional stock trading (free, no key)
     2. SEC EDGAR — 13F whale portfolios (free, User-Agent only)
     3. Yahoo Finance — Insider transactions (already integrated)
   ══════════════════════════════════════════════════════════════ */

function getWhaleById(id: string): WhaleInfo | undefined {
  return WHALE_LIST.find((w) => w.id === id);
}

// ── CUSIP → Ticker mapping (common stocks) ──

const CUSIP_TO_TICKER: Record<string, string> = {
  "037833100": "AAPL", "594918104": "MSFT", "02079K305": "GOOGL",
  "023135106": "AMZN", "67066G104": "NVDA", "30303M102": "META",
  "88160R101": "TSLA", "025816109": "AXP", "191216100": "KO",
  "060505104": "BAC", "674599105": "OXY", "H1467J104": "CHUBB",
  "166764100": "CVX", "500754106": "KHC", "615369105": "MCO",
  "02079K107": "GOOG", "92826C839": "V", "57636Q104": "MA",
  "46625H100": "JPM", "931142103": "WMT", "742718109": "PG",
};

function cusipToTicker(cusip: string, name: string): string {
  if (CUSIP_TO_TICKER[cusip]) return CUSIP_TO_TICKER[cusip];
  // Fallback: create ticker from name (best effort)
  const clean = name.replace(/\s+(INC|CORP|CO|LTD|PLC|AG|SA|NV|NEW|CL [A-Z])\.?$/gi, "").trim();
  return clean.substring(0, 6).toUpperCase().replace(/\s/g, "");
}

// ── Range parsing ──

function parseRange(range: string): { min: number; max: number } {
  const nums = range.match(/[\d,]+/g)?.map((s) => parseInt(s.replace(/,/g, ""), 10)) ?? [];
  return { min: nums[0] ?? 0, max: nums[1] ?? nums[0] ?? 0 };
}

// ── Congressional Trading (Quiver Quant) ──

const CONGRESS_CACHE_KEY = "smart-money-congress";
const CONGRESS_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function fetchCongressTrades(): Promise<CongressTrade[]> {
  const cached = await getCached<CongressTrade[]>(CONGRESS_CACHE_KEY, CONGRESS_TTL);
  if (cached) return cached;

  const res = await fetch("https://api.quiverquant.com/beta/live/congresstrading", {
    headers: { Authorization: "Bearer test" },
    next: { revalidate: 14400 }, // 4h
  });

  if (!res.ok) {
    console.error("Quiver Quant API error:", res.status);
    return [];
  }

  const raw: Array<{
    Representative: string;
    Party: string;
    House: string;
    Ticker: string;
    Transaction: string;
    TransactionDate: string;
    ReportDate: string;
    Range: string;
  }> = await res.json();

  const trades: CongressTrade[] = raw
    .filter((t) => t.Ticker && t.TransactionDate)
    .map((t) => {
      const { min, max } = parseRange(t.Range ?? "");
      return {
        representative: t.Representative,
        party: t.Party,
        house: t.House as CongressTrade["house"],
        ticker: t.Ticker,
        transaction: t.Transaction,
        transactionDate: t.TransactionDate,
        reportDate: t.ReportDate,
        range: t.Range ?? "",
        rangeMin: min,
        rangeMax: max,
      };
    })
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  await setCache(CONGRESS_CACHE_KEY, trades);
  return trades;
}

// ── SEC EDGAR 13F (Whale Portfolios) ──

const EDGAR_UA = "TradeRadar/1.0 contact@traderadar.dev";

async function edgarFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": EDGAR_UA, Accept: "application/json,application/xml,text/xml,*/*" },
  });
}

export async function fetchWhalePortfolio(whaleId: string): Promise<WhalePortfolio | null> {
  const whale = getWhaleById(whaleId);
  if (!whale) return null;

  const cacheKey = `smart-money-whale-${whaleId}`;
  const cached = await getCached<WhalePortfolio>(cacheKey, 7 * 24 * 60 * 60 * 1000); // 7 days
  if (cached) return cached;

  try {
    // Step 1: Get filing list
    const subRes = await edgarFetch(`https://data.sec.gov/submissions/CIK${whale.cik}.json`);
    if (!subRes.ok) return null;
    const submissions = await subRes.json();

    const recent = submissions.filings?.recent;
    if (!recent) return null;

    // Find latest 13F-HR filing
    let filingIdx = -1;
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === "13F-HR") {
        filingIdx = i;
        break;
      }
    }
    if (filingIdx === -1) return null;

    const filingDate = recent.filingDate[filingIdx];
    const accessionNumber = recent.accessionNumber[filingIdx];
    const accessionClean = accessionNumber.replace(/-/g, "");
    const cikNum = whale.cik.replace(/^0+/, "");

    // Step 2: Get filing index to find the infotable XML
    const indexRes = await edgarFetch(
      `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionClean}/${accessionNumber}-index.htm`
    );
    if (!indexRes.ok) return null;
    const indexHtml = await indexRes.text();

    // Find XML file (infotable or numbered XML that isn't primary_doc)
    const xmlMatches = indexHtml.match(/href="([^"]*\.xml)"/gi) ?? [];
    const xmlFiles = xmlMatches
      .map((m) => m.replace(/href="/i, "").replace(/"$/, ""))
      .filter((f) => !f.includes("primary_doc") && !f.includes("xsl"));

    if (xmlFiles.length === 0) return null;

    // The infotable XML is usually the non-primary one
    const xmlPath = xmlFiles[0];
    const xmlUrl = xmlPath.startsWith("http")
      ? xmlPath
      : `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionClean}/${xmlPath}`;

    // Step 3: Fetch and parse holdings XML
    const xmlRes = await edgarFetch(xmlUrl);
    if (!xmlRes.ok) return null;
    const xml = await xmlRes.text();

    // Parse XML — extract holdings
    const names = [...xml.matchAll(/<nameOfIssuer>([^<]+)<\/nameOfIssuer>/g)].map((m) => m[1]);
    const cusips = [...xml.matchAll(/<cusip>([^<]+)<\/cusip>/g)].map((m) => m[1]);
    const values = [...xml.matchAll(/<value>([^<]+)<\/value>/g)].map((m) => parseInt(m[1], 10));
    const shares = [...xml.matchAll(/<sshPrnamt>([^<]+)<\/sshPrnamt>/g)].map((m) => parseInt(m[1], 10));

    // Aggregate holdings by name (some stocks split into multiple entries like AAPL Class A/B)
    const holdingMap = new Map<string, WhaleHolding>();
    for (let i = 0; i < names.length; i++) {
      const key = cusips[i] ?? names[i];
      const existing = holdingMap.get(key);
      if (existing) {
        existing.value += (values[i] ?? 0) / 1000; // values in $thousands → millions
        existing.shares += shares[i] ?? 0;
      } else {
        holdingMap.set(key, {
          name: names[i] ?? "UNKNOWN",
          ticker: cusipToTicker(cusips[i] ?? "", names[i] ?? ""),
          value: (values[i] ?? 0) / 1000,
          shares: shares[i] ?? 0,
          cusip: cusips[i] ?? "",
        });
      }
    }

    const holdings = [...holdingMap.values()].sort((a, b) => b.value - a.value);
    const totalValue = holdings.reduce((s, h) => s + h.value, 0);

    const portfolio: WhalePortfolio = {
      whale,
      filingDate,
      periodOfReport: filingDate, // approximate
      holdings,
      totalValue,
    };

    await setCache(cacheKey, portfolio);
    return portfolio;
  } catch (error) {
    console.error(`EDGAR fetch error for ${whaleId}:`, error);
    return null;
  }
}

// ── Yahoo Finance Insider Data ──

export async function fetchInsiderData(ticker: string): Promise<InsiderData | null> {
  const cacheKey = `smart-money-insider-${ticker.toUpperCase()}`;
  const cached = await getCached<InsiderData>(cacheKey, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  try {
    // Dynamic import to avoid issues with yahoo-finance2 in edge runtime
    const { default: YahooFinance } = await import("yahoo-finance2");
    const yf = new (YahooFinance as unknown as new () => {
      quoteSummary: (ticker: string, opts: { modules: string[] }) => Promise<Record<string, unknown>>;
    })();

    const result = await yf.quoteSummary(ticker, {
      modules: ["insiderTransactions", "institutionOwnership", "majorHoldersBreakdown"],
    });

    const insiderTxns = (result as { insiderTransactions?: { transactions?: Array<{
      startDate?: Date; filerName?: string; filerRelation?: string;
      transactionText?: string; shares?: number; value?: number;
    }> } }).insiderTransactions?.transactions ?? [];

    const transactions: InsiderTrade[] = insiderTxns.map((t) => {
      const text = (t.transactionText ?? "").toLowerCase();
      let type: InsiderTrade["type"] = "other";
      if (text.includes("purchase") || text.includes("acquisition")) type = "buy";
      else if (text.includes("sale") || text.includes("disposition")) type = "sell";
      else if (text.includes("gift")) type = "gift";

      return {
        date: t.startDate?.toISOString().split("T")[0] ?? "",
        name: t.filerName ?? "",
        title: t.filerRelation ?? "",
        transactionText: t.transactionText ?? "",
        shares: t.shares ?? 0,
        value: t.value ?? null,
        type,
      };
    });

    const instOwnership = (result as { institutionOwnership?: { ownershipList?: Array<{
      organization?: string; pctHeld?: number; position?: number;
    }> } }).institutionOwnership?.ownershipList ?? [];

    const topHolders: InstitutionalHolder[] = instOwnership.slice(0, 10).map((h) => ({
      organization: h.organization ?? "",
      pctHeld: h.pctHeld ?? 0,
      position: h.position ?? 0,
    }));

    const majorBreakdown = (result as { majorHoldersBreakdown?: {
      insidersPercentHeld?: number; institutionsPercentHeld?: number;
    } }).majorHoldersBreakdown;

    const data: InsiderData = {
      ticker: ticker.toUpperCase(),
      insiderPercent: majorBreakdown?.insidersPercentHeld ?? null,
      institutionPercent: majorBreakdown?.institutionsPercentHeld ?? null,
      transactions,
      topHolders,
    };

    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Insider data error for ${ticker}:`, error);
    return null;
  }
}
