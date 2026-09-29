import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { cellSdf, materialAt } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { buildPiece } from '../src/mesh/piece';
import { paramsFor } from '../src/physics/params';
import { currentVolume, restVolume } from '../src/physics/metrics';
import { placeOnFloor, simulate } from './helpers';
import { Mat, Prim, type Anatomy, type CellType, type CellTypeId, type Label, type Piece, type SimMesh } from '../src/contracts';

const feature = await loadFeature('features/celltypes.feature');

function monteCarloVolume(an: Anatomy, n = 150000) {
  const { lo, hi } = an.bounds;
  let inside = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    if (cellSdf(an, lo[0] + rnd() * (hi[0] - lo[0]), lo[1] + rnd() * (hi[1] - lo[1]), lo[2] + rnd() * (hi[2] - lo[2])) < 0) inside++;
  }
  return (inside / n) * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}

function extent(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/** Thickness of the body along y through (x, z). */
function thicknessAt(an: Anatomy, x: number, z: number) {
  let n = 0;
  for (let y = an.bounds.lo[1]; y < an.bounds.hi[1]; y += 0.005) if (cellSdf(an, x, y, z) < 0) n++;
  return n * 0.005;
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let ct: CellType;
  let an: Anatomy;
  let sim: SimMesh;
  let labels: Label[];
  let piece: Piece;
  const given = (Given: (s: string, f: () => void) => void, id?: CellTypeId) =>
    Given(id ? `the ${id} cell type` : 'the <type> cell type', () => undefined);

  ScenarioOutline('Every cell type builds a sound soft body', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('its simulation mesh is built', () => { sim = buildSimMesh(an, []); });
    Then('every tetrahedron has a positive rest volume', () => { for (const x of sim.restVol) expect(x).toBeGreaterThan(0); });
    And('the tetrahedra form a single connected component', () => {
      expect(new Set(tetComponents(sim.tets, sim.restPos.length / 3)).size).toBe(1);
    });
    And('the summed tetrahedron volume is within 6 percent of the body volume', () => {
      const vol = sim.restVol.reduce((a, b) => a + b, 0), ref = monteCarloVolume(an);
      expect(Math.abs(vol - ref) / ref).toBeLessThan(0.06);
    });
    And('the particle count stays within the real-time budget', () => {
      const n = sim.restPos.length / 3;
      expect(n).toBeGreaterThan(300);
      expect(n).toBeLessThan(2400);
    });
  });

  ScenarioOutline('Labels point at what they name', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('its labels are listed', () => { labels = ct.labels(an); });
    Then('there are at least three labels', () => expect(labels.length).toBeGreaterThanOrEqual(3));
    And('every label anchor lies inside the cell', () => {
      for (const l of labels) expect(cellSdf(an, ...l.anchor), l.name).toBeLessThan(0);
    });
    And('every label with a material sits inside that material', () => {
      for (const l of labels) if (l.material !== undefined) expect(materialAt(an, ...l.anchor), l.name).toBe(l.material);
    });
  });

  ScenarioOutline('Every cell type comes to rest on the floor', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('it is dropped on the floor and left for two seconds', () => {
      piece = buildPiece(an, [], 0);
      placeOnFloor(piece, 0.3);
      simulate([piece], 2, paramsFor(ct));
    });
    Then('no particle is below the floor', () => {
      let minY = Infinity;
      for (let i = 1; i < piece.sim.pos.length; i += 3) minY = Math.min(minY, piece.sim.pos[i]);
      expect(minY).toBeGreaterThan(-1e-3);
    });
    And('its volume is within 3 percent of rest', () => {
      expect(Math.abs(currentVolume(piece.sim) / restVolume(piece.sim) - 1)).toBeLessThan(0.03);
    });
  });

  Scenario('A red blood cell has no nucleus and a dimple', ({ Given, When, Then, And }) => {
    given(Given, 'rbc');
    When('its anatomy is built', () => { ct = cellType('rbc'); an = ct.build(); });
    Then('it has no nucleus, nucleolus or mitochondria', () => {
      const banned: number[] = [Mat.Nucleus, Mat.Nucleolus, Mat.Mitochondrion];
      expect(an.organelles.filter((o) => banned.includes(o.material))).toHaveLength(0);
    });
    And('it is thinner at its centre than at its rim', () => {
      const centre = thicknessAt(an, 0, 0);
      let rim = 0;
      for (let r = 1; r < 3.2; r += 0.1) rim = Math.max(rim, thicknessAt(an, r, 0));
      expect(centre).toBeGreaterThan(0.3);
      expect(centre).toBeLessThan(0.7 * rim);
    });
  });

  Scenario('A fibroblast lies flat and spread', ({ Given, When, Then, And }) => {
    given(Given, 'fibroblast');
    When('its anatomy is built', () => { ct = cellType('fibroblast'); an = ct.build(); });
    Then('it is less than a third as tall as it is long', () => {
      const e = extent(buildSimMesh(an, []).restPos);
      expect(e.size[1]).toBeLessThan(Math.max(e.size[0], e.size[2]) / 3);
    });
    And('it has stress fibres ending in focal adhesions', () => {
      const fibres = an.tubules.filter((t) => t.material === Mat.Actin);
      const adhesions = an.organelles.filter((o) => o.material === Mat.Adhesion);
      expect(fibres.length).toBeGreaterThanOrEqual(3);
      for (const f of fibres) {
        const end = f.points[f.points.length - 1];
        const near = adhesions.some((a) => Math.hypot(a.a[0] - end[0], a.a[1] - end[1], a.a[2] - end[2]) < 0.5);
        expect(near).toBe(true);
      }
    });
  });

  Scenario('A neuron reaches far beyond its soma', ({ Given, When, Then, And }) => {
    given(Given, 'neuron');
    When('its anatomy is built', () => { ct = cellType('neuron'); an = ct.build(); });
    Then('it is more than three soma diameters long', () => {
      const soma = an.body[0].prim;
      const e = extent(buildSimMesh(an, []).restPos);
      expect(Math.max(e.size[0], e.size[2])).toBeGreaterThan(3 * 2 * soma.b[0]);
    });
    And('it has Nissl bodies and a nucleolus', () => {
      expect(an.organelles.filter((o) => o.material === Mat.ER).length).toBeGreaterThanOrEqual(3);
      expect(an.organelles.some((o) => o.material === Mat.Nucleolus)).toBe(true);
    });
  });

  Scenario('Microglia are ramified', ({ Given, When, Then, And }) => {
    given(Given, 'microglia');
    When('its anatomy is built', () => { ct = cellType('microglia'); an = ct.build(); });
    Then('at least four processes leave the soma', () => {
      const soma = an.body[0].prim;
      const primary = an.body.filter((b) => b.prim.kind === Prim.Cone &&
        Math.hypot(b.prim.a[0] - soma.a[0], b.prim.a[1] - soma.a[1], b.prim.a[2] - soma.a[2]) < Math.max(...soma.b) + 0.3);
      expect(primary.length).toBeGreaterThanOrEqual(4);
    });
    And('it has lysosomes', () => {
      expect(an.organelles.filter((o) => o.material === Mat.Lysosome).length).toBeGreaterThanOrEqual(2);
    });
  });
});
