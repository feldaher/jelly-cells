// Floor contact with Coulomb friction, and particle–particle contact between pieces.

import type { Piece, SimMesh } from '../contracts';

export function floorContact(s: SimMesh, friction: number) {
  const { pos, prevPos, invMass } = s;
  for (let i = 0, n = invMass.length; i < n; i++) {
    const y = pos[3 * i + 1];
    if (y >= 0 || invMass[i] === 0) continue;
    const pen = -y;
    pos[3 * i + 1] = 0;
    const dx = pos[3 * i] - prevPos[3 * i], dz = pos[3 * i + 2] - prevPos[3 * i + 2];
    const dt = Math.hypot(dx, dz);
    if (dt < friction * pen) {
      pos[3 * i] = prevPos[3 * i];
      pos[3 * i + 2] = prevPos[3 * i + 2];
    } else if (dt > 0) {
      const f = Math.min(1, (friction * pen) / dt);
      pos[3 * i] -= dx * f;
      pos[3 * i + 2] -= dz * f;
    }
  }
}

/** Rest-space depth of every particle below its piece's surface (≤ 0), plus each tet's boundary face. */
interface Depth {
  phi: Float32Array;
  /** Particles on the surface: the only ones that can enter another piece first. */
  surface: Uint32Array;
  /** Per tet: index (0–3) of the vertex opposite a boundary face, or −1. */
  faceOpp: Int8Array;
}
const depths = new WeakMap<SimMesh, Depth>();

function depthOf(s: SimMesh): Depth {
  let d = depths.get(s);
  if (d) return d;
  const T = s.tets, nt = T.length / 4, R = s.restPos;
  const faces = new Map<string, number>();
  const key = (t: number, opp: number) => {
    const v: number[] = [];
    for (let k = 0; k < 4; k++) if (k !== opp) v.push(T[4 * t + k]);
    return v.sort((a, b) => a - b).join(',');
  };
  for (let t = 0; t < nt; t++) for (let o = 0; o < 4; o++) { const k = key(t, o); faces.set(k, (faces.get(k) ?? 0) + 1); }
  const faceOpp = new Int8Array(nt).fill(-1);
  const onSurface = new Uint8Array(s.invMass.length);
  for (let t = 0; t < nt; t++) for (let o = 0; o < 4; o++) {
    if (faces.get(key(t, o)) !== 1) continue;
    faceOpp[t] = o;
    for (let k = 0; k < 4; k++) if (k !== o) onSurface[T[4 * t + k]] = 1;
  }
  const surf: number[] = [];
  onSurface.forEach((b, i) => { if (b) surf.push(i); });
  const phi = new Float32Array(s.invMass.length);
  for (let i = 0; i < phi.length; i++) {
    if (onSurface[i]) continue;
    let m = Infinity;
    for (const j of surf) m = Math.min(m, (R[3 * i] - R[3 * j]) ** 2 + (R[3 * i + 1] - R[3 * j + 1]) ** 2 + (R[3 * i + 2] - R[3 * j + 2]) ** 2);
    phi[i] = -Math.sqrt(m);
  }
  d = { phi, surface: Uint32Array.from(surf), faceOpp };
  depths.set(s, d);
  return d;
}

/** Largest push-out applied to one particle in one substep, as a fraction of the lattice spacing. */
const MAX_EJECT = 0.3;
/** Coulomb friction between pieces. */
const PIECE_FRICTION = 0.6;

/**
 * Keeps pieces solid to each other: any particle found inside another piece's (deformed)
 * tetrahedra is pushed back out through that piece's surface, and the tet is pushed the
 * other way. Depth and direction come from the rest-space depth field, carried through
 * the tet's current deformation.
 */
export class SolidContact {
  /** Hash slots for the tet index; a collision only costs an extra containment test. */
  private readonly tableSize = 1 << 11;
  private start = new Int32Array(this.tableSize + 1);
  private items = new Int32Array(0);
  private pairs = new Int32Array(0);
  /** Current inverse edge matrix per tet of the piece being indexed. */
  private inv = new Float64Array(0);
  private lo = new Float64Array(3);
  private hi = new Float64Array(3);
  private e = new Float64Array(9);

