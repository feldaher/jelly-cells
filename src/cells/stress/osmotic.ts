// Budding yeast in hyperosmotic medium: how much it shrinks and when Hog1 enters the nucleus.
// Measured values are from Babazadeh et al. 2013, PLoS One 8:e80901 (wild type, NaCl added in a
// microfluidic chamber) unless another source is named. Whatever is not measured is marked "ours".
// Sources and how far each was checked: outputs/literature/2026-10-05_game-layer-and-stress-sources.md.

import type { StressResponse } from '../../contracts';

export const OSMOTIC = {
  /** NaCl added (M) in the experiment. */
  doses: [0.1, 0.4, 0.6, 0.8, 1.0],
  /** Minutes until nuclear Hog1 is highest, at each dose: "3, 5, approximately 6, 15 and 25". */
  peakMin: [3, 5, 6, 15, 25],
  /**
   * Fraction of the volume lost at its lowest: 30 % at 0.4 M and 55 % at 0.8 M, "approximately
   * linear" in the salt concentration. Straight lines between these points and beyond (ours).
   */
  loss: [[0, 0], [0.4, 0.3], [0.8, 0.55]],
  /**
   * Fraction of the lost volume regained 45 min after the shock. 0.8 M: "only 10 %". 0.4 M:
   * "almost completely", taken as 95 % (ours).
   */
  regainedAt45: [[0.4, 0.95], [0.8, 0.1]],
  /**
   * External osmolarity step at which turgor is lost, 0.4 ± 0.2 Osm/l; HOG activation follows
   * turgor loss 1:1 (Schaber et al. 2010, Eur Biophys J 39:1547).
   */
  turgorLossOsm: 0.4,
  /** Osmoles per mole of NaCl: two ions, osmotic coefficient 0.93 (textbook value, not read in a source). */
  osmPerMolNaCl: 1.86,
  /** Shown 60 times faster than real time: one second on screen is one minute. */
  speedup: 60,
} as const;

/** Piecewise-linear through sorted (x, y) points, continued at the end slopes. */
function lerpPoints(pts: readonly (readonly number[])[], x: number): number {
  let i = 1;
  while (i < pts.length - 1 && x > pts[i][0]) i++;
  const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** Fraction of its volume the cell loses in `naclM` M NaCl. */
export function volumeLoss(naclM: number): number {
  return naclM <= 0 ? 0 : lerpPoints(OSMOTIC.loss, naclM);
}

/** Minutes until nuclear Hog1 peaks. Between the measured doses: straight lines (ours). */
export function peakMinutes(naclM: number): number {
  const d = OSMOTIC.doses, t = OSMOTIC.peakMin;
  return lerpPoints(d.map((x, i) => [x, t[i]]), Math.max(d[0], naclM));
}

/**
 * Time constant (min) of the volume recovery, which starts at the Hog1 peak (ours: the volume is
 * drawn at its lowest until then, and exponential after). Fixed at 0.4 and 0.8 M by the volume
 * regained at 45 min; log-linear in dose between and beyond them (ours).
 */
export function recoveryTau(naclM: number): number {
  const [a, b] = OSMOTIC.regainedAt45.map(([dose, regained]) => [dose, Math.log((45 - peakMinutes(dose)) / -Math.log(1 - regained))]);
  return Math.exp(lerpPoints([a, b], naclM));
}

/** Share of the volume loss still there `minutes` after the shock. */
function deficit(naclM: number, minutes: number): number {
  const since = minutes - peakMinutes(naclM);
  return since <= 0 ? 1 : Math.exp(-since / recoveryTau(naclM));
}

/** Cell volume relative to the unstressed cell. The drop is immediate, as measured. */
export function relVolume(naclM: number, minutes: number): number {
  if (naclM <= 0 || minutes < 0) return 1;
  return 1 - volumeLoss(naclM) * deficit(naclM, minutes);
}

/**
 * Nuclear enrichment of Hog1, 0 (unstressed) to 1 (the largest response). The peak grows with
 * the dose until turgor is lost (Schaber et al. 2010), comes at the measured time, and then
 * falls back to zero (perfect adaptation, Muzzey et al. 2009, Cell 138:160) in step with the
 * volume still missing (ours). The rise is a smooth ramp (ours).
 */
export function nuclearHog1(naclM: number, minutes: number): number {
  if (naclM <= 0 || minutes <= 0) return 0;
  const amplitude = Math.min(1, (naclM * OSMOTIC.osmPerMolNaCl) / OSMOTIC.turgorLossOsm);
  const u = minutes / peakMinutes(naclM);
  return amplitude * (u < 1 ? u * u * (3 - 2 * u) : deficit(naclM, minutes));
}

/**
 * How much brighter than the cytoplasm the nucleus is drawn at the largest response. A drawing
 * choice: the measured nuclear/cytoplasmic ratio was not read (docs/stress-lab.md).
 */
export const HOG1_CONTRAST = 2;

export const yeastOsmotic: StressResponse = {
  id: 'osmotic',
  name: 'Salt',
  reporter: 'Hog1-GFP',
  signalName: 'Nuclear Hog1',
  baseline: 0,
  doses: [...OSMOTIC.doses],
  format: (dose) => (dose === 0 ? 'None' : `${dose.toFixed(1)} M`),
  speedup: OSMOTIC.speedup,
  source: 'NaCl added to the medium. Timing and volumes: Babazadeh et al. 2013, PLoS One 8:e80901. Each dose starts from an unstressed cell.',
  traces: [{ key: 'signal', name: 'Nuclear Hog1' }],
  // a step from one salt concentration to another is not modelled: every dose starts from an unstressed cell
  at: (naclM, minutes) => ({ relVolume: relVolume(naclM, minutes), signal: nuclearHog1(naclM, minutes), foci: 0 }),
  look: (state) => ({ cytoplasm: 1, nucleus: 1 + (HOG1_CONTRAST - 1) * state.signal, condensate: 1 }),
};
