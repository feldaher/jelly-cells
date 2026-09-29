import { defaultAnatomy } from '../src/anatomy/anatomy';
import { buildPiece } from '../src/mesh/piece';
import { defaultParams } from '../src/physics/params';
import { step } from '../src/physics/xpbd';
import type { Piece, SimParams } from '../src/contracts';

export const anatomy = defaultAnatomy();

export function freshCell(lift = 0): Piece {
  const p = buildPiece(anatomy, [], 0);
  placeOnFloor(p, lift);
  return p;
}

export function placeOnFloor(p: Piece, lift: number) {
  const s = p.sim;
  let minY = Infinity;
  for (let i = 1; i < s.pos.length; i += 3) minY = Math.min(minY, s.pos[i]);
  for (let i = 1; i < s.pos.length; i += 3) {
    s.pos[i] += lift - minY + 1e-3;
    s.prevPos[i] = s.pos[i];
  }
}

export function simulate(pieces: Piece[], seconds: number, params: SimParams = defaultParams(), extra?: Parameters<typeof step>[3]) {
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) step(pieces, params, 1 / 60, extra);
}

export function bbox(p: Piece) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const a = p.sim.pos;
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], a[i + k]); hi[k] = Math.max(hi[k], a[i + k]);
  }
  return { lo, hi };
}