  private hash(i: number, j: number, k: number) {
    return (Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ Math.imul(k, 283923481)) & (this.tableSize - 1);
  }

  solve(pieces: Piece[]) {
    if (pieces.length < 2) return;
    const boxes = pieces.map((p) => box(p.sim.pos));
    for (let b = 0; b < pieces.length; b++) {
      // Only the part of b that other pieces reach into needs indexing.
      const reach = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let a = 0; a < pieces.length; a++) {
        if (a === b || !overlaps(boxes[a], boxes[b])) continue;
        for (let k = 0; k < 3; k++) {
          reach[k] = Math.min(reach[k], Math.max(boxes[a][k], boxes[b][k]));
          reach[3 + k] = Math.max(reach[3 + k], Math.min(boxes[a][3 + k], boxes[b][3 + k]));
        }
      }
      if (reach[0] > reach[3]) continue;
      this.index(pieces[b].sim, reach);
      for (let a = 0; a < pieces.length; a++) {
        if (a !== b && overlaps(boxes[a], reach)) this.eject(pieces[a].sim, pieces[b].sim, reach);
      }
    }
  }

  /** Bins the tets of `s` that touch `region` by their current bounding boxes and inverts their edge matrices. */
  private index(s: SimMesh, region: number[]) {
    const P = s.pos, T = s.tets, nt = T.length / 4, h = s.spacing, ih = 1 / h;
    if (this.inv.length < 9 * nt) this.inv = new Float64Array(9 * nt);
    const start = this.start;
    start.fill(0);
    const lo = this.lo, hi = this.hi, e = this.e;
    let np = 0;
    for (let t = 0; t < nt; t++) {
      const i0 = 3 * T[4 * t];
      for (let r = 0; r < 3; r++) { lo[r] = P[i0 + r]; hi[r] = P[i0 + r]; }
      for (let k = 1; k < 4; k++) for (let r = 0; r < 3; r++) {
        const x = P[3 * T[4 * t + k] + r];
        if (x < lo[r]) lo[r] = x; else if (x > hi[r]) hi[r] = x;
      }
      if (hi[0] < region[0] || hi[1] < region[1] || hi[2] < region[2] || lo[0] > region[3] || lo[1] > region[4] || lo[2] > region[5]) continue;
      for (let c = 0; c < 3; c++) {
        const ic = 3 * T[4 * t + 1 + c];
        for (let r = 0; r < 3; r++) e[3 * c + r] = P[ic + r] - P[i0 + r];
      }
      invert3(e, this.inv, 9 * t);
      for (let i = Math.floor(lo[0] * ih); i <= Math.floor(hi[0] * ih); i++)
        for (let j = Math.floor(lo[1] * ih); j <= Math.floor(hi[1] * ih); j++)
          for (let k = Math.floor(lo[2] * ih); k <= Math.floor(hi[2] * ih); k++) {
            const c = this.hash(i, j, k);
            if (np + 2 > this.pairs.length) { const g = new Int32Array(Math.max(1024, 2 * this.pairs.length)); g.set(this.pairs); this.pairs = g; }
            this.pairs[np++] = c; this.pairs[np++] = t;
            start[c]++;
          }
    }
    for (let c = 1; c <= this.tableSize; c++) start[c] += start[c - 1];
    if (this.items.length < np / 2) this.items = new Int32Array(this.pairs.length / 2);
    for (let q = np - 2; q >= 0; q -= 2) this.items[--start[this.pairs[q]]] = this.pairs[q + 1];
  }

  /** Pushes every surface particle of `a` in `bb` that lies inside a tet of `b` (indexed) back out. */
  private eject(a: SimMesh, b: SimMesh, bb: number[]) {
    const PA = a.pos, QA = a.prevPos, PB = b.pos, QB = b.prevPos, T = b.tets, W = b.invMass;
    const { phi, faceOpp } = depthOf(b);
    const h = b.spacing, ih = 1 / h, cap = MAX_EJECT * h;
    const inv = this.inv, start = this.start, items = this.items;
    const bary = [0, 0, 0, 0];
    for (const i of depthOf(a).surface) {
      const x = PA[3 * i], y = PA[3 * i + 1], z = PA[3 * i + 2];
      if (x < bb[0] || y < bb[1] || z < bb[2] || x > bb[3] || y > bb[4] || z > bb[5]) continue;
      const c = this.hash(Math.floor(x * ih), Math.floor(y * ih), Math.floor(z * ih));
      let best = -1;
      for (let s = start[c]; s < start[c + 1]; s++) {
        const t = items[s], m = 9 * t, i0 = 3 * T[4 * t];
        const dx = x - PB[i0], dy = y - PB[i0 + 1], dz = z - PB[i0 + 2];
        const l1 = inv[m] * dx + inv[m + 3] * dy + inv[m + 6] * dz;
        const l2 = inv[m + 1] * dx + inv[m + 4] * dy + inv[m + 7] * dz;
        const l3 = inv[m + 2] * dx + inv[m + 5] * dy + inv[m + 8] * dz;
        const mn = Math.min(1 - l1 - l2 - l3, l1, l2, l3);
        // tets do not overlap, so the first one containing the point is the one
        if (mn >= 0) { best = t; bary[0] = 1 - l1 - l2 - l3; bary[1] = l1; bary[2] = l2; bary[3] = l3; break; }
      }
      if (best < 0) continue;

      // Outward direction and depth: the gradient of the depth field over the deformed tet.
      const t = best, m = 9 * t;
      const v = [T[4 * t], T[4 * t + 1], T[4 * t + 2], T[4 * t + 3]];
      const p0 = phi[v[0]], g1 = phi[v[1]] - p0, g2 = phi[v[2]] - p0, g3 = phi[v[3]] - p0;
      // ∇φ = Ds⁻ᵀ (φ1−φ0, φ2−φ0, φ3−φ0): rows of Ds⁻¹ are the inv entries (r, ·)
      let nx = inv[m] * g1 + inv[m + 1] * g2 + inv[m + 2] * g3;
      let ny = inv[m + 3] * g1 + inv[m + 4] * g2 + inv[m + 5] * g3;
      let nz = inv[m + 6] * g1 + inv[m + 7] * g2 + inv[m + 8] * g3;
      let gl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      let depth: number;
      if (gl > 1e-6) {
        const f = bary[0] * p0 + bary[1] * phi[v[1]] + bary[2] * phi[v[2]] + bary[3] * phi[v[3]];
        nx /= gl; ny /= gl; nz /= gl;
        depth = -f / gl;
      } else if (faceOpp[t] >= 0) {
        // a tet lying wholly on the surface: leave through its boundary face
        const o = faceOpp[t], f = [0, 1, 2, 3].filter((k) => k !== o).map((k) => 3 * v[k]);
        const ux = PB[f[1]] - PB[f[0]], uy = PB[f[1] + 1] - PB[f[0] + 1], uz = PB[f[1] + 2] - PB[f[0] + 2];
        const wx = PB[f[2]] - PB[f[0]], wy = PB[f[2] + 1] - PB[f[0] + 1], wz = PB[f[2] + 2] - PB[f[0] + 2];
        nx = uy * wz - uz * wy; ny = uz * wx - ux * wz; nz = ux * wy - uy * wx;
        gl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (gl < 1e-12) continue;
        const po = 3 * v[o];
        const toOpp = (PB[po] - PB[f[0]]) * nx + (PB[po + 1] - PB[f[0] + 1]) * ny + (PB[po + 2] - PB[f[0] + 2]) * nz;
        const sgn = toOpp > 0 ? -1 / gl : 1 / gl;
        nx *= sgn; ny *= sgn; nz *= sgn;
        depth = (PB[f[0]] - x) * nx + (PB[f[0] + 1] - y) * ny + (PB[f[0] + 2] - z) * nz;
      } else continue;
      if (depth <= 0) continue;

      const wp = a.invMass[i];
      let ws = wp;
      for (let k = 0; k < 4; k++) ws += W[v[k]] * bary[k] * bary[k];
      if (ws === 0) continue;
      const push = Math.min(depth, cap) / ws;
      PA[3 * i] += wp * push * nx; PA[3 * i + 1] += wp * push * ny; PA[3 * i + 2] += wp * push * nz;
      for (let k = 0; k < 4; k++) {
        const j = 3 * v[k], s = W[v[k]] * bary[k] * push;
        PB[j] -= s * nx; PB[j + 1] -= s * ny; PB[j + 2] -= s * nz;
      }

      // Friction: cancel some of the sliding between the particle and the surface it touches.
      let rx = PA[3 * i] - QA[3 * i], ry = PA[3 * i + 1] - QA[3 * i + 1], rz = PA[3 * i + 2] - QA[3 * i + 2];
      for (let k = 0; k < 4; k++) {
        const j = 3 * v[k];
        rx -= bary[k] * (PB[j] - QB[j]); ry -= bary[k] * (PB[j + 1] - QB[j + 1]); rz -= bary[k] * (PB[j + 2] - QB[j + 2]);
      }
      const rn = rx * nx + ry * ny + rz * nz;
      rx -= rn * nx; ry -= rn * ny; rz -= rn * nz;
      const slide = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (slide < 1e-12) continue;
      const fr = Math.min(1, (PIECE_FRICTION * Math.min(depth, cap)) / slide) / ws;
      PA[3 * i] -= wp * fr * rx; PA[3 * i + 1] -= wp * fr * ry; PA[3 * i + 2] -= wp * fr * rz;
      for (let k = 0; k < 4; k++) {
        const j = 3 * v[k], s = W[v[k]] * bary[k] * fr;
        PB[j] += s * rx; PB[j + 1] += s * ry; PB[j + 2] += s * rz;
      }
    }
  }
}

