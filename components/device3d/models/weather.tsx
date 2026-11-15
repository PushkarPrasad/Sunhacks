"use client";

// Solar weather station (procedural): 40 mm mast, louvered radiation shield around the temperature/humidity sensor,
// three-cup anemometer and wind vane on a crossbar, tipping-bucket rain gauge funnel, solar panel and a sealed
// electronics box with cable glands. Scale: 1 scene unit = 100 mm.

import { useMemo } from "react";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MAT, labelTexture } from "@/lib/three/materials";
import { block, Instances, lathe, plate, roundCyl, sagCable } from "@/lib/three/geo";
import { Part, type ProductDef } from "../product/ProductModel";

type V3 = [number, number, number];
const MAST_R = 0.2;
const MAST_H = 6.2;

function solarTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9ccd4";
  g.fillRect(0, 0, 512, 320);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 6; x++) {
      const px = 10 + x * 82;
      const py = 10 + y * 76;
      const grad = g.createLinearGradient(px, py, px + 76, py + 70);
      grad.addColorStop(0, "#14204a");
      grad.addColorStop(1, "#0b1330");
      g.fillStyle = grad;
      g.fillRect(px, py, 76, 70);
      g.strokeStyle = "rgba(200,205,215,0.55)";
      g.lineWidth = 1;
      for (let k = 1; k < 3; k++) {
        g.beginPath();
        g.moveTo(px + (76 * k) / 3, py);
        g.lineTo(px + (76 * k) / 3, py + 70);
        g.stroke();
      }
      g.strokeStyle = "rgba(120,130,170,0.25)";
      for (let k = 1; k < 10; k++) {
        g.beginPath();
        g.moveTo(px, py + k * 7);
        g.lineTo(px + 76, py + k * 7);
        g.stroke();
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Mast() {
  const pole = useMemo(() => roundCyl(MAST_R, MAST_H, 0.02, 32), []);
  const base = useMemo(() => roundCyl(1.1, 0.12, 0.04, 64), []);
  const gusset = useMemo(() => plate(0.5, 0.5, 0.04, { r: 0.03, bevel: 0.008 }), []);
  const cap = useMemo(() => roundCyl(MAST_R + 0.02, 0.08, 0.03, 32), []);
  const bolt = useMemo(() => roundCyl(0.05, 0.05, 0.01, 6), []);
  return (
    <Group>
      <mesh geometry={base} material={MAT.aluminum("#7d818b")} position={[0, 0.06, 0]} />
      <mesh geometry={pole} material={MAT.aluminum("#c3c6cd")} position={[0, MAST_H / 2 + 0.1, 0]} />
      <mesh geometry={cap} material={MAT.plasticMatte("#141418")} position={[0, MAST_H + 0.14, 0]} />
      <Instances geo={gusset} mat={MAT.aluminum("#7d818b")} at={[0, 1, 2, 3].map((i) => ({ p: [Math.cos((i * Math.PI) / 2) * 0.3, 0.32, Math.sin((i * Math.PI) / 2) * 0.3] as V3, r: [0, -(i * Math.PI) / 2 + Math.PI / 2, 0] as V3 }))} />
      <Instances geo={bolt} mat={MAT.steel()} at={[0, 1, 2, 3, 4, 5].map((i) => ({ p: [Math.cos(i + 0.5) * 0.9, 0.14, Math.sin(i + 0.5) * 0.9] as V3 }))} />
    </Group>
  );
}

/** A horizontal arm from the mast with a U-bolt clamp. */
function Arm({ y, len, dir }: { y: number; len: number; dir: number }) {
  const bar = useMemo(() => block(len, 0.12, 0.12, 0.02), [len]);
  const ubolt = useMemo(() => new THREE.TorusGeometry(MAST_R + 0.03, 0.022, 10, 32, Math.PI), []);
  return (
    <Group position={[0, y, 0]} rotation={[0, dir, 0]}>
      <mesh geometry={bar} material={MAT.aluminum("#9da2ac")} position={[len / 2 + MAST_R, 0, 0]} />
      {[-0.08, 0.08].map((dy) => (
        <mesh key={dy} geometry={ubolt} material={MAT.steel()} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} />
      ))}
    </Group>
  );
}

function Shield() {
  // Seven louvered dishes on three rods; the sensor hangs in the shaded middle.
  const dish = useMemo(
    () =>
      lathe(
        [
          [0.16, 0.06],
          [0.55, -0.04],
          [0.62, -0.1],
          [0.6, -0.12],
          [0.52, -0.07],
          [0.16, 0.03],
          [0.16, 0.06],
        ],
        64,
      ),
    [],
  );
  const top = useMemo(() => lathe([[0, 0.12], [0.55, 0.02], [0.63, -0.08], [0.6, -0.1], [0, 0.06]], 64), []);
  const rod = useMemo(() => roundCyl(0.02, 1.1, 0.004, 8), []);
  const sensor = useMemo(() => roundCyl(0.06, 0.24, 0.02, 16), []);
  const dishes = Array.from({ length: 7 }, (_, i) => ({ p: [0, -i * 0.14, 0] as V3 }));
  return (
    <Group position={[1.25, 3.4, 0]}>
      <mesh geometry={top} material={MAT.plasticMatte("#eeeeea")} position={[0, 0.16, 0]} />
      <Instances geo={dish} mat={MAT.plasticMatte("#eeeeea")} at={dishes} />
      <Instances geo={rod} mat={MAT.steel()} at={[0, 1, 2].map((i) => ({ p: [Math.cos((i * 2 * Math.PI) / 3) * 0.4, -0.38, Math.sin((i * 2 * Math.PI) / 3) * 0.4] as V3 }))} />
      <mesh geometry={sensor} material={MAT.plasticMatte("#1b1b20")} position={[0, -0.4, 0]} />
    </Group>
  );
}

function Wind() {
  const hub = useMemo(() => roundCyl(0.12, 0.2, 0.03, 32), []);
  const spoke = useMemo(() => roundCyl(0.016, 0.62, 0.004, 8), []);
  const cup = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push([Math.sin(a) * 0.16, -Math.cos(a) * 0.16]);
    }
    for (let i = 12; i >= 0; i--) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push([Math.sin(a) * 0.145, -Math.cos(a) * 0.145]);
    }
    return lathe(pts, 32);
  }, []);
  const vaneTail = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.5, 0.16);
    s.lineTo(0.5, -0.16);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    g.computeVertexNormals();
    return g;
  }, []);
  const vaneRod = useMemo(() => roundCyl(0.018, 1.2, 0.004, 8), []);
  const counter = useMemo(() => roundCyl(0.06, 0.16, 0.02, 16), []);
  const crossbar = useMemo(() => block(2.4, 0.1, 0.1, 0.02), []);
  const axle = useMemo(() => roundCyl(0.03, 0.3, 0.005, 8), []);
  const y = MAST_H + 0.35;
  return (
    <Group>
      <mesh geometry={crossbar} material={MAT.aluminum("#9da2ac")} position={[0, y - 0.15, 0]} />
      {/* anemometer on the right end */}
      <Group position={[1.05, y + 0.1, 0]}>
        <mesh geometry={axle} material={MAT.steel()} position={[0, -0.12, 0]} />
        <mesh geometry={hub} material={MAT.plasticMatte("#141418")} position={[0, 0.08, 0]} />
        {[0, 1, 2].map((i) => {
          const a = (i * 2 * Math.PI) / 3;
          return (
            <Group key={i} rotation={[0, a, 0]} position={[0, 0.1, 0]}>
              <mesh geometry={spoke} material={MAT.aluminum("#9da2ac")} position={[0.31, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
              <mesh geometry={cup} material={MAT.plasticGloss("#ecebe6")} position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
            </Group>
          );
        })}
      </Group>
      {/* wind vane on the left end */}
      <Group position={[-1.05, y + 0.1, 0]} rotation={[0, 0.6, 0]}>
        <mesh geometry={hub} material={MAT.plasticMatte("#141418")} />
        <mesh geometry={vaneRod} material={MAT.aluminum("#9da2ac")} position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} />
        <mesh geometry={vaneTail} material={MAT.plasticMatte("#4f43a6")} position={[0.1, 0.12, -0.006]} />
        <mesh geometry={counter} material={MAT.steel()} position={[-0.55, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} />
      </Group>
    </Group>
  );
}

function Rain() {
  const funnel = useMemo(
    () =>
      lathe(
        [
          [0.05, -0.32],
          [0.06, -0.32],
          [0.06, -0.2],
          [0.48, 0.12],
          [0.5, 0.2],
          [0.47, 0.2],
          [0.45, 0.13],
          [0.04, -0.19],
          [0.05, -0.32],
        ],
        64,
      ),
    [],
  );
  const body = useMemo(() => roundCyl(0.5, 0.5, 0.04, 64), []);
  return (
    <Group position={[-1.3, 4.6, 0]}>
      <mesh geometry={body} material={MAT.plasticMatte("#ecebe6")} position={[0, -0.25, 0]} />
      <mesh geometry={funnel} material={MAT.plasticGloss("#e9e8e3")} position={[0, 0.05, 0]} />
    </Group>
  );
}

function Solar() {
  const panel = useMemo(() => block(1.7, 1.06, 0.04, 0.02), []);
  const frame = useMemo(() => block(1.76, 1.12, 0.035, 0.012), []);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: solarTexture(), roughness: 0.22, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }), []);
  const bracket = useMemo(() => block(0.14, 0.5, 0.08, 0.02), []);
  return (
    <Group position={[0, 1.9, 0.75]} rotation={[-0.62, 0, 0]}>
      <mesh geometry={frame} material={MAT.aluminum("#9da2ac")} position={[0, 0, -0.01]} />
      <mesh geometry={panel} material={MAT.plasticGloss("#0b1330")} />
      <mesh material={mat} position={[0, 0, 0.0215]}>
        <planeGeometry args={[1.66, 1.02]} />
      </mesh>
      <mesh geometry={bracket} material={MAT.aluminum("#7d818b")} position={[0, 0, -0.28]} rotation={[0.62 + Math.PI / 2, 0, 0]} />
    </Group>
  );
}

