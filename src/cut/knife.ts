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

/** Which part of the knife a vertex belongs to (rest.w of the mesh; the shader shades each differently). */
export const KnifePart = { Blade: 0, Wood: 1, Bolster: 2, Rivet: 3, Bevel: 4 } as const;

const HANDLE_L = 3.5, BOLSTER_L = 0.4;
/** Half-thickness of the blade at the spine, at the heel. */
const SPINE_T = 0.075;

/**
 * The knife as a world-space mesh for the renderer, or null when it is away: a chef's knife
 * with a ground blade, a bolster and a riveted wooden handle. In knife-local coordinates x
 * runs from handle to tip, y is up from the cutting edge and z is across the blade; they are
 * kept in rest.xyz for the wood grain and the brushing of the steel. The edge is level (y = 0)
 * under the cell, as the physics assumes, and sweeps up to the tip only beyond it.
 */
export function bladeMesh(k: Knife): WorldMesh | null {
  if (k.phase === 'done') return null;
  const L = k.length, H = BLADE_H;
  const pos: number[] = [], nrm: number[] = [], rest: number[] = [], idx: number[] = [];
  const X = k.along, Z = k.plane.n, Y: Vec3 = [0, 1, 0];
  const o: Vec3 = [k.centre[0], k.edgeY, k.centre[2]];
  const toWorld = (p: number[]): number[] => [0, 1, 2].map((a) => o[a] + X[a] * p[0] + Y[a] * p[1] + Z[a] * p[2]);
  const dirWorld = (v: number[]): number[] => {
    const w = [0, 1, 2].map((a) => X[a] * v[0] + Y[a] * v[1] + Z[a] * v[2]);
    const l = Math.hypot(w[0], w[1], w[2]) || 1;
    return w.map((c) => c / l);
  };
  const vert = (p: number[], n: number[], part: number) => { pos.push(...toWorld(p)); nrm.push(...dirWorld(n)); rest.push(p[0], p[1], p[2], part); return pos.length / 3 - 1; };
  const faceNormal = (a: number[], b: number[], c: number[]) => {
    const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], f = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
  };
  /** A flat-shaded quad a-b-c-e (or a triangle when c = e), facing `out` (a rough outward direction). */
  const quad = (a: number[], b: number[], c: number[], e: number[], part: number, out: number[]) => {
    let n = faceNormal(a, b, c);
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) n = faceNormal(a, c, e);
    const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0;
    if (flip) n = n.map((x) => -x);
    const i = [a, b, c, e].map((p) => vert(p, n, part));
    if (flip) idx.push(i[0], i[2], i[1], i[0], i[3], i[2]); else idx.push(i[0], i[1], i[2], i[0], i[2], i[3]);
  };

  // Blade profile: a level edge that sweeps up over the last quarter, a spine that drops to meet it.
  const x0 = -L / 2, x1 = L / 2, tipY = 0.5 * H;
  const belly = x1 - 0.26 * L, drop = x0 + 0.5 * L, bevelH = 0.32;
  const edgeAt = (x: number) => (x <= belly ? 0 : tipY * ((x - belly) / (x1 - belly)) ** 2);
  const spineAt = (x: number) => (x <= drop ? H : H - (H - tipY) * ((x - drop) / (x1 - drop)) ** 2);
  const thick = (x: number) => SPINE_T * (1 - 0.72 * Math.max(0, (x - x0) / L)); // distal taper
  const N = 16;
  const xs = Array.from({ length: N + 1 }, (_, i) => {
    // stations bunch toward the tip, where the outline curves
    const t = i / N;
    return x0 + L * (t < 0.5 ? t * 1.2 : 0.6 + (t - 0.5) * 0.8);
  });
  for (let i = 0; i < N; i++) {
    const a = xs[i], b = xs[i + 1], last = i === N - 1;
    for (const sgn of [1, -1]) {
      const edge = (x: number) => [x, edgeAt(x), 0];
      // the grind: a narrow bevel at the edge, then the flat up to the spine
      const shoulder = (x: number) => { const h = Math.min(bevelH, 0.6 * (spineAt(x) - edgeAt(x))); return [x, edgeAt(x) + h, sgn * thick(x) * 0.5]; };
      const spine = (x: number) => [x, spineAt(x), sgn * thick(x)];
      quad(edge(a), edge(b), last ? edge(b) : shoulder(b), shoulder(a), KnifePart.Bevel, [0, -0.2, sgn]);
      quad(shoulder(a), last ? edge(b) : shoulder(b), last ? edge(b) : spine(b), spine(a), KnifePart.Blade, [0, 0, sgn]);
    }
    if (!last) quad([a, spineAt(a), thick(a)], [b, spineAt(b), thick(b)], [b, spineAt(b), -thick(b)], [a, spineAt(a), -thick(a)], KnifePart.Blade, [0, 1, 0]);
  }
  // heel: the back of the blade below the bolster
  quad([x0, 0, 0], [x0, bevelH, SPINE_T * 0.5], [x0, H, SPINE_T], [x0, H, SPINE_T], KnifePart.Blade, [-1, 0, 0]);
  quad([x0, 0, 0], [x0, bevelH, -SPINE_T * 0.5], [x0, H, -SPINE_T], [x0, H, -SPINE_T], KnifePart.Blade, [-1, 0, 0]);
  quad([x0, bevelH, SPINE_T * 0.5], [x0, H, SPINE_T], [x0, H, -SPINE_T], [x0, bevelH, -SPINE_T * 0.5], KnifePart.Blade, [-1, 0, 0]);

  // Bolster and handle: rings of an eight-sided rounded section, lofted along x with smooth normals.
  const ring = (x: number, yc: number, h: number, w: number): number[][] =>
    [[h, 0.5 * w], [0.5 * h, w], [-0.5 * h, w], [-h, 0.5 * w], [-h, -0.5 * w], [-0.5 * h, -w], [0.5 * h, -w], [h, -0.5 * w]].map(([dy, dz]) => [x, yc + dy, dz]);
  const loft = (stations: { x: number; yc: number; h: number; w: number }[], part: number) => {
    const rows = stations.map((s) => ring(s.x, s.yc, s.h, s.w).map((p) => vert(p, [0, (p[1] - s.yc) / (s.h * s.h), p[2] / (s.w * s.w)], part)));
    for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j < 8; j++) {
      const a = rows[i][j], b = rows[i][(j + 1) % 8], c = rows[i + 1][(j + 1) % 8], e = rows[i + 1][j];
      idx.push(a, e, b, b, e, c);
    }
  };
  const cap = (s: { x: number; yc: number; h: number; w: number }, part: number, dir: number) => {
    const pts = ring(s.x, s.yc, s.h, s.w), c = vert([s.x, s.yc, 0], [dir, 0, 0], part), v = pts.map((p) => vert(p, [dir, 0, 0], part));
    for (let j = 0; j < 8; j++) { const a = v[j], b = v[(j + 1) % 8]; if (dir > 0) idx.push(c, b, a); else idx.push(c, a, b); }
  };
  const yc = 0.66 * H, bx0 = x0 - BOLSTER_L;
  const bolster = [
    { x: x0 + 0.02, yc: yc + 0.02 * H, h: 0.33 * H, w: SPINE_T + 0.03 },
    { x: x0 - 0.5 * BOLSTER_L, yc, h: 0.31 * H, w: 0.2 },
    { x: bx0, yc, h: 0.3 * H, w: 0.23 },
  ];
  loft(bolster, KnifePart.Bolster);
  cap(bolster[0], KnifePart.Bolster, 1);
  // the handle swells in the palm and dips toward the butt
  const handle = [0, 0.18, 0.45, 0.75, 0.93, 1].map((t) => ({
    x: bx0 - t * HANDLE_L,
    yc: yc - 0.1 * H * t * t,
    h: 0.3 * H * (1 + 0.14 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.93 ? 0.12 : 0)),
    w: 0.235 * (1 + 0.12 * Math.sin(Math.PI * t)) * (t > 0.93 ? 0.85 : 1),
  }));
  loft(handle, KnifePart.Wood);
  cap(handle[handle.length - 1], KnifePart.Wood, -1);
  // three brass rivets through the tang, a hair proud of each scale
  for (const t of [0.2, 0.5, 0.8]) {
    const x = bx0 - t * HANDLE_L, cy = yc - 0.1 * H * t * t, w = 0.235 * (1 + 0.12 * Math.sin(Math.PI * t)) + 0.004, r = 0.11;
    for (const sgn of [1, -1]) {
      const c = vert([x, cy, sgn * w], [0, 0, sgn], KnifePart.Rivet);
      const v = Array.from({ length: 10 }, (_, j) => vert([x + r * Math.cos((j * Math.PI) / 5), cy + r * Math.sin((j * Math.PI) / 5), sgn * w], [0, 0, sgn], KnifePart.Rivet));
      for (let j = 0; j < 10; j++) { const a = v[j], b = v[(j + 1) % 10]; if (sgn > 0) idx.push(c, a, b); else idx.push(c, b, a); }
    }
  }
  return { pos: new Float32Array(pos), normal: new Float32Array(nrm), rest: new Float32Array(rest), idx: new Uint32Array(idx) };
}
