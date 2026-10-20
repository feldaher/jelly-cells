// Analytic rest-space meshes of the organelles: ellipsoids, rings, septum discs and
// smooth tubes. They are embedded into each piece like the melon's seeds.

import { Mat, Prim, type Anatomy, type Material, type Vec3 } from '../contracts';
import type { RestMesh } from './surface';

export interface OrganelleTemplate {
  material: Material;
  mesh: RestMesh;
}

/** Added to the whole part of a vertex coordinate when the organelle moves (a tubule with a `motion`). */
export const COORD_MOVING = 128;
/** The fraction of a vertex coordinate is the distance along the tube divided by this (sim units). */
export const COORD_SPAN = 32;

function finish(pos: number[], idx: number[]): RestMesh {
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), isCutFace: new Uint8Array(pos.length / 3) };
}

export function ellipsoidMesh(c: Vec3, r: Vec3, seg = 28, rings = 18): RestMesh {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const th = (Math.PI * i) / rings;
    for (let j = 0; j <= seg; j++) {
      const ph = (2 * Math.PI * j) / seg;
      pos.push(c[0] + r[0] * Math.cos(th), c[1] + r[1] * Math.sin(th) * Math.cos(ph), c[2] + r[2] * Math.sin(th) * Math.sin(ph));
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return finish(pos, idx);
}

function basis(n: Vec3): [Vec3, Vec3] {
  const t: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(n, t));
  return [u, cross(n, u)];
}

export function torusMesh(c: Vec3, axis: Vec3, R: number, r: number, seg = 48, sides = 12): RestMesh {
  const [u, v] = basis(axis);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg;
    const dir = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
    for (let j = 0; j <= sides; j++) {
      const b = (2 * Math.PI * j) / sides;
      const p = add(c, add(scale(dir, R + r * Math.cos(b)), scale(axis, r * Math.sin(b))));
      pos.push(...p);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, idx);
}

/** A flat washer (or a full disc when rIn = 0) about `axis`, with square edges. */
export function discMesh(c: Vec3, axis: Vec3, halfThickness: number, rOut: number, rIn: number, seg = 48): RestMesh {
  const [u, v] = basis(axis);
  const pos: number[] = [], idx: number[] = [];
  // the section of the washer, walked once around: outer bottom → outer top → inner top → inner bottom
  const section: [number, number][] = rIn > 1e-4
    ? [[rOut, -halfThickness], [rOut, halfThickness], [rIn, halfThickness], [rIn, -halfThickness], [rOut, -halfThickness]]
    : [[0, -halfThickness], [rOut, -halfThickness], [rOut, halfThickness], [0, halfThickness]];
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg;
    const dir = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
    for (const [r, h] of section) pos.push(...add(c, add(scale(dir, r), scale(axis, h))));
  }
  const n = section.length;
  for (let i = 0; i < seg; i++) for (let j = 0; j + 1 < n; j++) {
    const a = i * n + j, b = a + n;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, idx);
}

/**
 * A curved sheet: the part of a spherical shell of radius R about `c` within the angle whose sine
 * is `sinHalf` of `axis`, 2·halfThickness thick, with a rounded rim.
 */
export function bowlMesh(c: Vec3, axis: Vec3, sinHalf: number, R: number, halfThickness: number, seg = 24, rings = 8): RestMesh {
  const [u, v] = basis(axis);
  const alpha = Math.asin(Math.min(1, sinHalf)), t = halfThickness;
  // the section in the (radial, axial) plane, walked once around: outer face from the pole to the
  // rim, half a turn around the rim, inner face back to the pole
  const section: [number, number][] = [];
  for (let i = 0; i <= rings; i++) { const a = (alpha * i) / rings; section.push([(R + t) * Math.sin(a), (R + t) * Math.cos(a)]); }
  for (let i = 1; i < 4; i++) { const b = (Math.PI * i) / 4; section.push([R * Math.sin(alpha) + t * Math.sin(alpha + b), R * Math.cos(alpha) + t * Math.cos(alpha + b)]); }
  for (let i = rings; i >= 0; i--) { const a = (alpha * i) / rings; section.push([(R - t) * Math.sin(a), (R - t) * Math.cos(a)]); }
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (2 * Math.PI * i) / seg;
    const dir = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
    for (const [r, h] of section) pos.push(...add(c, add(scale(dir, r), scale(axis, h))));
  }
  const n = section.length;
  for (let i = 0; i < seg; i++) for (let j = 0; j + 1 < n; j++) {
    const a = i * n + j, b = a + n;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, idx);
}

