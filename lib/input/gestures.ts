// Pure hand-gesture recognition on MediaPipe hand landmarks (21 normalised points per hand).
// No DOM here so it is unit-tested; GestureLayer feeds it frames and turns events into input-bus actions.

export interface Pt {
  x: number;
  y: number;
  z?: number;
}
export type Pose = "pinch" | "fist" | "spread" | "open" | "point" | "none";

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const FINGERS: [tip: number, pip: number][] = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function handSize(lm: Pt[]): number {
  return Math.max(1e-4, dist(lm[WRIST], lm[MIDDLE_MCP]));
}

export function pinchRatio(lm: Pt[]): number {
  return dist(lm[THUMB_TIP], lm[INDEX_TIP]) / handSize(lm);
}

export function extendedFingers(lm: Pt[]): number {
  return FINGERS.filter(([tip, pip]) => dist(lm[WRIST], lm[tip]) > dist(lm[WRIST], lm[pip]) * 1.12).length;
}

/** Mean distance between neighbouring fingertips, relative to hand size. */
export function fingerSpread(lm: Pt[]): number {
  const tips = FINGERS.map(([t]) => lm[t]);
  let s = 0;
  for (let i = 1; i < tips.length; i++) s += dist(tips[i - 1], tips[i]);
  return s / (tips.length - 1) / handSize(lm);
}

export const FIST_GRAB_MS = 450;
export const FIST_TAP_MIN_MS = 60;
export const FIST_GAP_MS = 150;

export const PINCH_ON = 0.33;
export const PINCH_OFF = 0.48;

export function classify(lm: Pt[], wasPinching = false): Pose {
  if (!lm || lm.length < 21) return "none";
  const pr = pinchRatio(lm);
  const ext = extendedFingers(lm);
  if (pr < (wasPinching ? PINCH_OFF : PINCH_ON)) return "pinch";
  if (ext === 0) return "fist";
  if (ext === 4 && fingerSpread(lm) > 0.42) return "spread";
  if (ext >= 4) return "open";
  return "point";
}

export type GestureEvent =
  | { type: "cursor"; x: number; y: number; pinching: boolean; progress: number }
  | { type: "lost" }
  | { type: "pinchStart"; x: number; y: number }
  | { type: "pinchEnd" }
  | { type: "swipe"; dir: "left" | "right" }
  | { type: "explode" }
  | { type: "collapse" }
  | { type: "grabStart" }
  | { type: "grabEnd" }
  | { type: "zoom"; factor: number }
  | { type: "rotate"; delta: number };

export interface Hand {
  landmarks: Pt[];
}

interface Options {
  width: number;
  height: number;
  /** Fraction of the camera frame mapped to the full screen (comfortable reach). */
  activeRegion?: number;
  smoothing?: number;
  deadzone?: number;
}

/**
 * Stateful recogniser. Call update() once per video frame with the detected hands (camera space, un-mirrored)
 * and a timestamp in ms; it returns the events for that frame.
 */
export class GestureRecognizer {
  private cursor: { x: number; y: number } | null = null;
  private pinching = false;
  private pinchSince = 0;
  private poseSince = 0;
  private lastPose: Pose = "none";
  private poseFired = false;
  private wristTrail: { t: number; x: number; y: number }[] = [];
  private cooldownUntil = 0;
  private two: { d: number; a: number } | null = null;
  private fistSince = -1;
  private fistLastSeen = -1;
  private grabbing = false;
  /** Pose of the first hand in the latest frame (for previews and the test page). */
  pose: Pose = "none";

  constructor(private opts: Options) {}

  resize(width: number, height: number) {
    this.opts.width = width;
    this.opts.height = height;
  }

