import { NextResponse } from "next/server";
import { fetchFundamentals, fetchExtendedData } from "@/lib/api/yahoo-finance";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  const [fundamentals, extended] = await Promise.all([
    fetchFundamentals(ticker),
    fetchExtendedData(ticker),
  ]);

  if (!fundamentals) {
    return NextResponse.json(
      { error: "Keine Fundamentaldaten verfuegbar" },
      { status: 404 }
    );
  }

  return NextResponse.json({ fundamentals, extended });
}