/** A smooth tube along a Catmull–Rom curve through `pts`, with rounded caps. */
export function tubeMesh(pts: Vec3[], radius: number, sides = 8, sub = 4): RestMesh {
  // Resample the curve.
  const curve: Vec3[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < sub; s++) {
      const t = s / sub, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const t2 = t * t, t3 = t2 * t;
      curve.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as Vec3);
    }
  }
  curve.push(pts[pts.length - 1]);

  // Rings along the curve with parallel-transported frames; caps shrink to the tips.
  const tangents = curve.map((_, i) => norm(sub3(curve[Math.min(i + 1, curve.length - 1)], curve[Math.max(i - 1, 0)])));
  let [u] = basis(tangents[0]);
  const rings: { c: Vec3; r: number; u: Vec3; v: Vec3; s: number }[] = [];
  let travelled = 0;
  const capSteps = 3;
  for (let i = 0; i < curve.length; i++) {
    const t = tangents[i];
    u = norm(sub3(u, scale(t, dot(u, t))));
    const v = cross(t, u);
    if (i > 0) travelled += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1], curve[i][2] - curve[i - 1][2]);
    rings.push({ c: curve[i], r: radius, u, v, s: travelled });
  }
  const capRings = (end: 0 | 1) => {
    const base = end ? rings[rings.length - 1] : rings[0];
    const t = end ? tangents[tangents.length - 1] : scale(tangents[0], -1);
    const out = [];
    for (let s = 1; s <= capSteps; s++) {
      const a = ((Math.PI / 2) * s) / (capSteps + 0.001);
      out.push({ c: add(base.c, scale(t, radius * Math.sin(a))), r: Math.max(1e-3, radius * Math.cos(a)), u: base.u, v: base.v, s: base.s });
    }
    return out;
  };
  const all = [...capRings(0).reverse(), ...rings, ...capRings(1)];
  const pos: number[] = [], idx: number[] = [], along: number[] = [];
  for (const ring of all) for (let j = 0; j <= sides; j++) {
    const a = (2 * Math.PI * j) / sides;
    pos.push(...add(ring.c, add(scale(ring.u, ring.r * Math.cos(a)), scale(ring.v, ring.r * Math.sin(a)))));
    along.push(ring.s);
  }
  for (let i = 0; i + 1 < all.length; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // close the tips
  const tip0 = pos.length / 3; pos.push(...add(all[0].c, scale(tangents[0], -radius * 0.02)));
  const tip1 = pos.length / 3; pos.push(...add(all[all.length - 1].c, scale(tangents[tangents.length - 1], radius * 0.02)));
  const last = (all.length - 1) * (sides + 1);
  for (let j = 0; j < sides; j++) { idx.push(tip0, j + 1, j); idx.push(tip1, last + j, last + j + 1); }
  along.push(0, travelled);
  // the distance along the tube, as the fraction of the vertex coordinate
  return { ...finish(pos, idx), coord: Float32Array.from(along, (x) => Math.min(0.999, x / COORD_SPAN)) };
}

/**
 * Every organelle as a rest-space mesh (scars are painted on the skin instead). Each vertex
 * carries a coordinate: which organelle of its material it is, COORD_MOVING if it moves, and
 * for tubes the distance along them.
 */
export function organelleTemplates(an: Anatomy): OrganelleTemplate[] {
  const out: OrganelleTemplate[] = [];
  const seen = new Map<Material, number>();
  const push = (material: Material, mesh: RestMesh, moving = false) => {
    const id = seen.get(material) ?? 0;
    seen.set(material, id + 1);
    const base = (id % COORD_MOVING) + (moving ? COORD_MOVING : 0), n = mesh.pos.length / 3;
    const coord = new Float32Array(n);
    for (let v = 0; v < n; v++) coord[v] = base + (mesh.coord ? mesh.coord[v] : 0);
    out.push({ material, mesh: { ...mesh, coord } });
  };
  for (const o of an.organelles) {
    const small = Math.max(...o.b) < 0.45;
    // (for a bowl `b` is an axis, not a size, and it has its own rule below)
    if (o.kind === Prim.Ellipsoid) push(o.material, ellipsoidMesh(o.a, o.b, small ? 18 : 30, small ? 10 : 20));
    else if (o.kind === Prim.Torus && o.material !== Mat.BudScar) push(o.material, torusMesh(o.a, o.b, o.R, o.r));
    else if (o.kind === Prim.Disc) {
      const ht = Math.hypot(...o.b) || 1e-6;
      push(o.material, discMesh(o.a, [o.b[0] / ht, o.b[1] / ht, o.b[2] / ht], ht, o.R, o.r, o.R < 0.4 ? 20 : 48));
    }
    else if (o.kind === Prim.Bowl) {
      const s = Math.hypot(...o.b) || 1e-6;
      push(o.material, bowlMesh(o.a, [o.b[0] / s, o.b[1] / s, o.b[2] / s], s, o.R, o.r, o.R * s < 0.3 ? 14 : 28, o.R * s < 0.3 ? 4 : 8));
    }
    // capsules belong to tubules, meshed below; scar tori are painted on the skin
  }
  for (const t of an.tubules) push(t.material, tubeMesh(t.points, t.radius, t.radius < 0.09 ? 6 : 8, t.motion ? 8 : 4), !!t.motion);
  return out;
}

/** Concatenates meshes of the same material into one. */
export function mergeMeshes(meshes: RestMesh[]): RestMesh {
  const nPos = meshes.reduce((a, m) => a + m.pos.length, 0), nIdx = meshes.reduce((a, m) => a + m.idx.length, 0);
  const pos = new Float32Array(nPos), idx = new Uint32Array(nIdx), cut = new Uint8Array(nPos / 3), coord = new Float32Array(nPos / 3);
  let po = 0, io = 0;
  for (const m of meshes) {
    pos.set(m.pos, po);
    if (m.coord) coord.set(m.coord, po / 3);
    for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + po / 3;
    cut.set(m.isCutFace, po / 3);
    po += m.pos.length; io += m.idx.length;
  }
  return { pos, idx, isCutFace: cut, coord };
}

function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a: Vec3, b: Vec3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: Vec3): Vec3 { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
