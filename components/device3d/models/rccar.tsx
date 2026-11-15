"use client";

// 1/10-scale electric RC buggy (procedural): 380 mm long. Aluminium chassis plate, polycarbonate body shell,
// four wheels with treaded tyres, coil-over shocks, brushless motor with spur gear, ESC with fan, steering servo,
// receiver and a 2S hard-case LiPo. Scale: 1 scene unit = 100 mm. Front is +X.

import { useMemo } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable } from "@/lib/three/geo";
import { Ex, Part, type ProductDef } from "../product/ProductModel";

type V3 = [number, number, number];
const TYRE_R = 0.55;
const TYRE_W = 0.42;
const AXLE_X = 1.3;
const TRACK_Z = 0.95;
const CH_Y = 0.45;

function Chassis() {
  const p = useMemo(() => plate(3.2, 1.1, 0.03, { r: 0.18, bevel: 0.008, holes: [[-0.6, 0, 0.12], [0.2, 0.3, 0.08], [0.2, -0.3, 0.08], [0.9, 0, 0.1]] }), []);
  const bumper = useMemo(() => block(0.25, 0.18, 1.0, 0.08), []);
  const tower = useMemo(() => plate(0.12, 1.3, 0.35, { r: 0.04, bevel: 0.01, holes: [[0, 0.45, 0.04], [0, -0.45, 0.04]] }), []);
  const arm = useMemo(() => block(0.9, 0.06, 0.18, 0.025), []);
  return (
    <Group>
      <mesh geometry={p} material={MAT.aluminum("#2f3038")} position={[0, CH_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={bumper} material={MAT.plasticMatte("#141418")} position={[1.75, CH_Y + 0.05, 0]} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={tower} material={MAT.aluminum("#4f43a6")} position={[sx * AXLE_X * 0.92, CH_Y + 0.35, 0]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {/* lower wishbones */}
      <Instances
        geo={arm}
        mat={MAT.plasticMatte("#1a1a1f")}
        at={[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ p: [sx * AXLE_X, CH_Y - 0.02, sz * (TRACK_Z / 2)] as V3, r: [0, Math.PI / 2, 0] as V3 })))}
      />
    </Group>
  );
}

function Wheel() {
  const tyre = useMemo(
    () =>
      lathe(
        [
          [0.34, -TYRE_W / 2],
          [TYRE_R - 0.05, -TYRE_W / 2],
          [TYRE_R, -TYRE_W / 2 + 0.06],
          [TYRE_R, TYRE_W / 2 - 0.06],
          [TYRE_R - 0.05, TYRE_W / 2],
          [0.34, TYRE_W / 2],
        ],
        64,
      ),
    [],
  );
  const pin = useMemo(() => block(0.045, 0.035, 0.06, 0.012), []);
  const pins: { p: V3; r: V3 }[] = [];
  for (let i = 0; i < 36; i++)
    for (const z of [-0.14, -0.05, 0.05, 0.14]) {
      const a = (i / 36) * Math.PI * 2 + (Math.abs(z) < 0.1 ? Math.PI / 36 : 0);
      pins.push({ p: [Math.cos(a) * (TYRE_R + 0.012), Math.sin(a) * (TYRE_R + 0.012), z], r: [0, 0, a] });
    }
  const rim = useMemo(() => lathe([[0.06, -0.18], [0.34, -0.18], [0.36, -0.15], [0.36, 0.17], [0.32, 0.19], [0.3, 0.12], [0.08, 0.1], [0.06, -0.18]], 48), []);
  const spoke = useMemo(() => block(0.28, 0.06, 0.05, 0.02), []);
  const nut = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), []);
  return (
    <Group>
      <mesh geometry={tyre} material={MAT.rubber("#1b1b1e")} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={pin} mat={MAT.rubber("#1b1b1e")} at={pins} />
      <mesh geometry={rim} material={MAT.plasticGloss("#e9e8e3")} rotation={[Math.PI / 2, 0, 0]} />
      <Instances geo={spoke} mat={MAT.plasticGloss("#e9e8e3")} at={Array.from({ length: 6 }, (_, i) => ({ p: [Math.cos((i * Math.PI) / 3) * 0.2, Math.sin((i * Math.PI) / 3) * 0.2, 0.12] as V3, r: [0, 0, (i * Math.PI) / 3] as V3 }))} />
      <mesh geometry={nut} material={MAT.steel()} position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]} />
    </Group>
  );
}

