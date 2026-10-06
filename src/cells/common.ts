// Small builders shared by the cell types.

import { Mat, Prim, type Anatomy, type BodyPart, type Material, type Primitive, type TubeMotion, type Vec3 } from '../contracts';
import { bodyBounds, cellSdf, materialAt, primSdf } from '../anatomy/sdf';

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

/** The middle of a bowl: the point of its sheet on its axis. */
export function bowlMid(p: Primitive): Vec3 {
  const u = norm3(p.b);
  return [p.a[0] + u[0] * p.R, p.a[1] + u[1] * p.R, p.a[2] + u[2] * p.R];
}

/** One curved sheet (see Prim.Bowl) of the given width, measured across its rim. */
export function bowl(centre: Vec3, axis: Vec3, R: number, width: number, halfThickness: number, material: Material): Primitive {
  const u = norm3(axis), s = Math.min(0.999, width / 2 / R);
  return { kind: Prim.Bowl, material, a: centre, b: [u[0] * s, u[1] * s, u[2] * s], R, r: halfThickness };
}

/**
 * A Golgi ribbon as electron tomography shows it in mammalian cells: stacks of curved, flattened
 * cisternae standing side by side, joined at each level into one ribbon-like organelle (Ladinsky
 * et al. 1999, J Cell Biol 144:1135; Marsh et al. 2001, PNAS 98:2399).
 *
 * Every cisterna is part of a sphere about `centre`, so each stack is cupped and the ribbon as a
 * whole curls around that point. The stacks stand along an arc in the plane normal to `normal`,
 * centred on the direction `toward`; neighbours overlap a little at every level, which stands
 * for the bridges that join cisternae of equal rank. Level 0 is the innermost (the hollow, trans
 * side in the micrograph on the label card); the last is the cis face.
 */
export function golgiRibbon(centre: Vec3, toward: Vec3, normal: Vec3, o: { inner: number; spacing: number; halfThickness: number; width: number; stacks: number; levels?: number }): Primitive[] {
  const levels = o.levels ?? 7, n = norm3(normal);
  // `toward` made perpendicular to the normal, and the third axis of the arc's plane
  const dot = toward[0] * n[0] + toward[1] * n[1] + toward[2] * n[2];
  const e1 = norm3([toward[0] - dot * n[0], toward[1] - dot * n[1], toward[2] - dot * n[2]]);
  const e2: Vec3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const outer = o.inner + (levels - 1) * o.spacing;
  // neighbours overlap even at the outermost level, where a cisterna of this width spans the smallest angle
  const step = 2 * Math.asin(Math.min(0.999, o.width / 2 / outer)) * 0.92;
  const out: Primitive[] = [];
  for (let k = 0; k < o.stacks; k++) {
    const t = (k - (o.stacks - 1) / 2) * step, c = Math.cos(t), s = Math.sin(t);
    const axis: Vec3 = [e1[0] * c + e2[0] * s, e1[1] * c + e2[1] * s, e1[2] * c + e2[2] * s];
    for (let i = 0; i < levels; i++) out.push(bowl(centre, axis, o.inner + i * o.spacing, o.width, o.halfThickness, Mat.Golgi));
  }
  return out;
}

/**
 * A test for free cytoplasm: `free(margin)(p)` is true where p lies at least `margin` inside the
 * wall (or membrane) and at least `margin` clear of every organelle placed so far.
 */
export function freeCytoplasm(an: Anatomy, organelles: Primitive[] = an.organelles): (margin: number) => (p: Vec3) => boolean {
  return (margin) => (p) => cellSdf(an, p[0], p[1], p[2]) < -(an.wallThickness + margin) && organelles.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
}

/** A straight line of points from `from` along `dir`, `step` apart, for as long as `ok` holds (at most `maxLength`). */
export function ray(from: Vec3, dir: Vec3, maxLength: number, step: number, ok: (p: Vec3) => boolean): Vec3[] {
  const d = norm3(dir), pts: Vec3[] = [from];
  for (let s = step; s <= maxLength + 1e-9; s += step) {
    const p: Vec3 = [from[0] + d[0] * s, from[1] + d[1] * s, from[2] + d[2] * s];
    if (!ok(p)) break;
    pts.push(p);
  }
  return pts;
}

/** The first of `candidates` that lies in `material` (labels must point at what they name); the first of all if none does. */
export function anchorIn(an: Anatomy, candidates: Vec3[], material: Material): Vec3 {
  return candidates.find((p) => materialAt(an, p[0], p[1], p[2]) === material) ?? candidates[0];
}