function Box({ lid }: { lid: boolean }) {
  const shell = useMemo(() => block(1.2, 1.5, 0.62, 0.06), []);
  const cover = useMemo(() => block(1.2, 1.5, 0.12, 0.06), []);
  const coverMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#c9ccd2", roughness: 0.35, transmission: 0.0, clearcoat: 0.5 }), []);
  const gland = useMemo(() => lathe([[0, 0], [0.08, 0], [0.08, 0.06], [0.06, 0.08], [0.06, 0.16], [0.04, 0.17], [0, 0.17]], 6), []);
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: labelTexture(["IP65", "WX NODE 03"], { bg: "#eef4f0", fg: "#1b1a26", w: 256, h: 128, size: 40 }), roughness: 0.5 }), []);
  const board = useMemo(() => plate(0.55, 0.28, 0.016, { r: 0.02, bevel: 0.003 }), []);
  const cell = useMemo(() => roundCyl(0.09, 0.65, 0.02, 24), []);
  if (lid)
    return (
      <Group position={[0, 2.6, -0.62]}>
        <mesh geometry={cover} material={coverMat} position={[0, 0, 0.37]} />
        <mesh material={label} position={[0, 0.5, 0.432]}>
          <planeGeometry args={[0.4, 0.2]} />
        </mesh>
      </Group>
    );
  return (
    <Group position={[0, 2.6, -0.62]}>
      <mesh geometry={shell} material={MAT.plasticMatte("#b7bac2")} />
      <Instances geo={gland} mat={MAT.plasticMatte("#1b1b20")} at={[-0.3, 0, 0.3].map((x) => ({ p: [x, -0.75, 0] as V3, r: [Math.PI, 0, 0] as V3 }))} />
      <mesh geometry={board} material={MAT.pcb(301, "black", "ESP32")} position={[0, 0.25, 0.32]} />
      <mesh geometry={cell} material={MAT.foil("#0a6b49")} position={[0, -0.25, 0.25]} rotation={[0, 0, Math.PI / 2]} />
    </Group>
  );
}

