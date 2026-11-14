// Shared electrical model for the checks: nets, rails (nets with a supply), and who draws current from where.
// Pure; no browser or server APIs.

import type { Build, Instance, Part, PinRef } from "@/lib/types";
import { computeNets, netIndex, pinKey, type Net, type NetPin } from "@/lib/build/nets";

export type SourceKind = "regulator" | "boost" | "charger" | "battery" | "driver" | "controller" | "usb-assumed";

export interface Rail {
  net: Net;
  voltage: number;
  /** Highest voltage the rail reaches (a full Li-ion cell is 4.2 V, not 3.7 V). */
  vMax: number;
  source: NetPin | null;
  sourceKind: SourceKind;
  limit_mA: number | null;
  label: string;
}

export interface Load {
  instanceId: string;
  typical: number;
  peak: number;
}

export interface Analysis {
  build: Build;
  getPart: (partId: string) => Part | undefined;
  part: (instanceId: string) => Part | undefined;
  instance: (instanceId: string) => Instance | undefined;
  nets: Net[];
  netOf: Map<string, Net>;
  rails: Rail[];
  railOf: Map<string, Rail>;
  /** Loads per rail (net id), excluding the rail's own source. */
  railLoads: Map<string, Load[]>;
  /** Current an instance pulls from its input rail (own + everything it feeds). */
  draw: Map<string, { typical: number; peak: number }>;
  /** Parts powered straight from a controller GPIO (LEDs, buzzers). */
  gpioLoads: { instanceId: string; controllerId: string; pin: string; current: number }[];
  /** Controllers with no supply connection (assumed on USB). */
  usbAssumed: string[];
  controllers: string[];
}

const SOURCE_PRIORITY: Record<string, number> = { regulator: 5, boost: 5, charger: 4, battery: 3, driver: 2, controller: 1 };

function sourceKindOf(part: Part): SourceKind {
  switch (part.role) {
    case "regulator":
      return "regulator";
    case "boost":
      return "boost";
    case "charger":
      return "charger";
    case "battery":
      return "battery";
    case "driver":
      return "driver";
    case "controller":
      return "controller";
    default:
      return "regulator";
  }
}

const LI_CELL_MAX = 4.2 / 3.7;

