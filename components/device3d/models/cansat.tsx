"use client";

// CanSat (procedural): fits the competition envelope of 66 mm diameter x 115 mm. Round boards stacked on four M3
// threaded rods: power at the bottom, flight computer, sensors, radio, GPS patch on top; parachute under the lid.
// Scale: 1 scene unit = 40 mm.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable, wireBundle } from "@/lib/three/geo";
import { Part, type ProductDef } from "../product/ProductModel";

const S = 1 / 40;
const R = 33 * S;
const Hh = 115 * S;
type V3 = [number, number, number];
const RODS: [number, number][] = [45, 135, 225, 315].map((a) => [Math.cos((a * Math.PI) / 180) * 24 * S, Math.sin((a * Math.PI) / 180) * 24 * S]);

/** Round PCB (XZ plane) with the four rod holes. */
function roundBoard(r = 30 * S) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  for (const [x, z] of RODS) {
    const h = new THREE.Path();
    h.absarc(x, -z, 1.7 * S, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.2 * S, bevelEnabled: true, bevelThickness: 0.2 * S, bevelSize: 0.2 * S, bevelSegments: 1, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function Shell() {
  const tube = useMemo(
    () =>
      lathe(
        [
          [R - 1.2 * S, 8 * S],
          [R, 8 * S],
          [R, Hh - 8 * S],
          [R - 1.2 * S, Hh - 8 * S],
          [R - 1.2 * S, 8 * S],
        ],
        96,
      ),
    [],
  );
  const vent = useMemo(() => block(2.4 * S, 14 * S, 2.4 * S, 1.1 * S), []);
  return (
    <Group>
      <mesh geometry={tube} material={MAT.aluminum("#a9adb7")} />
      <Instances geo={vent} mat={MAT.chip()} at={[0, 1, 2, 3, 4, 5].map((i) => ({ p: [Math.cos(i * 1.05) * (R - 0.2 * S), 60 * S, Math.sin(i * 1.05) * (R - 0.2 * S)] as V3, r: [0, -i * 1.05, 0] as V3 }))} />
    </Group>
  );
}

function Caps({ top }: { top: boolean }) {
  const cap = useMemo(
    () =>
      lathe(
        top
          ? [
              [0, 8 * S],
              [R + 0.4 * S, 8 * S],
              [R + 0.6 * S, 6 * S],
              [R + 0.6 * S, 1 * S],
              [R, 0],
              [0, 0],
            ]
          : [
              [0, 0],
              [R, 0],
              [R + 0.6 * S, 1 * S],
              [R + 0.6 * S, 7 * S],
              [R + 0.4 * S, 8 * S],
              [0, 8 * S],
            ],
        96,
      ),
    [top],
  );
  const eye = useMemo(() => new THREE.TorusGeometry(4 * S, 0.9 * S, 12, 32), []);
  const bolt = useMemo(() => roundCyl(1.5 * S, 8 * S, 0.3 * S, 12), []);
  return (
    <Group position={[0, top ? Hh - 8 * S : 0, 0]}>
      <mesh geometry={cap} material={MAT.plasticMatte(top ? "#0a6b49" : "#26272d")} />
      {top && (
        <>
          <mesh geometry={bolt} material={MAT.steel()} position={[0, 11 * S, 0]} />
          <mesh geometry={eye} material={MAT.steel()} position={[0, 16 * S, 0]} />
        </>
      )}
    </Group>
  );
}

function Stack() {
  const rod = useMemo(() => roundCyl(1.5 * S, 96 * S, 0.3 * S, 12), []);
  const nut = useMemo(() => new THREE.CylinderGeometry(2.8 * S, 2.8 * S, 2.4 * S, 6), []);
  const levels = [14, 36, 58, 80];
  const nuts = levels.flatMap((y) => RODS.flatMap(([x, z]) => [{ p: [x, (y - 1.8) * S, z] as V3 }, { p: [x, (y + 2.6) * S, z] as V3 }]));
  return (
    <Group>
      <Instances geo={rod} mat={MAT.steel()} at={RODS.map(([x, z]) => ({ p: [x, 56 * S, z] as V3 }))} />
      <Instances geo={nut} mat={MAT.steel()} at={nuts} />
    </Group>
  );
}

function Boards({ which }: { which: "power" | "computer" | "sensors" | "radio" }) {
  const board = useMemo(() => roundBoard(), []);
  const wroom = useMemo(() => block(18 * S, 25.5 * S, 3.1 * S, 0.4 * S), []);
  const moduleMat = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["WIFI MCU", "2.4 GHz"], { bg: "#b9bcc4", fg: "#2a2b33", w: 256, h: 256, size: 34 }), metalness: 0.9, roughness: 0.32 }), []);
  const breakout = useMemo(() => plate(13 * S, 10 * S, 1.2 * S, { r: 0.6 * S, bevel: 0.2 * S }), []);
  const chip = useMemo(() => block(3 * S, 3 * S, 1 * S, 0.2 * S), []);
  const radio = useMemo(() => plate(17 * S, 16 * S, 1 * S, { r: 0.5 * S, bevel: 0.15 * S }), []);
  const can = useMemo(() => block(14 * S, 13 * S, 2.2 * S, 0.3 * S), []);
  const sma = useMemo(() => roundCyl(3.2 * S, 9 * S, 0.5 * S, 6), []);
  const whip = useMemo(() => sagCable([16 * S, 2 * S, 0], [16 * S, 28 * S, 0], 0, 0.6 * S), []);
  const patch = useMemo(() => block(25 * S, 25 * S, 4 * S, 0.6 * S), []);
  const dot = useMemo(() => roundCyl(5 * S, 0.4 * S, 0.1 * S, 32), []);
  const pouch = useMemo(() => block(48 * S, 34 * S, 9 * S, 2.5 * S), []);
  const cellLabel = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["LiPo 1S 2000 mAh"], { bg: "#1b1d2a", fg: "#eef4f0", w: 512, h: 96, size: 48 }), roughness: 0.4 }), []);
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, p: V3, rz = 0) => <mesh geometry={geo} material={mat} position={p} rotation={[-Math.PI / 2, 0, rz]} />;
  if (which === "power")
    return (
      <Group position={[0, 14 * S, 0]}>
        <mesh geometry={board} material={MAT.pcb(201, "black", "PWR")} />
        <Group position={[0, -6.5 * S, 0]}>
          {flat(pouch, MAT.foil("#b9bec8"), [0, 0, 0])}
          <mesh material={cellLabel} position={[0, 4.6 * S, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[40 * S, 8 * S]} />
          </mesh>
        </Group>
        {flat(breakout, MAT.pcb(202, "blue", "BOOST"), [8 * S, 1.6 * S, -8 * S])}
        <mesh position={[-14 * S, 1.6 * S, 10 * S]} material={MAT.led("#f0706a")}>
          <boxGeometry args={[2 * S, 1 * S, 1.2 * S]} />
        </mesh>
      </Group>
    );
  if (which === "computer")
    return (
      <Group position={[0, 36 * S, 0]}>
        <mesh geometry={board} material={MAT.pcb(203, "green", "FLIGHT")} />
        {flat(wroom, moduleMat, [0, 3 * S, 0])}
        <mesh position={[10 * S, 1.8 * S, 12 * S]} material={MAT.led("#5ee2a8")}>
          <boxGeometry args={[2 * S, 1 * S, 1.2 * S]} />
        </mesh>
      </Group>
    );
  if (which === "sensors")
    return (
      <Group position={[0, 58 * S, 0]}>
        <mesh geometry={board} material={MAT.pcb(204, "green", "SENS")} />
        {flat(breakout, MAT.pcb(205, "blue", "BME280"), [-9 * S, 1.6 * S, 0])}
        {flat(chip, MAT.chip(), [-9 * S, 2.6 * S, 0])}
        {flat(breakout, MAT.pcb(206, "blue", "IMU"), [9 * S, 1.6 * S, 4 * S], 0.3)}
        {flat(chip, MAT.chip(), [9 * S, 2.6 * S, 4 * S])}
      </Group>
    );
  return (
    <Group position={[0, 80 * S, 0]}>
      <mesh geometry={board} material={MAT.pcb(207, "black", "RADIO")} />
      {flat(radio, MAT.pcb(208, "green"), [-4 * S, 1.6 * S, 0])}
      {flat(can, MAT.steel(), [-4 * S, 3 * S, 0])}
      <mesh geometry={sma} material={MAT.gold()} position={[16 * S, 4.5 * S, 0]} />
      <mesh geometry={whip} material={MAT.silicone("#141417")} />
      {flat(patch, MAT.ceramic(), [-6 * S, 8 * S, 12 * S])}
      <mesh geometry={dot} material={MAT.steel()} position={[-6 * S, 10.2 * S, 12 * S]} />
    </Group>
  );
}

