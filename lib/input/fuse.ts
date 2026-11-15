// One motion must not fire twice: a second event of the same action within 300 ms is dropped, whichever
// source (webcam or glove) sent it.
import { emitInput, type InputAction } from "./bus";

export const FUSE_WINDOW_MS = 300;
export type InputSource = "camera" | "glove";
const last = new Map<InputAction, number>();

/** Returns true if the action should fire (pure decision; exported for tests). */
export function shouldFire(action: InputAction, _source: InputSource, now: number): boolean {
  const prev = last.get(action);
  if (prev !== undefined && now - prev < FUSE_WINDOW_MS) return false;
  last.set(action, now);
  return true;
}

export function resetFuse() {
  last.clear();
}

export function emitFused(action: InputAction, source: InputSource, value?: number, now = performance.now()): boolean {
  if (!shouldFire(action, source, now)) return false;
  emitInput(action, "gesture", value);
  return true;
}
