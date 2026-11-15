"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ArchitectureBlock } from "@/lib/types";
import { onInput } from "@/lib/input/bus";

const TONES: Record<ArchitectureBlock["tone"], { color: string; metalness?: number; roughness?: number; opacity?: number }> = {
  shell: { color: "#E7E1D5", roughness: 0.8 },
  board: { color: "#24272B", roughness: 0.6 },
  chip: { color: "#16181C", roughness: 0.45, metalness: 0.2 },
  glass: { color: "#A9B9C6", roughness: 0.08, opacity: 0.55 },
  battery: { color: "#D8CDB6", roughness: 0.7 },
  metal: { color: "#A8A39A", roughness: 0.35, metalness: 0.55 },
  accent: { color: "#B5652E", roughness: 0.4, metalness: 0.4 },
};
const COPPER = new THREE.Color("#B5652E");

interface Props {
  blocks: ArchitectureBlock[];
  active: string | null;
  onActive: (id: string | null) => void;
  exploded: boolean;
  /** Numbered callouts with leader lines (anatomy figure). */
  anatomy?: boolean;
}

function Block({ block, t, active, onActive }: { block: ArchitectureBlock; t: React.RefObject<number>; active: boolean; onActive: (id: string | null) => void }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const tone = TONES[block.tone];
  const base = useMemo(() => new THREE.Color(tone.color), [tone.color]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = t.current ?? 0;
    g.position.set(block.position[0] + block.explode[0] * k, block.position[1] + block.explode[1] * k, block.position[2] + block.explode[2] * k);
    if (mat.current) mat.current.color.lerp(active ? COPPER : base, 0.18);
  });

  const [x, y, z] = block.size;
  const material = (
    <meshStandardMaterial ref={mat} color={tone.color} roughness={tone.roughness ?? 0.6} metalness={tone.metalness ?? 0} transparent={!!tone.opacity} opacity={tone.opacity ?? 1} />
  );
  const edges = <Edges threshold={20} color={active ? "#B5652E" : "#16181C"} lineWidth={1} transparent opacity={active ? 0.9 : 0.28} />;
  const handlers = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onActive(block.id);
    },
    onPointerOut: () => onActive(null),
  };

  return (
    <Group ref={group} rotation={block.rotation ?? [0, 0, 0]}>
      {block.shape === "rounded" ? (
        <RoundedBox args={[x, y, z]} radius={Math.min(x, y, z) * 0.35} smoothness={4} {...handlers}>
          {material}
          {edges}
        </RoundedBox>
      ) : block.shape === "cylinder" ? (
        <mesh {...handlers}>
          <cylinderGeometry args={[x / 2, z / 2, y, 48]} />
          {material}
          {edges}
        </mesh>
      ) : (
        <mesh {...handlers}>
          <boxGeometry args={[x, y, z]} />
          {material}
          {edges}
        </mesh>
      )}
    </Group>
  );
}

export interface Anchor {
  id: string;
  x: number;
  y: number;
}

/** Projects each block's current centre to screen pixels (throttled) for the anatomy callout overlay. */
function Projector({ blocks, t, onProject }: { blocks: ArchitectureBlock[]; t: React.RefObject<number>; onProject: (a: Anchor[]) => void }) {
  const { camera, size } = useThree();
  const frame = useRef(0);
  const last = useRef("");
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (frame.current++ % 4) return;
    const k = t.current ?? 0;
    const out = blocks.map((b) => {
      v.set(b.position[0] + b.explode[0] * k, b.position[1] + b.explode[1] * k - 0.6, b.position[2] + b.explode[2] * k).project(camera);
      return { id: b.id, x: Math.round(((v.x + 1) / 2) * size.width), y: Math.round(((1 - v.y) / 2) * size.height) };
    });
    const key = out.map((o) => `${o.x},${o.y}`).join(";");
    if (key !== last.current) {
      last.current = key;
      onProject(out);
    }
  });
  return null;
}

