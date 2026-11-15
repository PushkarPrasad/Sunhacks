"use client";

// Bed-slinger FDM 3D printer (procedural, generic): 2020/2040 extrusion frame, NEMA 17 steppers, lead screws,
// direct hot end with heater block and brass nozzle, heated bed with PEI sheet and levelling knobs, control box
// with screen and knob, spool on top. Scale: 1 scene unit = 100 mm.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";
import { extrusionGeometry } from "./rover";

type V3 = [number, number, number];
const FX = 2.2; // half width of the gantry
const FZ = 2.2; // half length of the base
const TOPY = 4.7;
const GANTRY_Y = 1.55; // X-axis height (nozzle ~ bed + 0.3)
const BED_Y = 0.95;

/** Extrusion of length L along +Y, +X or +Z. */
function Ext({ L, p, axis, wide = false }: { L: number; p: V3; axis: "x" | "y" | "z"; wide?: boolean }) {
  const geo = useMemo(() => extrusionGeometry(L), [L]);
  const rot: V3 = axis === "x" ? [0, Math.PI / 2, 0] : axis === "y" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <Group position={p} rotation={rot}>
      <mesh geometry={geo} material={MAT.aluminum("#26272d")} position={wide ? [0, -0.1, 0] : [0, 0, 0]} />
      {wide && <mesh geometry={geo} material={MAT.aluminum("#26272d")} position={[0, 0.1, 0]} />}
    </Group>
  );
}

function Stepper({ label = true }: { label?: boolean }) {
  // NEMA 17: 42.3 mm square, 40 mm long; axis +Y (shaft up).
  const body = useMemo(() => block(0.423, 0.423, 0.26, 0.04), []);
  const cap = useMemo(() => block(0.423, 0.423, 0.07, 0.05), []);
  const shaft = useMemo(() => roundCyl(0.025, 0.24, 0.004, 12), []);
  const boss = useMemo(() => roundCyl(0.11, 0.02, 0.005, 32), []);
  const lab = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["STEPPER  1.8°", "42 mm  1.5 A"], { bg: "#e8e6f2", fg: "#1b1a26", w: 256, h: 96, size: 22 }), roughness: 0.5 }), []);
  return (
    <Group>
      <mesh geometry={body} material={MAT.blackSteel()} rotation={[Math.PI / 2, 0, 0]} />
      {[-0.165, 0.165].map((y) => (
        <mesh key={y} geometry={cap} material={MAT.aluminum("#9da2ac")} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <mesh geometry={boss} material={MAT.aluminum("#9da2ac")} position={[0, 0.21, 0]} />
      <mesh geometry={shaft} material={MAT.steel()} position={[0, 0.32, 0]} />
      {label && (
        <mesh material={lab} position={[0, 0, 0.212]}>
          <planeGeometry args={[0.32, 0.12]} />
        </mesh>
      )}
    </Group>
  );
}

function Frame() {
  return (
    <Group>
      {[-1, 1].map((s) => (
        <Ext key={s} L={FZ * 2} p={[s * 0.75, 0.1, 0]} axis="z" />
      ))}
      <Ext L={FX * 2 - 0.2} p={[0, 0.1, -FZ + 0.1]} axis="x" />
      <Ext L={FX * 2 - 0.2} p={[0, 0.1, FZ - 0.1]} axis="x" />
      <Ext L={FX * 2 + 0.2} p={[0, 0.3, 0.2]} axis="x" wide />
      {[-1, 1].map((s) => (
        <Ext key={s} L={TOPY - 0.4} p={[s * FX, 0.4 + (TOPY - 0.4) / 2, 0.2]} axis="y" wide />
      ))}
      <Ext L={FX * 2 + 0.2} p={[0, TOPY + 0.1, 0.2]} axis="x" />
    </Group>
  );
}

function ZAxis() {
  const screw = useMemo(() => roundCyl(0.04, 3.6, 0.005, 12), []);
  const coupler = useMemo(() => roundCyl(0.1, 0.25, 0.015, 24), []);
  const thread = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 900; i++) {
      const t = i / 900;
      const a = t * Math.PI * 2 * 180;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.04, t * 3.6 - 1.8, Math.sin(a) * 0.04));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1800, 0.008, 4, false);
  }, []);
  return (
    <Group>
      {[-1, 1].map((s) => (
        <Group key={s} position={[s * (FX - 0.35), 0, 0.2]}>
          <Group position={[0, 0.62, 0]}>
            <Stepper />
          </Group>
          <mesh geometry={coupler} material={MAT.aluminum("#c3c6cd")} position={[0, 1.08, 0]} />
          <mesh geometry={screw} material={MAT.steel()} position={[0, 1.2 + 1.8, 0]} />
          <mesh geometry={thread} material={MAT.steel()} position={[0, 1.2 + 1.8, 0]} />
        </Group>
      ))}
    </Group>
  );
}

