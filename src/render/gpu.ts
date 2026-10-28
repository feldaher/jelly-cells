// What Jelly Cells gives the engine's renderer: its material slots, wall and bud-scar materials,
// the organelle motions as WGSL constants and its organelle hooks; and its anatomy as primitives.

import type { Renderer, RendererOptions } from '@feldaher/cell-engine/render/renderer';
import { Mat, MATERIAL_SLOTS, type Anatomy } from '../contracts';
import { packAnatomyGPU } from '../anatomy/sdf';
import { CELL_TYPES } from '../cells';
import { dynamicsWgsl } from '../cells/cycle/dynamics';
import organelleHooks from './organelleHooks.wgsl?raw';

export function rendererOptions(): RendererOptions {
  return {
    materialSlots: MATERIAL_SLOTS, wallMaterial: Mat.Wall, scarMaterial: Mat.BudScar,
    hooks: { constantsWgsl: dynamicsWgsl(), organelleWgsl: organelleHooks },
  };
}

/** Uploads the anatomy; the hooks read µm per unit, the cell type and the microtubule reach. */
export function setAnatomy(renderer: Renderer, an: Anatomy): void {
  // how far a dynamic microtubule can reach from the middle of its bundle (sim units)
  let reach = 0;
  for (const t of an.tubules) if (t.motion === 'instability') for (const p of t.points) reach = Math.max(reach, Math.abs(p[0]));
  const type = CELL_TYPES.findIndex((c) => c.id === an.cellType);
  renderer.setPrimitives(packAnatomyGPU(an), {
    bodyCount: an.body.length, organelleCount: an.organelles.length, wallThickness: an.wallThickness,
    app: [CELL_TYPES[type].umPerUnit, type, reach],
  });
}
