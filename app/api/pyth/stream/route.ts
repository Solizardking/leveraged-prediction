import { NextRequest } from "next/server";
import { fetchPythLatest } from "@/app/lib/pyth/server";
import { parsePythSymbolsParam } from "@/app/lib/pyth/symbols";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INTERVAL_MS = 1_000;

export async function GET(request: NextRequest) {
  let symbols: string[];
  try {
    symbols = parsePythSymbolsParam(request.nextUrl.searchParams.get("symbols"));
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Invalid symbols",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  if (!process.env.PYTH_API_KEY?.trim()) {
    return Response.json({
      error: "PYTH_API_KEY is not configured on the server",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const encoder = new TextEncoder();
  let stopped = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        if (stopped) return;
        try {
          const prices = await fetchPythLatest(symbols);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ prices })}\n\n`));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Pyth stream failed";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
        }
      };
      void send();
      const timer = setInterval(() => void send(), INTERVAL_MS);
      const close = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      stopped = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}
