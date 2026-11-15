// Glove message protocol (one text line per message, same over Bluetooth notify and USB serial at 115200).
// Matches hardware/glove/glove.ino (Arduino 101):
//   READY:CURIE            boot + heartbeat every 3 s
//   O:roll,pitch,yaw       integer degrees at 25 Hz (yaw drifts; always use deltas from a baseline)
//   G:SWIPE_L | G:SWIPE_R  flick gestures
//   G:SELECT               knock
//   G:SHAKE                recenter
//   BTN:DOWN | BTN:UP      grab switch (only if wired)
// Older formats (MODE:MOTION, A:..., G:THROW, BLE:ON/OFF) are ignored.

export const GLOVE_SERVICE = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const GLOVE_EVENT_CHAR = "19b10001-e8f2-537e-4f6c-d104768a1214";
export const GLOVE_COMMAND_CHAR = "19b10002-e8f2-537e-4f6c-d104768a1214";
export const GLOVE_NAME = "Copperline Glove";
/** A heartbeat arrives every 3 s; after this long without any message the link is treated as stale. */
export const GLOVE_STALE_MS = 7000;

export type GloveGesture = "SELECT" | "SWIPE_L" | "SWIPE_R" | "SHAKE";

export type GloveMsg =
  | { kind: "ready"; sensor: string }
  | { kind: "button"; down: boolean }
  | { kind: "gesture"; name: GloveGesture }
  | { kind: "orient"; roll: number; pitch: number; yaw: number }
  | { kind: "unknown"; raw: string };

const GESTURES = new Set<string>(["SELECT", "SWIPE_L", "SWIPE_R", "SHAKE"]);

export function parseGloveLine(raw: string): GloveMsg {
  const line = raw.replace(/\0/g, "").trim();
  if (line.startsWith("READY:")) return { kind: "ready", sensor: line.slice(6).trim() };
  if (line === "BTN:DOWN" || line === "BTN:UP") return { kind: "button", down: line.endsWith("DOWN") };
  if (line.startsWith("G:")) {
    const name = line.slice(2);
    if (GESTURES.has(name)) return { kind: "gesture", name: name as GloveGesture };
  }
  if (line.startsWith("O:")) {
    const v = line.slice(2).split(",").map((s) => (s.trim() === "" ? NaN : Number(s)));
    if (v.length === 3 && v.every(Number.isFinite)) return { kind: "orient", roll: v[0], pitch: v[1], yaw: v[2] };
  }
  return { kind: "unknown", raw: line };
}

/** Smallest signed difference b - a in degrees, handling wrap-around (yaw runs -180..180). */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Splits a stream of text chunks into complete lines. */
export class LineBuffer {
  private buf = "";
  push(chunk: string): string[] {
    this.buf += chunk;
    const parts = this.buf.split(/\r?\n/);
    this.buf = parts.pop() ?? "";
    return parts.filter((p) => p.trim().length > 0);
  }
}
