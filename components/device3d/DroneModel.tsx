"use client";

// Procedural 5-inch FPV-style quadcopter (generic design, no brand). Every part is its own group so it can be
// exploded, hovered, labelled and inspected. Units: 1 = 10 cm.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Group } from "@/lib/three/Group";
import { batteryLabel, carbonTexture, coilTexture, pcbTexture } from "@/lib/three/textures";
import { onInput } from "@/lib/input/bus";
import { useModelPose } from "@/stores/modelPose";

export type Shell = "solid" | "transparent" | "xray";

export interface DronePart {
  id: string;
  name: string;
  role: string;
  specs: [string, string][];
  maker: string;
  /** Exploded offset and the order it leaves in (0 first). */
  explode: [number, number, number];
  layer: number;
  /** Where the label line attaches, relative to the part. */
  anchor: [number, number, number];
}

export const DRONE_PARTS: DronePart[] = [
  { id: "frame", name: "Carbon fibre frame", role: "Holds everything rigidly and keeps the motors in plane.", specs: [["Wheelbase", "220 mm"], ["Arms", "5 mm 3K twill"], ["Mount", "30.5 mm stack"]], maker: "3D-printed or laser-cut plate", explode: [0, -0.55, 0], layer: 0, anchor: [0.55, 0, 0.55] },
  { id: "motors", name: "Brushless motors", role: "Four outrunner motors spin the props; the flight controller varies their speed thousands of times a second.", specs: [["Size", "2306 stator"], ["Speed", "2450 KV"], ["Poles", "12N14P"]], maker: "N20 or 8520 coreless (brushed)", explode: [0, 0.12, 0], layer: 1, anchor: [0.78, 0.12, 0.78] },
  { id: "props", name: "Propellers", role: "Three-blade props turn motor torque into thrust.", specs: [["Diameter", "5.1 in"], ["Blades", "3"], ["Material", "Polycarbonate"]], maker: "Matched CW / CCW pairs", explode: [0, 0.95, 0], layer: 4, anchor: [-0.78, 0.22, 0.4] },
  { id: "esc", name: "4-in-1 ESC", role: "Turns battery power into the three-phase drive each motor needs.", specs: [["Current", "45 A per motor"], ["Input", "3-6S LiPo"], ["Cap", "35 V low-ESR"]], maker: "TB6612FNG for small brushed motors", explode: [0, 0.38, 0], layer: 2, anchor: [0.18, 0.08, -0.12] },
  { id: "fc", name: "Flight controller", role: "Reads the gyro, runs the control loop and talks to the radio, camera and GPS.", specs: [["MCU", "32-bit Cortex-M7"], ["IMU", "6-axis gyro"], ["Loop", "8 kHz"]], maker: "ESP32-S3 + MPU6050", explode: [0, 0.78, 0], layer: 3, anchor: [0.18, 0.15, 0.1] },
  { id: "canopy", name: "Canopy shell", role: "Protects the stack from props, dirt and rain.", specs: [["Material", "Polycarbonate"], ["Weight", "≈ 12 g"]], maker: "3D-printed TPU", explode: [0, 1.6, 0], layer: 6, anchor: [-0.25, 0.3, 0] },
  { id: "battery", name: "Battery pack", role: "Four lithium-polymer cells in series supply the whole craft.", specs: [["Cells", "4S, 14.8 V"], ["Capacity", "1500 mAh"], ["Plug", "XT60"]], maker: "LiPo + TP4056 for 1S builds", explode: [0, 2.05, 0], layer: 7, anchor: [0.3, 0.55, 0] },
  { id: "camera", name: "FPV camera", role: "Low-latency camera that streams the pilot's view.", specs: [["Sensor", "1/2 in CMOS"], ["Lens", "2.1 mm, 150°"], ["Latency", "< 10 ms"]], maker: "ESP32-CAM + OV2640", explode: [0, 0.2, 0.62], layer: 5, anchor: [0, 0.2, 0.52] },
  { id: "vtx", name: "Video transmitter", role: "Sends the camera feed to goggles on 5.8 GHz.", specs: [["Band", "5.8 GHz"], ["Power", "25-600 mW"]], maker: "nRF24L01 for data links", explode: [0, 0.6, -0.6], layer: 5, anchor: [0, 0.12, -0.42] },
  { id: "rx", name: "Radio receiver", role: "Receives stick commands from the pilot's transmitter.", specs: [["Band", "2.4 GHz"], ["Range", "Long-range link"], ["Telemetry", "Yes"]], maker: "SX1276 LoRa", explode: [0.45, 0.4, -0.45], layer: 5, anchor: [0.16, 0.18, -0.3] },
  { id: "gps", name: "GPS and compass", role: "Position fix for return-to-home and position hold.", specs: [["Fix", "Multi-constellation"], ["Compass", "3-axis"]], maker: "NEO-6M GPS module", explode: [0, 2.45, -0.5], layer: 8, anchor: [0, 0.62, -0.42] },
  { id: "hardware", name: "Standoffs and screws", role: "Aluminium standoffs set the stack height; M3 screws hold it all.", specs: [["Standoffs", "30 mm M3"], ["Finish", "Anodized"]], maker: "M3 nylon standoffs", explode: [0, 0.2, 0], layer: 1, anchor: [0.2, 0.2, 0.2] },
];

