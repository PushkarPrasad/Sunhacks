import { describe, expect, test } from "vitest";
import { analyze } from "@/lib/checks/analysis";
import { pinBudgets } from "@/lib/checks/pins";
import { apply, check, codes, find, getPart, mk, USB_ESP32 } from "./helpers/build";

describe("pins check", () => {
  test("counts used GPIO, ADC and PWM pins (flash pins excluded)", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["soil", "soil-moisture"], ["s", "sg90"]],
      [...USB_ESP32, ["soil.VCC", "mcu.3V3"], ["soil.GND", "mcu.GND"], ["soil.AOUT", "mcu.GPIO34"], ["s.V+", "usb.VBUS"], ["s.GND", "mcu.GND"], ["s.SIG", "mcu.GPIO18"]],
    );
    const [budget] = pinBudgets(analyze(b, getPart));
    expect(budget.gpioAvailable).toBe(26); // 32 GPIO header pins minus 6 flash pins
    expect(budget.gpioUsed).toBe(2);
    expect(budget.adcUsed).toBe(1);
    expect(budget.pwmUsed).toBe(1);
    expect(check(b).results.find((r) => r.id === "pins")!.headline).toBe("2 / 26");
    expect(codes(b, "pins")).toEqual([]);
  });

  test("analog sensor on a pin without ADC fails; Apply moves it to a free ADC1 pin", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["soil", "soil-moisture"]],
      [...USB_ESP32, ["soil.VCC", "mcu.3V3"], ["soil.GND", "mcu.GND"], ["soil.AOUT", "mcu.GPIO18"]],
    );
    const f = find(b, "needs_adc")!;
    expect(f.fix?.kind).toBe("rewire");
    const fixed = apply(b, f);
    const wire = fixed.wires.find((w) => w.from.pin === "AOUT" || w.to.pin === "AOUT")!;
    const ctrlPin = wire.from.pin === "AOUT" ? wire.to.pin : wire.from.pin;
    expect(getPart("esp32-devkitc").pins.find((p) => p.name === ctrlPin)!.function).toMatch(/ADC1/);
    expect(codes(fixed, "pins")).toEqual([]);
  });

  test("servo on a non-PWM Uno pin fails", () => {
    const b = mk([["mcu", "arduino-uno"], ["s", "sg90"]], [["s.V+", "mcu.5V"], ["s.GND", "mcu.GND"], ["s.SIG", "mcu.D7"]]);
    const f = find(b, "needs_pwm")!;
    expect(f).toBeDefined();
    expect(codes(apply(b, f), "pins")).toEqual([]);
  });

  test("driving an output from an input-only pin fails", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["s", "sg90"]],
      [...USB_ESP32, ["s.V+", "usb.VBUS"], ["s.GND", "mcu.GND"], ["s.SIG", "mcu.GPIO35"]],
    );
    const f = find(b, "input_only")!;
    expect(f.severity).toBe("fail");
    expect(codes(apply(b, f), "pins")).toEqual([]);
  });

  test("flash pins fail", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["btn", "button"]], [["btn.A", "mcu.GPIO6"], ["btn.B", "mcu.GND"]]);
    expect(codes(b, "pins")).toContain("flash_pin");
  });

  test("UART TX wired to TX fails and suggests the RX pin", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["bt", "hc-05"]],
      [...USB_ESP32, ["bt.VCC", "usb.VBUS"], ["bt.GND", "mcu.GND"], ["bt.TXD", "mcu.GPIO17"], ["bt.RXD", "mcu.GPIO16"]],
    );
    const f = find(b, "uart_tx_tx")!;
    expect(f).toBeDefined();
    expect(f.fix?.kind).toBe("rewire");
  });

  test("I2C on a fixed-function board must use the hardware pins", () => {
    const b = mk([["mcu", "arduino-nano"], ["oled", "ssd1306"]], [["oled.VCC", "mcu.5V"], ["oled.GND", "mcu.GND"], ["oled.SDA", "mcu.D2"], ["oled.SCL", "mcu.D3"]]);
    const fs = check(b).findings.filter((f) => f.code === "bus_wrong_pin");
    expect(fs.map((f) => f.params.suggestion).sort()).toEqual(["A4", "A5"]);
    let fixed = b;
    for (const f of fs) fixed = apply(fixed, f);
    expect(codes(fixed, "pins")).toEqual([]);
  });

  test("ESP32 can route I2C to any GPIO", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["oled", "ssd1306"]],
      [...USB_ESP32, ["oled.VCC", "mcu.3V3"], ["oled.GND", "mcu.GND"], ["oled.SDA", "mcu.GPIO32"], ["oled.SCL", "mcu.GPIO33"]],
    );
    expect(codes(b, "pins")).toEqual([]);
  });

  test("swapped SDA/SCL on dedicated pins is flagged", () => {
    const b = mk([["mcu", "arduino-uno"], ["env", "bme280"]], [["env.VIN", "mcu.5V"], ["env.GND", "mcu.GND"], ["env.SDA", "mcu.A5"], ["env.SCL", "mcu.A4"]]);
    expect(codes(b, "pins")).toContain("i2c_swapped");
  });

  test("two outputs on one net fail", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["p1", "pir-hc-sr501"], ["p2", "pir-hc-sr501"], ["usb", "usb-c-5v"]],
      [...USB_ESP32, ["p1.VCC", "usb.VBUS"], ["p1.GND", "mcu.GND"], ["p2.VCC", "usb.VBUS"], ["p2.GND", "mcu.GND"], ["p1.OUT", "mcu.GPIO13"], ["p2.OUT", "mcu.GPIO13"]],
    );
    expect(codes(b, "pins")).toContain("two_outputs");
  });

  test("two SPI devices on one chip-select fail; shared SCK/MOSI/MISO is fine", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["a", "sx1276"], ["c", "rc522"], ["usb", "usb-c-5v"]],
      [
        ...USB_ESP32,
        ["a.VIN", "mcu.3V3"], ["a.GND", "mcu.GND"], ["c.3.3V", "mcu.3V3"], ["c.GND", "mcu.GND"],
        ["a.SCK", "mcu.GPIO18"], ["c.SCK", "mcu.GPIO18"], ["a.MOSI", "mcu.GPIO23"], ["c.MOSI", "mcu.GPIO23"], ["a.MISO", "mcu.GPIO19"], ["c.MISO", "mcu.GPIO19"],
        ["a.NSS", "mcu.GPIO5"], ["c.SDA", "mcu.GPIO5"], ["a.DIO0", "mcu.GPIO26"],
      ],
    );
    expect(codes(b, "pins")).toEqual(["shared_cs"]);
  });

  test("SDA tied to SCL fails", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["env", "bme280"]], [["env.SDA", "mcu.GPIO21"], ["env.SCL", "mcu.GPIO21"]]);
    expect(codes(b, "pins")).toContain("sda_scl_shorted");
  });

  test("required signal pins left open warn", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["env", "bme280"]], [["env.VIN", "mcu.3V3"], ["env.GND", "mcu.GND"], ["env.SDA", "mcu.GPIO21"]]);
    const f = find(b, "unwired_required")!;
    expect(f.params.pins).toBe("SCL");
  });

  test("near-full GPIO budget warns", () => {
    const btns = Array.from({ length: 11 }, (_, i) => `b${i}`);
    const free = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"];
    const b = mk(
      [["mcu", "xiao-esp32s3"], ...btns.map((x) => [x, "button"] as [string, string])],
      btns.flatMap((x, i) => [[`${x}.A`, `mcu.${free[i]}`], [`${x}.B`, "mcu.GND"]] as [string, string][]),
    );
    expect(codes(b, "pins")).toContain("gpio_near_full");
  });
});
