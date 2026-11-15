"use client";

// Realistic 3D hand for the Home "Drive it with your hands" slide. The mesh is the WebXR generic hand
// (public/models/hand/right.glb, MIT, @webxr-input-profiles/assets). Its 25 joints are siblings under the
// armature (WebXR style), so posing runs our own forward kinematics down each finger chain.
// WebXR joint space: -Z points along the bone towards the tip, +Y out of the back of the hand, so
// flexion is a rotation about local X and spreading is a rotation about local Y.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Studio, STUDIO_DPR, STUDIO_GL } from "@/components/three/Studio";
import * as THREE from "three";
import { Group } from "@/lib/three/Group";
import { MiniDrone } from "@/components/device3d/DroneModel";
import { latestHands } from "@/lib/input/camera";
import { useInput } from "@/stores/input";

export type HandGesture = "pinch" | "spread" | "fist" | "swipe" | "twist";

const FINGERS = ["thumb", "index-finger", "middle-finger", "ring-finger", "pinky-finger"] as const;
const SEGS: Record<(typeof FINGERS)[number], string[]> = {
  thumb: ["metacarpal", "phalanx-proximal", "phalanx-distal", "tip"],
  "index-finger": ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"],
  "middle-finger": ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"],
  "ring-finger": ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"],
  "pinky-finger": ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"],
};

/** Per finger: [spread, flex at each joint except the tip]. Thumb: [spread, cmc flex, mcp flex, ip flex]. */
type Pose = number[][];
const OPEN: Pose = [
  [0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
const POSES: Record<HandGesture | "open", Pose> = {
  open: OPEN,
  spread: [
    [-0.35, -0.1, 0, 0],
    [-0.22, 0, -0.08, 0, 0],
    [-0.04, 0, -0.08, 0, 0],
    [0.14, 0, -0.08, 0, 0],
    [0.32, 0.05, -0.08, 0, 0],
  ],
  fist: [
    [0.35, 0.35, 0.55, 0.7],
    [0.06, 0.1, 1.45, 1.65, 0.95],
    [0, 0.08, 1.5, 1.7, 0.95],
    [-0.05, 0.1, 1.5, 1.7, 0.95],
    [-0.1, 0.16, 1.45, 1.65, 0.95],
  ],
  pinch: [
    [0.38, 0.32, 0.25, 0.25],
    [0.04, 0.05, 0.62, 0.72, 0.42],
    [0, 0, 0.12, 0.15, 0.08],
    [0.04, 0, 0.16, 0.2, 0.1],
    [0.1, 0.05, 0.2, 0.25, 0.12],
  ],
  swipe: [
    [-0.1, 0, 0, 0],
    [-0.05, 0, 0.05, 0.05, 0],
    [0, 0, 0.05, 0.05, 0],
    [0.04, 0, 0.05, 0.05, 0],
    [0.08, 0, 0.05, 0.05, 0],
  ],
  twist: [
    [0.35, 0.35, 0.55, 0.7],
    [0.06, 0.1, 1.2, 1.5, 0.9],
    [0, 0.08, 1.3, 1.55, 0.9],
    [-0.05, 0.1, 1.35, 1.6, 0.9],
    [-0.1, 0.16, 1.35, 1.55, 0.9],
  ],
};

const STAND_UP = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)));

const clonePose = (p: Pose): Pose => p.map((f) => [...f]);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Flex angles from live MediaPipe landmarks (angle between consecutive bone directions). */
function poseFromLandmarks(lm: { x: number; y: number; z?: number }[]): Pose {
  const v = (i: number) => new THREE.Vector3(lm[i].x, lm[i].y, lm[i].z ?? 0);
  const bend = (a: number, b: number, c: number) => {
    const d1 = v(b).sub(v(a)).normalize();
    const d2 = v(c).sub(v(b)).normalize();
    return Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
  };
  const chains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [0, 9, 10, 11, 12],
    [0, 13, 14, 15, 16],
    [0, 17, 18, 19, 20],
  ];
  return chains.map((c, f) => {
    const flex = [bend(c[0], c[1], c[2]), bend(c[1], c[2], c[3]), bend(c[2], c[3], c[4])];
    return f === 0 ? [0.2, flex[0] * 0.6, flex[1], flex[2]] : [POSES.open[f][0], 0, flex[0], flex[1], flex[2]];
  });
}

function skinMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#c98f72",
    roughness: 0.52,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color("#ffb59a"),
    clearcoat: 0.12,
    clearcoatRoughness: 0.6,
    // A faint warm self-glow in the shadows reads as light scattering under the skin.
    emissive: new THREE.Color("#5a1e12"),
    emissiveIntensity: 0.16,
  });
}

