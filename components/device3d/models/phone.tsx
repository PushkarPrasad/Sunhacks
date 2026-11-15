"use client";

// Generic smartphone (procedural, no brand). Real proportions: 147 x 71.5 x 7.8 mm, 10.5 mm corner radius,
// glass front and back, aluminium frame with antenna lines, camera plateau with lens stacks.
// Scale: 1 scene unit = 40 mm. The phone stands upright, screen towards +Z; layers explode along Z.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, roundedRectShape } from "@/lib/three/geo";
import { Part, type ProductDef } from "../product/ProductModel";

const S = 1 / 40;
const W = 71.5 * S;
const L = 147 * S;
const D = 7.8 * S;
const R = 10.5 * S;
type V3 = [number, number, number];

/** Frame band: rounded-rect ring extruded through the thickness, softly bevelled. */
function frameGeometry(): THREE.BufferGeometry {
  const b = 0.6 * S;
  const outer = roundedRectShape(W - b * 2, L - b * 2, R - b);
  const inner = roundedRectShape(W - 2.6 * S, L - 2.6 * S, R - 1.3 * S);
  outer.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
  const g = new THREE.ExtrudeGeometry(outer, { depth: D - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 28 });
  g.translate(0, 0, -(D - b * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Home-screen texture: wallpaper, status bar, clock, a widget and a grid of generic app tiles. */
function screenTexture(): THREE.Texture {
  const w = 720;
  const h = 1480;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#06100c");
  bg.addColorStop(0.45, "#0a6b49");
  bg.addColorStop(1, "#0f3a2c");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.75, h * 0.25, 10, w * 0.75, h * 0.25, w * 0.8);
  glow.addColorStop(0, "rgba(94,226,168,0.55)");
  glow.addColorStop(1, "rgba(94,226,168,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ffffff";
  g.font = "600 34px system-ui, sans-serif";
  g.fillText("10:24", 52, 64);
  g.fillRect(w - 120, 40, 56, 26);
  g.font = "200 190px system-ui, sans-serif";
  g.fillText("10:24", 70, 360);
  g.font = "500 40px system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillText("Sunday, 15 November", 82, 430);
  // widget
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.beginPath();
  g.roundRect(52, 500, w - 104, 230, 44);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "600 40px system-ui, sans-serif";
  g.fillText("Build checks", 92, 572);
  g.font = "400 32px system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.fillText("6 of 6 passing · 3.2 h battery", 92, 626);
  g.fillStyle = "#5ee2a8";
  g.beginPath();
  g.roundRect(92, 660, (w - 184) * 0.82, 18, 9);
  g.fill();
  // app grid
  const colors = ["#e8b04b", "#5ee2a8", "#f0706a", "#0f9d6b", "#0a6b49", "#eef4f0", "#c8a96a", "#2bc0e4", "#ffd166", "#ef476f", "#06d6a0", "#0a6b49", "#14b47c", "#fb5607", "#ffbe0b", "#8ecae6"];
  for (let i = 0; i < 16; i++) {
    const x = 70 + (i % 4) * 158;
    const y = 800 + Math.floor(i / 4) * 160;
    g.fillStyle = colors[i];
    g.beginPath();
    g.roundRect(x, y, 112, 112, 30);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(x + 56, y + 56, 24, 0, Math.PI * 2);
    g.fill();
  }
  // dock
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.beginPath();
  g.roundRect(40, h - 220, w - 80, 170, 56);
  g.fill();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = ["#5ee2a8", "#0a6b49", "#e8b04b", "#eef4f0"][i];
    g.beginPath();
    g.roundRect(78 + i * 158, h - 192, 112, 112, 30);
    g.fill();
  }
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.roundRect(w / 2 - 110, h - 34, 220, 10, 5);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Map a rounded-rect ShapeGeometry's UVs to 0..1 over its bounds (ShapeGeometry uses raw XY otherwise). */
function fitUv(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  uv.needsUpdate = true;
  return g;
}

function Front() {
  const glass = useMemo(() => plate(W - 1.3 * S, L - 1.3 * S, 0.8 * S, { r: R - 0.65 * S, bevel: 0.35 * S }), []);
  const screen = useMemo(() => fitUv(new THREE.ShapeGeometry(roundedRectShape(W - 3.2 * S, L - 3.2 * S, R - 1.8 * S), 24)), []);
  const screenMat = useMemo(() => MAT.screen(screenTexture(), "phone-home"), []);
  const punch = useMemo(() => roundCyl(1.6 * S, 0.2 * S, 0.1 * S, 24), []);
  return (
    <Group>
      <mesh geometry={screen} material={screenMat} position={[0, 0, D / 2 - 0.85 * S]} />
      <mesh geometry={punch} material={MAT.chip()} position={[0, L / 2 - 6 * S, D / 2 - 0.8 * S]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={glass} material={MAT.glass("#f4f6ff")} position={[0, 0, D / 2 - 0.4 * S]} />
    </Group>
  );
}

function Frame() {
  const geo = useMemo(() => frameGeometry(), []);
  const strip = useMemo(() => block(1.2 * S, 1.2 * S, D * 0.82, 0.3 * S), []);
  const button = useMemo(() => block(1.2 * S, 1, 2.4 * S, 0.5 * S), []);
  const port = useMemo(() => plate(9 * S, 3.2 * S, 1 * S, { r: 1.5 * S, bevel: 0.2 * S }), []);
  const grille = useMemo(() => roundCyl(0.6 * S, 1.2 * S, 0.2 * S, 12), []);
  // Antenna lines: plastic breaks in the metal band near each corner.
  const lines: { p: V3; r?: V3 }[] = [
    { p: [-W / 2 + 0.6 * S, L / 2 - 18 * S, 0] },
    { p: [W / 2 - 0.6 * S, L / 2 - 18 * S, 0] },
    { p: [-W / 2 + 0.6 * S, -L / 2 + 18 * S, 0] },
    { p: [W / 2 - 0.6 * S, -L / 2 + 18 * S, 0] },
    { p: [-W / 2 + 16 * S, L / 2 - 0.6 * S, 0], r: [0, 0, Math.PI / 2] },
    { p: [W / 2 - 16 * S, -L / 2 + 0.6 * S, 0], r: [0, 0, Math.PI / 2] },
  ];
  return (
    <Group>
      <mesh geometry={geo} material={MAT.aluminum("#8e93a0")} />
      <Instances geo={strip} mat={MAT.plasticGloss("#3a3d47")} at={lines} />
      {/* power button right, volume rocker left */}
      <mesh geometry={button} material={MAT.aluminum("#8e93a0")} position={[W / 2 + 0.25 * S, L * 0.14, 0]} scale={[1, 16 * S, 1]} />
      <mesh geometry={button} material={MAT.aluminum("#8e93a0")} position={[-W / 2 - 0.25 * S, L * 0.2, 0]} scale={[1, 22 * S, 1]} />
      <mesh geometry={port} material={MAT.chip()} position={[0, -L / 2 + 0.2 * S, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={grille} mat={MAT.chip()} at={[-14, -11, -8, 8, 11, 14].map((x) => ({ p: [x * S, -L / 2 + 0.3 * S, 0] as V3 }))} />
    </Group>
  );
}

/** One lens stack: anodized ring, black barrel, three glass elements and a coated front lens; axis -Z (pointing back). */
function Lens({ r }: { r: number }) {
  const ring = useMemo(
    () =>
      lathe(
        [
          [r * 0.82, 0],
          [r, 0],
          [r, r * 0.22],
          [r * 0.95, r * 0.28],
          [r * 0.82, r * 0.28],
          [r * 0.82, 0],
        ],
        48,
      ),
    [r],
  );
  const barrel = useMemo(() => roundCyl(r * 0.8, r * 0.5, r * 0.05, 40), [r]);
  const element = useMemo(() => lathe([[0, r * 0.05], [r * 0.6, 0.0], [r * 0.6, -r * 0.03], [0, -r * 0.01]], 40), [r]);
  const coat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#10261d", metalness: 0.2, roughness: 0.04, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 600] }), []);
  return (
    <Group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={ring} material={MAT.aluminum("#9aa0ab")} />
      <mesh geometry={barrel} material={MAT.chip()} position={[0, r * 0.05, 0]} />
      {[0.1, 0.18, 0.26].map((y, i) => (
        <mesh key={y} geometry={element} material={i === 2 ? coat : MAT.glass()} position={[0, r * y, 0]} />
      ))}
    </Group>
  );
}

function Back() {
  const glass = useMemo(() => plate(W - 1.3 * S, L - 1.3 * S, 0.8 * S, { r: R - 0.65 * S, bevel: 0.35 * S }), []);
  const backMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#2a2c38", roughness: 0.28, metalness: 0.1, transmission: 0.25, thickness: 0.02, clearcoat: 1, clearcoatRoughness: 0.15, ior: 1.5 }), []);
  const plateau = useMemo(() => plate(30 * S, 30 * S, 1.6 * S, { r: 7 * S, bevel: 0.6 * S }), []);
  const flash = useMemo(() => roundCyl(2.2 * S, 0.4 * S, 0.2 * S, 24), []);
  const cx = -W / 2 + 19 * S;
  const cy = L / 2 - 19 * S;
  const z = -D / 2 + 0.4 * S;
  return (
    <Group>
      <mesh geometry={glass} material={backMat} position={[0, 0, z]} />
      <mesh geometry={plateau} material={backMat} position={[cx, cy, z - 1.1 * S]} />
      {[
        [-6.5, 6.5, 6],
        [-6.5, -6.5, 6],
        [6.5, 6.5, 4.6],
      ].map(([x, y, r]) => (
        <Group key={`${x}${y}`} position={[cx + x * S, cy + y * S, z - 1.85 * S]}>
          <Lens r={r * S} />
        </Group>
      ))}
      <mesh geometry={flash} material={MAT.plasticGloss("#e8dfc4")} position={[cx + 6.5 * S, cy - 6.5 * S, z - 2 * S]} rotation={[Math.PI / 2, 0, 0]} />
    </Group>
  );
}

function Internals({ which }: { which: "mid" | "board" | "battery" | "modules" }) {
  const mid = useMemo(() => plate(W - 3 * S, L - 3 * S, 0.8 * S, { r: R - 1.5 * S, bevel: 0.2 * S, holes: [[0, -14 * S, 26 * S, 56 * S, 3 * S]] }), []);
  const board = useMemo(() => {
    // L-shaped logic board: top section plus a strip down one side.
    const s = new THREE.Shape();
    const x0 = -W / 2 + 3 * S;
    const x1 = W / 2 - 3 * S;
    const yTop = L / 2 - 4 * S;
    const yMid = L / 2 - 40 * S;
    const yBot = -L / 2 + 34 * S;
    s.moveTo(x0, yTop);
    s.lineTo(x1, yTop);
    s.lineTo(x1, yBot);
    s.lineTo(x1 - 14 * S, yBot);
    s.lineTo(x1 - 14 * S, yMid);
    s.lineTo(x0, yMid);
    s.lineTo(x0, yTop);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.8 * S, bevelEnabled: true, bevelThickness: 0.1 * S, bevelSize: 0.1 * S, bevelSegments: 1 });
    g.computeVertexNormals();
    return g;
  }, []);
  const shield = useMemo(() => block(13 * S, 11 * S, 1.2 * S, 0.5 * S), []);
  const shieldMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c7cad1", metalness: 1, roughness: 0.42, map: labelTexture(["", ""], { bg: "#9da0a8", w: 64, h: 64 }) }), []);
  const cell = useMemo(() => block(W - 14 * S, 66 * S, 4.6 * S, 2 * S), []);
  const cellLabel = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["Li-ion Polymer", "3.87 V  4000 mAh  15.5 Wh"], { bg: "#1a1b22", fg: "#d6d4e0", w: 512, h: 160, size: 34 }), roughness: 0.4 }), []);
  const flex = useMemo(() => plate(5 * S, 30 * S, 0.25 * S, { r: 1 * S, bevel: 0.05 * S }), []);
  const flexMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c47a2a", roughness: 0.45, metalness: 0.2 }), []);
  const speaker = useMemo(() => block(16 * S, 9 * S, 3.2 * S, 0.8 * S), []);
  const haptic = useMemo(() => block(18 * S, 8 * S, 3.5 * S, 1 * S), []);
  const camMod = useMemo(() => block(11 * S, 11 * S, 5.5 * S, 1 * S), []);
  if (which === "mid") return <mesh geometry={mid} material={MAT.aluminum("#9da2ac")} />;
  if (which === "board")
    return (
      <Group>
        <mesh geometry={board} material={MAT.pcb(77, "black")} position={[0, 0, -0.4 * S]} />
        <Instances
          geo={shield}
          mat={shieldMat}
          at={[
            { p: [-W / 2 + 12 * S, L / 2 - 14 * S, 0.9 * S] },
            { p: [-W / 2 + 27 * S, L / 2 - 14 * S, 0.9 * S] },
            { p: [-W / 2 + 12 * S, L / 2 - 28 * S, 0.9 * S] },
            { p: [W / 2 - 10 * S, L / 2 - 50 * S, 0.9 * S], r: [0, 0, Math.PI / 2] },
            { p: [W / 2 - 10 * S, L / 2 - 70 * S, 0.9 * S], r: [0, 0, Math.PI / 2] },
          ]}
        />
        <mesh geometry={flex} material={flexMat} position={[W / 2 - 22 * S, L / 2 - 50 * S, 0.6 * S]} />
        <mesh geometry={flex} material={flexMat} position={[-6 * S, -L / 2 + 20 * S, 0.6 * S]} rotation={[0, 0, Math.PI / 2]} />
      </Group>
    );
  if (which === "battery")
    return (
      <Group position={[-4 * S, -14 * S, 0]}>
        <mesh geometry={cell} material={MAT.foil("#b9bec8")} />
        <mesh material={cellLabel} position={[0, 0, 2.31 * S]}>
          <planeGeometry args={[W - 22 * S, 22 * S]} />
        </mesh>
      </Group>
    );
  return (
    <Group>
      <mesh geometry={speaker} material={MAT.plasticMatte("#1d1e24")} position={[W / 2 - 14 * S, -L / 2 + 9 * S, 0]} />
      <mesh geometry={haptic} material={MAT.steel()} position={[-W / 2 + 15 * S, -L / 2 + 9 * S, 0]} />
      <Instances geo={camMod} mat={MAT.blackSteel()} at={[{ p: [-W / 2 + 12.5 * S, L / 2 - 12.5 * S, -1.5 * S] }, { p: [-W / 2 + 12.5 * S, L / 2 - 25.5 * S, -1.5 * S] }, { p: [-W / 2 + 25.5 * S, L / 2 - 12.5 * S, -1.5 * S] }]} />
    </Group>
  );
}

