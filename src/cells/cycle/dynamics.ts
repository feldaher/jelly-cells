// How organelles move and what their surfaces carry, as measured. One table feeds both the
// TypeScript (tests, labels) and the organelle shader (dynamicsWgsl). Motions are shown sped
// up by the factor given with each; `speedup: 1` is real time.
// Sources and how far each was checked: outputs/literature/2026-10-05_cell-cycle-organelle-sources.md.

export const DYNAMICS = {
  /** Fission yeast interphase microtubules (Tran et al. 2001, J Cell Biol 153:397). */
  microtubule: {
    /** Growth of a bundle end toward the tip: 1.86 ± 0.54 µm/min. */
    growUmPerMin: 1.86,
    /** Shrinkage after catastrophe: 9 µm/min (the value Tran et al. use to match their cells). */
    shrinkUmPerMin: 9,
    /** Time an end stays at the cell tip before catastrophe: 1.5 min on average. */
    dwellMin: 1.5,
    /** How far back it shrinks, as a fraction of the way to the tip: "to the nuclear region". A drawing choice. */
    restFraction: 0.15,
    speedup: 60,
  },
  /**
   * Mitochondria moving along an axon. They move in both directions and switch between moving
   * and stationary states (Morris & Hollenbeck 1993, J Cell Sci 104:917). The speed is the usual
   * figure for fast transport and was not read in a source this session.
   */
  transport: { umPerSec: 0.5, spacingUm: 9, lengthUm: 2, speedup: 4 },
  /**
   * E. coli nucleoid: 5–10 % of its density shifts along its length within 5 s, back and forth
   * (Fisher et al. 2013, Cell 153:882). Shown in real time.
   */
  nucleoidWave: { periodSec: 10, amplitude: 0.075, speedup: 1 },
  /**
   * FtsZ filaments treadmill around the division ring (Bisson-Filho et al. 2017, Science 355:739).
   * The speed, about 30 nm/s, was not read in a source this session.
   */
  treadmill: { umPerSec: 0.03, speedup: 30 },
  /**
   * Nuclear pores of budding yeast: 65–182 per haploid nucleus, clustered, no preferred spacing
   * (Winey et al. 1997, Mol Biol Cell 8:2119). Drawn as dots of radius 0.05 µm wherever a random
   * point (one per cube of side `latticeUm`) lies within that radius of the envelope; the side is
   * chosen to give about 120 on a nucleus of 2.1 µm.
   */
  pores: { radiusUm: 0.05, latticeUm: 0.225 },
} as const;

/** Expected number of pore dots on an envelope of the given area (µm²). */
export function poreCount(areaUm2: number): number {
  const { radiusUm: r, latticeUm: a } = DYNAMICS.pores;
  return (areaUm2 * 2 * r) / a ** 3;
}

/** Seconds of cell time for one grow–dwell–shrink cycle of a microtubule end that can reach `reachUm`. */
export function microtubulePeriod(reachUm: number): number {
  const m = DYNAMICS.microtubule, span = (1 - m.restFraction) * reachUm;
  return (span / m.growUmPerMin + m.dwellMin + span / m.shrinkUmPerMin) * 60;
}

/** Distance (µm) of a microtubule end from the middle of its bundle at cell time t (s). */
export function microtubuleEnd(tSec: number, reachUm: number): number {
  const m = DYNAMICS.microtubule, rest = m.restFraction * reachUm, span = reachUm - rest;
  const grow = (span / m.growUmPerMin) * 60, dwell = m.dwellMin * 60, T = microtubulePeriod(reachUm);
  const t = ((tSec % T) + T) % T;
  if (t < grow) return rest + (m.growUmPerMin / 60) * t;
  if (t < grow + dwell) return reachUm;
  return reachUm - (m.shrinkUmPerMin / 60) * (t - grow - dwell);
}

/** The table as WGSL constants (µm and seconds), prepended to the shaders. */
export function dynamicsWgsl(): string {
  const m = DYNAMICS;
  const c: [string, number][] = [
    ['MT_GROW', m.microtubule.growUmPerMin / 60], ['MT_SHRINK', m.microtubule.shrinkUmPerMin / 60], ['MT_DWELL', m.microtubule.dwellMin * 60],
    ['MT_REST', m.microtubule.restFraction], ['MT_SPEEDUP', m.microtubule.speedup],
    ['TRANSPORT_SPEED', m.transport.umPerSec], ['TRANSPORT_SPACING', m.transport.spacingUm], ['TRANSPORT_LENGTH', m.transport.lengthUm], ['TRANSPORT_SPEEDUP', m.transport.speedup],
    ['WAVE_PERIOD', m.nucleoidWave.periodSec], ['WAVE_AMPLITUDE', m.nucleoidWave.amplitude],
    ['TREADMILL_SPEED', m.treadmill.umPerSec], ['TREADMILL_SPEEDUP', m.treadmill.speedup],
    ['PORE_RADIUS', m.pores.radiusUm], ['PORE_CELL', m.pores.latticeUm],
  ];
  return '// Organelle motions and surface detail: generated from src/cells/cycle/dynamics.ts.\n' + c.map(([k, v]) => `const ${k} = ${v};`).join('\n') + '\n';
}
