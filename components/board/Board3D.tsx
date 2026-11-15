"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { partsById } from "@/data/parts";
import type { Build } from "@/lib/types";
import { onInput } from "@/lib/input/bus";

type El = { type: string; [k: string]: unknown };
const S = 0.1; // 1 scene unit = 10 mm
const BOARD_T = 1.6 * S;

interface Seg {
  a: [number, number];
  b: [number, number];
  w: number;
  layer: "top" | "bottom";
}

function useBoardModel(cj: El[], build: Build) {
  return useMemo(() => {
    const board = cj.find((e) => e.type === "pcb_board") as { width: number; height: number; center: { x: number; y: number } } | undefined;
    const holes = cj.filter((e) => e.type === "pcb_plated_hole") as unknown as { x: number; y: number; outer_diameter?: number; hole_diameter?: number }[];
    const mounting = cj.filter((e) => e.type === "pcb_hole") as unknown as { x: number; y: number; hole_diameter?: number }[];
    const segs: Seg[] = [];
    for (const t of cj.filter((e) => e.type === "pcb_trace") as unknown as { route: { route_type: string; x: number; y: number; width?: number; layer?: string }[] }[]) {
      for (let i = 1; i < t.route.length; i++) {
        const p = t.route[i - 1];
        const q = t.route[i];
        if (p.route_type !== "wire" || q.route_type !== "wire") continue;
        segs.push({ a: [p.x, p.y], b: [q.x, q.y], w: p.width ?? 0.15, layer: p.layer === "bottom" ? "bottom" : "top" });
      }
    }
    const sourceName = new Map((cj.filter((e) => e.type === "source_component") as unknown as { source_component_id: string; name: string }[]).map((s) => [s.source_component_id, s.name]));
    const byLabel = new Map(build.instances.map((i) => [i.label, i]));
    const modules = (cj.filter((e) => e.type === "pcb_component") as unknown as { center: { x: number; y: number }; width: number; height: number; rotation?: number; source_component_id: string }[]).map((c) => {
      const label = sourceName.get(c.source_component_id) ?? "";
      const inst = byLabel.get(label);
      const part = inst ? partsById[inst.partId] : undefined;
      const rotated = inst?.rotation === 90 || inst?.rotation === 270;
      const dims = part && part.mount !== "cable" ? part.dimensions_mm : undefined;
      return {
        label,
        name: inst?.title ?? part?.name ?? label,
        x: c.center.x,
        y: c.center.y,
        fpW: c.width,
        fpH: c.height,
        body: dims ? { w: rotated ? dims.h : dims.w, h: rotated ? dims.w : dims.h, d: Math.min(dims.d, 6) } : null,
        cable: part?.mount === "cable",
      };
    });
    return { board, holes, mounting, segs, modules };
  }, [cj, build]);
}

