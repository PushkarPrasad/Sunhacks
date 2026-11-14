import type { BatteryCurve, CheckResult, Finding, Part, PinRef, RailSummary } from "@/lib/types";
import { pinKey } from "@/lib/build/nets";
import { analyze, displayName, railTotals, round1, supplyPinFor, type Analysis, type Rail } from "./analysis";
import { worst } from "./util";

export const USABLE_FRACTION = 0.8;

export interface BatteryEstimate {
  instanceId: string;
  capacity_mAh: number;
  average_mA: number;
  hours: number;
  model: "matlab" | "simple";
}

/** Interpolates usable capacity fraction for a C-rate from a MATLAB discharge table. */
export function usableFractionFromCurve(curve: BatteryCurve, cRate: number): number {
  const rows = [...curve.rows].sort((a, b) => a.cRate - b.cRate);
  if (rows.length === 0) return USABLE_FRACTION;
  if (cRate <= rows[0].cRate) return rows[0].usableFraction;
  for (let i = 1; i < rows.length; i++) {
    if (cRate <= rows[i].cRate) {
      const a = rows[i - 1];
      const b = rows[i];
      const t = (cRate - a.cRate) / (b.cRate - a.cRate);
      return a.usableFraction + t * (b.usableFraction - a.usableFraction);
    }
  }
  return rows[rows.length - 1].usableFraction;
}

export function batteryEstimates(a: Analysis, curves: BatteryCurve[] = []): BatteryEstimate[] {
  const out: BatteryEstimate[] = [];
  for (const rail of a.rails) {
    if (rail.sourceKind !== "battery" || !rail.source) continue;
    const p = rail.source.part;
    const cap = p.power?.capacity_mAh;
    if (!cap) continue;
    const avg = railTotals(a, rail.net.id).typical;
    if (avg <= 0) continue;
    const curve = curves.find((c) => c.chemistry === p.power?.chemistry);
    const frac = curve ? usableFractionFromCurve(curve, avg / cap) : USABLE_FRACTION;
    out.push({
      instanceId: rail.source.instanceId,
      capacity_mAh: cap,
      average_mA: avg,
      hours: Math.round(((cap * frac) / avg) * 10) / 10,
      model: curve ? "matlab" : "simple",
    });
  }
  return out;
}

export function railSummaries(a: Analysis): RailSummary[] {
  return a.rails.map((r) => {
    const t = railTotals(a, r.net.id);
    return {
      netId: r.net.id,
      voltage: r.voltage,
      sourceInstanceId: r.source?.instanceId ?? "",
      sourceLabel: r.sourceKind === "usb-assumed" ? "USB (assumed)" : r.label,
      limit_mA: r.limit_mA,
      typical_mA: t.typical,
      peak_mA: t.peak,
    };
  });
}

/** Strongest compatible replacement for an overloaded source. */
function strongerSource(src: Part, need_mA: number, catalogue: Part[], vin?: number, wired?: string[]): Part | undefined {
  const v = src.power?.outputVoltage;
  if (v === undefined) return undefined;
  const headroomOk = (p: Part) => vin === undefined || p.power?.dropout_V === undefined || vin - v >= p.power.dropout_V;
  const needed = wired ?? src.pins.map((p) => p.name);
  const sameNames = (p: Part) => needed.every((name) => p.pins.some((q) => q.name === name));
  return catalogue
    .filter(
      (p) =>
        p.id !== src.id &&
        p.role === src.role &&
        p.power?.outputVoltage === v &&
        (p.power?.maxOutput_mA ?? 0) >= need_mA &&
        headroomOk(p) &&
        sameNames(p),
    )
    .sort((x, y) => (x.power!.maxOutput_mA ?? 0) - (y.power!.maxOutput_mA ?? 0))[0];
}

function wiredPins(a: Analysis, instanceId: string): string[] {
  return (a.part(instanceId)?.pins ?? []).filter((p) => a.netOf.has(pinKey({ instanceId, pin: p.name }))).map((p) => p.name);
}

