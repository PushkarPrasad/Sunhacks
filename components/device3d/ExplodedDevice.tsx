"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Edges, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
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
    <group ref={group} rotation={block.rotation ?? [0, 0, 0]}>
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
    </group>
  );
}

function Scene({ blocks, active, onActive, exploded }: Props) {
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
      <group position={[0, -0.6, 0]}>
        {blocks.map((b) => (
          <Block key={b.id} block={b} t={t} active={active === b.id} onActive={onActive} />
        ))}
        <ContactShadows position={[0, minY - 0.25, 0]} opacity={0.28} scale={12} blur={2.6} far={6} color="#16181C" />
      </group>
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={16} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function ExplodedDevice(props: Props) {
  const [ready, setReady] = useState(false);
  return (
    <div className={`h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
      <Canvas camera={{ position: [6.2, 5.2, 7.4], fov: 32 }} dpr={[1, 2]} onCreated={() => setReady(true)} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
