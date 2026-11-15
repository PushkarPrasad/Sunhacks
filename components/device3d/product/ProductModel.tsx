"use client";

// Shared scene for the V3 hyper-real product models (cube, rover, arm, phone, laptop, ...). A model is a
// ProductDef: a parts list (names, specs, explode offsets) plus a Body component that wraps each part's meshes in
// <Part id>. This file owns everything else so every model behaves like the drone: spring explode along assembly
// axes, Solid / Transparent / X-ray shell modes, hover tint, click to inspect, glove globe-grab, studio lighting.

import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Group } from "@/lib/three/Group";
import { onInput } from "@/lib/input/bus";
import { useModelPose } from "@/stores/modelPose";
import { Studio, STUDIO_DPR, STUDIO_GL } from "@/components/three/Studio";

export type Shell = "solid" | "transparent" | "xray";

export interface ProductPart {
  id: string;
  name: string;
  role: string;
  specs: [string, string][];
  maker: string;
  /** Exploded offset (scene units) and the order it leaves in (0 first). */
  explode: [number, number, number];
  layer: number;
  /** Where the label line attaches, relative to the part's rest position. */
  anchor: [number, number, number];
  /** Outer shell: goes see-through in Transparent and wireframe in X-ray. */
  shell?: boolean;
}

export interface ProductDef {
  id: string;
  name: string;
  parts: ProductPart[];
  Body: () => ReactNode;
  camera: [number, number, number];
  /** Y of the floor for contact shadows (scene units). */
  floor: number;
  shadowScale?: number;
  aoRadius?: number;
  /** Tone-mapping exposure for this scene (dark products need a little more). */
  exposure?: number;
  /** Offset applied to the whole model so it sits centred. */
  offset?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  fov?: number;
}

const PartCtx = createContext<{ register: (id: string, g: THREE.Group | null) => void; handlers: (id: string) => object } | null>(null);
const AmountCtx = createContext<React.RefObject<number> | null>(null);

/** A sub-assembly that explodes along its own axis (e.g. each face plate along its normal), on top of its Part. */
export function Ex({ v, delay = 0, children }: { v: [number, number, number]; delay?: number; children: ReactNode }) {
  const amount = useContext(AmountCtx);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current || !amount) return;
    const local = THREE.MathUtils.clamp((amount.current ?? 0) * 1.35 - delay * 0.04, 0, 1);
    const e = local * local * (3 - 2 * local);
    g.current.position.set(v[0] * e, v[1] * e, v[2] * e);
  });
  return <Group ref={g}>{children}</Group>;
}

