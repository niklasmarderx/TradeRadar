import { NextResponse } from "next/server";
import { prepareAnalysisRequest } from "@/lib/analysis-helpers";
import { analyzeStock } from "@/lib/api/claude";

export async function POST(request: Request) {
  try {
    const { tickers } = (await request.json()) as { tickers: string[] };
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: "Tickers-Array fehlt" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const total = tickers.length;

        for (let i = 0; i < total; i++) {
          const ticker = tickers[i].toUpperCase();

          try {
            // Progress: researching
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ ticker, status: "researching", progress: i / total })}\n\n`
              )
            );

            const analysisReq = await prepareAnalysisRequest(ticker);

            // Progress: analyzing
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  ticker,
                  status: "analyzing",
                  progress: (i + 0.5) / total,
                  research: analysisReq.research,
                })}\n\n`
              )
            );

            const result = await analyzeStock(analysisReq);

            // Done
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  ticker,
                  status: "done",
                  progress: (i + 1) / total,
                  result,
                })}\n\n`
              )
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Fehler";
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ ticker, status: "error", error: msg, progress: (i + 1) / total })}\n\n`
              )
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
