// Barycentric embedding: any rest-space mesh or point set rides along inside a sim mesh's tetrahedra.

import type { MaterialId, RestMesh, SimMesh, SkinMesh } from '../contracts';

/** Spatial lookup of tets by their rest bounding boxes. */
export class TetGrid {
  private cells: Map<number, number[]> = new Map();
  constructor(private sim: SimMesh, private cell = sim.spacing) {
    const { restPos: p, tets } = sim;
    for (let t = 0; t < tets.length / 4; t++) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < 4; k++) for (let a = 0; a < 3; a++) {
        const x = p[3 * tets[4 * t + k] + a];
        lo[a] = Math.min(lo[a], x); hi[a] = Math.max(hi[a], x);
      }
      for (let i = this.q(lo[0]); i <= this.q(hi[0]); i++)
        for (let j = this.q(lo[1]); j <= this.q(hi[1]); j++)
          for (let k = this.q(lo[2]); k <= this.q(hi[2]); k++) {
            const key = this.key(i, j, k);
            const list = this.cells.get(key);
            if (list) list.push(t); else this.cells.set(key, [t]);
          }
    }
  }
  private q(x: number) { return Math.floor(x / this.cell); }
  private key(i: number, j: number, k: number) { return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512); }

  /** Barycentric weights of a point in tet t (rest configuration). */
  bary(t: number, x: number, y: number, z: number, out: Float32Array | Float64Array, o = 0) {
    const { restPos: p, tets, restInv: M } = this.sim;
    const i0 = 3 * tets[4 * t];
    const dx = x - p[i0], dy = y - p[i0 + 1], dz = z - p[i0 + 2];
    const m = 9 * t;
    const l1 = M[m] * dx + M[m + 3] * dy + M[m + 6] * dz;
    const l2 = M[m + 1] * dx + M[m + 4] * dy + M[m + 7] * dz;
    const l3 = M[m + 2] * dx + M[m + 5] * dy + M[m + 8] * dz;
    out[o] = 1 - l1 - l2 - l3; out[o + 1] = l1; out[o + 2] = l2; out[o + 3] = l3;
  }

  /** The tet that best contains a point: the one maximising its smallest barycentric weight. */
  locate(x: number, y: number, z: number): { tet: number; minBary: number } {
    const b = new Float64Array(4);
    let best = -1, bestMin = -Infinity;
    const ci = this.q(x), cj = this.q(y), ck = this.q(z);
    for (let r = 0; r <= 4 && (best < 0 || (r <= 1 && bestMin < 0)); r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
        const list = this.cells.get(this.key(i, j, k));
        if (!list) continue;
        for (const t of list) {
          this.bary(t, x, y, z, b);
          const mn = Math.min(b[0], b[1], b[2], b[3]);
          if (mn > bestMin) { bestMin = mn; best = t; }
        }
      }
    }
    return { tet: best, minBary: bestMin };
  }
}

/** Embeds points in a sim mesh. `minBary` < 0 means the point lies outside its tet. */
export function embedPoints(grid: TetGrid, pts: ArrayLike<number>) {
  const n = pts.length / 3;
  const tetId = new Uint32Array(n), bary = new Float32Array(n * 4), minBary = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const { tet, minBary: mb } = grid.locate(pts[3 * v], pts[3 * v + 1], pts[3 * v + 2]);
    tetId[v] = Math.max(0, tet);
    minBary[v] = tet < 0 ? -Infinity : mb;
    if (tet >= 0) grid.bary(tet, pts[3 * v], pts[3 * v + 1], pts[3 * v + 2], bary, 4 * v);
  }
  return { tetId, bary, minBary };
}

/**
 * Embeds a rest mesh, keeping only triangles whose vertices all sit within
 * `tolerance` (in barycentric units) of the sim mesh, and compacts the result.
 */
