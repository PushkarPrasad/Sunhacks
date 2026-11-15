"use client";

// Generic 13-inch laptop (procedural, no brand): 304 x 212 x 15.5 mm unibody aluminium, instanced keycaps,
// glass trackpad, hinge barrel, lid open at 110 degrees. Inside: logic board, two blower fans, a copper heat pipe,
// six battery cells and two speakers. Scale: 1 scene unit = 60 mm.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, Screws } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";

const S = 1 / 60;
const W = 304 * S;
const D = 212 * S;
const R = 10 * S;
const TOP = 2.2 * S; // top case sheet thickness
const BOT = 1.5 * S; // bottom cover thickness
const H = 14 * S; // base height (without lid)
const KB_Z = -D / 2 + 12 * S + (6 * 18.5 * S) / 2; // keyboard centre, 12 mm from the hinge edge
const PAD_Z = D / 2 - 8 * S - 35 * S; // trackpad centre, 8 mm from the front
const LID_T = 4.5 * S;
const OPEN = (110 * Math.PI) / 180;
type V3 = [number, number, number];

const SILVER = "#c3c6cd";

/** A horizontal plate (XZ plane), top at y = 0. */
function Flat({ w, d, t, r, mat, y = 0, holes }: { w: number; d: number; t: number; r: number; mat: THREE.Material; y?: number; holes?: number[][] }) {
  const geo = useMemo(() => plate(w, d, t, { r, bevel: Math.min(t * 0.3, 1.2 * S), holes }), [w, d, t, r, holes]);
  return <mesh geometry={geo} material={mat} position={[0, y - t / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} />;
}

function desktopTexture(): THREE.Texture {
  const w = 1600;
  const h = 1000;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#160f3a");
  bg.addColorStop(0.5, "#33238e");
  bg.addColorStop(1, "#0c3a86");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.2, h * 0.8, 10, w * 0.2, h * 0.8, w * 0.6);
  glow.addColorStop(0, "rgba(124,92,255,0.5)");
  glow.addColorStop(1, "rgba(124,92,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(10,10,16,0.55)";
  g.fillRect(0, 0, w, 30);
  g.fillStyle = "#ffffff";
  g.font = "500 18px system-ui, sans-serif";
  g.fillText("Sun 15 Nov  10:24", w - 190, 21);
  // a window with a schematic-ish app
  g.fillStyle = "rgba(18,18,28,0.92)";
  g.beginPath();
  g.roundRect(170, 110, 980, 650, 18);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(170, 110, 980, 44);
  ["#ff6b6b", "#f5b14c", "#3ddc97"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(200 + i * 26, 132, 8, 0, Math.PI * 2);
    g.fill();
  });
  g.strokeStyle = "#7c5cff";
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.strokeRect(230 + (i % 3) * 300, 200 + Math.floor(i / 3) * 180, 180, 100);
  }
  g.strokeStyle = "#a5b4fc";
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    g.moveTo(410 + (i % 2) * 300, 250 + Math.floor(i / 2) * 120);
    g.lineTo(530 + (i % 2) * 300, 250 + Math.floor(i / 2) * 120);
  }
  g.stroke();
  // second window
  g.fillStyle = "rgba(236,234,245,0.9)";
  g.beginPath();
  g.roundRect(1000, 380, 460, 420, 18);
  g.fill();
  g.fillStyle = "#3ddc97";
  for (let i = 0; i < 6; i++) g.fillRect(1040, 440 + i * 56, 300 * (0.4 + ((i * 37) % 60) / 100), 22);
  // dock
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.beginPath();
  g.roundRect(w / 2 - 330, h - 90, 660, 72, 22);
  g.fill();
  for (let i = 0; i < 9; i++) {
    g.fillStyle = ["#7c5cff", "#3d7bff", "#3ddc97", "#f5b14c", "#ff6b6b", "#e8e6f2", "#2bc0e4", "#a5b4fc", "#ffd166"][i];
    g.beginPath();
    g.roundRect(w / 2 - 310 + i * 70, h - 80, 52, 52, 14);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Keyboard: rows of keys grouped by width so each width is one instanced draw. */
function Keyboard() {
  const U = 18.5 * S; // key pitch
  const rows: number[][] = [
    Array(14).fill(1).map((_, i) => (i === 0 || i === 13 ? 1.4 : 0.98)),
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1],
  ];
  const groups = useMemo(() => {
    const m = new Map<number, { p: V3 }[]>();
    rows.forEach((row, ri) => {
      const total = row.reduce((a, b) => a + b, 0) * U;
      let x = -total / 2;
      const z = (-2.5 + ri) * U * (ri === 0 ? 1 : 1) + (ri === 0 ? 0.12 * U : 0);
      row.forEach((w) => {
        const key = Math.round(w * 100) / 100;
        const list = m.get(key) ?? [];
        list.push({ p: [x + (w * U) / 2, 0, z] });
        m.set(key, list);
        x += w * U;
      });
    });
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const geos = useMemo(() => new Map(groups.map(([w]) => [w, keyGeo(w * U - 2.6 * S, 15.9 * S)])), [groups, U]);
  const keyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#1a1a1f", roughness: 0.55, sheen: 0.3, sheenRoughness: 0.6, clearcoat: 0.15 }), []);
  return (
    <Group>
      {groups.map(([w, at]) => (
        <Instances key={w} geo={geos.get(w)!} mat={keyMat} at={at} />
      ))}
    </Group>
  );
}
function keyGeo(w: number, d: number) {
  const g = block(w, d, 1.2 * S, 1.6 * S);
  g.rotateX(-Math.PI / 2);
  return g;
}

function TopCase() {
  const wellHole = [[0, -KB_Z, W * 0.86, 6.3 * 18.5 * S, 2 * S]];
  const padHole = [[0, -PAD_Z, 122 * S, 70 * S, 6 * S]];
  const holes = useMemo(() => [...wellHole, ...padHole].map((h) => [h[0], h[1], h[2], h[3], h[4]]), []); // eslint-disable-line react-hooks/exhaustive-deps
  const pad = useMemo(() => plate(121 * S, 69 * S, 0.8 * S, { r: 5.5 * S, bevel: 0.25 * S }), []);
  const padMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#a7aab2", roughness: 0.32, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.2 }), []);
  const grille = useMemo(() => roundCyl(0.45 * S, 0.2 * S, 0.1 * S, 8), []);
  const holesAt = useMemo(() => {
    const out: { p: V3 }[] = [];
    for (const side of [-1, 1])
      for (let i = 0; i < 26; i++) for (let k = 0; k < 5; k++) out.push({ p: [side * (W * 0.43 + 4 * S + k * 1.6 * S), H + 0.05 * S, KB_Z - 48 * S + i * 3.7 * S] });
    return out;
  }, []);
  return (
    <Group>
      <Flat w={W} d={D} t={TOP} r={R} mat={MAT.aluminum(SILVER)} y={H} holes={holes} />
      {/* keyboard well floor */}
      <Group position={[0, 0, KB_Z]}>
        <Flat w={W * 0.86} d={6.3 * 18.5 * S} t={0.6 * S} r={2 * S} mat={MAT.plasticMatte("#0e0e12")} y={H - 2.6 * S} />
      </Group>
      <Group position={[0, H - 2.0 * S, KB_Z]}>
        <Keyboard />
      </Group>
      <mesh geometry={pad} material={padMat} position={[0, H - 0.6 * S, PAD_Z]} rotation={[-Math.PI / 2, 0, 0]} />
      <Instances geo={grille} mat={MAT.chip()} at={holesAt} />
    </Group>
  );
}

function BottomCover() {
  const foot = useMemo(() => roundCyl(5 * S, 1.2 * S, 0.5 * S, 24), []);
  const screws = useMemo(
    () =>
      [-1, 1].flatMap((sx) => [-1, 0, 1].map((k) => ({ p: [sx * (W / 2 - 8 * S), -0.1 * S, k * (D / 2 - 10 * S)] as V3, n: [0, -1, 0] as V3 }))),
    [],
  );
  return (
    <Group>
      <Flat w={W} d={D} t={BOT} r={R} mat={MAT.aluminum(SILVER)} y={BOT} />
      <Instances geo={foot} mat={MAT.rubber()} at={[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * (W / 2 - 22 * S), -0.6 * S, sz * (D / 2 - 18 * S)] as V3 })))} />
      <Screws at={screws} d={2.4 * S} mat="blackSteel" />
    </Group>
  );
}