function Parachute() {
  const bundle = useMemo(() => roundCyl(18 * S, 12 * S, 5 * S, 48), []);
  const nylon = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#f07a2c", roughness: 0.6, sheen: 1, sheenColor: new THREE.Color("#ffb37a"), sheenRoughness: 0.4 }), []);
  const lines = useMemo(() => wireBundle([[0, 96 * S, 0], [0, 100 * S, 0], [0, 105 * S, 0], [0, 110 * S, 0]], 4, 0.35 * S, 1.6 * S, [1, 0, 0]), []);
  return (
    <Group>
      <mesh geometry={bundle} material={nylon} position={[0, 98 * S, 0]} scale={[1, 1, 0.8]} />
      <mesh geometry={lines} material={MAT.silicone("#eef4f0")} />
    </Group>
  );
}

function Wiring() {
  const a = useMemo(() => wireBundle([[-22 * S, 15 * S, 8 * S], [-26 * S, 26 * S, 6 * S], [-22 * S, 37 * S, 8 * S]], 3, 0.6 * S, 1.4 * S, [0, 0, 1]), []);
  const b = useMemo(() => wireBundle([[22 * S, 37 * S, -6 * S], [26 * S, 48 * S, -6 * S], [22 * S, 59 * S, -6 * S], [25 * S, 70 * S, -6 * S], [22 * S, 81 * S, -6 * S]], 4, 0.55 * S, 1.3 * S, [0, 0, 1]), []);
  return (
    <Group>
      <mesh geometry={a} material={MAT.silicone("#c23a3a")} />
      <mesh geometry={b} material={MAT.silicone("#e3c54a")} />
    </Group>
  );
}

