// Budding yeast moved from 30 °C to a higher temperature: poly(A)-binding protein (Pab1) assembles.
// Measured, in vivo (Wallace et al. 2015, Cell 162:1286; Riback et al. 2017, Cell 168:1028):
//   30 °C  Pab1 is diffuse.
//   42 °C  no Pab1 foci under the microscope, but pelletable assemblies after 10 min; less
//          assembles than at 46 °C, even after 30 min.
//   46 °C  after 2 min Pab1 is still mostly soluble; it is in stress granules ("large cytosolic
//          foci") "within minutes"; after 8 min most of it pellets and the foci are there.
//   back at 30 °C  aggregated proteins are partly back in solution after 20 min and fully
//          after 60 min, without being degraded; the granules "slowly disappear", which needs
//          the disaggregase Hsp104 with Hsp70 (Cherkasov et al. 2013, Curr Biol 23:2452).
// The papers give no fraction for Pab1 at 42 °C and no count or size of the foci, so the levels
// and curves below are ours wherever they are not one of the statements above.
// Sources and how far each was checked: outputs/literature/2026-10-05_game-layer-and-stress-sources.md.

import type { StressResponse, StressState } from '../../contracts';

export const HEAT = {
  /** Growth temperature, °C. */
  growthC: 30,
  /** Temperatures at which Pab1 was followed in vivo, °C. */
  temps: [42, 46],
  /** 46 °C: assembly runs from about 1 min (ours; "mostly soluble" at 2) to 8 min ("most" assembled). */
  severe: { startMin: 1, fullMin: 8, fociStartMin: 2 },
  /**
   * 42 °C: detectable at 10 min, still short of 46 °C at 30 min. Drawn as a smooth rise over
   * 30 min to half the largest response; both the level and the shape are ours.
   */
  mild: { plateauMin: 30, level: 0.5 },
  /**
   * Minutes at 30 °C until nothing is left assembled (measured for the aggregating proteins as
   * a group). The foci are given the same time and both fall along a smooth curve (ours).
   */
  recoveryMin: 60,
  /** Below this temperature (°C) Pab1 does not assemble: it stays monomeric up to 33 °C and demixes from 36 °C in vitro. */
  onsetC: 36,
  /** Shown 60 times faster than real time: one second on screen is one minute. */
  speedup: 60,
} as const;

/**
 * The foci as drawn. Their number and size were not read in a source: eight per mother cell
 * (and in proportion in the bud), 0.26 µm across. They are drawn at full size from the start
 * and brighten; real granules also grow and merge.
 */
export const CONDENSATE = { perMother: 8, radiusUm: 0.13 } as const;

const smooth = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };

/** Pab1 in pelletable assemblies, 0 (as at 30 °C) to 1 (the largest response: 46 °C, 8 min). */
export function assembledPab1(tempC: number, minutes: number): number {
  const { severe, mild } = HEAT;
  if (minutes <= 0) return 0;
  if (tempC >= 46) return smooth((minutes - severe.startMin) / (severe.fullMin - severe.startMin));
  if (tempC >= 42) return mild.level * smooth(minutes / mild.plateauMin);
  return 0;
}

/** How far microscopically visible foci have formed, 0–1: only at 46 °C, after the first assemblies (ours: from 2 min). */
export function pab1Foci(tempC: number, minutes: number): number {
  const { severe } = HEAT;
  return tempC >= 46 ? smooth((minutes - severe.fociStartMin) / (severe.fullMin - severe.fociStartMin)) : 0;
}

const UNSTRESSED: StressState = { relVolume: 1, signal: 0, foci: 0 };

/** The time at which a curve rising from 0 over [0, 60] min first reaches `y` (0 when it never does). */
function timeToReach(curve: (minutes: number) => number, y: number): number {
  if (y <= 0 || curve(60) < y) return 0;
  let lo = 0, hi = 60;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (curve(mid) < y) lo = mid; else hi = mid; }
  return hi;
}

/**
 * The cell `minutes` after it was moved to `tempC`, having been in state `from`.
 * At the growth temperature what had assembled dissolves. At a heat-shock temperature the cell
 * carries on along that temperature's curve from the level it already has, and never loses any:
 * assemblies do not come apart while it is still hot (ours; in vitro they do not reverse even at 30 °C).
 */
export function heatState(tempC: number, minutes: number, from: StressState = UNSTRESSED): StressState {
  const t = Math.max(0, minutes);
  if (tempC < HEAT.onsetC) {
    const left = 1 - smooth(t / HEAT.recoveryMin);
    return { relVolume: 1, signal: from.signal * left, foci: from.foci * left };
  }
  const along = (curve: (m: number) => number, had: number) => Math.max(had, curve(t + timeToReach(curve, had)));
  return {
    relVolume: 1,
    signal: along((m) => assembledPab1(tempC, m), from.signal),
    foci: along((m) => pab1Foci(tempC, m), from.foci),
  };
}

/**
 * The Pab1-GFP picture (all three numbers are drawing choices). Pab1 is mostly cytoplasmic, so
 * the nucleus is dim; foci glow up to five times the cytoplasm, which dims as they fill.
 * Assemblies too small to see (42 °C) leave the picture as it was.
 */
const LOOK = { nucleus: 0.4, fociGain: 4, depletion: 0.4 } as const;

export const yeastHeat: StressResponse = {
  id: 'heat',
  name: 'Heat',
  reporter: 'Pab1-GFP',
  signalName: 'Pab1 assembled',
  baseline: HEAT.growthC,
  doses: [...HEAT.temps],
  format: (dose) => `${dose} °C`,
  speedup: HEAT.speedup,
  source: 'Moved from 30 °C. At 42 °C Pab1 assembles into particles too small to see; at 46 °C it forms stress granules (Wallace et al. 2015, Cell 162:1286; Riback et al. 2017, Cell 168:1028). Back at 30 °C everything dissolves within the hour. The number and size of the foci, and the level at 42 °C, are drawn, not measured.',
  traces: [{ key: 'foci', name: 'Foci' }, { key: 'signal', name: 'Assembled' }],
  at: heatState,
  look: (state) => ({ cytoplasm: 1 - LOOK.depletion * state.foci, nucleus: LOOK.nucleus, condensate: 1 + LOOK.fociGain * state.foci }),
};