const MOTORS: [number, number][] = [
  [0.78, 0.78],
  [-0.78, 0.78],
  [0.78, -0.78],
  [-0.78, -0.78],
];

function useMaterials() {
  return useMemo(() => {
    const carbon = carbonTexture();
    const coil = coilTexture();
    return {
      carbon: new THREE.MeshPhysicalMaterial({ map: carbon, roughness: 0.38, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
      anodViolet: new THREE.MeshStandardMaterial({ color: "#5b45d9", metalness: 0.85, roughness: 0.32 }),
      anodDark: new THREE.MeshStandardMaterial({ color: "#2a2a35", metalness: 0.8, roughness: 0.4 }),
      alu: new THREE.MeshStandardMaterial({ color: "#b9bcc6", metalness: 0.95, roughness: 0.28 }),
      copper: new THREE.MeshStandardMaterial({ map: coil, color: "#ffffff", metalness: 0.9, roughness: 0.35 }),
      gold: new THREE.MeshStandardMaterial({ color: "#d9ad4f", metalness: 1, roughness: 0.22 }),
      prop: new THREE.MeshPhysicalMaterial({ color: "#8f78ff", transmission: 0.55, thickness: 0.05, roughness: 0.25, ior: 1.5, transparent: true, opacity: 0.92 }),
      blackPlastic: new THREE.MeshStandardMaterial({ color: "#16161c", roughness: 0.65 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#1e1e24", roughness: 0.95 }),
      chip: new THREE.MeshStandardMaterial({ color: "#121218", roughness: 0.35, metalness: 0.2 }),
      smd: new THREE.MeshStandardMaterial({ color: "#3a332a", roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#dfe6ff", transmission: 1, thickness: 0.02, roughness: 0.03, ior: 1.52 }),
      lensCoat: new THREE.MeshPhysicalMaterial({ color: "#2b1f6b", metalness: 0.3, roughness: 0.05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6 }),
      siliconeRed: new THREE.MeshStandardMaterial({ color: "#c23a3a", roughness: 0.7 }),
      siliconeBlack: new THREE.MeshStandardMaterial({ color: "#121216", roughness: 0.7 }),
      xt60: new THREE.MeshStandardMaterial({ color: "#e8c23a", roughness: 0.55 }),
      ceramic: new THREE.MeshStandardMaterial({ color: "#c9b48f", roughness: 0.6 }),
      led: new THREE.MeshStandardMaterial({ color: "#3ddc97", emissive: "#3ddc97", emissiveIntensity: 2 }),
      escPcb: new THREE.MeshStandardMaterial({ map: pcbTexture(11, "#0d0f12", "4IN1 45A"), roughness: 0.55, metalness: 0.1 }),
      fcPcb: new THREE.MeshStandardMaterial({ map: pcbTexture(29, "#101318", "FC F7"), roughness: 0.55, metalness: 0.1 }),
      vtxPcb: new THREE.MeshStandardMaterial({ map: pcbTexture(41, "#141024", "VTX"), roughness: 0.55 }),
      battery: new THREE.MeshStandardMaterial({ color: "#1b1a26", roughness: 0.55 }),
      batteryLabel: new THREE.MeshStandardMaterial({ map: batteryLabel(["LI-PO 4S", "1500 mAh  14.8 V", "100C  22.2 Wh"]), roughness: 0.5 }),
      shell: new THREE.MeshPhysicalMaterial({ color: "#d9d6ea", roughness: 0.32, transmission: 0, thickness: 0.06, ior: 1.45 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMaterials>;

// ---------- geometry helpers ----------

function frameGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Centre body as a rounded rectangle.
  const w = 0.3;
  const h = 0.48;
  const r = 0.08;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  const slot = (cx: number, cy: number, len: number, wd: number) => {
    const p = new THREE.Path();
    p.absellipse(cx, cy, wd, len, 0, Math.PI * 2, false, 0);
    return p;
  };
  shape.holes.push(slot(0, 0.24, 0.1, 0.05), slot(0, -0.24, 0.1, 0.05));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  body.rotateX(-Math.PI / 2);

  const parts: THREE.BufferGeometry[] = [body];
  for (const [x, z] of MOTORS) {
    const len = Math.hypot(x, z);
    const arm = new THREE.Shape();
    const aw = 0.075;
    arm.moveTo(0, -aw);
    arm.lineTo(len, -aw * 0.85);
    arm.absarc(len, 0, aw * 0.95, -Math.PI / 2, Math.PI / 2, false);
    arm.lineTo(0, aw);
    arm.lineTo(0, -aw);
    const hole = new THREE.Path();
    hole.absellipse(len * 0.55, 0, 0.16, 0.026, 0, Math.PI * 2, false, 0);
    arm.holes.push(hole);
    const motorHole = new THREE.Path();
    motorHole.absarc(len, 0, 0.018, 0, Math.PI * 2, false);
    arm.holes.push(motorHole);
    const g = new THREE.ExtrudeGeometry(arm, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20 });
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.atan2(z, x));
    parts.push(g);
  }
  return merge(parts);
}

function merge(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (const g0 of geoms) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.getAttribute("position").array as Float32Array));
    nor.push(...(g.getAttribute("normal").array as Float32Array));
    const u = g.getAttribute("uv");
    if (u) uv.push(...(u.array as Float32Array));
    else for (let i = 0; i < g.getAttribute("position").count; i++) uv.push(0, 0);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv.map((v) => v * 1.6), 2));
  return out;
}

function bladeGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.05, -0.022);
  s.bezierCurveTo(0.2, -0.06, 0.42, -0.055, 0.6, -0.018);
  s.quadraticCurveTo(0.63, 0, 0.6, 0.016);
  s.bezierCurveTo(0.42, 0.035, 0.2, 0.04, 0.05, 0.022);
  s.lineTo(0.05, -0.022);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1, curveSegments: 24 });
  g.rotateX(-Math.PI / 2 + 0.22); // pitch
  return g;
}

function bellGeometry(): THREE.LatheGeometry {
  const pts = [
    [0.02, 0.16],
    [0.125, 0.16],
    [0.142, 0.15],
    [0.145, 0.135],
    [0.145, 0.045],
    [0.138, 0.03],
    [0.12, 0.03],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 48);
}

function lensGeometry(): THREE.LatheGeometry {
  const pts = [
    [0.0, 0.0],
    [0.055, 0.0],
    [0.06, 0.02],
    [0.05, 0.04],
    [0.052, 0.09],
    [0.045, 0.11],
    [0.03, 0.115],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
}

function tube(points: [number, number, number][], radius: number): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 48, radius, 10, false);
}

