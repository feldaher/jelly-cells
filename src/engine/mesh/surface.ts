// The smooth render skin of a piece: surface nets on its shape's SDF. Embedding it in the
// sim mesh is mesh/embed's job.

import type { RestMesh, Shape } from '../contracts';
import { gradient, planeDist } from '../sdf/primitives';

/**
 * Surface nets isosurface of the shape's SDF over the box [lo, hi]. Knife faces are
 * split off from the natural surface (vertices duplicated along the crease) so the
 * edge stays sharp when normals are averaged.
 */
export function buildSkinGeometry(shape: Shape, lo: number[], hi: number[], g: number): RestMesh {
  const f = shape.sdf, uncut = shape.uncut, planes = shape.planes;
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
      for (const cc of cube) if (uncut(ox + (i + cc[0]) * g, oy + (j + cc[1]) * g, oz + (k + cc[2]) * g) < 0) cNeg++;
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
  for (let v = 0; v < nv; v++) {
    if (creaseOf[v] < 0) continue;
    const pl = planes[creaseOf[v]];
    let x = verts[3 * v], y = verts[3 * v + 1], z = verts[3 * v + 2];
    for (let it = 0; it < 6; it++) {
      const c = uncut(x, y, z), n = gradient(uncut, x, y, z);
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
    let best = uncut(x, y, z) + 2e-3, c = -1;
    planes.forEach((pl, p) => { const d = planeDist(pl, x, y, z); if (d > best) { best = d; c = p; } });
    cls[v] = c;
  }

  // Orient outward, group triangles, duplicate crease vertices per group.
  const outPos: number[] = [], outCut: number[] = [], outIdx: number[] = [], outNrm: number[] = [];
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
      outNrm.push(...(group >= 0 ? planes[group].n : gradient(uncut, x, y, z)));
    }
    return o;
  };
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    // a triangle belongs to whichever surface dominates at its centroid
    let group = -1;
    if (cls[a] >= 0 || cls[b] >= 0 || cls[c] >= 0) {
      const cx = (verts[3 * a] + verts[3 * b] + verts[3 * c]) / 3, cy = (verts[3 * a + 1] + verts[3 * b + 1] + verts[3 * c + 1]) / 3, cz = (verts[3 * a + 2] + verts[3 * b + 2] + verts[3 * c + 2]) / 3;
      let best = uncut(cx, cy, cz);
      planes.forEach((pl, p) => { const d = planeDist(pl, cx, cy, cz); if (d > best) { best = d; group = p; } });
    }
    outIdx.push(emit(a, group), emit(b, group), emit(c, group));
  }
  return { pos: new Float32Array(outPos), idx: new Uint32Array(outIdx), isCutFace: new Uint8Array(outCut), normal: new Float32Array(outNrm) };
}

function dist2(v: number[], a: number, b: number) {
  return (v[3 * a] - v[3 * b]) ** 2 + (v[3 * a + 1] - v[3 * b + 1]) ** 2 + (v[3 * a + 2] - v[3 * b + 2]) ** 2;
}
