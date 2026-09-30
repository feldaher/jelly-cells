import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freshCell, simulate, anatomy, bbox, deepestIntrusion } from './helpers';
import { MOTHER } from '../src/cells/yeast';
import { planCut, applyCut, bestFitPose } from '../src/cut/cut';
import { startGrab } from '../src/physics/grab';
import { defaultParams } from '../src/physics/params';
import { currentVolume, restVolume } from '../src/physics/metrics';
import type { Piece, Vec3 } from '../src/contracts';

const feature = await loadFeature('features/contact.feature');

/** Tolerance for "inside": the knife faces of two halves start touching. */
const TOUCH = 0.05;

function cutMother(): Piece[] {
  const pieces = [freshCell(0)];
  simulate(pieces, 0.5);
  const pose = bestFitPose(pieces[0].sim);
  const X: Vec3 = [MOTHER.centre[0] - pose.C[0], -pose.C[1], -pose.C[2]];
  const R = pose.R;
  const w = [0, 1, 2].map((a) => R[a] * X[0] + R[3 + a] * X[1] + R[6 + a] * X[2] + pose.c[a]);
  let id = 10;
  const out = applyCut(pieces, planCut(anatomy, pieces, { n: [1, 0, 0], d: w[0] }, () => id++));
  expect(out.length).toBe(2);
  return out;
}

const mid = (p: Piece): Vec3 => { const b = bbox(p); return [0, 1, 2].map((k) => (b.lo[k] + b.hi[k]) / 2) as Vec3; };

describeFeature(feature, ({ Scenario }) => {
  let pieces: Piece[];

  Scenario('Cut halves settle without overlapping', ({ Given, When, Then }) => {
    Given('a cell cut through the middle of the mother', () => { pieces = cutMother(); });
    When('one second is simulated', () => simulate(pieces, 1));
    Then('no particle lies inside the other piece', () => expect(deepestIntrusion(pieces)).toBeLessThan(TOUCH));
  });

  Scenario('A half dragged into the other cannot pass through it', ({ Given, When, Then, And }) => {
    let worst = 0;
    Given('a cell cut through the middle of the mother, left to settle', () => { pieces = cutMother(); simulate(pieces, 1); });
    When('the smaller half is dragged into the larger one over one second', () => {
      const [big, small] = [...pieces].sort((a, b) => b.sim.invMass.length - a.sim.invMass.length);
      const c = mid(small), cb = mid(big);
      const g = startGrab(small, c, 1.2);
      for (let f = 1; f <= 60; f++) {
        const u = f / 60;
        g.target = [c[0] + (cb[0] - c[0]) * u, c[1], c[2] + (cb[2] - c[2]) * u];
        simulate(pieces, 1 / 60, defaultParams(), { grab: g });
        if (f % 5 === 0) worst = Math.max(worst, deepestIntrusion(pieces));
      }
    });
    Then('no particle ever lies deeper than a quarter of a lattice spacing inside the other piece', () => expect(worst).toBeLessThan(0.25));
    And('both pieces keep their volume within 5 percent', () => {
      for (const p of pieces) expect(Math.abs(currentVolume(p.sim) / restVolume(p.sim) - 1)).toBeLessThan(0.05);
    });
  });

  Scenario('A cell dropped on another does not sink into it', ({ Given, When, Then, And }) => {
    let worst = 0;
    Given('two cells, one held above the other', () => {
      const lower = freshCell(0), upper = freshCell(0);
      simulate([lower], 0.5);
      const top = bbox(lower).hi[1];
      for (let i = 1; i < upper.sim.pos.length; i += 3) { upper.sim.pos[i] += top + 0.5; upper.sim.prevPos[i] = upper.sim.pos[i]; }
      pieces = [lower, upper];
    });
    When('the upper cell is dropped and two seconds are simulated', () => {
      for (let f = 1; f <= 120; f++) {
        simulate(pieces, 1 / 60);
        if (f % 5 === 0) worst = Math.max(worst, deepestIntrusion(pieces));
      }
    });
    Then('no particle ever lies deeper than a quarter of a lattice spacing inside the other piece', () => expect(worst).toBeLessThan(0.25));
    And('no particle lies inside the other piece at the end', () => expect(deepestIntrusion(pieces)).toBeLessThan(TOUCH));
  });
});
