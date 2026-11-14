// Pure build operations. Every edit the UI makes goes through here, which keeps Apply/undo predictable.

import type { Build, Fix, Instance, Part, PinRef, Wire } from "@/lib/types";
import { nextDesignator } from "./designators";
import { cardGeometry } from "./geometry";
import { uid } from "./ids";
import { pinKey } from "./nets";

type GetPart = (id: string) => Part | undefined;

const touch = (b: Build): Build => ({ ...b, updatedAt: Date.now() });

export function addInstance(b: Build, part: Part, x: number, y: number, extra: Partial<Instance> = {}): { build: Build; id: string } {
  const id = uid("i");
  const inst: Instance = { id, partId: part.id, label: nextDesignator(part, b.instances), x: Math.round(x), y: Math.round(y), rotation: 0, ...extra };
  return { build: touch({ ...b, instances: [...b.instances, inst] }), id };
}

export function moveInstance(b: Build, id: string, x: number, y: number): Build {
  return touch({ ...b, instances: b.instances.map((i) => (i.id === id ? { ...i, x: Math.round(x), y: Math.round(y) } : i)) });
}

export function rotateInstance(b: Build, id: string): Build {
  const next = { 0: 90, 90: 180, 180: 270, 270: 0 } as const;
  return touch({ ...b, instances: b.instances.map((i) => (i.id === id ? { ...i, rotation: next[i.rotation] } : i)) });
}

export function removeInstance(b: Build, id: string): Build {
  return touch({
    ...b,
    instances: b.instances.filter((i) => i.id !== id),
    wires: b.wires.filter((w) => w.from.instanceId !== id && w.to.instanceId !== id),
  });
}

export function hasWire(b: Build, a: PinRef, c: PinRef): boolean {
  const ka = pinKey(a);
  const kc = pinKey(c);
  return b.wires.some((w) => (pinKey(w.from) === ka && pinKey(w.to) === kc) || (pinKey(w.from) === kc && pinKey(w.to) === ka));
}

export function addWire(b: Build, from: PinRef, to: PinRef): { build: Build; id: string | null } {
  if (pinKey(from) === pinKey(to) || hasWire(b, from, to)) return { build: b, id: null };
  const id = uid("w");
  return { build: touch({ ...b, wires: [...b.wires, { id, from, to }] }), id };
}

export function removeWire(b: Build, id: string): Build {
  return touch({ ...b, wires: b.wires.filter((w) => w.id !== id) });
}

export function setAddress(b: Build, instanceId: string, address: string): Build {
  return touch({ ...b, instances: b.instances.map((i) => (i.id === instanceId ? { ...i, config: { ...i.config, i2cAddress: address } } : i)) });
}

/** Swaps a part for another, keeping wires whose pin names exist on the new part. */
export function swapPart(b: Build, instanceId: string, to: Part, getPart: GetPart): Build {
  const inst = b.instances.find((i) => i.id === instanceId);
  if (!inst) return b;
  const names = new Set(to.pins.map((p) => p.name));
  const wires = b.wires.filter((w) => {
    if (w.from.instanceId === instanceId && !names.has(w.from.pin)) return false;
    if (w.to.instanceId === instanceId && !names.has(w.to.pin)) return false;
    return true;
  });
  const old = getPart(inst.partId);
  const others = b.instances.filter((i) => i.id !== instanceId);
  const label = old && old.category === to.category ? inst.label : nextDesignator(to, others);
  return touch({
    ...b,
    instances: b.instances.map((i) => (i.id === instanceId ? { ...i, partId: to.id, label, config: undefined } : i)),
    wires,
  });
}

function near(b: Build, instanceId: string | undefined, getPart: GetPart): { x: number; y: number } {
  const inst = instanceId ? b.instances.find((i) => i.id === instanceId) : undefined;
  if (!inst) {
    const maxX = Math.max(0, ...b.instances.map((i) => i.x + 220));
    return { x: maxX + 40, y: 0 };
  }
  const p = getPart(inst.partId);
  const h = p ? cardGeometry(p, inst.rotation).h : 120;
  return { x: inst.x, y: inst.y + h + 32 };
}

function wiresOnPin(b: Build, ref: PinRef): Wire[] {
  const k = pinKey(ref);
  return b.wires.filter((w) => pinKey(w.from) === k || pinKey(w.to) === k);
}

