// A piece = a body clipped by its knife planes, as one or more soft bodies
// (a plane can leave two disconnected chunks, which become separate pieces).

import type { Piece, PieceSource, Plane, SimMesh } from '../contracts';
import { buildSimMesh, finishSimMesh, tetComponents } from './tetgen';
import { buildSkinGeometry } from './surface';
import { embedMesh, TetGrid, updateSkin } from './embed';

/** How far outside its tet (in barycentric units) a skin vertex may sit. */
const EMBED_TOLERANCE = 0.6;

export function buildPieces(source: PieceSource, planes: Plane[], nextId: () => number): Piece[] {
  const shape = source.shape(planes);
  const whole = buildSimMesh(shape);
  if (whole.tets.length === 0) return [];
  const label = tetComponents(whole.tets, whole.restPos.length / 3);
  const groups = new Map<number, number[]>();
  for (let t = 0; t < label.length; t++) {
    const g = groups.get(label[t]) ?? [];
    for (let k = 0; k < 4; k++) g.push(whole.tets[4 * t + k]);
    groups.set(label[t], g);
  }
  const sims: SimMesh[] = groups.size === 1 ? [whole] : [...groups.values()].map((g) => finishSimMesh(shape.material, whole.restPos, Uint32Array.from(g), whole.spacing));

  const { lo, hi } = bounds(whole.restPos);
  const skinGeom = buildSkinGeometry(shape, lo, hi, shape.mesh.skinGrid);

  const pieces: Piece[] = [];
  for (const sim of sims.sort((a, b) => b.tets.length - a.tets.length)) {
    const grid = new TetGrid(sim);
    const skin = embedMesh(grid, skinGeom, source.skinMaterial, EMBED_TOLERANCE);
    if (!skin) continue;
    updateSkin(skin, sim);
    pieces.push({ id: nextId(), planes, sim, skin, organelles: source.organelles?.(planes, sim, grid) ?? [] });
  }
  return pieces;
}

export function buildPiece(source: PieceSource, planes: Plane[], id: number): Piece {
  const [p] = buildPieces(source, planes, () => id);
  return p;
}

function bounds(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi };
}
