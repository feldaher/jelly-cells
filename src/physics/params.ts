import { Mat, MATERIAL_COUNT, type SimParams } from '../contracts';

/**
 * Illustrative dynamics: the cell is simulated as if 1 µm were 3 cm of gelatin
 * (density 1 per unit³, g = 981/3 units/s²). At true scale a yeast cell is far too
 * small and viscous to wobble at all.
 */
export const UNIT_CM = 3;
export const GRAVITY = 981 / UNIT_CM;
/** Young's modulus of cytoplasm at firmness 0.4, in sim units. */
export const BASE_YOUNG = 50000;

export function defaultParams(): SimParams {
  const materialStiffness = new Array(MATERIAL_COUNT).fill(1);
  materialStiffness[Mat.Wall] = 4;
  materialStiffness[Mat.Nucleus] = 2;
  materialStiffness[Mat.Nucleolus] = 2.5;
  materialStiffness[Mat.Vacuole] = 0.7;
  materialStiffness[Mat.Mitochondrion] = 1.3;
  materialStiffness[Mat.Septin] = 3;
  materialStiffness[Mat.BudScar] = 4;
  return { firmness: 0.4, damping: 0.45, substeps: 12, gravity: GRAVITY, friction: 0.7, materialStiffness };
}

/** Young's modulus for a firmness in [0, 1]: a factor 10 either side of the default. */
export function youngFor(firmness: number): number {
  return BASE_YOUNG * Math.pow(10, (firmness - 0.4) * 1.8);
}

/** Damping rate (1/s) of relative edge velocity for a damping setting in [0, 1]. */
export function dampingRate(damping: number): number {
  return 1 + 260 * damping * damping;
}