/** Walls of the unibody between bottom cover and top case. */
function Walls() {
  const ring = useMemo(() => {
    const geo = plate(W, D, H - TOP - BOT, { r: R, bevel: 0.6 * S, holes: [[0, 0, W - 7 * S, D - 7 * S, R - 3.5 * S]] });
    return geo;
  }, []);
  const port = useMemo(() => plate(9 * S, 3.4 * S, 2 * S, { r: 1.5 * S, bevel: 0.3 * S }), []);
  return (
    <Group>
      <mesh geometry={ring} material={MAT.aluminum(SILVER)} position={[0, BOT + (H - TOP - BOT) / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {[-1, 1].map((i) => (
        <mesh key={i} geometry={port} material={MAT.chip()} position={[-W / 2 + 0.3 * S, H / 2, -40 * S + i * 12 * S]} rotation={[0, Math.PI / 2, 0]} />
      ))}
    </Group>
  );
}

function Fan() {
  const housing = useMemo(
    () =>
      lathe(
        [
          [17 * S, 0],
          [18.5 * S, 0],
          [18.5 * S, 6 * S],
          [17 * S, 6 * S],
          [17 * S, 0],
        ],
        64,
      ),
    [],
  );
  const hub = useMemo(() => roundCyl(7 * S, 5 * S, 1 * S, 32), []);
  const blade = useMemo(() => block(0.5 * S, 9 * S, 4.6 * S, 0.2 * S), []);
  const blades = Array.from({ length: 31 }, (_, i) => {
    const a = (i / 31) * Math.PI * 2;
    return { p: [Math.cos(a) * 12 * S, 3 * S, Math.sin(a) * 12 * S] as V3, r: [0, -a + 0.4, 0] as V3 };
  });
  const bladeGeo = useMemo(() => {
    const g = blade.clone();
    g.rotateX(Math.PI / 2);
    return g;
  }, [blade]);
  return (
    <Group>
      <mesh geometry={housing} material={MAT.plasticMatte("#141418")} />
      <mesh geometry={hub} material={MAT.plasticMatte("#1d1d22")} position={[0, 3 * S, 0]} />
      <Instances geo={bladeGeo} mat={MAT.plasticMatte("#1d1d22")} at={blades} />
    </Group>
  );
}

function Internals({ which }: { which: "board" | "cooling" | "battery" | "speakers" }) {
  const board = useMemo(() => plate(150 * S, 70 * S, 1 * S, { r: 3 * S, bevel: 0.2 * S, holes: [[-50 * S, 0, 6 * S], [50 * S, 0, 6 * S]] }), []);
  const soc = useMemo(() => block(22 * S, 22 * S, 1.4 * S, 0.6 * S), []);
  const die = useMemo(() => block(13 * S, 13 * S, 0.6 * S, 0.2 * S), []);
  const mem = useMemo(() => block(12 * S, 8 * S, 1 * S, 0.4 * S), []);
  const pipe = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-30 * S, 0, -6 * S), new THREE.Vector3(-62 * S, 0, -18 * S), new THREE.Vector3(-90 * S, 0, -20 * S)]);
    const g = new THREE.TubeGeometry(curve, 40, 2.2 * S, 12, false);
    g.scale(1, 0.45, 1);
    return g;
  }, []);
  const pipe2 = useMemo(() => {
    const g = pipe.clone();
    g.scale(-1, 1, 1);
    return g;
  }, [pipe]);
  const cell = useMemo(() => block(64 * S, 4.6 * S, 44 * S, 2 * S), []);
  const cellLabel = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["Li-ion 11.4 V", "49.9 Wh"], { bg: "#1a1b22", fg: "#c9c7d3", w: 256, h: 128, size: 30 }), roughness: 0.4 }), []);
  const spk = useMemo(() => block(18 * S, 7 * S, 70 * S, 1.5 * S), []);
  const y = BOT + 1 * S;
  const boardZ = -D / 2 + 45 * S;
  if (which === "board")
    return (
      <Group>
        <mesh geometry={board} material={MAT.pcb(91, "black", "LOGIC BOARD")} position={[0, y + 3 * S, boardZ]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={soc} material={MAT.pcb(92, "green")} position={[0, y + 4.4 * S, boardZ]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={die} material={MAT.blackSteel()} position={[0, y + 5.2 * S, boardZ]} rotation={[-Math.PI / 2, 0, 0]} />
        <Instances geo={mem} mat={MAT.chip()} at={[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * 22 * S, y + 4.1 * S, boardZ + sz * 14 * S] as V3, r: [-Math.PI / 2, 0, 0] as V3 })))} />
      </Group>
    );
  if (which === "cooling")
    return (
      <Group position={[0, y + 6.4 * S, boardZ]}>
        <mesh geometry={pipe} material={MAT.copper()} />
        <mesh geometry={pipe2} material={MAT.copper()} />
        {[-1, 1].map((sx) => (
          <Group key={sx} position={[sx * 110 * S, -5.4 * S, -18 * S]}>
            <Fan />
          </Group>
        ))}
      </Group>
    );
  if (which === "battery")
    return (
      <Group>
        {[-1, 0, 1].flatMap((ix) =>
          [0].map((iz) => (
            <Group key={`${ix}${iz}`} position={[ix * 68 * S, y + 2.3 * S, D / 2 - 52 * S]}>
              <mesh geometry={cell} material={MAT.foil("#9fa4ae")} />
              <mesh material={cellLabel} position={[0, 2.31 * S, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[40 * S, 20 * S]} />
              </mesh>
            </Group>
          )),
        )}
      </Group>
    );
  return <Instances geo={spk} mat={MAT.plasticMatte("#1a1a1f")} at={[-1, 1].map((sx) => ({ p: [sx * (W / 2 - 16 * S), y + 3.5 * S, -10 * S] as V3 }))} />;
}

