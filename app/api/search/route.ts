import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/api/alpha-vantage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchSymbols(query);
    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suchfehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