function Scene({ blocks, active, onActive, exploded, anatomy, onProject }: Props & { onProject?: (a: Anchor[]) => void }) {
  const t = useRef(0);
  const controls = useRef<OrbitControlsImpl>(null);
  useFrame((_, dt) => {
    const target = exploded ? 1 : 0;
    t.current += (target - t.current) * Math.min(1, dt * 3.2);
  });

  useEffect(() => {
    const zoom = (factor: number) => {
      const c = controls.current;
      if (!c) return;
      const cam = c.object as THREE.PerspectiveCamera;
      const dir = cam.position.clone().sub(c.target);
      const len = THREE.MathUtils.clamp(dir.length() * factor, 4, 16);
      cam.position.copy(c.target.clone().add(dir.setLength(len)));
      c.update();
    };
    const rotate = (angle: number) => {
      const c = controls.current;
      if (!c) return;
      const cam = c.object;
      const offset = cam.position.clone().sub(c.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      cam.position.copy(c.target.clone().add(offset));
      c.update();
    };
    const offs = [
      onInput("zoomIn", (e) => (zoom(e.value ?? 0.85), true)),
      onInput("zoomOut", (e) => (zoom(e.value ?? 1.18), true)),
      onInput("rotate", (e) => (rotate(e.value ?? Math.PI / 8), true)),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  const minY = Math.min(...blocks.map((b) => b.position[1] - b.size[1] / 2 + Math.min(0, b.explode[1])));
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 9, 6]} intensity={1.6} />
      <directionalLight position={[-6, 4, -4]} intensity={0.45} />
      <Group position={[0, -0.6, 0]}>
        {blocks.map((b) => (
          <Block
            key={b.id}
            block={b}
            t={t}
            active={active === b.id}
            onActive={onActive}
          />
        ))}
        <ContactShadows position={[0, minY - 0.25, 0]} opacity={0.28} scale={12} blur={2.6} far={6} color="#16181C" />
      </Group>
      {anatomy && onProject && <Projector blocks={blocks} t={t} onProject={onProject} />}
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={16} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

const LABEL_W = 150;
const ROW = 30;

/** Lays numbered labels out in two screen columns, sorted by height, with a minimum gap, plus leader lines. */
function AnatomyOverlay({ blocks, anchors, active, onActive, show }: { blocks: ArchitectureBlock[]; anchors: Anchor[]; active: string | null; onActive: (id: string | null) => void; show: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const items = anchors.map((a) => ({ ...a, n: blocks.findIndex((b) => b.id === a.id) + 1, name: blocks.find((b) => b.id === a.id)?.name ?? a.id }));
  const mid = box.w / 2;
  let left = items.filter((i) => i.x < mid);
  let right = items.filter((i) => i.x >= mid);
  // Balance the columns by moving the items closest to the centre.
  while (left.length - right.length > 1) {
    left.sort((a, b) => b.x - a.x);
    right = [...right, left.shift()!];
  }
  while (right.length - left.length > 1) {
    right.sort((a, b) => a.x - b.x);
    left = [...left, right.shift()!];
  }
  const column = (list: typeof items, side: "left" | "right") => {
    const sorted = [...list].sort((a, b) => a.y - b.y);
    const top = 120;
    const bottom = box.h - 160;
    const ys: number[] = [];
    sorted.forEach((it, i) => ys.push(Math.max(top, i ? Math.max(it.y, ys[i - 1] + ROW) : it.y)));
    // If we overflowed the bottom, push back up.
    for (let i = ys.length - 1; i >= 0; i--) {
      const max = i === ys.length - 1 ? bottom : ys[i + 1] - ROW;
      ys[i] = Math.min(ys[i], max);
    }
    const x = side === "left" ? 28 : box.w - 28 - LABEL_W;
    return sorted.map((it, i) => ({ ...it, lx: x, ly: ys[i], side }));
  };
  const placed = box.w ? [...column(left, "left"), ...column(right, "right")] : [];
  return (
    <div ref={host} className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {placed.map((p) => {
          const ex = p.side === "left" ? p.lx + LABEL_W : p.lx;
          const knee = p.side === "left" ? ex + 18 : ex - 18;
          const on = active === p.id;
          return (
            <g key={p.id}>
              <polyline points={`${ex},${p.ly} ${knee},${p.ly} ${p.x},${p.y}`} fill="none" stroke={on ? "#B5652E" : "#8E877B"} strokeWidth={on ? 1.4 : 1} />
              <circle cx={p.x} cy={p.y} r={on ? 3.5 : 2.5} fill={on ? "#B5652E" : "#16181C"} />
            </g>
          );
        })}
      </svg>
      {placed.map((p) => (
        <button
          key={p.id}
          type="button"
          tabIndex={show ? 0 : -1}
          onMouseEnter={() => onActive(p.id)}
          onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(p.id)}
          onBlur={() => onActive(null)}
          className={`pointer-events-auto absolute flex h-6 -translate-y-1/2 items-center gap-2 rounded-full border px-2.5 text-[11px] transition-colors ${p.side === "right" ? "" : "flex-row-reverse justify-start"} ${active === p.id ? "border-copper bg-copper text-paper" : "border-line bg-card/95 text-ink hover:border-ink"}`}
          style={{ left: p.lx, top: p.ly, width: LABEL_W }}
        >
          <span className={`font-mono text-[10px] ${active === p.id ? "text-paper/80" : "text-muted"}`}>{String(p.n).padStart(2, "0")}</span>
          <span className={`flex-1 truncate ${p.side === "left" ? "text-right" : ""}`}>{p.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function ExplodedDevice(props: Props) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [ready, setReady] = useState(false);
  return (
    <div className={`relative h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
      <Canvas camera={{ position: [6.2, 5.2, 7.4], fov: 32 }} dpr={[1, 2]} onCreated={() => setReady(true)} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Scene {...props} onProject={props.anatomy ? setAnchors : undefined} />
      </Canvas>
      {props.anatomy && <AnatomyOverlay blocks={props.blocks} anchors={anchors} active={props.active} onActive={props.onActive} show={props.exploded} />}
    </div>
  );
}
