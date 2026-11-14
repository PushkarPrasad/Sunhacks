import type { CheckResult, Finding, Fix, PinRef } from "@/lib/types";
import { pinKey, type NetPin } from "@/lib/build/nets";
import { displayName, supplyPinFor, type Analysis } from "./analysis";
import { worst } from "./util";

const DRIVER_TYPES = new Set(["out", "analog_out", "uart_tx", "io", "i2c_sda", "i2c_scl", "i2s_dout"]);
const RECEIVER_TYPES = new Set(["in", "uart_rx", "io", "spi_mosi", "spi_sck", "spi_cs", "i2c_sda", "i2c_scl", "i2s_bclk", "i2s_ws", "i2s_din"]);

/** Logic level a peripheral pin swings to. */
export function pinLevel(a: Analysis, p: NetPin): number {
  if (p.part.logicFollowsSupply) {
    const supply = p.part.pins.find((x) => x.type === "power_in");
    if (supply) {
      const net = a.netOf.get(pinKey({ instanceId: p.instanceId, pin: supply.name }));
      const rail = net ? a.railOf.get(net.id) : undefined;
      if (rail) return rail.voltage;
    }
  }
  return p.def.voltage ?? p.part.logicVoltage;
}

function railPinOf(a: Analysis, instanceId: string, kind: "low" | "high"): PinRef | undefined {
  const p = a.part(instanceId);
  if (!p) return undefined;
  if (kind === "low") {
    const pin = p.pins.find((x) => x.type === "power_out" && Math.abs((x.voltage ?? 0) - 3.3) < 0.1);
    return pin ? { instanceId, pin: pin.name } : undefined;
  }
  const pin = p.pins.find((x) => x.type === "power_in");
  return pin ? { instanceId, pin: pin.name } : undefined;
}

function groundOf(a: Analysis, instanceId: string): PinRef | undefined {
  const p = a.part(instanceId);
  const g = p?.pins.find((x) => x.type === "ground");
  return g ? { instanceId, pin: g.name } : undefined;
}