function Cables() {
  const a = useMemo(() => sagCable([1.2, 2.95, 0], [0.3, 2.2, -0.3], 0.2, 0.025, [[0.9, 2.7, 0.1], [0.4, 2.0, -0.1]]), []);
  const b = useMemo(() => sagCable([0, MAST_H + 0.2, 0.25], [-0.3, 2.0, -0.4], 0.1, 0.025, [[0.05, 4.5, 0.25], [0.0, 3.4, 0.25], [-0.3, 1.8, -0.2]]), []);
  const c = useMemo(() => sagCable([0, 1.6, 0.6], [0.3, 1.85, -0.4], 0.25, 0.025), []);
  const tie = useMemo(() => new THREE.TorusGeometry(MAST_R + 0.04, 0.014, 6, 24), []);
  return (
    <Group>
      <mesh geometry={a} material={MAT.silicone("#141417")} />
      <mesh geometry={b} material={MAT.silicone("#141417")} />
      <mesh geometry={c} material={MAT.silicone("#c23a3a")} />
      <Instances geo={tie} mat={MAT.plasticMatte("#0f0f12")} at={[3.6, 4.4, 5.2].map((y) => ({ p: [0, y, 0] as V3, r: [Math.PI / 2, 0, 0] as V3 }))} />
    </Group>
  );
}