function XAxis() {
  const belt = useMemo(() => block(FX * 2 - 0.5, 0.06, 0.012, 0.004), []);
  const carriage = useMemo(() => plate(0.6, 0.62, 0.05, { r: 0.05, bevel: 0.01, holes: [[0.18, 0.2, 0.025], [-0.18, 0.2, 0.025], [0.18, -0.2, 0.025], [-0.18, -0.2, 0.025]] }), []);
  return (
    <Group position={[0, GANTRY_Y + 0.55, 0.2]}>
      <Ext L={FX * 2 - 0.2} p={[0, 0, 0]} axis="x" />
      <mesh geometry={belt} material={MAT.rubber("#121214")} position={[0, 0.0, 0.11]} />
      <Group position={[-FX + 0.45, 0, -0.25]} rotation={[0, 0, Math.PI / 2]}>
        <Stepper label={false} />
      </Group>
      <mesh geometry={carriage} material={MAT.aluminum("#4f43a6")} position={[0.3, -0.05, 0.14]} />
    </Group>
  );
}

function HotEnd() {
  const shroud = useMemo(() => block(0.5, 0.55, 0.4, 0.06), []);
  const fan = useMemo(() => roundCyl(0.17, 0.08, 0.02, 32), []);
  const fanBlades = useMemo(() => block(0.02, 0.14, 0.06, 0.005), []);
  const sink = useMemo(() => roundCyl(0.11, 0.025, 0.004, 32), []);
  const heater = useMemo(() => block(0.2, 0.1, 0.16, 0.012), []);
  const nozzle = useMemo(
    () =>
      lathe(
        [
          [0, -0.095],
          [0.008, -0.095],
          [0.03, -0.06],
          [0.05, -0.04],
          [0.05, 0],
          [0.035, 0],
          [0.035, 0.05],
          [0, 0.05],
        ],
        6,
      ),
    [],
  );
  const extruder = useMemo(() => block(0.45, 0.4, 0.4, 0.05), []);
  return (
    <Group position={[0.3, GANTRY_Y + 0.1, 0.45]}>
      <mesh geometry={extruder} material={MAT.plasticMatte("#1c1d23")} position={[0, 0.78, -0.05]} />
      <mesh geometry={shroud} material={MAT.printed("#e9e6df")} position={[0, 0.35, 0]} />
      <mesh geometry={fan} material={MAT.plasticMatte("#141418")} position={[0, 0.35, 0.22]} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={fanBlades} mat={MAT.plasticMatte("#2b2c33")} at={Array.from({ length: 7 }, (_, i) => ({ p: [Math.cos((i / 7) * Math.PI * 2) * 0.08, 0.35 + Math.sin((i / 7) * Math.PI * 2) * 0.08, 0.27] as V3, r: [0, 0, (i / 7) * Math.PI * 2] as V3 }))} />
      <Instances geo={sink} mat={MAT.aluminum("#c3c6cd")} at={Array.from({ length: 8 }, (_, i) => ({ p: [0, 0.08 + i * 0.045, -0.02] as V3 }))} />
      <mesh geometry={heater} material={MAT.aluminum("#c3c6cd")} position={[0, -0.0, -0.02]} />
      <mesh geometry={nozzle} material={MAT.brass()} position={[0, -0.08, -0.02]} />
    </Group>
  );
}

