// The knife comes down: its edge presses a groove into the jelly, breaks through
// (the prebuilt pieces are swapped in), wedges the new faces apart on its way to
// the board, then lifts away.

import type { CutPlan, Piece, Plane, Vec3 } from '../contracts';
import type { WorldMesh } from '../render/renderer';

type Phase = 'descend' | 'press' | 'through' | 'hold' | 'lift' | 'done';

export interface Knife {
  plane: Plane;
  /** Horizontal direction along the blade, from handle to tip. */
  along: Vec3;
  /** Point on the plane (y = 0) under the middle of the blade. */
  centre: Vec3;
  length: number;
  /** Pieces the blade is cutting through. */
  parents: Piece[];
  /** Filled in once the new pieces are built (possibly by a worker). */
  plan: CutPlan | null;
  phase: Phase;
  t: number;
  edgeY: number;
  top: number;
  pressDepth: number;
  /** After the swap: which side of the plane each new piece lies on (±1). */
  sides: Map<Piece, number>;
}

const BLADE_H = 2.6;
/** Largest displacement the blade applies to a particle in one substep (µm). */
const MAX_PUSH = 0.012;
const BLADE_T = 0.09;
const DURATION: Record<Phase, number> = { descend: 0.16, press: 0.3, through: 0.26, hold: 0.14, lift: 0.34, done: 0 };

export function startKnife(plane: Plane, parents: Piece[], along: Vec3, centre: Vec3, length: number): Knife {
  let top = 0;
  for (const parent of parents) {
    const p = parent.sim.pos;
    for (let i = 1; i < p.length; i += 3) top = Math.max(top, p[i]);
  }
  return {
    plane, along, centre, length, parents, plan: null, phase: 'descend', t: 0,
    edgeY: top + 3, top, pressDepth: Math.min(1.3, 0.3 * top), sides: new Map(),
  };
}

/**
 * Advances the animation. Returns true on the frame the blade breaks through (swap now).
 * The edge waits at the bottom of its groove until the new pieces are ready.
 */
export function advanceKnife(k: Knife, dt: number): boolean {
  k.t += dt;
  if (k.phase === 'press' && !k.plan) k.t = Math.min(k.t, DURATION.press);
  const u = Math.min(1, k.t / DURATION[k.phase]);
  const ease = u * u * (3 - 2 * u);
  let swap = false;
  switch (k.phase) {
    case 'descend': k.edgeY = k.top + 3 - 3 * ease; break;
    case 'press': k.edgeY = k.top - k.pressDepth * u; break;
    case 'through': k.edgeY = (k.top - k.pressDepth) * (1 - u); break;
    case 'hold': k.edgeY = 0; break;
    case 'lift': k.edgeY = (k.top + 3.5) * ease; break;
  }
  if (u >= 1 && !(k.phase === 'press' && !k.plan)) {
    const next: Record<Phase, Phase> = { descend: 'press', press: 'through', through: 'hold', hold: 'lift', lift: 'done', done: 'done' };
    k.phase = next[k.phase];
    k.t = 0;
    if (k.phase === 'through') swap = !!k.plan && k.plan.splits.length > 0;
  }
  return swap;
}

/** Records which side of the blade each freshly swapped-in piece lies on. */
export function assignSides(k: Knife) {
  const { n, d } = k.plane;
  for (const s of k.plan?.splits ?? []) for (const c of s.children) {
    const p = c.piece.sim.pos;
    let m = 0;
    for (let i = 0; i < p.length; i += 3) m += n[0] * p[i] + n[1] * p[i + 1] + n[2] * p[i + 2] - d;
    k.sides.set(c.piece, m >= 0 ? 1 : -1);
  }
}

