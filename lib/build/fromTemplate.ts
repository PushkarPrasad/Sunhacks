import type { Build, Instance, Part, Template, Wire } from "@/lib/types";
import { nextDesignator } from "./designators";
import { uid } from "./ids";
import { autoLayout } from "./layout";

export function emptyBuild(name = "Untitled build"): Build {
  const now = Date.now();
  return { id: uid("b"), name, instances: [], wires: [], dismissed: [], createdAt: now, updatedAt: now };
}

export function buildFromTemplate(t: Template, getPart: (id: string) => Part | undefined): Build {
  const b = emptyBuild(t.name);
  b.templateId = t.id;
  b.categoryId = t.categoryId;
  b.budgetUSD = t.budgetUSD;
  const refToId = new Map<string, string>();
  const instances: Instance[] = [];
  for (const ti of t.instances) {
    const part = getPart(ti.partId);
    if (!part) throw new Error(`Template ${t.id} uses unknown part ${ti.partId}`);
    const id = uid("i");
    refToId.set(ti.ref, id);
    instances.push({
      id,
      partId: ti.partId,
      label: nextDesignator(part, instances),
      ...(ti.label ? { title: ti.label } : {}),
      x: ti.x ?? 0,
      y: ti.y ?? 0,
      rotation: ti.rotation ?? 0,
    });
  }
  const needsLayout = t.instances.some((i) => i.x === undefined);
  b.instances = needsLayout ? autoLayout(instances, getPart) : instances;
  const wires: Wire[] = [];
  for (const [a, c] of t.wires) {
    const pa = parseRef(a);
    const pc = parseRef(c);
    const ia = refToId.get(pa.ref);
    const ic = refToId.get(pc.ref);
    if (!ia || !ic) throw new Error(`Template ${t.id}: bad wire ${a} -> ${c}`);
    wires.push({ id: uid("w"), from: { instanceId: ia, pin: pa.pin }, to: { instanceId: ic, pin: pc.pin } });
  }
  b.wires = wires;
  return b;
}

/** "ref.PIN" -> { ref, pin }. Pin names may contain dots ("3.3V"), refs never do. */
export function parseRef(s: string): { ref: string; pin: string } {
  const i = s.indexOf(".");
  return { ref: s.slice(0, i), pin: s.slice(i + 1) };
}
