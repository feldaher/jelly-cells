// XPBD soft-body step: co-rotational tetrahedra (each pulled toward its best-fit
// rotated rest shape) plus a volume constraint, floor friction, inter-piece
// contact and damping of relative edge motion.

import type { Piece, SimMesh, SimParams } from '../contracts';
import { applyGrab, type GrabState } from './grab';
import { floorContact, PieceCollider } from './contact';
import { dampingRate, youngFor } from './params';
import { extractRotation } from '../math/mat3';

export interface StepExtras {
  grab?: GrabState | null;
  /** Extra position constraints (e.g. the knife), run every substep after the elastic solve. */
  constrain?: (pieces: Piece[], sdt: number) => void;
  collide?: boolean;
  /** Simulation time at the start of this step (s), for easing in contact between new pieces. */
  time?: number;
}

/** Ratio of the volume stiffness to the shape stiffness: close to incompressible. */
const LAMBDA_OVER_MU = 100;
/** Rotation-extraction iterations per substep (warm-started, so one is plenty). */
const ROT_ITERS = 1;
/** Warm-start rotation (quaternion) per tet, kept between substeps. */
const rotations = new WeakMap<SimMesh, Float64Array>();
function rotationsOf(s: SimMesh) {
  let q = rotations.get(s);
  if (!q) { q = initialRotations(s); rotations.set(s, q); }
  return q;
}

/** Fully converged rotation of every tet's current deformation, so a new piece starts without a jolt. */
function initialRotations(s: SimMesh): Float64Array {
  const nt = s.tets.length / 4, out = new Float64Array(nt * 4);
  const F = new Float64Array(9), Ds = new Float64Array(9);
  for (let t = 0; t < nt; t++) {
    const i0 = 3 * s.tets[4 * t];
    for (let c = 0; c < 3; c++) {
      const ic = 3 * s.tets[4 * t + 1 + c];
      for (let r = 0; r < 3; r++) Ds[3 * c + r] = s.pos[ic + r] - s.pos[i0 + r];
    }
    // F = Ds · Dm⁻¹
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += Ds[3 * k + r] * s.restInv[9 * t + 3 * c + k];
      F[3 * c + r] = v;
    }
    const q = [0, 0, 0, 1];
    extractRotation(F, q, 30);
    out.set(q, 4 * t);
  }
  return out;
}
const collider = new PieceCollider(0.25);

export function step(pieces: Piece[], params: SimParams, dt: number, extra: StepExtras = {}) {
  const n = params.substeps, sdt = dt / n;
  const E = youngFor(params.firmness);
  const mu = E / 3, lambda = mu * LAMBDA_OVER_MU;
  const kDamp = 1 - Math.exp(-dampingRate(params.damping) * sdt);
  let minSpacing = Infinity;
  for (const p of pieces) minSpacing = Math.min(minSpacing, p.sim.spacing);
  collider.radius = 0.5 * minSpacing;

  for (let s = 0; s < n; s++) {
    for (const p of pieces) predict(p.sim, params.gravity, sdt);
    if (extra.grab) applyGrab(extra.grab, sdt);
    for (const p of pieces) solveTets(p.sim, mu, lambda, params.materialStiffness, sdt);
    extra.constrain?.(pieces, sdt);
    if (extra.collide !== false) collider.solve(pieces, (extra.time ?? Infinity) + s * sdt);
    for (const p of pieces) {
      floorContact(p.sim, params.friction);
      updateVelocity(p.sim, sdt);
      dampEdges(p.sim, kDamp);
    }
  }
}

function predict(s: SimMesh, g: number, sdt: number) {
  const { pos, prevPos, vel, invMass } = s;
  for (let i = 0, n = invMass.length; i < n; i++) {
    const j = 3 * i;
    prevPos[j] = pos[j]; prevPos[j + 1] = pos[j + 1]; prevPos[j + 2] = pos[j + 2];
    if (invMass[i] === 0) continue;
    vel[j + 1] -= g * sdt;
    pos[j] += vel[j] * sdt; pos[j + 1] += vel[j + 1] * sdt; pos[j + 2] += vel[j + 2] * sdt;
  }
}

function updateVelocity(s: SimMesh, sdt: number) {
  const { pos, prevPos, vel } = s, inv = 1 / sdt;
  for (let j = 0, n = pos.length; j < n; j++) vel[j] = (pos[j] - prevPos[j]) * inv;
}

