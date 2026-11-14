import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/checks/analysis";
import { batteryEstimates, usableFractionFromCurve } from "@/lib/checks/power";
import { apply, check, codes, find, getPart, mk, USB_ESP32 } from "./helpers/build";

describe("power check", () => {
  test("USB-powered ESP32 with a sensor is fine and reports the 3V3 rail load", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["env", "bme280"]],
      [...USB_ESP32, ["env.VIN", "mcu.3V3"], ["env.GND", "mcu.GND2"], ["env.SDA", "mcu.GPIO21"], ["env.SCL", "mcu.GPIO22"]],
    );
    const r = check(b);
    const power = r.results.find((x) => x.id === "power")!;
    expect(power.status).toBe("ok");
    const rail3 = r.rails.find((x) => x.voltage === 3.3)!;
    // ESP32 (80 mA) + BME280 (0.1 mA) on the onboard LDO
    expect(rail3.typical_mA).toBeCloseTo(80.1, 1);
    expect(rail3.limit_mA).toBe(600);
    // The USB rail carries everything the ESP32 board draws.
    const usb = r.rails.find((x) => x.voltage === 5)!;
    expect(usb.typical_mA).toBeCloseTo(80.1, 1);
  });

  test("controller with no supply wiring is assumed on USB", () => {
    const b = mk([["mcu", "arduino-nano"], ["bz", "buzzer"]], [["bz.+", "mcu.D8"], ["bz.-", "mcu.GND"]]);
    const a = analyze(b, getPart);
    expect(a.usbAssumed).toHaveLength(1);
    const r = check(b);
    expect(r.results[0].detail).toContain("USB");
    expect(codes(b)).not.toContain("controller_not_on_battery");
  });

  test("regulator over its limit fails and suggests a stronger part with matching pins and enough headroom", () => {
    // Seven 2.8" displays (80 mA each) + the ESP32 on a 600 mA AP2112K fed from 5 V USB.
    const tfts = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"];
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["ldo", "ap2112k-3v3"], ...tfts.map((t) => [t, "ili9341-touch"] as [string, string])],
      [
        ["usb.VBUS", "ldo.VIN"], ["usb.GND", "ldo.GND"], ["ldo.VOUT", "mcu.3V3"], ["ldo.GND", "mcu.GND"],
        ...tfts.flatMap((t) => [[`${t}.VCC`, "mcu.3V3"], [`${t}.GND`, "mcu.GND"]] as [string, string][]),
      ],
    );
    const f = find(b, "rail_over_limit")!;
    expect(f).toBeDefined();
    expect(f.severity).toBe("fail");
    expect(f.params.load).toBe(640);
    // AMS1117 (800 mA) has the same pin names and 5 V - 3.3 V = 1.7 V covers its 1.1 V dropout.
    expect(f.fix).toMatchObject({ kind: "swapPart", toPartId: "ams1117-3v3" });
    const fixed = apply(b, f);
    expect(codes(fixed)).not.toContain("rail_over_limit");
  });

  test("no stronger-regulator suggestion when its dropout would not fit the input", () => {
    const tfts = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"];
    const b = mk(
      [["mcu", "esp32-devkitc"], ["bat", "lipo-2000"], ["chg", "tp4056"], ["ldo", "ap2112k-3v3"], ...tfts.map((t) => [t, "ili9341-touch"] as [string, string])],
      [
        ["bat.+", "chg.B+"], ["bat.-", "chg.B-"], ["chg.OUT+", "ldo.VIN"], ["chg.OUT-", "ldo.GND"], ["ldo.VOUT", "mcu.3V3"], ["ldo.GND", "mcu.GND"],
        ...tfts.flatMap((t) => [[`${t}.VCC`, "mcu.3V3"], [`${t}.GND`, "mcu.GND"]] as [string, string][]),
      ],
    );
    const f = find(b, "rail_over_limit")!;
    expect(f.fix).toBeUndefined();
  });

  test("boost converter current is reflected back to the battery with efficiency", () => {
    const b = mk(
      [["pi", "pi-zero-2w"], ["bat", "lipo-2000"], ["chg", "tp4056"], ["boost", "mt3608"]],
      [["bat.+", "chg.B+"], ["bat.-", "chg.B-"], ["chg.OUT+", "boost.VIN+"], ["chg.OUT-", "boost.VIN-"], ["boost.VOUT+", "pi.5V"], ["boost.VOUT-", "pi.GND"]],
    );
    const r = check(b);
    const batt = r.rails.find((x) => x.sourceLabel.startsWith("BT"))!;
    // 280 mA at 5 V from 3.7 V at 88 %: 280*5/(3.7*0.88) ≈ 430.0 mA, + 2 mA MT3608 quiescent + 0.1 mA charger
    expect(batt.typical_mA).toBeCloseTo(432.1, 1);
    expect(r.totals.batteryLife_h).toBeCloseTo((2000 * 0.8) / batt.typical_mA, 1);
    expect(r.totals.batteryModel).toBe("simple");
  });

  test("MATLAB discharge curves change the usable fraction by C-rate", () => {
    const curve = { generatedBy: "test", chemistry: "LiPo", nominalVoltage: 3.7, cutoffVoltage: 3.0, rows: [{ cRate: 0.1, usableFraction: 0.95 }, { cRate: 1, usableFraction: 0.85 }] };
    expect(usableFractionFromCurve(curve, 0.05)).toBe(0.95);
    expect(usableFractionFromCurve(curve, 0.55)).toBeCloseTo(0.9, 5);
    expect(usableFractionFromCurve(curve, 2)).toBe(0.85);
    const b = mk(
      [["mcu", "xiao-esp32s3"], ["bat", "lipo-500"]],
      [["bat.+", "mcu.BAT+"], ["bat.-", "mcu.BAT-"]],
    );
    const est = batteryEstimates(analyze(b, getPart), [curve]);
    expect(est[0].model).toBe("matlab");
    // 80 mA from 500 mAh is 0.16 C -> fraction ≈ 0.9433
    expect(est[0].hours).toBeCloseTo((500 * (0.95 - ((0.16 - 0.1) / 0.9) * 0.1)) / 80, 1);
    const r = check(b, { batteryCurves: [curve] });
    expect(r.totals.batteryModel).toBe("matlab");
  });

  test("unpowered peripheral is flagged with a connect fix to a compatible rail", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["env", "bme280"]], [...USB_ESP32, ["env.SDA", "mcu.GPIO21"], ["env.SCL", "mcu.GPIO22"], ["env.GND", "mcu.GND"]]);
    const f = find(b, "unpowered")!;
    expect(f).toBeDefined();
    expect(f.fix?.kind).toBe("connect");
    const fixed = apply(b, f);
    expect(codes(fixed)).not.toContain("unpowered");
  });

  test("missing ground is flagged and fixed", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["env", "bme280"]], [...USB_ESP32, ["env.VIN", "mcu.3V3"], ["env.SDA", "mcu.GPIO21"], ["env.SCL", "mcu.GPIO22"]]);
    const f = find(b, "no_ground")!;
    expect(f).toBeDefined();
    expect(codes(apply(b, f))).not.toContain("no_ground");
  });

  test("AMS1117 from a single LiPo cell warns about dropout and suggests the AP2112K", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["bat", "lipo-500"], ["chg", "tp4056"], ["ldo", "ams1117-3v3"]],
      [["bat.+", "chg.B+"], ["bat.-", "chg.B-"], ["chg.OUT+", "ldo.VIN"], ["chg.OUT-", "ldo.GND"], ["ldo.VOUT", "mcu.3V3"], ["ldo.GND", "mcu.GND"]],
    );
    const f = find(b, "dropout")!;
    expect(f).toBeDefined();
    expect(f.fix).toMatchObject({ kind: "swapPart", toPartId: "ap2112k-3v3" });
    const fixed = apply(b, f);
    expect(codes(fixed)).not.toContain("dropout");
    // wires survive the swap because pin names match
    expect(fixed.wires).toHaveLength(b.wires.length);
  });

  test("buzzer straight on a Pico GPIO exceeds the pin limit; Apply inserts a transistor driver", () => {
    const b = mk([["mcu", "pi-pico"], ["bz", "buzzer"]], [["bz.+", "mcu.GP15"], ["bz.-", "mcu.GND"]]);
    const f = find(b, "gpio_overcurrent")!;
    expect(f.severity).toBe("fail");
    expect(f.fix?.kind).toBe("insertDriver");
    const fixed = apply(b, f);
    expect(fixed.instances.map((i) => i.partId)).toEqual(expect.arrayContaining(["npn-2n2222", "res-1k"]));
    expect(codes(fixed)).not.toContain("gpio_overcurrent");
    // The buzzer now sits on the 3V3 rail.
    const r = check(fixed);
    expect(r.rails.find((x) => x.voltage === 3.3)!.typical_mA).toBeGreaterThan(25);
  });

  test("an LED through a resistor on an ESP32 GPIO is within limits", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["led", "led-red"], ["r", "res-220"]], [["r.1", "mcu.GPIO2"], ["r.2", "led.A"], ["led.K", "mcu.GND"]]);
    expect(codes(b, "power")).toEqual([]);
    const a = analyze(b, getPart);
    expect(a.gpioLoads).toHaveLength(1);
    expect(a.gpioLoads[0].current).toBe(6);
  });

  test("lithium cell without a charger warns; Apply adds a TP4056", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["bat", "lipo-500"], ["ldo", "ap2112k-3v3"]], [["bat.+", "ldo.VIN"], ["bat.-", "ldo.GND"], ["ldo.VOUT", "mcu.3V3"], ["ldo.GND", "mcu.GND"]]);
    const f = find(b, "battery_no_charger")!;
    expect(f).toBeDefined();
    const fixed = apply(b, f);
    expect(fixed.instances.some((i) => i.partId === "tp4056")).toBe(true);
  });

  test("XIAO's onboard charger counts as a charger", () => {
    const b = mk([["mcu", "xiao-esp32s3"], ["bat", "lipo-500"]], [["bat.+", "mcu.BAT+"], ["bat.-", "mcu.BAT-"]]);
    expect(codes(b)).not.toContain("battery_no_charger");
  });

  test("controller left off the battery warns", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["bat", "lipo-500"], ["chg", "tp4056"]], [["bat.+", "chg.B+"], ["bat.-", "chg.B-"]]);
    expect(codes(b)).toContain("controller_not_on_battery");
  });

  test("servo stall peaks over the USB-C budget warn", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["s1", "sg90"], ["s2", "sg90"]],
      [...USB_ESP32, ["s1.V+", "usb.VBUS"], ["s1.GND", "mcu.GND"], ["s1.SIG", "mcu.GPIO18"], ["s2.V+", "usb.VBUS"], ["s2.GND", "mcu.GND"], ["s2.SIG", "mcu.GPIO19"]],
    );
    const f = find(b, "rail_peak_over")!;
    expect(f.severity).toBe("warn");
    expect(f.params.peak).toBe(1540);
  });

  test("motor current flows through the driver to VM, logic current to VCC", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["drv", "tb6612fng"], ["m", "n20-motor"], ["pack", "pack-18650-2s"], ["usb", "usb-c-5v"]],
      [...USB_ESP32, ["pack.+", "drv.VM"], ["pack.-", "drv.GND"], ["drv.VCC", "mcu.3V3"], ["drv.GND2", "mcu.GND"], ["drv.AO1", "m.M+"], ["drv.AO2", "m.M-"]],
    );
    const a = analyze(b, getPart);
    const r = check(b);
    const pack = r.rails.find((x) => x.voltage === 7.4 && x.sourceLabel.startsWith("BT"))!;
    expect(pack.typical_mA).toBeCloseTo(100, 0);
    const rail3 = r.rails.find((x) => x.voltage === 3.3)!;
    expect(rail3.typical_mA).toBeCloseTo(82, 0);
    expect(a.draw.get(b.instances.find((i) => i.partId === "tb6612fng")!.id)!.typical).toBeCloseTo(102, 0);
  });

  test("supply shorted to ground fails", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"]], [["usb.VBUS", "mcu.GND"]]);
    expect(codes(b)).toContain("short_circuit");
  });

  test("empty build has neutral results", () => {
    const r = check(mk([], []));
    expect(r.results.every((x) => x.status === "ok")).toBe(true);
    expect(r.totals.bomUSD).toBe(0);
  });
});