export function analyze(build: Build, getPart: (id: string) => Part | undefined): Analysis {
  const instById = new Map(build.instances.map((i) => [i.id, i]));
  const part = (id: string) => {
    const inst = instById.get(id);
    return inst ? getPart(inst.partId) : undefined;
  };
  const nets = computeNets(build, getPart);
  const netOf = netIndex(nets);
  const controllers = build.instances.filter((i) => getPart(i.partId)?.role === "controller").map((i) => i.id);

  // ---- rails: choose a primary source per net ----
  const rails: Rail[] = [];
  const railOf = new Map<string, Rail>();
  const pendingDerived: { net: Net; src: NetPin }[] = [];

  for (const net of nets) {
    const sources = net.pins.filter((p) => p.def.type === "power_out");
    if (sources.length === 0) continue;
    const ranked = [...sources].sort(
      (a, b) => (SOURCE_PRIORITY[sourceKindOf(b.part)] ?? 0) - (SOURCE_PRIORITY[sourceKindOf(a.part)] ?? 0),
    );
    const src = ranked[0];
    if (src.def.voltageFrom) {
      pendingDerived.push({ net, src });
      continue;
    }
    rails.push(makeRail(net, src, src.def.voltage ?? 0));
  }
  for (const r of rails) railOf.set(r.net.id, r);

  // Derived rails (motor driver outputs, amplifier speaker outputs) take the voltage of their input pin's rail.
  for (const { net, src } of pendingDerived) {
    const inKey = pinKey({ instanceId: src.instanceId, pin: src.def.voltageFrom! });
    const inNet = netOf.get(inKey);
    const upstream = inNet ? railOf.get(inNet.id) : undefined;
    const r = makeRail(net, src, upstream?.voltage ?? 0);
    if (upstream) r.vMax = upstream.vMax;
    rails.push(r);
    railOf.set(net.id, r);
  }

  function makeRail(net: Net, src: NetPin, voltage: number): Rail {
    const kind = sourceKindOf(src.part);
    let limit: number | null = null;
    const pw = src.part.power;
    if (kind === "controller") limit = voltage <= 3.4 ? pw?.onboard3v3_mA ?? null : 500;
    else limit = pw?.maxOutput_mA ?? null;
    const isLi = src.part.power?.chemistry === "LiPo" || src.part.power?.chemistry === "Li-ion 18650";
    const passthroughLi = kind === "charger" || (kind === "controller" && src.def.name.startsWith("BAT"));
    const vMax = isLi || passthroughLi ? Math.round(voltage * LI_CELL_MAX * 100) / 100 : voltage;
    return {
      net,
      voltage,
      vMax,
      source: src,
      sourceKind: kind,
      limit_mA: limit,
      label: `${src.label}.${src.def.name}`,
    };
  }

  // ---- consumers ----
  // A pin draws from a rail when it is a power_in on that net, or a controller's power_out pin that shares a
  // net with a different (higher-priority) source (e.g. an LDO feeding the ESP32's 3V3 pin).
  const consumersOf = new Map<string, NetPin[]>();
  for (const r of rails) {
    const list: NetPin[] = [];
    for (const p of r.net.pins) {
      if (r.source && p.instanceId === r.source.instanceId) continue;
      if (p.def.type === "power_in") list.push(p);
      else if (p.def.type === "power_out" && p.part.role === "controller" && r.sourceKind !== "controller") list.push(p);
    }
    consumersOf.set(r.net.id, list);
  }

  // Instances whose power_in is reached only through a resistor (LED + series resistor) still draw from that rail.
  const resistorBridge = (fromKey: string, visited = new Set<string>()): { rail?: Rail; gpio?: NetPin } => {
    const net = netOf.get(fromKey);
    if (!net) return {};
    const rail = railOf.get(net.id);
    if (rail) return { rail };
    const gpio = net.pins.find((p) => p.def.type === "gpio");
    if (gpio) return { gpio };
    for (const p of net.pins) {
      if (!p.part.id.startsWith("res-")) continue;
      if (visited.has(p.instanceId)) continue;
      visited.add(p.instanceId);
      const other = p.part.pins.find((x) => x.name !== p.pin);
      if (!other) continue;
      const res = resistorBridge(pinKey({ instanceId: p.instanceId, pin: other.name }), visited);
      if (res.rail || res.gpio) return res;
    }
    return {};
  };

  const gpioLoads: Analysis["gpioLoads"] = [];
  for (const inst of build.instances) {
    const p = getPart(inst.partId);
    if (!p) continue;
    if (p.currentTypical_mA < 1) continue;
    const powerPins = p.pins.filter((x) => x.type === "power_in");
    for (const pp of powerPins) {
      const key = pinKey({ instanceId: inst.id, pin: pp.name });
      const net = netOf.get(key);
      if (net && railOf.has(net.id)) continue; // direct rail consumer
      const res = resistorBridge(key);
      if (res.rail) {
        const list = consumersOf.get(res.rail.net.id) ?? [];
        list.push({ instanceId: inst.id, pin: pp.name, part: p, def: pp, label: inst.label });
        consumersOf.set(res.rail.net.id, list);
      } else if (res.gpio) {
        gpioLoads.push({ instanceId: inst.id, controllerId: res.gpio.instanceId, pin: res.gpio.pin, current: p.currentTypical_mA });
      }
      break;
    }
  }

  // ---- load propagation ----
  const drawByRail = new Map<string, Map<string, { typical: number; peak: number }>>();
  const railLoads = new Map<string, Load[]>();
  const computing = new Set<string>();

  // The rail a part's own current is drawn from: its first connected power input that is not a motor/speaker
  // supply (pins referenced by voltageFrom), falling back to any connected input.
  const ownRailCache = new Map<string, string | null>();
  const ownRail = (instanceId: string): string | null => {
    if (ownRailCache.has(instanceId)) return ownRailCache.get(instanceId)!;
    const p = part(instanceId)!;
    const feedPins = new Set(p.pins.map((x) => x.voltageFrom).filter(Boolean) as string[]);
    const inputs = p.pins.filter((x) => x.type === "power_in" || (p.role === "controller" && x.type === "power_out"));
    let found: string | null = null;
    let fallback: string | null = null;
    for (const pin of inputs) {
      const net = netOf.get(pinKey({ instanceId, pin: pin.name }));
      const rail = net ? railOf.get(net.id) : undefined;
      if (!rail || rail.source?.instanceId === instanceId) continue;
      if (!feedPins.has(pin.name)) {
        found = net!.id;
        break;
      }
      fallback ??= net!.id;
    }
    const r = found ?? fallback;
    ownRailCache.set(instanceId, r);
    return r;
  };

  const ownCurrent = (instanceId: string) => {
    const p = part(instanceId)!;
    let typ = p.currentTypical_mA;
    let peak = p.currentPeak_mA;
    if (p.role === "controller") {
      for (const g of gpioLoads.filter((x) => x.controllerId === instanceId)) {
        typ += g.current;
        peak += part(g.instanceId)?.currentPeak_mA ?? g.current;
      }
    }
    // Parts powered from a GPIO are already counted on their controller.
    if (gpioLoads.some((g) => g.instanceId === instanceId)) return { typ: 0, peak: 0 };
    return { typ, peak };
  };

  function railLoad(netId: string): { typical: number; peak: number } {
    const rail = railOf.get(netId)!;
    if (computing.has(netId)) return { typical: 0, peak: 0 };
    computing.add(netId);
    const seen = new Set<string>();
    const loads: Load[] = [];
    for (const c of consumersOf.get(netId) ?? []) {
      if (seen.has(c.instanceId)) continue;
      seen.add(c.instanceId);
      const d = instanceDraw(c.instanceId, rail);
      loads.push({ instanceId: c.instanceId, typical: d.typical, peak: d.peak });
    }
    computing.delete(netId);
    railLoads.set(netId, loads);
    return {
      typical: loads.reduce((s, l) => s + l.typical, 0),
      peak: loads.reduce((s, l) => s + l.peak, 0),
    };
  }

  function instanceDraw(instanceId: string, fromRail: Rail): { typical: number; peak: number } {
    const p = part(instanceId)!;
    const own = ownCurrent(instanceId);
    const home = ownRail(instanceId);
    const countOwn = home === null || home === fromRail.net.id || fromRail.sourceKind === "usb-assumed";
    let typical = countOwn ? own.typ : 0;
    let peak = countOwn ? own.peak : 0;
    // Everything this instance feeds through its own power_out pins (rails it is the source of).
    const fedNets = new Set<string>();
    for (const r of rails) {
      if (!r.source || r.source.instanceId !== instanceId || r.net.id === fromRail.net.id) continue;
      if (fedNets.has(r.net.id)) continue;
      // Driver outputs fed from VM only count when this rail is the VM input.
      if (r.source.def.voltageFrom) {
        const inKey = pinKey({ instanceId, pin: r.source.def.voltageFrom });
        if (netOf.get(inKey)?.id !== fromRail.net.id) continue;
      }
      fedNets.add(r.net.id);
      const down = railLoad(r.net.id);
      const eff = p.power?.efficiency;
      if (eff && r.voltage > 0 && fromRail.voltage > 0) {
        typical += (down.typical * r.voltage) / (fromRail.voltage * eff);
        peak += (down.peak * r.voltage) / (fromRail.voltage * eff);
      } else {
        typical += down.typical;
        peak += down.peak;
      }
    }
    const result = { typical: round1(typical), peak: round1(peak) };
    const m = drawByRail.get(instanceId) ?? new Map();
    m.set(fromRail.net.id, result);
    drawByRail.set(instanceId, m);
    return result;
  }

  // Evaluate root rails (rails whose source is not fed from another rail).
  for (const r of rails) {
    if (!railLoads.has(r.net.id)) railLoad(r.net.id);
  }

  // Controllers with no supply: assume USB.
  const usbAssumed: string[] = [];
  for (const cid of controllers) {
    const p = part(cid)!;
    const fed = p.pins.some((pin) => {
      const net = netOf.get(pinKey({ instanceId: cid, pin: pin.name }));
      if (!net) return false;
      const rail = railOf.get(net.id);
      if (!rail) return false;
      if (pin.type === "power_in") return true;
      return pin.type === "power_out" && rail.source?.instanceId !== cid;
    });
    if (!fed) usbAssumed.push(cid);
  }
  if (usbAssumed.length) {
    // Model USB as a virtual 5 V / 500 mA rail feeding the controller.
    for (const cid of usbAssumed) {
      const fakeRail: Rail = {
        net: { id: `usb:${cid}`, pins: [], wireIds: [] },
        voltage: 5,
        vMax: 5,
        source: null,
        sourceKind: "usb-assumed",
        limit_mA: 500,
        label: "USB",
      };
      const d = instanceDraw(cid, fakeRail);
      rails.push(fakeRail);
      railOf.set(fakeRail.net.id, fakeRail);
      railLoads.set(fakeRail.net.id, [{ instanceId: cid, ...d }]);
    }
  }

  const draw = new Map<string, { typical: number; peak: number }>();
  for (const [id, m] of drawByRail) {
    let typical = 0;
    let peak = 0;
    for (const v of m.values()) {
      typical += v.typical;
      peak += v.peak;
    }
    draw.set(id, { typical: round1(typical), peak: round1(peak) });
  }

  return {
    build,
    getPart,
    part,
    instance: (id) => instById.get(id),
    nets,
    netOf,
    rails,
    railOf,
    railLoads,
    draw,
    gpioLoads,
    usbAssumed,
    controllers,
  };
}

