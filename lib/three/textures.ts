"use client";

// Canvas-generated textures for the procedural device models (no downloaded assets, no logos).
import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 3K twill carbon weave. */
export function carbonTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(256, 256);
  g.fillStyle = "#121216";
  g.fillRect(0, 0, 256, 256);
  const n = 16;
  const s = 256 / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const along = (x + y) % 4 < 2;
      const grad = along ? g.createLinearGradient(x * s, 0, x * s + s, 0) : g.createLinearGradient(0, y * s, 0, y * s + s);
      grad.addColorStop(0, "#1a1a20");
      grad.addColorStop(0.5, "#34343e");
      grad.addColorStop(1, "#16161b");
      g.fillStyle = grad;
      g.fillRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
    }
  return finish(c, 3);
}

/** Solder mask with traces, vias and gold pads; deterministic per seed. */
export function pcbTexture(seed: number, mask = "#101418", label = ""): THREE.CanvasTexture {
  const { c, g } = canvas(512, 512);
  const r = seeded(seed);
  g.fillStyle = mask;
  g.fillRect(0, 0, 512, 512);
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(150,170,190,${0.08 + r() * 0.08})`;
    g.lineWidth = 2 + r() * 3;
    let x = r() * 512;
    let y = r() * 512;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      const len = 30 + r() * 110;
      const dir = Math.floor(r() * 8) * (Math.PI / 4);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() > 0.5 ? "#c9a24a" : "#8a7a4a";
    const x = r() * 512;
    const y = r() * 512;
    g.beginPath();
    g.arc(x, y, 2 + r() * 2.5, 0, Math.PI * 2);
    g.fill();
  }
  if (label) {
    g.fillStyle = "rgba(238,244,240,0.85)";
    g.font = "bold 26px monospace";
    g.fillText(label, 24, 490);
  }
  return finish(c);
}

/** Printed label for a battery pack (generic, no brand). */
export function batteryLabel(lines: string[]): THREE.CanvasTexture {
  const { c, g } = canvas(1024, 512);
  g.fillStyle = "#16161f";
  g.fillRect(0, 0, 1024, 512);
  const grad = g.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, "#0f9d6b");
  grad.addColorStop(1, "#0a6b49");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 120);
  g.fillStyle = "#ffffff";
  g.font = "bold 72px sans-serif";
  g.fillText(lines[0] ?? "", 40, 90);
  g.fillStyle = "#eef4f0";
  g.font = "52px monospace";
  lines.slice(1).forEach((l, i) => g.fillText(l, 40, 210 + i * 70));
  g.fillStyle = "#9bb3a7";
  g.font = "26px sans-serif";
  g.fillText("Do not puncture, short or charge unattended. Balance charge only.", 40, 470);
  return finish(c);
}

/** Copper winding stripes for motor stators. */
export function coilTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(128, 128);
  for (let y = 0; y < 128; y += 4) {
    const grad = g.createLinearGradient(0, y, 0, y + 4);
    grad.addColorStop(0, "#5a2e10");
    grad.addColorStop(0.5, "#e08a4c");
    grad.addColorStop(1, "#6a3412");
    g.fillStyle = grad;
    g.fillRect(0, y, 128, 4);
  }
  return finish(c, 2);
}
