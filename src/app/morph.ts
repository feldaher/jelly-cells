// Stage morphing by keyframes: the cell is re-meshed at a slightly later stage and
// the new mesh takes over from the old one. Each new particle starts at the flesh
// of the old shape it corresponds to, so the new mesh begins in the old shape and
// its own elasticity carries it the rest of the way (see docs/morph-micrographs-physics-modal.md).

import type { CellTypeId, CutChild, Piece, SimMesh, Vec3 } from '../contracts';
import { anatomyOf } from '../cells';
import { buildPiece } from '../mesh/piece';
import { TetGrid } from '../mesh/surface';
import { cellSdf, gradient } from '../anatomy/sdf';
import { transferState } from '../cut/cut';

export interface MorphRequest {
  cellType: CellTypeId;
  seed: number;
  /** Stage of the mesh being replaced, and of the keyframe to build. */
  from: number;
  to: number;
  old: Pick<SimMesh, 'restPos' | 'tets' | 'restInv' | 'spacing'>;
}

/** Stages per second: while playing, and when the slider is moved. */
export const MORPH_RATE = { play: 1 / 3.5, step: 1 / 1.2 };
/** Sim time between keyframes when they are built on the main thread (no worker). */
export const KEYFRAME_DT = 0.15;

/**
 * Builds the cell at stage `to` and embeds each of its particles in the old rest mesh
 * at the point it pulls back to: X − (d_from(X) − d_to(X))·∇d_from(X), which keeps
 * its depth under the surface while the surface moves from the new shape to the old.
 */
export function buildKeyframe(req: MorphRequest): CutChild {
  const A = anatomyOf(req.cellType, req.seed, req.from), B = anatomyOf(req.cellType, req.seed, req.to);
  const piece = buildPiece(B, [], 0);
  const X = piece.sim.restPos, n = X.length / 3;
  const grid = new TetGrid(req.old as SimMesh);
  const tetId = new Uint32Array(n), bary = new Float32Array(4 * n);
  const dA = (x: number, y: number, z: number) => cellSdf(A, x, y, z);
  let firstTetOf: Int32Array | null = null;
  const b = new Float64Array(4);
  for (let i = 0; i < n; i++) {
    const p: Vec3 = [X[3 * i], X[3 * i + 1], X[3 * i + 2]];
    const shift = dA(...p) - cellSdf(B, ...p);
    if (Math.abs(shift) > 1e-6) {
      const g = gradient(dA, ...p);
      for (let k = 0; k < 3; k++) p[k] -= shift * g[k];
    }
    let { tet } = grid.locate(...p);
    if (tet < 0) {
      // too far out for the grid search: use a tet at the nearest old particle, extrapolated
      firstTetOf ??= firstTets(req.old);
      tet = firstTetOf[nearest(req.old.restPos, p)];
    }
    grid.bary(tet, p[0], p[1], p[2], b);
    tetId[i] = tet;
    bary.set(b, 4 * i);
  }
  return { piece, tetId, bary };
}

/** Hands the keyframe the current motion of the old flesh and returns it, ready to swap in. */
export function applyKeyframe(old: Piece, kf: CutChild): Piece {
  transferState(old.sim, kf);
  return kf.piece;
}

function firstTets(s: Pick<SimMesh, 'restPos' | 'tets'>): Int32Array {
  const out = new Int32Array(s.restPos.length / 3).fill(-1);
  for (let t = 0; t < s.tets.length / 4; t++) for (let k = 0; k < 4; k++) if (out[s.tets[4 * t + k]] < 0) out[s.tets[4 * t + k]] = t;
  return out;
}

function nearest(P: Float32Array, p: Vec3): number {
  let best = 0, d = Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const e = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2;
    if (e < d) { d = e; best = i / 3; }
  }
  return best;
}