function Body() {
  return (
    <Group rotation={[-0.12, -0.5, 0]} position={[0, L / 2, 0]}>
      <Part id="front">
        <Front />
      </Part>
      <Part id="frame">
        <Frame />
      </Part>
      <Part id="mid">
        <Internals which="mid" />
      </Part>
      <Part id="board">
        <Internals which="board" />
      </Part>
      <Part id="battery">
        <Internals which="battery" />
      </Part>
      <Part id="modules">
        <Internals which="modules" />
      </Part>
      <Part id="back">
        <Back />
      </Part>
    </Group>
  );
}

export const PHONE: ProductDef = {
  id: "phone",
  name: "Smartphone",
  Body,
  camera: [4.6, 2.8, 10.4],
  floor: -0.02,
  offset: [0, -1.85, 0],
  shadowScale: 6,
  aoRadius: 0.12,
  minDistance: 2.5,
  maxDistance: 12,
  parts: [
    { id: "front", name: "Display and cover glass", role: "OLED panel bonded under 0.8 mm cover glass with a touch layer; the punch-hole holds the selfie camera.", specs: [["Size", "6.1 in, 2532 x 1170"], ["Glass", "0.8 mm aluminosilicate"], ["Refresh", "120 Hz"]], maker: "ST7789 TFT + capacitive touch", explode: [0, 0, 1.3], layer: 6, anchor: [0.5, 1.2, 0.1] },
    { id: "frame", name: "Aluminium frame", role: "The band that takes knocks. Plastic breaks in the metal are antenna lines, so the frame itself works as the antennas.", specs: [["Material", "7000-series aluminium"], ["Antenna lines", "6"], ["Buttons", "Power + volume"]], maker: "3D-printed case", explode: [0, 0, 0.35], layer: 4, anchor: [0.9, 0.4, 0], shell: true },
    { id: "mid", name: "Mid-frame", role: "An inner plate that stiffens the phone and spreads heat from the processor.", specs: [["Thickness", "0.8 mm"]], maker: "Carrier PCB stiffener", explode: [0, 0, 0.1], layer: 3, anchor: [-0.6, 0.6, 0] },
    { id: "board", name: "Logic board", role: "Processor, memory, modem and power chips under stamped steel RF shields, with flex cables to the display and battery.", specs: [["Layers", "10, stacked"], ["Shields", "5 RF cans"], ["Flex", "Display, battery"]], maker: "ESP32 module on a carrier PCB", explode: [0, 0, -0.45], layer: 2, anchor: [-0.4, 1.5, 0.05] },
    { id: "battery", name: "Pouch battery", role: "A single lithium-polymer cell in foil, glued in with pull tabs.", specs: [["Capacity", "4000 mAh"], ["Voltage", "3.87 V"], ["Energy", "15.5 Wh"]], maker: "LiPo 2000 mAh + TP4056", explode: [0, 0, -0.85], layer: 2, anchor: [0, -0.4, 0.06] },
    { id: "modules", name: "Speaker, haptics and cameras", role: "Bottom speaker, the linear vibration motor and the three rear camera modules.", specs: [["Cameras", "3 rear + 1 front"], ["Haptics", "Linear resonant"]], maker: "Speaker + vibration motor", explode: [0, 0, -1.25], layer: 1, anchor: [0.5, -1.6, 0] },
    { id: "back", name: "Back glass and lenses", role: "Glass back with the camera plateau: each lens is a stack of glass elements behind a sapphire-coated cover.", specs: [["Lenses", "3, 5-7 elements each"], ["Flash", "Dual-tone LED"]], maker: "OV2640 camera module", explode: [0, 0, -1.7], layer: 0, anchor: [-0.45, 1.4, -0.15], shell: true },
  ],
};
