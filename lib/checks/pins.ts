import type { CheckResult, Finding, Fix, PinCap, PinType } from "@/lib/types";
import { pinKey, type NetPin } from "@/lib/build/nets";
import { displayName, type Analysis } from "./analysis";
import { worst } from "./util";

/** Peripheral pin types that the controller must drive (so input-only pins cannot serve them). */
const NEEDS_OUTPUT = new Set<PinType>(["in", "spi_mosi", "spi_sck", "spi_cs", "i2c_sda", "i2c_scl", "uart_rx", "i2s_bclk", "i2s_ws", "i2s_din", "io", "power_in"]);
/** Peripheral types that actively drive a net. */
const DRIVES = new Set<PinType>(["out", "analog_out", "uart_tx", "i2s_dout"]);
/** On fixed-function controllers these peripheral pins need the matching hardware pin. */
const BUS_CAP: Partial<Record<PinType, PinCap>> = {
  i2c_sda: "i2c_sda",
  i2c_scl: "i2c_scl",
  spi_mosi: "spi_mosi",
  spi_miso: "spi_miso",
  spi_sck: "spi_sck",
};

export interface PinBudget {
  controllerId: string;
  gpioUsed: number;
  gpioAvailable: number;
  adcUsed: number;
  adcAvailable: number;
  pwmUsed: number;
  pwmAvailable: number;
}

export function pinBudgets(a: Analysis): PinBudget[] {
  return a.controllers.map((cid) => {
    const p = a.part(cid)!;
    const gpios = p.pins.filter((x) => x.type === "gpio" && !x.caps?.includes("flash"));
    const used = (name: string) => a.netOf.has(pinKey({ instanceId: cid, pin: name }));
    const adc = gpios.filter((x) => x.caps?.includes("adc"));
    const pwm = gpios.filter((x) => x.caps?.includes("pwm"));
    return {
      controllerId: cid,
      gpioUsed: gpios.filter((x) => used(x.name)).length,
      gpioAvailable: gpios.length,
      adcUsed: adc.filter((x) => used(x.name)).length,
      adcAvailable: adc.length,
      pwmUsed: pwm.filter((x) => used(x.name)).length,
      pwmAvailable: pwm.length,
    };
  });
}

/** A free controller pin that has every capability in `need` and can drive outputs if required. */
export function freePin(a: Analysis, controllerId: string, need: PinCap[], mustOutput: boolean): string | undefined {
  const p = a.part(controllerId);
  if (!p) return undefined;
  const free = p.pins.filter(
    (x) =>
      x.type === "gpio" &&
      !x.caps?.includes("flash") &&
      !x.caps?.includes("strapping") &&
      !(mustOutput && x.caps?.includes("input_only")) &&
      need.every((c) => x.caps?.includes(c)) &&
      !a.netOf.has(pinKey({ instanceId: controllerId, pin: x.name })),
  );
  // Prefer pins that do not carry bus functions, so they stay available.
  free.sort((x, y) => (x.caps?.length ?? 0) - (y.caps?.length ?? 0));
  // For ADC prefer ADC1 on ESP32 (ADC2 is unavailable while Wi-Fi is on).
  if (need.includes("adc")) free.sort((x, y) => Number(/ADC2/.test(x.function)) - Number(/ADC2/.test(y.function)));
  return free[0]?.name;
}

function rewireFix(a: Analysis, ctrl: NetPin, periph: NetPin, toPin: string | undefined): { fix?: Fix } {
  if (!toPin) return {};
  const wire = a.build.wires.find(
    (w) =>
      (pinKey(w.from) === pinKey(ctrl) && pinKey(w.to) === pinKey(periph)) ||
      (pinKey(w.to) === pinKey(ctrl) && pinKey(w.from) === pinKey(periph)),
  );
  if (!wire) return {};
  const end = pinKey(wire.from) === pinKey(ctrl) ? "from" : "to";
  return { fix: { kind: "rewire", wireId: wire.id, end, to: { instanceId: ctrl.instanceId, pin: toPin } } };
}

