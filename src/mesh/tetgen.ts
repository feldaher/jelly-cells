// Tetrahedral simulation mesh of a piece: a body-centred cubic lattice clipped by
// the piece's SDF, with boundary nodes snapped onto the surface.

import type { Anatomy, Plane, SimMesh } from '../contracts';
import { gradient, materialAt, pieceSdf } from '../anatomy/sdf';
import { inv3 } from '../math/mat3';

/** Tets below this quality (1 = regular) are dropped after snapping. */
const MIN_QUALITY = 0.12;

/** 6√2·V / l_rms³: 1 for a regular tetrahedron, 0 for a flat one. */
export function tetQuality(p: ArrayLike<number>, a: number, b: number, c: number, d: number, vol: number): number {
  const ids = [a, b, c, d];
  let s = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
    s += (p[3 * ids[i]] - p[3 * ids[j]]) ** 2 + (p[3 * ids[i] + 1] - p[3 * ids[j] + 1]) ** 2 + (p[3 * ids[i] + 2] - p[3 * ids[j] + 2]) ** 2;
  return (6 * Math.SQRT2 * vol) / Math.pow(s / 6, 1.5);
}

export function tetVolume(p: ArrayLike<number>, a: number, b: number, c: number, d: number): number {
  const ax = p[3 * a], ay = p[3 * a + 1], az = p[3 * a + 2];
  const bx = p[3 * b] - ax, by = p[3 * b + 1] - ay, bz = p[3 * b + 2] - az;
  const cx = p[3 * c] - ax, cy = p[3 * c + 1] - ay, cz = p[3 * c + 2] - az;
  const dx = p[3 * d] - ax, dy = p[3 * d + 1] - ay, dz = p[3 * d + 2] - az;
  return (bx * (cy * dz - cz * dy) - by * (cx * dz - cz * dx) + bz * (cx * dy - cy * dx)) / 6;
}

export function pieceBounds(an: Anatomy): { lo: number[]; hi: number[] } {
  return { lo: an.bounds.lo.map((x) => x - 0.3), hi: an.bounds.hi.map((x) => x + 0.3) };
}

/** Rough volume of a piece by sampling a coarse grid. */
export function estimateVolume(an: Anatomy, planes: Plane[], step = 0.2): number {
  const { lo, hi } = pieceBounds(an);
  let n = 0;
  for (let x = lo[0] + step / 2; x < hi[0]; x += step)
    for (let y = lo[1] + step / 2; y < hi[1]; y += step)
      for (let z = lo[2] + step / 2; z < hi[2]; z += step) if (pieceSdf(an, planes, x, y, z) < 0) n++;
  return n * step ** 3;
}

/**
 * Lattice spacing: coarse enough that 12 XPBD substeps converge for the whole cell,
 * and fine enough that even a small piece keeps ~minParticles particles.
 */
export function chooseSpacing(an: Anatomy, planes: Plane[]): number {
  const vol = estimateVolume(an, planes);
  const m = an.mesh;
  return Math.min(m.maxSpacing, Math.max(m.minSpacing, Math.cbrt((2 * vol) / m.minParticles)));
}

