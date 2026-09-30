import { defaultAnatomy } from '../src/cells/yeast';
import { buildPiece } from '../src/mesh/piece';
import { defaultParams } from '../src/physics/params';
import { step } from '../src/physics/xpbd';
import type { Piece, SimParams } from '../src/contracts';

export const anatomy = defaultAnatomy();

export function freshCell(lift = 0): Piece {
  const p = buildPiece(anatomy, [], 0);
  placeOnFloor(p, lift);
  return p;
}

export function placeOnFloor(p: Piece, lift: number) {
  const s = p.sim;
  let minY = Infinity;
  for (let i = 1; i < s.pos.length; i += 3) minY = Math.min(minY, s.pos[i]);
  for (let i = 1; i < s.pos.length; i += 3) {
    s.pos[i] += lift - minY + 1e-3;
    s.prevPos[i] = s.pos[i];
  }
}

export function simulate(pieces: Piece[], seconds: number, params: SimParams = defaultParams(), extra?: Parameters<typeof step>[3]) {
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) step(pieces, params, 1 / 60, extra);
}

export function bbox(p: Piece) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const a = p.sim.pos;
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], a[i + k]); hi[k] = Math.max(hi[k], a[i + k]);
  }
  return { lo, hi };
}

/** Boundary triangles of a tet mesh (faces used by only one tet), 3 particle indices each. */
export function boundaryFaces(p: Piece): number[][] {
  const T = p.sim.tets, count = new Map<string, { v: number[]; n: number }>();
  const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
  for (let t = 0; t < T.length / 4; t++) for (const f of faces) {
    const v = f.map((k) => T[4 * t + k]);
    const key = [...v].sort((a, b) => a - b).join(',');
    const e = count.get(key);
    if (e) e.n++; else count.set(key, { v, n: 1 });
  }
  return [...count.values()].filter((e) => e.n === 1).map((e) => e.v);
}

/**
 * Deepest intrusion of any particle into another piece, in units of the lattice spacing:
 * a particle inside one of the other piece's tets (world pose), measured to that piece's
 * nearest surface triangle. Zero when no particle is inside another piece.
 */
export function deepestIntrusion(pieces: Piece[]): number {
  let worst = 0;
  for (const A of pieces) for (const B of pieces) {
    if (A === B) continue;
    const tris = boundaryFaces(B), PB = B.sim.pos, T = B.sim.tets, PA = A.sim.pos;
    const at = (i: number) => [PB[3 * i], PB[3 * i + 1], PB[3 * i + 2]];
    for (let i = 0; i < PA.length; i += 3) {
      const x = PA[i], y = PA[i + 1], z = PA[i + 2];
      let inside = false;
      for (let t = 0; t < T.length / 4 && !inside; t++) inside = inTet(PB, T, t, x, y, z);
      if (!inside) continue;
      let d = Infinity;
      for (const [a, b, c] of tris) d = Math.min(d, pointTriangle([x, y, z], at(a), at(b), at(c)));
      worst = Math.max(worst, d / B.sim.spacing);
    }
  }
  return worst;
}

/** Distance from p to triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function pointTriangle(p: number[], a: number[], b: number[], c: number[]): number {
  const sub = (u: number[], v: number[]) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const along = (o: number[], d: number[], t: number) => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q: number[];
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) q = b;
    else if (d6 >= 0 && d5 <= d6) q = c;
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = along(a, ab, d1 / (d1 - d3));
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = along(a, ac, d2 / (d2 - d6));
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = along(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)));
    else {
      const den = 1 / (va + vb + vc);
      q = along(along(a, ab, vb * den), ac, vc * den);
    }
  }
  const r = sub(p, q);
  return Math.sqrt(dot(r, r));
}

function inTet(P: Float32Array, T: Uint32Array, t: number, x: number, y: number, z: number): boolean {
  const v = [0, 1, 2, 3].map((k) => 3 * T[4 * t + k]);
  const vol = (a: number[], b: number[], c: number[], d: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    return ux * (vy * wz - vz * wy) - uy * (vx * wz - vz * wx) + uz * (vx * wy - vy * wx);
  };
  const q = [x, y, z];
  const p = v.map((i) => [P[i], P[i + 1], P[i + 2]]);
  // quick reject on the bounding box
  for (let k = 0; k < 3; k++) if (q[k] < Math.min(p[0][k], p[1][k], p[2][k], p[3][k]) || q[k] > Math.max(p[0][k], p[1][k], p[2][k], p[3][k])) return false;
  const V = vol(p[0], p[1], p[2], p[3]), s = Math.sign(V);
  return s * vol(q, p[1], p[2], p[3]) > 0 && s * vol(p[0], q, p[2], p[3]) > 0 && s * vol(p[0], p[1], q, p[3]) > 0 && s * vol(p[0], p[1], p[2], q) > 0;
}