  update(hands: Hand[], t: number): GestureEvent[] {
    const out: GestureEvent[] = [];
    if (!hands.length) {
      if (this.cursor) out.push({ type: "lost" });
      if (this.pinching) out.push({ type: "pinchEnd" });
      if (this.grabbing) out.push({ type: "grabEnd" });
      this.grabbing = false;
      this.fistSince = -1;
      this.pose = "none";
      this.cursor = null;
      this.pinching = false;
      this.two = null;
      this.wristTrail = [];
      this.lastPose = "none";
      return out;
    }

    // Two-hand pinch: zoom by distance, rotate by angle between the pinch points.
    if (hands.length >= 2) {
      const [a, b] = hands;
      if (classify(a.landmarks, true) === "pinch" && classify(b.landmarks, true) === "pinch") {
        const pa = mid(a.landmarks[THUMB_TIP], a.landmarks[INDEX_TIP]);
        const pb = mid(b.landmarks[THUMB_TIP], b.landmarks[INDEX_TIP]);
        const d = dist(pa, pb);
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        if (this.two) {
          const factor = this.two.d / Math.max(1e-4, d);
          if (Math.abs(1 - factor) > 0.01) out.push({ type: "zoom", factor });
          let delta = ang - this.two.a;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          if (Math.abs(delta) > 0.01) out.push({ type: "rotate", delta: -delta });
        }
        this.two = { d, a: ang };
        return out;
      }
    }
    this.two = null;

    const lm = hands[0].landmarks;
    const pose = classify(lm, this.pinching);
    this.pose = pose;

    // Cursor from the index fingertip, mirrored so it moves like a mirror image of the user.
    const region = this.opts.activeRegion ?? 0.7;
    const lo = (1 - region) / 2;
    const nx = clamp01(((1 - lm[INDEX_TIP].x) - lo) / region);
    const ny = clamp01((lm[INDEX_TIP].y - lo) / region);
    const target = { x: nx * this.opts.width, y: ny * this.opts.height };
    const alpha = this.opts.smoothing ?? 0.35;
    const dz = this.opts.deadzone ?? 3;
    if (!this.cursor) this.cursor = target;
    else {
      const next = { x: this.cursor.x + (target.x - this.cursor.x) * alpha, y: this.cursor.y + (target.y - this.cursor.y) * alpha };
      // Freeze the cursor while pinching so the click lands where it started.
      if (!this.pinching && Math.hypot(next.x - this.cursor.x, next.y - this.cursor.y) > dz) this.cursor = next;
    }

    // Pinch = select.
    if (pose === "pinch" && !this.pinching) {
      this.pinching = true;
      this.pinchSince = t;
      out.push({ type: "pinchStart", x: this.cursor.x, y: this.cursor.y });
    } else if (pose !== "pinch" && this.pinching) {
      this.pinching = false;
      out.push({ type: "pinchEnd" });
    }
    out.push({ type: "cursor", x: this.cursor.x, y: this.cursor.y, pinching: this.pinching, progress: this.pinching ? Math.min(1, (t - this.pinchSince) / 400) : 0 });

    // Held poses: spread = explode, fist = collapse.
    if (pose !== this.lastPose) {
      this.lastPose = pose;
      this.poseSince = t;
      this.poseFired = false;
    }
    const wrist = lm[WRIST];
    this.wristTrail.push({ t, x: 1 - wrist.x, y: wrist.y });
    this.wristTrail = this.wristTrail.filter((p) => t - p.t <= 450);

    // Fist held = grab (rotate with the glove); a short fist tap = collapse. Brief misreads (< 150 ms) of a
    // held fist are tolerated so a grab does not drop mid-twist.
    if (pose === "fist") {
      if (this.fistSince < 0) this.fistSince = t;
      this.fistLastSeen = t;
      if (!this.grabbing && t - this.fistSince >= FIST_GRAB_MS) {
        this.grabbing = true;
        out.push({ type: "grabStart" });
      }
    } else if (this.fistSince >= 0 && t - this.fistLastSeen > FIST_GAP_MS) {
      const held = this.fistLastSeen - this.fistSince;
      if (this.grabbing) out.push({ type: "grabEnd" });
      else if (held >= FIST_TAP_MIN_MS && t >= this.cooldownUntil) {
        this.cooldownUntil = t + 600;
        out.push({ type: "collapse" });
      }
      this.grabbing = false;
      this.fistSince = -1;
    }
    if (t < this.cooldownUntil) return out;

    if (!this.poseFired && t - this.poseSince > 350 && pose === "spread" && this.still()) {
      this.poseFired = true;
      this.cooldownUntil = t + 1200;
      out.push({ type: "explode" });
      return out;
    }

    // Open-palm swipe.
    if (pose === "open" || pose === "spread") {
      const first = this.wristTrail[0];
      const dx = this.wristTrail[this.wristTrail.length - 1].x - first.x;
      const dy = this.wristTrail[this.wristTrail.length - 1].y - first.y;
      if (Math.abs(dx) > 0.2 && Math.abs(dy) < Math.abs(dx) * 0.6) {
        this.cooldownUntil = t + 900;
        this.wristTrail = [];
        out.push({ type: "swipe", dir: dx > 0 ? "right" : "left" });
      }
    }
    return out;
  }

  private still(): boolean {
    if (this.wristTrail.length < 2) return true;
    const xs = this.wristTrail.map((p) => p.x);
    return Math.max(...xs) - Math.min(...xs) < 0.06;
  }
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
