// Connectivity: wires + internal ties -> nets (union-find). Pure.

import type { Build, Part, Pin, PinRef } from "@/lib/types";

export const pinKey = (r: PinRef) => `${r.instanceId}:${r.pin}`;
export const parsePinKey = (k: string): PinRef => {
  const i = k.indexOf(":");
  return { instanceId: k.slice(0, i), pin: k.slice(i + 1) };
};

export interface NetPin extends PinRef {
  part: Part;
  def: Pin;
  label: string;
}

export interface Net {
  id: string;
  pins: NetPin[];
  /** Wire ids that belong to this net. */
  wireIds: string[];
}

class UnionFind {
  parent = new Map<string, string>();
  find(a: string): string {
    if (!this.parent.has(a)) this.parent.set(a, a);
    let r = a;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    // path compression
    let c = a;
    while (this.parent.get(c) !== r) {
      const n = this.parent.get(c)!;
      this.parent.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
}

const baseName = (n: string) => n.replace(/_\d+$/, "");

/** Pins of one part that are the same node on the module itself. */
export function internalGroups(part: Part): string[][] {
  const groups: string[][] = [];
  const grounds = part.pins.filter((p) => p.type === "ground").map((p) => p.name);
  if (grounds.length > 1) groups.push(grounds);
  const byBase = new Map<string, string[]>();
  for (const p of part.pins) {
    if (p.type !== "power_in" && p.type !== "power_out") continue;
    if (p.voltageFrom) continue;
    const k = `${p.type}:${baseName(p.name)}`;
    byBase.set(k, [...(byBase.get(k) ?? []), p.name]);
  }
  for (const g of byBase.values()) if (g.length > 1) groups.push(g);
  for (const t of part.ties ?? []) groups.push(t);
  return groups;
}

export function computeNets(build: Build, getPart: (id: string) => Part | undefined): Net[] {
  const uf = new UnionFind();
  const instances = new Map(build.instances.map((i) => [i.id, i]));
  const used = new Set<string>();

  for (const inst of build.instances) {
    const part = getPart(inst.partId);
    if (!part) continue;
    for (const g of internalGroups(part)) {
      for (let i = 1; i < g.length; i++) uf.union(`${inst.id}:${g[0]}`, `${inst.id}:${g[i]}`);
    }
  }
  const wireRoot = new Map<string, string>();
  for (const w of build.wires) {
    if (!instances.has(w.from.instanceId) || !instances.has(w.to.instanceId)) continue;
    const a = pinKey(w.from);
    const b = pinKey(w.to);
    uf.union(a, b);
    used.add(a);
    used.add(b);
  }
  for (const w of build.wires) wireRoot.set(w.id, uf.find(pinKey(w.from)));

  // Collect every pin of every instance into its root, but only keep nets that include a wired pin.
  const groups = new Map<string, NetPin[]>();
  for (const inst of build.instances) {
    const part = getPart(inst.partId);
    if (!part) continue;
    for (const def of part.pins) {
      const key = `${inst.id}:${def.name}`;
      const root = uf.find(key);
      const arr = groups.get(root) ?? [];
      arr.push({ instanceId: inst.id, pin: def.name, part, def, label: inst.label });
      groups.set(root, arr);
    }
  }
  const usedRoots = new Set([...used].map((k) => uf.find(k)));
  const nets: Net[] = [];
  for (const [root, pins] of groups) {
    if (!usedRoots.has(root)) continue;
    const wireIds = build.wires.filter((w) => wireRoot.get(w.id) === root).map((w) => w.id);
    nets.push({ id: root, pins, wireIds });
  }
  return nets.sort((a, b) => a.id.localeCompare(b.id));
}

/** Map from pin key to net id for quick lookups. */
export function netIndex(nets: Net[]): Map<string, Net> {
  const m = new Map<string, Net>();
  for (const n of nets) for (const p of n.pins) m.set(pinKey(p), n);
  return m;
}
