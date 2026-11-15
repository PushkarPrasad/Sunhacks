// Glove message protocol (text lines, same over Bluetooth and USB):
// READY:<sensor> · BLE:ON|OFF · BTN:DOWN|UP · G:SELECT|SWIPE_L|SWIPE_R|SHAKE|ZOOM_IN|ZOOM_OUT · G:THROW:x,y · O:roll,pitch[,yaw]

export const GLOVE_SERVICE = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const GLOVE_EVENT_CHAR = "19b10001-e8f2-537e-4f6c-d104768a1214";
export const GLOVE_COMMAND_CHAR = "19b10002-e8f2-537e-4f6c-d104768a1214";

export type GloveGesture = "SELECT" | "SWIPE_L" | "SWIPE_R" | "SHAKE" | "ZOOM_IN" | "ZOOM_OUT";

export type GloveMsg =
  | { kind: "ready"; sensor: string }
  | { kind: "ble"; on: boolean }
  | { kind: "button"; down: boolean }
  | { kind: "gesture"; name: GloveGesture }
  | { kind: "throw"; x: number; y: number }
  | { kind: "orient"; roll: number; pitch: number; yaw?: number }
  | { kind: "unknown"; raw: string };

const GESTURES = new Set(["SELECT", "SWIPE_L", "SWIPE_R", "SHAKE", "ZOOM_IN", "ZOOM_OUT"]);

export function parseGloveLine(raw: string): GloveMsg {
  const line = raw.trim();
  if (line.startsWith("READY:")) return { kind: "ready", sensor: line.slice(6).trim() };
  if (line === "BLE:ON" || line === "BLE:OFF") return { kind: "ble", on: line.endsWith("ON") };
  if (line === "BTN:DOWN" || line === "BTN:UP") return { kind: "button", down: line.endsWith("DOWN") };
  if (line.startsWith("G:THROW:")) {
    const [x, y] = line.slice(8).split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) return { kind: "throw", x: x / 100, y: y / 100 };
  }
  if (line.startsWith("G:")) {
    const name = line.slice(2);
    if (GESTURES.has(name)) return { kind: "gesture", name: name as GloveGesture };
  }
  if (line.startsWith("O:")) {
    const v = line.slice(2).split(",").map(Number);
    if (v.length >= 2 && v.every(Number.isFinite)) return { kind: "orient", roll: v[0], pitch: v[1], ...(v.length >= 3 ? { yaw: v[2] } : {}) };
  }
  return { kind: "unknown", raw: line };
}

/** Smallest signed difference b - a in degrees, handling wrap-around (yaw goes 0..360). */
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
