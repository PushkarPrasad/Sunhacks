// Core domain types for Magic Smoke. Everything the checks engine, builder and circuit generator share.

export type PartCategory =
  | "controllers"
  | "sensors"
  | "displays"
  | "motion"
  | "power"
  | "communication"
  | "audio"
  | "passives";

export type Interface =
  | "I2C"
  | "SPI"
  | "UART"
  | "GPIO"
  | "analog"
  | "PWM"
  | "power"
  | "I2S"
  | "1-Wire"
  | "DVP";

/**
 * Electrical role of a pin.
 * - power_in: the part draws its supply here (VCC, VIN)
 * - power_out: the part sources a rail here (regulator OUT, battery +, controller 3V3 out)
 * - gpio: a controller pin that can be configured (see `caps`)
 * - out / in / io: a peripheral's signal direction as seen from the peripheral
 */
export type PinType =
  | "power_in"
  | "power_out"
  | "ground"
  | "gpio"
  | "out"
  | "in"
  | "io"
  | "analog_out"
  | "analog_in"
  | "i2c_sda"
  | "i2c_scl"
  | "spi_mosi"
  | "spi_miso"
  | "spi_sck"
  | "spi_cs"
  | "uart_tx"
  | "uart_rx"
  | "i2s_bclk"
  | "i2s_ws"
  | "i2s_dout"
  | "i2s_din"
  | "passive"
  | "nc";

/** Capabilities of a controller GPIO. */
export type PinCap =
  | "adc"
  | "pwm"
  | "touch"
  | "input_only"
  | "i2c_sda"
  | "i2c_scl"
  | "spi_mosi"
  | "spi_miso"
  | "spi_sck"
  | "spi_cs"
  | "uart_tx"
  | "uart_rx"
  | "i2s"
  | "strapping"
  | "flash"
  | "dac";

export interface Pin {
  name: string;
  function: string;
  type: PinType;
  /** Nominal voltage on this pin (rail voltage for power pins, logic level for signals). */
  voltage?: number;
  /**
   * On controllers: what the pin can do. On peripherals: what the pin needs from the controller
   * (e.g. a servo signal pin lists "pwm", an analog output lists "adc").
   */
  caps?: PinCap[];
  /** Acceptable supply range for this power_in pin, overriding the part-level range. */
  range?: [number, number];
  /** Minimum input-high voltage for inputs that need more than 3.3 V (e.g. WS2812B at 5 V). */
  vih?: number;
  /** For power_out pins whose voltage follows another pin of the same part (motor driver outputs). */
  voltageFrom?: string;
}

export interface I2cAddresses {
  default: string;
  alternates: string[];
  /** How to select an alternate address, e.g. "Tie SDO to VDDIO". */
  selectHow?: string;
}

export type PartRole =
  | "controller"
  | "regulator"
  | "boost"
  | "charger"
  | "battery"
  | "level_shifter"
  | "driver"
  | "peripheral"
  | "passive"
  | "mux";

export interface PowerSpec {
  /** Output rail voltage for regulators, boost converters and batteries (nominal). */
  outputVoltage?: number;
  /** Maximum continuous output current in mA. */
  maxOutput_mA?: number;
  /** Battery capacity in mAh. */
  capacity_mAh?: number;
  chemistry?: "LiPo" | "Li-ion 18650" | "NiMH" | "Alkaline";
  /** Converter efficiency (0-1) used when converting load current back to the battery. */
  efficiency?: number;
  /** Onboard regulator output limit for controller boards (3V3 pin budget). */
  onboard3v3_mA?: number;
  /** False when the controller's own chip is not powered from its 3V3 output (e.g. Pi, Uno). Default true. */
  ownOn3v3?: boolean;
  /** Minimum input-output headroom for linear regulators. */
  dropout_V?: number;
  /** Absolute max current per controller GPIO pin. */
  gpioMax_mA?: number;
  /** Max discharge for batteries / max input for chargers. */
  maxDischarge_mA?: number;
}

export interface Part {
  id: string;
  name: string;
  category: PartCategory;
  manufacturer: string;
  interface: Interface[];
  supplyVoltageMin: number;
  supplyVoltageMax: number;
  logicVoltage: number;
  currentTypical_mA: number;
  currentPeak_mA: number;
  i2cAddresses?: I2cAddresses;
  pins: Pin[];
  dimensions_mm: { w: number; h: number; d: number };
  priceUSD: number;
  datasheetUrl: string;
  /** tscircuit footprint string for the carrier board (header pattern matching the module). "none" = off-board. */
  footprint: string;
  verified: boolean;
  /** Field names whose values are not confirmed against a datasheet (shown with an "unverified" tag). */
  unverified?: string[];
  source: string;
  description: string;
  role: PartRole;
  power?: PowerSpec;
  /** Five-volt-tolerant inputs (for 3.3 V controllers this is usually false). */
  fiveVoltTolerant?: boolean;
  /** Controllers whose peripherals can be routed to most GPIOs (ESP32 GPIO matrix, RP2040). */
  pinMux?: "flexible" | "fixed";
  /** Signal outputs swing to the part's supply rail rather than a fixed logic level. */
  logicFollowsSupply?: boolean;
  /** Groups of pins that are the same signal on the board (e.g. Uno A4 and SDA). */
  ties?: string[][];
  /**
   * How the part attaches to the carrier: "board" sits on headers over the carrier (its outline takes space);
   * "cable" connects through a header/JST (only the connector takes space). Default "board".
   */
  mount?: "board" | "cable";
  /** Not placed on the carrier board (plugs into another module, e.g. a camera ribbon). */
  offBoard?: boolean;
  /** Short tag line for palette cards. */
  tags?: string[];
  /** Pins that must be wired for the part to work (names). Defaults to power + ground. */
  requiredPins?: string[];
}

