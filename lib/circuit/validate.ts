import type { Build } from "@/lib/types";
import { partsById } from "@/data/parts";

/** Minimal shape validation for builds posted to the API. */
export function parseBuild(input: unknown): Build | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Build;
  if (!Array.isArray(b.instances) || !Array.isArray(b.wires)) return null;
  if (b.instances.length > 120 || b.wires.length > 600) return null;
  for (const i of b.instances) {
    if (typeof i.id !== "string" || !partsById[i.partId] || typeof i.label !== "string") return null;
    if (!/^[A-Z]{1,3}\d{1,3}$/.test(i.label)) return null;
  }
  for (const w of b.wires) if (!w?.from?.instanceId || !w?.to?.instanceId) return null;
  return { ...b, name: String(b.name ?? "build").slice(0, 80), dismissed: Array.isArray(b.dismissed) ? b.dismissed : [] };
}