export function checkPins(a: Analysis): CheckResult {
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "checkId">) => findings.push({ checkId: "pins", ...f });

  for (const net of a.nets) {
    const ctrlPins = net.pins.filter((p) => p.def.type === "gpio" || (p.part.role === "controller" && p.def.type === "analog_in"));
    const periph = net.pins.filter((p) => p.part.role !== "controller");

    for (const c of ctrlPins) {
      const caps = c.def.caps ?? [];
      const flexible = c.part.pinMux === "flexible";
      if (caps.includes("flash")) {
        const target = periph[0];
        add({
          id: `pins:flash:${c.instanceId}:${c.pin}`,
          severity: "fail",
          code: "flash_pin",
          params: { controller: displayName(a, c.instanceId), pin: c.pin },
          instanceIds: [c.instanceId, ...(target ? [target.instanceId] : [])],
          ...(target ? rewireFix(a, c, target, freePin(a, c.instanceId, [], true)) : {}),
        });
        continue;
      }
      for (const p of periph) {
        const needs = p.def.caps ?? [];
        if (caps.includes("input_only") && NEEDS_OUTPUT.has(p.def.type)) {
          add({
            id: `pins:inputonly:${c.instanceId}:${c.pin}`,
            severity: "fail",
            code: "input_only",
            params: { controller: displayName(a, c.instanceId), pin: c.pin, part: displayName(a, p.instanceId), partPin: p.pin },
            instanceIds: [p.instanceId, c.instanceId],
            ...rewireFix(a, c, p, freePin(a, c.instanceId, needs, true)),
          });
          continue;
        }
        const missing = needs.filter((n) => !caps.includes(n));
        if (missing.length) {
          add({
            id: `pins:needs:${p.instanceId}:${p.pin}`,
            severity: "fail",
            code: missing.includes("adc") ? "needs_adc" : "needs_pwm",
            params: { controller: displayName(a, c.instanceId), pin: c.pin, part: displayName(a, p.instanceId), partPin: p.pin },
            instanceIds: [p.instanceId, c.instanceId],
            ...rewireFix(a, c, p, freePin(a, c.instanceId, needs, !needs.includes("adc"))),
          });
          continue;
        }
        // UART TX into TX.
        if (p.def.type === "uart_tx" && caps.includes("uart_tx") && !caps.includes("uart_rx")) {
          const rx = c.part.pins.find(
            (x) => x.caps?.includes("uart_rx") && !a.netOf.has(pinKey({ instanceId: c.instanceId, pin: x.name })),
          );
          add({
            id: `pins:txtx:${p.instanceId}:${p.pin}`,
            severity: "fail",
            code: "uart_tx_tx",
            params: { part: displayName(a, p.instanceId), partPin: p.pin, controller: displayName(a, c.instanceId), pin: c.pin, ...(rx ? { suggestion: rx.name } : {}) },
            instanceIds: [p.instanceId, c.instanceId],
            ...rewireFix(a, c, p, rx?.name),
          });
          continue;
        }
        // I2C SDA/SCL swapped (on any controller: the pin is a dedicated opposite line).
        if ((p.def.type === "i2c_sda" && caps.includes("i2c_scl") && !caps.includes("i2c_sda")) || (p.def.type === "i2c_scl" && caps.includes("i2c_sda") && !caps.includes("i2c_scl"))) {
          const want = p.def.type === "i2c_sda" ? "i2c_sda" : "i2c_scl";
          const target = c.part.pins.find((x) => x.caps?.includes(want))?.name;
          add({
            id: `pins:i2cswap:${p.instanceId}:${p.pin}`,
            severity: flexible ? "warn" : "fail",
            code: "i2c_swapped",
            params: { part: displayName(a, p.instanceId), partPin: p.pin, controller: displayName(a, c.instanceId), pin: c.pin, ...(target ? { suggestion: target } : {}) },
            instanceIds: [p.instanceId, c.instanceId],
            ...rewireFix(a, c, p, target),
          });
          continue;
        }
        // Fixed-function controllers need hardware bus pins.
        const busCap = BUS_CAP[p.def.type];
        if (!flexible && busCap && !caps.includes(busCap)) {
          const target = c.part.pins.find((x) => x.caps?.includes(busCap) && !a.netOf.has(pinKey({ instanceId: c.instanceId, pin: x.name })))?.name;
          add({
            id: `pins:bus:${p.instanceId}:${p.pin}`,
            severity: "fail",
            code: "bus_wrong_pin",
            params: { part: displayName(a, p.instanceId), partPin: p.pin, controller: displayName(a, c.instanceId), pin: c.pin, bus: busCap.toUpperCase().replace("_", " "), ...(target ? { suggestion: target } : {}) },
            instanceIds: [p.instanceId, c.instanceId],
            ...rewireFix(a, c, p, target),
          });
        }
      }
    }

    // Two drivers fighting on one net.
    const drivers = net.pins.filter((p) => p.part.role !== "controller" && DRIVES.has(p.def.type));
    if (drivers.length >= 2) {
      add({
        id: `pins:contention:${net.id}`,
        severity: "fail",
        code: "two_outputs",
        params: { a: `${displayName(a, drivers[0].instanceId)} ${drivers[0].pin}`, b: `${displayName(a, drivers[1].instanceId)} ${drivers[1].pin}` },
        instanceIds: [drivers[0].instanceId, drivers[1].instanceId],
      });
    }
    // Shared chip select.
    const cs = net.pins.filter((p) => p.def.type === "spi_cs" && p.part.role !== "controller");
    const csParts = new Set(cs.map((p) => p.instanceId));
    if (csParts.size >= 2) {
      add({
        id: `pins:sharedcs:${net.id}`,
        severity: "fail",
        code: "shared_cs",
        params: { a: displayName(a, cs[0].instanceId), b: displayName(a, cs.find((x) => x.instanceId !== cs[0].instanceId)!.instanceId) },
        instanceIds: [...csParts],
      });
    }
    // SDA tied to SCL.
    const sda = net.pins.some((p) => p.def.type === "i2c_sda");
    const scl = net.pins.some((p) => p.def.type === "i2c_scl");
    if (sda && scl) {
      const ids = [...new Set(net.pins.filter((p) => p.def.type.startsWith("i2c")).map((p) => p.instanceId))];
      add({ id: `pins:sdascl:${net.id}`, severity: "fail", code: "sda_scl_shorted", params: {}, instanceIds: ids });
    }
  }

  // Required pins left open.
  for (const inst of a.build.instances) {
    const p = a.part(inst.id);
    if (!p || p.role === "controller") continue;
    const required = p.requiredPins ?? [];
    const open = required.filter((name) => !a.netOf.has(pinKey({ instanceId: inst.id, pin: name })));
    const anyWired = p.pins.some((pin) => a.netOf.has(pinKey({ instanceId: inst.id, pin: pin.name })));
    // Power/ground gaps are reported by the power check; here only signal pins.
    const signalOpen = open.filter((name) => {
      const t = p.pins.find((x) => x.name === name)?.type;
      return t !== "power_in" && t !== "ground" && t !== "power_out";
    });
    if (signalOpen.length && (anyWired || a.controllers.length > 0)) {
      add({
        id: `pins:open:${inst.id}`,
        severity: "warn",
        code: "unwired_required",
        params: { part: displayName(a, inst.id), pins: signalOpen.join(", ") },
        instanceIds: [inst.id],
      });
    }
  }

  // GPIO budget.
  const budgets = pinBudgets(a);
  for (const b of budgets) {
    if (b.gpioUsed > b.gpioAvailable * 0.9) {
      add({
        id: `pins:budget:${b.controllerId}`,
        severity: "warn",
        code: "gpio_near_full",
        params: { controller: displayName(a, b.controllerId), used: b.gpioUsed, available: b.gpioAvailable },
        instanceIds: [b.controllerId],
      });
    }
  }

  const main = budgets[0];
  return {
    id: "pins",
    status: worst(findings),
    headline: main ? `${main.gpioUsed} / ${main.gpioAvailable}` : "—",
    detail: main ? `GPIO used · ${main.adcUsed}/${main.adcAvailable} ADC · ${main.pwmUsed}/${main.pwmAvailable} PWM` : "Add a controller",
    findings,
  };
}