export function applyFix(b: Build, fix: Fix, getPart: GetPart): Build {
  switch (fix.kind) {
    case "swapPart": {
      const to = getPart(fix.toPartId);
      return to ? swapPart(b, fix.instanceId, to, getPart) : b;
    }
    case "rewire": {
      return touch({ ...b, wires: b.wires.map((w) => (w.id === fix.wireId ? { ...w, [fix.end]: fix.to } : w)) });
    }
    case "setAddress":
      return setAddress(b, fix.instanceId, fix.address);
    case "resizeBoard":
      return touch({ ...b, board: { w: fix.w, h: fix.h } });
    case "removeWire":
      return removeWire(b, fix.wireId);
    case "connect":
      return addWire(b, fix.from, fix.to).build;
    case "addPart": {
      const part = getPart(fix.partId);
      if (!part) return b;
      const pos = near(b, fix.near, getPart);
      return addInstance(b, part, pos.x, pos.y).build;
    }
    case "insertLevelShifter":
      return insertLevelShifter(b, fix, getPart);
    case "insertDriver":
      return insertDriver(b, fix, getPart);
  }
}

function insertLevelShifter(b: Build, fix: Extract<Fix, { kind: "insertLevelShifter" }>, getPart: GetPart): Build {
  const shifterPart = getPart("level-shifter");
  if (!shifterPart) return b;
  let build = b;
  // Reuse a shifter that already has a free channel.
  let shifterId: string | undefined;
  let channel = 0;
  for (const inst of build.instances.filter((i) => i.partId === "level-shifter")) {
    for (let ch = 1; ch <= 4; ch++) {
      const busy = wiresOnPin(build, { instanceId: inst.id, pin: `LV${ch}` }).length || wiresOnPin(build, { instanceId: inst.id, pin: `HV${ch}` }).length;
      if (!busy) {
        shifterId = inst.id;
        channel = ch;
        break;
      }
    }
    if (shifterId) break;
  }
  if (!shifterId) {
    const pos = near(build, fix.high.instanceId, getPart);
    const added = addInstance(build, shifterPart, pos.x, pos.y);
    build = added.build;
    shifterId = added.id;
    channel = 1;
  }
  const S = (pin: string) => ({ instanceId: shifterId!, pin });
  build = removeWire(build, fix.wireId);
  build = addWire(build, fix.low, S(`LV${channel}`)).build;
  build = addWire(build, fix.high, S(`HV${channel}`)).build;
  if (!wiresOnPin(build, S("LV")).length) build = addWire(build, S("LV"), fix.lowRail).build;
  if (!wiresOnPin(build, S("HV")).length) build = addWire(build, S("HV"), fix.highRail).build;
  if (!wiresOnPin(build, S("GND")).length) build = addWire(build, S("GND"), fix.ground).build;
  return build;
}

function insertDriver(b: Build, fix: Extract<Fix, { kind: "insertDriver" }>, getPart: GetPart): Build {
  const load = b.instances.find((i) => i.id === fix.load);
  const loadPart = load ? getPart(load.partId) : undefined;
  const q = getPart("npn-2n2222");
  const r = getPart("res-1k");
  if (!load || !loadPart || !q || !r) return b;
  const plus = loadPart.pins.find((p) => p.type === "power_in");
  const minus = loadPart.pins.find((p) => p !== plus && (p.type === "passive" || p.type === "ground"));
  if (!plus || !minus) return b;
  let build = b;
  // Remove the load's existing connections; it gets re-wired around the transistor.
  for (const w of [...wiresOnPin(build, { instanceId: load.id, pin: plus.name }), ...wiresOnPin(build, { instanceId: load.id, pin: minus.name })]) {
    build = removeWire(build, w.id);
  }
  // Remove a series resistor between the GPIO and the load if one is left dangling (LED case is not handled here).
  const pos = near(build, load.id, getPart);
  const qa = addInstance(build, q, pos.x, pos.y);
  build = qa.build;
  const ra = addInstance(build, r, pos.x + 180, pos.y);
  build = ra.build;
  const Q = (pin: string) => ({ instanceId: qa.id, pin });
  const R = (pin: string) => ({ instanceId: ra.id, pin });
  build = addWire(build, { instanceId: load.id, pin: plus.name }, fix.supply).build;
  build = addWire(build, { instanceId: load.id, pin: minus.name }, Q("C")).build;
  build = addWire(build, Q("E"), fix.ground).build;
  build = addWire(build, Q("B"), R("1")).build;
  build = addWire(build, R("2"), fix.gpio).build;
  return build;
}
