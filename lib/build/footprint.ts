// Footprint extents (mm) parsed from tscircuit footprint strings, without importing tscircuit.
// Only the patterns used by the catalogue are needed; unknown strings fall back to a 10 mm square.

const P = 2.54;

export function footprintExtent(fp: string): { w: number; h: number } {
  if (fp === "none") return { w: 0, h: 0 };
  let m = /^dip(\d+)(?:_w([\d.]+)mm)?/.exec(fp);
  if (m) {
    const n = Number(m[1]);
    const w = m[2] ? Number(m[2]) : 7.62;
    return { w: w + 2 * P * 0.8, h: (n / 2) * P };
  }
  m = /^pinrow(\d+)_rows2/.exec(fp);
  if (m) return { w: (Number(m[1]) / 2) * P, h: 2 * P };
  m = /^pinrow(\d+)/.exec(fp);
  if (m) return { w: Number(m[1]) * P, h: P };
  m = /^axial_p([\d.]+)mm/.exec(fp);
  if (m) return { w: Number(m[1]) + 2, h: 2.5 };
  if (fp.startsWith("to92")) return { w: 5, h: 5 };
  return { w: 10, h: 10 };
}
