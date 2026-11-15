"use client";

// Reaction-wheel balancing cube (procedural; no team CAD in public/models/cubli/). 1 scene unit = 100 mm.
// Reference: a 150 mm aluminium cube with three reaction wheels on three faces, gimbal BLDC motors, an IMU board,
// a controller PCB and a 3S LiPo. It stands balanced on one edge.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, lathe, plate, roundCyl, sagCable, Screws, Instances, wireBundle } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";

const H = 0.75; // half edge (75 mm)
const T = 0.03; // 3 mm plate
const WHEEL_R = 0.5;

// Axis helpers: each face is described by its outward normal.
type V3 = [number, number, number];
const FACES: { n: V3; wheel: boolean }[] = [
  { n: [1, 0, 0], wheel: true },
  { n: [0, 1, 0], wheel: true },
  { n: [0, 0, 1], wheel: true },
  { n: [-1, 0, 0], wheel: false },
  { n: [0, -1, 0], wheel: false },
  { n: [0, 0, -1], wheel: false },
];
const rotFor = (n: V3): V3 => (n[0] ? [0, (n[0] * Math.PI) / 2, 0] : n[1] ? [(-n[1] * Math.PI) / 2, 0, 0] : [0, n[2] > 0 ? 0 : Math.PI, 0]);
const scale = (n: V3, k: number): V3 => [n[0] * k, n[1] * k, n[2] * k];

function FacePlate({ n, wheel }: { n: V3; wheel: boolean }) {
  const geo = useMemo(
    () =>
      plate(1.38, 1.38, T, {
        r: 0.05,
        bevel: 0.006,
        holes: wheel
          ? [[0, 0, 0.36], [0.5, 0.5, 0.05], [-0.5, 0.5, 0.05], [0.5, -0.5, 0.05], [-0.5, -0.5, 0.05]]
          : [[0.3, 0.3, 0.17], [-0.3, 0.3, 0.17], [0.3, -0.3, 0.17], [-0.3, -0.3, 0.17], [0, 0, 0.08]],
      }),
    [wheel],
  );
  return (
    <Ex v={scale(n, 0.42)} delay={4}>
      <mesh geometry={geo} material={MAT.aluminum("#b9bdc6")} position={scale(n, H - T / 2)} rotation={rotFor(n)} />
    </Ex>
  );
}

function Frame() {
  const rail = useMemo(() => block(0.08, 1.32, 0.08, 0.016), []);
  const corner = useMemo(() => roundCyl(0.085, 0.17, 0.05, 32), []);
  const rails: { p: V3; r: V3 }[] = [];
  const e = H - 0.04;
  for (const a of [-e, e])
    for (const b of [-e, e]) {
      rails.push({ p: [0, a, b], r: [0, 0, Math.PI / 2] });
      rails.push({ p: [a, 0, b], r: [0, 0, 0] });
      rails.push({ p: [a, b, 0], r: [Math.PI / 2, 0, 0] });
    }
  const corners: { p: V3 }[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push({ p: [x * (H - 0.07), y * (H - 0.07), z * (H - 0.07)] });
  const screws = FACES.flatMap(({ n }) => {
    const out: { p: V3; n: V3 }[] = [];
    const [u, v] = n[0] ? [[0, 1, 0], [0, 0, 1]] : n[1] ? [[1, 0, 0], [0, 0, 1]] : [[1, 0, 0], [0, 1, 0]];
    for (const a of [-0.6, 0.6])
      for (const b of [-0.6, 0.6])
        out.push({ p: [n[0] * H + u[0] * a + v[0] * b, n[1] * H + u[1] * a + v[1] * b, n[2] * H + u[2] * a + v[2] * b] as V3, n });
    return out;
  });
  return (
    <>
      <Instances geo={rail} mat={MAT.aluminum("#9da2ad")} at={rails} />
      <Instances geo={corner} mat={MAT.aluminum("#9da2ad")} at={corners.map((c) => ({ p: c.p }))} />
      {FACES.map((f) => (
        <FacePlate key={f.n.join()} {...f} />
      ))}
      <Ex v={[0, 0, 0]}>
        <Screws at={screws} d={0.032} />
      </Ex>
    </>
  );
}

/** One reaction wheel in the XY plane, axis +Z: rim, spokes, hub and brass weights. */
function Wheel() {
  const rim = useMemo(
    () =>
      lathe(
        [
          [WHEEL_R - 0.07, -0.028],
          [WHEEL_R - 0.006, -0.028],
          [WHEEL_R, -0.022],
          [WHEEL_R, 0.022],
          [WHEEL_R - 0.006, 0.028],
          [WHEEL_R - 0.07, 0.028],
          [WHEEL_R - 0.075, 0.02],
          [WHEEL_R - 0.075, -0.02],
          [WHEEL_R - 0.07, -0.028],
        ],
        96,
      ),
    [],
  );
  const spoke = useMemo(() => block(0.05, WHEEL_R - 0.12, 0.022, 0.008), []);
  const hub = useMemo(() => roundCyl(0.075, 0.07, 0.01), []);
  const weight = useMemo(() => roundCyl(0.03, 0.075, 0.006, 20), []);
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const r = (WHEEL_R - 0.12) / 2 + 0.06;
    return { p: [Math.cos(a) * r, Math.sin(a) * r, 0] as V3, r: [0, 0, a - Math.PI / 2] as V3 };
  });
  const weights = Array.from({ length: 12 }, (_, i) => {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    return { p: [Math.cos(a) * (WHEEL_R - 0.04), Math.sin(a) * (WHEEL_R - 0.04), 0] as V3, r: [Math.PI / 2, 0, 0] as V3 };
  });
  return (
    <Group>
      <mesh geometry={rim} material={MAT.aluminum("#c9ccd4")} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={spoke} mat={MAT.aluminum("#c9ccd4")} at={spokes} />
      <mesh geometry={hub} material={MAT.steel()} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={weight} mat={MAT.brass()} at={weights} />
    </Group>
  );
}

