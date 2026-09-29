// Cutting: a world-space blade plane is carried into each piece's rest space by
// its best-fit rigid pose, and pieces it crosses are rebuilt as two fresh soft bodies.

import type { Anatomy, CutChild, CutPlan, Piece, Plane, SimMesh, Vec3 } from '../contracts';
import { extractRotation } from '../math/mat3';
import { buildPieces } from '../mesh/piece';
import { embedPoints, TetGrid } from '../mesh/surface';

export interface Pose {
  /** Rotation, 3×3 column-major: world ≈ R·(rest − C) + c. */
  R: number[];
  c: Vec3;
  C: Vec3;
}

/** A piece must keep at least this much rest volume on each side to be split (µm³). */
const MIN_SIDE_VOLUME = 0.6;

export function bestFitPose(s: SimMesh): Pose {
  const n = s.invMass.length;
  const c: Vec3 = [0, 0, 0], C: Vec3 = [0, 0, 0];
  let M = 0;
  for (let i = 0; i < n; i++) {
    const m = s.invMass[i] > 0 ? 1 / s.invMass[i] : 0;
    M += m;
    for (let k = 0; k < 3; k++) { c[k] += m * s.pos[3 * i + k]; C[k] += m * s.restPos[3 * i + k]; }
  }
  for (let k = 0; k < 3; k++) { c[k] /= M; C[k] /= M; }
  // A = Σ m (x − c)(X − C)ᵀ, column-major
  const A = new Array(9).fill(0);
  for (let i = 0; i < n; i++) {
    const m = s.invMass[i] > 0 ? 1 / s.invMass[i] : 0;
    const x = [s.pos[3 * i] - c[0], s.pos[3 * i + 1] - c[1], s.pos[3 * i + 2] - c[2]];
    const X = [s.restPos[3 * i] - C[0], s.restPos[3 * i + 1] - C[1], s.restPos[3 * i + 2] - C[2]];
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) A[3 * col + row] += m * x[row] * X[col];
  }
  return { R: extractRotation(A, [0, 0, 0, 1], 40), c, C };
}

/** The world plane n·x = d expressed in a piece's rest space. */
export function planeToRest(world: Plane, pose: Pose): Plane {
  const { R, c, C } = pose;
  const n = world.n;
  const nr: Vec3 = [
    R[0] * n[0] + R[1] * n[1] + R[2] * n[2],
    R[3] * n[0] + R[4] * n[1] + R[5] * n[2],
    R[6] * n[0] + R[7] * n[1] + R[8] * n[2],
  ];
  const d = world.d - (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) + (nr[0] * C[0] + nr[1] * C[1] + nr[2] * C[2]);
  return { n: nr, d };
}

/** Rest volume of a piece on each side of a rest plane, by tet centroids. */
function sideVolumes(s: SimMesh, pl: Plane): [number, number] {
  let neg = 0, pos = 0;
  for (let t = 0; t < s.restVol.length; t++) {
    let d = 0;
    for (let k = 0; k < 4; k++) {
      const i = 3 * s.tets[4 * t + k];
      d += (pl.n[0] * s.restPos[i] + pl.n[1] * s.restPos[i + 1] + pl.n[2] * s.restPos[i + 2] - pl.d) / 4;
    }
    if (d < 0) neg += s.restVol[t]; else pos += s.restVol[t];
  }
  return [neg, pos];
}

/** A piece the blade crosses, with the blade carried into its rest space. */
export interface SplitJob {
  parent: Piece;
  rest: Plane;
}

/** The cheap half of planning: which pieces the plane really splits, and where in rest space. */
export function findSplits(pieces: Piece[], world: Plane): SplitJob[] {
  const jobs: SplitJob[] = [];
  for (const parent of pieces) {
    const rest = planeToRest(world, bestFitPose(parent.sim));
    const [a, b] = sideVolumes(parent.sim, rest);
    if (a >= MIN_SIDE_VOLUME && b >= MIN_SIDE_VOLUME) jobs.push({ parent, rest });
  }
  return jobs;
}

/** The expensive half: both sides rebuilt as fresh pieces, embedded in the parent's rest mesh. */
export function buildChildren(an: Anatomy, parent: Pick<SimMesh, 'restPos' | 'tets' | 'restInv' | 'spacing'>, parentPlanes: Plane[], rest: Plane, nextId: () => number): CutChild[] {
  const flipped: Plane = { n: [-rest.n[0], -rest.n[1], -rest.n[2]], d: -rest.d };
  const grid = new TetGrid(parent as SimMesh);
  const children: CutChild[] = [];
  for (const side of [rest, flipped]) {
    for (const piece of buildPieces(an, [...parentPlanes, side], nextId)) {
      const e = embedPoints(grid, piece.sim.restPos);
      children.push({ piece, tetId: e.tetId, bary: e.bary });
    }
  }
  return children;
}

export function planCut(an: Anatomy, pieces: Piece[], world: Plane, nextId: () => number): CutPlan {
  const plan: CutPlan = { world, splits: [] };
  for (const { parent, rest } of findSplits(pieces, world)) {
    const children = buildChildren(an, parent.sim, parent.planes, rest, nextId);
    if (children.length >= 2) plan.splits.push({ parent, children });
  }
  return plan;
}

/** Hands each child the current position and velocity of the flesh it came from. */
export function transferState(parent: SimMesh, child: CutChild) {
  const s = child.piece.sim, T = parent.tets;
  for (let i = 0; i < s.invMass.length; i++) {
    const t = 4 * child.tetId[i];
    for (let k = 0; k < 3; k++) {
      let x = 0, v = 0;
      for (let j = 0; j < 4; j++) {
        const w = child.bary[4 * i + j], p = 3 * T[t + j] + k;
        x += w * parent.pos[p];
        v += w * parent.vel[p];
      }
      s.pos[3 * i + k] = x;
      s.prevPos[3 * i + k] = x;
      s.vel[3 * i + k] = v;
    }
  }
}

/** Swaps split parents for their children, which take over the parents' motion. */
export function applyCut(pieces: Piece[], plan: CutPlan): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    const split = plan.splits.find((s) => s.parent === p);
    if (!split) { out.push(p); continue; }
    for (const child of split.children) {
      transferState(p.sim, child);
      out.push(child.piece);
    }
  }
  return out;
}
