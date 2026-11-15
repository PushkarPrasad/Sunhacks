"use client";

// Compact desktop synthesizer (procedural, generic): 330 x 160 x 48 mm, walnut cheeks, anodized top panel,
// 25 mini keys, a knob grid with pointer lines, OLED, two faders, jacks; inside a main PCB, speaker and battery.
// Scale: 1 scene unit = 60 mm.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";

const S = 1 / 60;
const W = 330 * S;
const D = 160 * S;
const H = 48 * S;
type V3 = [number, number, number];

function walnut(): THREE.MeshPhysicalMaterial {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  g.fillStyle = "#5a3a22";
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    const y = rnd() * 128;
    g.strokeStyle = `rgba(${30 + rnd() * 40},${18 + rnd() * 20},${8 + rnd() * 10},${0.25 + rnd() * 0.35})`;
    g.lineWidth = 1 + rnd() * 2.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.5, 1.5);
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.3 });
}

function Case({ part }: { part: "cheeks" | "panel" | "bottom" }) {
  const cheek = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-D / 2, 0);
    s.lineTo(D / 2, 0);
    s.lineTo(D / 2, H * 0.55);
    s.quadraticCurveTo(D / 2 - 0.1, H, D / 2 - 0.3, H);
    s.lineTo(-D / 2 + 0.2, H * 1.25);
    s.quadraticCurveTo(-D / 2, H * 1.25, -D / 2, H);
    s.lineTo(-D / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 14 * S, bevelEnabled: true, bevelThickness: 1.5 * S, bevelSize: 1.5 * S, bevelSegments: 3 });
    g.computeVertexNormals();
    return g;
  }, []);
  const wood = useMemo(() => walnut(), []);
  const panel = useMemo(() => plate(W - 32 * S, D - 2 * S, 2 * S, { r: 3 * S, bevel: 0.6 * S, holes: [[0, -(D / 2 - 38 * S), W - 46 * S, 66 * S, 2 * S]] }), []);
  const bottom = useMemo(() => plate(W - 32 * S, D - 2 * S, 3 * S, { r: 3 * S, bevel: 0.6 * S }), []);
  const foot = useMemo(() => roundCyl(5 * S, 3 * S, 1 * S, 24), []);
  if (part === "cheeks")
    return (
      <Group>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={cheek} material={wood} position={[s * (W / 2 - 8 * S) - 7 * S, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        ))}
      </Group>
    );
  if (part === "panel") return <mesh geometry={panel} material={MAT.aluminum("#2a2b33")} position={[0, H - 1 * S, 0]} rotation={[-Math.PI / 2 + 0.06, 0, 0]} />;
  return (
    <Group>
      <mesh geometry={bottom} material={MAT.aluminum("#1d1e24")} position={[0, 1.5 * S, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <Instances geo={foot} mat={MAT.rubber()} at={[-1, 1].flatMap((a) => [-1, 1].map((b) => ({ p: [a * (W / 2 - 30 * S), -1 * S, b * (D / 2 - 18 * S)] as V3 })))} />
    </Group>
  );
}

function Keys() {
  // 25 mini keys: 15 white (14 mm pitch), 10 black.
  const white = useMemo(() => block(13 * S, 62 * S, 9 * S, 1.2 * S), []);
  const black = useMemo(() => block(8 * S, 38 * S, 8 * S, 1 * S), []);
  const pitch = 14 * S;
  const whites: { p: V3; r: V3 }[] = [];
  const blacks: { p: V3; r: V3 }[] = [];
  const x0 = -7 * pitch;
  for (let i = 0; i < 15; i++) {
    whites.push({ p: [x0 + i * pitch, 12 * S, D / 2 - 36 * S], r: [-Math.PI / 2, 0, 0] });
    const n = i % 7;
    if (i < 14 && n !== 2 && n !== 6) blacks.push({ p: [x0 + (i + 0.5) * pitch, 20 * S, D / 2 - 48 * S], r: [-Math.PI / 2, 0, 0] });
  }
  const bed = useMemo(() => block(W - 50 * S, 66 * S, 6 * S, 1 * S), []);
  return (
    <Group>
      <mesh geometry={bed} material={MAT.plasticMatte("#121216")} position={[0, 5 * S, D / 2 - 38 * S]} rotation={[-Math.PI / 2, 0, 0]} />
      <Instances geo={white} mat={MAT.plasticGloss("#f1efe9")} at={whites} />
      <Instances geo={black} mat={MAT.plasticGloss("#141418")} at={blacks} />
    </Group>
  );
}

function Controls() {
  const knob = useMemo(
    () =>
      lathe(
        [
          [0, 9 * S],
          [4.5 * S, 9 * S],
          [5.6 * S, 8 * S],
          [6 * S, 6 * S],
          [6.6 * S, 0.5 * S],
          [6.2 * S, 0],
          [0, 0],
        ],
        40,
      ),
    [],
  );
  const pointer = useMemo(() => block(0.8 * S, 4 * S, 0.6 * S, 0.2 * S), []);
  const big = useMemo(() => lathe([[0, 12 * S], [8 * S, 12 * S], [9.4 * S, 10 * S], [10 * S, 1 * S], [9.6 * S, 0], [0, 0]], 48), []);
  const jack = useMemo(() => lathe([[2 * S, 0], [4.5 * S, 0], [4.5 * S, 2 * S], [3.8 * S, 2.6 * S], [2 * S, 2.6 * S]], 24), []);
  const fader = useMemo(() => block(9 * S, 5 * S, 7 * S, 1 * S), []);
  const slot = useMemo(() => block(2 * S, 40 * S, 0.6 * S, 0.3 * S), []);
  const oled = useMemo(() => labelTexture(["SAW  ▸ LPF 1.2k", "RES 42  ENV  A 10 D 300", "♪ 128 BPM"], { bg: "#05060a", fg: "#c8a96a", w: 512, h: 160, size: 34 }), []);
  const oledMat = useMemo(() => MAT.screen(oled, "synth-oled"), [oled]);
  const legend = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["CUTOFF   RES   ENV   LFO   DRIVE   GLIDE"], { bg: "#2a2b33", fg: "#c9c7d3", w: 1024, h: 48, size: 28 }), roughness: 0.4, metalness: 0.6 }), []);
  const knobs: { p: V3 }[] = [];
  const pointers: { p: V3; r: V3 }[] = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 6; c++) {
      const x = -W / 2 + 62 * S + c * 26 * S;
      const z = -D / 2 + 22 * S + r * 26 * S;
      const y = H + 0.2 * S + (D / 2 - (z + D / 2)) * 0.06 * 0 + 1 * S;
      knobs.push({ p: [x, y, z] });
      const a = -2.2 + ((r * 6 + c) * 0.77) % 4.4;
      pointers.push({ p: [x + Math.sin(a) * 3 * S, y + 9.1 * S, z - Math.cos(a) * 3 * S], r: [-Math.PI / 2, 0, -a] });
    }
  return (
    <Group rotation={[0.06, 0, 0]} position={[0, -0.2 * S, 0]}>
      <Instances geo={knob} mat={MAT.aluminum("#c3c6cd")} at={knobs} />
      <Instances geo={pointer} mat={MAT.plasticMatte("#3a413e")} at={pointers} />
      <mesh geometry={big} material={MAT.aluminum("#0a6b49")} position={[W / 2 - 52 * S, H + 1 * S, -D / 2 + 34 * S]} />
      <mesh material={oledMat} position={[W / 2 - 92 * S, H + 1.2 * S, -D / 2 + 22 * S]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44 * S, 14 * S]} />
      </mesh>
      <mesh material={legend} position={[-W / 2 + 127 * S, H + 1.1 * S, -D / 2 + 35 * S]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150 * S, 6 * S]} />
      </mesh>
      {[0, 1].map((i) => (
        <Group key={i} position={[W / 2 - 98 * S + i * 18 * S, H + 1 * S, -D / 2 + 50 * S]}>
          <mesh geometry={slot} material={MAT.chip()} rotation={[-Math.PI / 2, 0, 0]} />
          <mesh geometry={fader} material={MAT.plasticMatte("#e9e8e3")} position={[0, 3 * S, (i ? 8 : -6) * S]} rotation={[-Math.PI / 2, 0, 0]} />
        </Group>
      ))}
      <Instances geo={jack} mat={MAT.steel()} at={[0, 1, 2, 3].map((i) => ({ p: [-W / 2 + 40 * S + i * 14 * S, H + 1 * S, -D / 2 + 8 * S] as V3 }))} />
      <mesh position={[W / 2 - 70 * S, H + 1.5 * S, -D / 2 + 50 * S]} material={MAT.led("#5ee2a8")}>
        <sphereGeometry args={[1.5 * S, 12, 12]} />
      </mesh>
    </Group>
  );
}

