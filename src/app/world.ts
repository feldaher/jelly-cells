// The world: pieces, the fixed-rate simulation loop, the hand, the knife.

import type { Anatomy, CellType, CellTypeId, CutChild, Label, Piece, Plane, SectionEntry, SimMesh, SkinMesh, Stats, Vec3 } from '../contracts';
import { anatomyOf, cellType } from '../cells';
import { buildPiece } from '../mesh/piece';
import { TetGrid, updateSkin } from '../mesh/surface';
import { paramsFor, UNIT_CM } from '../physics/params';
import { pieceSdf } from '../anatomy/sdf';
import { mergeReports, sectionReport } from '../teach/section';
import { step } from '../physics/xpbd';
import type { GrabState } from '../physics/grab';
import { currentVolume, restVolume } from '../physics/metrics';
import { applyCut, buildChildren, findSplits, type SplitJob } from '../cut/cut';
import type { CutRequest } from '../cut/worker';
import { advanceKnife, assignSides, knifeConstraint, startKnife, type Knife } from '../cut/knife';

const DT = 1 / 60;
export const MAX_PIECES = 12;
/** Wet mass density of a cell, pg/µm³. */
const CELL_DENSITY = 1.1;

export interface CutReport {
  entries: SectionEntry[];
  /** Increments with every cut, so the UI knows when to show a new report. */
  serial: number;
}

export class World {
  type!: CellType;
  an!: Anatomy;
  labels: Label[] = [];
  params = paramsFor(cellType('yeast'));
  lastCut: CutReport | null = null;
  pieces: Piece[] = [];
  grab: GrabState | null = null;
  knife: Knife | null = null;
  paused = false;
  slow = false;
  private acc = 0;
  /** Simulated time (s). */
  time = 0;
  private nextId = 1;
  private template!: Piece;
  private restTotal = 0;
  /** Last step cost in ms (for the dev overlay). */
  stepMs = 0;

  constructor(id: CellTypeId = 'yeast') {
    this.setCellType(id);
  }

  /** Swaps in another cell type, keeping the firmness and damping settings. */
  setCellType(id: CellTypeId) {
    const { firmness, damping } = this.params;
    this.type = cellType(id);
    this.an = anatomyOf(id);
    this.labels = this.type.labels(this.an);
    this.params = { ...paramsFor(this.type), firmness, damping };
    this.template = buildPiece(this.an, [], 0);
    this.lastCut = null;
    this.reset();
  }

  reset() {
    this.grab = null;
    this.knife = null; // any pending cut result is ignored
    const p = clonePiece(this.template, this.nextId++);
    placeOnFloor(p.sim, 0.6);
    this.pieces = [p];
    this.restTotal = restVolume(p.sim);
    this.refreshSkins();
  }

  /** Advances real time; the simulation runs in fixed 1/60 s steps. */
  update(realDt: number) {
    if (this.paused) return;
    this.acc += Math.min(realDt, 0.1) * (this.slow ? 0.25 : 1);
    let n = 0;
    const t0 = performance.now();
    while (this.acc >= DT && n < 2) {
      this.acc -= DT;
      n++;
      this.fixedStep();
    }
    if (n === 2) this.acc = Math.min(this.acc, DT);
    if (n) { this.stepMs = (performance.now() - t0) / n; this.refreshSkins(); }
  }

  private fixedStep() {
    const k = this.knife;
    if (k) {
      if (advanceKnife(k, DT)) {
        const grabbed = this.grab?.piece;
        const plan = k.plan!;
        this.pieces = applyCut(this.pieces, plan);
        for (const sp of plan.splits) for (const c of sp.children) { c.piece.cutGroup = plan.splits[0].children[0].piece.id; c.piece.bornAt = this.time; }
        if (grabbed && !this.pieces.includes(grabbed)) this.grab = null;
        assignSides(k);
      }
      if (k.phase === 'done') this.knife = null;
    }
    step(this.pieces, this.params, DT, {
      grab: this.grab,
      constrain: this.knife ? (pieces) => knifeConstraint(this.knife!, pieces) : undefined,
      time: this.time,
    });
    this.time += DT;
  }

  refreshSkins() {
    for (const p of this.pieces) {
      updateSkin(p.skin, p.sim);
      for (const o of p.organelles) updateSkin(o, p.sim);
    }
  }

