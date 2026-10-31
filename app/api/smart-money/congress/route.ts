import { NextRequest, NextResponse } from "next/server";
import { fetchCongressTrades } from "@/lib/api/smart-money";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const politician = searchParams.get("politician")?.toLowerCase();

  let trades = await fetchCongressTrades();

  if (ticker) {
    trades = trades.filter((t) => t.ticker === ticker);
  }
  if (politician) {
    trades = trades.filter((t) => t.representative.toLowerCase().includes(politician));
  }

  return NextResponse.json({ trades, total: trades.length });
}