/** Voltage of the rail feeding an instance's power input, if any. */
function inputVoltage(a: Analysis, instanceId: string): number | undefined {
  const p = a.part(instanceId);
  for (const pin of p?.pins ?? []) {
    if (pin.type !== "power_in") continue;
    const net = a.netOf.get(pinKey({ instanceId, pin: pin.name }));
    const rail = net ? a.railOf.get(net.id) : undefined;
    if (rail) return rail.voltage;
  }
  return undefined;
}

function railName(r: Rail) {
  return r.sourceKind === "usb-assumed" ? "USB" : `${r.voltage} V`;
}

function groundPinOf(a: Analysis): PinRef | undefined {
  for (const cid of a.controllers) {
    const p = a.part(cid)!;
    const g = p.pins.find((x) => x.type === "ground");
    if (g) return { instanceId: cid, pin: g.name };
  }
  for (const net of a.nets) {
    const g = net.pins.find((x) => x.def.type === "ground");
    if (g) return { instanceId: g.instanceId, pin: g.pin };
  }
  return undefined;
}

export function checkPower(a: Analysis, catalogue: Part[], curves: BatteryCurve[] = []): CheckResult {
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "checkId">) => findings.push({ checkId: "power", ...f });

  // Short circuits: a supply output on the same net as ground.
  for (const net of a.nets) {
    const hasGround = net.pins.some((p) => p.def.type === "ground");
    const supply = net.pins.find((p) => p.def.type === "power_out");
    if (hasGround && supply) {
      add({
        id: `power:short:${net.id}`,
        severity: "fail",
        code: "short_circuit",
        params: { part: displayName(a, supply.instanceId), pin: supply.pin },
        instanceIds: [supply.instanceId],
        ...(net.wireIds.length === 1 ? { fix: { kind: "removeWire", wireId: net.wireIds[0] } } : {}),
      });
    }
  }

  // Rail limits.
  let worstRail: { rail: Rail; typical: number; peak: number; ratio: number } | null = null;
  for (const rail of a.rails) {
    if (rail.limit_mA === null) continue;
    const t = railTotals(a, rail.net.id);
    const ratio = t.typical / rail.limit_mA;
    const peakRatio = t.peak / rail.limit_mA;
    if (!worstRail || Math.max(ratio, peakRatio * 0.8) > Math.max(worstRail.ratio, (worstRail.peak / rail.limit_mA) * 0.8)) {
      worstRail = { rail, typical: t.typical, peak: t.peak, ratio };
    }
    const srcId = rail.source?.instanceId;
    const subject = srcId ? [srcId] : a.usbAssumed;
    const params = {
      rail: railName(rail),
      source: srcId ? displayName(a, srcId) : "USB",
      load: Math.round(t.typical),
      peak: Math.round(t.peak),
      limit: rail.limit_mA,
    };
    if (ratio > 1 || peakRatio > 1 || ratio > 0.8) {
      const need = ratio > 1 ? t.typical * 1.1 : t.peak * 1.1;
      const better =
        rail.source && rail.sourceKind !== "controller" ? strongerSource(rail.source.part, need, catalogue, inputVoltage(a, rail.source.instanceId), wiredPins(a, rail.source.instanceId))
          : undefined;
      const fix = better && srcId ? ({ kind: "swapPart", instanceId: srcId, toPartId: better.id } as const) : undefined;
      add({
        id: `power:rail:${rail.net.id}`,
        severity: ratio > 1 ? "fail" : "warn",
        code: ratio > 1 ? "rail_over_limit" : peakRatio > 1 ? "rail_peak_over" : "rail_near_limit",
        params: { ...params, ...(better ? { suggestion: better.name } : {}) },
        instanceIds: subject,
        ...(fix ? { fix } : {}),
      });
    }
  }

  // Over-voltage / under-voltage on supply pins belongs to the voltage check; here: unpowered and ungrounded parts.
  for (const inst of a.build.instances) {
    const p = a.part(inst.id);
    if (!p || p.role === "controller" || p.role === "battery" || p.offBoard) continue;
    const inputs = p.pins.filter((x) => x.type === "power_in");
    if (inputs.length > 0 && p.currentTypical_mA > 0) {
      const powered = inputs.some((pin) => {
        const key = pinKey({ instanceId: inst.id, pin: pin.name });
        const net = a.netOf.get(key);
        if (net && a.railOf.has(net.id)) return true;
        return a.gpioLoads.some((g) => g.instanceId === inst.id) || isBridged(a, inst.id);
      });
      if (!powered) {
        const pin = inputs[0];
        const range = pin.range ?? [p.supplyVoltageMin, p.supplyVoltageMax];
        const target = supplyPinFor(a, range[0], range[1], inst.id);
        add({
          id: `power:unpowered:${inst.id}`,
          severity: "warn",
          code: "unpowered",
          params: { part: displayName(a, inst.id), pin: pin.name },
          instanceIds: [inst.id],
          ...(target ? { fix: { kind: "connect", from: { instanceId: inst.id, pin: pin.name }, to: target } } : {}),
        });
      }
    }
    const grounds = p.pins.filter((x) => x.type === "ground");
    if (grounds.length > 0 && (p.currentTypical_mA > 0 || p.role !== "passive")) {
      const grounded = grounds.some((g) => {
        const net = a.netOf.get(pinKey({ instanceId: inst.id, pin: g.name }));
        return net && net.pins.some((x) => x.instanceId !== inst.id && x.def.type === "ground");
      });
      const anyWired = p.pins.some((pin) => a.netOf.has(pinKey({ instanceId: inst.id, pin: pin.name })));
      if (!grounded && anyWired) {
        const target = groundPinOf(a);
        add({
          id: `power:noground:${inst.id}`,
          severity: "warn",
          code: "no_ground",
          params: { part: displayName(a, inst.id) },
          instanceIds: [inst.id],
          ...(target && target.instanceId !== inst.id
            ? { fix: { kind: "connect", from: { instanceId: inst.id, pin: grounds[0].name }, to: target } }
            : {}),
        });
      }
    }
  }

  // Linear regulator headroom.
  for (const rail of a.rails) {
    for (const load of a.railLoads.get(rail.net.id) ?? []) {
      const p = a.part(load.instanceId);
      const dropout = p?.power?.dropout_V;
      const vout = p?.power?.outputVoltage;
      if (!p || dropout === undefined || vout === undefined || p.power?.efficiency) continue;
      if (rail.voltage - vout < dropout) {
        const better = catalogueLdo(catalogue, vout, rail.voltage, p, wiredPins(a, load.instanceId));
        add({
          id: `power:dropout:${load.instanceId}`,
          severity: "warn",
          code: "dropout",
          params: { part: displayName(a, load.instanceId), vin: rail.voltage, vout, dropout, ...(better ? { suggestion: better.name } : {}) },
          instanceIds: [load.instanceId],
          ...(better ? { fix: { kind: "swapPart", instanceId: load.instanceId, toPartId: better.id } } : {}),
        });
      }
    }
  }

  // GPIO-driven loads above the pin limit.
  for (const g of a.gpioLoads) {
    const ctrl = a.part(g.controllerId);
    const limit = ctrl?.power?.gpioMax_mA;
    if (!limit) continue;
    if (g.current > limit * 0.8) {
      add({
        id: `power:gpio:${g.instanceId}`,
        severity: g.current > limit ? "fail" : "warn",
        code: "gpio_overcurrent",
        params: { part: displayName(a, g.instanceId), pin: g.pin, current: g.current, limit },
        instanceIds: [g.instanceId, g.controllerId],
        ...driverFix(a, g),
      });
    }
  }

  // Batteries.
  const batteries = a.build.instances.filter((i) => a.part(i.id)?.role === "battery");
  const hasCharger = a.build.instances.some((i) => a.part(i.id)?.role === "charger");
  const xiaoCharger = a.build.instances.some((i) => a.part(i.id)?.id === "xiao-esp32s3");
  for (const b of batteries) {
    const p = a.part(b.id)!;
    const isLi = p.power?.chemistry === "LiPo" || p.power?.chemistry === "Li-ion 18650";
    const rail = a.rails.find((r) => r.source?.instanceId === b.id);
    const onboardCharger = xiaoCharger && rail?.net.pins.some((x) => x.part.id === "xiao-esp32s3");
    if (isLi && !hasCharger && !onboardCharger && p.id !== "pack-18650-2s") {
      add({
        id: `power:nocharger:${b.id}`,
        severity: "warn",
        code: "battery_no_charger",
        params: { part: displayName(a, b.id) },
        instanceIds: [b.id],
        fix: { kind: "addPart", partId: "tp4056", near: b.id },
      });
    }
  }
  if (batteries.length > 0) {
    for (const cid of a.usbAssumed) {
      add({
        id: `power:ctrl-unpowered:${cid}`,
        severity: "warn",
        code: "controller_not_on_battery",
        params: { part: displayName(a, cid) },
        instanceIds: [cid],
      });
    }
  }

  const est = batteryEstimates(a, curves);
  let headline = "0 mA";
  let detail = "No supply yet";
  if (worstRail) {
    headline = `${Math.round(worstRail.typical)} mA`;
    detail = `of ${worstRail.rail.limit_mA} mA on ${railName(worstRail.rail)}${worstRail.rail.sourceKind === "usb-assumed" ? " (assumed)" : ""}`;
  }
  if (est.length) detail += ` · ≈ ${formatHours(est[0].hours)} battery`;

  return { id: "power", status: worst(findings), headline, detail, findings };
}

