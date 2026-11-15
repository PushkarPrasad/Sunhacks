"use client";

// Hand-control calibration saved in localStorage (every access wrapped; private windows can throw).
import { DEFAULT_RANGE, type Range } from "./openness";
import { setAxisFlips, type Flips } from "./grab";

export interface ReachBox {
  /** Pointer-source box in normalized camera coordinates (already mirrored), mapped to the full viewport. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const DEFAULT_REACH: ReachBox = { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.75 };

export interface HandCal {
  openness: Range;
  reach: ReachBox;
  flips: Flips;
}
const KEY = "magic-smoke-handcal-v4";
const DEFAULTS: HandCal = { openness: DEFAULT_RANGE, reach: DEFAULT_REACH, flips: { roll: false, pitch: false, yaw: false } };

let cache: HandCal | null = null;
const subs = new Set<(c: HandCal) => void>();

export function loadHandCal(): HandCal {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<HandCal>) : {};
    cache = { ...DEFAULTS, ...parsed, flips: { ...DEFAULTS.flips, ...(parsed.flips ?? {}) } };
  } catch {
    cache = { ...DEFAULTS };
  }
  setAxisFlips(cache.flips);
  return cache;
}

export function saveHandCal(patch: Partial<HandCal>) {
  cache = { ...loadHandCal(), ...patch };
  if (patch.flips) setAxisFlips(cache.flips);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage blocked: keep it for this session
  }
  for (const s of subs) s(cache);
}

export function resetHandCal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cache = null;
  const c = loadHandCal();
  for (const s of subs) s(c);
}

export function onHandCal(fn: (c: HandCal) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
