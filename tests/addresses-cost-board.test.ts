import { describe, expect, test } from "vitest";
import { estimateBoardUSD } from "@/lib/checks/cost";
import { packBoard } from "@/lib/build/pack";
import { apply, check, codes, find, mk, USB_ESP32 } from "./helpers/build";

const twoBme = () =>
  mk(
    [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["a", "bme280"], ["b", "bme280"]],
    [
      ...USB_ESP32,
      ["a.VIN", "mcu.3V3"], ["a.GND", "mcu.GND"], ["a.SDA", "mcu.GPIO21"], ["a.SCL", "mcu.GPIO22"],
      ["b.VIN", "mcu.3V3"], ["b.GND", "mcu.GND"], ["b.SDA", "mcu.GPIO21"], ["b.SCL", "mcu.GPIO22"],
    ],
  );

describe("addresses check", () => {
  test("duplicate BME280s clash at 0x76; Apply moves the second to 0x77", () => {
    const b = twoBme();
    const f = find(b, "i2c_clash")!;
    expect(f.params).toMatchObject({ address: "0x76", alt: "0x77" });
    const fixed = apply(b, f);
    expect(codes(fixed, "addresses")).toEqual([]);
    expect(check(fixed).results.find((r) => r.id === "addresses")!.headline).toBe("2 devices");
  });

  test("devices on separate buses do not clash", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["a", "bme280"], ["b", "bme280"]],
      [["a.SDA", "mcu.GPIO21"], ["a.SCL", "mcu.GPIO22"], ["b.SDA", "mcu.GPIO32"], ["b.SCL", "mcu.GPIO33"]],
    );
    expect(codes(b, "addresses")).toEqual([]);
  });

  test("three VL53L0X sensors with no hardware alternate suggest a multiplexer", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["a", "vl53l0x"], ["b", "vl53l0x"]],
      [["a.SDA", "mcu.GPIO21"], ["a.SCL", "mcu.GPIO22"], ["b.SDA", "mcu.GPIO21"], ["b.SCL", "mcu.GPIO22"]],
    );
    const f = find(b, "i2c_clash_no_alt")!;
    expect(f.fix).toMatchObject({ kind: "addPart", partId: "tca9548a" });
  });

  test("a mux's downstream channels are separate buses", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["mux", "tca9548a"], ["a", "vl53l0x"], ["b", "vl53l0x"]],
      [["mux.SDA", "mcu.GPIO21"], ["mux.SCL", "mcu.GPIO22"], ["a.SDA", "mux.SD0"], ["a.SCL", "mux.SC0"], ["b.SDA", "mux.SD1"], ["b.SCL", "mux.SC1"]],
    );
    expect(codes(b, "addresses")).toEqual([]);
  });
});

describe("cost check", () => {
  test("totals parts and board estimate against the budget", () => {
    const b = twoBme();
    const r = check(b, { boardEstimateUSD: 10 });
    expect(r.totals.bomUSD).toBeCloseTo(9.5 + 1.5 + 6.5 * 2, 2);
    expect(r.totals.totalUSD).toBeCloseTo(r.totals.bomUSD + 10, 2);
    expect(r.results.find((x) => x.id === "cost")!.status).toBe("ok");
  });

  test("over budget warns, far over fails, and names the priciest parts", () => {
    const b = { ...twoBme(), budgetUSD: 30 };
    expect(find(b, "over_budget")!.severity).toBe("warn");
    const far = { ...twoBme(), budgetUSD: 15 };
    const f = find(far, "over_budget")!;
    expect(f.severity).toBe("fail");
    expect(String(f.params.top)).toContain("ESP32 DevKitC");
  });

  test("board estimate grows with area beyond 100 cm²", () => {
    expect(estimateBoardUSD(100, 100)).toBe(8);
    expect(estimateBoardUSD(150, 100)).toBeCloseTo(8 + 50 * 0.05 * 5, 2);
  });
});

describe("board fit check", () => {
  test("auto-sized boards always fit", () => {
    const r = check(twoBme());
    const fit = r.results.find((x) => x.id === "boardFit")!;
    expect(fit.status).toBe("ok");
    expect(fit.detail).toContain("auto-sized");
  });

  test("a fixed board that is too small fails; Apply resizes it", () => {
    const b = { ...twoBme(), board: { w: 30, h: 30 } };
    const f = find(b, "board_too_small")!;
    expect(f.fix?.kind).toBe("resizeBoard");
    expect(codes(apply(b, f), "boardFit")).toEqual([]);
  });

  test("packer keeps every module inside the margins with no overlaps", () => {
    const items = [
      { instanceId: "a", w: 28, h: 54 },
      { instanceId: "b", w: 13, h: 10.5 },
      { instanceId: "c", w: 27, h: 27 },
      { instanceId: "d", w: 20, h: 6 },
    ];
    const r = packBoard(items);
    for (const p of r.placements) {
      expect(Math.abs(p.cx) + p.w / 2).toBeLessThanOrEqual(r.boardW / 2 - 7.9);
      expect(Math.abs(p.cy) + p.h / 2).toBeLessThanOrEqual(r.boardH / 2 - 7.9);
    }
    for (let i = 0; i < r.placements.length; i++)
      for (let j = i + 1; j < r.placements.length; j++) {
        const A = r.placements[i];
        const B = r.placements[j];
        const overlapX = Math.abs(A.cx - B.cx) < (A.w + B.w) / 2;
        const overlapY = Math.abs(A.cy - B.cy) < (A.h + B.h) / 2;
        expect(overlapX && overlapY).toBe(false);
      }
  });
});