export function buildSimMesh(an: Anatomy, planes: Plane[], spacing = chooseSpacing(an, planes)): SimMesh {
  const h = spacing;
  const f = (x: number, y: number, z: number) => pieceSdf(an, planes, x, y, z);
  const { lo, hi } = pieceBounds(an);
  // Offset the lattice by a small irrational amount so it never lines up with a cut plane.
  const ox = lo[0] - h + 0.0137, oy = lo[1] - h + 0.0231, oz = lo[2] - h + 0.0079;
  const nx = Math.ceil((hi[0] - ox) / h) + 1, ny = Math.ceil((hi[1] - oy) / h) + 1, nz = Math.ceil((hi[2] - oz) / h) + 1;

  const nCorner = (nx + 1) * (ny + 1) * (nz + 1);
  const nCentre = nx * ny * nz;
  const corner = (i: number, j: number, k: number) => i + (nx + 1) * (j + (ny + 1) * k);
  const centre = (i: number, j: number, k: number) => nCorner + i + nx * (j + ny * k);
  const P = new Float64Array((nCorner + nCentre) * 3);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const id = corner(i, j, k) * 3;
    P[id] = ox + i * h; P[id + 1] = oy + j * h; P[id + 2] = oz + k * h;
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const id = centre(i, j, k) * 3;
    P[id] = ox + (i + 0.5) * h; P[id + 1] = oy + (j + 0.5) * h; P[id + 2] = oz + (k + 0.5) * h;
  }

  // BCC tets: two neighbouring cube centres plus one edge of the face they share.
  const tets: number[] = [];
  const pushTet = (a: number, b: number, c: number, d: number) => {
    const cx = (P[3 * a] + P[3 * b] + P[3 * c] + P[3 * d]) / 4;
    const cy = (P[3 * a + 1] + P[3 * b + 1] + P[3 * c + 1] + P[3 * d + 1]) / 4;
    const cz = (P[3 * a + 2] + P[3 * b + 2] + P[3 * c + 2] + P[3 * d + 2]) / 4;
    if (f(cx, cy, cz) < 0.25 * h) tets.push(a, b, c, d);
  };
  const face = (c1: number, c2: number, q: number[]) => {
    for (let e = 0; e < 4; e++) pushTet(c1, c2, q[e], q[(e + 1) % 4]);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = centre(i, j, k);
    if (i + 1 < nx) face(c, centre(i + 1, j, k), [corner(i + 1, j, k), corner(i + 1, j + 1, k), corner(i + 1, j + 1, k + 1), corner(i + 1, j, k + 1)]);
    if (j + 1 < ny) face(c, centre(i, j + 1, k), [corner(i, j + 1, k), corner(i + 1, j + 1, k), corner(i + 1, j + 1, k + 1), corner(i, j + 1, k + 1)]);
    if (k + 1 < nz) face(c, centre(i, j, k + 1), [corner(i, j, k + 1), corner(i + 1, j, k + 1), corner(i + 1, j + 1, k + 1), corner(i, j + 1, k + 1)]);
  }

  // Snap every used node that lies outside (or just inside) onto the surface.
  const used = new Uint8Array(nCorner + nCentre);
  for (const t of tets) used[t] = 1;
  for (let n = 0; n < used.length; n++) {
    if (!used[n]) continue;
    let x = P[3 * n], y = P[3 * n + 1], z = P[3 * n + 2];
    let d = f(x, y, z);
    if (d < 0) continue;
    for (let it = 0; it < 6 && Math.abs(d) > 1e-4; it++) {
      const g = gradient(f, x, y, z);
      x -= d * g[0]; y -= d * g[1]; z -= d * g[2];
      d = f(x, y, z);
    }
    P[3 * n] = x; P[3 * n + 1] = y; P[3 * n + 2] = z;
  }

  // Orient tets, drop slivers flattened by snapping (they would be too compliant to stay right side out).
  const kept: number[] = [];
  for (let t = 0; t < tets.length; t += 4) {
    let [a, b, c, d] = [tets[t], tets[t + 1], tets[t + 2], tets[t + 3]];
    let v = tetVolume(P, a, b, c, d);
    if (v < 0) { [c, d] = [d, c]; v = -v; }
    if (tetQuality(P, a, b, c, d, v) > MIN_QUALITY) kept.push(a, b, c, d);
  }

  const mesh = compact(P, kept, h);
  return largestComponentsOnly(mesh, an, 20);

  function compact(Pos: Float64Array, tl: number[], sp: number) {
    const remap = new Int32Array(Pos.length / 3).fill(-1);
    let n = 0;
    for (const t of tl) if (remap[t] < 0) remap[t] = n++;
    const rest = new Float32Array(n * 3);
    for (let i = 0; i < remap.length; i++) if (remap[i] >= 0) rest.set(Pos.subarray(3 * i, 3 * i + 3), 3 * remap[i]);
    return { rest, tets: Uint32Array.from(tl, (t) => remap[t]), spacing: sp };
  }
}

