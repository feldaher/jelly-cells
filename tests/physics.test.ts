import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freshCell, simulate, bbox } from './helpers';
import { defaultParams } from '../src/physics/params';
import { step } from '../src/physics/xpbd';
import { startGrab } from '../src/physics/grab';
import { kinetic, currentVolume, restVolume, centreOfMass, tetSignedVolume } from '../src/physics/metrics';
import type { Piece } from '../src/contracts';

const feature = await loadFeature('features/physics.feature');

describeFeature(feature, ({ Scenario }) => {
  let cell: Piece;
  const restingCell = (Given: (s: string, f: () => void) => void) =>
    Given('an intact cell resting on the floor', () => { cell = freshCell(0); simulate([cell], 1); });
  const highCell = (Given: (s: string, f: () => void) => void) =>
    Given('an intact cell high above the floor', () => { cell = freshCell(200); });

  Scenario('A cell left on the floor comes to rest', ({ Given, When, Then, And }) => {
    restingCell(Given);
    When('two seconds are simulated', () => simulate([cell], 2));
    Then('the kinetic energy is almost zero', () => {
      // Compare with the energy of the cell moving at 1 µm/s as a whole.
      expect(kinetic(cell.sim)).toBeLessThan(0.5 * restVolume(cell.sim) * 1.0);
    });
    And('the volume is within 2 percent of rest', () => {
      expect(Math.abs(currentVolume(cell.sim) / restVolume(cell.sim) - 1)).toBeLessThan(0.02);
    });
  });

  Scenario('Damping does not slow a falling cell', ({ Given, When, Then }) => {
    let c0: number[], v: number;
    highCell(Given);
    When('a tenth of a second is simulated with syrupy damping', () => {
      c0 = centreOfMass(cell.sim);
      const p = { ...defaultParams(), damping: 1 };
      simulate([cell], 0.1, p);
      v = p.gravity;
    });
    Then('the centre of mass has accelerated at g', () => {
      const c1 = centreOfMass(cell.sim);
      const expected = 0.5 * v * 0.1 * 0.1;
      expect(Math.abs((c0[1] - c1[1]) - expected) / expected).toBeLessThan(0.05);
    });
  });

  Scenario('A stretched cell keeps its volume', ({ Given, When, Then, And }) => {
    let len0: number;
    restingCell(Given);
    When('the mother is held and the bud is pulled far away over one second', () => {
      len0 = bbox(cell).hi[0] - bbox(cell).lo[0];
      const P = cell.sim.pos;
      // hold the far end of the mother still
      const lo = bbox(cell).lo[0];
      for (let i = 0; i < P.length / 3; i++) if (P[3 * i] < lo + 0.8) cell.sim.invMass[i] = 0;
      // grab the bud-most particle, wherever the settled cell has rolled to
      let best = 0;
      for (let i = 0; i < P.length; i += 3) if (P[i] > P[best]) best = i;
      const tip: [number, number, number] = [P[best], P[best + 1], P[best + 2]];
      const g = startGrab(cell, tip, 1.0);
      for (let f = 1; f <= 60; f++) {
        g.target = [tip[0] + (4 * f) / 60, tip[1] + (1 * f) / 60, tip[2]];
        simulate([cell], 1 / 60, defaultParams(), { grab: g });
      }
    });
    Then('the cell is visibly longer than at rest', () => {
      expect(bbox(cell).hi[0] - bbox(cell).lo[0]).toBeGreaterThan(len0 * 1.15);
    });
    And('the volume is within 4 percent of rest', () => {
      expect(Math.abs(currentVolume(cell.sim) / restVolume(cell.sim) - 1)).toBeLessThan(0.04);
    });
  });

  Scenario('An inverted tetrahedron recovers', ({ Given, When, Then }) => {
    highCell(Given);
    When('one particle is pushed through its tetrahedron and one second is simulated', () => {
      const s = cell.sim;
      // Find an interior tet and reflect its first vertex through the opposite face.
      const t = Math.floor(s.tets.length / 8);
      const [a, b, c, d] = [0, 1, 2, 3].map((k) => s.tets[4 * t + k] * 3);
      for (let k = 0; k < 3; k++) {
        const face = (s.pos[b + k] + s.pos[c + k] + s.pos[d + k]) / 3;
        s.pos[a + k] = 2 * face - s.pos[a + k];
        s.prevPos[a + k] = s.pos[a + k];
      }
      expect(tetSignedVolume(s, t)).toBeLessThan(0);
      simulate([cell], 1);
    });
    Then('no tetrahedron is inverted', () => {
      for (let t = 0; t < cell.sim.tets.length / 4; t++) expect(tetSignedVolume(cell.sim, t)).toBeGreaterThan(0);
    });
  });

  Scenario('Firmer jelly sags less', ({ Given, When, Then }) => {
    let soft = 0, firm = 0;
    restingCell(Given);
    When('it settles once trembling and once set', () => {
      const a = freshCell(0), b = freshCell(0);
      simulate([a], 2, { ...defaultParams(), firmness: 0 });
      simulate([b], 2, { ...defaultParams(), firmness: 1 });
      soft = bbox(a).hi[1]; firm = bbox(b).hi[1];
    });
    Then('the set cell is taller than the trembling cell', () => {
      expect(firm).toBeGreaterThan(soft + 0.1);
    });
  });
});

// keep `step` import used for type in helpers
void step;
