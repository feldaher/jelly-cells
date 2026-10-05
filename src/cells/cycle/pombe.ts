// The fission yeast cell cycle as measured, in µm and fractions of the cycle.
// Every constant names its source; see outputs/literature/2026-10-05_cell-cycle-organelle-sources.md.

import { rodVolume, sphereRadius } from './geometry';

export const POMBE = {
  /** Length at division, wild type 972 (Mitchison & Nurse 1985, J Cell Sci 75:357). */
  divisionLength: 14,
  /** Two equal daughters. */
  birthLength: 7,
  /** New end take-off: length and cycle phase at which the new end starts to grow (same source). */
  netoLength: 9.5,
  netoPhase: 0.34,
  /** Length growth stops for the last quarter of the cycle, through mitosis and septation (same source). */
  growthEnd: 0.75,
  /** Diameter. Drawing choice between "∼4 µm" (Tran et al. 2001, J Cell Biol 153:397) and the commonly quoted 3.5 µm. */
  diameter: 3.6,
  /** Nuclear / cell volume, 0.080 ± 0.013 (Neumann & Nurse 2007, J Cell Biol 179:593). */
  ncRatio: 0.08,
  /** Longest anaphase B spindle, wild type: 11.93 ± 0.9 µm (Krüger et al. 2019, eLife 8:e42182). */
  spindleMax: 11.9,
  /** Interphase microtubule bundles: three to four (Tran et al. 2001). */
  mtBundles: 3,
  /** Minutes after spindle-pole-body separation (Wu et al. 2003, Dev Cell 5:723; 25 °C). */
  ringAssembledMin: 10,
  ringConstrictsMin: 37,
  /** Turgor pressure and wall modulus, MPa (Atilgan et al. 2015, Curr Biol 25:2150). */
  turgorMPa: 1.5,
  wallModulusMPa: 50,
} as const;

/** Cell length (µm) at cycle phase φ ∈ [0, 1]: two linear segments, then a plateau. */
export function pombeLength(phase: number): number {
  const p = Math.min(1, Math.max(0, phase));
  const { birthLength: Lb, netoLength: Ln, netoPhase: pn, divisionLength: Ld, growthEnd: pe } = POMBE;
  if (p <= pn) return Lb + ((Ln - Lb) * p) / pn;
  if (p <= pe) return Ln + ((Ld - Ln) * (p - pn)) / (pe - pn);
  return Ld;
}

/**
 * How much each end has grown since birth (µm). Before NETO only the old end grows.
 * After it the two ends are taken to share growth equally: an assumption, the source
 * gives no split (and reports that old-end growth slows in some cells).
 */
export function pombeTipGrowth(phase: number): { oldEnd: number; newEnd: number } {
  const total = pombeLength(phase) - POMBE.birthLength;
  const beforeNeto = Math.min(total, POMBE.netoLength - POMBE.birthLength);
  const after = total - beforeNeto;
  return { oldEnd: beforeNeto + after / 2, newEnd: after / 2 };
}

/** Cell volume (µm³) of a rod of length L. */
export function pombeVolume(L: number): number {
  return rodVolume(L, POMBE.diameter / 2);
}

/** Radius (µm) of the interphase nucleus of a cell of length L, from the N/C ratio. */
export function pombeNucleusRadius(L: number): number {
  return sphereRadius(POMBE.ncRatio * pombeVolume(L));
}

/** Radius (µm) of each daughter nucleus after mitosis: half the nuclear volume each. */
export function pombeDaughterNucleusRadius(L: number): number {
  return sphereRadius((POMBE.ncRatio * pombeVolume(L)) / 2);
}
