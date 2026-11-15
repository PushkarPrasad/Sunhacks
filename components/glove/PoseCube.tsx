"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, RoundedBox } from "@react-three/drei";
import type * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { slerpToPose, usePoseView } from "@/stores/modelPose";

function Cube() {
  const root = useRef<THREE.Group>(null);
  usePoseView();
  useFrame(() => {
    if (root.current) slerpToPose(root.current);
  });
  return (
    <Group ref={root}>
      <RoundedBox args={[1.2, 1.2, 1.2]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color="#0B1914" roughness={0.45} metalness={0.3} />
        <Edges color="#0F9D6B" />
      </RoundedBox>
      <mesh position={[0, 0, 0.61]}>
        <circleGeometry args={[0.18, 32]} />
        <meshStandardMaterial color="#C8A96A" />
      </mesh>
    </Group>
  );
}

/** Small cube that follows the glove grab (registers as a 3D view, so a knock can toggle grab here). */
export function PoseCube() {
  return (
    <Canvas camera={{ position: [2.2, 1.6, 2.6], fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <Cube />
    </Canvas>
  );
}
