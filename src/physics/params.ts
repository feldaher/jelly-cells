// Jelly Cells' parameters on top of the engine's: material stiffnesses by cell type.

import { Mat, MATERIAL_COUNT, type CellType, type SimParams } from '../contracts';
import { defaultParams as engineDefaults } from '../engine/physics/params';

export { UNIT_CM, GRAVITY, BASE_YOUNG, youngFor, dampingRate } from '../engine/physics/params';

export function defaultParams(): SimParams {
  const materialStiffness = new Array(MATERIAL_COUNT).fill(1);
  materialStiffness[Mat.Wall] = 4;
  materialStiffness[Mat.Nucleus] = 2;
  materialStiffness[Mat.Nucleolus] = 2.5;
  materialStiffness[Mat.Vacuole] = 0.7;
  materialStiffness[Mat.Mitochondrion] = 1.3;
  materialStiffness[Mat.Septin] = 3;
  materialStiffness[Mat.BudScar] = 4;
  return { ...engineDefaults(), materialStiffness };
}

/** Default parameters with a cell type's material stiffnesses. */
export function paramsFor(ct: CellType): SimParams {
  const p = defaultParams();
  p.materialStiffness = new Array(MATERIAL_COUNT).fill(1);
  for (const [m, k] of Object.entries(ct.stiffness)) p.materialStiffness[Number(m)] = k!;
  return p;
}
