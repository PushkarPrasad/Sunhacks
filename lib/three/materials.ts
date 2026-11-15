"use client";

// One shared materials library for every product model (V3 realism pass). Everything is procedural: canvas
// textures for weaves, layer lines, solder mask and silkscreen; no downloaded textures, no logos.
// Materials are cached per key, so a scene full of screws shares one steel material.

import * as THREE from "three";

const cache = new Map<string, THREE.Material>();
const texCache = new Map<string, THREE.Texture>();

function once<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

function tex(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    texCache.set(key, t);
  }
  return t;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function finish(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Height field to tangent-space normal map. */
function normalFromHeight(h: Float32Array, w: number, hh: number, strength: number): HTMLCanvasElement {
  const { c, g } = canvas(w, hh);
  const img = g.createImageData(w, hh);
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * w + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- textures ----------

/** 2x2 twill carbon weave: colour and a matching normal map. */
function carbonMaps(): { map: THREE.Texture; normalMap: THREE.Texture } {
  const N = 256;
  const cells = 16;
  const s = N / cells;
  const { c, g } = canvas(N, N);
  const h = new Float32Array(N * N);
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) {
      const warp = (x + y) % 4 < 2;
      for (let py = 0; py < s; py++)
        for (let px = 0; px < s; px++) {
          const u = warp ? px / s : py / s;
          // Each tow is a rounded bundle of fibres: a bulge across, fine fibre ridges along.
          const bulge = Math.sin(u * Math.PI);
          const fibre = 0.08 * Math.sin((warp ? py : px) * 1.9);
          h[(y * s + py) * N + x * s + px] = bulge * 0.8 + fibre;
        }
      const grad = warp ? g.createLinearGradient(x * s, 0, x * s + s, 0) : g.createLinearGradient(0, y * s, 0, y * s + s);
      grad.addColorStop(0, "#0d0d10");
      grad.addColorStop(0.5, warp ? "#2c2c33" : "#232329");
      grad.addColorStop(1, "#0e0e11");
      g.fillStyle = grad;
      g.fillRect(x * s, y * s, s, s);
    }
  return { map: finish(c, [3, 3]), normalMap: finish(normalFromHeight(h, N, N, 2.2), [3, 3], false) };
}

/** FDM layer lines (0.2 mm layers) as a normal map, plus faint per-layer colour variation. */
function layerMaps(): { normalMap: THREE.Texture; roughnessMap: THREE.Texture } {
  const N = 128;
  const h = new Float32Array(N * N);
  const r = rng(7);
  const jitter = Array.from({ length: N }, () => r() * 0.2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = Math.abs(Math.sin(((y % 4) / 4) * Math.PI)) + jitter[y];
  const { c, g } = canvas(N, N);
  for (let y = 0; y < N; y++) {
    const v = 150 + ((y % 4) - 1.5) * 18 + jitter[y] * 60;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, N, 1);
  }
  return { normalMap: finish(normalFromHeight(h, N, N, 1.4), [1, 12], false), roughnessMap: finish(c, [1, 12], false) };
}

/** FR4 board: solder mask with copper traces under the mask, gold pads, vias and white silkscreen. */
export function pcbMaps(seed: number, mask: "green" | "black" | "blue" = "green", label = ""): { map: THREE.Texture; roughnessMap: THREE.Texture; metalnessMap: THREE.Texture } {
  return {
    map: tex(`pcb-map-${seed}-${mask}-${label}`, () => pcbLayer(seed, mask, label, "color")),
    roughnessMap: tex(`pcb-r-${seed}-${mask}-${label}`, () => pcbLayer(seed, mask, label, "rough")),
    metalnessMap: tex(`pcb-m-${seed}-${mask}-${label}`, () => pcbLayer(seed, mask, label, "metal")),
  };
}

function pcbLayer(seed: number, mask: string, label: string, kind: "color" | "rough" | "metal"): THREE.Texture {
  const N = 512;
  const { c, g } = canvas(N, N);
  const r = rng(seed);
  const base = { green: "#0f4a2a", black: "#121418", blue: "#123067" }[mask] ?? "#0f4a2a";
  const trace = { green: "#1d6b3c", black: "#22262c", blue: "#1f4686" }[mask] ?? "#1d6b3c";
  // colour: mask; rough: mask is fairly glossy (0.35), pads rough-ish metal; metal: pads only
  g.fillStyle = kind === "color" ? base : kind === "rough" ? "#5a5a5a" : "#000000";
  g.fillRect(0, 0, N, N);
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = kind === "color" ? trace : kind === "rough" ? "#505050" : "#000000";
    g.lineWidth = 2 + r() * 4;
    let x = r() * N;
    let y = r() * N;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      const len = 20 + r() * 120;
      const dir = Math.floor(r() * 8) * (Math.PI / 4);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // gold pads (ENIG) in rows, and vias
  const gold = kind === "color" ? "#d4a947" : kind === "rough" ? "#4a4a4a" : "#ffffff";
  for (let i = 0; i < 14; i++) {
    const x = r() * (N - 80);
    const y = r() * (N - 40);
    const n = 3 + Math.floor(r() * 8);
    const vert = r() > 0.5;
    for (let k = 0; k < n; k++) {
      g.fillStyle = gold;
      if (vert) g.fillRect(x, y + k * 9, 10, 5);
      else g.fillRect(x + k * 9, y, 5, 10);
    }
  }
  for (let i = 0; i < 80; i++) {
    const x = r() * N;
    const y = r() * N;
    g.fillStyle = gold;
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
    if (kind === "color") {
      g.fillStyle = "#0a0a0a";
      g.beginPath();
      g.arc(x, y, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  // silkscreen: component outlines and reference designators
  if (kind !== "metal") {
    g.strokeStyle = kind === "color" ? "rgba(240,240,235,0.85)" : "#8a8a8a";
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 1.5;
    g.font = "bold 13px monospace";
    for (let i = 0; i < 10; i++) {
      const x = r() * (N - 60);
      const y = r() * (N - 40);
      g.strokeRect(x, y, 20 + r() * 30, 12 + r() * 20);
      g.fillText(`${["R", "C", "U", "D", "J"][Math.floor(r() * 5)]}${1 + Math.floor(r() * 30)}`, x, y - 3);
    }
    if (label) {
      g.font = "bold 24px monospace";
      g.fillText(label, 18, N - 18);
    }
  }
  return finish(c, [1, 1], kind === "color");
}

/** Silkscreen-style text on a transparent canvas (generic part markings, never brands). */
export function labelTexture(lines: string[], opts: { bg?: string; fg?: string; w?: number; h?: number; size?: number } = {}): THREE.Texture {
  const key = `label-${lines.join("|")}-${JSON.stringify(opts)}`;
  return tex(key, () => {
    const w = opts.w ?? 512;
    const h = opts.h ?? 256;
    const { c, g } = canvas(w, h);
    g.fillStyle = opts.bg ?? "#141418";
    g.fillRect(0, 0, w, h);
    g.fillStyle = opts.fg ?? "#d8d6e2";
    const size = opts.size ?? Math.floor(h / (lines.length + 1.2));
    g.font = `600 ${size}px ui-monospace, monospace`;
    lines.forEach((l, i) => g.fillText(l, size * 0.5, size * (1.15 + i * 1.1)));
    return finish(c);
  });
}

/** Fine brushed / bead-blasted grain for aluminium (roughness variation). */
function brushedRough(): THREE.Texture {
  const N = 256;
  const { c, g } = canvas(N, N);
  const r = rng(3);
  // Multiplies the material roughness: mostly 1.0 with faint darker streaks (bead-blasted, lightly brushed).
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 1400; i++) {
    const v = 200 + r() * 55;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(r() * N, r() * N, 20 + r() * 80, 1);
  }
  return finish(c, [2, 2], false);
}

/** Crinkled lithium pouch foil. */
function foilMaps(): { normalMap: THREE.Texture } {
  const N = 128;
  const h = new Float32Array(N * N);
  const r = rng(11);
  const waves = Array.from({ length: 6 }, () => ({ a: r() * Math.PI, f: 0.05 + r() * 0.12, p: r() * 6 }));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) h[y * N + x] = waves.reduce((s, w) => s + Math.sin((x * Math.cos(w.a) + y * Math.sin(w.a)) * w.f + w.p), 0) / 6;
  return { normalMap: finish(normalFromHeight(h, N, N, 0.6), [2, 2], false) };
}

// ---------- materials ----------

/** Marks a material as self-lit so hover tints leave it alone. */
function glow<T extends THREE.Material>(m: T): T {
  m.userData.glow = true;
  return m;
}

export const MAT = {
  carbon: () =>
    once("carbon", () => {
      const { map, normalMap } = carbonMaps();
      return new THREE.MeshPhysicalMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.42, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
    }),
  /** Anodized aluminium: metalness 1, roughness ~0.35, tinted. */
  aluminum: (tint = "#c4c7cf") => once(`alu-${tint}`, () => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 1, roughness: 0.38, roughnessMap: tex("brushed", brushedRough), clearcoat: 0.1, clearcoatRoughness: 0.5 })),
  steel: () => once("steel", () => new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 1, roughness: 0.28 })),
  blackSteel: () => once("blacksteel", () => new THREE.MeshStandardMaterial({ color: "#2a2b30", metalness: 0.9, roughness: 0.38 })),
  brass: () => once("brass", () => new THREE.MeshStandardMaterial({ color: "#c9a14a", metalness: 1, roughness: 0.3 })),
  copper: () => once("copper", () => new THREE.MeshStandardMaterial({ color: "#c7774a", metalness: 1, roughness: 0.32 })),
  gold: () => once("gold", () => new THREE.MeshStandardMaterial({ color: "#e0b350", metalness: 1, roughness: 0.2 })),
  pcb: (seed = 1, mask: "green" | "black" | "blue" = "green", label = "") =>
    once(`pcb-${seed}-${mask}-${label}`, () => new THREE.MeshPhysicalMaterial({ ...pcbMaps(seed, mask, label), color: "#ffffff", metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.25 })),
  /** Bare FR4 edge (the board's side faces). */
  fr4Edge: () => once("fr4edge", () => new THREE.MeshStandardMaterial({ color: "#b9a77a", roughness: 0.7 })),
  plasticMatte: (color = "#1b1b20") => once(`pm-${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, metalness: 0, sheen: 0.15, sheenRoughness: 0.8 })),
  plasticGloss: (color = "#121216") => once(`pg-${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.08 })),
  /** 3D-printed PLA/PETG with visible 0.2 mm layer lines. */
  printed: (color = "#e9e6df") =>
    once(`print-${color}`, () => {
      const { normalMap, roughnessMap } = layerMaps();
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.5, 0.5), sheen: 0.2 });
    }),
  rubber: (color = "#18181b") => once(`rubber-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 })),
  silicone: (color = "#c23a3a") => once(`sil-${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).multiplyScalar(1.4) })),
  glass: (tint = "#eef3ff") => once(`glass-${tint}`, () => new THREE.MeshPhysicalMaterial({ color: tint, transmission: 1, thickness: 0.02, roughness: 0.03, ior: 1.52, metalness: 0, specularIntensity: 1, envMapIntensity: 1.2 })),
  /** Dark cover glass over a display (reflective, not see-through). */
  coverGlass: () => once("coverglass", () => new THREE.MeshPhysicalMaterial({ color: "#05060a", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.52, reflectivity: 0.6 })),
  foil: (color = "#b8bcc4") =>
    once(`foil-${color}`, () => new THREE.MeshPhysicalMaterial({ color, metalness: 0.85, roughness: 0.32, normalMap: foilMaps().normalMap, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.4 })),
  ceramic: () => once("ceramic", () => new THREE.MeshStandardMaterial({ color: "#c8b892", roughness: 0.55 })),
  chip: () => once("chip", () => new THREE.MeshStandardMaterial({ color: "#151519", roughness: 0.4, metalness: 0.1 })),
  /** Emissive LED: emissive intensity > 1 so only these bloom. */
  led: (color = "#3ddc97") => once(`led-${color}`, () => glow(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 4, toneMapped: false }))),
  screen: (map: THREE.Texture, key: string) => once(`screen-${key}`, () => glow(new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: map, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0 }))),
};

export type MatKey = keyof typeof MAT;