function driverFix(a: Analysis, g: Analysis["gpioLoads"][number]): { fix?: Finding["fix"] } {
  const load = a.part(g.instanceId);
  const ctrl = a.part(g.controllerId);
  if (!load || !ctrl) return {};
  const pin = load.pins.find((x) => x.type === "power_in");
  const range = pin?.range ?? [load.supplyVoltageMin, load.supplyVoltageMax];
  const supplyPin = ctrl.pins.find((x) => x.type === "power_out" && (x.voltage ?? 0) >= range[0] - 0.05 && (x.voltage ?? 0) <= range[1] + 0.05);
  const ground = ctrl.pins.find((x) => x.type === "ground");
  if (!supplyPin || !ground) return {};
  return {
    fix: {
      kind: "insertDriver",
      load: g.instanceId,
      gpio: { instanceId: g.controllerId, pin: g.pin },
      supply: { instanceId: g.controllerId, pin: supplyPin.name },
      ground: { instanceId: g.controllerId, pin: ground.name },
    },
  };
}

function isBridged(a: Analysis, instanceId: string): boolean {
  for (const loads of a.railLoads.values()) if (loads.some((l) => l.instanceId === instanceId)) return true;
  return false;
}

function catalogueLdo(catalogue: Part[], vout: number, vin: number, current: Part, wired: string[]): Part | undefined {
  const sameNames = (p: Part) => wired.every((n) => p.pins.some((q) => q.name === n));
  return catalogue.find(
    (p) =>
      p.id !== current.id &&
      p.role === "regulator" &&
      p.power?.outputVoltage === vout &&
      p.power?.dropout_V !== undefined &&
      vin - vout >= p.power.dropout_V &&
      sameNames(p),
  );
}

export function formatHours(h: number): string {
  if (h >= 48) return `${round1(h / 24)} days`;
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${round1(h)} h`;
}

export { analyze };
