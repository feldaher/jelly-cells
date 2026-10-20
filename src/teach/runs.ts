// One stress experiment as the player measures it: the lowest volume seen, when the reporter
// peaked and how high, whether visible condensates formed, and the trace the live graph draws.

import type { RunRecord, StressId, StressState, TracePoint } from '../contracts';

/** The reporter counts as past its peak once it has fallen this far below its highest value. */
const PAST_PEAK = 0.98;
/** Foci count as seen once they are this far formed. */
const FOCI_SEEN = 0.25;
/** Least time between two points of a trace, cell minutes. */
const TRACE_STEP = 0.1;

export class RunTracker {
  record: RunRecord;
  private highestAt = 0;

  constructor(stress: StressId, dose: number) {
    this.record = { stress, dose, minutes: 0, lowestVolume: 1, highestSignal: 0, peakMinutes: null, foci: false, trace: [], changes: [] };
  }

  /** Takes one sample: cell minutes since the run began, the measured relative volume, the cell's state. */
  observe(minutes: number, volume: number, state: StressState) {
    const r = this.record;
    r.minutes = minutes;
    r.lowestVolume = Math.min(r.lowestVolume, volume);
    if (state.signal > r.highestSignal) { r.highestSignal = state.signal; this.highestAt = minutes; }
    if (r.highestSignal > 0 && state.signal < PAST_PEAK * r.highestSignal) r.peakMinutes = this.highestAt;
    if (state.foci >= FOCI_SEEN) r.foci = true;
    const last = r.trace[r.trace.length - 1];
    if (!last || minutes - last.minutes >= TRACE_STEP - 1e-9) r.trace.push({ minutes, signal: state.signal, foci: state.foci });
  }

  /** Notes that the dose was changed now (the run carries on, e.g. into recovery). */
  markChange() {
    this.record.changes.push(this.record.minutes);
  }
}

/** The time axis for a run that has lasted `minutes`: whole tens of minutes, at least ten. */
export function graphSpan(minutes: number): number {
  return Math.max(10, 10 * Math.ceil(minutes / 10));
}

/** One line of a trace as an SVG path in a w × h box: time left to right over `span` minutes, 0 at the bottom, 1 at the top. */
export function tracePath(trace: TracePoint[], key: 'signal' | 'foci', span: number, w: number, h: number): string {
  const r = (x: number) => Math.round(x * 100) / 100;
  return trace.map((p, i) => `${i ? 'L' : 'M'}${r((p.minutes / span) * w)} ${r(h - p[key] * h)}`).join('');
}
