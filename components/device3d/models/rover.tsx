"use client";

// Six-wheel rocker-bogie rover (procedural). 1 scene unit = 100 mm. Reference: hobby rocker-bogie rovers built on
// 2020 aluminium extrusion with 120 mm printed wheels, a differential bar, an electronics bay and a mast camera.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable, Screws } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";

type V3 = [number, number, number];
const WHEEL_R = 0.6;
const WHEEL_W = 0.5;
const SIDE_Z = 1.45; // wheel centre plane
const BEAM_Z = 1.12; // rocker plane
const BODY_Y = 1.5;
const PIVOT: [number, number] = [0, BODY_Y];
const BOGIE: [number, number] = [0.85, 1.02];
const WHEELS_X = [-1.65, 0, 1.65];

/** 2020 extrusion cross-section (20 mm square, four T-slots, centre bore), extruded along +Z. */
export function extrusionGeometry(length: number): THREE.BufferGeometry {
  const a = 0.1;
  const s = 0.031;
  const d = 0.055;
  const pts: [number, number][] = [
    [-a, -a], [-s, -a], [-s, -a + d], [s, -a + d], [s, -a], [a, -a],
    [a, -s], [a - d, -s], [a - d, s], [a, s], [a, a],
    [s, a], [s, a - d], [-s, a - d], [-s, a], [-a, a],
    [-a, s], [-a + d, s], [-a + d, -s], [-a, -s],
  ];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.026, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: length - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 16 });
  g.translate(0, 0, -(length - 0.008) / 2);
  g.computeVertexNormals();
  return g;
}

/** An extrusion beam between two points in the XY plane at depth z. */
function Beam({ a, b, z }: { a: [number, number]; b: [number, number]; z: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const geo = useMemo(() => extrusionGeometry(len), [len]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0)), [ang]);
  return <mesh geometry={geo} material={MAT.aluminum("#b4b8c1")} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} quaternion={q} />;
}

function Wheel() {
  // Printed wheel: tyre band with grousers, six curved spokes, hub; axis +Z.
  const band = useMemo(
    () =>
      lathe(
        [
          [WHEEL_R - 0.09, -WHEEL_W / 2],
          [WHEEL_R - 0.012, -WHEEL_W / 2],
          [WHEEL_R, -WHEEL_W / 2 + 0.012],
          [WHEEL_R, WHEEL_W / 2 - 0.012],
          [WHEEL_R - 0.012, WHEEL_W / 2],
          [WHEEL_R - 0.09, WHEEL_W / 2],
          [WHEEL_R - 0.1, WHEEL_W / 2 - 0.02],
          [WHEEL_R - 0.1, -WHEEL_W / 2 + 0.02],
          [WHEEL_R - 0.09, -WHEEL_W / 2],
        ],
        72,
      ),
    [],
  );
  const grouser = useMemo(() => block(0.05, 0.045, WHEEL_W * 0.96, 0.01), []);
  const grousers = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return { p: [Math.cos(a) * (WHEEL_R + 0.012), Math.sin(a) * (WHEEL_R + 0.012), 0] as V3, r: [0, 0, a] as V3 };
  });
  const spoke = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.1, 0, 0), new THREE.Vector3(0.3, 0.09, 0), new THREE.Vector3(WHEEL_R - 0.09, 0, 0));
    return new THREE.TubeGeometry(curve, 16, 0.032, 10, false);
  }, []);
  const spokes = Array.from({ length: 6 }, (_, i) => ({ p: [0, 0, 0] as V3, r: [0, 0, (i / 6) * Math.PI * 2] as V3 }));
  const hub = useMemo(() => roundCyl(0.13, WHEEL_W * 0.7, 0.02), []);
  const cap = useMemo(() => roundCyl(0.07, 0.04, 0.012, 24), []);
  return (
    <Group>
      <mesh geometry={band} material={MAT.printed("#2b2c31")} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={grouser} mat={MAT.rubber("#1a1a1d")} at={grousers} />
      <Instances geo={spoke} mat={MAT.printed("#2b2c31")} at={spokes} />
      <mesh geometry={hub} material={MAT.printed("#2b2c31")} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={cap} material={MAT.aluminum("#7c5cff")} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, WHEEL_W * 0.36]} />
    </Group>
  );
}

/** Gear motor + bracket behind each wheel (axis +Z, pointing into the wheel). */
function WheelMotor() {
  const can = useMemo(() => roundCyl(0.125, 0.42, 0.015), []);
  const gearbox = useMemo(() => roundCyl(0.13, 0.12, 0.01), []);
  const bracket = useMemo(() => plate(0.36, 0.36, 0.03, { r: 0.04, bevel: 0.006, holes: [[0, 0, 0.06]] }), []);
  return (
    <Group>
      <mesh geometry={gearbox} material={MAT.aluminum("#9fa3ac")} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.06]} />
      <mesh geometry={can} material={MAT.blackSteel()} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.33]} />
      <mesh geometry={bracket} material={MAT.aluminum("#b4b8c1")} position={[0, 0, -0.14]} />
    </Group>
  );
}