function Lid({ layer }: { layer: "shell" | "panel" }) {
  const LW = W;
  const LH = 208 * S;
  const back = useMemo(() => plate(LW, LH, LID_T * 0.6, { r: R, bevel: 0.8 * S }), [LW, LH]);
  const bezel = useMemo(() => plate(LW - 0.6 * S, LH - 0.6 * S, 0.8 * S, { r: R - 0.3 * S, bevel: 0.25 * S }), [LW, LH]);
  const screen = useMemo(() => {
    const g = new THREE.PlaneGeometry(LW - 16 * S, LH - 22 * S);
    return g;
  }, [LW, LH]);
  const screenMat = useMemo(() => MAT.screen(desktopTexture(), "laptop-desktop"), []);
  const hinge = useMemo(() => roundCyl(3.6 * S, LW * 0.72, 1 * S, 32), [LW]);
  return (
    <Group position={[0, H, -D / 2 + 4 * S]} rotation={[-(OPEN - Math.PI / 2), 0, 0]}>
      {layer === "shell" ? (
        <Group>
          <mesh geometry={hinge} material={MAT.aluminum("#3b3d45")} rotation={[0, 0, Math.PI / 2]} position={[0, 0, -1 * S]} />
          <mesh geometry={back} material={MAT.aluminum(SILVER)} position={[0, LH / 2 + 3 * S, -1.6 * S]} />
        </Group>
      ) : (
        <Ex v={[0, 0.25, 0.55]} delay={6}>
          <Group position={[0, LH / 2 + 3 * S, 0.4 * S]}>
            <mesh geometry={bezel} material={MAT.coverGlass()} />
            <mesh geometry={screen} material={screenMat} position={[0, 3 * S, 0.45 * S]} />
            <mesh position={[0, LH / 2 - 5 * S, 0.45 * S]} material={MAT.chip()}>
              <circleGeometry args={[1.2 * S, 16]} />
            </mesh>
          </Group>
        </Ex>
      )}
    </Group>
  );
}