export function embedMesh(grid: TetGrid, mesh: RestMesh, material: MaterialId, tolerance: number): SkinMesh | null {
  const e = embedPoints(grid, mesh.pos);
  const keepV = new Int32Array(mesh.pos.length / 3).fill(-1);
  const idx: number[] = [];
  let n = 0;
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const a = mesh.idx[t], b = mesh.idx[t + 1], c = mesh.idx[t + 2];
    if (e.minBary[a] < -tolerance || e.minBary[b] < -tolerance || e.minBary[c] < -tolerance) continue;
    for (const v of [a, b, c]) { if (keepV[v] < 0) keepV[v] = n++; idx.push(keepV[v]); }
  }
  if (idx.length === 0) return null;
  const restPos = new Float32Array(n * 3), tetId = new Uint32Array(n), bary = new Float32Array(n * 4), isCutFace = new Uint8Array(n);
  const restNormal = mesh.normal ? new Float32Array(n * 3) : undefined;
  const coord = mesh.coord ? new Float32Array(n) : undefined;
  for (let v = 0; v < keepV.length; v++) {
    const o = keepV[v];
    if (o < 0) continue;
    restPos.set(mesh.pos.subarray(3 * v, 3 * v + 3), 3 * o);
    tetId[o] = e.tetId[v];
    bary.set(e.bary.subarray(4 * v, 4 * v + 4), 4 * o);
    isCutFace[o] = mesh.isCutFace[v];
    if (restNormal) restNormal.set(mesh.normal!.subarray(3 * v, 3 * v + 3), 3 * o);
    if (coord) coord[o] = mesh.coord![v];
  }
  return { restPos, pos: restPos.slice(), normal: new Float32Array(n * 3), idx: Uint32Array.from(idx), tetId, bary, isCutFace, material, restNormal, ...(coord ? { coord } : {}) };
}

/** Moves skin vertices with their tets and recomputes smooth normals. */
export function updateSkin(skin: SkinMesh, sim: SimMesh) {
  const { pos, bary, tetId, normal, idx } = skin;
  const P = sim.pos, T = sim.tets;
  for (let v = 0, n = tetId.length; v < n; v++) {
    const t = 4 * tetId[v], b = 4 * v;
    const i0 = 3 * T[t], i1 = 3 * T[t + 1], i2 = 3 * T[t + 2], i3 = 3 * T[t + 3];
    const w0 = bary[b], w1 = bary[b + 1], w2 = bary[b + 2], w3 = bary[b + 3];
    pos[3 * v] = w0 * P[i0] + w1 * P[i1] + w2 * P[i2] + w3 * P[i3];
    pos[3 * v + 1] = w0 * P[i0 + 1] + w1 * P[i1 + 1] + w2 * P[i2 + 1] + w3 * P[i3 + 1];
    pos[3 * v + 2] = w0 * P[i0 + 2] + w1 * P[i1 + 2] + w2 * P[i2 + 2] + w3 * P[i3 + 2];
  }
  if (skin.restNormal) { deformNormals(skin, sim); return; }
  normal.fill(0);
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    normal[a] += nx; normal[a + 1] += ny; normal[a + 2] += nz;
    normal[b] += nx; normal[b + 1] += ny; normal[b + 2] += nz;
    normal[c] += nx; normal[c + 1] += ny; normal[c + 2] += nz;
  }
  for (let v = 0; v < normal.length; v += 3) {
    const l = Math.hypot(normal[v], normal[v + 1], normal[v + 2]) || 1;
    normal[v] /= l; normal[v + 1] /= l; normal[v + 2] /= l;
  }
}