function Bed() {
  const plateGeo = useMemo(() => plate(2.35, 2.35, 0.03, { r: 0.06, bevel: 0.006 }), []);
  const pei = useMemo(() => {
    const g = plate(2.3, 2.3, 0.008, { r: 0.05, bevel: 0.002 });
    return g;
  }, []);
  const peiMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#b98a3e", roughness: 0.55, metalness: 0.2, clearcoat: 0.3, sheen: 0.4, sheenColor: new THREE.Color("#e2c27a") }), []);
  const knob = useMemo(() => roundCyl(0.1, 0.08, 0.02, 24), []);
  const spring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 2 * 6;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.05, t * 0.2, Math.sin(a) * 0.05));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.009, 5, false);
  }, []);
  const carriage = useMemo(() => plate(1.6, 1.8, 0.04, { r: 0.08, bevel: 0.008, holes: [[0, 0, 0.3]] }), []);
  const corners = [-1, 1].flatMap((a) => [-1, 1].map((b) => [a * 1.0, b * 1.0] as [number, number]));
  const print = useMemo(
    () =>
      lathe(
        [
          [0, 0],
          [0.28, 0],
          [0.32, 0.15],
          [0.3, 0.35],
          [0.22, 0.52],
          [0.24, 0.6],
          [0.22, 0.6],
          [0.2, 0.52],
          [0.27, 0.35],
          [0.29, 0.15],
          [0, 0.02],
        ],
        64,
      ),
    [],
  );
  return (
    <Group position={[0, BED_Y, 0.55]}>
      <mesh geometry={carriage} material={MAT.aluminum("#9da2ac")} position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <Instances geo={spring} mat={MAT.steel()} at={corners.map(([x, z]) => ({ p: [x, -0.23, z] as V3 }))} />
      <Instances geo={knob} mat={MAT.plasticMatte("#e3c54a")} at={corners.map(([x, z]) => ({ p: [x, -0.35, z] as V3 }))} />
      <mesh geometry={plateGeo} material={MAT.aluminum("#c3c6cd")} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={pei} material={peiMat} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={print} material={MAT.printed("#7c5cff")} position={[0.3, 0.025, -0.1]} />
    </Group>
  );
}

