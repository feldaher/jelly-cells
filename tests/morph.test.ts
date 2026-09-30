import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { anatomyOf, cellType, labelsAt } from '../src/cells';
import { cellSdf } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { buildPiece } from '../src/mesh/piece';
import { applyKeyframe, buildKeyframe } from '../src/app/morph';
import { World } from '../src/app/world';
import { paramsFor } from '../src/physics/params';
import { currentVolume, restVolume } from '../src/physics/metrics';
import { Mat, Prim, type Anatomy, type CellType, type CellTypeId, type Piece } from '../src/contracts';
import { bestFitPose } from '../src/cut/cut';
import { bbox, placeOnFloor, simulate } from './helpers';

const feature = await loadFeature('features/morph.feature');

/** Fixed pseudo-random sample points inside an anatomy's bounds. */
function samples(an: Anatomy, n = 400): [number, number, number][] {
  let s = 12345;
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const { lo, hi } = an.bounds;
  return Array.from({ length: n }, () => [0, 1, 2].map((k) => lo[k] + r() * (hi[k] - lo[k])) as [number, number, number]);
}
function volume(an: Anatomy, h = 0.1) {
  const { lo, hi } = an.bounds;
  let n = 0;
  for (let x = lo[0]; x < hi[0]; x += h) for (let y = lo[1]; y < hi[1]; y += h) for (let z = lo[2]; z < hi[2]; z += h) if (cellSdf(an, x, y, z) < 0) n++;
  return n * h ** 3;
}
/** How far the flesh reaches along the cell's own bud axis (+x in rest space), whatever way it has rolled. */
function bodyReach(p: Piece) {
  const { R, c, C } = bestFitPose(p.sim), P = p.sim.pos;
  let best = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const d = [P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]];
    best = Math.max(best, C[0] + R[0] * d[0] + R[1] * d[1] + R[2] * d[2]);
  }
  return best;
}
/** How far the solid reaches along +x on the bud axis (y, z at the mother centre). */
function reachX(an: Anatomy) {
  let x = an.bounds.hi[0];
  while (x > 0 && cellSdf(an, x, 0, 0.05) > 0) x -= 0.005;
  return x;
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let ct: CellType;
  let an: Anatomy[] = [];

  ScenarioOutline('The body halfway between two stages is the average of their shapes', ({ Given, When, Then, And }, v) => {
    const halves: Anatomy[] = [];
    Given('the <type> cell', () => { ct = cellType(v.type as CellTypeId); });
    When('its anatomy is taken halfway between every pair of neighbouring stages', () => {
      for (let i = 0; i + 1 < ct.stages!.length; i++) halves.push(anatomyOf(ct.id, 7, i + 0.5));
    });
    Then("at sample points the body distance is the mean of the two stages' distances", () => {
      halves.forEach((h, i) => {
        const a = ct.build(7, i), b = ct.build(7, i + 1);
        for (const p of samples(h)) expect(cellSdf(h, ...p)).toBeCloseTo((cellSdf(a, ...p) + cellSdf(b, ...p)) / 2, 5);
      });
    });
    And('at whole stages the anatomy is exactly the built stage', () => {
      for (let i = 0; i < ct.stages!.length; i++) expect(JSON.stringify(anatomyOf(ct.id, 7, i))).toBe(JSON.stringify(ct.build(7, i)));
    });
  });

  ScenarioOutline('Every in-between stage is a sound soft body', ({ Given, When, Then, And }, v) => {
    const meshes: { s: number; vol: number; restVol: Float32Array }[] = [];
    Given('the <type> cell', () => { ct = cellType(v.type as CellTypeId); });
    When('a mesh is built a quarter, half and three quarters of the way between each pair of stages', () => {
      for (let i = 0; i + 1 < ct.stages!.length; i++) for (const t of [0.25, 0.5, 0.75]) {
        const a = anatomyOf(ct.id, 7, i + t);
        meshes.push({ s: i + t, vol: volume(a), restVol: buildSimMesh(a, []).restVol });
      }
    });
    Then('every tetrahedron has a positive rest volume', () => {
      for (const m of meshes) { expect(m.restVol.length).toBeGreaterThan(0); for (const x of m.restVol) expect(x).toBeGreaterThan(0); }
    });
    And('each in-between volume lies near the range of its two neighbours', () => {
      for (const m of meshes) {
        const va = volume(ct.build(7, Math.floor(m.s))), vb = volume(ct.build(7, Math.ceil(m.s)));
        expect(m.vol, `stage ${m.s}`).toBeGreaterThan(0.8 * Math.min(va, vb));
        expect(m.vol, `stage ${m.s}`).toBeLessThan(1.2 * Math.max(va, vb));
      }
    });
  });

  ScenarioOutline('Organelles stay inside the cell between stages', ({ Given, When, Then, And }, v) => {
    const mids: Anatomy[] = [];
    Given('the <type> cell', () => { ct = cellType(v.type as CellTypeId); });
    When('its anatomy is taken a quarter, half and three quarters of the way between each pair of stages', () => {
      for (let i = 0; i + 1 < ct.stages!.length; i++) for (const t of [0.25, 0.5, 0.75]) mids.push(anatomyOf(ct.id, 7, i + t));
    });
    Then('every organelle is centred inside the cell or on its surface', () => {
      for (const a of mids) for (const o of a.organelles) {
        const c = o.kind === Prim.Capsule || o.kind === Prim.Cone ? [0, 1, 2].map((k) => (o.a[k] + o.b[k]) / 2) as [number, number, number] : o.a;
        const size = o.kind === Prim.Ellipsoid ? Math.min(...o.b) : o.r;
        expect(cellSdf(a, ...c), `stage ${a.stage.toFixed(2)} material ${o.material}`).toBeLessThanOrEqual(size);
      }
    });
    And('every tubule runs inside the cell', () => {
      for (const a of mids) for (const tb of a.tubules) for (const p of tb.points) expect(cellSdf(a, ...p), `stage ${a.stage.toFixed(2)}`).toBeLessThan(0);
    });
  });

  Scenario('The bud swells out of the mother', ({ Given, When, Then, And }) => {
    Given('the yeast cell', () => { ct = cellType('yeast'); });
    When('its anatomy is taken at G1, halfway to S, and at S', () => { an = [0, 0.5, 1].map((s) => anatomyOf('yeast', 7, s)); });
    Then('the cell reaches further along the bud axis at each step', () => {
      const r = an.map(reachX);
      expect(r[1]).toBeGreaterThan(r[0] + 0.1);
      expect(r[2]).toBeGreaterThan(r[1] + 0.1);
    });
    And('halfway there is no separate blob: the cell is one connected body', () => {
      const sim = buildSimMesh(an[1], []);
      expect(new Set(tetComponents(sim.tets, sim.restPos.length / 3)).size).toBe(1);
    });
  });

  Scenario('The daughter nucleus comes out of the mother nucleus', ({ Given, When, Then }) => {
    let a: Anatomy;
    Given('the yeast cell', () => { ct = cellType('yeast'); });
    When('its anatomy is taken just after G2 on the way to anaphase', () => { a = anatomyOf('yeast', 7, 2.05); });
    Then('the new daughter nucleus sits at the mother nucleus and is tiny', () => {
      const nuclei = a.organelles.filter((o) => o.material === Mat.Nucleus && o.kind === Prim.Ellipsoid);
      const mother = ct.build(7, 2).organelles.find((o) => o.material === Mat.Nucleus)!;
      expect(nuclei.length).toBe(2);
      const daughter = nuclei[1];
      expect(Math.hypot(daughter.a[0] - mother.a[0], daughter.a[1] - mother.a[1], daughter.a[2] - mother.a[2])).toBeLessThan(0.4);
      expect(Math.max(...daughter.b)).toBeLessThan(0.1);
    });
  });

  Scenario('A keyframe starts in the old shape and grows into the new one', ({ Given, When, Then, And }) => {
    let old: Piece, next: Piece, before: ReturnType<typeof bbox>, centreBefore: number[], reachBefore = 0;
    const params = paramsFor(cellType('yeast'));
    const centre = (p: Piece) => {
      const c = [0, 0, 0], { pos: P, invMass: w } = p.sim;
      let M = 0;
      for (let i = 0; i < w.length; i++) { const m = w[i] > 0 ? 1 / w[i] : 0; M += m; for (let k = 0; k < 3; k++) c[k] += m * P[3 * i + k]; }
      return c.map((x) => x / M);
    };
    Given('a yeast cell at G1 resting on the floor', () => {
      old = buildPiece(anatomyOf('yeast', 7, 0), [], 1);
      placeOnFloor(old, 0.02);
      simulate([old], 1, params);
    });
    When('a keyframe a quarter of the way to S is swapped in', () => {
      before = bbox(old);
      centreBefore = centre(old);
      reachBefore = bodyReach(old);
      const child = buildKeyframe({ cellType: 'yeast', seed: 7, from: 0, to: 0.25, old: old.sim });
      next = applyKeyframe(old, child);
    });
    Then('the new particles start within one lattice spacing of the old surface', () => {
      const b = bbox(next);
      for (let k = 0; k < 3; k++) {
        expect(b.hi[k]).toBeLessThan(before.hi[k] + old.sim.spacing);
        expect(b.lo[k]).toBeGreaterThan(before.lo[k] - old.sim.spacing);
      }
    });
    And('the cell does not jump: its centre of mass moves less than 0.05 µm', () => {
      const c = centre(next);
      expect(Math.hypot(c[0] - centreBefore[0], c[1] - centreBefore[1], c[2] - centreBefore[2])).toBeLessThan(0.05);
    });
    And('after one second the cell reaches further toward the bud than before', () => {
      // the rest shape reaches 0.065 µm further at a quarter of the way to S (SDF blend of G1 and S)
      simulate([next], 1, params);
      expect(bodyReach(next)).toBeGreaterThan(reachBefore + 0.03);
    });
  });

  Scenario('Playing the cell cycle morphs to the last stage', ({ Given, When, Then, And }) => {
    let w: World;
    Given('a world with the yeast cell at G2', () => { w = new World('yeast'); w.setCellType('yeast', 2); });
    When('it is morphed to telophase and simulated until the morph ends', () => {
      w.morphTo(4, 2);
      for (let f = 0; f < 60 * 8 && w.morphing; f++) w.update(1 / 60);
      for (let f = 0; f < 60; f++) w.update(1 / 60);
    });
    Then('the world is at the telophase stage with one piece', () => {
      expect(w.morphing).toBe(false);
      expect(w.stage).toBe(4);
      expect(w.pieces.length).toBe(1);
    });
    And('every particle is finite and above the floor', () => {
      for (const x of w.pieces[0].sim.pos) expect(Number.isFinite(x)).toBe(true);
      expect(bbox(w.pieces[0]).lo[1]).toBeGreaterThan(-0.05);
    });
    And('the volume is within 10% of rest', () => {
      const s = w.pieces[0].sim;
      expect(currentVolume(s) / restVolume(s)).toBeGreaterThan(0.9);
      expect(currentVolume(s) / restVolume(s)).toBeLessThan(1.1);
    });
  });

  Scenario('A cut cell is made whole before it morphs', ({ Given, When, Then }) => {
    let w: World;
    Given('a world with the yeast cell at G2 cut in two', () => {
      w = new World('yeast');
      w.setCellType('yeast', 2);
      for (let f = 0; f < 30; f++) w.update(1 / 60);
      const c = w.centre();
      expect(w.cut([c[0] - 0.8, 0, c[2] - 6], [c[0] - 0.8, 0, c[2] + 6], [0, 0, -1])).toBe('ok');
      for (let f = 0; f < 120 && w.pieces.length < 2; f++) w.update(1 / 60);
      expect(w.pieces.length).toBeGreaterThan(1);
    });
    When('it is morphed to anaphase', () => { w.morphTo(3, 2); });
    Then('the world is at the anaphase stage with one piece at once', () => {
      expect(w.stage).toBe(3);
      expect(w.pieces.length).toBe(1);
      expect(w.morphing).toBe(false);
    });
  });

  Scenario('Labels follow the nearest stage', ({ Given, When, Then }) => {
    let names: string[] = [];
    Given('the neuron cell', () => { ct = cellType('neuron'); });
    When('its labels are taken at 2.6 of the way through the injury response', () => { names = labelsAt('neuron', 7, 2.6).map((l) => l.name); });
    Then('they are the labels of the regeneration stage', () => {
      expect(names).toEqual(ct.labels(ct.build(7, 3)).map((l) => l.name));
    });
  });
});
