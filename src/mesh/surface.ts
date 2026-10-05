// The smooth render skin of a piece (surface nets on its SDF) and the barycentric
// embedding that lets any rest-space mesh ride along inside the tetrahedra.

import { Mat, type Anatomy, type Material, type Plane, type SimMesh, type SkinMesh } from '../contracts';
import { cellSdf, gradient, pieceSdf, planeDist } from '../anatomy/sdf';

/** Raw rest-space triangle mesh before embedding. */
export interface RestMesh {
  pos: Float32Array;
  idx: Uint32Array;
  isCutFace: Uint8Array;
  normal?: Float32Array;
  /** Organelle coordinate per vertex (see SkinMesh.coord). */
  coord?: Float32Array;
}

/**
 * Surface nets isosurface of the piece SDF over the box [lo, hi]. Knife faces are
 * split off from the natural surface (vertices duplicated along the crease) so the
 * edge stays sharp when normals are averaged.
 */
export function buildSkinGeometry(an: Anatomy, planes: Plane[], lo: number[], hi: number[], g: number): RestMesh {
  const f = (x: number, y: number, z: number) => pieceSdf(an, planes, x, y, z);
  const ox = lo[0] - 2 * g, oy = lo[1] - 2 * g, oz = lo[2] - 2 * g;
  const nx = Math.ceil((hi[0] - ox + 2 * g) / g), ny = Math.ceil((hi[1] - oy + 2 * g) / g), nz = Math.ceil((hi[2] - oz + 2 * g) / g);
  const sx = nx + 1, sxy = (nx + 1) * (ny + 1);
  const val = new Float32Array(sxy * (nz + 1));
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++)
    val[i + sx * j + sxy * k] = f(ox + i * g, oy + j * g, oz + k * g);

  // One vertex per cell that straddles the surface.
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const verts: number[] = [];
  const creaseOf: number[] = [];
  const cube = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const cubeEdges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) {
      cv[c] = val[i + cube[c][0] + sx * (j + cube[c][1]) + sxy * (k + cube[c][2])];
      if (cv[c] < 0) neg++;
    }
    if (neg === 0 || neg === 8) continue;
    let px = 0, py = 0, pz = 0, cnt = 0;
    for (const [a, b] of cubeEdges) {
      if (cv[a] < 0 === cv[b] < 0) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      px += cube[a][0] + t * (cube[b][0] - cube[a][0]);
      py += cube[a][1] + t * (cube[b][1] - cube[a][1]);
      pz += cube[a][2] + t * (cube[b][2] - cube[a][2]);
      cnt++;
    }
    let x = ox + (i + px / cnt) * g, y = oy + (j + py / cnt) * g, z = oz + (k + pz / cnt) * g;
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      if (Math.abs(d) < 1e-5) break;
      const n = gradient(f, x, y, z);
      x -= d * n[0]; y -= d * n[1]; z -= d * n[2];
    }
    cellVert[i + nx * (j + ny * k)] = verts.length / 3;
    verts.push(x, y, z);
    // Does this cell straddle a knife crease (both the cell surface and a plane cross it)?
    let crease = -1;
    if (planes.length) {
      let cNeg = 0;
      for (const cc of cube) if (cellSdf(an, ox + (i + cc[0]) * g, oy + (j + cc[1]) * g, oz + (k + cc[2]) * g) < 0) cNeg++;
      if (cNeg > 0 && cNeg < 8) {
        planes.forEach((pl, pi) => {
          let pNeg = 0;
          for (const cc of cube) if (planeDist(pl, ox + (i + cc[0]) * g, oy + (j + cc[1]) * g, oz + (k + cc[2]) * g) < 0) pNeg++;
          if (pNeg > 0 && pNeg < 8 && crease < 0) crease = pi;
        });
      }
    }
    creaseOf.push(crease);
  }

  // A quad around every grid edge that crosses the surface.
  const tris: number[] = [];
  const cellAt = (i: number, j: number, k: number) => cellVert[i + nx * (j + ny * k)];
  // Quads are wound so their normal points along +axis; flip when the edge runs outside → inside.
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) [b, d] = [d, b];
    // split along the shorter diagonal
    const dac = dist2(verts, a, c), dbd = dist2(verts, b, d);
    if (dac < dbd) tris.push(a, b, c, a, c, d); else tris.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const v0 = val[i + sx * j + sxy * k] < 0;
    if (v0 !== val[i + 1 + sx * j + sxy * k] < 0) quad(cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k), !v0);
    if (v0 !== val[i + sx * (j + 1) + sxy * k] < 0) quad(cellAt(i - 1, j, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i - 1, j, k), v0);
    if (v0 !== val[i + sx * j + sxy * (k + 1)] < 0) quad(cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k), !v0);
  }

  // Pull vertices of crease cells exactly onto the crease, so the rim is a clean curve.
  const nv = verts.length / 3;
  const cf0 = (x: number, y: number, z: number) => cellSdf(an, x, y, z);
  for (let v = 0; v < nv; v++) {
    if (creaseOf[v] < 0) continue;
    const pl = planes[creaseOf[v]];
    let x = verts[3 * v], y = verts[3 * v + 1], z = verts[3 * v + 2];
    for (let it = 0; it < 6; it++) {
      const c = cf0(x, y, z), n = gradient(cf0, x, y, z);
      x -= c * n[0]; y -= c * n[1]; z -= c * n[2];
      const d = planeDist(pl, x, y, z);
      x -= d * pl.n[0]; y -= d * pl.n[1]; z -= d * pl.n[2];
    }
    verts[3 * v] = x; verts[3 * v + 1] = y; verts[3 * v + 2] = z;
  }

  // Classify vertices: -1 on the natural cell surface, p on knife plane p.
  const cls = new Int8Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = verts[3 * v], y = verts[3 * v + 1], z = verts[3 * v + 2];
    let best = cellSdf(an, x, y, z) + 2e-3, c = -1;
    planes.forEach((pl, p) => { const d = planeDist(pl, x, y, z); if (d > best) { best = d; c = p; } });
    cls[v] = c;
  }

  // Orient outward, group triangles, duplicate crease vertices per group.
  const outPos: number[] = [], outCut: number[] = [], outIdx: number[] = [], outNrm: number[] = [];
  const cf = (x: number, y: number, z: number) => cellSdf(an, x, y, z);
  const slot = new Map<number, number>();
  const G = planes.length + 1;
  const emit = (v: number, group: number) => {
    const key = v * G + group + 1;
    let o = slot.get(key);
    if (o === undefined) {
      o = outPos.length / 3;
      slot.set(key, o);
      let x = verts[3 * v], y = verts[3 * v + 1], z = verts[3 * v + 2];
      if (group >= 0) { const pl = planes[group], d = planeDist(pl, x, y, z); x -= d * pl.n[0]; y -= d * pl.n[1]; z -= d * pl.n[2]; }
      outPos.push(x, y, z);
      outCut.push(group >= 0 ? 1 : 0);
      // knife faces are flat; the natural surface takes the cell's own gradient, even at the crease
      outNrm.push(...(group >= 0 ? planes[group].n : gradient(cf, x, y, z)));
    }
    return o;
  };
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    // a triangle belongs to whichever surface dominates at its centroid
    let group = -1;
    if (cls[a] >= 0 || cls[b] >= 0 || cls[c] >= 0) {
      const cx = (verts[3 * a] + verts[3 * b] + verts[3 * c]) / 3, cy = (verts[3 * a + 1] + verts[3 * b + 1] + verts[3 * c + 1]) / 3, cz = (verts[3 * a + 2] + verts[3 * b + 2] + verts[3 * c + 2]) / 3;
      let best = cellSdf(an, cx, cy, cz);
      planes.forEach((pl, p) => { const d = planeDist(pl, cx, cy, cz); if (d > best) { best = d; group = p; } });
    }
    outIdx.push(emit(a, group), emit(b, group), emit(c, group));
  }
  return { pos: new Float32Array(outPos), idx: new Uint32Array(outIdx), isCutFace: new Uint8Array(outCut), normal: new Float32Array(outNrm) };
}

function dist2(v: number[], a: number, b: number) {
  return (v[3 * a] - v[3 * b]) ** 2 + (v[3 * a + 1] - v[3 * b + 1]) ** 2 + (v[3 * a + 2] - v[3 * b + 2]) ** 2;
}


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
export function embedMesh(grid: TetGrid, mesh: RestMesh, material: Material, tolerance: number): SkinMesh | null {
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

export const SKIN_MATERIAL = Mat.Cytoplasm;