function Shock() {
  // Coil-over: aluminium body, steel shaft, spring as a helix tube, rod ends.
  const body = useMemo(() => roundCyl(0.06, 0.42, 0.012, 24), []);
  const shaft = useMemo(() => roundCyl(0.018, 0.3, 0.004, 12), []);
  const spring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 220; i++) {
      const t = i / 220;
      const a = t * Math.PI * 2 * 9;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.085, t * 0.5 - 0.25, Math.sin(a) * 0.085));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.012, 6, false);
  }, []);
  const cap = useMemo(() => roundCyl(0.1, 0.03, 0.01, 24), []);
  return (
    <Group>
      <mesh geometry={body} material={MAT.aluminum("#4f43a6")} position={[0, 0.12, 0]} />
      <mesh geometry={shaft} material={MAT.steel()} position={[0, -0.2, 0]} />
      <mesh geometry={spring} material={MAT.steel()} />
      <mesh geometry={cap} material={MAT.aluminum("#4f43a6")} position={[0, 0.27, 0]} />
      <mesh geometry={cap} material={MAT.aluminum("#4f43a6")} position={[0, -0.27, 0]} />
    </Group>
  );
}

function Drivetrain() {
  const can = useMemo(() => roundCyl(0.18, 0.5, 0.03, 48), []);
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["BRUSHLESS", "3300 KV  SENSORED"], { bg: "#1b1d2a", fg: "#e8e6f2", w: 512, h: 128, size: 34 }), roughness: 0.4, metalness: 0.4 }), []);
  const gear = useMemo(() => {
    const teeth = 64;
    const s = new THREE.Shape();
    for (let i = 0; i <= teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.3 : 0.315;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.05, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
    g.computeVertexNormals();
    return g;
  }, []);
  const gearbox = useMemo(() => block(0.6, 0.55, 0.5, 0.08), []);
  return (
    <Group position={[-AXLE_X + 0.15, CH_Y + 0.3, 0]}>
      <mesh geometry={gearbox} material={MAT.plasticMatte("#1a1a1f")} />
      <Group position={[0.5, 0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={can} material={MAT.aluminum("#2b2c33")} />
        <mesh material={label} position={[0, 0, 0.181]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.32, 0.12]} />
        </mesh>
      </Group>
      <mesh geometry={gear} material={MAT.plasticMatte("#e9e8e3")} position={[0.1, 0.05, 0.28]} />
    </Group>
  );
}

function Electronics() {
  const esc = useMemo(() => block(0.45, 0.3, 0.36, 0.04), []);
  const fin = useMemo(() => block(0.4, 0.08, 0.02, 0.005), []);
  const fan = useMemo(() => roundCyl(0.13, 0.08, 0.02, 32), []);
  const servo = useMemo(() => block(0.41, 0.36, 0.2, 0.02), []);
  const rx = useMemo(() => block(0.36, 0.14, 0.26, 0.03), []);
  const antenna = useMemo(() => roundCyl(0.012, 0.9, 0.004, 8), []);
  const pack = useMemo(() => block(1.38, 0.25, 0.47, 0.05), []);
  const packLabel = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["LiPo 2S 7.4 V", "5000 mAh  50C  HARD CASE"], { bg: "#1b1d2a", fg: "#e8e6f2", w: 512, h: 128, size: 34 }), roughness: 0.4 }), []);
  const strap = useMemo(() => block(0.08, 0.3, 0.55, 0.02), []);
  return (
    <Group>
      <Group position={[-0.25, CH_Y + 0.2, -0.32]}>
        <mesh geometry={esc} material={MAT.plasticMatte("#1d1d22")} />
        <Instances geo={fin} mat={MAT.aluminum("#4f43a6")} at={Array.from({ length: 7 }, (_, i) => ({ p: [0, 0.16, -0.15 + i * 0.05] as V3 }))} />
        <mesh geometry={fan} material={MAT.plasticMatte("#141418")} position={[0, 0.24, 0]} />
        <mesh position={[0.2, 0.05, 0.181]} material={MAT.led("#ff6b6b")}>
          <boxGeometry args={[0.03, 0.02, 0.01]} />
        </mesh>
      </Group>
      <mesh geometry={servo} material={MAT.plasticMatte("#17171c")} position={[AXLE_X * 0.62, CH_Y + 0.2, 0]} />
      <Group position={[0.25, CH_Y + 0.1, 0.33]}>
        <mesh geometry={rx} material={MAT.plasticMatte("#141418")} />
        <mesh geometry={antenna} material={MAT.plasticMatte("#141418")} position={[0.1, 0.5, 0]} />
      </Group>
      <Group position={[0.05, CH_Y + 0.14, -0.05]}>
        <mesh geometry={pack} material={MAT.plasticGloss("#16161c")} />
        <mesh material={packLabel} position={[0, 0.126, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 0.28]} />
        </mesh>
        <Instances geo={strap} mat={MAT.rubber("#4f43a6")} at={[-0.4, 0.4].map((x) => ({ p: [x, 0.04, 0] as V3 }))} />
      </Group>
    </Group>
  );
}

