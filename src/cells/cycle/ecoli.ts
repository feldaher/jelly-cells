// The E. coli cell cycle in fast growth (LB, 37 °C), in µm and minutes.
// Lengths and the growth law are from our analysis of the single-cell data of
// Tanouchi et al. 2017 (outputs/analysis/2026-10-05_ecoli-single-cell-growth.md);
// the replication periods are those of Cooper & Helmstetter 1968.

export const ECOLI = {
  /** Mean birth length 2.12 ± 0.35 µm and division length 4.49 ± 0.53 µm (10 189 cycles); rounded to a symmetric division. */
  birthLength: 2.2,
  divisionLength: 4.4,
  /** Generation time, min: 32.1 ± 5.1. */
  generationMin: 32,
  /** Time to replicate the chromosome (C) and from termination to division (D), min (Cooper & Helmstetter 1968, J Mol Biol 31:519). */
  cMin: 40,
  dMin: 20,
  /** Width. Not measured in the growth data; the "3 µm × 1 µm" cell of Bakshi et al. 2012 (Mol Microbiol 85:21). */
  width: 1.0,
  /** Share of ribosomes inside the dense nucleoid: 10–15 % (Bakshi et al. 2012). */
  ribosomesInNucleoid: 0.125,
  /**
   * Fraction of the D period after which a constriction is visible. An assumption: the Z ring
   * assembles at about the start of D, "well before" constriction (den Blaauwen et al. 1999,
   * J Bacteriol 181:5167), and we could not read a measured delay for this condition.
   */
  constrictionAfter: 0.5,
} as const;

/** Cell length (µm) at age a (min): exponential elongation from birth to division. */
export function ecoliLength(ageMin: number): number {
  const a = Math.min(ECOLI.generationMin, Math.max(0, ageMin));
  return ECOLI.birthLength * Math.pow(ECOLI.divisionLength / ECOLI.birthLength, a / ECOLI.generationMin);
}

export interface Replication {
  /** Age (min) at which the older round of replication finishes: τ − D. */
  terminationAge: number;
  /** Age (min) at which the next round starts at every origin. */
  initiationAge: number;
  /** How far the older round has gone, 0–1 (1 once it has terminated). */
  oldRound: number;
  /** How far the newer round has gone, 0–1 (0 before it starts). */
  newRound: number;
  /** Copies of the origin in the cell. */
  origins: number;
  /** Separate nucleoids: one until the older round terminates, then two. */
  nucleoids: number;
}

/**
 * Replication state at age a (min), from the Cooper–Helmstetter rule: a round starts
 * C + D before the division it leads to. Valid for τ < C + D ≤ 2τ, which holds here
 * (32 < 60 ≤ 64): two rounds overlap, and every cell is born mid-replication.
 */
export function ecoliReplication(ageMin: number): Replication {
  const { generationMin: tau, cMin: C, dMin: D } = ECOLI;
  const a = Math.min(tau, Math.max(0, ageMin));
  const terminationAge = tau - D;
  const initiationAge = 2 * tau - (C + D);
  // the older round started C before its termination, i.e. in the mother
  const oldRound = Math.min(1, (a - (terminationAge - C)) / C);
  const newRound = Math.max(0, (a - initiationAge) / C);
  return { terminationAge, initiationAge, oldRound, newRound, origins: a < initiationAge ? 2 : 4, nucleoids: a < terminationAge ? 1 : 2 };
}

/** Age (min) at which the Z ring assembles: about the start of the D period (den Blaauwen et al. 1999). */
export function ecoliZRingAge(): number {
  return ECOLI.generationMin - ECOLI.dMin;
}

/** Radius of the waist at mid-cell as a fraction of the cell radius: 1 until constriction starts, 0 at division. */
export function ecoliWaist(ageMin: number): number {
  const start = ECOLI.generationMin - ECOLI.dMin * (1 - ECOLI.constrictionAfter);
  if (ageMin <= start) return 1;
  return Math.max(0, 1 - (ageMin - start) / (ECOLI.generationMin - start));
}
