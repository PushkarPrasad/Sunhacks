"use client";

// Geometry helpers for the hyper-real models: nothing ships as a raw box or cylinder. Plates are extruded with a
// bevel, round parts are lathed with fillets, cables are tubes along sagging curves, screws are instanced.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAT } from "./materials";

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function circlePath(r: number, cx = 0, cy = 0, segments = 48): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  p.closePath();
  void segments;
  return p;
}

/**
 * A plate in the XY plane, `t` thick along +Z (centred), with rounded corners, optional holes and a small bevel.
 * Rotate it into place. Holes: [x, y, r] or rounded-rect holes [x, y, w, h, r].
 */
export function plate(w: number, h: number, t: number, opts: { r?: number; bevel?: number; holes?: number[][]; curveSegments?: number } = {}): THREE.BufferGeometry {
  const bevel = opts.bevel ?? Math.min(t * 0.25, 0.01);
  const shape = roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(0.001, (opts.r ?? 0.02) - bevel));
  for (const hole of opts.holes ?? []) {
    if (hole.length === 3) shape.holes.push(circlePath(hole[2] + bevel, hole[0], hole[1]));
    else {
      const hs = roundedRectShape(hole[2] + bevel * 2, hole[3] + bevel * 2, hole[4] ?? 0.01, hole[0], hole[1]);
      shape.holes.push(new THREE.Path(hs.getPoints(8).reverse()));
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, t - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: opts.curveSegments ?? 24,
  });
  g.translate(0, 0, -(t - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Rounded block (all edges filleted) via an extruded rounded rectangle with a round bevel. Size w x h x d, centred. */
export function block(w: number, h: number, d: number, r = 0.01): THREE.BufferGeometry {
  const b = Math.min(r, d / 2 - 0.0005, w / 2 - 0.0005, h / 2 - 0.0005);
  const shape = roundedRectShape(w - b * 2, h - b * 2, Math.max(0.0005, r - b * 0.5));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0005, d - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(d - b * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Lathe around +Y from a profile of [radius, y] points. */
export function lathe(profile: [number, number][], segments = 48): THREE.LatheGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  g.computeVertexNormals();
  return g;
}

/** A filleted cylinder (disc/can) as a lathe: radius r, height h, edge fillet f, centred on y = 0. */
export function roundCyl(r: number, h: number, f = 0.004, segments = 48): THREE.LatheGeometry {
  f = Math.min(f, r / 2, h / 2);
  const pts: [number, number][] = [[0, -h / 2]];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4;
      pts.push([cx + Math.cos(a) * f, cy + Math.sin(a) * f]);
    }
  };
  arc(r - f, -h / 2 + f, -Math.PI / 2, 0);
  arc(r - f, h / 2 - f, 0, Math.PI / 2);
  pts.push([0, h / 2]);
  return lathe(pts, segments);
}

/** Cable from a to b that sags under gravity (catenary-ish), as a tube. */
export function sagCable(a: [number, number, number], b: [number, number, number], sag: number, radius: number, via: [number, number, number][] = []): THREE.TubeGeometry {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const pts = [A, ...via.map((p) => new THREE.Vector3(...p))];
  if (!via.length) {
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const p = A.clone().lerp(B, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
  }
  pts.push(B);
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  return new THREE.TubeGeometry(curve, 48, radius, 8, false);
}

/** Several parallel wires along one path (ribbon of round conductors), merged into one geometry. */
export function wireBundle(path: [number, number, number][], count: number, radius: number, spacing: number, sideAxis: [number, number, number] = [1, 0, 0]): THREE.BufferGeometry {
  const side = new THREE.Vector3(...sideAxis).normalize();
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const off = side.clone().multiplyScalar((i - (count - 1) / 2) * spacing);
    const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p).add(off)), false, "centripetal");
    gs.push(new THREE.TubeGeometry(curve, 40, radius, 6, false));
  }
  return mergeGeometries(gs)!;
}

/** Socket-head cap screw pointing along +Y (head on top). Diameter d (head ~1.6 d). */
export function capScrewGeometry(d = 0.03): THREE.BufferGeometry {
  const hr = d * 0.8;
  const hh = d * 0.95;
  const head = lathe(
    [
      [0, hh * 0.55],
      [hr * 0.42, hh * 0.55],
      [hr * 0.42, hh * 0.98],
      [hr * 0.9, hh],
      [hr, hh * 0.9],
      [hr, hh * 0.1],
      [hr * 0.95, 0],
      [0, 0],
    ],
    24,
  );
  return head;
}

/** Instanced screws: one draw call for every screw in a model. */
export function Screws({ at, d = 0.03, mat = "steel" }: { at: { p: [number, number, number]; n: [number, number, number] }[]; d?: number; mat?: "steel" | "blackSteel" | "brass" }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => capScrewGeometry(d), [d]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const o = new THREE.Object3D();
    at.forEach((s, i) => {
      q.setFromUnitVectors(up, new THREE.Vector3(...s.n).normalize());
      o.position.set(...s.p);
      o.quaternion.copy(q);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [at]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return <instancedMesh ref={ref} args={[geo, MAT[mat](), at.length]} />;
}

/** Instanced copies of any geometry at positions/rotations. */
export function Instances({ geo, mat, at }: { geo: THREE.BufferGeometry; mat: THREE.Material; at: { p: [number, number, number]; r?: [number, number, number]; s?: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    at.forEach((x, i) => {
      o.position.set(...x.p);
      o.rotation.set(...(x.r ?? [0, 0, 0]));
      o.scale.setScalar(x.s ?? 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [at]);
  return <instancedMesh ref={ref} args={[geo, mat, at.length]} />;
}

/** Dispose a set of geometries when the component unmounts. */
export function useDispose(geos: THREE.BufferGeometry[]) {
  useLayoutEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
}