function Wiring() {
  const a = useMemo(() => sagCable([-0.25, CH_Y + 0.25, -0.12], [-0.6, CH_Y + 0.25, 0.1], 0.08, 0.025), []);
  const b = useMemo(() => sagCable([-0.25, CH_Y + 0.25, -0.18], [-0.6, CH_Y + 0.22, 0.04], 0.1, 0.025), []);
  const c = useMemo(() => sagCable([-0.25, CH_Y + 0.25, -0.24], [-0.6, CH_Y + 0.19, -0.02], 0.12, 0.025), []);
  const d = useMemo(() => sagCable([0.15, CH_Y + 0.12, 0.33], [AXLE_X * 0.62, CH_Y + 0.3, 0.05], 0.15, 0.012), []);
  return (
    <Group>
      <mesh geometry={a} material={MAT.silicone("#c23a3a")} />
      <mesh geometry={b} material={MAT.silicone("#141417")} />
      <mesh geometry={c} material={MAT.silicone("#e3c54a")} />
      <mesh geometry={d} material={MAT.silicone("#b8622d")} />
    </Group>
  );
}

/** Polycarbonate shell: a low cab-forward side profile extruded across the width with a round bevel, smoothed,
 *  with the windows painted on the inside (as real RC shells are) via a texture in profile coordinates. */
const X0 = -1.8;
const X1 = 1.8;
const Y1 = 0.62;

function Shell() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.72, 0.02);
    s.lineTo(1.55, 0.02);
    s.quadraticCurveTo(1.78, 0.04, 1.72, 0.16);
    s.quadraticCurveTo(1.2, 0.26, 0.6, 0.36);
    s.quadraticCurveTo(0.2, 0.6, -0.35, 0.6);
    s.quadraticCurveTo(-0.85, 0.58, -1.05, 0.4);
    s.quadraticCurveTo(-1.5, 0.36, -1.72, 0.3);
    s.quadraticCurveTo(-1.8, 0.16, -1.72, 0.02);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 10, curveSegments: 40 });
    g.translate(0, 0, -0.55);
    const m = mergeVertices(g.deleteAttribute("normal") && g, 1e-4);
    m.computeVertexNormals();
    return m;
  }, []);
  const paint = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#5b45d9";
    g.fillRect(0, 0, 1024, 256);
    const px = (x: number) => ((x - X0) / (X1 - X0)) * 1024;
    const py = (y: number) => 256 - (y / Y1) * 256;
    // side window
    g.fillStyle = "#0b0b12";
    g.beginPath();
    g.moveTo(px(0.45), py(0.38));
    g.quadraticCurveTo(px(0.15), py(0.56), px(-0.35), py(0.56));
    g.quadraticCurveTo(px(-0.78), py(0.55), px(-0.95), py(0.4));
    g.closePath();
    g.fill();
    // stripe
    g.fillStyle = "#e8e6f2";
    g.fillRect(px(-1.7), py(0.2), px(1.6) - px(-1.7), 10);
    g.fillStyle = "#3d7bff";
    g.fillRect(px(-1.7), py(0.2) + 14, px(1.6) - px(-1.7), 6);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / (X1 - X0), 1 / Y1);
    t.offset.set(-X0 / (X1 - X0), 0);
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.22, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 });
  }, []);
  const wing = useMemo(() => plate(0.55, 1.45, 0.025, { r: 0.08, bevel: 0.006 }), []);
  const strut = useMemo(() => block(0.05, 0.3, 0.2, 0.01), []);
  return (
    <Group position={[0, CH_Y + 0.12, 0]}>
      <mesh geometry={geo} material={paint} />
      <Instances geo={strut} mat={MAT.plasticGloss("#141418")} at={[-0.4, 0.4].map((z) => ({ p: [-1.5, 0.48, z] as V3 }))} />
      <mesh geometry={wing} material={MAT.plasticGloss("#141418")} position={[-1.55, 0.64, 0]} rotation={[-Math.PI / 2, 0, 0.12]} />
    </Group>
  );
}

