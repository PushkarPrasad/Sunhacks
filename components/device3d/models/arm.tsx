"use client";

// Six-axis desktop robot arm (procedural). 1 scene unit = 100 mm. Reference: printed desktop arms built around
// standard-size metal-gear servos (40.7 x 19.7 x 42.9 mm) with micro servos at the wrist and a parallel gripper.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable, Screws } from "@/lib/three/geo";
import { Part, type ProductDef } from "../product/ProductModel";

type V3 = [number, number, number];
const PRINT = "#e9e6df";
const ACCENT = "#0a6b49";

/** Stadium-shaped link plate (two round ends) with horn holes and a lightening slot, thickness t along Z. */
function linkPlate(length: number, r: number, t: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  s.lineTo(length, -r);
  s.absarc(length, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r);
  for (const x of [0, length]) {
    const h = new THREE.Path();
    h.absarc(x, 0, r * 0.32, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const slot = new THREE.Path();
  const sl = length - r * 2.6;
  const sr = r * 0.38;
  slot.absarc(r * 1.3, 0, sr, Math.PI / 2, (3 * Math.PI) / 2, false);
  slot.lineTo(r * 1.3 + sl, -sr);
  slot.absarc(r * 1.3 + sl, 0, sr, -Math.PI / 2, Math.PI / 2, false);
  slot.lineTo(r * 1.3, sr);
  s.holes.push(new THREE.Path(slot.getPoints(24).reverse()));
  const b = 0.008;
  const g = new THREE.ExtrudeGeometry(s, { depth: t - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 32 });
  g.translate(0, 0, -(t - b * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Standard servo with mounting ears, label and an output spline along +Z; size by scale (1 = 41 x 20 x 43 mm). */
function Servo({ s = 1, horn = true }: { s?: number; horn?: boolean }) {
  const body = useMemo(() => block(0.41, 0.2, 0.37, 0.018), []);
  const ears = useMemo(() => block(0.54, 0.2, 0.025, 0.006), []);
  const top = useMemo(() => roundCyl(0.06, 0.06, 0.01, 24), []);
  const hornGeo = useMemo(() => plate(0.24, 0.24, 0.025, { r: 0.12, bevel: 0.005, holes: [[0.08, 0, 0.012], [-0.08, 0, 0.012], [0, 0.08, 0.012], [0, -0.08, 0.012]] }), []);
  const label = useMemo(
    () => new THREE.MeshStandardMaterial({ map: labelTexture(["SERVO  20 kg·cm", "METAL GEAR  270°"], { bg: "#14151b", fg: "#c8c6d2", w: 512, h: 128, size: 38 }), roughness: 0.5 }),
    [],
  );
  return (
    <Group scale={s}>
      <mesh geometry={body} material={MAT.plasticMatte("#17171c")} />
      <mesh geometry={ears} material={MAT.plasticMatte("#17171c")} position={[0, 0, 0.1]} />
      <mesh material={label} position={[0, 0.1005, -0.03]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.36, 0.09]} />
      </mesh>
      <mesh geometry={top} material={MAT.brass()} position={[0.1, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]} />
      {horn && <mesh geometry={hornGeo} material={MAT.aluminum("#c3c6ce")} position={[0.1, 0, 0.255]} />}
    </Group>
  );
}

/** Two printed side plates spanning a joint, with the servo-cable channel between them. */
function Link({ length, r, gap }: { length: number; r: number; gap: number }) {
  const geo = useMemo(() => linkPlate(length, r, 0.05), [length, r]);
  const spacer = useMemo(() => roundCyl(0.035, gap, 0.006, 16), [gap]);
  return (
    <Group>
      {[-gap / 2, gap / 2].map((z) => (
        <mesh key={z} geometry={geo} material={MAT.printed(PRINT)} position={[0, 0, z]} />
      ))}
      <Instances geo={spacer} mat={MAT.aluminum("#2b2c33")} at={[0.35, 0.65].map((f) => ({ p: [length * f, r * 0.62, 0] as V3, r: [Math.PI / 2, 0, 0] as V3 }))} />
      <Screws at={[0, length].flatMap((x) => [{ p: [x + 0.08, 0, gap / 2 + 0.025] as V3, n: [0, 0, 1] as V3 }, { p: [x - 0.08, 0, gap / 2 + 0.025] as V3, n: [0, 0, 1] as V3 }])} d={0.028} />
    </Group>
  );
}

function Base() {
  const shell = useMemo(
    () =>
      lathe(
        [
          [0, 0],
          [0.95, 0],
          [1.0, 0.03],
          [1.0, 0.16],
          [0.93, 0.26],
          [0.72, 0.32],
          [0, 0.32],
        ],
        96,
      ),
    [],
  );
  const foot = useMemo(() => roundCyl(0.09, 0.04, 0.012, 24), []);
  const bearing = useMemo(() => lathe([[0.55, 0], [0.66, 0], [0.66, 0.05], [0.55, 0.05], [0.55, 0]], 96), []);
  return (
    <Group>
      <mesh geometry={shell} material={MAT.plasticMatte("#24252b")} position={[0, 0.03, 0]} />
      <mesh geometry={bearing} material={MAT.steel()} position={[0, 0.35, 0]} />
      <Instances geo={foot} mat={MAT.rubber()} at={[0, 1, 2, 3].map((i) => ({ p: [Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.78, 0.02, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.78] as V3 }))} />
      <Screws at={Array.from({ length: 6 }, (_, i) => ({ p: [Math.cos((i / 6) * Math.PI * 2) * 0.82, 0.29, Math.sin((i / 6) * Math.PI * 2) * 0.82] as V3, n: [0, 1, 0] as V3 }))} d={0.035} mat="blackSteel" />
    </Group>
  );
}

function Driver() {
  const board = useMemo(() => plate(0.62, 0.25, 0.016, { r: 0.02, bevel: 0.002, holes: [[0.27, 0.09, 0.015], [-0.27, 0.09, 0.015], [0.27, -0.09, 0.015], [-0.27, -0.09, 0.015]] }), []);
  const pins = useMemo(() => block(0.012, 0.012, 0.07, 0.002), []);
  const pinAt: { p: V3 }[] = [];
  for (let i = 0; i < 16; i++) for (let k = 0; k < 3; k++) pinAt.push({ p: [-0.22 + i * 0.028, -0.07 + k * 0.028, 0.05] });
  const term = useMemo(() => block(0.1, 0.08, 0.09, 0.008), []);
  return (
    <Group position={[0.5, 0.36, 0.5]} rotation={[0, -Math.PI / 4, 0]}>
      <Group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={board} material={MAT.pcb(61, "blue", "16CH PWM")} />
        <Instances geo={pins} mat={MAT.gold()} at={pinAt} />
        <mesh geometry={term} material={MAT.plasticGloss("#1d7a58")} position={[0.22, 0.07, 0.05]} />
      </Group>
    </Group>
  );
}

function Gripper() {
  const palm = useMemo(() => block(0.34, 0.26, 0.12, 0.02), []);
  const finger = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.06, 0);
    s.lineTo(0.06, 0.3);
    s.quadraticCurveTo(0.06, 0.36, 0.02, 0.38);
    s.lineTo(0, 0.38);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    g.translate(0, 0, -0.05);
    g.computeVertexNormals();
    return g;
  }, []);
  const pad = useMemo(() => block(0.015, 0.14, 0.09, 0.004), []);
  return (
    <Group>
      <mesh geometry={palm} material={MAT.plasticMatte(ACCENT)} />
      <Group position={[0, 0.06, 0.1]}>
        <Servo s={0.55} horn={false} />
      </Group>
      {[-1, 1].map((sd) => (
        <Group key={sd} position={[sd * 0.08, 0.12, 0]} scale={[sd, 1, 1]}>
          <mesh geometry={finger} material={MAT.printed(PRINT)} />
          <mesh geometry={pad} material={MAT.rubber("#2a2a30")} position={[-0.004, 0.27, 0]} />
        </Group>
      ))}
    </Group>
  );
}

function Body() {
  // Pose (radians): base yaw, shoulder, elbow, wrist pitch, wrist roll.
  const yaw = -0.5;
  const shoulder = 0.42;
  const elbow = -1.25;
  const wrist = -0.75;
  const cableA = useMemo(() => sagCable([0.15, 0.5, 0.18], [0.2, 0.36, 0.5], 0.08, 0.016), []);
  const turnGeo = useMemo(() => roundCyl(0.62, 0.14, 0.03, 72), []);
  const upright = useMemo(() => plate(0.42, 0.62, 0.05, { r: 0.12, bevel: 0.008, holes: [[0, 0.12, 0.05]] }), []);
  return (
    <Group>
      <Part id="base">
        <Base />
      </Part>
      <Part id="driver">
        <Driver />
      </Part>
      <Part id="cables">
        <mesh geometry={cableA} material={MAT.silicone("#b8622d")} />
      </Part>
      {/* J1: turntable */}
      <Group position={[0, 0.4, 0]} rotation={[0, yaw, 0]}>
        <Part id="turntable">
          <mesh geometry={turnGeo} material={MAT.plasticMatte(ACCENT)} position={[0, 0.07, 0]} />
          <Group position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <Servo />
          </Group>
          {/* shoulder uprights */}
          {[-0.22, 0.22].map((z) => (
            <mesh key={z} geometry={upright} material={MAT.printed(PRINT)} position={[0, 0.45, z]} />
          ))}
        </Part>
        {/* J2: shoulder */}
        <Group position={[0, 0.57, 0]} rotation={[0, 0, Math.PI / 2 - shoulder]}>
          <Part id="shoulder">
            <Group position={[-0.1, 0, -0.03]}>
              <Servo />
            </Group>
          </Part>
          <Part id="upper">
            <Link length={1.25} r={0.17} gap={0.36} />
          </Part>
          {/* J3: elbow */}
          <Group position={[1.25, 0, 0]} rotation={[0, 0, elbow]}>
            <Part id="elbow">
              <Group position={[-0.1, 0, -0.03]}>
                <Servo />
              </Group>
            </Part>
            <Part id="forearm">
              <Link length={1.05} r={0.15} gap={0.32} />
            </Part>
            {/* J4/J5: wrist pitch and roll */}
            <Group position={[1.05, 0, 0]} rotation={[0, 0, wrist]}>
              <Part id="wrist">
                <Group position={[-0.06, 0, 0]}>
                  <Servo s={0.6} />
                </Group>
                <Group position={[0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <Servo s={0.55} />
                </Group>
              </Part>
              {/* J6: gripper */}
              <Group position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <Part id="gripper">
                  <Gripper />
                </Part>
              </Group>
            </Group>
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

export const ARM: ProductDef = {
  id: "arm",
  name: "Six-axis desktop arm",
  Body,
  camera: [5.6, 3.6, 6.4],
  floor: 0,
  offset: [0, -1.2, 0],
  shadowScale: 7,
  aoRadius: 0.35,
  minDistance: 3.5,
  maxDistance: 14,
  parts: [
    { id: "base", name: "Weighted base", role: "Printed base with rubber feet and a steel turntable bearing that carries the arm's weight.", specs: [["Diameter", "200 mm"], ["Bearing", "Thin-section ring"], ["Feet", "4 x rubber"]], maker: "Printed base + lazy-Susan bearing", explode: [0, -0.4, 0], layer: 0, anchor: [0.8, 0.2, 0.4] },
    { id: "driver", name: "Servo driver", role: "16-channel PWM board: the controller sends I2C, the board times every servo pulse.", specs: [["Channels", "16"], ["Bus", "I2C"], ["PWM", "12-bit"]], maker: "PCA9685 breakout", explode: [0.4, 0.3, 0.4], layer: 1, anchor: [0.55, 0.4, 0.55] },
    { id: "turntable", name: "Turntable (J1)", role: "A standard servo under the turntable swings the whole arm left and right.", specs: [["Servo", "20 kg·cm"], ["Range", "270°"]], maker: "MG996R servo", explode: [0, 0.35, 0], layer: 2, anchor: [0.5, 0.15, 0] },
    { id: "shoulder", name: "Shoulder servo (J2)", role: "The hardest-working joint: it lifts everything above it.", specs: [["Torque", "20 kg·cm"], ["Gears", "Metal"]], maker: "MG996R servo", explode: [0, 0, -0.45], layer: 3, anchor: [0, 0.1, -0.2] },
    { id: "upper", name: "Upper arm", role: "Two printed side plates with layer lines visible, joined by aluminium spacers.", specs: [["Length", "125 mm"], ["Material", "PETG, 40 % infill"]], maker: "3D-printed link", explode: [0, 0, 0.4], layer: 4, anchor: [0.6, 0.15, 0.2] },
    { id: "elbow", name: "Elbow servo (J3)", role: "Bends the forearm up and down.", specs: [["Torque", "20 kg·cm"]], maker: "MG996R servo", explode: [0, 0, -0.45], layer: 4, anchor: [0, 0.1, -0.2] },
    { id: "forearm", name: "Forearm", role: "Lighter printed link to the wrist.", specs: [["Length", "105 mm"]], maker: "3D-printed link", explode: [0, 0, 0.4], layer: 5, anchor: [0.5, 0.15, 0.18] },
    { id: "wrist", name: "Wrist servos (J4, J5)", role: "Two micro servos pitch and roll the gripper.", specs: [["Servo", "2 x 2.5 kg·cm"]], maker: "SG90 servos", explode: [0.35, 0, 0], layer: 6, anchor: [0.1, 0.1, 0] },
    { id: "gripper", name: "Gripper (J6)", role: "Parallel jaws with rubber pads, driven by a micro servo.", specs: [["Opening", "45 mm"], ["Pads", "Rubber"]], maker: "SG90 gripper kit", explode: [0, 0.5, 0], layer: 7, anchor: [0, 0.3, 0] },
    { id: "cables", name: "Servo leads", role: "Brown, red and orange: ground, power and signal for each servo.", specs: [["Wire", "3 x 26 AWG"]], maker: "Servo extension leads", explode: [0, 0, 0], layer: 1, anchor: [0.2, 0.4, 0.4] },
  ],
};