function Body() {
  return (
    <Group rotation={[0, 0.42, 0]}>
      <Part id="top">
        <TopCase />
      </Part>
      <Part id="walls">
        <Walls />
      </Part>
      <Part id="board">
        <Internals which="board" />
      </Part>
      <Part id="cooling">
        <Internals which="cooling" />
      </Part>
      <Part id="battery">
        <Internals which="battery" />
      </Part>
      <Part id="speakers">
        <Internals which="speakers" />
      </Part>
      <Part id="bottom">
        <BottomCover />
      </Part>
      <Part id="lid">
        <Lid layer="shell" />
      </Part>
      <Part id="panel">
        <Lid layer="panel" />
      </Part>
    </Group>
  );
}

export const LAPTOP: ProductDef = {
  id: "laptop",
  name: "Laptop",
  Body,
  camera: [7.4, 5.4, 9.6],
  floor: -0.03,
  offset: [0, -1.2, 0.4],
  shadowScale: 10,
  aoRadius: 0.2,
  minDistance: 4,
  maxDistance: 16,
  parts: [
    { id: "top", name: "Top case and keyboard", role: "The upper half of the unibody: a scissor-switch keyboard, speaker grilles and a glass force-sensing trackpad.", specs: [["Keys", "78, 18.5 mm pitch"], ["Travel", "1 mm"], ["Trackpad", "122 x 78 mm glass"]], maker: "Button matrix", explode: [0, 1.7, 0], layer: 5, anchor: [0.9, 0.25, 0.6], shell: true },
    { id: "walls", name: "Unibody walls", role: "Machined from one block of aluminium together with the top case; the ports sit in the side walls.", specs: [["Material", "6000-series aluminium"], ["Ports", "2 x USB-C"]], maker: "Laser-cut case", explode: [0, 1.15, 0], layer: 4, anchor: [-2.5, 0.1, -0.6], shell: true },
    { id: "board", name: "Logic board", role: "The system-on-chip with memory packages around it, on a dense multi-layer board.", specs: [["SoC", "8-core CPU + GPU"], ["Memory", "4 packages"], ["Layers", "12"]], maker: "Pi Zero 2 W on a carrier", explode: [0, 0.45, 0], layer: 2, anchor: [0.6, 0.12, -1.0] },
    { id: "cooling", name: "Fans and heat pipe", role: "A flattened copper heat pipe carries heat from the chip to two blower fans that push it out of the back.", specs: [["Fans", "2 x 37 mm blowers"], ["Pipe", "Copper, flattened"]], maker: "5 V fan + copper tape", explode: [0, 0.8, 0], layer: 3, anchor: [-1.5, 0.15, -1.1] },
    { id: "battery", name: "Battery cells", role: "Three pouch cells in series across the front, under the palm rest.", specs: [["Pack", "11.4 V, 3S"], ["Energy", "49.9 Wh"]], maker: "LiPo 2000 mAh cells", explode: [0, 0.12, 0.35], layer: 1, anchor: [0.8, 0.12, 1.65] },
    { id: "speakers", name: "Speakers", role: "Two sealed speaker boxes beside the keyboard, firing up through the grilles.", specs: [["Drivers", "2 x stereo"]], maker: "3 W speaker + MAX98357A", explode: [0, 0.45, 0], layer: 2, anchor: [2.3, 0.1, -0.2] },
    { id: "bottom", name: "Bottom cover", role: "Thin aluminium plate held by ten screws, with rubber feet.", specs: [["Screws", "10 x M1.6"], ["Feet", "4 x rubber"]], maker: "Acrylic sheet", explode: [0, -0.55, 0], layer: 0, anchor: [-1.8, -0.05, 1.2] },
    { id: "lid", name: "Lid and hinge", role: "Aluminium lid on a friction hinge that holds any angle.", specs: [["Hinge", "Friction clutch"], ["Angle", "0-135°"]], maker: "3D-printed hinge", explode: [0, 0.6, -1.0], layer: 6, anchor: [0, 2.0, -2.0] },
    { id: "panel", name: "Display", role: "LCD panel and backlight under a glass front with the webcam in the top bezel.", specs: [["Size", "13.3 in, 2560 x 1600"], ["Brightness", "500 nits"]], maker: "ST7789 TFT", explode: [0, 0.6, -1.0], layer: 7, anchor: [0.8, 2.2, -1.6] },
  ],
};