export interface PinRef {
  instanceId: string;
  pin: string; // pin name, unique per part (see data helpers)
}

export interface Instance {
  id: string;
  partId: string;
  /** Reference designator used on the schematic and PCB (U1, S2...). */
  label: string;
  /** Optional friendly name ("Left motor"). */
  title?: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  /** Per-instance overrides, e.g. a selected alternate I2C address. */
  config?: { i2cAddress?: string };
}

export interface Wire {
  id: string;
  from: PinRef;
  to: PinRef;
}

export interface Build {
  id: string;
  name: string;
  templateId?: string;
  categoryId?: string;
  instances: Instance[];
  wires: Wire[];
  /** Carrier board size in mm; undefined = auto-size from placement. */
  board?: { w: number; h: number };
  budgetUSD?: number;
  dismissed: string[];
  createdAt: number;
  updatedAt: number;
}

// ---------- categories & templates ----------

export type BlockShape = "box" | "rounded" | "cylinder" | "plane";

export interface ArchitectureBlock {
  id: string;
  name: string;
  description: string;
  makerEquivalent: string;
  shape: BlockShape;
  size: [number, number, number];
  position: [number, number, number];
  /** Offset applied when exploded. */
  explode: [number, number, number];
  rotation?: [number, number, number];
  tone: "shell" | "board" | "chip" | "glass" | "battery" | "metal" | "accent";
}

export interface DeviceCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  kind: "custom" | "device" | "more" | "hidden";
  blocks: ArchitectureBlock[];
}

export interface TemplateInstance {
  ref: string; // template-local id, e.g. "mcu"
  partId: string;
  label?: string;
  x?: number;
  y?: number;
  rotation?: 0 | 90 | 180 | 270;
}

export interface Template {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  featured?: boolean;
  hidden?: boolean;
  /** Snake game button mapping (pin labels of button instances). */
  game?: { buttons: Record<"up" | "down" | "left" | "right" | "a", string> };
  instances: TemplateInstance[];
  /** "ref.PIN" pairs. */
  wires: [string, string][];
  budgetUSD?: number;
}

// ---------- checks ----------

export type CheckId = "power" | "voltage" | "pins" | "addresses" | "cost" | "boardFit";
export type Status = "ok" | "warn" | "fail";

export type Fix =
  | { kind: "swapPart"; instanceId: string; toPartId: string }
  /** Moves a load off a GPIO onto a supply rail and switches it with an NPN transistor + base resistor. */
  | { kind: "insertDriver"; load: string; gpio: PinRef; supply: PinRef; ground: PinRef }
  | { kind: "insertLevelShifter"; wireId: string; low: PinRef; high: PinRef; lowRail: PinRef; highRail: PinRef; ground: PinRef }
  /** Moves one end of a wire to another pin. */
  | { kind: "rewire"; wireId: string; end: "from" | "to"; to: PinRef }
  | { kind: "setAddress"; instanceId: string; address: string }
  | { kind: "resizeBoard"; w: number; h: number }
  | { kind: "addPart"; partId: string; near?: string }
  | { kind: "removeWire"; wireId: string }
  | { kind: "connect"; from: PinRef; to: PinRef };

export interface Finding {
  /** Stable id (check + code + subject) so dismissals persist across edits. */
  id: string;
  checkId: CheckId;
  severity: Status;
  /** Machine-readable code used to pick the note template. */
  code: string;
  /** Values interpolated into the note text. */
  params: Record<string, string | number>;
  instanceIds: string[];
  fix?: Fix;
}

export interface CheckResult {
  id: CheckId;
  status: Status;
  /** Short headline value, e.g. "412 mA" or "$38.20". */
  headline: string;
  /** Secondary label, e.g. "of 600 mA on 3V3". */
  detail: string;
  findings: Finding[];
}

export interface RailSummary {
  netId: string;
  voltage: number;
  sourceInstanceId: string;
  sourceLabel: string;
  limit_mA: number | null;
  typical_mA: number;
  peak_mA: number;
}

export interface BatteryCurve {
  generatedBy: string;
  chemistry: string;
  nominalVoltage: number;
  cutoffVoltage: number;
  /** usable fraction of rated capacity at a given C-rate */
  rows: { cRate: number; usableFraction: number }[];
}

export interface ChecksContext {
  batteryCurves?: BatteryCurve[];
  /** Board + assembly estimate from the quote adapter. */
  boardEstimateUSD?: number;
}

export interface ChecksReport {
  results: CheckResult[];
  rails: RailSummary[];
  totals: {
    bomUSD: number;
    boardUSD: number;
    totalUSD: number;
    averageCurrent_mA: number;
    peakCurrent_mA: number;
    batteryLife_h: number | null;
    batteryModel: "matlab" | "simple" | null;
    footprintArea_mm2: number;
    boardArea_mm2: number;
  };
  findings: Finding[];
}