function Suspension({ side }: { side: 1 | -1 }) {
  const pivot = useMemo(() => roundCyl(0.11, 0.24, 0.02), []);
  const z = BEAM_Z * side;
  const hubs: [number, number][] = WHEELS_X.map((x) => [x, WHEEL_R]);
  const screws = [PIVOT, BOGIE, ...hubs].map(([x, y]) => ({ p: [x, y, z + side * 0.13] as V3, n: [0, 0, side] as V3 }));
  return (
    <Group>
      {/* rocker: body pivot to the rear wheel and to the bogie pivot */}
      <Beam a={PIVOT} b={[hubs[0][0], hubs[0][1] + 0.12]} z={z} />
      <Beam a={PIVOT} b={BOGIE} z={z} />
      {/* bogie: middle and front wheels */}
      <Beam a={BOGIE} b={[hubs[1][0], hubs[1][1] + 0.12]} z={z} />
      <Beam a={BOGIE} b={[hubs[2][0], hubs[2][1] + 0.12]} z={z} />
      {[PIVOT, BOGIE].map(([x, y]) => (
        <mesh key={x} geometry={pivot} material={MAT.aluminum("#2b2c33")} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <Screws at={screws} d={0.05} mat="blackSteel" />
    </Group>
  );
}

function Chassis() {
  const L = 2.7;
  const W = 1.9;
  const long = useMemo(() => extrusionGeometry(L), []);
  const cross = useMemo(() => extrusionGeometry(W - 0.2), []);
  const deck = useMemo(() => plate(L, W, 0.03, { r: 0.06, bevel: 0.006, holes: [[-1.0, 0.6, 0.05], [1.0, 0.6, 0.05], [-1.0, -0.6, 0.05], [1.0, -0.6, 0.05]] }), []);
  const diff = useMemo(() => extrusionGeometry(2.2), []);
  const linkGeo = useMemo(() => roundCyl(0.03, 0.5, 0.006, 12), []);
  const corners: V3[] = [];
  for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) for (const z of [-W / 2 + 0.1, W / 2 - 0.1]) corners.push([x, BODY_Y + 0.25, z]);
  return (
    <Group>
      {/* frame rectangle of 2020 extrusion */}
      {[-W / 2 + 0.1, W / 2 - 0.1].map((z) => (
        <mesh key={z} geometry={long} material={MAT.aluminum("#b4b8c1")} position={[0, BODY_Y + 0.1, z]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {[-L / 2 + 0.1, L / 2 - 0.1].map((x) => (
        <mesh key={x} geometry={cross} material={MAT.aluminum("#b4b8c1")} position={[x, BODY_Y + 0.1, 0]} />
      ))}
      <mesh geometry={deck} material={MAT.aluminum("#2f3038")} position={[0, BODY_Y + 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* differential bar on top: keeps the body level between the two rockers */}
      <mesh geometry={diff} material={MAT.aluminum("#4a3f86")} position={[-1.15, BODY_Y + 0.45, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={linkGeo} material={MAT.steel()} position={[-1.15, BODY_Y + 0.2, s * 1.05]} />
      ))}
      <Screws at={corners.map((p) => ({ p, n: [0, 1, 0] as V3 }))} d={0.05} mat="blackSteel" />
    </Group>
  );
}

function Bay({ lid }: { lid: boolean }) {
  const wall = useMemo(() => plate(1.6, 0.42, 0.025, { r: 0.02, bevel: 0.005 }), []);
  const end = useMemo(() => plate(1.2, 0.42, 0.025, { r: 0.02, bevel: 0.005, holes: [[0.3, 0.05, 0.05]] }), []);
  const top = useMemo(() => plate(1.66, 1.26, 0.03, { r: 0.06, bevel: 0.008 }), []);
  const y = BODY_Y + 0.44;
  if (lid)
    return (
      <Ex v={[0, 0.9, 0]} delay={6}>
        <mesh geometry={top} material={MAT.plasticGloss("#1c1d24")} position={[0.15, y + 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      </Ex>
    );
  return (
    <Group>
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} geometry={wall} material={MAT.printed("#d9d6cf")} position={[0.15, y, z]} />
      ))}
      {[-0.65, 0.95].map((x) => (
        <mesh key={x} geometry={end} material={MAT.printed("#d9d6cf")} position={[x, y, 0]} rotation={[0, Math.PI / 2, 0]} />
      ))}
    </Group>
  );
}

function Electronics() {
  const board = useMemo(() => plate(0.9, 0.6, 0.016, { r: 0.02, bevel: 0.002 }), []);
  const drv = useMemo(() => plate(0.42, 0.42, 0.016, { r: 0.015, bevel: 0.002 }), []);
  const sink = useMemo(() => block(0.2, 0.16, 0.12, 0.01), []);
  const pack = useMemo(() => block(0.7, 0.36, 0.2, 0.03), []);
  const chip = useMemo(() => block(0.1, 0.1, 0.02, 0.004), []);
  const label = useMemo(() => new THREE.MeshPhysicalMaterial({ map: labelTexture(["Li-ion 2S2P", "7.4 V  6000 mAh"], { bg: "#1b1d2a", fg: "#e8e6f2", w: 512, h: 128, size: 40 }), roughness: 0.45 }), []);
  const y = BODY_Y + 0.26;
  return (
    <Group>
      <mesh geometry={board} material={MAT.pcb(44, "black", "ROVER MAIN")} position={[0.4, y, -0.2]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={chip} material={MAT.chip()} position={[0.35, y + 0.02, -0.25]} rotation={[-Math.PI / 2, 0, 0]} />
      {[0.15, 0.6].map((x) => (
        <Group key={x}>
          <mesh geometry={drv} material={MAT.pcb(55 + x * 10, "green", "DRV")} position={[x - 0.2, y, 0.32]} rotation={[-Math.PI / 2, 0, 0]} />
          <mesh geometry={sink} material={MAT.aluminum("#2b2c33")} position={[x - 0.2, y + 0.07, 0.32]} rotation={[-Math.PI / 2, 0, 0]} />
        </Group>
      ))}
      <mesh geometry={pack} material={MAT.foil("#2d2f3a")} position={[-0.4, y + 0.1, -0.2]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh material={label} position={[-0.4, y + 0.201, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.16]} />
      </mesh>
      <mesh position={[0.82, y + 0.03, -0.42]} material={MAT.led("#3ddc97")}>
        <sphereGeometry args={[0.018, 12, 12]} />
      </mesh>
    </Group>
  );
}

function Mast() {
  const pole = useMemo(() => roundCyl(0.06, 1.3, 0.01, 24), []);
  const head = useMemo(() => block(0.5, 0.26, 0.3, 0.05), []);
  const panBase = useMemo(() => roundCyl(0.13, 0.12, 0.02), []);
  const lens = useMemo(
    () =>
      lathe(
        [
          [0, 0.06],
          [0.05, 0.06],
          [0.065, 0.045],
          [0.07, 0],
          [0.07, -0.02],
          [0, -0.02],
        ],
        32,
      ),
    [],
  );
  const glass = useMemo(() => roundCyl(0.042, 0.01, 0.004, 32), []);
  const x = 1.0;
  const top = BODY_Y + 0.25 + 1.3;
  return (
    <Group>
      <mesh geometry={panBase} material={MAT.aluminum("#2b2c33")} position={[x, BODY_Y + 0.29, 0.55]} />
      <mesh geometry={pole} material={MAT.aluminum("#b4b8c1")} position={[x, BODY_Y + 0.25 + 0.65, 0.55]} />
      <Group position={[x, top + 0.13, 0.55]}>
        <mesh geometry={panBase} material={MAT.aluminum("#2b2c33")} position={[0, -0.08, 0]} />
        <mesh geometry={head} material={MAT.plasticMatte("#e8e5de")} position={[0, 0.07, 0]} rotation={[0, Math.PI / 2, 0]} />
        {[-0.1, 0.1].map((z) => (
          <Group key={z} position={[0.16, 0.07, z]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={lens} material={MAT.blackSteel()} />
            <mesh geometry={glass} material={MAT.coverGlass()} position={[0, 0.062, 0]} />
          </Group>
        ))}
      </Group>
    </Group>
  );
}

function Cables() {
  const geos = useMemo(
    () =>
      [-1, 1].flatMap((s) =>
        WHEELS_X.map((x) => sagCable([x, WHEEL_R + 0.05, s * (BEAM_Z - 0.2)], [x * 0.25, BODY_Y + 0.15, s * 0.55], 0.25, 0.022, [[x * 0.7, WHEEL_R + 0.5, s * (BEAM_Z - 0.15)]])),
      ),
    [],
  );
  return (
    <Group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.silicone(i % 2 ? "#141417" : "#c23a3a")} />
      ))}
    </Group>
  );
}

function Body() {
  return (
    <Group position={[0, 0, 0]}>
      <Part id="chassis">
        <Chassis />
      </Part>
      <Part id="suspension">
        {([-1, 1] as const).map((s) => (
          <Ex key={s} v={[0, 0, s * 0.35]} delay={2}>
            <Suspension side={s} />
          </Ex>
        ))}
      </Part>
      <Part id="wheels">
        {([-1, 1] as const).flatMap((s) =>
          WHEELS_X.map((x) => (
            <Ex key={`${s}${x}`} v={[0, 0, s * 0.85]} delay={3}>
              <Group position={[x, WHEEL_R, s * SIDE_Z]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                <Wheel />
              </Group>
            </Ex>
          )),
        )}
      </Part>
      <Part id="motors">
        {([-1, 1] as const).flatMap((s) =>
          WHEELS_X.map((x) => (
            <Ex key={`${s}${x}`} v={[0, 0, s * 0.55]} delay={3}>
              <Group position={[x, WHEEL_R, s * (SIDE_Z - WHEEL_W / 2)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                <WheelMotor />
              </Group>
            </Ex>
          )),
        )}
      </Part>
      <Part id="bay">
        <Bay lid={false} />
      </Part>
      <Part id="lid">
        <Bay lid />
      </Part>
      <Part id="electronics">
        <Electronics />
      </Part>
      <Part id="mast">
        <Mast />
      </Part>
      <Part id="cables">
        <Cables />
      </Part>
    </Group>
  );
}

export const ROVER: ProductDef = {
  id: "rover",
  name: "Rocker-bogie rover",
  Body,
  camera: [8.2, 5.4, 9.6],
  floor: 0,
  offset: [0, -1.25, 0],
  shadowScale: 9,
  aoRadius: 0.4,
  minDistance: 4,
  maxDistance: 16,
  parts: [
    { id: "chassis", name: "Extrusion chassis", role: "A rectangle of 2020 aluminium extrusion with a deck plate and the differential bar that keeps the body level.", specs: [["Profile", "2020, 6063-T5"], ["Footprint", "270 x 190 mm"], ["Fasteners", "M5 T-nuts"]], maker: "Laser-cut plywood plate", explode: [0, 0, 0], layer: 0, anchor: [-1.2, 1.6, 0.9] },
    { id: "suspension", name: "Rocker-bogie", role: "Two linked arms per side let all six wheels stay on the ground over rocks twice the wheel height.", specs: [["Pivots", "Two per side"], ["Links", "2020 extrusion"], ["Climb", "≈ 2 x wheel radius"]], maker: "Printed arms + 608 bearings", explode: [0, 0, 0], layer: 2, anchor: [0.4, 1.25, 1.1] },
    { id: "wheels", name: "Wheels", role: "120 mm printed wheels with curved spokes that flex like springs, and rubber grousers for grip.", specs: [["Diameter", "120 mm"], ["Width", "50 mm"], ["Grousers", "18"]], maker: "Printed TPU tyres", explode: [0, 0, 0], layer: 3, anchor: [1.65, 1.1, 1.6] },
    { id: "motors", name: "Gear motors", role: "One geared DC motor per wheel; the outer four also steer on real rovers.", specs: [["Type", "25 mm DC gear motor"], ["Ratio", "1:100"], ["Speed", "≈ 100 rpm"]], maker: "N20 gear motors", explode: [0, 0, 0], layer: 3, anchor: [0, 0.6, 1.05] },
    { id: "bay", name: "Electronics bay", role: "A printed box that keeps dust off the boards.", specs: [["Walls", "2.5 mm PETG"]], maker: "3D-printed box", explode: [0, 0.35, 0], layer: 4, anchor: [0.95, 1.95, 0] },
    { id: "lid", name: "Bay lid", role: "Lifts off for access. Goes see-through in Transparent mode.", specs: [["Material", "Gloss PETG"]], maker: "Acrylic sheet", explode: [0, 0.35, 0], layer: 6, anchor: [0.3, 2.17, 0.4], shell: true },
    { id: "electronics", name: "Controller and drivers", role: "Main board plus two motor-driver boards with heat sinks, and a 2S2P Li-ion pack.", specs: [["Drivers", "2 x dual H-bridge"], ["Battery", "7.4 V 6 Ah"], ["Radio", "2.4 GHz"]], maker: "ESP32 + L298N + 18650 pack", explode: [0, 0.75, 0], layer: 5, anchor: [0.4, 1.78, -0.2] },
    { id: "mast", name: "Mast camera", role: "Stereo camera head on a pan base, 1.5 m-eye view for driving remotely.", specs: [["Cameras", "2 (stereo)"], ["Pan", "360°"]], maker: "ESP32-CAM + SG90 pan", explode: [0.4, 1.1, 0], layer: 7, anchor: [1.0, 3.2, 0.55] },
    { id: "cables", name: "Motor wiring", role: "Each motor lead runs along its arm with slack for the suspension to move.", specs: [["Wire", "22 AWG silicone"]], maker: "Dupont jumpers", explode: [0, 0.2, 0], layer: 1, anchor: [0.5, 1.3, 0.9] },
  ],
};
