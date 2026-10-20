// A cell as the engine sees it: its anatomy as a Shape to mesh, and a PieceSource that adds the
// organelles to every piece.

import { Mat, type Anatomy, type Plane, type SimMesh, type SkinMesh } from '../contracts';
import type { PieceSource, Shape } from '@feldaher/cell-engine/contracts';
import { embedMesh, updateSkin, type TetGrid } from '@feldaher/cell-engine/mesh/embed';
import { mergeMeshes, organelleTemplates, type OrganelleTemplate } from '../mesh/organelleMesh';
import { cellSdf, materialAt, pieceSdf } from './sdf';

/** The cell clipped by its knife planes. Tets inside `cortexDepth` of the surface are wall/cortex. */
export function anatomyShape(an: Anatomy, planes: Plane[]): Shape {
  return {
    sdf: (x, y, z) => pieceSdf(an, planes, x, y, z),
    uncut: (x, y, z) => cellSdf(an, x, y, z),
    planes,
    material: (x, y, z) => materialAt(an, x, y, z, an.cortexDepth),
    bounds: an.bounds,
    mesh: an.mesh,
  };
}

const sources = new WeakMap<Anatomy, PieceSource>();

/** Pieces of this cell: its shape, a cytoplasm skin, and its organelles embedded in each piece. */
export function anatomySource(an: Anatomy): PieceSource {
  let s = sources.get(an);
  if (!s) {
    s = { shape: (planes) => anatomyShape(an, planes), skinMaterial: Mat.Cytoplasm, organelles: (planes, sim, grid) => buildOrganelles(an, planes, sim, grid) };
    sources.set(an, s);
  }
  return s;
}

const templateCache = new WeakMap<Anatomy, OrganelleTemplate[]>();
function templates(an: Anatomy) {
  let t = templateCache.get(an);
  if (!t) { t = organelleTemplates(an); templateCache.set(an, t); }
  return t;
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
    const m = embedMesh(grid, mergeMeshes(meshes), material, Infinity);
    if (m) { updateSkin(m, sim); out.push(m); }
  }
  return out;
}
