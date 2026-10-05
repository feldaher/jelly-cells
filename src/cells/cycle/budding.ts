// Budding yeast quantities that the anatomy is built from.

import { sphereRadius } from './geometry';

export const BUDDING = {
  /** Nuclear / cell volume ≈ 7 % across cell sizes (Jorgensen et al. 2007, Mol Biol Cell 18:3523). */
  ncRatio: 0.07,
} as const;

/** Radius (µm) of a spherical nucleus for a cell (or cell compartment) of volume V (µm³). */
export function buddingNucleusRadius(V: number): number {
  return sphereRadius(BUDDING.ncRatio * V);
}