function Internals({ which }: { which: "pcb" | "audio" }) {
  const pcb = useMemo(() => plate(W - 40 * S, D - 20 * S, 1.6 * S, { r: 3 * S, bevel: 0.3 * S }), []);
  const chip = useMemo(() => block(14 * S, 14 * S, 1.6 * S, 0.4 * S), []);
  const cap = useMemo(() => roundCyl(3 * S, 8 * S, 0.6 * S, 16), []);
  const speakerBody = useMemo(() => roundCyl(20 * S, 10 * S, 2 * S, 48), []);
  const cone = useMemo(() => lathe([[2 * S, 3 * S], [17 * S, 6 * S], [18 * S, 6.5 * S], [18 * S, 5.5 * S], [2 * S, 2 * S]], 48), []);
  const cell = useMemo(() => block(60 * S, 34 * S, 8 * S, 2 * S), []);
  if (which === "pcb")
    return (
      <Group position={[0, 3.6 * S, 0]}>
        <mesh geometry={pcb} material={MAT.pcb(401, "black", "SYNTH MAIN v3")} rotation={[-Math.PI / 2, 0, 0]} />
        <Instances geo={chip} mat={MAT.chip()} at={[-40, 0, 40].map((x) => ({ p: [x * S, 1.6 * S, -10 * S] as V3, r: [-Math.PI / 2, 0, 0] as V3 }))} />
        <Instances geo={cap} mat={MAT.aluminum("#1d7a58")} at={[-60, -50, 55, 65].map((x) => ({ p: [x * S, 4.8 * S, 20 * S] as V3 }))} />
      </Group>
    );
  return (
    <Group position={[0, 8 * S, 0]}>
      <Group position={[-W / 2 + 70 * S, 6 * S, -48 * S]}>
        <mesh geometry={speakerBody} material={MAT.blackSteel()} />
        <mesh geometry={cone} material={MAT.plasticMatte("#1d1d22")} />
      </Group>
      <mesh geometry={cell} material={MAT.foil("#b9bec8")} position={[50 * S, 4 * S, -52 * S]} rotation={[-Math.PI / 2, 0, 0]} />
    </Group>
  );
}

