import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { cellSdf, materialAt } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { Mat, type Anatomy, type Label, type SimMesh } from '../src/contracts';

const feature = await loadFeature('features/cellcycle.feature');
const yeast = cellType('yeast');

/** x of the neck: the septin ring(s), or where mother meets bud. */
function neckX(an: Anatomy) {
  const s = an.organelles.filter((o) => o.material === Mat.Septin);
  return s.length ? s.reduce((a, o) => a + o.a[0], 0) / s.length : 2.4;
}

/** Runs of nucleus along the mother→bud axis through the nuclei. */
function nucleusRuns(an: Anatomy) {
  const nuc = an.organelles.filter((o) => o.material === Mat.Nucleus);
  const y = nuc.reduce((a, o) => a + o.a[1], 0) / nuc.length, z = nuc.reduce((a, o) => a + o.a[2], 0) / nuc.length;
  const runs: { from: number; to: number }[] = [];
  let inside = false;
  for (let x = an.bounds.lo[0]; x < an.bounds.hi[0]; x += 0.02) {
    const m = materialAt(an, x, y, z);
    // the spindle is inside the nuclear envelope
    const isN = m === Mat.Nucleus || m === Mat.Nucleolus || m === Mat.Spindle;
    if (isN && !inside) runs.push({ from: x, to: x });
    if (isN) runs[runs.length - 1].to = x;
    inside = isN;
  }
  return runs;
}

function volume(an: Anatomy) {
  const { lo, hi } = an.bounds;
  let n = 0;
  const h = 0.08;
  for (let x = lo[0]; x < hi[0]; x += h) for (let y = lo[1]; y < hi[1]; y += h) for (let z = lo[2]; z < hi[2]; z += h) if (cellSdf(an, x, y, z) < 0) n++;
  return n * h ** 3;
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let an: Anatomy;
  let sim: SimMesh;
  let labels: Label[];
  const atStage = (Given: (s: string, f: () => void) => void, stage: number) =>
    Given(`the yeast cell at stage ${stage}`, () => { an = yeast.build(7, stage); labels = yeast.labels(an); });

  ScenarioOutline('Every stage is a sound soft body with honest labels', ({ Given, When, Then, And }, v) => {
    Given('the yeast cell at stage <stage>', () => { an = yeast.build(7, Number(v.stage)); labels = yeast.labels(an); });
    When('its simulation mesh is built', () => { sim = buildSimMesh(an, []); });
    Then('every tetrahedron has a positive rest volume', () => { for (const x of sim.restVol) expect(x).toBeGreaterThan(0); });
    And('the tetrahedra form a single connected component', () => {
      expect(new Set(tetComponents(sim.tets, sim.restPos.length / 3)).size).toBe(1);
    });
    And('every label anchor lies inside the cell', () => {
      for (const l of labels) expect(cellSdf(an, ...l.anchor), l.name).toBeLessThan(0);
    });
    And('every label with a material sits inside that material', () => {
      for (const l of labels) if (l.material !== undefined) expect(materialAt(an, ...l.anchor), l.name).toBe(l.material);
    });
  });

  Scenario('The bud grows through the cycle', ({ Given, When, Then }) => {
    let vols: number[] = [];
    Given('the yeast cell at every stage', () => undefined);
    When('the cell volumes are measured', () => { vols = yeast.stages!.map((_, i) => volume(yeast.build(7, i))); });
    Then('each stage up to telophase is larger than the one before', () => {
      for (let i = 1; i <= 4; i++) expect(vols[i], `stage ${i}`).toBeGreaterThan(vols[i - 1]);
    });
  });

  Scenario('A G1 cell has no bud yet', ({ Given, When, Then, And }) => {
    atStage(Given, 0);
    When('its anatomy is built', () => undefined);
    Then('its body is the mother alone', () => expect(an.body).toHaveLength(1));
    And('there is no septin ring', () => expect(an.organelles.some((o) => o.material === Mat.Septin)).toBe(false));
  });

  Scenario('In anaphase the nucleus spans the neck', ({ Given, When, Then, And }) => {
    atStage(Given, 3);
    When('its anatomy is built', () => undefined);
    Then('there is nucleus on both sides of the neck', () => {
      const runs = nucleusRuns(an), x = neckX(an);
      expect(runs.some((r) => r.from < x - 0.3)).toBe(true);
      expect(runs.some((r) => r.to > x + 0.3)).toBe(true);
    });
    And('it is one connected nucleus', () => expect(nucleusRuns(an)).toHaveLength(1));
  });

  Scenario('In telophase there are two nuclei and two septin rings', ({ Given, When, Then, And }) => {
    atStage(Given, 4);
    When('its anatomy is built', () => undefined);
    Then('there is nucleus on both sides of the neck', () => {
      const runs = nucleusRuns(an), x = neckX(an);
      expect(runs.some((r) => r.from < x - 0.3)).toBe(true);
      expect(runs.some((r) => r.to > x + 0.3)).toBe(true);
    });
    And('the two nuclei are separate', () => expect(nucleusRuns(an)).toHaveLength(2));
    And('there are two septin rings', () => expect(an.organelles.filter((o) => o.material === Mat.Septin)).toHaveLength(2));
  });

  Scenario('At cytokinesis the neck closes', ({ Given, When, Then, And }) => {
    /** Radius of the cell's cross-section at x. */
    const radiusAt = (a: Anatomy, x: number) => { let r = 0; while (r < 4 && cellSdf(a, x, 0, r) < 0) r += 0.005; return r; };
    atStage(Given, 5);
    When('its anatomy is built', () => undefined);
    Then('the neck is narrower than in telophase', () => {
      const telo = yeast.build(7, 4);
      expect(radiusAt(an, neckX(an))).toBeLessThan(0.8 * radiusAt(telo, neckX(telo)));
      expect(radiusAt(an, neckX(an))).toBeGreaterThan(0.15);
    });
    And('there is a septum across the neck', () => {
      const s = an.organelles.filter((o) => o.material === Mat.Septum);
      expect(s).toHaveLength(1);
      expect(Math.abs(s[0].a[0] - neckX(an))).toBeLessThan(0.1);
    });
    And('the two nuclei are separate', () => expect(nucleusRuns(an)).toHaveLength(2));
  });
});
