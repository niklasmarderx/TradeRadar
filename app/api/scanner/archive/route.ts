import { NextResponse } from "next/server";
import { loadArchive } from "@/lib/scanner";

export const dynamic = "force-dynamic";

/**
 * GET /api/scanner/archive
 * Returns daily snapshots of scan results.
 * Query params:
 *   ?days=30  — number of days to load (default 30)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);

    const snapshots = await loadArchive(days);

    return NextResponse.json({
      snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    console.error("Archive error:", error);
    return NextResponse.json(
      { error: "Archiv konnte nicht geladen werden" },
      { status: 500 }
    );
  }
}
