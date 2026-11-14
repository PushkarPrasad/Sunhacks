import { describe, expect, test } from "vitest";
import { apply, check, codes, find, mk, USB_ESP32 } from "./helpers/build";

describe("voltage check", () => {
  const sonar = (echoPin = "mcu.GPIO16") =>
    mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["sonar", "hc-sr04"]],
      [...USB_ESP32, ["sonar.VCC", "usb.VBUS"], ["sonar.GND", "mcu.GND"], ["sonar.TRIG", "mcu.GPIO4"], ["sonar.ECHO", echoPin]],
    );

  test("5 V echo into a 3.3 V ESP32 pin fails", () => {
    const f = find(sonar(), "logic_5v_into_3v3")!;
    expect(f.severity).toBe("fail");
    expect(f.params).toMatchObject({ pin: "ECHO", ctrlPin: "GPIO16", level: 5 });
  });

  test("Apply inserts a level shifter on the right rails and clears the finding", () => {
    const b = sonar();
    const fixed = apply(b, find(b, "logic_5v_into_3v3")!);
    const shifter = fixed.instances.find((i) => i.partId === "level-shifter")!;
    expect(shifter).toBeDefined();
    const pins = (pin: string) => fixed.wires.filter((w) => (w.from.instanceId === shifter.id && w.from.pin === pin) || (w.to.instanceId === shifter.id && w.to.pin === pin));
    expect(pins("LV1")).toHaveLength(1);
    expect(pins("HV1")).toHaveLength(1);
    expect(pins("LV")).toHaveLength(1);
    expect(pins("HV")).toHaveLength(1);
    expect(pins("GND")).toHaveLength(1);
    expect(codes(fixed, "voltage")).toEqual([]);
    expect(codes(fixed)).not.toContain("unpowered");
  });

  test("a second 5 V line reuses the same shifter's next channel", () => {
    const b = mk(
      [["pi", "pi-zero-2w"], ["usb", "usb-c-5v"], ["lcd", "lcd1602-i2c"]],
      [["usb.VBUS", "pi.5V"], ["usb.GND", "pi.GND"], ["lcd.VCC", "pi.5V_2"], ["lcd.GND", "pi.GND2"], ["lcd.SDA", "pi.GPIO2"], ["lcd.SCL", "pi.GPIO3"]],
    );
    const fs = check(b).findings.filter((f) => f.code === "logic_5v_into_3v3");
    expect(fs).toHaveLength(2);
    let fixed = apply(b, fs[0]);
    const second = check(fixed).findings.find((f) => f.code === "logic_5v_into_3v3")!;
    fixed = apply(fixed, second);
    expect(fixed.instances.filter((i) => i.partId === "level-shifter")).toHaveLength(1);
    expect(codes(fixed, "voltage")).toEqual([]);
  });

  test("5 V Arduino with a 5 V sensor is fine", () => {
    const b = mk(
      [["mcu", "arduino-nano"], ["sonar", "hc-sr04"]],
      [["sonar.VCC", "mcu.5V"], ["sonar.GND", "mcu.GND"], ["sonar.TRIG", "mcu.D2"], ["sonar.ECHO", "mcu.D3"]],
    );
    expect(codes(b, "voltage")).toEqual([]);
  });

  test("5 V controller output into a 3.3 V-only input fails (nRF24 is 5 V tolerant, RC522 is not)", () => {
    const rc = mk(
      [["mcu", "arduino-nano"], ["rf", "rc522"]],
      [["rf.3.3V", "mcu.3V3"], ["rf.GND", "mcu.GND"], ["rf.MOSI", "mcu.D11"], ["rf.SCK", "mcu.D13"], ["rf.SDA", "mcu.D10"], ["rf.MISO", "mcu.D12"]],
    );
    expect(codes(rc, "voltage")).toContain("logic_5v_out_into_3v3");
    const nrf = mk(
      [["mcu", "arduino-nano"], ["rf", "nrf24l01"]],
      [["rf.VCC", "mcu.3V3"], ["rf.GND", "mcu.GND"], ["rf.MOSI", "mcu.D11"], ["rf.SCK", "mcu.D13"], ["rf.CSN", "mcu.D10"], ["rf.MISO", "mcu.D12"], ["rf.CE", "mcu.D9"]],
    );
    expect(codes(nrf, "voltage")).toEqual([]);
  });

  test("DHT22 output follows its supply: 5 V supply on a 3.3 V MCU fails, 3.3 V is fine", () => {
    const at = (rail: string) =>
      mk([["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["dht", "dht22"]], [...USB_ESP32, ["dht.VCC", rail], ["dht.GND", "mcu.GND"], ["dht.DATA", "mcu.GPIO4"]]);
    expect(codes(at("usb.VBUS"), "voltage")).toContain("logic_5v_into_3v3");
    expect(codes(at("mcu.3V3"), "voltage")).toEqual([]);
  });

  test("nRF24L01 on 5 V is over voltage; Apply moves the wire to the 3.3 V rail", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["rf", "nrf24l01"]],
      [...USB_ESP32, ["rf.VCC", "usb.VBUS"], ["rf.GND", "mcu.GND"]],
    );
    const f = find(b, "overvoltage")!;
    expect(f.params).toMatchObject({ pin: "VCC", voltage: 5, max: 3.6 });
    const fixed = apply(b, f);
    expect(codes(fixed, "voltage")).toEqual([]);
  });

  test("a LiPo's 4.2 V full charge on a 3.6 V part fails even though nominal is 3.7 V", () => {
    const b = mk([["bat", "lipo-500"], ["chg", "tp4056"], ["rf", "sx1276"]], [["bat.+", "chg.B+"], ["bat.-", "chg.B-"], ["chg.OUT+", "rf.VIN"], ["chg.OUT-", "rf.GND"]]);
    const f = find(b, "overvoltage")!;
    expect(f.params.voltage).toBe(4.2);
  });

  test("LED straight on a 3.3 V rail without a resistor is over voltage", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["led", "led-red"]], [["led.A", "mcu.3V3"], ["led.K", "mcu.GND"]]);
    expect(codes(b, "voltage")).toContain("overvoltage");
  });

  test("ESP32 3V3 pin back-fed from a LiPo fails", () => {
    const b = mk([["mcu", "esp32-devkitc"], ["bat", "lipo-500"]], [["bat.+", "mcu.3V3"], ["bat.-", "mcu.GND"]]);
    expect(codes(b, "voltage")).toContain("supply_conflict");
  });

  test("WS2812B data at 3.3 V warns about VIH", () => {
    const b = mk(
      [["mcu", "esp32-devkitc"], ["usb", "usb-c-5v"], ["leds", "ws2812b-8"]],
      [...USB_ESP32, ["leds.5V", "usb.VBUS"], ["leds.GND", "mcu.GND"], ["leds.DIN", "mcu.GPIO16"]],
    );
    const f = find(b, "logic_vih")!;
    expect(f.severity).toBe("warn");
    const r = check(b).results.find((x) => x.id === "voltage")!;
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("warning");
  });

  test("Nano TX into DFPlayer RX is a soft warning", () => {
    const b = mk([["mcu", "arduino-nano"], ["mp3", "dfplayer-mini"]], [["mp3.VCC", "mcu.5V"], ["mp3.GND", "mcu.GND"], ["mp3.RX", "mcu.D11"], ["mp3.TX", "mcu.D10"]]);
    expect(find(b, "logic_5v_uart")!.severity).toBe("warn");
  });
});