/** Gimbal BLDC (outrunner, 40 mm x 20 mm) with its stator showing through the gap, axis +Z. */
function Motor() {
  const bell = useMemo(
    () =>
      lathe(
        [
          [0.012, 0.1],
          [0.17, 0.1],
          [0.2, 0.085],
          [0.2, -0.03],
          [0.19, -0.04],
          [0.17, -0.04],
          [0.17, 0.07],
          [0.012, 0.07],
        ],
        64,
      ),
    [],
  );
  const base = useMemo(() => roundCyl(0.19, 0.04, 0.008), []);
  const stator = useMemo(() => roundCyl(0.165, 0.07, 0.004), []);
  const shaft = useMemo(() => roundCyl(0.02, 0.2, 0.004, 16), []);
  return (
    <Group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={bell} material={MAT.aluminum("#2b2c33")} />
      <mesh geometry={stator} material={MAT.copper()} position={[0, 0.0, 0]} />
      <mesh geometry={base} material={MAT.aluminum("#2b2c33")} position={[0, -0.07, 0]} />
      <mesh geometry={shaft} material={MAT.steel()} position={[0, 0.17, 0]} />
    </Group>
  );
}

/** Wheel + motor unit on a face: wheel just inside the plate, motor behind it, both on the face normal. */
function Drive({ n, part }: { n: V3; part: "wheels" | "motors" }) {
  const rot = rotFor(n);
  return part === "wheels" ? (
    <Ex v={scale(n, 0.24)} delay={3}>
      <Group position={scale(n, H - 0.11)} rotation={rot}>
        <Wheel />
      </Group>
    </Ex>
  ) : (
    <Ex v={scale(n, 0.12)} delay={2}>
      <Group position={scale(n, H - 0.3)} rotation={rot}>
        <Motor />
      </Group>
    </Ex>
  );
}

