import "server-only";
import { partsById } from "@/data/parts";
import { estimateBoardUSD } from "@/lib/checks/cost";
import { env, fetchJson } from "./config";

// TinyFish Web Agent: POST {url, goal} with X-API-Key, extracted JSON comes back in `result`.
// Docs: https://docs.tinyfish.ai (sync endpoint /v1/automation/run). Mock: stored catalogue prices.

interface RunResponse {
  status?: string;
  result?: Record<string, unknown> | null;
}

async function run(url: string, goal: string): Promise<Record<string, unknown> | null> {
  if (!env.tinyfishKey) return null;
  const r = await fetchJson<RunResponse>(env.tinyfishUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-Key": env.tinyfishKey },
    body: JSON.stringify({ url, goal, browser_profile: "lite", agent_config: { max_steps: 25 } }),
    timeoutMs: 60_000,
  });
  return r.status === "COMPLETED" ? (r.result ?? null) : null;
}

export interface LivePrice {
  priceUSD: number;
  source: string;
  live: boolean;
  datasheetUrl?: string;
}

const priceCache = new Map<string, { at: number; value: LivePrice }>();
const DAY = 24 * 3600 * 1000;

export async function getPrices(ids: string[]): Promise<Record<string, LivePrice>> {
  const out: Record<string, LivePrice> = {};
  for (const id of ids) {
    const p = partsById[id];
    if (!p) continue;
    const stored: LivePrice = { priceUSD: p.priceUSD, source: "catalogue", live: false, datasheetUrl: p.datasheetUrl };
    out[id] = stored;
    if (!env.tinyfishKey) continue;
    const hit = priceCache.get(id);
    if (hit && Date.now() - hit.at < DAY) {
      out[id] = hit.value;
      continue;
    }
    try {
      const q = encodeURIComponent(p.name.replace(/\(.*?\)/g, ""));
      const result = await run(
        `https://www.digikey.com/en/products/result?keywords=${q}`,
        `Find the lowest single-unit price in USD for "${p.name}" by ${p.manufacturer}, and a datasheet link if shown. Return JSON {"price_usd": number, "store": string, "datasheet_url": string|null}.`,
      );
      const price = Number(result?.price_usd);
      if (price > 0) {
        const v: LivePrice = { priceUSD: Math.round(price * 100) / 100, source: String(result?.store ?? "store page"), live: true, datasheetUrl: (result?.datasheet_url as string) || p.datasheetUrl };
        priceCache.set(id, { at: Date.now(), value: v });
        out[id] = v;
      }
    } catch {
      // keep the stored price
    }
  }
  return out;
}

export interface Quote {
  qty: number;
  boardUSD: number;
  perBoardUSD: number;
  assemblyNote: string;
  leadDays: number;
  source: string;
  live: boolean;
  assumptions: string[];
}

export async function quoteBoard(w: number, h: number, qty: number, layers = 2): Promise<Quote> {
  const base = estimateBoardUSD(w, h, 5);
  const scaled = Math.round((base + Math.max(0, qty - 5) * Math.max(0.4, (w * h) / 10000) * 0.9) * 100) / 100;
  const mock: Quote = {
    qty,
    boardUSD: scaled,
    perBoardUSD: Math.round((scaled / qty) * 100) / 100,
    assemblyNote: "Through-hole headers: hand-solder (about 20 min per board)",
    leadDays: 7,
    source: "Estimate",
    live: false,
    assumptions: [`${layers}-layer FR-4, 1.6 mm, HASL, green mask`, "$2 for 5 boards up to 100 × 100 mm", "$0.05 per extra cm² per board, $6 shipping", "No assembly service"],
  };
  if (!env.tinyfishKey) return mock;
  try {
    const result = await run(
      "https://cart.jlcpcb.com/quote",
      `Get a PCB price quote for a ${layers}-layer board, ${w} mm x ${h} mm, quantity ${qty}, 1.6 mm, HASL. Return JSON {"total_usd": number, "build_days": number}.`,
    );
    const total = Number(result?.total_usd);
    if (total > 0) return { ...mock, boardUSD: total, perBoardUSD: Math.round((total / qty) * 100) / 100, leadDays: Number(result?.build_days) || mock.leadDays, source: "JLCPCB via TinyFish", live: true };
  } catch {
    // fall back to estimate
  }
  return mock;
}