  /**
   * Plans a vertical cut and starts the knife. Only pieces the blade actually
   * passes over (between the stroke's ends, give or take) are considered.
   */
  cut(a: Vec3, b: Vec3, camForward: Vec3): 'ok' | 'miss' | 'busy' | 'full' {
    if (this.knife) return 'busy';
    let along: Vec3 = [b[0] - a[0], 0, b[2] - a[2]];
    const len = Math.hypot(along[0], along[2]);
    if (len < 0.2) return 'miss';
    along = [along[0] / len, 0, along[2] / len];
    const n: Vec3 = [along[2], 0, -along[0]];
    const plane: Plane = { n, d: n[0] * a[0] + n[2] * a[2] };
    const sA = along[0] * a[0] + along[2] * a[2], sB = sA + len;
    const crossed = this.pieces.filter((p) => {
      const P = p.sim.pos;
      for (let i = 0; i < P.length; i += 3) {
        const dist = n[0] * P[i] + n[2] * P[i + 2] - plane.d;
        const s = along[0] * P[i] + along[2] * P[i + 2];
        if (Math.abs(dist) < p.sim.spacing && s > sA - 0.6 && s < sB + 0.6) return true;
      }
      return false;
    });
    if (crossed.length === 0) return 'miss';
    if (this.pieces.length + crossed.length > MAX_PIECES) return 'full';
    const jobs = findSplits(crossed, plane);
    if (jobs.length === 0) return 'miss';

    // Handle toward the viewer: blade runs away from the camera.
    if (along[0] * camForward[0] + along[2] * camForward[2] < 0) along = [-along[0], 0, -along[2]];
    // Centre the blade over the pieces it cuts.
    let lo = Infinity, hi = -Infinity;
    for (const { parent } of jobs) {
      const P = parent.sim.pos;
      for (let i = 0; i < P.length; i += 3) {
        const t = along[0] * P[i] + along[2] * P[i + 2];
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
    }
    const mid = (lo + hi) / 2;
    const centre: Vec3 = [n[0] * plane.d + along[0] * mid, 0, n[2] * plane.d + along[2] * mid];
    const knife = startKnife(plane, jobs.map((j) => j.parent), along, centre, Math.max(8, hi - lo + 2.5));
    this.knife = knife;
    this.buildCut(knife, jobs);
    return 'ok';
  }

  /** Builds the new pieces, in a worker when there is one; the knife waits in its groove until they arrive. */
  private buildCut(knife: Knife, jobs: SplitJob[]) {
    const finish = (results: CutChild[][]) => {
      if (this.knife !== knife) return;
      knife.plan = {
        world: knife.plane,
        splits: jobs
          .map((j, i) => ({ parent: j.parent, children: results[i] }))
          .filter((s) => s.children.length >= 2 && this.pieces.includes(s.parent)),
      };
      for (const s of knife.plan.splits) for (const c of s.children) c.piece.id = this.nextId++;
    };
    const worker = this.worker();
    if (!worker) {
      finish(jobs.map((j) => buildChildren(this.an, j.parent.sim, j.parent.planes, j.rest, () => 0)));
      this.reportCut(mergeReports(jobs.map((j) => sectionReport(this.an, j.parent.planes, j.rest, this.type.umPerUnit))));
      return;
    }
    const id = ++this.requestId;
    const req: CutRequest = {
      id,
      cellType: this.type.id,
      umPerUnit: this.type.umPerUnit,
      seed: this.an.seed,
      jobs: jobs.map((j) => ({
        parentPlanes: j.parent.planes,
        rest: j.rest,
        parent: { restPos: j.parent.sim.restPos, tets: j.parent.sim.tets, restInv: j.parent.sim.restInv, spacing: j.parent.sim.spacing },
      })),
    };
    const onMessage = (e: MessageEvent<{ id: number; results: CutChild[][]; report: SectionEntry[] }>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      finish(e.data.results);
      if (this.knife === knife) this.reportCut(e.data.report);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage(req);
  }

  private cutSerial = 0;
  private reportCut(entries: SectionEntry[]) {
    this.lastCut = { entries, serial: ++this.cutSerial };
  }

  private anchorCache = new WeakMap<Piece, { label: Label; tet: number; bary: Float64Array }[]>();
  /**
   * World positions of the teaching labels. Each anchor rides in whichever piece
   * contains it; anchors in a sliver too thin to hold them are skipped.
   */
  labelPositions(): { label: Label; pos: Vec3 }[] {
    const out: { label: Label; pos: Vec3 }[] = [];
    for (const p of this.pieces) {
      let emb = this.anchorCache.get(p);
      if (!emb) {
        emb = [];
        const grid = new TetGrid(p.sim);
        for (const label of this.labels) {
          const a = label.anchor;
          if (pieceSdf(this.an, p.planes, a[0], a[1], a[2]) >= 0) continue;
          const { tet, minBary } = grid.locate(a[0], a[1], a[2]);
          if (tet < 0 || minBary < -0.5) continue;
          const bary = new Float64Array(4);
          grid.bary(tet, a[0], a[1], a[2], bary);
          emb.push({ label, tet, bary });
        }
        this.anchorCache.set(p, emb);
      }
      const P = p.sim.pos, T = p.sim.tets;
      for (const { label, tet, bary } of emb) {
        const pos: Vec3 = [0, 0, 0];
        for (let j = 0; j < 4; j++) {
          const i = 3 * T[4 * tet + j];
          pos[0] += bary[j] * P[i]; pos[1] += bary[j] * P[i + 1]; pos[2] += bary[j] * P[i + 2];
        }
        out.push({ label, pos });
      }
    }
    return out;
  }

  private cutWorker: Worker | null | undefined;
  private requestId = 0;
  private worker(): Worker | null {
    if (this.cutWorker === undefined) {
      try {
        this.cutWorker = typeof Worker === 'undefined' ? null : new Worker(new URL('../cut/worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.cutWorker = null;
      }
    }
    return this.cutWorker;
  }

  nudge() {
    for (const p of this.pieces) {
      const s = p.sim;
      const c = centre(s.pos);
      const ax = Math.random() - 0.5, az = Math.random() - 0.5;
      const w = 7 + Math.random() * 5;
      const up = 34 + Math.random() * 14;
      const side = [(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16];
      for (let i = 0; i < s.invMass.length; i++) {
        const rx = s.pos[3 * i] - c[0], ry = s.pos[3 * i + 1] - c[1], rz = s.pos[3 * i + 2] - c[2];
        // v += ω × r with ω horizontal
        s.vel[3 * i] += side[0] + w * (-az * ry);
        s.vel[3 * i + 1] += up + w * (az * rx - ax * rz);
        s.vel[3 * i + 2] += side[1] + w * (ax * ry);
      }
    }
  }

  /** Middle of the box around every piece (what the camera frames). */
  centre(): number[] {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of this.pieces) {
      const P = p.sim.pos;
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
    }
    return lo.map((l, k) => (l + hi[k]) / 2);
  }

  stats(): Stats {
    let cur = 0, rest = 0, ke = 0;
    for (const p of this.pieces) {
      cur += currentVolume(p.sim);
      rest += restVolume(p.sim);
      const s = p.sim;
      for (let i = 0; i < s.invMass.length; i++) {
        if (!s.invMass[i]) continue;
        ke += (0.5 / s.invMass[i]) * (s.vel[3 * i] ** 2 + s.vel[3 * i + 1] ** 2 + s.vel[3 * i + 2] ** 2);
      }
    }
    // Kinetic energy at "jelly scale": 1 unit = UNIT_CM cm of gelatin at 1.1 g/cm³.
    const massScale = UNIT_CM ** 3 * 1.1e-3; // kg per unit³
    const velScale = UNIT_CM * 1e-2; // m/s per unit/s
    return {
      massPg: this.restTotal * this.type.umPerUnit ** 3 * CELL_DENSITY,
      volumePct: (100 * cur) / rest,
      kineticMicroJ: ke * massScale * velScale ** 2 * 1e6,
      pieces: this.pieces.length,
    };
  }
}

function centre(p: Float32Array): number[] {
  const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; }
  const n = p.length / 3;
  return [c[0] / n, c[1] / n, c[2] / n];
}

function placeOnFloor(s: SimMesh, lift: number) {
  let minY = Infinity;
  for (let i = 1; i < s.pos.length; i += 3) minY = Math.min(minY, s.pos[i]);
  for (let i = 1; i < s.pos.length; i += 3) { s.pos[i] += lift - minY; s.prevPos[i] = s.pos[i]; }
  s.vel.fill(0);
}

function cloneSkin(s: SkinMesh): SkinMesh {
  return { ...s, pos: s.pos.slice(), normal: s.normal.slice() };
}

export function clonePiece(p: Piece, id: number): Piece {
  const s = p.sim;
  return {
    id,
    planes: p.planes,
    sim: { ...s, pos: s.restPos.slice(), prevPos: s.restPos.slice(), vel: new Float32Array(s.vel.length), invMass: s.invMass.slice() },
    skin: cloneSkin(p.skin),
    organelles: p.organelles.map(cloneSkin),
  };
}
