import { describe, it, expect } from 'vitest';
import { primSdf, cellSdf, packAnatomyGPU, materialAt } from '../src/anatomy/sdf';
import { defaultAnatomy } from '../src/anatomy/anatomy';
import { Mat, Prim, PRIM_STRIDE, type Primitive } from '../src/contracts';

describe('primitive SDFs', () => {
  it('sphere-shaped ellipsoid gives exact distance', () => {
    const p: Primitive = { kind: Prim.Ellipsoid, material: Mat.Nucleus, a: [1, 0, 0], b: [2, 2, 2], R: 0, r: 0 };
    expect(primSdf(p, 1, 0, 0)).toBeCloseTo(-2, 3);
    expect(primSdf(p, 5, 0, 0)).toBeCloseTo(2, 2);
  });
  it('capsule distance', () => {
    const p: Primitive = { kind: Prim.Capsule, material: Mat.Mitochondrion, a: [0, 0, 0], b: [2, 0, 0], R: 0, r: 0.5 };
    expect(primSdf(p, 1, 1, 0)).toBeCloseTo(0.5, 5);
    expect(primSdf(p, 3, 0, 0)).toBeCloseTo(0.5, 5);
  });
  it('torus distance', () => {
    const p: Primitive = { kind: Prim.Torus, material: Mat.Septin, a: [0, 0, 0], b: [1, 0, 0], R: 1, r: 0.2 };
    expect(primSdf(p, 0, 1, 0)).toBeCloseTo(-0.2, 5);
    expect(primSdf(p, 0, 0, 0)).toBeCloseTo(0.8, 5);
  });
});

describe('anatomy', () => {
  const an = defaultAnatomy();
  it('mother and bud centres are inside the cell', () => {
    expect(cellSdf(an, ...an.mother.centre)).toBeLessThan(-1);
    expect(cellSdf(an, ...an.bud.centre)).toBeLessThan(-1);
  });
  it('the nucleus centre is nucleus material', () => {
    const nuc = an.organelles.find((o) => o.material === Mat.Nucleus)!;
    expect([Mat.Nucleus, Mat.Nucleolus]).toContain(materialAt(an, ...nuc.a));
  });
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(defaultAnatomy(3))).toBe(JSON.stringify(defaultAnatomy(3)));
    expect(JSON.stringify(defaultAnatomy(3))).not.toBe(JSON.stringify(defaultAnatomy(4)));
  });
  it('packs primitives for the GPU', () => {
    const buf = packAnatomyGPU(an);
    const n = an.organelles.length;
    expect(buf.length).toBeGreaterThanOrEqual(n * PRIM_STRIDE);
    const o = an.organelles[n - 1], base = (n - 1) * PRIM_STRIDE;
    expect(buf[base]).toBe(o.kind);
    expect(buf[base + 1]).toBe(o.material);
    expect(buf[base + 4]).toBeCloseTo(o.a[0]);
    expect(buf[base + 8]).toBeCloseTo(o.b[0]);
  });
});
