// Rule-based "Pairs well with" map. Reasons are short and factual. When GEMINI_API_KEY is set the server only
// re-orders these candidates; it never adds parts that are not listed here.

export interface Suggestion {
  partId: string;
  reason: string;
}

export const compat: Record<string, Suggestion[]> = {
  "esp32-devkitc": [
    { partId: "bme280", reason: "I2C on GPIO21/22, runs from the 3V3 pin" },
    { partId: "ssd1306", reason: "Shares the same I2C bus" },
    { partId: "usb-c-5v", reason: "Clean 5 V into the 5V pin" },
    { partId: "level-shifter", reason: "Needed for 5 V sensors like the HC-SR04" },
    { partId: "max98357a", reason: "I2S audio out with no DAC" },
  ],
  "esp32-s3-devkitc": [
    { partId: "st7789", reason: "Fast SPI colour display" },
    { partId: "inmp441", reason: "I2S microphone for voice projects" },
    { partId: "ap2112k-3v3", reason: "Runs it from a single LiPo" },
  ],
  "xiao-esp32s3": [
    { partId: "lipo-500", reason: "Charges from the onboard charger" },
    { partId: "mpu6050", reason: "I2C on D4/D5 for motion" },
    { partId: "gc9a01", reason: "Round display for wearables" },
    { partId: "vibration-motor", reason: "Haptics through an NPN transistor" },
  ],
  "arduino-uno": [
    { partId: "hc-sr04", reason: "5 V logic matches, no shifter needed" },
    { partId: "lcd1602-i2c", reason: "5 V I2C on A4/A5" },
    { partId: "sg90", reason: "PWM on D9/D10" },
  ],
  "arduino-nano": [
    { partId: "hc-sr04", reason: "5 V logic matches" },
    { partId: "lcd1602-i2c", reason: "5 V I2C on A4/A5" },
    { partId: "dfplayer-mini", reason: "Software serial on D10/D11 with a 1 kΩ resistor" },
  ],
  "pi-pico": [
    { partId: "st7789", reason: "SPI0 on GP18/GP19" },
    { partId: "ws2812b-8", reason: "PIO drives addressable LEDs well" },
    { partId: "tp4056", reason: "VSYS accepts a LiPo directly" },
  ],
  "pi-zero-2w": [
    { partId: "ili9341-touch", reason: "SPI0 with a touch layer" },
    { partId: "mt3608", reason: "Boosts a LiPo to 5 V" },
    { partId: "keypad-4x4", reason: "Eight free GPIOs for a key matrix" },
  ],
  "esp32-cam": [
    { partId: "ov2640", reason: "Plugs into the camera socket" },
    { partId: "pir-hc-sr501", reason: "Wakes the camera on motion" },
    { partId: "usb-c-5v", reason: "The camera needs a solid 5 V" },
  ],
  "pro-micro": [
    { partId: "button", reason: "USB keyboard keys" },
    { partId: "touch-pad", reason: "Wired gesture ring fallback" },
  ],
  bme280: [
    { partId: "ssd1306", reason: "Show readings on the same I2C bus" },
    { partId: "soil-moisture", reason: "Complete plant monitor" },
  ],
  "hc-sr04": [
    { partId: "level-shifter", reason: "Brings the 5 V echo down to 3.3 V" },
    { partId: "tb6612fng", reason: "Obstacle-avoiding robots" },
  ],
  "soil-moisture": [{ partId: "bme280", reason: "Air and soil readings together" }],
  mpu6050: [{ partId: "vibration-motor", reason: "Tap and gesture feedback" }],
  "vl53l0x": [{ partId: "tca9548a", reason: "Run several on one bus" }],
  ssd1306: [{ partId: "bme280", reason: "Same bus, different address" }],
  st7789: [{ partId: "button", reason: "Menus and games" }],
  "ws2812b-8": [
    { partId: "cap-470u", reason: "Smooths the LED supply" },
    { partId: "level-shifter", reason: "Clean 5 V data line" },
  ],
  sg90: [
    { partId: "cap-470u", reason: "Absorbs stall current spikes" },
    { partId: "mp1584-5v", reason: "Separate 5 V rail for servos" },
  ],
  tb6612fng: [
    { partId: "n20-motor", reason: "Two small gear motors" },
    { partId: "pack-18650-2s", reason: "7.4 V motor supply" },
  ],
  "n20-motor": [{ partId: "tb6612fng", reason: "Efficient dual H-bridge" }],
  "vibration-motor": [
    { partId: "npn-2n2222", reason: "Switches the motor current" },
    { partId: "diode-1n4148", reason: "Flyback protection" },
  ],
  "lipo-500": [
    { partId: "tp4056", reason: "Safe charging from USB" },
    { partId: "ap2112k-3v3", reason: "Low-dropout 3.3 V from one cell" },
  ],
  "lipo-2000": [
    { partId: "tp4056", reason: "Safe charging from USB" },
    { partId: "mt3608", reason: "Boost to 5 V" },
  ],
  "cell-18650": [{ partId: "tp4056", reason: "Safe charging from USB" }],
  tp4056: [
    { partId: "lipo-500", reason: "Single-cell LiPo" },
    { partId: "mt3608", reason: "Boost to 5 V after the charger" },
  ],
  "ams1117-3v3": [{ partId: "ap2112k-3v3", reason: "Use this one from a single cell" }],
  max98357a: [{ partId: "speaker-3w", reason: "Matched 4 Ω driver" }],
  inmp441: [{ partId: "max98357a", reason: "Mic in, speaker out" }],
  "dfplayer-mini": [
    { partId: "speaker-3w", reason: "Drives a 3 W speaker directly" },
    { partId: "res-1k", reason: "Series resistor on RX from 5 V boards" },
  ],
  sx1276: [{ partId: "st7789", reason: "Show received messages" }],
  "led-red": [{ partId: "res-220", reason: "Current-limiting resistor" }],
  buzzer: [{ partId: "npn-2n2222", reason: "Drive from weak GPIOs" }],
  button: [{ partId: "res-10k", reason: "External pull-up if the pin has none" }],
};

/** Suggestions for a part, filtered to those not already in the build. */
export function suggestionsFor(partId: string, present: Set<string> = new Set()): Suggestion[] {
  return (compat[partId] ?? []).filter((s) => !present.has(s.partId));
}
