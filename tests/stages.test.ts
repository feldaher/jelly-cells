import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { cellSdf, materialAt } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { Mat, Prim, type Anatomy, type CellTypeId, type Label, type SimMesh } from '../src/contracts';

const feature = await loadFeature('features/stages.feature');

const build = (id: CellTypeId, stage: number) => cellType(id).build(7, stage);
const stagesOf = (id: CellTypeId) => cellType(id).stages!.map((_, i) => build(id, i));

function extent(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}
function volume(an: Anatomy, h = 0.08) {
  const { lo, hi } = an.bounds;
  let n = 0;
  for (let x = lo[0]; x < hi[0]; x += h) for (let y = lo[1]; y < hi[1]; y += h) for (let z = lo[2]; z < hi[2]; z += h) if (cellSdf(an, x, y, z) < 0) n++;
  return n * h ** 3;
}
function thicknessAt(an: Anatomy, x: number, z: number) {
  let n = 0;
  for (let y = an.bounds.lo[1]; y < an.bounds.hi[1]; y += 0.005) if (cellSdf(an, x, y, z) < 0) n++;
  return n * 0.005;
}
const count = (an: Anatomy, m: number) => an.organelles.filter((o) => o.material === m).length;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let an: Anatomy;
  let sim: SimMesh;
  let labels: Label[];
  let all: Anatomy[] = [];

  ScenarioOutline('Every stage of every cell is a sound soft body with honest labels', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell at stage <stage>', () => {
      const ct = cellType(v.type as CellTypeId);
      an = ct.build(7, Number(v.stage));
      labels = ct.labels(an);
    });
    When('its simulation mesh is built', () => { sim = buildSimMesh(an, []); });
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
      for (const l of labels) expect(cellSdf(an, ...l.anchor), l.name).toBeLessThan(0);
    });
    And('every label with a material sits inside that material', () => {
      for (const l of labels) if (l.material !== undefined) expect(materialAt(an, ...l.anchor), l.name).toBe(l.material);
    });
  });

  Scenario('Activated microglia pull in their processes and fill with lysosomes', ({ Given, When, Then, And }) => {
    let reach: number[] = [];
    Given('the microglia cell at its first and last stages', () => { all = stagesOf('microglia'); all = [all[0], all[all.length - 1]]; });
    When('their anatomies are compared', () => {
      reach = all.map((a) => {
        const soma = a.body[0].prim.a, P = buildSimMesh(a, []).restPos;
        let r = 0;
        for (let i = 0; i < P.length; i += 3) r = Math.max(r, Math.hypot(P[i] - soma[0], P[i + 2] - soma[2]));
        return r;
      });
    });
    Then('the amoeboid cell reaches less far from its soma', () => expect(reach[1]).toBeLessThan(0.7 * reach[0]));
    And('it has more lysosomes', () => expect(count(all[1], Mat.Lysosome)).toBeGreaterThan(count(all[0], Mat.Lysosome)));
  });

  Scenario('An injured neuron loses its distal axon, then regrows it', ({ Given, When, Then, And }) => {
    let reach: number[] = [];
    Given('the neuron cell at every stage', () => { all = stagesOf('neuron'); });
    When('the reach of its axon is measured', () => { reach = all.map((a) => extent(buildSimMesh(a, []).restPos).hi[0]); });
    Then('the axon is shorter after axotomy than when healthy', () => expect(reach[1]).toBeLessThan(reach[0] - 2));
    And('the regenerating axon reaches further than the stump', () => expect(reach[3]).toBeGreaterThan(reach[1] + 1));
    And('the regenerating axon ends in a growth cone', () => {
      const far = [...all[3].body].sort((p, q) => (q.prim.kind === Prim.Ellipsoid ? q.prim.a[0] : -1e9) - (p.prim.kind === Prim.Ellipsoid ? p.prim.a[0] : -1e9))[0].prim;
      expect(far.a[0]).toBeGreaterThan(reach[1]);
      expect(far.b[1]).toBeLessThan(far.b[2]); // flattened
    });
  });

  Scenario('Chromatolysis moves the nucleus aside and disperses the Nissl bodies', ({ Given, When, Then, And }) => {
    let off: number[] = [];
    Given('the neuron cell at stages 0 and 2', () => { all = [build('neuron', 0), build('neuron', 2)]; });
    When('their somata are compared', () => {
      off = all.map((a) => dist(a.organelles.find((o) => o.material === Mat.Nucleus)!.a, a.body[0].prim.a));
    });
    Then('the nucleus sits further from the soma centre', () => expect(off[1]).toBeGreaterThan(off[0] + 0.4));
    And('there are fewer Nissl bodies', () => expect(count(all[1], Mat.ER)).toBeLessThan(count(all[0], Mat.ER)));
  });

  Scenario('A red cell keeps its volume as it rounds up', ({ Given, When, Then, And }) => {
    let vols: number[] = [], centre: number[] = [];
    Given('the rbc cell at every stage', () => { all = stagesOf('rbc'); });
    When('the cell volumes and centre thicknesses are measured', () => {
      vols = all.map((a) => volume(a));
      centre = all.map((a) => thicknessAt(a, 0, 0));
    });
    Then("every volume is within 15 percent of the discocyte's", () => {
      for (const v of vols) expect(Math.abs(v / vols[0] - 1)).toBeLessThan(0.15);
    });
    And('the centre gets thicker at every stage', () => {
      for (let i = 1; i < centre.length; i++) expect(centre[i], `stage ${i}`).toBeGreaterThan(centre[i - 1]);
    });
  });

  Scenario('A spreading fibroblast flattens, a myofibroblast pulls harder', ({ Given, When, Then, And }) => {
    let aspect: number[] = [];
    Given('the fibroblast cell at every stage', () => { all = stagesOf('fibroblast'); });
    When('the shapes and fibres are compared', () => {
      aspect = all.map((a) => { const e = extent(buildSimMesh(a, []).restPos); return e.size[1] / Math.max(e.size[0], e.size[2]); });
    });
    Then('the rounded cell is the tallest for its width', () => {
      for (let i = 1; i < aspect.length; i++) expect(aspect[0]).toBeGreaterThan(aspect[i]);
    });
    And('the myofibroblast has more stress fibres than the migrating cell', () => {
      const fibres = (a: Anatomy) => a.tubules.filter((t) => t.material === Mat.Actin).length;
      expect(fibres(all[3])).toBeGreaterThan(fibres(all[2]));
    });
  });
});
