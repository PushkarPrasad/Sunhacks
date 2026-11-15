import "server-only";
import { createHash } from "node:crypto";
import type { Build, Part } from "@/lib/types";
import { generateCircuit, type GeneratedCircuit } from "./generate";

// Routing is deterministic for a given build, so cache by a hash of what affects the board.
const cache = new Map<string, Promise<GeneratedCircuit>>();
const MAX = 40;

export function buildHash(b: Build): string {
  const key = JSON.stringify({
    i: b.instances.map((i) => [i.id, i.partId, i.label, i.rotation, Math.round(i.x / 40), Math.round(i.y / 40)]),
    w: b.wires.map((w) => [w.from.instanceId, w.from.pin, w.to.instanceId, w.to.pin]),
    b: b.board ?? null,
  });
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}

export function cachedCircuit(b: Build, getPart: (id: string) => Part | undefined): Promise<GeneratedCircuit> {
  const h = buildHash(b);
  const hit = cache.get(h);
  if (hit) return hit;
  const p = generateCircuit(b, getPart).catch((e) => {
    cache.delete(h);
    throw e;
  });
  cache.set(h, p);
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return p;
}