export function railTotals(a: Analysis, netId: string): { typical: number; peak: number } {
  const loads = a.railLoads.get(netId) ?? [];
  const rail = a.railOf.get(netId);
  let typical = loads.reduce((s, l) => s + l.typical, 0);
  let peak = loads.reduce((s, l) => s + l.peak, 0);
  // A controller's onboard regulator also powers the controller itself.
  if (rail?.sourceKind === "controller" && rail.source && (rail.voltage > 4 || rail.source.part.power?.ownOn3v3 !== false)) {
    const p = rail.source.part;
    const own = p.currentTypical_mA;
    typical += own;
    peak += p.currentPeak_mA;
  }
  return { typical: round1(typical), peak: round1(peak) };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function pinRefOf(p: NetPin): PinRef {
  return { instanceId: p.instanceId, pin: p.pin };
}

/** Name to show for an instance in notes: friendly title if set, else part name, plus designator. */
export function displayName(a: Analysis, instanceId: string): string {
  const inst = a.instance(instanceId);
  const p = a.part(instanceId);
  if (!inst || !p) return instanceId;
  return inst.title ? `${inst.title} (${shortName(p)})` : shortName(p);
}

export function shortName(p: Part): string {
  return p.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

/**
 * A supply pin whose voltage fits [min, max]: an existing rail first, otherwise any unused fixed-voltage output
 * (e.g. a controller's 3V3 pin nobody has wired yet). Controllers are preferred; batteries need vMax to fit.
 */
export function supplyPinFor(a: Analysis, min: number, max: number, exclude?: string): PinRef | undefined {
  const fits = (v: number, vMax: number) => v >= min - 0.05 && vMax <= max + 0.05;
  const rails = a.rails
    .filter((r) => r.source && r.sourceKind !== "driver" && r.source.instanceId !== exclude && fits(r.voltage, r.vMax))
    .sort((x, y) => Number(y.sourceKind === "controller") - Number(x.sourceKind === "controller"));
  if (rails[0]?.source) return { instanceId: rails[0].source.instanceId, pin: rails[0].source.pin };
  const ordered = [...a.build.instances].sort((x, y) => Number(a.part(y.id)?.role === "controller") - Number(a.part(x.id)?.role === "controller"));
  for (const inst of ordered) {
    if (inst.id === exclude) continue;
    const p = a.part(inst.id);
    if (!p) continue;
    for (const pin of p.pins) {
      if (pin.type !== "power_out" || pin.voltageFrom || pin.voltage === undefined) continue;
      const li = p.power?.chemistry === "LiPo" || p.power?.chemistry === "Li-ion 18650" || pin.name.startsWith("BAT");
      if (fits(pin.voltage, li ? Math.round(pin.voltage * LI_CELL_MAX * 100) / 100 : pin.voltage)) return { instanceId: inst.id, pin: pin.name };
    }
  }
  return undefined;
}
