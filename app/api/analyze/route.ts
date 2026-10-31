import { NextResponse } from "next/server";
import { prepareAnalysisRequest } from "@/lib/analysis-helpers";
import { analyzeStockStream } from "@/lib/api/claude";

export async function POST(request: Request) {
  try {
    const { ticker } = (await request.json()) as { ticker: string };
    if (!ticker) {
      return NextResponse.json({ error: "Ticker fehlt" }, { status: 400 });
    }

    const analysisReq = await prepareAnalysisRequest(ticker);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (analysisReq.research) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ research: analysisReq.research })}\n\n`)
            );
          }

          for await (const chunk of analyzeStockStream(analysisReq)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Analyse-Fehler";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
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
