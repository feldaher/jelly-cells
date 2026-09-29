// Scalar fields for the strain and stiffness views: computed per tet, averaged
// onto particles, then carried to the skin by its barycentric weights.

import type { Piece, SimMesh, SimParams, ViewMode } from '../contracts';

/** Strain shown at full colour (30 %). */
export const STRAIN_FULL = 0.3;
/** Stiffness multipliers at the two ends of the (log) colour scale. */
export const STIFF_MIN = 0.5;
export const STIFF_MAX = 5;

/** Green–Lagrange strain magnitude ‖½(FᵀF − I)‖ per tet: zero for any rigid motion. */
export function tetStrain(s: SimMesh): Float32Array {
  const { pos: x, tets: T, restInv: M } = s;
  const out = new Float32Array(T.length / 4);
  for (let t = 0; t < out.length; t++) {
    const i0 = 3 * T[4 * t], i1 = 3 * T[4 * t + 1], i2 = 3 * T[4 * t + 2], i3 = 3 * T[4 * t + 3], m = 9 * t;
    const d1x = x[i1] - x[i0], d1y = x[i1 + 1] - x[i0 + 1], d1z = x[i1 + 2] - x[i0 + 2];
    const d2x = x[i2] - x[i0], d2y = x[i2 + 1] - x[i0 + 1], d2z = x[i2 + 2] - x[i0 + 2];
    const d3x = x[i3] - x[i0], d3y = x[i3 + 1] - x[i0 + 1], d3z = x[i3 + 2] - x[i0 + 2];
    const f = [
      [d1x * M[m] + d2x * M[m + 1] + d3x * M[m + 2], d1y * M[m] + d2y * M[m + 1] + d3y * M[m + 2], d1z * M[m] + d2z * M[m + 1] + d3z * M[m + 2]],
      [d1x * M[m + 3] + d2x * M[m + 4] + d3x * M[m + 5], d1y * M[m + 3] + d2y * M[m + 4] + d3y * M[m + 5], d1z * M[m + 3] + d2z * M[m + 4] + d3z * M[m + 5]],
      [d1x * M[m + 6] + d2x * M[m + 7] + d3x * M[m + 8], d1y * M[m + 6] + d2y * M[m + 7] + d3y * M[m + 8], d1z * M[m + 6] + d2z * M[m + 7] + d3z * M[m + 8]],
    ];
    // C = FᵀF: C_ij = f_i · f_j (columns of F)
    let e2 = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const c = f[i][0] * f[j][0] + f[i][1] * f[j][1] + f[i][2] * f[j][2];
      const e = 0.5 * (c - (i === j ? 1 : 0));
      e2 += e * e;
    }
    out[t] = Math.sqrt(e2);
  }
  return out;
}

/** Stiffness multiplier of each tet's material. */
export function tetStiffness(s: SimMesh, params: SimParams): Float32Array {
  return Float32Array.from(s.tetMaterial, (m) => params.materialStiffness[m] ?? 1);
}

/** Volume-weighted average of a per-tet value onto the particles. */
export function nodalAverage(s: SimMesh, perTet: Float32Array): Float32Array {
  const n = s.invMass.length, sum = new Float32Array(n), w = new Float32Array(n);
  for (let t = 0; t < perTet.length; t++) {
    const v = s.restVol[t];
    for (let k = 0; k < 4; k++) { const i = s.tets[4 * t + k]; sum[i] += perTet[t] * v; w[i] += v; }
  }
  for (let i = 0; i < n; i++) sum[i] = w[i] > 0 ? sum[i] / w[i] : 0;
  return sum;
}

/**
 * Fills `piece.skin.scalar` with the view's value mapped to [0, 1]
 * (strain linearly up to STRAIN_FULL, stiffness on a log scale) and returns it.
 */
export function viewScalars(piece: Piece, mode: Exclude<ViewMode, 'anatomy'>, params: SimParams): Float32Array {
  const s = piece.sim, skin = piece.skin;
  const nodal = nodalAverage(s, mode === 'strain' ? tetStrain(s) : tetStiffness(s, params));
  const map = mode === 'strain'
    ? (v: number) => Math.min(1, v / STRAIN_FULL)
    : (v: number) => Math.min(1, Math.max(0, Math.log(v / STIFF_MIN) / Math.log(STIFF_MAX / STIFF_MIN)));
  const out = skin.scalar && skin.scalar.length === skin.tetId.length ? skin.scalar : new Float32Array(skin.tetId.length);
  for (let v = 0; v < out.length; v++) {
    const t = 4 * skin.tetId[v];
    let x = 0;
    for (let j = 0; j < 4; j++) x += skin.bary[4 * v + j] * nodal[s.tets[t + j]];
    out[v] = map(Math.max(0, x));
  }
  skin.scalar = out;
  return out;
}
