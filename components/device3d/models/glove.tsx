"use client";

// The Magic Smoke glove: a knit glove (WebXR generic hand mesh, MIT) with an Arduino 101 on the back of the hand,
// a LiPo with charger, a grab switch on the side of the index finger and the wiring between them.
// Scale: 1 scene unit = 40 mm. The hand lies palm down, fingers towards -Z.

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable, wireBundle } from "@/lib/three/geo";
import { Part, type ProductDef } from "../product/ProductModel";

const S = 1 / 40;
type V3 = [number, number, number];
// glTF hand -> palm-down: stand up (x->z, y->-y, z->x), then lay flat (rotate -90 deg about X); metres -> units.
const LAY = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0))).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
const BACK_Y = 1.3; // back-of-hand surface above the metacarpals
const BOARD: V3 = [0.2, BACK_Y + 0.06, 0.15];

function HandShell() {
  const { scene } = useGLTF("/models/hand/right.glb");
  const hand = useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.material = MAT.knit("#25252e");
        m.frustumCulled = false;
        m.geometry.computeVertexNormals();
      }
    });
    return c;
  }, [scene]);
  return (
    <Group quaternion={LAY} scale={25}>
      <primitive object={hand} />
    </Group>
  );
}

function Cuff() {
  // Ribbed knit cuff around the wrist (hollow ring, flattened like a real wrist) with a velcro strap on top.
  const band = useMemo(
    () =>
      lathe(
        [
          [0.86, -0.32],
          [0.95, -0.3],
          [0.97, 0],
          [0.95, 0.3],
          [0.86, 0.32],
          [0.84, 0],
          [0.86, -0.32],
        ],
        64,
      ),
    [],
  );
  const strap = useMemo(() => block(1.5, 0.34, 0.05, 0.025), []);
  return (
    <Group position={[0.15, 0.8, 1.95]} scale={[0.82, 0.56, 1]}>
      <mesh geometry={band} material={MAT.knit("#1b1b22")} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={strap} material={MAT.rubber("#4f43a6")} position={[0, 0.99, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 1.6]} />
    </Group>
  );
}

function Board() {
  // Arduino 101: 68.6 x 53.3 mm, Curie module, USB-B jack, barrel jack, two header rows.
  const pcb = useMemo(() => plate(68.6 * S, 53.3 * S, 1.6 * S, { r: 1 * S, bevel: 0.3 * S, holes: [[-30 * S, -22 * S, 1.6 * S], [30 * S, 22 * S, 1.6 * S], [30 * S, -22 * S, 1.6 * S]] }), []);
  const curie = useMemo(() => block(11 * S, 8 * S, 2 * S, 0.4 * S), []);
  const curieMat = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["IMU+BLE"], { bg: "#b9bcc4", fg: "#2a2b33", w: 256, h: 128, size: 54 }), metalness: 0.9, roughness: 0.35 }), []);
  const usb = useMemo(() => block(12 * S, 16 * S, 11 * S, 0.8 * S), []);
  const jack = useMemo(() => block(9 * S, 13 * S, 11 * S, 1 * S), []);
  const header = useMemo(() => block(2.5 * S, 20 * S, 8.5 * S, 0.3 * S), []);
  const button = useMemo(() => block(6 * S, 6 * S, 3 * S, 0.6 * S), []);
  return (
    <Group position={BOARD} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
      <mesh geometry={pcb} material={MAT.pcb(101, "blue", "MOTION CTRL")} />
      <mesh geometry={curie} material={curieMat} position={[4 * S, 2 * S, 1.8 * S]} />
      <mesh geometry={usb} material={MAT.steel()} position={[-31 * S, 12 * S, 6.3 * S]} />
      <mesh geometry={jack} material={MAT.plasticMatte("#111114")} position={[-31 * S, -14 * S, 6.3 * S]} />
      <Instances geo={header} mat={MAT.plasticMatte("#121214")} at={[{ p: [-6 * S, 25 * S, 5 * S], r: [0, 0, Math.PI / 2] }, { p: [16 * S, 25 * S, 5 * S], r: [0, 0, Math.PI / 2] }, { p: [-2 * S, -25 * S, 5 * S], r: [0, 0, Math.PI / 2] }, { p: [20 * S, -25 * S, 5 * S], r: [0, 0, Math.PI / 2] }]} />
      <mesh geometry={button} material={MAT.steel()} position={[-28 * S, -2 * S, 2.3 * S]} />
      <mesh position={[24 * S, 8 * S, 1.2 * S]} material={MAT.led("#3ddc97")}>
        <boxGeometry args={[2 * S, 1.2 * S, 0.8 * S]} />
      </mesh>
      <mesh position={[24 * S, 4 * S, 1.2 * S]} material={MAT.led("#f5b14c")}>
        <boxGeometry args={[2 * S, 1.2 * S, 0.8 * S]} />
      </mesh>
    </Group>
  );
}

