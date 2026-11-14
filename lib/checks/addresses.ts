import type { CheckResult, Finding } from "@/lib/types";
import { displayName, type Analysis } from "./analysis";
import { worst } from "./util";

export interface I2cBus {
  netId: string;
  devices: { instanceId: string; address: string }[];
}

export function addressOf(a: Analysis, instanceId: string): string | undefined {
  const p = a.part(instanceId);
  const inst = a.instance(instanceId);
  if (!p?.i2cAddresses) return undefined;
  return inst?.config?.i2cAddress ?? p.i2cAddresses.default;
}

export function i2cBuses(a: Analysis): I2cBus[] {
  const buses: I2cBus[] = [];
  for (const net of a.nets) {
    const devs = net.pins.filter((p) => p.def.type === "i2c_sda" && p.part.i2cAddresses && p.part.role !== "controller");
    if (devs.length === 0) continue;
    // A mux's upstream SDA is on this bus; its downstream channels (SD0...) are separate nets.
    const seen = new Set<string>();
    const devices: I2cBus["devices"] = [];
    for (const d of devs) {
      if (seen.has(d.instanceId)) continue;
      if (d.part.role === "mux" && d.pin !== "SDA") continue;
      seen.add(d.instanceId);
      devices.push({ instanceId: d.instanceId, address: addressOf(a, d.instanceId)! });
    }
    buses.push({ netId: net.id, devices });
  }
  return buses;
}

export function checkAddresses(a: Analysis): CheckResult {
  const findings: Finding[] = [];
  const buses = i2cBuses(a);
  let clashes = 0;
  for (const bus of buses) {
    const byAddr = new Map<string, string[]>();
    for (const d of bus.devices) byAddr.set(d.address.toLowerCase(), [...(byAddr.get(d.address.toLowerCase()) ?? []), d.instanceId]);
    const taken = new Set(bus.devices.map((d) => d.address.toLowerCase()));
    for (const [addr, ids] of byAddr) {
      if (ids.length < 2) continue;
      clashes++;
      // Re-address the second (and later) device if it has a free alternate.
      for (const id of ids.slice(1)) {
        const p = a.part(id)!;
        const alt = p.i2cAddresses!.alternates.find((x) => !taken.has(x.toLowerCase()));
        if (alt) taken.add(alt.toLowerCase());
        findings.push({
          checkId: "addresses",
          id: `addresses:clash:${id}`,
          severity: "fail",
          code: alt ? "i2c_clash" : "i2c_clash_no_alt",
          params: {
            a: displayName(a, ids[0]),
            b: displayName(a, id),
            address: p.i2cAddresses!.default === addr ? p.i2cAddresses!.default : addr,
            ...(alt ? { alt, how: p.i2cAddresses!.selectHow ?? "" } : {}),
          },
          instanceIds: [ids[0], id],
          fix: alt ? { kind: "setAddress", instanceId: id, address: alt } : { kind: "addPart", partId: "tca9548a", near: id },
        });
      }
    }
  }
  const devices = buses.reduce((s, b) => s + b.devices.length, 0);
  return {
    id: "addresses",
    status: worst(findings),
    headline: clashes ? `${clashes} clash${clashes > 1 ? "es" : ""}` : `${devices} device${devices === 1 ? "" : "s"}`,
    detail: buses.length ? `on ${buses.length} I2C bus${buses.length > 1 ? "es" : ""}${clashes ? "" : ", all unique"}` : "No I2C devices",
    findings,
  };
}
