import { getPrices } from "@/lib/integrations/tinyfish";
import { recordPrice } from "@/lib/integrations/tigerdata";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 40);
  const prices = await getPrices(ids);
  // Live prices also feed the Tiger Data history table when it is configured.
  await Promise.all(Object.entries(prices).filter(([, p]) => p.live).map(([id, p]) => recordPrice(id, p.priceUSD, p.source)));
  return Response.json({ prices });
}
