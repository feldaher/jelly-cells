import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { anatomyOf, cellType } from '../src/cells';
import { buildSimMesh } from '../src/mesh/tetgen';
import { buildPiece } from '../src/mesh/piece';
import { applyKeyframe, buildKeyframe } from '../src/app/morph';
import { World } from '../src/app/world';
import { paramsFor } from '../src/physics/params';
import { currentVolume, restVolume } from '../src/physics/metrics';
import { bestFitPose } from '../src/cut/cut';
import type { CellType, CellTypeId, Piece } from '../src/contracts';
import { bbox, placeOnFloor, simulate } from './helpers';

// Kept apart from morph.test.ts: these build many meshes and run the world, and one
// long file would starve vitest's worker channel on a slow CI runner.
const feature = await loadFeature('features/morph-mesh.feature');

/** Rest volume of the tet mesh at a whole stage. */
const volumes = new Map<string, number>();
function meshVolume(ct: CellType, stage: number) {
  const key = `${ct.id}:${stage}`;
  if (!volumes.has(key)) volumes.set(key, buildSimMesh(ct.build(7, stage), []).restVol.reduce((x, v) => x + v, 0));
  return volumes.get(key)!;
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

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let ct: CellType;

  ScenarioOutline('Every in-between stage is a sound soft body', ({ Given, When, Then, And }, v) => {
    const meshes: { s: number; vol: number; restVol: Float32Array }[] = [];
    Given('the <type> cell', () => { ct = cellType(v.type as CellTypeId); });
    When('a mesh is built a quarter, half and three quarters of the way between each pair of stages', () => {
      for (let i = 0; i + 1 < ct.stages!.length; i++) for (const t of [0.25, 0.5, 0.75]) {
        const a = anatomyOf(ct.id, 7, i + t);
        const restVol = buildSimMesh(a, []).restVol;
        meshes.push({ s: i + t, vol: restVol.reduce((x, v) => x + v, 0), restVol });
      }
    });
    Then('every tetrahedron has a positive rest volume', () => {
      for (const m of meshes) { expect(m.restVol.length).toBeGreaterThan(0); for (const x of m.restVol) expect(x).toBeGreaterThan(0); }
    });
    And('each in-between volume lies near the range of its two neighbours', () => {
      for (const m of meshes) {
        const va = meshVolume(ct, Math.floor(m.s)), vb = meshVolume(ct, Math.ceil(m.s));
        expect(m.vol, `stage ${m.s}`).toBeGreaterThan(0.8 * Math.min(va, vb));
        expect(m.vol, `stage ${m.s}`).toBeLessThan(1.2 * Math.max(va, vb));
      }
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

});