function Mount() {
  // A printed carrier plate stitched to the glove, with four standoffs.
  const carrier = useMemo(() => plate(76 * S, 62 * S, 2 * S, { r: 6 * S, bevel: 0.6 * S }), []);
  const standoff = useMemo(() => roundCyl(2.2 * S, 6 * S, 0.4 * S, 12), []);
  return (
    <Group>
      <mesh geometry={carrier} material={MAT.printed("#e9e6df")} position={[BOARD[0], BACK_Y - 0.12, BOARD[2]]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
      <Instances geo={standoff} mat={MAT.brass()} at={[-1, 1].flatMap((a) => [-1, 1].map((b) => ({ p: [BOARD[0] + a * 22 * S, BACK_Y - 0.04, BOARD[2] + b * 29 * S] as V3 })))} />
    </Group>
  );
}

function Battery() {
  const cell = useMemo(() => block(30 * S, 48 * S, 7 * S, 2 * S), []);
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["LiPo 1S", "3.7 V  600 mAh"], { bg: "#1b1d2a", fg: "#e8e6f2", w: 256, h: 128, size: 34 }), roughness: 0.45 }), []);
  const charger = useMemo(() => plate(26 * S, 17 * S, 1.6 * S, { r: 1 * S, bevel: 0.3 * S }), []);
  return (
    <Group position={[0.95, 1.0, 1.25]} rotation={[0.25, 0, -0.35]}>
      <mesh geometry={cell} material={MAT.foil("#b9bec8")} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
      <mesh material={label} position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[24 * S, 40 * S]} />
      </mesh>
      <mesh geometry={charger} material={MAT.pcb(111, "blue", "CHG")} position={[-0.75, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </Group>
  );
}

function Switch() {
  // Grab switch on the thumb side of the index finger, pressed with the thumb.
  const body = useMemo(() => block(12 * S, 12 * S, 4 * S, 1 * S), []);
  const cap = useMemo(() => roundCyl(3.5 * S, 3 * S, 1 * S, 24), []);
  return (
    <Group position={[-0.62, 0.86, -0.9]} rotation={[0, 0, Math.PI / 2.4]}>
      <mesh geometry={body} material={MAT.plasticMatte("#141418")} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={cap} material={MAT.plasticGloss("#7c5cff")} position={[0, 0.1, 0]} />
    </Group>
  );
}