/** n = cof(F)·n₀ per vertex, with F the deformation gradient of its tet. */
function deformNormals(skin: SkinMesh, sim: SimMesh) {
  const { normal, tetId } = skin, n0 = skin.restNormal!;
  const P = sim.pos, T = sim.tets, M = sim.restInv;
  let lastT = -1;
  let c00 = 1, c01 = 0, c02 = 0, c10 = 0, c11 = 1, c12 = 0, c20 = 0, c21 = 0, c22 = 1;
  for (let v = 0, n = tetId.length; v < n; v++) {
    const t = tetId[v];
    if (t !== lastT) {
      lastT = t;
      const i0 = 3 * T[4 * t], i1 = 3 * T[4 * t + 1], i2 = 3 * T[4 * t + 2], i3 = 3 * T[4 * t + 3], m = 9 * t;
      const d1x = P[i1] - P[i0], d1y = P[i1 + 1] - P[i0 + 1], d1z = P[i1 + 2] - P[i0 + 2];
      const d2x = P[i2] - P[i0], d2y = P[i2 + 1] - P[i0 + 1], d2z = P[i2 + 2] - P[i0 + 2];
      const d3x = P[i3] - P[i0], d3y = P[i3 + 1] - P[i0 + 1], d3z = P[i3 + 2] - P[i0 + 2];
      const f0x = d1x * M[m] + d2x * M[m + 1] + d3x * M[m + 2], f0y = d1y * M[m] + d2y * M[m + 1] + d3y * M[m + 2], f0z = d1z * M[m] + d2z * M[m + 1] + d3z * M[m + 2];
      const f1x = d1x * M[m + 3] + d2x * M[m + 4] + d3x * M[m + 5], f1y = d1y * M[m + 3] + d2y * M[m + 4] + d3y * M[m + 5], f1z = d1z * M[m + 3] + d2z * M[m + 4] + d3z * M[m + 5];
      const f2x = d1x * M[m + 6] + d2x * M[m + 7] + d3x * M[m + 8], f2y = d1y * M[m + 6] + d2y * M[m + 7] + d3y * M[m + 8], f2z = d1z * M[m + 6] + d2z * M[m + 7] + d3z * M[m + 8];
      // cof(F) columns: f1×f2, f2×f0, f0×f1
      c00 = f1y * f2z - f1z * f2y; c01 = f1z * f2x - f1x * f2z; c02 = f1x * f2y - f1y * f2x;
      c10 = f2y * f0z - f2z * f0y; c11 = f2z * f0x - f2x * f0z; c12 = f2x * f0y - f2y * f0x;
      c20 = f0y * f1z - f0z * f1y; c21 = f0z * f1x - f0x * f1z; c22 = f0x * f1y - f0y * f1x;
    }
    const nx = n0[3 * v], ny = n0[3 * v + 1], nz = n0[3 * v + 2];
    const x = nx * c00 + ny * c10 + nz * c20, y = nx * c01 + ny * c11 + nz * c21, z = nx * c02 + ny * c12 + nz * c22;
    const l = Math.hypot(x, y, z) || 1;
    normal[3 * v] = x / l; normal[3 * v + 1] = y / l; normal[3 * v + 2] = z / l;
  }
}

/** Positions of embedded points in the current configuration of `sim`, written into `out` (xyz). */
export function moveEmbedded(sim: SimMesh, tetId: Uint32Array, bary: Float32Array, out: Float32Array): void {
  const P = sim.pos, T = sim.tets;
  for (let v = 0, n = tetId.length; v < n; v++) {
    const t = 4 * tetId[v], b = 4 * v;
    const i0 = 3 * T[t], i1 = 3 * T[t + 1], i2 = 3 * T[t + 2], i3 = 3 * T[t + 3];
    const w0 = bary[b], w1 = bary[b + 1], w2 = bary[b + 2], w3 = bary[b + 3];
    out[3 * v] = w0 * P[i0] + w1 * P[i1] + w2 * P[i2] + w3 * P[i3];
    out[3 * v + 1] = w0 * P[i0 + 1] + w1 * P[i1 + 1] + w2 * P[i2 + 1] + w3 * P[i3 + 1];
    out[3 * v + 2] = w0 * P[i0 + 2] + w1 * P[i1 + 2] + w2 * P[i2 + 2] + w3 * P[i3 + 2];
  }
}
