import { NextResponse } from "next/server";
import { fetchInsiderData } from "@/lib/api/smart-money";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const data = await fetchInsiderData(ticker);

  if (!data) {
    return NextResponse.json({ error: "No insider data available" }, { status: 404 });
  }

  return NextResponse.json(data);
}
