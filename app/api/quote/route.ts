import { quoteBoard } from "@/lib/integrations/tinyfish";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { w?: number; h?: number; qty?: number; layers?: number } | null;
  const w = Math.min(500, Math.max(10, Number(b?.w) || 50));
  const h = Math.min(500, Math.max(10, Number(b?.h) || 50));
  const qty = [5, 10, 30, 50, 100].includes(Number(b?.qty)) ? Number(b?.qty) : 5;
  return Response.json(await quoteBoard(w, h, qty, b?.layers === 4 ? 4 : 2));
}
