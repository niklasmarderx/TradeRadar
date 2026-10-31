import { NextResponse } from "next/server";
import { fetchWhalePortfolio } from "@/lib/api/smart-money";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const portfolio = await fetchWhalePortfolio(id);

  if (!portfolio) {
    return NextResponse.json({ error: "Whale not found or data unavailable" }, { status: 404 });
  }

  return NextResponse.json(portfolio);
}
