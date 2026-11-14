import type { Instance, Part } from "@/lib/types";

const BY_ID: Record<string, string> = {
  "res-220": "R",
  "res-1k": "R",
  "res-10k": "R",
  "cap-100n": "C",
  "cap-470u": "C",
  "diode-1n4148": "D",
  "npn-2n2222": "Q",
  "led-red": "LED",
  button: "SW",
  "keypad-4x4": "KP",
  potentiometer: "RV",
  "touch-pad": "TP",
  "tilt-sw520d": "SW",
  buzzer: "BZ",
  "speaker-3w": "LS",
};

const BY_CATEGORY: Record<Part["category"], string> = {
  controllers: "U",
  sensors: "S",
  displays: "DS",
  motion: "M",
  power: "PS",
  communication: "RF",
  audio: "AU",
  passives: "X",
};

export function designatorPrefix(part: Part): string {
  if (BY_ID[part.id]) return BY_ID[part.id];
  if (part.role === "battery") return "BT";
  return BY_CATEGORY[part.category];
}

/** Next free designator such as "S3" given the instances already placed. */
export function nextDesignator(part: Part, existing: Instance[]): string {
  const prefix = designatorPrefix(part);
  const used = new Set(existing.map((i) => i.label));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
