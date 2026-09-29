import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freshCell, simulate, anatomy } from './helpers';
import { planCut, applyCut, bestFitPose } from '../src/cut/cut';
import { restVolume, linearMomentum } from '../src/physics/metrics';
import type { Piece, Plane, Vec3 } from '../src/contracts';

const feature = await loadFeature('features/cut.feature');

/** A vertical world plane x = xw (in world coordinates of the resting cell). */
function verticalPlaneAtRestX(cell: Piece, xRest: number, tilt = 0): Plane {
  const pose = bestFitPose(cell.sim);
  // rest point on the mother axis → world
  const X: Vec3 = [xRest - pose.C[0], -pose.C[1], -pose.C[2]];
  const R = pose.R;
  const w: Vec3 = [
    R[0] * X[0] + R[3] * X[1] + R[6] * X[2] + pose.c[0],
    R[1] * X[0] + R[4] * X[1] + R[7] * X[2] + pose.c[1],
    R[2] * X[0] + R[5] * X[1] + R[8] * X[2] + pose.c[2],
  ];
  const n: Vec3 = [Math.cos(tilt), 0, Math.sin(tilt)];
  return { n, d: n[0] * w[0] + n[1] * w[1] + n[2] * w[2] };
}

describeFeature(feature, ({ Scenario }) => {
  let pieces: Piece[];
  let nextId = 1;
  const resting = (Given: (s: string, f: () => void) => void) =>
    Given('an intact cell resting on the floor', () => { pieces = [freshCell(0)]; simulate(pieces, 0.5); });
  const cutMother = (When: (s: string, f: () => void) => void) =>
    When('a blade passes through the middle of the mother', () => {
      const plan = planCut(anatomy, pieces, verticalPlaneAtRestX(pieces[0], anatomy.mother.centre[0]), () => nextId++);
      pieces = applyCut(pieces, plan);
    });

  Scenario('A cut through the mother makes two pieces', ({ Given, When, Then, And }) => {
    let v0 = 0;
    Given('an intact cell resting on the floor', () => { pieces = [freshCell(0)]; simulate(pieces, 0.5); v0 = restVolume(pieces[0].sim); });
    cutMother(When);
    Then('there are two pieces', () => expect(pieces.length).toBe(2));
    And('their rest volumes add up to the intact volume within 4 percent', () => {
      const v = pieces.reduce((a, p) => a + restVolume(p.sim), 0);
      expect(Math.abs(v - v0) / v0).toBeLessThan(0.04);
    });
  });

  Scenario('A cut through the neck frees the bud', ({ Given, When, Then }) => {
    resting(Given);
    When('a blade passes through the neck', () => {
      const xNeck = (anatomy.mother.centre[0] + anatomy.mother.radii[0] + anatomy.bud.centre[0] - anatomy.bud.radii[0]) / 2;
      const plan = planCut(anatomy, pieces, verticalPlaneAtRestX(pieces[0], xNeck), () => nextId++);
      pieces = applyCut(pieces, plan);
    });
    Then('one piece contains the bud centre and the other the mother centre', () => {
      expect(pieces.length).toBe(2);
      const side = (p: Piece, x: number) => p.planes.every((pl) => pl.n[0] * x + pl.n[1] * anatomy.mother.centre[1] + pl.n[2] * anatomy.mother.centre[2] <= pl.d);
      const budOwner = pieces.findIndex((p) => side(p, anatomy.bud.centre[0]));
      const motherOwner = pieces.findIndex((p) => side(p, anatomy.mother.centre[0]));
      expect(budOwner).toBeGreaterThanOrEqual(0);
      expect(motherOwner).toBeGreaterThanOrEqual(0);
      expect(budOwner).not.toBe(motherOwner);
    });
  });

  Scenario('A blade that misses leaves the cell alone', ({ Given, When, Then }) => {
    resting(Given);
    When('a blade passes beside the cell', () => {
      const plan = planCut(anatomy, pieces, verticalPlaneAtRestX(pieces[0], anatomy.bud.centre[0] + 5), () => nextId++);
      pieces = applyCut(pieces, plan);
    });
    Then('there is one piece', () => expect(pieces.length).toBe(1));
  });

  Scenario('Cutting conserves momentum', ({ Given, When, Then }) => {
    let p0: number[];
    Given('an intact cell sliding across the floor', () => {
      pieces = [freshCell(0)];
      simulate(pieces, 0.3);
      const s = pieces[0].sim;
      for (let i = 0; i < s.vel.length; i += 3) s.vel[i + 2] = 30;
      p0 = linearMomentum(s);
    });
    cutMother(When);
    Then('the total linear momentum is unchanged within 3 percent', () => {
      const p = [0, 0, 0];
      for (const pc of pieces) { const q = linearMomentum(pc.sim); for (let k = 0; k < 3; k++) p[k] += q[k]; }
      expect(Math.abs(p[2] - p0[2]) / Math.abs(p0[2])).toBeLessThan(0.03);
    });
  });

  Scenario('Knife faces are flat and flagged', ({ Given, When, Then }) => {
    resting(Given); cutMother(When);
    Then('each piece has flagged cut-face vertices lying on its cut plane at rest', () => {
      for (const p of pieces) {
        const pl = p.planes[p.planes.length - 1];
        let flagged = 0;
        for (let v = 0; v < p.skin.isCutFace.length; v++) {
          if (!p.skin.isCutFace[v]) continue;
          flagged++;
          const r = p.skin.restPos;
          const dist = pl.n[0] * r[3 * v] + pl.n[1] * r[3 * v + 1] + pl.n[2] * r[3 * v + 2] - pl.d;
          expect(Math.abs(dist)).toBeLessThan(0.02);
        }
        expect(flagged).toBeGreaterThan(20);
      }
    });
  });

  Scenario('A piece can be cut again', ({ Given, When, Then, And }) => {
    resting(Given); cutMother(When);
    And('a second blade crosses the first', () => {
      const pose = bestFitPose(pieces[0].sim);
      const plane: Plane = { n: [0, 0, 1], d: pose.c[2] };
      pieces = applyCut(pieces, planCut(anatomy, pieces, plane, () => nextId++));
    });
    Then('there are more than two pieces', () => expect(pieces.length).toBeGreaterThan(2));
  });
});