/** Splits a raw tet soup into connected components (sharing a vertex counts as connected). */
export function tetComponents(tets: Uint32Array, nVerts: number): Int32Array {
  const parent = new Int32Array(nVerts).map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let t = 0; t < tets.length; t += 4)
    for (let k = 1; k < 4; k++) { const a = find(tets[t]), b = find(tets[t + k]); if (a !== b) parent[a] = b; }
  const label = new Int32Array(tets.length / 4);
  for (let t = 0; t < label.length; t++) label[t] = find(tets[4 * t]);
  return label;
}

function largestComponentsOnly(m: { rest: Float32Array; tets: Uint32Array; spacing: number }, an: Anatomy, minTets: number): SimMesh {
  // Drop crumbs smaller than `minTets`; everything else stays (buildPieces separates components).
  const label = tetComponents(m.tets, m.rest.length / 3);
  const count = new Map<number, number>();
  for (const l of label) count.set(l, (count.get(l) ?? 0) + 1);
  const keep: number[] = [];
  for (let t = 0; t < label.length; t++) if ((count.get(label[t]) ?? 0) >= minTets) keep.push(...m.tets.subarray(4 * t, 4 * t + 4));
  return finishSimMesh(an, m.rest, Uint32Array.from(keep), m.spacing);
}

/** Builds all derived per-tet and per-particle data from rest positions and tets. Unused particles are removed. */
export function finishSimMesh(an: Anatomy, restIn: Float32Array, tetsIn: Uint32Array, spacing: number): SimMesh {
  const remap = new Int32Array(restIn.length / 3).fill(-1);
  let n = 0;
  for (const t of tetsIn) if (remap[t] < 0) remap[t] = n++;
  const restPos = new Float32Array(n * 3);
  for (let i = 0; i < remap.length; i++) if (remap[i] >= 0) restPos.set(restIn.subarray(3 * i, 3 * i + 3), 3 * remap[i]);
  const tets = Uint32Array.from(tetsIn, (t) => remap[t]);

  const nt = tets.length / 4;
  const restInv = new Float32Array(nt * 9);
  const restVol = new Float32Array(nt);
  const tetMaterial = new Uint8Array(nt);
  const mass = new Float64Array(n);
  const Dm = new Float64Array(9);
  for (let t = 0; t < nt; t++) {
    const i0 = tets[4 * t] * 3;
    for (let c = 0; c < 3; c++) {
      const ic = tets[4 * t + 1 + c] * 3;
      for (let r = 0; r < 3; r++) Dm[3 * c + r] = restPos[ic + r] - restPos[i0 + r];
    }
    const det = inv3(Dm, restInv, 9 * t);
    restVol[t] = det / 6;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 4; k++) {
      const i = tets[4 * t + k];
      mass[i] += restVol[t] / 4;
      cx += restPos[3 * i] / 4; cy += restPos[3 * i + 1] / 4; cz += restPos[3 * i + 2] / 4;
    }
    tetMaterial[t] = materialAt(an, cx, cy, cz, an.cortexDepth);
  }
  const invMass = Float32Array.from(mass, (m) => (m > 0 ? 1 / m : 0));

  const edgeSet = new Set<number>();
  const edges: number[] = [];
  for (let t = 0; t < nt; t++)
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const i = Math.min(tets[4 * t + a], tets[4 * t + b]), j = Math.max(tets[4 * t + a], tets[4 * t + b]);
      const key = i * n + j;
      if (!edgeSet.has(key)) { edgeSet.add(key); edges.push(i, j); }
    }

  return {
    restPos,
    pos: restPos.slice(),
    prevPos: restPos.slice(),
    vel: new Float32Array(n * 3),
    invMass,
    tets,
    tetMaterial,
    restInv,
    restVol,
    edges: Uint32Array.from(edges),
    spacing,
  };
}