function box(P: Float32Array): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
    if (P[i + k] < b[k]) b[k] = P[i + k];
    if (P[i + k] > b[3 + k]) b[3 + k] = P[i + k];
  }
  return b;
}

function grow(b: number[], m: number) {
  return [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
}

function overlaps(a: number[], b: number[]) {
  return a[0] <= b[3] && b[0] <= a[3] && a[1] <= b[4] && b[1] <= a[4] && a[2] <= b[5] && b[2] <= a[5];
}

/** Inverse of a 3×3 column-major matrix, written column-major into out at o (zeros if singular). */
function invert3(e: Float64Array, out: Float64Array, o: number) {
  // columns (a b c), (d f g), (h k l)
  const a = e[0], b = e[1], c = e[2], d = e[3], f = e[4], g = e[5], h = e[6], k = e[7], l = e[8];
  const A = f * l - g * k, B = g * h - d * l, C = d * k - f * h;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) { out.fill(0, o, o + 9); return; }
  const id = 1 / det;
  out[o] = A * id; out[o + 1] = (c * k - b * l) * id; out[o + 2] = (b * g - c * f) * id;
  out[o + 3] = B * id; out[o + 4] = (a * l - c * h) * id; out[o + 5] = (c * d - a * g) * id;
  out[o + 6] = C * id; out[o + 7] = (b * h - a * k) * id; out[o + 8] = (a * f - b * d) * id;
}

