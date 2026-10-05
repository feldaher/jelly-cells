import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { ECOLI_STAGE_AGE } from '../src/cells/ecoli';
import { ECOLI, ecoliLength } from '../src/cells/cycle/ecoli';
import { Mat, Prim, type Anatomy } from '../src/contracts';
import { axisExtent, of, soundBodySteps, widthAt } from './measure';

const feature = await loadFeature('features/ecoli.feature');
const ct = cellType('ecoli');
const um = ct.umPerUnit;
const all = () => ct.stages!.map((_, i) => ct.build(7, i));
const middle = (a: Anatomy) => { const e = axisExtent(a); return (e.lo + e.hi) / 2; };

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let an: Anatomy;
  let ans: Anatomy[] = [];
  const every = (Given: (s: string, f: () => void) => void) => Given('the E. coli cell at every stage', () => { ans = all(); });

  ScenarioOutline('Every stage is a sound soft body with honest labels', ({ Given, When, Then, And }, v) => {
    Given('the E. coli cell at stage <stage>', () => undefined);
    soundBodySteps(() => ({ ct, stage: Number(v.stage) }), When, Then, And);
  });

  Scenario('A bacterium has a nucleoid and no membrane-bound organelles', ({ Given, When, Then, And }) => {
    every(Given);
    When('its organelles are listed', () => undefined);
    Then('there is no nucleus, nucleolus, mitochondrion, vacuole or Golgi', () => {
      const banned: number[] = [Mat.Nucleus, Mat.Nucleolus, Mat.Mitochondrion, Mat.Vacuole, Mat.Golgi, Mat.ER, Mat.Lysosome];
      for (const a of ans) expect(a.organelles.filter((o) => banned.includes(o.material))).toHaveLength(0);
    });
    And('there is a nucleoid at every stage', () => { for (const a of ans) expect(of(a, Mat.Nucleoid).length).toBeGreaterThan(0); });
  });

  Scenario('The rod elongates exponentially at constant width', ({ Given, When, Then, And }) => {
    every(Given);
    When('its length and width are measured in micrometres', () => undefined);
    Then("each length is the exponential law at that stage's age", () => {
      ans.forEach((a, i) => {
        const want = ecoliLength(ECOLI_STAGE_AGE[i]);
        expect(Math.abs(axisExtent(a).length * um - want), `stage ${i}`).toBeLessThan(0.03 * want);
      });
      expect(ECOLI_STAGE_AGE[0]).toBe(0);
      expect(ECOLI_STAGE_AGE[ECOLI_STAGE_AGE.length - 1]).toBe(ECOLI.generationMin);
    });
    And('the width away from the waist is 1.0 at every stage', () => {
      ans.forEach((a, i) => {
        const e = axisExtent(a);
        expect(Math.abs(widthAt(a, e.lo + 0.25 * (e.hi - e.lo)) * um - ECOLI.width), `stage ${i}`).toBeLessThan(0.05);
      });
    });
  });

  Scenario('The nucleoid stays clear of the poles and splits at termination', ({ Given, When, Then, And }) => {
    /** Separate nucleoids: lobes whose ellipsoids overlap along x belong to one. */
    const bodies = (a: Anatomy) => {
      const lobes = of(a, Mat.Nucleoid, Prim.Ellipsoid).map((n) => [n.a[0] - n.b[0], n.a[0] + n.b[0]]).sort((p, q) => p[0] - q[0]);
      const out: number[][] = [];
      for (const l of lobes) { const last = out[out.length - 1]; if (last && l[0] <= last[1]) last[1] = Math.max(last[1], l[1]); else out.push([...l]); }
      return out;
    };
    every(Given);
    When('the nucleoid is measured', () => undefined);
    Then('no nucleoid comes within 0.25 micrometres of a pole', () => {
      for (const a of ans) {
        const e = axisExtent(a);
        for (const [lo, hi] of bodies(a)) {
          expect((lo - e.lo) * um).toBeGreaterThan(0.25);
          expect((e.hi - hi) * um).toBeGreaterThan(0.25);
        }
      }
    });
    And('the newborn cell has one nucleoid and later stages have two', () => {
      expect(bodies(ans[0])).toHaveLength(1);
      for (const a of ans.slice(1)) expect(bodies(a), `stage ${a.stage}`).toHaveLength(2);
    });
    And('two nucleoids lie on either side of the middle', () => {
      for (const a of ans.slice(1)) {
        const m = middle(a), b = bodies(a);
        expect(b[0][1]).toBeLessThan(m);
        expect(b[1][0]).toBeGreaterThan(m);
      }
    });
  });

  Scenario('The Z ring appears at termination and closes with the waist', ({ Given, When, Then, And }) => {
    const waist = (a: Anatomy) => widthAt(a, middle(a)) / 2;
    every(Given);
    When('the Z ring and the waist are measured', () => undefined);
    Then('the newborn cell has no Z ring', () => expect(of(ans[0], Mat.Ring)).toHaveLength(0));
    And('from termination to constriction there is a Z ring at the middle', () => {
      for (const a of ans.slice(1, 4)) {
        const ring = of(a, Mat.Ring, Prim.Torus);
        expect(ring, `stage ${a.stage}`).toHaveLength(1);
        expect(Math.abs(ring[0].a[0] - middle(a))).toBeLessThan(0.05);
      }
    });
    And('the ring fits inside the waist at every stage', () => {
      for (const a of ans.slice(1, 4)) {
        const ring = of(a, Mat.Ring)[0];
        expect(ring.R + ring.r, `stage ${a.stage}`).toBeLessThan(waist(a));
        // in the notch of a constricting cell the ring has to sit further in to stay under the envelope
        expect(ring.R + ring.r, `stage ${a.stage}`).toBeGreaterThan(0.5 * waist(a));
      }
    });
    And('the Z ring has left by the time the septum closes', () => expect(of(ans[4], Mat.Ring)).toHaveLength(0));
    And('the waist narrows from one stage to the next once constriction has begun', () => {
      const w = ans.map(waist);
      expect(w[1]).toBeCloseTo(w[0], 2);
      expect(w[2]).toBeCloseTo(w[0], 2);
      expect(w[3]).toBeLessThan(0.9 * w[2]);
      expect(w[4]).toBeLessThan(0.9 * w[3]);
    });
  });

  Scenario('Division leaves two daughters joined by a narrow bridge', ({ Given, When, Then, And }) => {
    Given('the E. coli cell at stage 4', () => { an = ct.build(7, 4); });
    When('its anatomy is built', () => undefined);
    Then('the waist at the middle is less than 40 percent of the cell width', () => {
      const w = widthAt(an, middle(an)) * um;
      expect(w).toBeGreaterThan(0.15 * ECOLI.width);
      expect(w).toBeLessThan(0.4 * ECOLI.width);
    });
    And('the anatomy carries a fission plane through the middle', () => {
      expect(an.fission).toBeDefined();
      expect(Math.abs(an.fission!.d * an.fission!.n[0] - middle(an))).toBeLessThan(0.05);
      for (let i = 0; i < 4; i++) expect(ct.build(7, i).fission).toBeUndefined();
    });
    And('each half has a nucleoid', () => {
      const m = middle(an);
      for (const side of [-1, 1]) expect(of(an, Mat.Nucleoid).filter((n) => Math.sign(n.a[0] - m) === side).length).toBeGreaterThan(0);
    });
  });
});
