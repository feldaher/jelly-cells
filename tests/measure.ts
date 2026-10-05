// Measurements of an anatomy taken from its distance field, shared by the cell tests.

import { expect } from 'vitest';
import { cellSdf, materialAt } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { Prim, type Anatomy, type CellType, type Primitive } from '../src/contracts';

type Step = (name: string, fn: () => void) => void;

const mid = (an: Anatomy, k: number) => (an.bounds.lo[k] + an.bounds.hi[k]) / 2;

/** Where the body starts and ends along x, on the line through the middle of its box. */
export function axisExtent(an: Anatomy, h = 0.002): { lo: number; hi: number; length: number } {
  const y = mid(an, 1), z = mid(an, 2);
  let lo = Infinity, hi = -Infinity;
  for (let x = an.bounds.lo[0] - 0.1; x <= an.bounds.hi[0] + 0.1; x += h) if (cellSdf(an, x, y, z) < 0) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return { lo, hi, length: hi - lo + h };
}

/** Width of the body along z at x, through the middle of its box. */
export function widthAt(an: Anatomy, x: number, h = 0.002): number {
  const y = mid(an, 1);
  let n = 0;
  for (let z = an.bounds.lo[2] - 0.1; z <= an.bounds.hi[2] + 0.1; z += h) if (cellSdf(an, x, y, z) < 0) n++;
  return n * h;
}

export function cellVolume(an: Anatomy, h = 0.06): number {
  const { lo, hi } = an.bounds;
  let n = 0;
  for (let x = lo[0]; x < hi[0]; x += h) for (let y = lo[1]; y < hi[1]; y += h) for (let z = lo[2]; z < hi[2]; z += h) if (cellSdf(an, x, y, z) < 0) n++;
  return n * h ** 3;
}

export const of = (an: Anatomy, material: number, kind?: number): Primitive[] =>
  an.organelles.filter((o) => o.material === material && (kind === undefined || o.kind === kind));
export const tubulesOf = (an: Anatomy, material: number) => an.tubules.filter((t) => t.material === material);
export const ellipsoidVol = (p: Primitive) => (4 / 3) * Math.PI * p.b[0] * p.b[1] * p.b[2];
export const isEllipsoid = (p: Primitive) => p.kind === Prim.Ellipsoid;

/** The steps of "… is a sound soft body with honest labels", for a cell type and a stage. */
export function soundBodySteps(get: () => { ct: CellType; stage: number }, When: Step, Then: Step, And: Step) {
  let an: Anatomy, sim: ReturnType<typeof buildSimMesh>;
  When('its simulation mesh is built', () => { const { ct, stage } = get(); an = ct.build(7, stage); sim = buildSimMesh(an, []); });
  Then('every tetrahedron has a positive rest volume', () => { for (const x of sim.restVol) expect(x).toBeGreaterThan(0); });
  And('the tetrahedra form a single connected component', () => {
    expect(new Set(tetComponents(sim.tets, sim.restPos.length / 3)).size).toBe(1);
  });
  And('the particle count stays within the real-time budget', () => {
    const n = sim.restPos.length / 3;
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(2400);
  });
  And('every label anchor lies inside the cell', () => {
    for (const l of get().ct.labels(an)) expect(cellSdf(an, ...l.anchor), l.name).toBeLessThan(0);
  });
  And('every label with a material sits inside that material', () => {
    for (const l of get().ct.labels(an)) if (l.material !== undefined) expect(materialAt(an, ...l.anchor), l.name).toBe(l.material);
  });
}
