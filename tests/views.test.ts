import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freshCell, simulate, bbox } from './helpers';
import { tetStrain, nodalAverage, deformationScalars } from '../src/teach/fields';
import { startGrab } from '../src/physics/grab';
import { defaultParams } from '../src/physics/params';
import { axisAngleMat } from '../src/math/mat3';
import type { Piece } from '../src/contracts';

const feature = await loadFeature('features/views.feature');

describeFeature(feature, ({ Scenario }) => {
  let cell: Piece;
  const resting = (Given: (s: string, f: () => void) => void) =>
    Given('a yeast cell resting on the floor', () => { cell = freshCell(0); simulate([cell], 1); });

  Scenario('An undeformed cell shows no deformation, even when turned', ({ Given, When, Then }) => {
    let strain: Float32Array;
    Given('a yeast cell in its rest shape', () => { cell = freshCell(0); });
    When('it is rotated rigidly and its strain is measured', () => {
      const R = axisAngleMat(0.3, 1, 0.2, 1.1), P = cell.sim.pos;
      for (let i = 0; i < P.length; i += 3) {
        const [x, y, z] = [P[i], P[i + 1], P[i + 2]];
        P[i] = R[0] * x + R[3] * y + R[6] * z; P[i + 1] = R[1] * x + R[4] * y + R[7] * z; P[i + 2] = R[2] * x + R[5] * y + R[8] * z;
      }
      strain = tetStrain(cell.sim);
    });
    Then("every tetrahedron's strain is zero", () => { for (const e of strain) expect(e).toBeLessThan(1e-4); });
  });

  Scenario('Pulling shows up as deformation where the cell is pulled', ({ Given, When, Then }) => {
    resting(Given);
    When('the mother is held and the bud is pulled away', () => {
      const P = cell.sim.pos, lo = bbox(cell).lo[0];
      for (let i = 0; i < P.length / 3; i++) if (P[3 * i] < lo + 0.8) cell.sim.invMass[i] = 0;
      let best = 0;
      for (let i = 0; i < P.length; i += 3) if (P[i] > P[best]) best = i;
      const tip: [number, number, number] = [P[best], P[best + 1], P[best + 2]];
      const g = startGrab(cell, tip, 1.0);
      for (let f = 1; f <= 40; f++) { g.target = [tip[0] + (3 * f) / 40, tip[1], tip[2]]; simulate([cell], 1 / 60, defaultParams(), { grab: g }); }
    });
    Then('the strain near the bud is larger than at the far end of the mother', () => {
      const nodal = nodalAverage(cell.sim, tetStrain(cell.sim));
      const { lo, hi } = bbox(cell), P = cell.sim.pos;
      let near = 0, nn = 0, far = 0, nf = 0;
      for (let i = 0; i < nodal.length; i++) {
        const x = P[3 * i];
        if (x > hi[0] - 2.5) { near += nodal[i]; nn++; }
        if (x < lo[0] + 2) { far += nodal[i]; nf++; }
      }
      expect(near / nn).toBeGreaterThan(2 * (far / nf));
    });
  });

  Scenario('Deformation values stay between zero and one', ({ Given, When, Then }) => {
    let values: Float32Array[] = [];
    resting(Given);
    When('the deformation view is computed for its skin', () => {
      values = [deformationScalars(cell).slice()];
    });
    Then('every skin value lies between 0 and 1', () => {
      for (const v of values) { expect(v.length).toBe(cell.skin.tetId.length); for (const x of v) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); } }
    });
  });
});