/** Many small surface-mount parts on one board, as one instanced mesh. */
function SmdField({ count, size, seed, mat, avoid = 0.07 }: { count: number; size: number; seed: number; mat: THREE.Material; avoid?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    let s = seed;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      do {
        x = (r() - 0.5) * size;
        z = (r() - 0.5) * size;
      } while (Math.abs(x) < avoid && Math.abs(z) < avoid);
      o.position.set(x, 0.006, z);
      o.rotation.y = r() > 0.5 ? 0 : Math.PI / 2;
      const big = r() > 0.85;
      o.scale.set(big ? 2.2 : 1, big ? 1.6 : 1, big ? 1.6 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, size, seed, avoid]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={mat}>
      <boxGeometry args={[0.012, 0.007, 0.007]} />
    </instancedMesh>
  );
}

// ---------- parts ----------

function Parts({ m, spin, groups, handlers }: { m: Mats; spin: React.RefObject<number>; groups: React.RefObject<Record<string, THREE.Group | null>>; handlers: (id: string) => object }) {
  const frame = useMemo(() => frameGeometry(), []);
  const blade = useMemo(() => bladeGeometry(), []);
  const bell = useMemo(() => bellGeometry(), []);
  const lens = useMemo(() => lensGeometry(), []);
  const motorWires = useMemo(
    () =>
      MOTORS.map(([x, z]) =>
        tube(
          [
            [x * 0.2, 0.1, z * 0.2],
            [x * 0.5, 0.075, z * 0.5],
            [x * 0.88, 0.07, z * 0.88],
          ],
          0.008,
        ),
      ),
    [],
  );
  const leadRed = useMemo(() => tube([[0.07, 0.48, 0.38], [0.1, 0.4, 0.42], [0.06, 0.2, 0.35], [0.05, 0.1, 0.18]], 0.012), []);
  const leadBlack = useMemo(() => tube([[0.03, 0.48, 0.38], [0.0, 0.38, 0.44], [-0.02, 0.2, 0.34], [-0.03, 0.1, 0.18]], 0.012), []);
  const coax = useMemo(() => tube([[0, 0.14, -0.3], [0, 0.2, -0.42], [0, 0.32, -0.5]], 0.008), []);
  const whipA = useMemo(() => tube([[0.12, 0.16, -0.32], [0.2, 0.28, -0.5], [0.28, 0.42, -0.62]], 0.004), []);
  const whipB = useMemo(() => tube([[0.16, 0.16, -0.3], [0.28, 0.22, -0.44], [0.42, 0.3, -0.52]], 0.004), []);
  const props = useRef<THREE.Group[]>([]);

  useFrame((_, dt) => {
    props.current.forEach((p, i) => p && (p.rotation.y += (i % 2 ? -1 : 1) * dt * (spin.current ?? 0)));
  });

  const parts: Record<string, ReactNode> = {
    frame: <mesh geometry={frame} material={m.carbon} castShadow receiveShadow />,
    hardware: (
      <>
        {[
          [0.153, 0.153],
          [-0.153, 0.153],
          [0.153, -0.153],
          [-0.153, -0.153],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.2, z]} material={m.anodViolet}>
            <cylinderGeometry args={[0.014, 0.014, 0.3, 6]} />
          </mesh>
        ))}
        {[
          [0.24, 0.4],
          [-0.24, 0.4],
          [0.24, -0.4],
          [-0.24, -0.4],
        ].map(([x, z], i) => (
          <mesh key={`s${i}`} position={[x, 0.36, z]} material={m.anodDark}>
            <cylinderGeometry args={[0.016, 0.016, 0.012, 6]} />
          </mesh>
        ))}
        {/* top plate */}
        <mesh position={[0, 0.355, 0]} material={m.carbon}>
          <boxGeometry args={[0.56, 0.02, 0.86]} />
        </mesh>
      </>
    ),
    motors: (
      <>
        {MOTORS.map(([x, z], i) => (
          <Group key={i} position={[x, 0.055, z]}>
            <mesh material={m.anodDark} position={[0, 0.015, 0]}>
              <cylinderGeometry args={[0.12, 0.13, 0.03, 40]} />
            </mesh>
            <mesh material={m.copper} position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.112, 0.112, 0.07, 36, 1, true]} />
            </mesh>
            <mesh geometry={bell} material={m.anodViolet} />
            <mesh material={m.alu} position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.1, 12]} />
            </mesh>
            <mesh material={m.anodDark} position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.026, 0.03, 0.035, 6]} />
            </mesh>
          </Group>
        ))}
        {motorWires.map((g, i) => (
          <mesh key={i} geometry={g} material={m.siliconeBlack} />
        ))}
      </>
    ),
    props: (
      <>
        {MOTORS.map(([x, z], i) => (
          <Group key={i} position={[x, 0.22, z]} ref={(el: THREE.Group | null) => void (el && (props.current[i] = el))}>
            <mesh material={m.prop}>
              <cylinderGeometry args={[0.045, 0.05, 0.035, 24]} />
            </mesh>
            {[0, 1, 2].map((b) => (
              <mesh key={b} geometry={blade} material={m.prop} rotation={[0, (b * Math.PI * 2) / 3 + i, 0]} />
            ))}
          </Group>
        ))}
      </>
    ),
    esc: (
      <Group position={[0, 0.1, 0]}>
        <mesh material={m.escPcb}>
          <boxGeometry args={[0.36, 0.016, 0.36]} />
        </mesh>
        {[
          [0.11, 0.11],
          [-0.11, 0.11],
          [0.11, -0.11],
          [-0.11, -0.11],
        ].map(([x, z], i) => (
          <Group key={i} position={[x, 0.012, z]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} material={m.chip} position={[(k - 1) * 0.026, 0, 0]}>
                <boxGeometry args={[0.022, 0.009, 0.03]} />
              </mesh>
            ))}
          </Group>
        ))}
        {[-0.17, 0.17].flatMap((x) => [-0.17, 0.17].map((z) => [x, z])).map(([x, z], i) => (
          <mesh key={`p${i}`} material={m.gold} position={[x, 0.009, z]}>
            <boxGeometry args={[0.03, 0.004, 0.03]} />
          </mesh>
        ))}
        <mesh material={m.blackPlastic} position={[0, 0.03, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.11, 24]} />
        </mesh>
        <SmdField count={70} size={0.33} seed={7} mat={m.smd} avoid={0.0} />
      </Group>
    ),
    fc: (
      <Group position={[0, 0.17, 0]}>
        <mesh material={m.fcPcb}>
          <boxGeometry args={[0.36, 0.016, 0.36]} />
        </mesh>
        <mesh material={m.chip} position={[0, 0.013, 0]}>
          <boxGeometry args={[0.09, 0.012, 0.09]} />
        </mesh>
        <mesh material={m.gold} position={[0, 0.0195, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[0.01, 0.014, 4]} />
        </mesh>
        <mesh material={m.chip} position={[0.09, 0.011, 0.07]}>
          <boxGeometry args={[0.03, 0.008, 0.03]} />
        </mesh>
        <mesh material={m.alu} position={[0, 0.02, -0.16]}>
          <boxGeometry args={[0.07, 0.025, 0.04]} />
        </mesh>
        <mesh material={m.led} position={[-0.12, 0.012, 0.13]}>
          <boxGeometry args={[0.012, 0.006, 0.008]} />
        </mesh>
        {[-0.153, 0.153].flatMap((x) => [-0.153, 0.153].map((z) => [x, z])).map(([x, z], i) => (
          <mesh key={i} material={m.rubber} position={[x, 0, z]}>
            <torusGeometry args={[0.022, 0.01, 8, 20]} />
          </mesh>
        ))}
        <SmdField count={90} size={0.32} seed={19} mat={m.smd} />
      </Group>
    ),
    canopy: (
      <mesh position={[0, 0.2, 0.02]} scale={[0.34, 0.2, 0.48]} material={m.shell}>
        <sphereGeometry args={[1, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    ),
    battery: (
      <Group position={[0, 0.48, 0]}>
        <RoundedBox args={[0.34, 0.24, 0.72]} radius={0.035} smoothness={4} material={m.battery} />
        <mesh material={m.batteryLabel} position={[0, 0.1215, -0.02]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <planeGeometry args={[0.6, 0.29]} />
        </mesh>
        <mesh material={m.rubber} position={[0, 0, 0.12]}>
          <boxGeometry args={[0.36, 0.25, 0.05]} />
        </mesh>
        <mesh material={m.rubber} position={[0, 0, -0.16]}>
          <boxGeometry args={[0.36, 0.25, 0.05]} />
        </mesh>
        <mesh geometry={leadRed} material={m.siliconeRed} position={[0, -0.48, 0]} />
        <mesh geometry={leadBlack} material={m.siliconeBlack} position={[0, -0.48, 0]} />
        <mesh material={m.xt60} position={[0.05, -0.05, 0.42]}>
          <boxGeometry args={[0.07, 0.04, 0.06]} />
        </mesh>
      </Group>
    ),
    camera: (
      <Group position={[0, 0.2, 0.44]} rotation={[-0.3, 0, 0]}>
        <RoundedBox args={[0.19, 0.19, 0.16]} radius={0.02} smoothness={4} material={m.blackPlastic} />
        <mesh geometry={lens} material={m.anodDark} position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh material={m.lensCoat} position={[0, 0, 0.192]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.032, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={m.anodViolet} position={[sx * 0.11, 0, 0]}>
            <boxGeometry args={[0.012, 0.2, 0.2]} />
          </mesh>
        ))}
      </Group>
    ),
    vtx: (
      <Group>
        <mesh material={m.vtxPcb} position={[0, 0.27, -0.3]}>
          <boxGeometry args={[0.2, 0.012, 0.2]} />
        </mesh>
        <mesh material={m.alu} position={[0, 0.285, -0.3]}>
          <boxGeometry args={[0.12, 0.016, 0.1]} />
        </mesh>
        <mesh geometry={coax} material={m.siliconeBlack} />
        <mesh material={m.glass} position={[0, 0.36, -0.52]}>
          <cylinderGeometry args={[0.035, 0.035, 0.07, 24]} />
        </mesh>
      </Group>
    ),
    rx: (
      <Group>
        <mesh material={m.vtxPcb} position={[0.14, 0.15, -0.3]}>
          <boxGeometry args={[0.07, 0.012, 0.1]} />
        </mesh>
        <mesh geometry={whipA} material={m.blackPlastic} />
        <mesh geometry={whipB} material={m.blackPlastic} />
        {[
          [0.28, 0.42, -0.62],
          [0.42, 0.3, -0.52],
        ].map((p, i) => (
          <mesh key={i} material={m.alu} position={p as [number, number, number]}>
            <cylinderGeometry args={[0.006, 0.006, 0.04, 8]} />
          </mesh>
        ))}
      </Group>
    ),
    gps: (
      <Group position={[0, 0.48, -0.42]}>
        <mesh material={m.anodDark} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
        </mesh>
        <RoundedBox args={[0.2, 0.04, 0.2]} radius={0.015} smoothness={3} position={[0, 0.14, 0]} material={m.blackPlastic} />
        <mesh material={m.ceramic} position={[0, 0.17, 0]}>
          <boxGeometry args={[0.12, 0.02, 0.12]} />
        </mesh>
        <mesh material={m.gold} position={[0.03, 0.181, 0.03]}>
          <cylinderGeometry args={[0.006, 0.006, 0.002, 12]} />
        </mesh>
      </Group>
    ),
  };
  return (
    <>
      {DRONE_PARTS.map((p) => (
        <Group key={p.id} ref={(el: THREE.Group | null) => void (groups.current[p.id] = el)} {...handlers(p.id)}>
          {parts[p.id]}
        </Group>
      ))}
    </>
  );
}

