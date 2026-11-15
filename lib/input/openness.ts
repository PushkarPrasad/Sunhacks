// Continuous palm openness (P0-3): 0 = fist, 1 = fully open, half-open in between. Drives the explode slider.
//
// 1. Curl per finger from MediaPipe WORLD landmarks (metres, independent of distance to the camera): the bend
//    at MCP (wrist->MCP vs MCP->PIP), PIP and DIP, i.e. the angle between consecutive bone vectors. Thumb ignored.
//    curl = sum of bends / CURL_MAX, openness_raw = 1 - mean curl over index, middle, ring, pinky.
// 2. Per-user range from calibration (fist and open raw values), mapped linearly and clamped to 0..1.
// 3. One Euro filter (min cutoff 1.0 Hz, beta 0.02), then snap: < 0.08 -> 0, > 0.92 -> 1, with 0.04 hysteresis.
// 4. Gating: drive only with hand confidence > 0.7 and the palm facing the camera (normal within 50° of the
//    camera axis). Otherwise hold the last value. Hand gone: hold the last value.
// 5. Engage: the hand must stay still in frame for 300 ms before it drives, so entering the frame never jumps.

export interface P3 {
  x: number;
  y: number;
  z: number;
}

const FINGERS: [number, number, number, number][] = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
/** Full curl (fist) bends: MCP ~90°, PIP ~100°, DIP ~70°. */
export const CURL_MAX_DEG = 260;

const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const len = (v: P3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: P3, b: P3): P3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const angleDeg = (a: P3, b: P3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) || 1)))) * 180) / Math.PI;

/** Curl of one finger, 0 (straight) .. 1 (fully curled). */
export function fingerCurl(w: P3[], [mcp, pip, dip, tip]: [number, number, number, number]): number {
  const b0 = sub(w[mcp], w[0]);
  const b1 = sub(w[pip], w[mcp]);
  const b2 = sub(w[dip], w[pip]);
  const b3 = sub(w[tip], w[dip]);
  const bend = angleDeg(b0, b1) + angleDeg(b1, b2) + angleDeg(b2, b3);
  return Math.min(1, Math.max(0, bend / CURL_MAX_DEG));
}

/** Raw openness 0..1 from world landmarks (uncalibrated). */
export function rawOpenness(w: P3[]): number {
  if (!w || w.length < 21) return NaN;
  const curls = FINGERS.map((f) => fingerCurl(w, f));
  return 1 - curls.reduce((a, c) => a + c, 0) / curls.length;
}

/** Angle between the palm normal and the camera axis, in degrees (0 = palm square to the camera). */
export function palmAngleDeg(w: P3[]): number {
  const n = cross(sub(w[5], w[0]), sub(w[17], w[0]));
  const l = len(n) || 1;
  return (Math.acos(Math.min(1, Math.abs(n.z) / l)) * 180) / Math.PI;
}

export interface Range {
  fist: number;
  open: number;
}
/** Uncalibrated defaults: a relaxed fist reads ~0.2 raw, a flat hand ~0.95. */
export const DEFAULT_RANGE: Range = { fist: 0.2, open: 0.92 };

export function mapRange(raw: number, r: Range): number {
  const span = r.open - r.fist;
  if (Math.abs(span) < 0.05) return Math.min(1, Math.max(0, raw));
  return Math.min(1, Math.max(0, (raw - r.fist) / span));
}

/** One Euro filter (Casiez et al. 2012) for a scalar. */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(
    private minCutoff = 1.0,
    private beta = 0.02,
    private dCutoff = 1.0,
  ) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  reset() {
    this.x = null;
    this.dx = 0;
  }
  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const dxRaw = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dxRaw - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export const CONFIDENCE_MIN = 0.7;
export const PALM_MAX_DEG = 50;
export const ENGAGE_MS = 300;
/** Wrist movement (normalized image units) allowed while "holding still" to engage. */
export const STILL_TOL = 0.04;
export const SNAP_LOW = 0.08;
export const SNAP_HIGH = 0.92;
/** Snap hysteresis: once snapped, leave an end only after moving this far back, so noise at 0.92 cannot flicker. */
export const SNAP_RELEASE = 0.04;

export interface HandSample {
  world: P3[];
  /** image-space landmarks (0..1), used for the stillness check */
  image: P3[];
  score: number;
}

export interface OpennessOut {
  /** Filtered, snapped explode value, or the held value. null until the first engage. */
  value: number | null;
  /** True while the hand is engaged and gated in, i.e. actively driving. */
  driving: boolean;
  raw: number;
}

/** Stateful tracker. Feed it one frame at a time (null when no hand). */
export class OpennessTracker {
  private filter: OneEuro;
  private engaged = false;
  private stillSince = 0;
  private stillAnchor: { x: number; y: number } | null = null;
  private held: number | null = null;
  constructor(public range: Range = DEFAULT_RANGE, minCutoff = 1.0, beta = 0.02) {
    this.filter = new OneEuro(minCutoff, beta);
  }

  update(hand: HandSample | null, tMs: number): OpennessOut {
    if (!hand || hand.world.length < 21) {
      // Hand left the frame: keep the last value; re-engaging needs a fresh 300 ms hold.
      this.engaged = false;
      this.stillAnchor = null;
      this.filter.reset();
      return { value: this.held, driving: false, raw: NaN };
    }
    const raw = rawOpenness(hand.world);
    const gated = hand.score > CONFIDENCE_MIN && palmAngleDeg(hand.world) < PALM_MAX_DEG;

    if (!this.engaged) {
      const w = hand.image[0];
      if (!this.stillAnchor || Math.hypot(w.x - this.stillAnchor.x, w.y - this.stillAnchor.y) > STILL_TOL) {
        this.stillAnchor = { x: w.x, y: w.y };
        this.stillSince = tMs;
      }
      if (gated && tMs - this.stillSince >= ENGAGE_MS) {
        this.engaged = true;
        this.filter.reset();
      } else return { value: this.held, driving: false, raw };
    }
    if (!gated) return { value: this.held, driving: false, raw };

    let v = this.filter.filter(mapRange(raw, this.range), tMs);
    const prev = this.held;
    if (v < SNAP_LOW || (prev === 0 && v < SNAP_LOW + SNAP_RELEASE)) v = 0;
    else if (v > SNAP_HIGH || (prev === 1 && v > SNAP_HIGH - SNAP_RELEASE)) v = 1;
    this.held = v;
    return { value: v, driving: true, raw };
  }
}
