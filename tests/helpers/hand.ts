// Synthetic MediaPipe-style hand. `open` 0 = fist, 1 = flat hand. World units in metres, palm facing the camera
// (normal along z) unless `tiltDeg` rotates it about the y axis. Optional noise in metres.
import type { P3 } from "@/lib/input/openness";

export function syntheticHand(open: number, opts: { tiltDeg?: number; noise?: number; seed?: number; cx?: number; cy?: number } = {}): { world: P3[]; image: P3[] } {
  const bend = 1 - open; // 0 straight .. 1 curled
  const angles = [90 * bend, 100 * bend, 70 * bend].map((d) => (d * Math.PI) / 180);
  const pts: P3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  pts[0] = { x: 0, y: 0, z: 0 };
  const bases = [-0.03, -0.01, 0.01, 0.03];
  const lens = [0.045, 0.028, 0.02];
  [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach((f, i) => {
    let p = { x: bases[i], y: 0.09, z: 0 };
    pts[f[0]] = p;
    let theta = 0; // cumulative bend toward the palm (-z, away from the camera ... curls toward camera-negative)
    for (let k = 0; k < 3; k++) {
      theta += angles[k];
      p = { x: p.x, y: p.y + Math.cos(theta) * lens[k], z: p.z - Math.sin(theta) * lens[k] };
      pts[f[k + 1]] = p;
    }
  });
  // thumb (ignored by openness)
  for (let k = 1; k <= 4; k++) pts[k] = { x: -0.03 - 0.012 * k, y: 0.02 * k, z: 0 };
  let s = opts.seed ?? 1;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
  const t = ((opts.tiltDeg ?? 0) * Math.PI) / 180;
  const world = pts.map((p) => {
    const x = p.x * Math.cos(t) + p.z * Math.sin(t);
    const z = -p.x * Math.sin(t) + p.z * Math.cos(t);
    const n = opts.noise ?? 0;
    return { x: x + r() * n, y: p.y + r() * n, z: z + r() * n };
  });
  const cx = opts.cx ?? 0.5;
  const cy = opts.cy ?? 0.6;
  const image = world.map((p) => ({ x: cx + p.x * 3, y: cy - p.y * 3, z: p.z }));
  return { world, image };
}
