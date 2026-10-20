import type { SimParams } from '../contracts';

/**
 * Illustrative dynamics (the gelatin regime): the body is simulated as if one sim unit were
 * 3 cm of gelatin (density 1 per unit³, g = 981/3 units/s²).
 */
export const UNIT_CM = 3;
export const GRAVITY = 981 / UNIT_CM;
/** Young's modulus at firmness 0.4, in sim units. */
export const BASE_YOUNG = 50000;
/** Material ids a SimMesh can carry (tetMaterial is a Uint8Array). */
export const MAX_MATERIALS = 256;

/** Default parameters. `materialStiffness` must cover every material id in the meshes (missing ids default to 1 here). */
export function defaultParams(materialStiffness: number[] = []): SimParams {
  const k = new Array(Math.max(MAX_MATERIALS, materialStiffness.length)).fill(1);
  materialStiffness.forEach((v, i) => { if (v !== undefined) k[i] = v; });
  return { firmness: 0.4, damping: 0.45, substeps: 12, gravity: GRAVITY, friction: 0.7, materialStiffness: k, volume: 1 };
}

/** Young's modulus for a firmness in [0, 1]: a factor 10 either side of the default. */
export function youngFor(firmness: number): number {
  return BASE_YOUNG * Math.pow(10, (firmness - 0.4) * 1.8);
}

/** Damping rate (1/s) of relative edge velocity for a damping setting in [0, 1]. */
export function dampingRate(damping: number): number {
  return 1 + 260 * damping * damping;
}
