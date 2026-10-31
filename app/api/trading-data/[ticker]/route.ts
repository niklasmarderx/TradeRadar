import { getActionByTicker, loadTradingData } from "@/lib/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const result = await getActionByTicker(ticker);

  if (!result) {
    return Response.json({ error: "Ticker nicht gefunden" }, { status: 404 });
  }

  const data = await loadTradingData();

  return Response.json({
    ...result.action,
    relatedNews: result.relatedNews,
    market_phase: data.market_phase,
    updated: data.updated,
  });
}