function Controller() {
  const board = useMemo(() => plate(0.9, 0.9, 0.016, { r: 0.03, bevel: 0.002, holes: [[0.4, 0.4, 0.016], [-0.4, 0.4, 0.016], [0.4, -0.4, 0.016], [-0.4, -0.4, 0.016]] }), []);
  const ic = useMemo(() => block(0.14, 0.14, 0.022, 0.004), []);
  const drv = useMemo(() => block(0.09, 0.07, 0.018, 0.003), []);
  const header = useMemo(() => block(0.26, 0.05, 0.08, 0.004), []);
  const standoff = useMemo(() => roundCyl(0.022, 0.12, 0.003, 6), []);
  const cap = useMemo(() => roundCyl(0.03, 0.06, 0.006, 20), []);
  return (
    <Group position={[-0.08, -H + 0.2, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={board} material={MAT.pcb(17, "green", "CUBE CTRL v2")} />
      <mesh geometry={ic} material={MAT.chip()} position={[0, 0, 0.018]} />
      <mesh geometry={ic} material={labelChipMat()} position={[0, 0, 0.0185]} scale={[0.98, 0.98, 1]} />
      {[[-0.25, 0.25], [0.25, 0.25], [0.25, -0.25]].map(([x, y]) => (
        <mesh key={`${x}${y}`} geometry={drv} material={MAT.chip()} position={[x, y, 0.016]} />
      ))}
      <mesh geometry={header} material={MAT.plasticMatte("#121214")} position={[-0.2, -0.33, 0.045]} />
      {[0.12, 0.2].map((x) => (
        <mesh key={x} geometry={cap} material={MAT.aluminum("#c9ccd4")} position={[x, -0.3, 0.04]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <mesh position={[0.36, 0.36, 0.012]} material={MAT.led("#3ddc97")}>
        <boxGeometry args={[0.025, 0.015, 0.01]} />
      </mesh>
      <Instances geo={standoff} mat={MAT.brass()} at={[[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]].map(([x, y]) => ({ p: [x, y, -0.065] as V3, r: [Math.PI / 2, 0, 0] as V3 }))} />
    </Group>
  );
}

let chipMat: THREE.Material | null = null;
function labelChipMat() {
  chipMat ??= new THREE.MeshStandardMaterial({ map: labelTexture(["MCU32", "F405 RGT6"], { bg: "#18181c", fg: "#9b9aa6", w: 256, h: 256, size: 40 }), roughness: 0.45 });
  return chipMat;
}

function Imu() {
  const board = useMemo(() => plate(0.21, 0.16, 0.012, { r: 0.012, bevel: 0.002, holes: [[0.08, 0.055, 0.012], [-0.08, 0.055, 0.012]] }), []);
  const chip = useMemo(() => block(0.04, 0.04, 0.01, 0.002), []);
  return (
    <Group position={[0.22, -H + 0.27, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={board} material={MAT.pcb(31, "blue", "IMU")} />
      <mesh geometry={chip} material={MAT.chip()} position={[0, -0.01, 0.011]} />
    </Group>
  );
}

function Battery() {
  const pack = useMemo(() => block(0.32, 0.72, 0.24, 0.035), []);
  const label = useMemo(() => new THREE.MeshPhysicalMaterial({ map: labelTexture(["LiPo 3S1P", "11.1 V  850 mAh", "9.4 Wh  45C"], { bg: "#1b1d2a", fg: "#e8e6f2", w: 512, h: 256 }), roughness: 0.4, clearcoat: 0.5 }), []);
  const jst = useMemo(() => block(0.1, 0.035, 0.05, 0.004), []);
  const balance = useMemo(() => wireBundle([[-H + 0.2, 0.36, -0.42], [-0.45, 0.48, -0.4], [-0.3, 0.3, -0.2], [-0.2, -0.3, -0.1], [-0.2, -H + 0.27, -0.1]], 4, 0.009, 0.02, [0, 0, 1]), []);
  const red = useMemo(() => sagCable([-H + 0.2, 0.36, -0.25], [0.1, -H + 0.25, -0.35], 0.25, 0.016), []);
  const black = useMemo(() => sagCable([-H + 0.2, 0.36, -0.29], [0.14, -H + 0.25, -0.35], 0.28, 0.016), []);
  return (
    <Group>
      <Group position={[-H + 0.2, 0, -0.35]}>
        <mesh geometry={pack} material={MAT.foil("#3a3c48")} rotation={[0, Math.PI / 2, 0]} />
        <mesh position={[0.121, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={label}>
          <planeGeometry args={[0.6, 0.2]} />
        </mesh>
      </Group>
      <mesh geometry={balance} material={MAT.silicone("#e6e3dc")} />
      <mesh geometry={jst} material={MAT.plasticGloss("#f1efe8")} position={[-0.2, -H + 0.29, -0.1]} />
      <mesh geometry={red} material={MAT.silicone("#c23a3a")} />
      <mesh geometry={black} material={MAT.silicone("#141417")} />
    </Group>
  );
}

function Harness() {
  // Three-phase leads from each motor to the controller, with natural sag and a zip tie on each bundle.
  const bundles = useMemo(() => {
    const motors: V3[] = [
      [H - 0.36, 0.12, 0.12],
      [0.12, H - 0.36, 0.12],
      [0.12, 0.12, H - 0.36],
    ];
    return motors.map((m) => wireBundle([m, [m[0] * 0.5, m[1] * 0.5 - 0.15, m[2] * 0.5], [0.1, -0.4, 0.15], [0.05, -H + 0.25, 0.1]], 3, 0.008, 0.019, [1, 0, -1]));
  }, []);
  const tie = useMemo(() => roundCyl(0.034, 0.018, 0.004, 16), []);
  return (
    <Group>
      {bundles.map((g, i) => (
        <mesh key={i} geometry={g} material={[MAT.silicone("#1c1c22"), MAT.silicone("#c23a3a"), MAT.silicone("#e3c54a")][i % 3]} />
      ))}
      <Instances geo={tie} mat={MAT.plasticMatte("#0f0f12")} at={[{ p: [0.1, -0.4, 0.15] }, { p: [0.15, -0.2, 0.2] }]} />
    </Group>
  );
}

function Body() {
  return (
    // Stands balanced on one edge: rotated 45 degrees about Z.
    <Group rotation={[0, 0, Math.PI / 4]}>
      <Part id="frame">
        <Frame />
      </Part>
      <Part id="wheels">
        {FACES.filter((f) => f.wheel).map((f) => (
          <Drive key={f.n.join()} n={f.n} part="wheels" />
        ))}
      </Part>
      <Part id="motors">
        {FACES.filter((f) => f.wheel).map((f) => (
          <Drive key={f.n.join()} n={f.n} part="motors" />
        ))}
      </Part>
      <Part id="controller">
        <Controller />
      </Part>
      <Part id="imu">
        <Imu />
      </Part>
      <Part id="battery">
        <Battery />
      </Part>
      <Part id="harness">
        <Harness />
      </Part>
    </Group>
  );
}

export const CUBE: ProductDef = {
  id: "cube",
  name: "Reaction-wheel cube",
  Body,
  camera: [5.6, 2.9, 6.9],
  floor: -H * Math.SQRT2,
  offset: [0, 0.15, 0],
  shadowScale: 5,
  aoRadius: 0.3,
  parts: [
    { id: "frame", name: "Aluminium frame", role: "Six 3 mm plates on twelve rails and rounded corner blocks; it balances on an edge or a corner.", specs: [["Edge", "150 mm"], ["Plates", "3 mm 6061, anodized"], ["Screws", "24 x M3 socket head"]], maker: "3D-printed PETG frame", explode: [0, 0, 0], layer: 0, anchor: [0.75, 0.6, 0.75], shell: true },
    { id: "wheels", name: "Reaction wheels", role: "Spinning a wheel one way pushes the cube the other way; braking it hard can flip the cube up.", specs: [["Diameter", "100 mm"], ["Rim weights", "12 x brass"], ["Inertia", "≈ 5 g·m²"]], maker: "Printed disc + M5 nuts as weights", explode: [0, 0, 0], layer: 3, anchor: [0.62, 0.3, 0] },
    { id: "motors", name: "Gimbal BLDC motors", role: "Low-speed brushless motors with high torque per amp, driven by field-oriented control.", specs: [["Size", "4008"], ["Poles", "24N22P"], ["Driver", "3-phase FOC"]], maker: "N20 gear motor (one-axis version)", explode: [0, 0, 0], layer: 2, anchor: [0.4, 0.15, 0.15] },
    { id: "controller", name: "Controller board", role: "Reads the IMU, runs the balance loop at 1 kHz and drives the three motors.", specs: [["MCU", "32-bit Cortex-M4"], ["Drivers", "3 x half-bridge"], ["Loop", "1 kHz"]], maker: "ESP32 + TB6612FNG", explode: [0, -0.35, 0], layer: 1, anchor: [-0.1, -0.55, -0.1] },
    { id: "imu", name: "IMU", role: "Six-axis gyro and accelerometer that measures the lean angle.", specs: [["Axes", "6"], ["Gyro", "±2000 °/s"], ["Rate", "1 kHz"]], maker: "MPU6050 breakout", explode: [0.2, -0.75, 0.2], layer: 1, anchor: [0.22, -0.48, 0.2] },
    { id: "battery", name: "LiPo battery", role: "Three cells in series with a balance lead for charging.", specs: [["Cells", "3S, 11.1 V"], ["Capacity", "850 mAh"], ["Plug", "XT30 + JST-XH"]], maker: "2 x 18650 pack", explode: [-0.6, 0, -0.3], layer: 2, anchor: [-0.55, 0.2, -0.35] },
    { id: "harness", name: "Wiring harness", role: "Three-phase motor leads and the battery lead, tied down so they never touch a wheel.", specs: [["Wire", "26 AWG silicone"], ["Ties", "Nylon"]], maker: "Dupont jumpers + heat-shrink", explode: [0, -0.2, 0], layer: 1, anchor: [0.1, -0.35, 0.15] },
  ],
};