function Traces({ segs, layer }: { segs: Seg[]; layer: "top" | "bottom" }) {
  const geom = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = [];
    for (const s of segs.filter((x) => x.layer === layer)) {
      const dx = s.b[0] - s.a[0];
      const dy = s.b[1] - s.a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const g = new THREE.BoxGeometry(len * S + s.w * S, 0.035 * S, s.w * S);
      g.rotateY(-Math.atan2(dy, dx) * -1);
      g.translate(((s.a[0] + s.b[0]) / 2) * S, 0, (-(s.a[1] + s.b[1]) / 2) * S);
      geoms.push(g);
    }
    if (!geoms.length) return null;
    return mergeGeometries(geoms);
  }, [segs, layer]);
  if (!geom) return null;
  const y = layer === "top" ? BOARD_T / 2 + 0.002 : -BOARD_T / 2 - 0.002;
  return (
    <mesh geometry={geom} position={[0, y, 0]}>
      <meshStandardMaterial color={layer === "top" ? "#C9773C" : "#7C5A3E"} metalness={0.6} roughness={0.35} />
    </mesh>
  );
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of geoms) {
    const ng = g.index ? g.toNonIndexed() : g;
    positions.push(...(ng.getAttribute("position").array as Float32Array));
    normals.push(...(ng.getAttribute("normal").array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return out;
}

function Scene({ cj, build }: { cj: El[]; build: Build }) {
  const m = useBoardModel(cj, build);
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const zoom = (f: number) => {
      const c = controls.current;
      if (!c) return;
      const cam = c.object;
      const dir = cam.position.clone().sub(c.target);
      cam.position.copy(c.target.clone().add(dir.setLength(THREE.MathUtils.clamp(dir.length() * f, 3, 30))));
      c.update();
    };
    const rot = (a: number) => {
      const c = controls.current;
      if (!c) return;
      const off = c.object.position.clone().sub(c.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      c.object.position.copy(c.target.clone().add(off));
      c.update();
    };
    const offs = [onInput("zoomIn", (e) => (zoom(e.value ?? 0.85), true)), onInput("zoomOut", (e) => (zoom(e.value ?? 1.18), true)), onInput("rotate", (e) => (rot(e.value ?? Math.PI / 8), true))];
    return () => offs.forEach((f) => f());
  }, []);
  if (!m.board) return null;
  const bw = m.board.width * S;
  const bh = m.board.height * S;
  const HEADER = 8.5 * S;
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 10, 6]} intensity={1.5} />
      <directionalLight position={[-6, 5, -5]} intensity={0.4} />
      <group>
        <mesh>
          <boxGeometry args={[bw, BOARD_T, bh]} />
          <meshStandardMaterial color="#24272B" roughness={0.75} />
          <Edges color="#8E877B" lineWidth={1} />
        </mesh>
        <Traces segs={m.segs} layer="top" />
        <Traces segs={m.segs} layer="bottom" />
        {m.holes.map((h, i) => (
          <mesh key={i} position={[h.x * S, BOARD_T / 2 + 0.003, -h.y * S]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[((h.hole_diameter ?? 1) / 2) * S, ((h.outer_diameter ?? 1.7) / 2) * S, 20]} />
            <meshStandardMaterial color="#D9A066" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {m.mounting.map((h, i) => (
          <mesh key={`m${i}`} position={[h.x * S, BOARD_T / 2 + 0.003, -h.y * S]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[((h.hole_diameter ?? 3.2) / 2) * S, ((h.hole_diameter ?? 3.2) / 2 + 0.8) * S, 32]} />
            <meshStandardMaterial color="#8E877B" side={THREE.DoubleSide} />
          </mesh>
        ))}
        {m.modules.map((mod) => (
          <group key={mod.label} position={[mod.x * S, BOARD_T / 2, -mod.y * S]}>
            {/* header strip(s) */}
            <mesh position={[0, (2.5 * S) / 2, 0]}>
              <boxGeometry args={[Math.max(mod.fpW, 2.54) * S, 2.5 * S, Math.max(mod.fpH, 2.54) * S]} />
              <meshStandardMaterial color="#16181C" roughness={0.6} transparent opacity={mod.body ? 0.95 : 1} />
            </mesh>
            {mod.body && (
              <mesh position={[0, HEADER + (mod.body.d * S) / 2, 0]}>
                <boxGeometry args={[mod.body.w * S, mod.body.d * S, mod.body.h * S]} />
                <meshStandardMaterial color="#FBF9F5" roughness={0.85} />
                <Edges color="#16181C" lineWidth={1} transparent opacity={0.35} />
              </mesh>
            )}
            <Text
              position={[0, (mod.body ? HEADER + mod.body.d * S : 2.5 * S) + 0.012, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.16}
              maxWidth={Math.max(0.8, (mod.body?.w ?? mod.fpW) * S * 0.95)}
              color={mod.body ? "#16181C" : "#E8E2D6"}
              anchorX="center"
              anchorY="middle"
            >
              {mod.label}
            </Text>
          </group>
        ))}
      </group>
      <ContactShadows position={[0, -0.4, 0]} opacity={0.3} scale={Math.max(bw, bh) * 2.2} blur={2.4} far={3} color="#16181C" />
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={30} maxPolarAngle={Math.PI / 2.1} />
    </>
  );
}

export default function Board3D({ circuitJson, build }: { circuitJson: El[]; build: Build }) {
  const board = circuitJson.find((e) => e.type === "pcb_board") as { width: number; height: number } | undefined;
  const span = Math.max(board?.width ?? 60, board?.height ?? 60) * S;
  return (
    <Canvas camera={{ position: [span * 0.9, span * 1.0, span * 1.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Scene cj={circuitJson} build={build} />
    </Canvas>
  );
}
