// A piece = the cell clipped by its knife planes, as one or more soft bodies
// (a plane can leave two disconnected chunks, which become separate pieces).

import type { Anatomy, Piece, Plane, SimMesh, SkinMesh } from '../contracts';
import { buildSimMesh, finishSimMesh, tetComponents } from './tetgen';
import { buildSkinGeometry, embedMesh, TetGrid, updateSkin, SKIN_MATERIAL } from './surface';
import { mergeMeshes, organelleTemplates, type OrganelleTemplate } from './organelleMesh';
import { pieceSdf } from '../anatomy/sdf';

/** How far outside its tet (in barycentric units) a skin vertex may sit. */
const EMBED_TOLERANCE = 0.6;

const templateCache = new WeakMap<Anatomy, OrganelleTemplate[]>();
function templates(an: Anatomy) {
  let t = templateCache.get(an);
  if (!t) { t = organelleTemplates(an); templateCache.set(an, t); }
  return t;
}

export function buildPieces(an: Anatomy, planes: Plane[], nextId: () => number): Piece[] {
  const whole = buildSimMesh(an, planes);
  if (whole.tets.length === 0) return [];
  const label = tetComponents(whole.tets, whole.restPos.length / 3);
  const groups = new Map<number, number[]>();
  for (let t = 0; t < label.length; t++) {
    const g = groups.get(label[t]) ?? [];
    for (let k = 0; k < 4; k++) g.push(whole.tets[4 * t + k]);
    groups.set(label[t], g);
  }
  const sims: SimMesh[] = groups.size === 1 ? [whole] : [...groups.values()].map((g) => finishSimMesh(an, whole.restPos, Uint32Array.from(g), whole.spacing));

  const { lo, hi } = bounds(whole.restPos);
  const skinGeom = buildSkinGeometry(an, planes, lo, hi, an.mesh.skinGrid);

  const pieces: Piece[] = [];
  for (const sim of sims.sort((a, b) => b.tets.length - a.tets.length)) {
    const grid = new TetGrid(sim);
    const skin = embedMesh(grid, skinGeom, SKIN_MATERIAL, EMBED_TOLERANCE);
    if (!skin) continue;
    updateSkin(skin, sim);
    pieces.push({ id: nextId(), planes, sim, skin, organelles: buildOrganelles(an, planes, sim, grid) });
  }
  return pieces;
}

function buildOrganelles(an: Anatomy, planes: Plane[], sim: SimMesh, grid: TetGrid): SkinMesh[] {
  // Keep organelles that reach into this piece; the shader clips them at the knife planes.
  const byMat = new Map<number, OrganelleTemplate['mesh'][]>();
  for (const t of templates(an)) {
    const p = t.mesh.pos;
    let hit = false;
    for (let v = 0; v < p.length && !hit; v += 3) {
      if (pieceSdf(an, planes, p[v], p[v + 1], p[v + 2]) < 0 && grid.locate(p[v], p[v + 1], p[v + 2]).minBary > -0.3) hit = true;
    }
    if (hit) byMat.set(t.material, [...(byMat.get(t.material) ?? []), t.mesh]);
  }
  const out: SkinMesh[] = [];
  for (const [material, meshes] of byMat) {
    const m = embedMesh(grid, mergeMeshes(meshes), material as SkinMesh['material'], Infinity);
    if (m) { updateSkin(m, sim); out.push(m); }
  }
  return out;
}

export function buildPiece(an: Anatomy, planes: Plane[], id: number): Piece {
  const [p] = buildPieces(an, planes, () => id);
  return p;
}

function bounds(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi };
}
