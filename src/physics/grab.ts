// The hand: a soft attachment of a patch of particles to a moving target.

import type { Piece, Vec3 } from '../contracts';

export interface GrabState {
  piece: Piece;
  idx: Uint32Array;
  weight: Float32Array;
  /** Particle offsets from the grab point at the moment of grabbing. */
  offset: Float32Array;
  /** Where the grab point should be now (world). */
  target: Vec3;
  /** Twist applied to the offsets, 3×3 column-major. */
  rot: number[];
  /** XPBD compliance of the attachment. */
  compliance: number;
}

export function startGrab(piece: Piece, point: Vec3, radius = 0.9): GrabState {
  const p = piece.sim.pos;
  const n = p.length / 3;
  let cand: { i: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(p[3 * i] - point[0], p[3 * i + 1] - point[1], p[3 * i + 2] - point[2]);
    if (d < radius) cand.push({ i, d });
  }
  if (cand.length < 6) {
    cand = [];
    for (let i = 0; i < n; i++) cand.push({ i, d: Math.hypot(p[3 * i] - point[0], p[3 * i + 1] - point[1], p[3 * i + 2] - point[2]) });
    cand.sort((a, b) => a.d - b.d);
    cand = cand.slice(0, 6);
    radius = cand[cand.length - 1].d * 1.01;
  }
  const idx = Uint32Array.from(cand, (c) => c.i);
  const weight = Float32Array.from(cand, (c) => Math.max(0.15, 1 - (c.d / radius) ** 2));
  const offset = new Float32Array(idx.length * 3);
  idx.forEach((i, k) => { for (let a = 0; a < 3; a++) offset[3 * k + a] = p[3 * i + a] - point[a]; });
  return { piece, idx, weight, offset, target: [...point], rot: [1, 0, 0, 0, 1, 0, 0, 0, 1], compliance: 2e-5 };
}

export function applyGrab(g: GrabState, sdt: number) {
  const { pos, invMass } = g.piece.sim;
  const R = g.rot, at = g.compliance / (sdt * sdt);
  for (let k = 0; k < g.idx.length; k++) {
    const i = g.idx[k], w = invMass[i];
    if (w === 0) continue;
    const ox = g.offset[3 * k], oy = g.offset[3 * k + 1], oz = g.offset[3 * k + 2];
    const tx = g.target[0] + R[0] * ox + R[3] * oy + R[6] * oz;
    const ty = g.target[1] + R[1] * ox + R[4] * oy + R[7] * oz;
    const tz = g.target[2] + R[2] * ox + R[5] * oy + R[8] * oz;
    const s = (w / (w + at)) * g.weight[k];
    pos[3 * i] += (tx - pos[3 * i]) * s;
    pos[3 * i + 1] += (ty - pos[3 * i + 1]) * s;
    pos[3 * i + 2] += (tz - pos[3 * i + 2]) * s;
  }
}
