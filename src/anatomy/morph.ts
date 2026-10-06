// An anatomy part-way between two stages. The body is the linear blend of the two
// distance fields, so new flesh appears first where it is closest to the old surface
// (a bud swells out of the mother, an axon regrows from its stump). Organelles are
// matched one to one; one with no counterpart grows out of, or shrinks into, its
// nearest relative of the same material. Organelles move in straight lines while the
// blended body grows its new parts late, so whatever would lie outside the cell is left
// out until the cell has grown around it.

import { Prim, type Anatomy, type Material, type Primitive, type Vec3 } from '../contracts';
import { cellSdf } from './sdf';

type Tubule = Anatomy['tubules'][number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit = (v: Vec3): Vec3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Smaller than this (sim units) and a primitive is left out. */
const MIN_SIZE = 0.02;

export function morphAnatomy(A: Anatomy, B: Anatomy, t: number): Anatomy {
  if (t <= 0) return A;
  if (t >= 1) return B;
  const body: Anatomy['body'] = [...A.body, { ...B.body[0], op: 'morph', blend: t }, ...B.body.slice(1)];
  const inside = (p: Vec3) => cellSdf({ body } as Anatomy, p[0], p[1], p[2]);
  const tubules = morphTubules(A.tubules, B.tubules, t).flatMap((tb) => insideRuns(tb, (p) => inside(p) < 0));
  const own = morphPrims(ownOrganelles(A), ownOrganelles(B), t).filter((p) => inside(centre(p)) <= size(p));
  const caps: Primitive[] = tubules.flatMap((tb) => tb.points.slice(1).map((p, k) => ({ kind: Prim.Capsule, material: tb.material, a: tb.points[k], b: p, R: 0, r: tb.radius })));
  // Paint priority: materials in the order the nearer stage lists them.
  const lead = t < 0.5 ? [A, B] : [B, A];
  const rank = new Map<Material, number>();
  for (const an of lead) for (const o of an.organelles) if (!rank.has(o.material)) rank.set(o.material, rank.size);
  const organelles = [...own, ...caps].map((p, i) => ({ p, i })).sort((x, y) => (rank.get(x.p.material)! - rank.get(y.p.material)!) || x.i - y.i).map((x) => x.p);

  return {
    cellType: A.cellType,
    stage: lerp(A.stage, B.stage, t),
    body,
    bounds: { lo: [0, 1, 2].map((k) => Math.min(A.bounds.lo[k], B.bounds.lo[k])) as Vec3, hi: [0, 1, 2].map((k) => Math.max(A.bounds.hi[k], B.bounds.hi[k])) as Vec3 },
    wallThickness: lerp(A.wallThickness, B.wallThickness, t),
    cortexDepth: lerp(A.cortexDepth, B.cortexDepth, t),
    mesh: {
      minSpacing: lerp(A.mesh.minSpacing, B.mesh.minSpacing, t),
      maxSpacing: lerp(A.mesh.maxSpacing, B.mesh.maxSpacing, t),
      minParticles: Math.max(A.mesh.minParticles, B.mesh.minParticles),
      skinGrid: lerp(A.mesh.skinGrid, B.mesh.skinGrid, t),
    },
    organelles,
    tubules,
    seed: A.seed,
  };
}

/** The stretches of a tubule whose centreline stays inside the cell (two points or more). */
function insideRuns(tb: Tubule, ok: (p: Vec3) => boolean): Tubule[] {
  const out: Tubule[] = [];
  let run: Vec3[] = [];
  for (const p of [...tb.points, null]) {
    if (p && ok(p)) { run.push(p); continue; }
    if (run.length >= 2) out.push({ ...tb, points: run });
    run = [];
  }
  return out;
}

/** Organelles that are not the capsules of a tubule. */
function ownOrganelles(an: Anatomy): Primitive[] {
  const key = (a: Vec3, b: Vec3) => `${a.join()}|${b.join()}`;
  const segs = new Set(an.tubules.flatMap((tb) => tb.points.slice(1).map((p, k) => key(tb.points[k], p))));
  return an.organelles.filter((o) => o.kind !== Prim.Capsule || !segs.has(key(o.a, o.b)));
}

function centre(p: Primitive): Vec3 {
  if (p.kind === Prim.Bowl) { const u = unit(p.b); return [p.a[0] + u[0] * p.R, p.a[1] + u[1] * p.R, p.a[2] + u[2] * p.R]; }
  return p.kind === Prim.Capsule || p.kind === Prim.Cone ? lerpV(p.a, p.b, 0.5) : p.a;
}

function size(p: Primitive): number {
  switch (p.kind) {
    case Prim.Ellipsoid: return Math.min(...p.b);
    case Prim.Torus: return p.r;
    case Prim.Capsule: return p.r;
    // a disc or a bowl is kept only while its middle is inside the cell (for a washer, within its hole)
    case Prim.Disc: return p.r;
    case Prim.Bowl: return p.r;
    default: return Math.max(p.R, p.r);
  }
}

/** The primitive shrunk to nothing at a point. */
function collapsed(p: Primitive, at: Vec3): Primitive {
  switch (p.kind) {
    case Prim.Ellipsoid: return { ...p, a: at, b: [0, 0, 0] };
    case Prim.Torus: return { ...p, a: at, R: 0, r: 0 };
    case Prim.Disc: return { ...p, a: at, R: 0, r: 0 };
    case Prim.Bowl: return { ...p, a: at, R: 0, r: 0 };
    default: return { ...p, a: at, b: at, R: 0, r: 0 };
  }
}

function lerpPrim(p: Primitive, q: Primitive, t: number): Primitive {
  return {
    kind: q.kind,
    material: q.material,
    a: lerpV(p.a, q.a, t),
    b: q.kind === Prim.Torus ? unit(lerpV(p.b, q.b, t)) : lerpV(p.b, q.b, t),
    R: lerp(p.R, q.R, t),
    r: lerp(p.r, q.r, t),
  };
}

/** Where a primitive with no counterpart comes from (or goes to): the nearest one of its material on the other side. */
function source(p: Primitive, other: Primitive[]): Vec3 {
  let best: Vec3 = centre(p), d = Infinity;
  for (const o of other) {
    if (o.material !== p.material) continue;
    const e = dist(centre(o), centre(p));
    if (e < d) { d = e; best = centre(o); }
  }
  return best;
}

function morphPrims(A: Primitive[], B: Primitive[], t: number): Primitive[] {
  const group = (list: Primitive[]) => {
    const g = new Map<string, Primitive[]>();
    for (const p of list) { const k = `${p.material}:${p.kind}`; g.set(k, [...(g.get(k) ?? []), p]); }
    return g;
  };
  const gA = group(A), gB = group(B);
  const out: Primitive[] = [];
  for (const k of new Set([...gA.keys(), ...gB.keys()])) {
    const a = gA.get(k) ?? [], b = gB.get(k) ?? [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const p = a[i] ?? collapsed(b[i], source(b[i], A));
      const q = b[i] ?? collapsed(a[i], source(a[i], B));
      const m = lerpPrim(p, q, t);
      if (size(m) >= MIN_SIZE) out.push(m);
    }
  }
  return out;
}

/** A polyline resampled to n points evenly spaced along its length. */
function resample(pts: Vec3[], n: number): Vec3[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1];
  const out: Vec3[] = [];
  for (let j = 0; j < n; j++) {
    const s = (L * j) / (n - 1);
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1];
    out.push(lerpV(pts[i - 1], pts[i], seg > 0 ? (s - cum[i - 1]) / seg : 0));
  }
  return out;
}

