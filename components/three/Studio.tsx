"use client";

// Shared studio for every 3D view (V3 realism pass): a local CC0 studio HDRI for reflections, one soft key light
// with shadows, a cool rim light, contact shadows under the model and subtle post-processing (N8AO ambient
// occlusion, bloom only on emissive LEDs and screens, SMAA). No runtime network calls.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

export const STUDIO_HDRI = "/hdri/studio_small_09_1k.hdr";

/** Canvas props every product view uses. Tone mapping happens in the post stack (ToneMapping effect). */
export const STUDIO_GL: Partial<THREE.WebGLRendererParameters> & { toneMapping: THREE.ToneMapping; outputColorSpace: THREE.ColorSpace } = {
  antialias: false,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
  toneMapping: THREE.ACESFilmicToneMapping,
  outputColorSpace: THREE.SRGBColorSpace,
};
export const STUDIO_DPR: [number, number] = [1, 2];

interface StudioProps {
  /** Y of the ground plane for contact shadows. */
  floor?: number;
  /** Size of the contact shadow plane. */
  shadowScale?: number;
  /** Reflection strength of the HDRI. */
  envIntensity?: number;
  /** Key light strength. */
  key?: number;
  /** Post-processing (AO, bloom, SMAA). Off for tiny previews. */
  effects?: boolean;
  /** AO radius in world units (scene scale differs per view). */
  aoRadius?: number;
  /** Exposure is applied by the renderer before the ACES curve. */
  exposure?: number;
}

export function Studio({ floor = -0.85, shadowScale = 6, envIntensity = 0.85, key = 2.2, effects = true, aoRadius = 0.5, exposure = 1 }: StudioProps) {
  return (
    <>
      <Exposure value={exposure} />
      <ShadowCasters />
      <Environment files={STUDIO_HDRI} environmentIntensity={envIntensity} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={20}
      />
      {/* Cool rim from behind-left keeps silhouettes off the dark page; a hint of the brand violet. */}
      <directionalLight position={[-5, 3, -4]} intensity={key * 0.35} color="#a9b4ff" />
      <ContactShadows position={[0, floor, 0]} opacity={0.6} scale={shadowScale} blur={2.4} far={Math.max(2, shadowScale / 2)} resolution={1024} color="#000000" />
      {effects && (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={aoRadius} distanceFalloff={1} intensity={1.6} quality="medium" halfRes />
          <Bloom luminanceThreshold={2.2} luminanceSmoothing={0.1} intensity={0.6} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

function Exposure({ value }: { value: number }) {
  useFrame(({ gl }) => {
    if (gl.toneMappingExposure !== value) gl.toneMappingExposure = value;
  });
  return null;
}

/** Every opaque mesh casts and receives the key light's shadow (checked about once a second as models stream in). */
function ShadowCasters() {
  const scene = useThree((s) => s.scene);
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ % 60 !== 0) return;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.shadowSet) return;
      const mat = m.material as THREE.Material;
      const clear = mat && (mat.transparent || (mat as THREE.MeshPhysicalMaterial).transmission > 0);
      m.castShadow = !clear;
      m.receiveShadow = true;
      m.userData.shadowSet = true;
    });
  });
  return null;
}
