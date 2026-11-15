"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Studio, STUDIO_DPR } from "@/components/three/Studio";
import { Group } from "@/lib/three/Group";
import { useInput } from "@/stores/input";
import { MAT } from "@/lib/three/materials";

const DEG = Math.PI / 180;

/** The glove's motion board, following the live roll / pitch / yaw (absolute, not the grab delta). */
function Board() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = useInput.getState().orientation;
    if (!g.current || !o) return;
    const k = 0.25;
    g.current.rotation.x += (-o.pitch * DEG - g.current.rotation.x) * k;
    g.current.rotation.z += (-o.roll * DEG - g.current.rotation.z) * k;
    g.current.rotation.y += (-o.yaw * DEG - g.current.rotation.y) * k;
  });
  return (
    <Group ref={g}>
      {/* Arduino 101 footprint 68.6 x 53.3 mm, scaled */}
      <RoundedBox args={[1.37, 0.06, 1.07]} radius={0.02} smoothness={3}>
        <primitive object={MAT.pcb(101, "blue", "GLOVE")} attach="material" />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.05, 0.34]} radius={0.01} position={[0.1, 0.05, 0]}>
        <meshStandardMaterial color="#1a1a1e" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.9, 0.12, 0.1]} radius={0.02} position={[0, 0.09, -0.44]}>
        <meshStandardMaterial color="#111" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.24, 0.16, 0.3]} radius={0.02} position={[-0.56, 0.1, 0.25]}>
        <meshStandardMaterial color="#b9bcc4" metalness={0.9} roughness={0.3} />
      </RoundedBox>
      {/* forward arrow = where the fingers point */}
      <mesh position={[0, 0.05, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.24, 24]} />
        <meshStandardMaterial color="#0F9D6B" emissive="#0F9D6B" emissiveIntensity={0.6} />
      </mesh>
    </Group>
  );
}

export default function GlovePreview() {
  return (
    <Canvas camera={{ position: [1.6, 1.4, 2.0], fov: 35 }} dpr={STUDIO_DPR} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <Studio floor={-0.6} shadowScale={3} effects={false} />
      <Board />
    </Canvas>
  );
}
