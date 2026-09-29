// The default budding yeast cell. Sizes are stylised but plausible for
// S. cerevisiae: mother ≈ 5 µm across, bud ≈ 3 µm, a ~1 µm neck with a septin
// ring, a nucleus near the neck, a large vacuole, and a cortical mitochondrial network.

import { Mat, Prim, type Anatomy, type Ellipsoid, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf } from './sdf';

const norm = (v: Vec3): Vec3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function surfacePoint(e: Ellipsoid, dir: Vec3, depth: number): Vec3 {
  // Point along `dir` from the centre, `depth` µm inside the ellipsoid surface.
  const u = norm(dir);
  const t = 1 / Math.hypot(u[0] / e.radii[0], u[1] / e.radii[1], u[2] / e.radii[2]);
  const s = t - depth;
  return [e.centre[0] + u[0] * s, e.centre[1] + u[1] * s, e.centre[2] + u[2] * s];
}

function ellipsoidNormal(e: Ellipsoid, p: Vec3): Vec3 {
  return norm([(p[0] - e.centre[0]) / e.radii[0] ** 2, (p[1] - e.centre[1]) / e.radii[1] ** 2, (p[2] - e.centre[2]) / e.radii[2] ** 2]);
}

/** A tubule wandering just under the cortex: a random walk on a shrunken ellipsoid. */
function tubule(e: Ellipsoid, rand: () => number, avoid: (u: Vec3) => boolean, segments: number, stepLen: number, depth: number): Vec3[] {
  let u: Vec3;
  do { u = norm([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]); } while (avoid(u));
  let t = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
  const pts: Vec3[] = [surfacePoint(e, u, depth)];
  const rMean = (e.radii[0] + e.radii[1] + e.radii[2]) / 3;
  for (let i = 0; i < segments; i++) {
    // keep t tangent, wiggle it, step along it
    const dot = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];
    t = norm([t[0] - dot * u[0] + (rand() - 0.5) * 0.9, t[1] - dot * u[1] + (rand() - 0.5) * 0.9, t[2] - dot * u[2] + (rand() - 0.5) * 0.9]);
    const a = stepLen / rMean;
    const nu = norm([u[0] + t[0] * a, u[1] + t[1] * a, u[2] + t[2] * a]);
    if (avoid(nu)) break;
    u = nu;
    pts.push(surfacePoint(e, u, depth));
  }
  return pts;
}

/** Radius of the cell's cross-section at x (along the mother→bud axis). */
function sectionRadius(an: Anatomy, x: number): number {
  let lo = 0, hi = 4;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (cellSdf(an, x, an.mother.centre[1], m + an.mother.centre[2]) < 0) lo = m; else hi = m;
  }
  return lo;
}

export function defaultAnatomy(seed = 7): Anatomy {
  const rand = rng(seed);
  const mother: Ellipsoid = { centre: [0, 0, 0], radii: [2.5, 2.3, 2.3] };
  const bud: Ellipsoid = { centre: [3.75, 0, 0.1], radii: [1.6, 1.45, 1.45] };
  const an: Anatomy = { mother, bud, neckBlend: 0.5, wallThickness: 0.18, organelles: [], tubules: [], seed };

  // Neck: the narrowest section between the two centres.
  let neckX = 2.2, neckR = Infinity;
  for (let x = 1.6; x <= 3.0; x += 0.02) {
    const r = sectionRadius(an, x);
    if (r < neckR) { neckR = r; neckX = x; }
  }

  const organelles: Primitive[] = [];
  const add = (kind: Primitive['kind'], material: Primitive['material'], a: Vec3, b: Vec3, R = 0, r = 0) =>
    organelles.push({ kind, material, a, b, R, r });

  // Septin hourglass at the neck, just beneath the wall.
  add(Prim.Torus, Mat.Septin, [neckX, 0, 0], [1, 0, 0], neckR - an.wallThickness - 0.1, 0.1);

  // Bud scars: chitin rings on the mother's far side, from earlier divisions.
  const jitter = () => (rand() - 0.5) * 0.25;
  for (const d of [[-0.85, 0.4, 0.35], [-0.55, -0.25, 0.8], [-0.7, 0.62, -0.35]] as Vec3[]) {
    const dir = norm([d[0] + jitter(), d[1] + jitter(), d[2] + jitter()]);
    const p = surfacePoint(mother, dir, 0);
    add(Prim.Torus, Mat.BudScar, p, ellipsoidNormal(mother, p), 0.36, 0.09);
  }

  // Nucleus migrating toward the neck, with a crescent-ish nucleolus.
  add(Prim.Ellipsoid, Mat.Nucleolus, [1.5, 0.45, 0.2], [0.38, 0.3, 0.42]);
  add(Prim.Ellipsoid, Mat.Nucleus, [1.15, 0.15, 0.1], [0.95, 0.9, 0.88]);

  // Mitochondrial network hugging the cortex of mother and bud.
  const neckDir = norm([1, 0, 0]);
  const tubules: Anatomy['tubules'] = [];
  const mkTubules = (e: Ellipsoid, count: number, segs: number, avoid: (u: Vec3) => boolean) => {
    for (let i = 0; i < count; i++) {
      const radius = 0.12 + rand() * 0.04;
      const pts = tubule(e, rand, avoid, segs + Math.floor(rand() * 3), 0.55, 0.36);
      if (pts.length < 2) continue;
      tubules.push({ points: pts, radius });
      for (let k = 0; k + 1 < pts.length; k++) add(Prim.Capsule, Mat.Mitochondrion, pts[k], pts[k + 1], 0, radius);
    }
  };
  mkTubules(mother, 8, 5, (u) => u[0] * neckDir[0] > 0.72);
  mkTubules(bud, 3, 3, (u) => u[0] < -0.6);
  an.tubules = tubules;

  // Vacuoles: a big one plus a lobe in the mother, a small one in the bud.
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.85, -0.15, -0.1], [1.15, 1.1, 1.1]);
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.35, 0.95, 0.8], [0.5, 0.46, 0.46]);
  add(Prim.Ellipsoid, Mat.Vacuole, [3.95, 0.1, -0.15], [0.5, 0.45, 0.45]);

  an.organelles = organelles;
  return an;
}