function Body() {
  return (
    <Group>
      <Part id="mast">
        <Mast />
        <Arm y={3.4} len={1.05} dir={0} />
        <Arm y={4.35} len={1.1} dir={Math.PI} />
      </Part>
      <Part id="shield">
        <Shield />
      </Part>
      <Part id="wind">
        <Wind />
      </Part>
      <Part id="rain">
        <Rain />
      </Part>
      <Part id="solar">
        <Solar />
      </Part>
      <Part id="box">
        <Box lid={false} />
      </Part>
      <Part id="lid">
        <Box lid />
      </Part>
      <Part id="cables">
        <Cables />
      </Part>
    </Group>
  );
}

export const WEATHER: ProductDef = {
  id: "weather",
  name: "Weather station",
  Body,
  camera: [9.5, 6.2, 11.5],
  floor: 0,
  offset: [0, -3.4, 0],
  shadowScale: 9,
  aoRadius: 0.5,
  minDistance: 6,
  maxDistance: 22,
  parts: [
    { id: "mast", name: "Mast and arms", role: "A 40 mm aluminium mast on a bolted base plate, with arms held by U-bolts.", specs: [["Mast", "40 mm x 620 mm"], ["Clamps", "M6 U-bolts"]], maker: "Broom handle + pipe clamps", explode: [0, 0, 0], layer: 0, anchor: [0.2, 3.0, 0.2] },
    { id: "shield", name: "Radiation shield", role: "Seven louvered white dishes shade the temperature and humidity sensor while air flows through.", specs: [["Plates", "7"], ["Sensor", "Temp + humidity + pressure"]], maker: "Stacked plant saucers + BME280", explode: [0.8, 0, 0], layer: 2, anchor: [1.25, 3.5, 0.6] },
    { id: "wind", name: "Anemometer and vane", role: "Three cups spin at a speed set by the wind; the vane points into it. Both turn magnets past sensors.", specs: [["Cups", "3 x 32 mm"], ["Sensing", "Reed switch + hall"]], maker: "Printed cups + reed switch", explode: [0, 1.0, 0], layer: 4, anchor: [1.05, 6.7, 0.4] },
    { id: "rain", name: "Rain gauge", role: "A funnel feeds a tipping bucket; every tip is 0.2 mm of rain.", specs: [["Funnel", "100 mm"], ["Resolution", "0.2 mm"]], maker: "Printed funnel + tipping bucket", explode: [-0.8, 0.3, 0], layer: 3, anchor: [-1.3, 4.8, 0.4] },
    { id: "solar", name: "Solar panel", role: "Keeps the battery topped up; tilted to face the midday sun.", specs: [["Power", "6 V, 2 W"], ["Cells", "24"]], maker: "6 V garden solar panel", explode: [0, -0.2, 0.9], layer: 2, anchor: [0.5, 2.0, 0.85] },
    { id: "box", name: "Electronics box", role: "Sealed enclosure with cable glands: ESP32, charger and an 18650 cell inside.", specs: [["Rating", "IP65"], ["Radio", "Wi-Fi"]], maker: "ESP32 + BME280 + TP4056", explode: [0, 0, -0.6], layer: 1, anchor: [0.5, 2.9, -0.4] },
    { id: "lid", name: "Box lid", role: "Screwed lid with a gasket. Goes see-through in Transparent mode.", specs: [["Gasket", "Silicone"]], maker: "Food container lid", explode: [0, 0, 0.9], layer: 5, anchor: [0.3, 3.1, -0.25], shell: true },
    { id: "cables", name: "Cables", role: "UV-resistant sensor cables down the mast, held with ties.", specs: [["Cable", "4-core, UV-resistant"]], maker: "Phone cable + zip ties", explode: [0.3, 0, 0], layer: 1, anchor: [0.1, 4.4, 0.3] },
  ],
};