export function checkVoltage(a: Analysis): CheckResult {
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "checkId">) => findings.push({ checkId: "voltage", ...f });

  // Two supplies of different voltage on one net.
  for (const net of a.nets) {
    const outs = net.pins.filter((p) => p.def.type === "power_out" && !p.def.voltageFrom);
    for (let i = 0; i < outs.length; i++) {
      for (let j = i + 1; j < outs.length; j++) {
        const va = outs[i].def.voltage ?? 0;
        const vb = outs[j].def.voltage ?? 0;
        if (outs[i].instanceId === outs[j].instanceId) continue;
        // A controller's 3V3 pin fed by an external 3.3 V regulator is fine; a 3.7 V cell on a 3.3 V output is not.
        if (Math.abs(va - vb) > 0.3) {
          add({
            id: `voltage:conflict:${net.id}`,
            severity: "fail",
            code: "supply_conflict",
            params: { a: displayName(a, outs[i].instanceId), b: displayName(a, outs[j].instanceId), va, vb },
            instanceIds: [outs[i].instanceId, outs[j].instanceId],
          });
        }
      }
    }
  }

  // Supply pins outside their range.
  for (const rail of a.rails) {
    for (const p of rail.net.pins) {
      if (p.def.type !== "power_in") continue;
      if (rail.source && p.instanceId === rail.source.instanceId) continue;
      const [min, max] = p.def.range ?? [p.part.supplyVoltageMin, p.part.supplyVoltageMax];
      const vHigh = rail.vMax;
      const vNom = rail.voltage;
      if (vHigh > max + 0.05) {
        add({
          id: `voltage:over:${p.instanceId}:${p.pin}`,
          severity: "fail",
          code: "overvoltage",
          params: { part: displayName(a, p.instanceId), pin: p.pin, voltage: vHigh, max },
          instanceIds: [p.instanceId],
          ...rewireToRail(a, p, min, max),
        });
      } else if (vNom < min - 0.05) {
        add({
          id: `voltage:under:${p.instanceId}:${p.pin}`,
          severity: vNom < min * 0.85 ? "fail" : "warn",
          code: "undervoltage",
          params: { part: displayName(a, p.instanceId), pin: p.pin, voltage: vNom, min },
          instanceIds: [p.instanceId],
          ...rewireToRail(a, p, min, max),
        });
      }
    }
    // A controller's 3V3 pin back-fed from a rail above 3.6 V.
    for (const p of rail.net.pins) {
      if (p.def.type !== "power_out" || p.part.role !== "controller") continue;
      if (rail.source?.instanceId === p.instanceId) continue;
      if (p.pin.startsWith("BAT")) continue;
      const pinV = p.def.voltage ?? 0;
      if (rail.vMax > pinV + 0.3) {
        add({
          id: `voltage:backfeed:${p.instanceId}:${p.pin}`,
          severity: "fail",
          code: "overvoltage",
          params: { part: displayName(a, p.instanceId), pin: p.pin, voltage: rail.vMax, max: pinV + 0.3 },
          instanceIds: [p.instanceId],
        });
      }
    }
  }

  // Logic levels.
  for (const net of a.nets) {
    const ctrlPins = net.pins.filter((p) => p.def.type === "gpio" || (p.part.role === "controller" && p.def.type === "analog_in"));
    const periph = net.pins.filter((p) => p.part.role !== "controller" && p.part.role !== "level_shifter");
    for (const c of ctrlPins) {
      const ctrlLevel = c.def.voltage ?? c.part.logicVoltage;
      for (const p of periph) {
        const level = pinLevel(a, p);
        const wire = a.build.wires.find(
          (w) =>
            (pinKey(w.from) === pinKey(c) && pinKey(w.to) === pinKey(p)) ||
            (pinKey(w.to) === pinKey(c) && pinKey(w.from) === pinKey(p)),
        );
        const fix = () => {
          if (!wire) return {};
          const lowRail = railPinOf(a, c.instanceId, "low");
          const highRail = railPinOf(a, p.instanceId, "high");
          const ground = groundOf(a, c.instanceId);
          if (!lowRail || !highRail || !ground) return {};
          return {
            fix: {
              kind: "insertLevelShifter" as const,
              wireId: wire.id,
              low: { instanceId: c.instanceId, pin: c.pin },
              high: { instanceId: p.instanceId, pin: p.pin },
              lowRail,
              highRail,
              ground,
            },
          };
        };
        // 5 V peripheral output into a 3.3 V controller input.
        if (DRIVER_TYPES.has(p.def.type) && level >= 4.5 && ctrlLevel < 4 && !c.part.fiveVoltTolerant) {
          add({
            id: `voltage:5v-in:${p.instanceId}:${p.pin}`,
            severity: "fail",
            code: "logic_5v_into_3v3",
            params: { part: displayName(a, p.instanceId), pin: p.pin, controller: displayName(a, c.instanceId), ctrlPin: c.pin, level },
            instanceIds: [p.instanceId, c.instanceId],
            ...fix(),
          });
          continue;
        }
        // 5 V controller output into a 3.3 V peripheral input.
        if (RECEIVER_TYPES.has(p.def.type) && ctrlLevel >= 4.5 && level < 4 && !p.part.fiveVoltTolerant) {
          const soft = p.def.type === "uart_rx";
          add({
            id: `voltage:5v-out:${p.instanceId}:${p.pin}`,
            severity: soft ? "warn" : "fail",
            code: soft ? "logic_5v_uart" : "logic_5v_out_into_3v3",
            params: { part: displayName(a, p.instanceId), pin: p.pin, controller: displayName(a, c.instanceId), ctrlPin: c.pin },
            instanceIds: [p.instanceId, c.instanceId],
            ...fix(),
          });
          continue;
        }
        // 3.3 V output into an input that needs a higher VIH.
        const vih = p.def.vih;
        if (vih && ctrlLevel < vih) {
          add({
            id: `voltage:vih:${p.instanceId}:${p.pin}`,
            severity: "warn",
            code: "logic_vih",
            params: { part: displayName(a, p.instanceId), pin: p.pin, vih, level: ctrlLevel },
            instanceIds: [p.instanceId],
            ...fix(),
          });
        }
      }
    }
  }

  const fails = findings.filter((f) => f.severity === "fail").length;
  const warns = findings.length - fails;
  const levels = new Set(a.rails.filter((r) => r.source && r.sourceKind !== "driver").map((r) => r.voltage));
  const levelText = [...levels].sort((x, y) => x - y).map((v) => `${v} V`).join(" · ");
  return {
    id: "voltage",
    status: worst(findings),
    headline: fails ? `${fails} mismatch${fails > 1 ? "es" : ""}` : levels.size ? levelText : "—",
    detail: fails
      ? `${warns ? `${warns} warning${warns > 1 ? "s" : ""} · ` : ""}on ${levels.size} rail${levels.size === 1 ? "" : "s"}`
      : warns
        ? `${warns} level warning${warns > 1 ? "s" : ""}`
        : levels.size
          ? "All supply and logic levels match"
          : "No rails yet",
    findings,
  };
}

function rewireToRail(a: Analysis, p: NetPin, min: number, max: number): { fix?: Fix } {
  const wire = a.build.wires.find((w) => pinKey(w.from) === pinKey(p) || pinKey(w.to) === pinKey(p));
  if (!wire) return {};
  const target = supplyPinFor(a, min, max, p.instanceId);
  if (!target) return {};
  // Move the end of the wire that is not on this part to the compatible supply.
  const end: "from" | "to" = pinKey(wire.from) === pinKey(p) ? "to" : "from";
  return { fix: { kind: "rewire", wireId: wire.id, end, to: target } };
}
