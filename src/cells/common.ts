// Small builders shared by the cell types.

import { Mat, Prim, type Anatomy, type BodyPart, type Material, type Primitive, type TubeMotion, type Vec3 } from '../contracts';
import { bodyBounds } from '../anatomy/sdf';

export const ell = (a: Vec3, b: Vec3, material: Material = Mat.Cytoplasm): Primitive => ({ kind: Prim.Ellipsoid, material, a, b, R: 0, r: 0 });
export const cone = (a: Vec3, b: Vec3, R: number, r: number, material: Material = Mat.Cytoplasm): Primitive => ({ kind: Prim.Cone, material, a, b, R, r });
export const torus = (a: Vec3, axis: Vec3, R: number, r: number, material: Material = Mat.Cytoplasm): Primitive => ({ kind: Prim.Torus, material, a, b: axis, R, r });
export const union = (prim: Primitive, blend = 0): BodyPart => ({ prim, op: 'union', blend });
export const subtract = (prim: Primitive, blend = 0): BodyPart => ({ prim, op: 'subtract', blend });

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const norm3 = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Fills in the derived fields of an anatomy. */
export function finish(an: Omit<Anatomy, 'bounds'>): Anatomy {
  return { ...an, bounds: bodyBounds(an.body) };
}

/** A tubule (mitochondrion, fibre…): its capsules go into `organelles`, its polyline into `tubules`. */
export function addTubule(an: Pick<Anatomy, 'organelles' | 'tubules'>, points: Vec3[], radius: number, material: Material, motion?: TubeMotion) {
  if (points.length < 2) return;
  an.tubules.push(motion ? { points, radius, material, motion } : { points, radius, material });
  for (let k = 0; k + 1 < points.length; k++) an.organelles.push({ kind: Prim.Capsule, material, a: points[k], b: points[k + 1], R: 0, r: radius });
}

/**
 * A random walk that only takes steps accepted by `ok`, turning to find a way
 * when it meets an obstacle and stopping when it cannot.
 */
export function wander(rand: () => number, start: Vec3, dir: Vec3, steps: number, step: number, ok: (p: Vec3) => boolean, flat = false): Vec3[] {
  const pts: Vec3[] = [start];
  let d = norm3(dir);
  for (let i = 0; i < steps; i++) {
    let moved = false;
    for (let attempt = 0; attempt < 8 && !moved; attempt++) {
      const spread = 0.5 + attempt * 0.4;
      let nd = norm3([d[0] + (rand() - 0.5) * spread, flat ? 0 : d[1] + (rand() - 0.5) * spread, d[2] + (rand() - 0.5) * spread]);
      if (flat) nd = norm3([nd[0], 0, nd[2]]);
      const next = add3(pts[pts.length - 1], scale3(nd, step));
      if (ok(next)) { pts.push(next); d = nd; moved = true; }
    }
    if (!moved) break;
  }
  return pts;
}

/** A random point inside a box that satisfies `ok` (or null after many tries). */
export function samplePoint(rand: () => number, lo: Vec3, hi: Vec3, ok: (p: Vec3) => boolean): Vec3 | null {
  for (let i = 0; i < 400; i++) {
    const p: Vec3 = [lo[0] + rand() * (hi[0] - lo[0]), lo[1] + rand() * (hi[1] - lo[1]), lo[2] + rand() * (hi[2] - lo[2])];
    if (ok(p)) return p;
  }
  return null;
}