/** Blade contact, applied every substep: a groove before the swap, a wedge after. */
export function knifeConstraint(k: Knife, pieces: Piece[]) {
  const { n, d } = k.plane;
  const pressing = k.phase === 'descend' || k.phase === 'press';
  for (const p of pieces) {
    const s = p.sim, P = s.pos;
    const side = k.sides.get(p);
    const isParent = pressing && k.parents.includes(p);
    if (!isParent && side === undefined) continue;
    const band = 0.55 * s.spacing;
    for (let i = 0; i < s.invMass.length; i++) {
      if (s.invMass[i] === 0) continue;
      const y = P[3 * i + 1];
      if (y < k.edgeY) continue;
      const dist = n[0] * P[3 * i] + n[1] * y + n[2] * P[3 * i + 2] - d;
      if (isParent) {
        // the edge pushes the flesh beneath it down
        if (Math.abs(dist) < band) P[3 * i + 1] = Math.max(k.edgeY, y - MAX_PUSH);
      } else if (side !== undefined) {
        // the blade's flanks push each half out to its own side
        const half = BLADE_T / 2 + 0.06 * Math.min(1, (y - k.edgeY) / BLADE_H) + 0.04;
        const sd = side * dist;
        if (sd < half) {
          const push = side * Math.min(half - sd, MAX_PUSH);
          P[3 * i] += n[0] * push; P[3 * i + 1] += n[1] * push; P[3 * i + 2] += n[2] * push;
        }
      }
    }
  }
}

/** The knife as a world-space mesh for the renderer, or null when it is away. */
export function bladeMesh(k: Knife): WorldMesh | null {
  if (k.phase === 'done') return null;
  const L = k.length, H = BLADE_H, T = BLADE_T;
  const pos: number[] = [], nrm: number[] = [], rest: number[] = [], idx: number[] = [];
  const X = k.along, Z = k.plane.n, Y: Vec3 = [0, 1, 0];
  const o: Vec3 = [k.centre[0], k.edgeY, k.centre[2]];
  const toWorld = (p: number[]): number[] => [0, 1, 2].map((a) => o[a] + X[a] * p[0] + Y[a] * p[1] + Z[a] * p[2]);
  const dirWorld = (v: number[]): number[] => {
    const w = [0, 1, 2].map((a) => X[a] * v[0] + Y[a] * v[1] + Z[a] * v[2]);
    const l = Math.hypot(w[0], w[1], w[2]) || 1;
    return w.map((c) => c / l);
  };
  const quad = (a: number[], b: number[], c: number[], e: number[], kind: number) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nn = dirWorld([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    const base = pos.length / 3;
    for (const p of [a, b, c, e]) { pos.push(...toWorld(p)); nrm.push(...nn); rest.push(0, 0, 0, kind); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // Blade: a wedge whose edge is y = 0, spine at y = H, tip rising toward +x.
  const x0 = -L / 2, x1 = L / 2, tipY = H * 0.55;
  const e0 = [x0, 0, 0], e1 = [x1, tipY, 0];
  const sp0 = [x0, H, T / 2], sp1 = [x1, H, T / 2], sm0 = [x0, H, -T / 2], sm1 = [x1, H, -T / 2];
  quad(e0, e1, sp1, sp0, 0);
  quad(e1, e0, sm0, sm1, 0);
  quad(sp0, sp1, sm1, sm0, 0);
  quad(e1, sp1, sm1, sm1, 0); // tip cap (a triangle)
  // Handle: a dark box beyond the heel.
  const h0 = x0 - 3.6, h1 = x0 + 0.05, hy0 = H * 0.32, hy1 = H * 0.98, hz = 0.24;
  const c = (x: number, y: number, z: number) => [x, y, z];
  quad(c(h0, hy0, hz), c(h1, hy0, hz), c(h1, hy1, hz), c(h0, hy1, hz), 1);
  quad(c(h1, hy0, -hz), c(h0, hy0, -hz), c(h0, hy1, -hz), c(h1, hy1, -hz), 1);
  quad(c(h0, hy1, hz), c(h1, hy1, hz), c(h1, hy1, -hz), c(h0, hy1, -hz), 1);
  quad(c(h0, hy0, -hz), c(h1, hy0, -hz), c(h1, hy0, hz), c(h0, hy0, hz), 1);
  quad(c(h0, hy0, -hz), c(h0, hy0, hz), c(h0, hy1, hz), c(h0, hy1, -hz), 1);
  return { pos: new Float32Array(pos), normal: new Float32Array(nrm), rest: new Float32Array(rest), idx: new Uint32Array(idx) };
}