function Control() {
  const box = useMemo(() => block(1.0, 0.5, 0.3, 0.05), []);
  const screenTex = useMemo(() => labelTexture(["Printing  64%", "Nozzle 215°C  Bed 60°C", "Layer 112 / 175"], { bg: "#0d1530", fg: "#a5b4fc", w: 512, h: 256, size: 40 }), []);
  const screenMat = useMemo(() => MAT.screen(screenTex, "printer-lcd"), [screenTex]);
  const knob = useMemo(() => roundCyl(0.06, 0.08, 0.02, 24), []);
  const psu = useMemo(() => block(1.15, 0.5, 0.95, 0.03), []);
  const psuMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a7abb3", metalness: 0.8, roughness: 0.4 }), []);
  return (
    <Group>
      <Group position={[0.9, 0.55, FZ + 0.15]} rotation={[-0.4, 0, 0]}>
        <mesh geometry={box} material={MAT.plasticMatte("#1c1d23")} />
        <mesh material={screenMat} position={[-0.1, 0, 0.152]}>
          <planeGeometry args={[0.6, 0.32]} />
        </mesh>
        <mesh geometry={knob} material={MAT.aluminum("#c3c6cd")} position={[0.36, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} />
      </Group>
      <mesh geometry={psu} material={psuMat} position={[FX + 0.32, 1.0, 0.2]} rotation={[0, 0, Math.PI / 2]} />
    </Group>
  );
}

function Spool() {
  const reel = useMemo(
    () =>
      lathe(
        [
          [0.15, -0.36],
          [1.0, -0.36],
          [1.0, -0.32],
          [0.42, -0.32],
          [0.42, 0.32],
          [1.0, 0.32],
          [1.0, 0.36],
          [0.15, 0.36],
          [0.15, -0.36],
        ],
        72,
      ),
    [],
  );
  const filament = useMemo(() => roundCyl(0.92, 0.62, 0.05, 72), []);
  const arm = useMemo(() => roundCyl(0.06, 1.0, 0.01, 16), []);
  const bowden = useMemo(() => sagCable([0, TOPY + 0.75, 0.1], [0.3, GANTRY_Y + 1.25, 0.4], 0.4, 0.035), []);
  const fil = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#7c5cff", roughness: 0.3, clearcoat: 0.6, sheen: 0.5 }), []);
  return (
    <Group>
      <mesh geometry={arm} material={MAT.aluminum("#9da2ac")} position={[0, TOPY + 0.3, 0.2]} rotation={[Math.PI / 2, 0, 0]} />
      <Group position={[0, TOPY + 1.1, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={reel} material={MAT.plasticMatte("#141418")} />
        <mesh geometry={filament} material={fil} />
      </Group>
      <mesh geometry={bowden} material={MAT.glass("#f4f6ff")} />
    </Group>
  );
}

function Body() {
  return (
    <Group>
      <Part id="frame">
        <Frame />
      </Part>
      <Part id="z">
        <ZAxis />
      </Part>
      <Part id="x">
        <XAxis />
      </Part>
      <Part id="hotend">
        <HotEnd />
      </Part>
      <Part id="bed">
        <Bed />
      </Part>
      <Part id="control">
        <Control />
      </Part>
      <Part id="spool">
        <Ex v={[0, 0.4, 0]}>
          <Spool />
        </Ex>
      </Part>
    </Group>
  );
}

export const PRINTER: ProductDef = {
  id: "printer",
  name: "FDM 3D printer",
  Body,
  camera: [9.4, 6.6, 11.2],
  floor: 0,
  offset: [0, -3.0, 0],
  shadowScale: 12,
  aoRadius: 0.5,
  minDistance: 6,
  maxDistance: 22,
  parts: [
    { id: "frame", name: "Extrusion frame", role: "2020 and 2040 aluminium extrusion: the base, two uprights and a top bar.", specs: [["Profiles", "2020 + 2040"], ["Build volume", "220 x 220 x 250 mm"]], maker: "2020 extrusion kit", explode: [0, 0, 0], layer: 0, anchor: [-2.2, 3.2, 0.3] },
    { id: "z", name: "Z steppers and lead screws", role: "Two NEMA 17 motors turn T8 lead screws that lift the X gantry 8 mm per turn.", specs: [["Motors", "2 x NEMA 17"], ["Screws", "T8, 8 mm lead"]], maker: "NEMA 17 + A4988", explode: [0, 0, 0.9], layer: 2, anchor: [1.85, 0.62, 0.45] },
    { id: "x", name: "X gantry", role: "Extrusion with a belt and the X motor; the carriage rides on V-wheels.", specs: [["Belt", "GT2, 6 mm"]], maker: "NEMA 17 + GT2 belt", explode: [0, 1.0, 0], layer: 3, anchor: [-1.6, 2.1, 0.3] },
    { id: "hotend", name: "Direct-drive hot end", role: "Extruder gears push filament into a heated block; a brass 0.4 mm nozzle lays each line.", specs: [["Nozzle", "0.4 mm brass"], ["Max", "260 °C"], ["Fans", "Part + heatsink"]], maker: "Hot end kit", explode: [0, 1.7, 0.6], layer: 5, anchor: [0.3, 1.9, 0.7] },
    { id: "bed", name: "Heated bed", role: "Aluminium bed with a textured PEI sheet, four springs and levelling knobs; it slides front to back (Y).", specs: [["Size", "235 x 235 mm"], ["Temp", "up to 100 °C"]], maker: "MK3 bed + PEI sheet", explode: [0, -0.2, 1.6], layer: 1, anchor: [1.0, 1.0, 1.5] },
    { id: "control", name: "Control box and PSU", role: "Mainboard with stepper drivers behind the screen and knob; a 24 V supply on the side.", specs: [["PSU", "24 V 350 W"], ["Board", "32-bit"]], maker: "ESP32 + 4 x A4988 + 12 V adapter", explode: [0.6, 0, 0.5], layer: 2, anchor: [0.9, 0.7, 2.35] },
    { id: "spool", name: "Spool and filament", role: "One kilogram of PLA on a reel, fed through a PTFE tube.", specs: [["Filament", "1.75 mm PLA"], ["Spool", "1 kg"]], maker: "Any 1.75 mm spool", explode: [0, 0.6, -0.6], layer: 6, anchor: [0.9, 5.8, -0.15] },
  ],
};
