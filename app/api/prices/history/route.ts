import { priceHistory } from "@/lib/integrations/tigerdata";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("partId") ?? "";
  return Response.json(await priceHistory(id));
}