// ---------- scene ----------

interface SceneProps {
  explode: number;
  shell: Shell;
  hovered: string | null;
  selected: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onAnchor?: (a: { id: string; x: number; y: number } | null) => void;
  autoRotate?: boolean;
  enableZoom?: boolean;
}

function Scene({ explode, shell, hovered, selected, onHover, onSelect, onAnchor, autoRotate, enableZoom = true }: SceneProps) {
  const m = useMaterials();
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const amount = useRef(explode);
  const vel = useRef(0);
  const spin = useRef(0);
  const root = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  // Per-part material clones so hover and X-ray can tint one part without touching the others.
  useEffect(() => {
    for (const [id, g] of Object.entries(groups.current)) {
      g?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.cloned) {
          mesh.material = (mesh.material as THREE.Material).clone();
          mesh.userData.cloned = true;
          mesh.userData.part = id;
        }
      });
    }
  }, []);

  // Shell modes.
  useEffect(() => {
    const s = groups.current.canopy;
    s?.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!mat || !("transmission" in mat)) return;
      mat.transmission = shell === "transparent" ? 0.95 : 0;
      mat.roughness = shell === "transparent" ? 0.12 : 0.32;
      mat.opacity = shell === "xray" ? 0.08 : 1;
      mat.transparent = shell === "xray";
      mat.wireframe = shell === "xray";
      mat.needsUpdate = true;
    });
  }, [shell]);

  useFrame((_, dt) => {
    // Critically damped spring towards the target explode amount.
    const k = 70;
    const c = 2 * Math.sqrt(k);
    const a = k * (explode - amount.current) - c * vel.current;
    vel.current += a * Math.min(dt, 0.05);
    amount.current += vel.current * Math.min(dt, 0.05);
    const t = amount.current;
    spin.current += ((t < 0.05 ? 3 : 0.4) - spin.current) * Math.min(1, dt * 2);

    for (const p of DRONE_PARTS) {
      const g = groups.current[p.id];
      if (!g) continue;
      // Layered: later layers start later and travel further.
      const local = THREE.MathUtils.clamp((t * 1.35 - p.layer * 0.04) / 1, 0, 1);
      const e = local * local * (3 - 2 * local);
      g.position.set(p.explode[0] * e, p.explode[1] * e, p.explode[2] * e);
      const hot = hovered === p.id || selected === p.id;
      const xray = shell === "xray" && p.id !== "canopy";
      g.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!mat || !("emissive" in mat) || p.id === "fc" && mat.emissiveIntensity === 2) return;
        const target = hot ? 0.35 : xray ? 0.12 : 0;
        mat.emissive.set(hot ? "#7c5cff" : "#a5b4fc");
        mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.2;
      });
    }

    const pose = useModelPose.getState();
    if (root.current) {
      root.current.rotation.x += (pose.rx - root.current.rotation.x) * 0.2;
      root.current.rotation.z += (pose.rz - root.current.rotation.z) * 0.2;
      root.current.rotation.y += (pose.ry - root.current.rotation.y) * 0.2;
    }

    if (onAnchor) {
      const id = hovered ?? selected;
      const p = DRONE_PARTS.find((x) => x.id === id);
      const g = p && groups.current[p.id];
      if (p && g) {
        v.set(...p.anchor);
        g.localToWorld(v);
        v.project(camera);
        onAnchor({ id: p.id, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
      } else onAnchor(null);
    }
  });

  useEffect(() => {
    const zoom = (f: number) => {
      const c = controls.current;
      if (!c) return;
      const dir = c.object.position.clone().sub(c.target);
      c.object.position.copy(c.target.clone().add(dir.setLength(THREE.MathUtils.clamp(dir.length() * f, 2.6, 10))));
      c.update();
    };
    const offs = [onInput("zoomIn", (e) => (zoom(e.value ?? 0.85), true)), onInput("zoomOut", (e) => (zoom(e.value ?? 1.18), true))];
    return () => offs.forEach((f) => f());
  }, []);

  const handlers = (id: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(id);
    },
    onPointerOut: () => onHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    },
  });

  return (
    <>
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, -2]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#9479ff" position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#3d7bff" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[0, 2, 5]} scale={3} />
      </Environment>
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <Group ref={root} position={[0, -0.25, 0]}>
        <Parts m={m} spin={spin} groups={groups} handlers={handlers} />
      </Group>
      <ContactShadows position={[0, -0.85, 0]} opacity={0.55} scale={6} blur={2.6} far={3} color="#000000" />
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.6} maxDistance={10} maxPolarAngle={Math.PI / 1.9} enableZoom={enableZoom} autoRotate={autoRotate} autoRotateSpeed={0.6} />
    </>
  );
}