/** Wrap the meshes of one part. Explode, hover and shell modes act on this group. */
export function Part({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(PartCtx)!;
  return (
    <Group ref={(g: THREE.Group | null) => ctx.register(id, g)} {...ctx.handlers(id)}>
      {children}
    </Group>
  );
}

interface SceneProps {
  def: ProductDef;
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

function Scene({ def, explode, shell, hovered, selected, onHover, onSelect, onAnchor, autoRotate, enableZoom = true }: SceneProps) {
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const amount = useRef(explode);
  const vel = useRef(0);
  const root = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const [, setTick] = useState(0);
  const byId = useMemo(() => Object.fromEntries(def.parts.map((p) => [p.id, p])), [def]);

  // Per-mesh material clones (once) so hover, X-ray and the shell modes never touch the shared library.
  useEffect(() => {
    const id = setTimeout(() => setTick((t) => t + 1), 50);
    return () => clearTimeout(id);
  }, []);
  useFrame(() => {
    for (const [pid, g] of Object.entries(groups.current)) {
      g?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.cloned) return;
        const src = mesh.material as THREE.MeshPhysicalMaterial;
        const m = src.clone();
        if (!m.userData.glow && "emissiveIntensity" in m) m.emissiveIntensity = 0;
        m.userData.base = { opacity: m.opacity, transparent: m.transparent, transmission: m.transmission ?? 0, roughness: m.roughness, depthWrite: m.depthWrite };
        mesh.material = m;
        mesh.userData.cloned = true;
        mesh.userData.part = pid;
        mesh.userData.shellApplied = null;
      });
    }
  });

  useFrame((_, dt) => {
    // Critically damped spring towards the target explode amount.
    const k = 70;
    const c = 2 * Math.sqrt(k);
    const a = k * (explode - amount.current) - c * vel.current;
    const step = Math.min(dt, 0.05);
    vel.current += a * step;
    amount.current += vel.current * step;
    const t = amount.current;

    for (const p of def.parts) {
      const g = groups.current[p.id];
      if (!g) continue;
      const local = THREE.MathUtils.clamp(t * 1.35 - p.layer * 0.04, 0, 1);
      const e = local * local * (3 - 2 * local);
      g.position.set(p.explode[0] * e, p.explode[1] * e, p.explode[2] * e);
      const hot = hovered === p.id || selected === p.id;
      const xray = shell === "xray" && !p.shell;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.MeshPhysicalMaterial | undefined;
        if (!mesh.isMesh || !mat || !mesh.userData.cloned) return;
        // Shell modes
        if (p.shell && mesh.userData.shellApplied !== shell) {
          const base = mat.userData.base;
          mat.wireframe = shell === "xray";
          mat.transparent = shell !== "solid" || base.transparent;
          mat.opacity = shell === "xray" ? 0.12 : shell === "transparent" ? 0.22 : base.opacity;
          mat.depthWrite = shell === "solid" ? base.depthWrite : false;
          mesh.castShadow = shell === "solid";
          mat.needsUpdate = true;
          mesh.userData.shellApplied = shell;
        }
        // LEDs and screens keep their own glow.
        if (!("emissive" in mat) || mat.userData.glow) return;
        const target = hot ? 0.35 : xray ? 0.12 : 0;
        if (hot || xray || mat.emissiveIntensity > 0.001) {
          mat.emissive.set(hot ? "#7c5cff" : "#a5b4fc");
          mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.2;
        }
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
      const p = id ? byId[id] : undefined;
      const g = p && groups.current[p.id];
      if (p && g) {
        v.set(...p.anchor);
        g.localToWorld(v);
        v.project(camera);
        onAnchor({ id: p.id, x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
      } else onAnchor(null);
    }
  });

  // Test hook for screenshots: window.dispatchEvent(new CustomEvent("ms-camera", { detail: [x, y, z] })).
  useEffect(() => {
    const onCam = (e: Event) => {
      const p = (e as CustomEvent<[number, number, number]>).detail;
      camera.position.set(...p);
      controls.current?.update();
    };
    window.addEventListener("ms-camera", onCam);
    return () => window.removeEventListener("ms-camera", onCam);
  }, [camera]);

  useEffect(() => {
    const zoom = (f: number) => {
      const c = controls.current;
      if (!c) return;
      const dir = c.object.position.clone().sub(c.target);
      c.object.position.copy(c.target.clone().add(dir.setLength(THREE.MathUtils.clamp(dir.length() * f, def.minDistance ?? 2, def.maxDistance ?? 12))));
      c.update();
    };
    const offs = [onInput("zoomIn", (e) => (zoom(e.value ?? 0.85), true)), onInput("zoomOut", (e) => (zoom(e.value ?? 1.18), true))];
    return () => offs.forEach((f) => f());
  }, [def]);

  const ctx = useMemo(
    () => ({
      register: (id: string, g: THREE.Group | null) => {
        groups.current[id] = g;
      },
      handlers: (id: string) => ({
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(id);
        },
        onPointerOut: () => onHover(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(id);
        },
      }),
    }),
    [onHover, onSelect],
  );

  const Body = def.Body;
  return (
    <>
      <Studio floor={def.floor} shadowScale={def.shadowScale ?? 6} aoRadius={def.aoRadius ?? 0.35} exposure={def.exposure ?? 1} />
      <Group ref={root} position={def.offset ?? [0, 0, 0]}>
        <PartCtx.Provider value={ctx}>
          <AmountCtx.Provider value={amount}>
            <Suspense fallback={null}>
              <Body />
            </Suspense>
          </AmountCtx.Provider>
        </PartCtx.Provider>
      </Group>
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={def.minDistance ?? 2}
        maxDistance={def.maxDistance ?? 12}
        maxPolarAngle={Math.PI / 1.9}
        enableZoom={enableZoom}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

export interface ProductModelProps {
  def: ProductDef;
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

const noop = () => {};

export default function ProductModel({ def, explode, shell = "solid", hovered = null, selected = null, onHover = noop, onSelect = noop, onAnchor, autoRotate, enableZoom, camera }: ProductModelProps) {
  const [ready, setReady] = useState(false);
  return (
    <div className={`h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} data-model={def.id}>
      <Canvas camera={{ position: camera ?? def.camera, fov: def.fov ?? 30 }} dpr={STUDIO_DPR} shadows gl={STUDIO_GL} onCreated={() => setReady(true)} onPointerMissed={() => onSelect(null)}>
        <Scene def={def} explode={explode} shell={shell} hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} onAnchor={onAnchor} autoRotate={autoRotate} enableZoom={enableZoom} />
      </Canvas>
    </div>
  );
}