function Body() {
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  return (
    <Group>
      <Part id="chassis">
        <Chassis />
      </Part>
      <Part id="wheels">
        {corners.map(([sx, sz]) => (
          <Ex key={`${sx}${sz}`} v={[0, 0, sz * 0.7]} delay={3}>
            <Group position={[sx * AXLE_X, TYRE_R, sz * TRACK_Z]} rotation={[0, sz > 0 ? 0 : Math.PI, sx > 0 ? 0.12 : 0]}>
              <Wheel />
            </Group>
          </Ex>
        ))}
      </Part>
      <Part id="shocks">
        {corners.map(([sx, sz]) => (
          <Ex key={`${sx}${sz}`} v={[0, 0.2, sz * 0.4]} delay={2}>
            <Group position={[sx * (AXLE_X * 0.92), CH_Y + 0.35, sz * 0.5]} rotation={[sz * 0.45, 0, 0]}>
              <Shock />
            </Group>
          </Ex>
        ))}
      </Part>
      <Part id="drivetrain">
        <Drivetrain />
      </Part>
      <Part id="electronics">
        <Electronics />
      </Part>
      <Part id="wiring">
        <Wiring />
      </Part>
      <Part id="shell">
        <Shell />
      </Part>
    </Group>
  );
}

export const RC_CAR: ProductDef = {
  id: "rccar",
  name: "RC buggy",
  Body,
  camera: [5.8, 3.4, 6.6],
  floor: 0,
  offset: [0, -0.7, 0],
  exposure: 1.0,
  shadowScale: 8,
  aoRadius: 0.35,
  minDistance: 3.5,
  maxDistance: 14,
  parts: [
    { id: "chassis", name: "Chassis and arms", role: "3 mm aluminium plate with shock towers, wishbones and a front bumper.", specs: [["Plate", "3 mm 7075"], ["Length", "380 mm"]], maker: "Laser-cut plywood plate", explode: [0, -0.35, 0], layer: 0, anchor: [1.2, 0.48, 0.3] },
    { id: "wheels", name: "Wheels and tyres", role: "Pin-spike tyres on six-spoke rims, held by hex nuts.", specs: [["Diameter", "110 mm"], ["Hex", "12 mm"]], maker: "Printed rims + rubber bands", explode: [0, 0, 0], layer: 3, anchor: [1.3, 0.9, 1.15] },
    { id: "shocks", name: "Coil-over shocks", role: "Oil-filled dampers inside springs smooth out the bumps.", specs: [["Oil", "35 wt silicone"], ["Travel", "30 mm"]], maker: "Printed springs + foam", explode: [0, 0, 0], layer: 2, anchor: [1.2, 1.0, 0.5] },
    { id: "drivetrain", name: "Motor and gearbox", role: "Sensored brushless motor driving the spur gear into a rear gearbox and differential.", specs: [["Motor", "3300 KV brushless"], ["Spur", "64 T"]], maker: "N20 gear motor", explode: [0, 0.6, 0], layer: 4, anchor: [-0.8, 1.05, 0.2] },
    { id: "electronics", name: "ESC, servo, receiver and battery", role: "The ESC turns throttle commands into motor power; the servo steers; the receiver listens to the transmitter.", specs: [["ESC", "60 A, fan-cooled"], ["Battery", "2S 5000 mAh"], ["Radio", "2.4 GHz"]], maker: "ESP32 + nRF24L01 + TB6612FNG", explode: [0, 0.95, 0], layer: 5, anchor: [0.3, 0.75, -0.05] },
    { id: "wiring", name: "Wiring", role: "Three motor phases from the ESC and the servo lead.", specs: [["Wire", "14 AWG silicone"]], maker: "Silicone wire", explode: [0, 0.75, 0], layer: 4, anchor: [-0.4, 0.75, 0] },
    { id: "shell", name: "Body shell", role: "Painted polycarbonate shell with tinted windows and a rear wing.", specs: [["Material", "1 mm polycarbonate"], ["Finish", "Painted inside"]], maker: "Vacuum-formed PETG", explode: [0, 1.7, 0], layer: 7, anchor: [0, 1.4, 0.4], shell: true },
  ],
};
