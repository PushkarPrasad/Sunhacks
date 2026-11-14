import { describe, expect, test } from "vitest";
import { fp } from "@tscircuit/footprinter";
import { categories } from "@/data/categories";
import { parts, partsById } from "@/data/parts";
import { templates } from "@/data/templates";
import { compat } from "@/data/compat";
import { buildFromTemplate, parseRef } from "@/lib/build/fromTemplate";
import { runChecks } from "@/lib/checks";

describe("seed data", () => {
  test("has about 60+ parts including every required module", () => {
    expect(parts.length).toBeGreaterThanOrEqual(60);
    const required = [
      "esp32-devkitc", "esp32-s3-devkitc", "xiao-esp32s3", "arduino-uno", "arduino-nano", "pi-pico", "pi-zero-2w", "bme280", "dht22", "mpu6050", "hc-sr04",
      "pir-hc-sr501", "ldr-module", "soil-moisture", "ina219", "vl53l0x", "ssd1306", "st7789", "lcd1602-i2c", "ws2812b-8", "sg90", "stepper-28byj48", "tb6612fng",
      "l298n", "a4988", "n20-motor", "tp4056", "ams1117-3v3", "mt3608", "cell-18650", "lipo-500", "hc-05", "nrf24l01", "rc522", "sx1276", "max98357a",
      "dfplayer-mini", "speaker-3w", "inmp441", "button", "potentiometer", "buzzer", "led-red", "res-220", "cap-100n", "vibration-motor", "npn-2n2222",
      "diode-1n4148", "esp32-cam", "ov2640",
    ];
    for (const id of required) expect(partsById[id], id).toBeDefined();
  });

  test("ids are unique, pin names unique per part, unverified fields are real fields", () => {
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
    for (const p of parts) {
      const names = p.pins.map((x) => x.name);
      expect(new Set(names).size, p.id).toBe(names.length);
      expect(p.verified || (p.unverified?.length ?? 0) > 0, `${p.id} unverified without fields`).toBe(true);
      for (const r of p.requiredPins ?? []) expect(names, `${p.id} requires ${r}`).toContain(r);
      for (const pin of p.pins) if (pin.voltageFrom) expect(names).toContain(pin.voltageFrom);
      expect(p.datasheetUrl).toMatch(/^https?:\/\//);
    }
  });

  test("every footprint exists in tscircuit and has one pad per pin", () => {
    for (const p of parts) {
      if (p.footprint === "none") continue;
      const json = fp.string(p.footprint).circuitJson();
      const pads = json.filter((e: { type: string }) => e.type === "pcb_plated_hole" || e.type === "pcb_smtpad");
      expect(pads.length, `${p.id} ${p.footprint}`).toBe(p.pins.length);
    }
  });

  test("categories are in the exact order with Custom first and More last", () => {
    expect(categories.map((c) => c.name)).toEqual([
      "Custom", "Phones", "Laptops", "Tablets", "Projectors", "Smartwatches", "Smart Home", "Robots", "Game Consoles", "Audio", "Cameras", "More (Coming Soon)",
    ]);
    for (const c of categories.slice(1, 11)) expect(c.blocks.length, c.id).toBeGreaterThanOrEqual(6);
  });

  test("every device category has 2+ visible templates; required templates exist", () => {
    for (const c of categories.filter((x) => x.kind === "device")) {
      expect(templates.filter((t) => t.categoryId === c.id && !t.hidden).length, c.id).toBeGreaterThanOrEqual(2);
    }
    for (const id of ["pocket-lora-messenger", "laptop-handheld", "pi-touch-tablet", "mini-projector-controller", "smartwatch", "plant-monitor", "robot-car", "handheld-console", "smart-speaker", "wifi-camera", "gesture-ring", "overengineered-soda-can"]) {
      expect(templates.find((t) => t.id === id), id).toBeDefined();
    }
    expect(templates.find((t) => t.id === "overengineered-soda-can")!.hidden).toBe(true);
  });

  test("every template wire references real refs and pins and builds cleanly", () => {
    for (const t of templates) {
      const refs = new Map(t.instances.map((i) => [i.ref, partsById[i.partId]]));
      for (const i of t.instances) expect(partsById[i.partId], `${t.id}:${i.partId}`).toBeDefined();
      for (const [a, b] of t.wires) {
        for (const end of [a, b]) {
          const { ref, pin } = parseRef(end);
          const part = refs.get(ref);
          expect(part, `${t.id}: ${end}`).toBeDefined();
          expect(part!.pins.map((p) => p.name), `${t.id}: ${end}`).toContain(pin);
        }
      }
      const build = buildFromTemplate(t, (id) => partsById[id]);
      expect(build.wires.length).toBe(t.wires.length);
      runChecks(build, parts);
    }
  });

  test("flagship templates pass power and pins checks", () => {
    for (const id of ["pocket-lora-messenger", "plant-monitor", "smartwatch", "gesture-ring", "handheld-console", "smart-speaker", "wifi-camera", "laptop-handheld", "pi-touch-tablet", "mini-projector-controller"]) {
      const t = templates.find((x) => x.id === id)!;
      const r = runChecks(buildFromTemplate(t, (pid) => partsById[pid]), parts);
      const failing = r.findings.filter((f) => f.severity === "fail");
      expect(failing.map((f) => f.code), id).toEqual([]);
    }
  });

  test("compat map only references real parts", () => {
    for (const [id, list] of Object.entries(compat)) {
      expect(partsById[id], id).toBeDefined();
      for (const s of list) expect(partsById[s.partId], `${id} -> ${s.partId}`).toBeDefined();
    }
  });
});