function Hand({ gesture, startedAt }: { gesture: HandGesture; startedAt: number }) {
  const { scene } = useGLTF("/models/hand/right.glb");
  const root = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const skin = useMemo(() => skinMaterial(), []);

  const rig = useMemo(() => {
    const bones: Record<string, THREE.Object3D> = {};
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone || o.name) bones[o.name] = o;
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.material = skin;
        m.castShadow = true;
        m.frustumCulled = false;
        m.geometry.computeVertexNormals();
      }
    });
    const rest: Record<string, THREE.Matrix4> = {};
    for (const [name, b] of Object.entries(bones)) rest[name] = new THREE.Matrix4().compose(b.position.clone(), b.quaternion.clone(), b.scale.clone());
    return { bones, rest };
  }, [scene, skin]);

  const current = useRef<Pose>(clonePose(POSES.open));
  const from = useRef<Pose>(clonePose(POSES.open));
  const tweenStart = useRef(0);
  const lastKey = useRef<string | null>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), r: new THREE.Matrix4(), rel: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // A click on the same row replays it (startedAt changes).
    const key = `${gesture}:${startedAt}`;
    if (lastKey.current !== key) {
      from.current = clonePose(current.current);
      tweenStart.current = t;
      lastKey.current = key;
    }
    // Live webcam landmarks win when the camera is on and a hand is in view.
    const live = useInput.getState().camera === "on" ? latestHands().hands[0] : undefined;
    const target = live ? poseFromLandmarks(live) : POSES[gesture];
    const k = live ? 0.35 : ease(Math.min(1, (t - tweenStart.current) / 0.4));
    for (let f = 0; f < 5; f++)
      for (let j = 0; j < target[f].length; j++)
        current.current[f][j] = live ? current.current[f][j] + (target[f][j] - current.current[f][j]) * k : from.current[f][j] + (target[f][j] - from.current[f][j]) * k;

    // Forward kinematics per finger chain, starting from the rest pose of the metacarpal.
    const { bones, rest } = rig;
    FINGERS.forEach((finger, f) => {
      const names = SEGS[finger].map((s) => `${finger}-${s}`);
      const p = current.current[f];
      let parentPosed: THREE.Matrix4 | null = null;
      names.forEach((name, i) => {
        const bone = bones[name];
        if (!bone) return;
        const posed = new THREE.Matrix4();
        if (!parentPosed) posed.copy(rest[name]);
        else {
          tmp.rel.copy(rest[names[i - 1]]).invert().multiply(rest[name]);
          posed.copy(parentPosed).multiply(tmp.rel);
        }
        if (i < names.length - 1) {
          // joint i rotates its own bone: index 0 of the pose is spread (applied at the proximal joint for fingers,
          // at the metacarpal for the thumb), then one flex value per joint.
          const flex = -(p[i + 1] ?? 0);
          const spread = (finger === "thumb" ? i === 0 : i === 1) ? -p[0] : 0;
          tmp.e.set(flex, spread, 0, "YXZ");
          posed.multiply(tmp.r.makeRotationFromEuler(tmp.e));
        }
        posed.decompose(bone.position, bone.quaternion, bone.scale);
        parentPosed = posed;
      });
    });

    // Whole-hand motion: swipe sweeps side to side, twist turns the fist (and the drone it holds).
    const g = root.current;
    if (g) {
      const tt = t - tweenStart.current;
      const swipeX = gesture === "swipe" && !live ? Math.sin(tt * 3.2) * 0.05 : 0;
      const swipeRot = gesture === "swipe" && !live ? Math.sin(tt * 3.2) * 0.28 : 0;
      const twist = gesture === "twist" && !live ? Math.sin(tt * 1.6) * 0.9 : 0;
      g.position.x += (swipeX - g.position.x) * 0.2;
      g.rotation.z += (swipeRot + twist - g.rotation.z) * 0.15;
    }
    if (prop.current) {
      const show = gesture === "twist" && !live ? 1 : 0;
      const s = THREE.MathUtils.lerp(prop.current.scale.x, show * 0.24, 0.15);
      prop.current.scale.setScalar(Math.max(0.0001, s));
      prop.current.visible = s > 0.002;
    }
  });

  return (
    <Group ref={root}>
      {/* The glTF hand points its fingers down -Y with the thumb towards -Z; stand it up (fingers +Y,
          thumb to the viewer's left), scale the ~18 cm hand to scene units and centre it. */}
      <Group rotation={[0.12, 0.6, 0]}>
        <Group scale={7} quaternion={STAND_UP} position={[0, -0.28, -0.1]}>
          <primitive object={scene} />
        </Group>
      </Group>
      <Group ref={prop} position={[0, 0.42, 0.25]} rotation={[0.55, 0, 0]}>
        <MiniDrone spin={6} />
      </Group>
    </Group>
  );
}

useGLTF.preload("/models/hand/right.glb");

export default function HandRig({ gesture, startedAt }: { gesture: HandGesture; startedAt: number }) {
  useEffect(() => () => useGLTF.clear("/models/hand/right.glb"), []);
  return (
    <Canvas shadows camera={{ position: [0, 0.2, 3.2], fov: 30 }} dpr={STUDIO_DPR} gl={STUDIO_GL}>
      <Studio floor={-0.95} shadowScale={5} aoRadius={0.25} />
      <Suspense fallback={null}>
        <Hand gesture={gesture} startedAt={startedAt} />
      </Suspense>
    </Canvas>
  );
}