function morphTubules(A: Tubule[], B: Tubule[], t: number): Tubule[] {
  const byMat = (list: Tubule[]) => {
    const g = new Map<Material, Tubule[]>();
    for (const tb of list) g.set(tb.material, [...(g.get(tb.material) ?? []), tb]);
    return g;
  };
  const gA = byMat(A), gB = byMat(B);
  const centroid = (tb: Tubule): Vec3 => { const c = [0, 0, 0] as Vec3; for (const p of tb.points) for (let k = 0; k < 3; k++) c[k] += p[k] / tb.points.length; return c; };
  const out: Tubule[] = [];
  for (const m of new Set([...gA.keys(), ...gB.keys()])) {
    const a = gA.get(m) ?? [], b = gB.get(m) ?? [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const n = Math.max(a[i]?.points.length ?? 0, b[i]?.points.length ?? 0);
      const pa = a[i] ? resample(a[i].points, n) : null, pb = b[i] ? resample(b[i].points, n) : null;
      const from = pa ?? Array.from({ length: n }, () => centroid(b[i]));
      const to = pb ?? Array.from({ length: n }, () => centroid(a[i]));
      const radius = lerp(a[i]?.radius ?? 0, b[i]?.radius ?? 0, t);
      if (radius < MIN_SIZE) continue;
      const motion = (t < 0.5 ? a[i] ?? b[i] : b[i] ?? a[i]).motion;
      out.push({ material: m, radius, points: from.map((p, k) => lerpV(p, to[k], t)), ...(motion ? { motion } : {}) });
    }
  }
  return out;
}
