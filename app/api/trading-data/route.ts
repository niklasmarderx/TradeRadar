import { loadTradingData } from "@/lib/data";

export async function GET() {
  const data = await loadTradingData();
  return Response.json(data);
}
