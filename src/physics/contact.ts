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
    let g = 0;
    pieces.forEach((p, pi) => {
      const P = p.sim.pos;
      for (let i = 0; i < p.sim.invMass.length; i++, g++) {
        keys[g] = this.hash(Math.floor(P[3 * i] * inv), Math.floor(P[3 * i + 1] * inv), Math.floor(P[3 * i + 2] * inv));
        start[keys[g]]++;
        this.owner[g] = pi; this.local[g] = i;
      }
    });
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