function Wiring() {
  const toSwitch = useMemo(() => wireBundle([[-0.15, BACK_Y + 0.05, -0.35], [-0.4, BACK_Y - 0.05, -0.55], [-0.6, 1.0, -0.8]], 2, 0.022, 0.05, [1, 0, 0]), []);
  const toBattery = useMemo(() => sagCable([0.45, BACK_Y + 0.08, 0.75], [0.85, 1.12, 1.1], 0.12, 0.025), []);
  const toBattery2 = useMemo(() => sagCable([0.38, BACK_Y + 0.08, 0.75], [0.78, 1.12, 1.12], 0.14, 0.025), []);
  const stitches = useMemo(() => block(0.12, 0.03, 0.03, 0.01), []);
  return (
    <Group>
      <mesh geometry={toSwitch} material={MAT.silicone("#e3c54a")} />
      <mesh geometry={toBattery} material={MAT.silicone("#c23a3a")} />
      <mesh geometry={toBattery2} material={MAT.silicone("#141417")} />
      <Instances geo={stitches} mat={MAT.knit("#7c5cff")} at={[{ p: [-0.38, BACK_Y - 0.06, -0.55], r: [0, 0.6, 0] }, { p: [-0.52, 1.13, -0.7], r: [0, 0.6, 0] }]} />
    </Group>
  );
}

function Body() {
  return (
    <Group>
      <Part id="glove">
        <HandShell />
        <Cuff />
      </Part>
      <Part id="mount">
        <Mount />
      </Part>
      <Part id="board">
        <Board />
      </Part>
      <Part id="battery">
        <Battery />
      </Part>
      <Part id="switch">
        <Switch />
      </Part>
      <Part id="wiring">
        <Wiring />
      </Part>
    </Group>
  );
}

useGLTF.preload("/models/hand/right.glb");

export const GLOVE: ProductDef = {
  id: "glove",
  name: "Motion glove",
  Body,
  camera: [6.6, 6.4, 7.8],
  floor: -0.48,
  offset: [0, 0, 0.4],
  exposure: 1.08,
  shadowScale: 9,
  aoRadius: 0.15,
  minDistance: 3,
  maxDistance: 14,
  parts: [
    { id: "glove", name: "Knit glove", role: "A thin stretch glove with a velcro cuff; everything else is stitched or strapped to it.", specs: [["Fabric", "Nylon-spandex knit"], ["Cuff", "Velcro strap"]], maker: "Any thin work glove", explode: [0, -0.4, 0], layer: 0, anchor: [0.9, 1.1, -1.4], shell: true },
    { id: "mount", name: "Board carrier", role: "A printed plate with brass standoffs keeps the board off the fabric and stops it twisting.", specs: [["Size", "76 x 62 mm"], ["Standoffs", "4 x M3 brass"]], maker: "3D-printed plate", explode: [0, 0.35, 0], layer: 1, anchor: [0.2, 1.25, 0.15] },
    { id: "board", name: "Arduino 101", role: "Runs the glove sketch: the Curie module's 6-axis IMU gives roll, pitch and yaw, and its Bluetooth LE radio sends them.", specs: [["Module", "Intel Curie"], ["IMU", "6-axis, 100 Hz loop"], ["Radio", "Bluetooth LE"]], maker: "Arduino 101 (or ESP32 + MPU6050)", explode: [0, 1.0, 0], layer: 3, anchor: [0.2, 1.45, 0.15] },
    { id: "battery", name: "Battery and charger", role: "A small LiPo on the wrist with a USB charger board.", specs: [["Cell", "1S 600 mAh"], ["Runtime", "≈ 4 h"]], maker: "LiPo + TP4056", explode: [0, 0.7, 0.5], layer: 2, anchor: [0.95, 1.1, 1.25] },
    { id: "switch", name: "Grab switch", role: "An optional push button on the index finger. Press it with your thumb to grab a model; without it, a camera fist does the same.", specs: [["Type", "Tactile, 12 mm"], ["Pin", "D4"]], maker: "Grove button or any switch to GND", explode: [-0.5, 0.5, 0], layer: 2, anchor: [-0.62, 0.95, -0.9] },
    { id: "wiring", name: "Wiring", role: "Two leads to the switch, stitched down along the finger, and the battery lead.", specs: [["Wire", "26 AWG silicone"]], maker: "Dupont jumpers + thread", explode: [0, 0.5, 0], layer: 1, anchor: [-0.4, 1.25, -0.55] },
  ],
};