function Body() {
  return (
    <Group rotation={[0, -0.15, 0]}>
      <Part id="cheeks">
        <Case part="cheeks" />
      </Part>
      <Part id="panel">
        <Case part="panel" />
      </Part>
      <Part id="controls">
        <Ex v={[0, 0.25, 0]} delay={2}>
          <Controls />
        </Ex>
      </Part>
      <Part id="keys">
        <Keys />
      </Part>
      <Part id="pcb">
        <Internals which="pcb" />
      </Part>
      <Part id="audio">
        <Internals which="audio" />
      </Part>
      <Part id="bottom">
        <Case part="bottom" />
      </Part>
    </Group>
  );
}

export const SYNTH: ProductDef = {
  id: "synth",
  name: "Desktop synthesizer",
  Body,
  camera: [5.4, 6.4, 9.8],
  floor: -0.02,
  offset: [0, -0.6, 0],
  exposure: 1.15,
  shadowScale: 9,
  aoRadius: 0.15,
  minDistance: 3,
  maxDistance: 14,
  parts: [
    { id: "cheeks", name: "Walnut cheeks", role: "Solid wood end cheeks give the case its wedge shape and something nice to hold.", specs: [["Wood", "Walnut, oiled"], ["Thickness", "14 mm"]], maker: "Plywood offcuts", explode: [0, 0, 0], layer: 0, anchor: [2.6, 0.6, 0] },
    { id: "panel", name: "Top panel", role: "Anodized aluminium panel with the legends printed on.", specs: [["Material", "2 mm aluminium"]], maker: "Laser-cut acrylic", explode: [0, 1.0, 0], layer: 4, anchor: [-1.0, 0.85, -0.4], shell: true },
    { id: "controls", name: "Knobs, faders and screen", role: "Twelve pots, a big encoder, two faders, an OLED and four patch jacks.", specs: [["Pots", "12 x 10 kΩ"], ["Screen", "128 x 32 OLED"], ["Jacks", "4 x 3.5 mm"]], maker: "Potentiometers + SSD1306", explode: [0, 1.35, 0], layer: 5, anchor: [-1.2, 1.0, -0.9] },
    { id: "keys", name: "Mini keybed", role: "25 velocity-sensitive mini keys.", specs: [["Keys", "25 mini"], ["Sensing", "Velocity"]], maker: "Keypad 4x4 + buttons", explode: [0, 0.55, 0.6], layer: 3, anchor: [0.4, 0.4, 0.8] },
    { id: "pcb", name: "Main board", role: "Microcontroller running the oscillators and filters digitally, a DAC and the analog output stage.", specs: [["MCU", "32-bit, 600 MHz"], ["DAC", "24-bit"]], maker: "ESP32 + MAX98357A", explode: [0, 0.75, 0], layer: 2, anchor: [0.6, 0.48, -0.2] },
    { id: "audio", name: "Speaker and battery", role: "A small speaker for quick jams and a LiPo for playing anywhere.", specs: [["Speaker", "40 mm, 3 W"], ["Battery", "2000 mAh"]], maker: "3 W speaker + LiPo", explode: [0, 0.35, 0], layer: 1, anchor: [-1.9, 0.25, -0.35] },
    { id: "bottom", name: "Bottom plate", role: "Steel bottom plate with rubber feet.", specs: [["Feet", "4 x rubber"]], maker: "Plywood base", explode: [0, -0.45, 0], layer: 0, anchor: [1.6, 0.05, 0.9] },
  ],
};
