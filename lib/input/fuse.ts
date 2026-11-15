// When the webcam and the glove report the same action within 300 ms, fire it once.
import { emitInput, type InputAction, type InputEvent } from "./bus";

export const FUSE_WINDOW_MS = 300;
type Source = "gesture" | "glove";
const last = new Map<InputAction, { source: Source; at: number }>();

/** Returns true if the action should fire (pure decision; exported for tests). */
export function shouldFire(action: InputAction, source: Source, now: number): boolean {
  const prev = last.get(action);
  const fire = !(prev && prev.source !== source && now - prev.at < FUSE_WINDOW_MS);
  if (fire) last.set(action, { source, at: now });
  return fire;
}

export function resetFuse() {
  last.clear();
}

export function emitFused(action: InputAction, source: Source, value?: number, now = performance.now()): boolean {
  if (!shouldFire(action, source, now)) return false;
  return emitInput(action, source === "glove" ? ("gesture" as InputEvent["source"]) : "gesture", value);
}