/** Largest separation applied to one contact pair in one substep (µm). */
const MAX_PUSH = 0.012;
/** Seconds over which contact between sibling pieces eases in. */
const EASE_IN = 0.6;

/** Reusable spatial hash over all particles of all pieces. */
export class PieceCollider {
  private cellStart = new Int32Array(0);
  private sorted = new Int32Array(0);
  private owner = new Int32Array(0);
  private local = new Int32Array(0);
  private readonly tableSize = 1 << 15;

  constructor(public radius: number) {}

  private hash(i: number, j: number, k: number) {
    return (Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ Math.imul(k, 283923481)) & (this.tableSize - 1);
  }

  /**
   * Pushes apart particles of different pieces closer than `radius`. Halves from the same
   * cut start interpenetrating along the knife face, so their contact radius eases in.
   */
  solve(pieces: Piece[], time = Infinity) {
    if (pieces.length < 2) return;
    const D = this.radius, inv = 1 / D;
    let n = 0;
    for (const p of pieces) n += p.sim.invMass.length;
    if (this.sorted.length < n) { this.sorted = new Int32Array(n); this.owner = new Int32Array(n); this.local = new Int32Array(n); }
    if (this.cellStart.length !== this.tableSize + 1) this.cellStart = new Int32Array(this.tableSize + 1);
    const start = this.cellStart;
    start.fill(0);
    const keys = new Int32Array(n);
    // Only particles where a piece comes within reach of another can touch anything.
    const boxes = pieces.map((p) => box(p.sim.pos));
    const reach = boxes.map((bb, pi) => {
      const r = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      boxes.forEach((o, oi) => {
        if (oi === pi || !overlaps(grow(bb, D), o)) return;
        for (let k = 0; k < 3; k++) { r[k] = Math.min(r[k], o[k] - D); r[3 + k] = Math.max(r[3 + k], o[3 + k] + D); }
      });
      return r;
    });
    let g = 0;
    pieces.forEach((p, pi) => {
      const P = p.sim.pos, r = reach[pi];
      if (r[0] > r[3]) return;
      for (let i = 0; i < p.sim.invMass.length; i++) {
        const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
        if (x < r[0] || y < r[1] || z < r[2] || x > r[3] || y > r[4] || z > r[5]) continue;
        keys[g] = this.hash(Math.floor(x * inv), Math.floor(y * inv), Math.floor(z * inv));
        start[keys[g]]++;
        this.owner[g] = pi; this.local[g] = i;
        g++;
      }
    });
    n = g;
    for (let c = 1; c <= this.tableSize; c++) start[c] += start[c - 1];
    for (let q = n - 1; q >= 0; q--) this.sorted[--start[keys[q]]] = q;

    const D2 = D * D;
    for (let q = 0; q < n; q++) {
      const pa = pieces[this.owner[q]].sim, ia = this.local[q];
      const A = pa.pos;
      const cx = Math.floor(A[3 * ia] * inv), cy = Math.floor(A[3 * ia + 1] * inv), cz = Math.floor(A[3 * ia + 2] * inv);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
        const h = this.hash(cx + di, cy + dj, cz + dk);
        for (let s = start[h]; s < start[h + 1]; s++) {
          const r = this.sorted[s];
          if (r <= q || this.owner[r] === this.owner[q]) continue;
          const PA = pieces[this.owner[q]], PB = pieces[this.owner[r]];
          const pb = PB.sim, ib = this.local[r];
          const B = pb.pos;
          const dx = B[3 * ib] - A[3 * ia], dy = B[3 * ib + 1] - A[3 * ia + 1], dz = B[3 * ib + 2] - A[3 * ia + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= D2 || d2 < 1e-12) continue;
          let Dp = D;
          if (PA.cutGroup !== undefined && PA.cutGroup === PB.cutGroup) {
            Dp = D * Math.min(1, Math.max(0, (time - (PA.bornAt ?? 0)) / EASE_IN));
            if (d2 >= Dp * Dp) continue;
          }
          const wa = pa.invMass[ia], wb = pb.invMass[ib], ws = wa + wb;
          if (ws === 0) continue;
          // cap the push so freshly cut, overlapping halves ease apart instead of exploding
          const d = Math.sqrt(d2), corr = Math.min(Dp - d, MAX_PUSH) / d / ws;
          A[3 * ia] -= dx * corr * wa; A[3 * ia + 1] -= dy * corr * wa; A[3 * ia + 2] -= dz * corr * wa;
          B[3 * ib] += dx * corr * wb; B[3 * ib + 1] += dy * corr * wb; B[3 * ib + 2] += dz * corr * wb;
        }
      }
    }
  }
}
