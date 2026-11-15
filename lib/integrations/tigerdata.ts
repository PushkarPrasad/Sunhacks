import "server-only";
import { partsById } from "@/data/parts";
import { env } from "./config";

// Tiger Data (TimescaleDB): part_price_history hypertable. Mock: generated sample history, clearly labelled.
//   CREATE TABLE part_price_history (time timestamptz NOT NULL, part_id text NOT NULL, price_usd numeric NOT NULL, source text);
//   SELECT create_hypertable('part_price_history', 'time');

export interface PricePoint {
  t: string;
  price: number;
}

let pool: import("pg").Pool | null = null;
async function db() {
  if (!env.tigerUrl) return null;
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: env.tigerUrl, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

function sample(partId: string, days = 90): PricePoint[] {
  const p = partsById[partId];
  if (!p) return [];
  let seed = [...partId].reduce((s, c) => (s * 33 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out: PricePoint[] = [];
  let price = p.priceUSD * (1.08 + rand() * 0.1);
  const start = Date.UTC(2026, 7, 16);
  for (let d = 0; d < days; d += 3) {
    price = Math.max(p.priceUSD * 0.8, price + (p.priceUSD - price) * 0.08 + (rand() - 0.5) * p.priceUSD * 0.05);
    out.push({ t: new Date(start + d * 86400000).toISOString().slice(0, 10), price: Math.round(price * 100) / 100 });
  }
  out.push({ t: new Date(start + days * 86400000).toISOString().slice(0, 10), price: p.priceUSD });
  return out;
}

export async function priceHistory(partId: string): Promise<{ points: PricePoint[]; sample: boolean }> {
  const pg = await db().catch(() => null);
  if (pg) {
    try {
      const r = await pg.query(
        `SELECT time_bucket('3 days', time) AS t, avg(price_usd)::float AS price FROM part_price_history
         WHERE part_id = $1 AND time > now() - interval '90 days' GROUP BY 1 ORDER BY 1`,
        [partId],
      );
      if (r.rows.length > 1) return { points: r.rows.map((x) => ({ t: new Date(x.t).toISOString().slice(0, 10), price: Number(x.price) })), sample: false };
    } catch {
      // fall through to sample data
    }
  }
  return { points: sample(partId), sample: true };
}

export async function recordPrice(partId: string, price: number, source: string): Promise<void> {
  const pg = await db().catch(() => null);
  if (!pg) return;
  await pg.query("INSERT INTO part_price_history (time, part_id, price_usd, source) VALUES (now(), $1, $2, $3)", [partId, price, source]).catch(() => {});
}