function dampEdges(s: SimMesh, k: number) {
  const { pos, vel, invMass, edges } = s;
  for (let e = 0, n = edges.length; e < n; e += 2) {
    const a = edges[e], b = edges[e + 1];
    const wa = invMass[a], wb = invMass[b], ws = wa + wb;
    if (ws === 0) continue;
    const A = 3 * a, B = 3 * b;
    let nx = pos[B] - pos[A], ny = pos[B + 1] - pos[A + 1], nz = pos[B + 2] - pos[A + 2];
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-9) continue;
    nx /= l; ny /= l; nz /= l;
    const vr = (vel[B] - vel[A]) * nx + (vel[B + 1] - vel[A + 1]) * ny + (vel[B + 2] - vel[A + 2]) * nz;
    const d = (k * vr) / ws;
    vel[A] += wa * d * nx; vel[A + 1] += wa * d * ny; vel[A + 2] += wa * d * nz;
    vel[B] -= wb * d * nx; vel[B + 1] -= wb * d * ny; vel[B + 2] -= wb * d * nz;
  }
}

/** One Gauss–Seidel pass over volume then shape constraints of every tet. */
function solveTets(s: SimMesh, mu: number, lambda: number, matStiff: number[], sdt: number) {
  const { pos: x, invMass: W, tets: T, restInv: M, restVol: V, tetMaterial: mat } = s;
  const Q = rotationsOf(s);
  const isdt2 = 1 / (sdt * sdt);
  const g = new Float64Array(12);
  for (let t = 0, nt = V.length; t < nt; t++) {
    const i0 = 3 * T[4 * t], i1 = 3 * T[4 * t + 1], i2 = 3 * T[4 * t + 2], i3 = 3 * T[4 * t + 3];
    const w0 = W[i0 / 3], w1 = W[i1 / 3], w2 = W[i2 / 3], w3 = W[i3 / 3];
    const m = 9 * t;
    const k = matStiff[mat[t]];

    for (let pass = 0; pass < 3; pass++) {
      // F = Ds · Dm⁻¹, stored by columns f0, f1, f2.
      const d1x = x[i1] - x[i0], d1y = x[i1 + 1] - x[i0 + 1], d1z = x[i1 + 2] - x[i0 + 2];
      const d2x = x[i2] - x[i0], d2y = x[i2 + 1] - x[i0 + 1], d2z = x[i2 + 2] - x[i0 + 2];
      const d3x = x[i3] - x[i0], d3y = x[i3 + 1] - x[i0 + 1], d3z = x[i3 + 2] - x[i0 + 2];
      const f0x = d1x * M[m] + d2x * M[m + 1] + d3x * M[m + 2], f0y = d1y * M[m] + d2y * M[m + 1] + d3y * M[m + 2], f0z = d1z * M[m] + d2z * M[m + 1] + d3z * M[m + 2];
      const f1x = d1x * M[m + 3] + d2x * M[m + 4] + d3x * M[m + 5], f1y = d1y * M[m + 3] + d2y * M[m + 4] + d3y * M[m + 5], f1z = d1z * M[m + 3] + d2z * M[m + 4] + d3z * M[m + 5];
      const f2x = d1x * M[m + 6] + d2x * M[m + 7] + d3x * M[m + 8], f2y = d1y * M[m + 6] + d2y * M[m + 7] + d3y * M[m + 8], f2z = d1z * M[m + 6] + d2z * M[m + 7] + d3z * M[m + 8];

      let C: number, alpha: number;
      // P = ∂C/∂F by columns.
      let p0x, p0y, p0z, p1x, p1y, p1z, p2x, p2y, p2z;
      if (pass !== 1) {
        // Volume: C = det F − 1 (solved either side of the shape constraint).
        p0x = f1y * f2z - f1z * f2y; p0y = f1z * f2x - f1x * f2z; p0z = f1x * f2y - f1y * f2x;
        p1x = f2y * f0z - f2z * f0y; p1y = f2z * f0x - f2x * f0z; p1z = f2x * f0y - f2y * f0x;
        p2x = f0y * f1z - f0z * f1y; p2y = f0z * f1x - f0x * f1z; p2z = f0x * f1y - f0y * f1x;
        C = f0x * p0x + f0y * p0y + f0z * p0z - 1;
        alpha = 1 / (lambda * k * V[t]);
      } else {
        // Shape: C = ‖F − R‖ with R the rotation of F (Müller et al. 2016, warm-started).
        const q = 4 * t;
        let qx = Q[q], qy = Q[q + 1], qz = Q[q + 2], qw = Q[q + 3];
        let r00 = 1, r10 = 0, r20 = 0, r01 = 0, r11 = 1, r21 = 0, r02 = 0, r12 = 0, r22 = 1;
        for (let it = 0; it < ROT_ITERS; it++) {
          r00 = 1 - 2 * (qy * qy + qz * qz); r10 = 2 * (qx * qy + qz * qw); r20 = 2 * (qx * qz - qy * qw);
          r01 = 2 * (qx * qy - qz * qw); r11 = 1 - 2 * (qx * qx + qz * qz); r21 = 2 * (qy * qz + qx * qw);
          r02 = 2 * (qx * qz + qy * qw); r12 = 2 * (qy * qz - qx * qw); r22 = 1 - 2 * (qx * qx + qy * qy);
          let ox = (r10 * f0z - r20 * f0y) + (r11 * f1z - r21 * f1y) + (r12 * f2z - r22 * f2y);
          let oy = (r20 * f0x - r00 * f0z) + (r21 * f1x - r01 * f1z) + (r22 * f2x - r02 * f2z);
          let oz = (r00 * f0y - r10 * f0x) + (r01 * f1y - r11 * f1x) + (r02 * f2y - r12 * f2x);
          const dot = r00 * f0x + r10 * f0y + r20 * f0z + r01 * f1x + r11 * f1y + r21 * f1z + r02 * f2x + r12 * f2y + r22 * f2z;
          const sc = 1 / (Math.abs(dot) + 1e-9);
          ox *= sc; oy *= sc; oz *= sc;
          const w = Math.sqrt(ox * ox + oy * oy + oz * oz);
          if (w < 1e-9) break;
          // small-angle half-angle terms; the quaternion is renormalised below
          const h2 = 0.25 * w * w, sh = 0.5 * (1 - h2 / 6), ch = 1 - 0.5 * h2;
          const ax = ox * sh, ay = oy * sh, az = oz * sh;
          const nx = ch * qx + ax * qw + ay * qz - az * qy;
          const ny = ch * qy - ax * qz + ay * qw + az * qx;
          const nz = ch * qz + ax * qy - ay * qx + az * qw;
          const nw = ch * qw - ax * qx - ay * qy - az * qz;
          const l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
          qx = nx * l; qy = ny * l; qz = nz * l; qw = nw * l;
        }
        Q[q] = qx; Q[q + 1] = qy; Q[q + 2] = qz; Q[q + 3] = qw;
        r00 = 1 - 2 * (qy * qy + qz * qz); r10 = 2 * (qx * qy + qz * qw); r20 = 2 * (qx * qz - qy * qw);
        r01 = 2 * (qx * qy - qz * qw); r11 = 1 - 2 * (qx * qx + qz * qz); r21 = 2 * (qy * qz + qx * qw);
        r02 = 2 * (qx * qz + qy * qw); r12 = 2 * (qy * qz - qx * qw); r22 = 1 - 2 * (qx * qx + qy * qy);
        p0x = f0x - r00; p0y = f0y - r10; p0z = f0z - r20;
        p1x = f1x - r01; p1y = f1y - r11; p1z = f1z - r21;
        p2x = f2x - r02; p2y = f2y - r12; p2z = f2z - r22;
        C = Math.sqrt(p0x * p0x + p0y * p0y + p0z * p0z + p1x * p1x + p1y * p1y + p1z * p1z + p2x * p2x + p2y * p2y + p2z * p2z);
        if (C < 1e-9) continue;
        const ic = 1 / C;
        p0x *= ic; p0y *= ic; p0z *= ic; p1x *= ic; p1y *= ic; p1z *= ic; p2x *= ic; p2y *= ic; p2z *= ic;
        alpha = 1 / (2 * mu * k * V[t]);
      }
      // ∂C/∂x_k = P · Dm⁻ᵀ, column k: Σ_c P_c · M[c][k]
      for (let kk = 0; kk < 3; kk++) {
        const a = M[m + kk], b = M[m + 3 + kk], c = M[m + 6 + kk];
        g[3 + 3 * kk] = p0x * a + p1x * b + p2x * c;
        g[4 + 3 * kk] = p0y * a + p1y * b + p2y * c;
        g[5 + 3 * kk] = p0z * a + p1z * b + p2z * c;
      }
      g[0] = -(g[3] + g[6] + g[9]); g[1] = -(g[4] + g[7] + g[10]); g[2] = -(g[5] + g[8] + g[11]);
      const denom =
        w0 * (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) + w1 * (g[3] * g[3] + g[4] * g[4] + g[5] * g[5]) +
        w2 * (g[6] * g[6] + g[7] * g[7] + g[8] * g[8]) + w3 * (g[9] * g[9] + g[10] * g[10] + g[11] * g[11]) + alpha * isdt2;
      if (denom < 1e-12) continue;
      const dl = -C / denom;
      x[i0] += w0 * dl * g[0]; x[i0 + 1] += w0 * dl * g[1]; x[i0 + 2] += w0 * dl * g[2];
      x[i1] += w1 * dl * g[3]; x[i1 + 1] += w1 * dl * g[4]; x[i1 + 2] += w1 * dl * g[5];
      x[i2] += w2 * dl * g[6]; x[i2 + 1] += w2 * dl * g[7]; x[i2 + 2] += w2 * dl * g[8];
      x[i3] += w3 * dl * g[9]; x[i3 + 1] += w3 * dl * g[10]; x[i3 + 2] += w3 * dl * g[11];
    }
  }
}