// ---------- public component ----------

/** The drone's parts only (no lights, controls or canvas), for small props in other scenes. Real size ~ 0.5 units across. */
export function MiniDrone({ spin = 3 }: { spin?: number }) {
  const m = useMaterials();
  const s = useRef(spin);
  const groups = useRef<Record<string, THREE.Group | null>>({});
  return <Parts m={m} spin={s} groups={groups} handlers={() => ({})} />;
}

export interface DroneModelProps {
  explode: number;
  shell?: Shell;
  hovered?: string | null;
  selected?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
  onAnchor?: (a: { id: string; x: number; y: number } | null) => void;
  autoRotate?: boolean;
  enableZoom?: boolean;
  camera?: [number, number, number];
}

export default function DroneModel({ explode, shell = "solid", hovered = null, selected = null, onHover = () => {}, onSelect = () => {}, onAnchor, autoRotate, enableZoom, camera = [3.4, 2.6, 4.2] }: DroneModelProps) {
  const [ready, setReady] = useState(false);
  return (
    <div className={`h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
      <Canvas
        camera={{ position: camera, fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={() => setReady(true)}
        onPointerMissed={() => onSelect(null)}
      >
        <Scene explode={explode} shell={shell} hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} onAnchor={onAnchor} autoRotate={autoRotate} enableZoom={enableZoom} />
      </Canvas>
    </div>
  );
}
