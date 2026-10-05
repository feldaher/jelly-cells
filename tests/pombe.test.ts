import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { primSdf } from '../src/anatomy/sdf';
import { POMBE } from '../src/cells/cycle/pombe';
import { Mat, Prim, type Anatomy } from '../src/contracts';
import { axisExtent, cellVolume, ellipsoidVol, of, soundBodySteps, tubulesOf, widthAt } from './measure';

const feature = await loadFeature('features/pombe.feature');
const ct = cellType('pombe');
const um = ct.umPerUnit;
const all = () => ct.stages!.map((_, i) => ct.build(7, i));
const nuclei = (an: Anatomy) => of(an, Mat.Nucleus, Prim.Ellipsoid);
const inNucleus = (an: Anatomy, p: readonly number[]) => of(an, Mat.Nucleus).some((n) => primSdf(n, p[0], p[1], p[2]) < 0.02);

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let an: Anatomy;
  let ans: Anatomy[] = [];
  const at = (Given: (s: string, f: () => void) => void, stage: number) => Given(`the fission yeast cell at stage ${stage}`, () => { an = ct.build(7, stage); });

  ScenarioOutline('Every stage is a sound soft body with honest labels', ({ Given, When, Then, And }, v) => {
    Given('the fission yeast cell at stage <stage>', () => undefined);
    soundBodySteps(() => ({ ct, stage: Number(v.stage) }), When, Then, And);
  });

  Scenario('The rod grows in length, not in width', ({ Given, When, Then, And }) => {
    let L: number[] = [], W: number[] = [];
    Given('the fission yeast cell at every stage', () => { ans = all(); });
    When('its length and width are measured in micrometres', () => {
      L = ans.map((a) => axisExtent(a).length * um);
      // a quarter of the way along, clear of the middle where the cell later divides
      W = ans.map((a) => { const e = axisExtent(a); return widthAt(a, e.lo + 0.25 * (e.hi - e.lo)) * um; });
    });
    Then('the first three lengths are 7, 9.5 and 14', () => {
      [7, 9.5, 14].forEach((x, i) => expect(Math.abs(L[i] - x), `stage ${i}`).toBeLessThan(0.03 * x));
    });
    And('the width is 3.6 at every stage', () => { W.forEach((w, i) => expect(Math.abs(w - POMBE.diameter), `stage ${i}`).toBeLessThan(0.05 * POMBE.diameter)); });
    And('the length stays at 14 through mitosis and septation', () => {
      for (let i = 3; i <= 5; i++) expect(Math.abs(L[i] - 14), `stage ${i}`).toBeLessThan(0.03 * 14);
    });
  });

  Scenario('The new end takes off only after NETO', ({ Given, When, Then, And }) => {
    let d: number[] = [];
    Given('the fission yeast cell at every stage', () => { ans = all(); });
    When('the distance from the birth scar to the new end is measured', () => {
      d = ans.slice(0, 3).map((a) => axisExtent(a).hi - of(a, Mat.BudScar)[0].a[0]);
    });
    Then('it is the same at birth and at NETO', () => expect(d[1]).toBeCloseTo(d[0], 3));
    And('it is longer in late G2', () => expect(d[2]).toBeGreaterThan(d[0] + 1 / um));
  });

  Scenario('The interphase nucleus sits in the middle and scales with the cell', ({ Given, When, Then, And }) => {
    Given('the fission yeast cell at its three interphase stages', () => { ans = all().slice(0, 3); });
    When('the nucleus is measured', () => undefined);
    Then('it is centred on the middle of the cell', () => {
      for (const a of ans) {
        const e = axisExtent(a), n = nuclei(a);
        expect(n).toHaveLength(1);
        expect(Math.abs(n[0].a[0] - (e.lo + e.hi) / 2) * um).toBeLessThan(0.1);
      }
    });
    And('its volume is 8 percent of the cell volume, within one standard deviation', () => {
      for (const a of ans) {
        const ratio = ellipsoidVol(nuclei(a)[0]) / cellVolume(a);
        expect(ratio, `stage ${a.stage}`).toBeGreaterThan(0.067);
        expect(ratio, `stage ${a.stage}`).toBeLessThan(0.093);
      }
    });
    And('microtubule bundles run from the nucleus toward both tips', () => {
      for (const a of ans) {
        const e = axisExtent(a), mts = tubulesOf(a, Mat.Spindle);
        expect(mts.length).toBeGreaterThanOrEqual(3);
        expect(mts.length).toBeLessThanOrEqual(4);
        for (const t of mts) {
          const xs = t.points.map((p) => p[0]);
          // each bundle spans at least 70 % of the cell and passes the nucleus
          expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.7 * (e.hi - e.lo));
          expect(Math.min(...xs)).toBeLessThan(nuclei(a)[0].a[0]);
          expect(Math.max(...xs)).toBeGreaterThan(nuclei(a)[0].a[0]);
        }
      }
    });
  });

  Scenario('Metaphase has a spindle inside the nucleus and a ring around the middle', ({ Given, When, Then, And }) => {
    at(Given, 3);
    When('its anatomy is built', () => undefined);
    Then('the spindle lies inside the nucleus', () => {
      const sp = tubulesOf(an, Mat.Spindle);
      expect(sp).toHaveLength(1);
      for (const p of sp[0].points) expect(inNucleus(an, p)).toBe(true);
    });
    And('a ring circles the middle of the cell just under the wall', () => {
      const ring = of(an, Mat.Ring, Prim.Torus), e = axisExtent(an);
      expect(ring).toHaveLength(1);
      expect(Math.abs(ring[0].a[0] - (e.lo + e.hi) / 2)).toBeLessThan(0.05);
      const outer = (ring[0].R + ring[0].r) * um, R = POMBE.diameter / 2;
      expect(outer).toBeLessThan(R);
      expect(outer).toBeGreaterThan(R - 0.5);
    });
    And('there are no interphase microtubule bundles', () => {
      for (const t of tubulesOf(an, Mat.Spindle)) for (const p of t.points) expect(inNucleus(an, p)).toBe(true);
    });
  });

  Scenario('Anaphase B pushes two nuclei toward the ends', ({ Given, When, Then, And }) => {
    at(Given, 4);
    When('its anatomy is built', () => undefined);
    Then('there are two nuclei more than 6 micrometres apart', () => {
      const n = nuclei(an);
      expect(n).toHaveLength(2);
      expect(Math.abs(n[0].a[0] - n[1].a[0]) * um).toBeGreaterThan(6);
    });
    And('the spindle joins them and is no longer than the longest measured spindle', () => {
      const [sp] = tubulesOf(an, Mat.Spindle), a = sp.points[0], b = sp.points[sp.points.length - 1];
      expect(inNucleus(an, a)).toBe(true);
      expect(inNucleus(an, b)).toBe(true);
      expect(Math.abs(a[0] - b[0]) * um).toBeLessThanOrEqual(POMBE.spindleMax + 0.9);
      expect(Math.abs(a[0] - b[0]) * um).toBeGreaterThan(6);
    });
    And('the ring has not started to close', () => {
      expect(of(an, Mat.Ring)[0].R).toBeCloseTo(of(ct.build(7, 3), Mat.Ring)[0].R, 6);
      expect(of(an, Mat.Septum)).toHaveLength(0);
    });
  });

  Scenario('The septum grows inward behind the closing ring', ({ Given, When, Then, And }) => {
    at(Given, 5);
    When('its anatomy is built', () => undefined);
    Then('the septum is a washer with a hole', () => {
      const s = of(an, Mat.Septum, Prim.Disc);
      expect(s).toHaveLength(1);
      expect(s[0].r).toBeGreaterThan(0.1);
      expect(s[0].R * um).toBeGreaterThan(POMBE.diameter / 2 - 0.4);
    });
    And('the ring lines the hole', () => {
      const s = of(an, Mat.Septum)[0], ring = of(an, Mat.Ring)[0];
      expect(ring.R).toBeLessThan(of(ct.build(7, 4), Mat.Ring)[0].R);
      expect(Math.abs(ring.R + ring.r - s.r)).toBeLessThan(0.08);
    });
    And('each half has a nucleus near its own middle', () => {
      const e = axisExtent(an), m = (e.lo + e.hi) / 2, n = nuclei(an).sort((p, q) => p.a[0] - q.a[0]);
      expect(n).toHaveLength(2);
      expect(Math.abs(n[0].a[0] - (e.lo + m) / 2) * um).toBeLessThan(1);
      expect(Math.abs(n[1].a[0] - (m + e.hi) / 2) * um).toBeLessThan(1);
    });
    And('no mitochondrion crosses the septum', () => {
      const x0 = of(an, Mat.Septum)[0].a[0];
      const mito = tubulesOf(an, Mat.Mitochondrion);
      expect(mito.length).toBeGreaterThanOrEqual(4);
      for (const t of mito) {
        const side = Math.sign(t.points[0][0] - x0);
        for (const p of t.points) expect(Math.sign(p[0] - x0)).toBe(side);
      }
    });
    And('the outline of the cell is still a cylinder', () => {
      const e = axisExtent(an);
      expect(widthAt(an, (e.lo + e.hi) / 2) * um).toBeGreaterThan(0.95 * POMBE.diameter);
    });
  });

  Scenario('Fission leaves two daughters joined by a narrow bridge', ({ Given, When, Then, And }) => {
    at(Given, 6);
    When('its anatomy is built', () => undefined);
    Then('the septum is closed', () => {
      expect(of(an, Mat.Ring)).toHaveLength(0);
    });
    And('the waist at the middle is less than 60 percent of the cell width', () => {
      const e = axisExtent(an), w = widthAt(an, (e.lo + e.hi) / 2) * um;
      expect(w).toBeGreaterThan(0.2 * POMBE.diameter);
      expect(w).toBeLessThan(0.6 * POMBE.diameter);
    });
    And('the anatomy carries a fission plane through the middle', () => {
      const e = axisExtent(an);
      expect(an.fission).toBeDefined();
      expect(Math.abs(an.fission!.n[0])).toBeCloseTo(1, 6);
      expect(Math.abs(an.fission!.d * an.fission!.n[0] - (e.lo + e.hi) / 2)).toBeLessThan(0.05);
      for (let i = 0; i < 6; i++) expect(ct.build(7, i).fission).toBeUndefined();
    });
    And('each half has a nucleus, mitochondria and vacuoles', () => {
      const x0 = an.fission!.d * an.fission!.n[0];
      for (const side of [-1, 1]) {
        expect(nuclei(an).filter((n) => Math.sign(n.a[0] - x0) === side)).toHaveLength(1);
        expect(tubulesOf(an, Mat.Mitochondrion).filter((t) => Math.sign(t.points[0][0] - x0) === side).length).toBeGreaterThanOrEqual(2);
        expect(of(an, Mat.Vacuole).filter((v) => Math.sign(v.a[0] - x0) === side).length).toBeGreaterThanOrEqual(4);
      }
    });
  });
});
