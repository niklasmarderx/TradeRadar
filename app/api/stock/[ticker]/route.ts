import { NextResponse } from "next/server";
import { getOrFetchStockData } from "@/lib/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    const data = await getOrFetchStockData(ticker);
    if (!data) {
      return NextResponse.json(
        { error: `Keine Daten fuer ${ticker} gefunden` },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