function Body() {
  return (
    <Group>
      <Part id="shell">
        <Shell />
      </Part>
      <Part id="caps">
        <Caps top={false} />
      </Part>
      <Part id="lid">
        <Caps top />
      </Part>
      <Part id="stack">
        <Stack />
      </Part>
      <Part id="power">
        <Boards which="power" />
      </Part>
      <Part id="computer">
        <Boards which="computer" />
      </Part>
      <Part id="sensors">
        <Boards which="sensors" />
      </Part>
      <Part id="radio">
        <Boards which="radio" />
      </Part>
      <Part id="parachute">
        <Parachute />
      </Part>
      <Part id="wiring">
        <Wiring />
      </Part>
    </Group>
  );
}

export const CANSAT: ProductDef = {
  id: "cansat",
  name: "CanSat",
  Body,
  camera: [7.2, 5.0, 8.8],
  floor: 0,
  offset: [0, -1.5, 0],
  shadowScale: 6,
  aoRadius: 0.15,
  minDistance: 3,
  maxDistance: 14,
  parts: [
    { id: "shell", name: "Can shell", role: "A thin aluminium tube: 66 mm across and 115 mm tall, the CanSat competition size.", specs: [["Diameter", "66 mm"], ["Height", "115 mm"], ["Wall", "1.2 mm"]], maker: "Printed PETG tube", explode: [-2.2, 0, 0], layer: 4, anchor: [-0.8, 2.2, 0.3], shell: true },
    { id: "caps", name: "Base cap", role: "Printed end cap that the rods screw into.", specs: [["Material", "PETG"]], maker: "3D-printed cap", explode: [0, -0.5, 0], layer: 0, anchor: [0.8, 0.1, 0] },
    { id: "lid", name: "Lid and recovery eye", role: "The lid carries the eye bolt the parachute's swivel clips to.", specs: [["Eye bolt", "M3 stainless"]], maker: "3D-printed cap + M3 eye bolt", explode: [0, 2.1, 0], layer: 8, anchor: [0, 3.2, 0] },
    { id: "stack", name: "Threaded rods", role: "Four M3 rods and nuts clamp the round boards into one rigid stack.", specs: [["Rods", "4 x M3, 96 mm"], ["Spacing", "22 mm"]], maker: "M3 rods + nuts", explode: [0, 0, 0], layer: 1, anchor: [0.6, 1.4, 0.6] },
    { id: "power", name: "Power board", role: "LiPo cell, boost converter to 5 V and a power LED.", specs: [["Cell", "1S 2000 mAh"], ["Rail", "5 V boost"]], maker: "LiPo + MT3608", explode: [0, -0.2, 0], layer: 2, anchor: [0.5, 0.35, 0.3] },
    { id: "computer", name: "Flight computer", role: "ESP32 module that samples every sensor ten times a second and logs it.", specs: [["MCU", "ESP32, 240 MHz"], ["Log", "10 Hz"]], maker: "ESP32 DevKitC", explode: [0, 0.35, 0], layer: 3, anchor: [0.3, 0.95, 0.3] },
    { id: "sensors", name: "Sensor board", role: "Pressure and temperature (altitude) plus a 6-axis IMU for spin and tumble.", specs: [["Pressure", "BME280"], ["IMU", "6-axis"]], maker: "BME280 + MPU6050", explode: [0, 0.8, 0], layer: 4, anchor: [-0.25, 1.5, 0] },
    { id: "radio", name: "Radio and GPS", role: "LoRa module behind a shield can with an SMA whip, and a ceramic GPS patch antenna facing up.", specs: [["Radio", "868/915 MHz LoRa"], ["GPS", "Ceramic patch"]], maker: "SX1276 + NEO-6M", explode: [0, 1.25, 0], layer: 5, anchor: [0.4, 2.2, 0] },
    { id: "parachute", name: "Parachute", role: "Packed nylon canopy with shroud lines, sized for about 8 m/s descent.", specs: [["Canopy", "Ripstop nylon"], ["Descent", "≈ 8 m/s"]], maker: "Ripstop nylon + paracord", explode: [0, 1.7, 0], layer: 7, anchor: [0.4, 2.5, 0] },
    { id: "wiring", name: "Board wiring", role: "Short silicone leads between the boards, routed along the rods.", specs: [["Wire", "28 AWG"]], maker: "Dupont jumpers", explode: [0.4, 0.4, 0], layer: 3, anchor: [0.6, 1.2, 0.2] },
  ],
};
