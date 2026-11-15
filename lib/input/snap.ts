// Snap-to-target pointer (P0-4). Pure; the DOM layer (components/input/GestureLayer.tsx) feeds it rects.
//
// Source: index-finger MCP (base knuckle, landmark 5), NOT the fingertip: the tip moves when you pinch and would
// drag the pointer off the button. Mirrored (selfie view), mapped from the calibrated reach box to the viewport,
// One Euro filtered in pixels.
// Magnetism: a target whose rect is within 48 px of the raw pointer captures it; with several, the nearest by
// distance to the rect edge wins, with a bias toward the one already locked. Hysteresis: stay locked until the raw
// pointer leaves the locked rect expanded by 72 px.
// Click intent: a pinch (thumb tip to index tip under 0.33 of palm size for 2+ frames) clicks the target that was
// locked 150 ms BEFORE the pinch began; release needs 0.5 (hysteresis), so one pinch is one click.

import { OneEuro } from "./openness";
import type { ReachBox } from "./handCal";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Target {
  id: string;
  rect: Rect;
}
export interface Pt2 {
  x: number;
  y: number;
}

export const MAGNET_PX = 48;
export const RELEASE_PX = 72;
export const LOCK_BIAS_PX = 12;
export const INTENT_MS = 150;
export const PINCH_ON = 0.33;
export const PINCH_OFF = 0.5;
export const PINCH_FRAMES = 2;

/** Distance from a point to a rect's edge (0 inside). */
export function rectDistance(p: Pt2, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Which target the pointer locks onto this frame. */
export function pickTarget(p: Pt2, targets: Target[], current: string | null): string | null {
  const cur = current ? targets.find((t) => t.id === current) : undefined;
  if (cur && rectDistance(p, cur.rect) <= RELEASE_PX) {
    // Hysteresis: keep the lock unless another target is clearly closer (the pointer is inside it).
    const inside = targets.find((t) => t.id !== current && rectDistance(p, t.rect) === 0 && rectDistance(p, cur.rect) > 0);
    if (!inside) return current;
  }
  let best: string | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    let d = rectDistance(p, t.rect);
    if (d > MAGNET_PX) continue;
    if (t.id === current) d -= LOCK_BIAS_PX;
    if (d < bestD) {
      bestD = d;
      best = t.id;
    }
  }
  return best;
}

/** Landmarks -> pointer source (normalized, mirrored) and pinch ratio. */
export function fromLandmarks(lm: { x: number; y: number }[]): { source: Pt2; pinch: number } {
  const palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-4;
  return {
    source: { x: 1 - lm[5].x, y: lm[5].y },
    pinch: Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / palm,
  };
}

export function mapReach(n: Pt2, box: ReachBox, vw: number, vh: number): Pt2 {
  const x = (n.x - box.x0) / Math.max(0.05, box.x1 - box.x0);
  const y = (n.y - box.y0) / Math.max(0.05, box.y1 - box.y0);
  return { x: Math.min(1, Math.max(0, x)) * vw, y: Math.min(1, Math.max(0, y)) * vh };
}

export interface SnapOut {
  raw: Pt2;
  locked: string | null;
  /** Fired click this frame: the target id, or "none" when the pinch had no target (a plain select). */
  click: string | null;
  pinching: boolean;
}

export class SnapPointer {
  private fx = new OneEuro(1.0, 0.007);
  private fy = new OneEuro(1.0, 0.007);
  private locked: string | null = null;
  private history: { t: number; id: string | null }[] = [];
  private pinchFrames = 0;
  private pinching = false;

  constructor(public reach: ReachBox) {}

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.locked = null;
    this.history = [];
    this.pinchFrames = 0;
    this.pinching = false;
  }

  /** One frame. `source` is the normalized mirrored MCP position, `pinch` the thumb-index ratio. */
  update(source: Pt2, pinch: number, t: number, targets: Target[], vw: number, vh: number): SnapOut {
    const m = mapReach(source, this.reach, vw, vh);
    const raw = { x: this.fx.filter(m.x, t), y: this.fy.filter(m.y, t) };
    // While pinching, the lock is frozen so the pinch motion cannot move it.
    if (!this.pinching) this.locked = pickTarget(raw, targets, this.locked);
    this.history.push({ t, id: this.locked });
    while (this.history.length > 2 && this.history[1].t <= t - INTENT_MS - 100) this.history.shift();

    let click: string | null = null;
    if (!this.pinching) {
      this.pinchFrames = pinch < PINCH_ON ? this.pinchFrames + 1 : 0;
      if (this.pinchFrames >= PINCH_FRAMES) {
        this.pinching = true;
        // The pinch began PINCH_FRAMES ago; take the lock from 150 ms before that.
        const began = this.history[Math.max(0, this.history.length - PINCH_FRAMES)].t;
        click = this.lockedAt(began - INTENT_MS) ?? "none";
      }
    } else if (pinch > PINCH_OFF) {
      this.pinching = false;
      this.pinchFrames = 0;
    }
    return { raw, locked: this.locked, click, pinching: this.pinching };
  }

  private lockedAt(t: number): string | null {
    let id: string | null = this.history[0]?.id ?? null;
    for (const h of this.history) {
      if (h.t > t) break;
      id = h.id;
    }
    return id;
  }
}
