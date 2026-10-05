// The stress lab's controls: which stress, how much, the reporter view, the live readout and the table of runs.

import type { RunRecord, StressResponse } from '../contracts';
import type { World } from '../app/world';
import { graphSpan, RunTracker, tracePath } from '../teach/runs';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Runs kept in the table, per kind of stress. */
const MAX_RUNS = 5;
/** Size of the graph's drawing box (its SVG viewBox). */
const GRAPH = { w: 240, h: 80 };

/** What a run's row says, per kind of stress: the dose is always the first column. */
const COLUMNS: Record<StressResponse['id'], { heads: [string, string]; cells(r: RunRecord): [string, string] }> = {
  osmotic: {
    heads: ['Lowest volume', 'Signal peaked at'],
    cells: (r) => [`${(100 * r.lowestVolume).toFixed(0)} %`, r.peakMinutes === null ? '…' : `${r.peakMinutes.toFixed(1)} min`],
  },
  heat: {
    heads: ['Pab1 assembled', 'Foci'],
    cells: (r) => [`${(100 * r.highestSignal).toFixed(0)} %`, r.foci ? 'yes' : 'none'],
  },
};

export class StressUi {
  private run: RunTracker | null = null;
  private runs: RunRecord[] = [];
  /** Run minutes at the moment the dose was last set: the world's clock restarts there, the run's does not. */
  private offset = 0;
  /** The world's clock at the last update, to notice a reset. */
  private lastClock = 0;

  /** `onReporter` is told when the reporter button is pressed. */
  constructor(private world: World, onReporter: () => void) {
    $('reporter-btn').addEventListener('click', onReporter);
  }

  /** Shows the lab for a cell type that has stress responses, hides it otherwise. */
  setType() {
    const kinds = this.world.type.stress;
    $('stress-group').hidden = !kinds;
    $('stress-graph-fig').hidden = !kinds;
    this.run = null;
    this.runs = [];
    if (!kinds) return;
    const el = $('stress-kinds');
    el.innerHTML = kinds.map((k) => `<button class="view" role="radio" data-kind="${k.id}">${k.name}</button>`).join('');
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => this.setKind(kinds.find((k) => k.id === b.dataset.kind)!)));
    this.showKind();
  }

  /** Marks the reporter button as on or off. */
  showReporter(on: boolean) {
    const b = $('reporter-btn');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }

  private setKind(kind: StressResponse) {
    this.world.setStress(kind.id, kind.baseline);
    this.run = null;
    this.showKind();
  }

  /** Everything that depends on which stress is chosen. */
  private showKind() {
    const kind = this.world.stressResponse!;
    $('stress-kinds').querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      const on = b.dataset.kind === kind.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    $('reporter-name').textContent = `${kind.reporter} view`;
    $('st-signal-name').textContent = kind.signalName;
    $('stress-note').textContent = `${kind.source} Shown ×${kind.speedup}: one second is one minute. Each run starts from an unstressed cell.`;
    const doses = $('doses');
    doses.innerHTML = [kind.baseline, ...kind.doses].map((d) => `<button class="dose" role="radio" data-dose="${d}">${kind.format(d)}</button>`).join('');
    doses.querySelectorAll<HTMLButtonElement>('.dose').forEach((b) => b.addEventListener('click', () => this.setDose(Number(b.dataset.dose))));
    const c = COLUMNS[kind.id];
    $('runs').querySelector('thead')!.innerHTML = `<tr><th>Your runs</th><th>${c.heads[0]}</th><th>${c.heads[1]}</th></tr>`;
    this.showDose();
    this.update();
  }

  private setDose(dose: number) {
    const w = this.world, kind = w.stressResponse!;
    w.setStress(kind.id, dose);
    this.lastClock = 0;
    // back to the baseline with something still to recover from: the same run carries on
    if (this.run && dose === kind.baseline && w.stressed) {
      this.offset = this.run.record.minutes;
      this.run.markChange();
    } else this.start();
    this.showDose();
  }

  private start() {
    const w = this.world;
    this.offset = 0;
    this.run = w.stressed ? new RunTracker(w.stress!.id, w.stress!.dose) : null;
    if (!this.run) return;
    const kept = (id: string) => this.runs.filter((r) => r.stress === id);
    const mine = [...kept(this.run.record.stress), this.run.record].slice(-MAX_RUNS);
    this.runs = [...this.runs.filter((r) => r.stress !== this.run!.record.stress), ...mine];
  }

  private showDose() {
    const dose = this.world.stress!.dose;
    $('doses').querySelectorAll<HTMLButtonElement>('.dose').forEach((b) => {
      const on = Number(b.dataset.dose) === dose;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  /** Reads the cell and refreshes the readout; call a few times a second. */
  update() {
    const w = this.world, kind = w.stressResponse;
    if (!kind) return;
    const state = w.stressState(), volume = w.stats().volumePct / 100;
    // a reset puts a fresh cell under the same stress: that is a new run
    if (this.run && w.stressMinutes < this.lastClock) this.start();
    this.lastClock = w.stressMinutes;
    if (w.stressed) this.run?.observe(this.offset + w.stressMinutes, volume, state);
    const recovering = w.stressed && w.stress!.dose === kind.baseline;
    $('stress-clock').textContent = !w.stressed ? 'unstressed' : `${w.stressMinutes.toFixed(1)} min${recovering ? ' of recovery' : ''}`;
    $('st-vol').textContent = (100 * volume).toFixed(0);
    $('st-signal').textContent = (100 * state.signal).toFixed(0);
    const rows = this.runs.filter((r) => r.stress === kind.id), table = $('runs');
    table.hidden = rows.length === 0;
    table.querySelector('tbody')!.innerHTML = rows.map((r) => {
      const [a, b] = COLUMNS[kind.id].cells(r);
      return `<tr><td>${kind.format(r.dose)}</td><td>${a}</td><td>${b}</td></tr>`;
    }).join('');
    this.drawGraph(kind, rows);
  }

  /**
   * The live graph: the current run's lines in ink (the second one dashed), earlier runs of the
   * same stress faint behind them, and a tick where the dose was changed.
   */
  private drawGraph(kind: StressResponse, rows: RunRecord[]) {
    const { w, h } = GRAPH, [main, second] = kind.traces;
    const span = graphSpan(Math.max(0, ...rows.map((r) => r.minutes)));
    const current = this.run?.record;
    const line = (r: RunRecord, key: 'signal' | 'foci', cls: string) => `<path class="${cls}" d="${tracePath(r.trace, key, span, w, h)}"/>`;
    const grid = [0.5, 1].map((y) => `<line class="grid" x1="0" x2="${w}" y1="${h - y * h}" y2="${h - y * h}"/>`).join('');
    const marks = (current?.changes ?? []).map((m) => `<line class="mark" x1="${(m / span) * w}" x2="${(m / span) * w}" y1="0" y2="${h}"/>`).join('');
    $('stress-graph').innerHTML = grid + marks
      + rows.filter((r) => r !== current && r.trace.length > 1).map((r) => line(r, main.key, 'old')).join('')
      + (current && second ? line(current, second.key, 'second') : '')
      + (current ? line(current, main.key, 'main') : '');
    $('graph-title').textContent = `${kind.reporter.replace(/-GFP$/, '')} over time, % of largest`;
    $('graph-legend').textContent = second ? `${main.name} (solid) · ${second.name} (dashed)` : main.name;
    $('graph-span').textContent = `${span} min`;
  }
}
