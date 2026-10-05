import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import wgsl from '../src/render/shaders/common.wgsl?raw';
import { cellType } from '../src/cells';
import { primSdf } from '../src/anatomy/sdf';
import { Mat, Prim, type Anatomy, type Primitive } from '../src/contracts';
import { cellVolume, ellipsoidVol, of, tubulesOf } from './measure';

const feature = await loadFeature('features/organelles.feature');
const yeast = cellType('yeast'), fibro = cellType('fibroblast');
const stages = (ct: typeof yeast) => ct.stages!.map((_, i) => ct.build(7, i));
const neckX = (an: Anatomy) => { const s = of(an, Mat.Septin); return s.reduce((a, o) => a + o.a[0], 0) / s.length; };

describeFeature(feature, ({ Scenario }) => {
  let ans: Anatomy[] = [];

  Scenario('A disc primitive is a flat washer', ({ Given, When, Then, And }) => {
    let d: Primitive;
    Given('a disc of outer radius 1, inner radius 0.4 and half-thickness 0.05 about the x axis', () => {
      d = { kind: Prim.Disc, material: Mat.Septum, a: [2, 0, 0], b: [0.05, 0, 0], R: 1, r: 0.4 };
    });
    When('its distance field is sampled', () => undefined);
    Then('points in the flat ring are inside', () => {
      expect(primSdf(d, 2, 0.7, 0)).toBeLessThan(0);
      expect(primSdf(d, 2.03, 0, -0.9)).toBeLessThan(0);
      // the distance to the nearest face: 0.05 from either flat side
      expect(primSdf(d, 2, 0.7, 0)).toBeCloseTo(-0.05, 6);
    });
    And('points in the hole, beyond the rim and off the plane are outside', () => {
      expect(primSdf(d, 2, 0.2, 0)).toBeCloseTo(0.2, 6);
      expect(primSdf(d, 2, 0, 1.3)).toBeCloseTo(0.3, 6);
      expect(primSdf(d, 2.25, 0.7, 0)).toBeCloseTo(0.2, 6);
    });
    And('the shader evaluates the same primitive kind', () => {
      expect(wgsl).toMatch(/kind == 4u/);
    });
  });

  Scenario('The budding yeast nucleus keeps 7 percent of the cell volume', ({ Given, When, Then }) => {
    let ratio: number[] = [];
    Given('the budding yeast cell at every stage', () => { ans = stages(yeast); });
    When('nuclear and cell volumes are measured', () => {
      ratio = ans.map((a) => {
        let v = 0;
        for (const n of of(a, Mat.Nucleus)) {
          if (n.kind === Prim.Ellipsoid) v += ellipsoidVol(n);
          else v += Math.PI * n.r * n.r * Math.hypot(n.b[0] - n.a[0], n.b[1] - n.a[1], n.b[2] - n.a[2]);
        }
        return v / cellVolume(a);
      });
    });
    Then('the nuclear volume is between 5.5 and 8.5 percent of the cell volume at every stage', () => {
      ratio.forEach((r, i) => { expect(r, `stage ${i}`).toBeGreaterThan(0.055); expect(r, `stage ${i}`).toBeLessThan(0.085); });
    });
  });

  Scenario('The budding yeast nucleolus lies opposite the spindle pole', ({ Given, When, Then }) => {
    Given('the budding yeast cell at its interphase stages', () => { ans = stages(yeast).slice(0, 3); });
    When('the nucleolus is located', () => undefined);
    Then('it is on the side of the nucleus away from the neck', () => {
      for (const a of ans) {
        const n = of(a, Mat.Nucleus, Prim.Ellipsoid)[0], o = of(a, Mat.Nucleolus)[0];
        // the bud grows along +x
        expect(o.a[0], `stage ${a.stage}`).toBeLessThan(n.a[0] - 0.2);
      }
    });
  });

  Scenario('The budding yeast spindle elongates through the neck', ({ Given, When, Then, And }) => {
    Given('the budding yeast cell at every stage', () => { ans = stages(yeast); });
    When('the spindle is measured', () => undefined);
    Then('there is no spindle in G1', () => expect(tubulesOf(ans[0], Mat.Spindle)).toHaveLength(0));
    And('the G2/M spindle fits inside the nucleus', () => {
      const [sp] = tubulesOf(ans[2], Mat.Spindle), n = of(ans[2], Mat.Nucleus, Prim.Ellipsoid)[0];
      for (const p of sp.points) expect(primSdf(n, ...p)).toBeLessThan(0);
      const len = Math.hypot(...sp.points[0].map((x, k) => x - sp.points[sp.points.length - 1][k]));
      expect(len).toBeGreaterThan(1);
      expect(len).toBeLessThan(2 * Math.max(...n.b));
    });
    And('the anaphase spindle reaches from the mother into the bud', () => {
      const [sp] = tubulesOf(ans[3], Mat.Spindle), x = neckX(ans[3]);
      const xs = sp.points.map((p) => p[0]);
      expect(Math.min(...xs)).toBeLessThan(x - 0.5);
      expect(Math.max(...xs)).toBeGreaterThan(x + 0.5);
    });
  });

  Scenario('The budding yeast ring contracts between the split septin rings', ({ Given, When, Then, And }) => {
    Given('the budding yeast cell at every stage', () => { ans = stages(yeast); });
    When('the ring at the neck is measured', () => undefined);
    Then('a ring sits at the neck from bud emergence on', () => {
      expect(of(ans[0], Mat.Ring)).toHaveLength(0);
      for (const a of ans.slice(1)) {
        const ring = of(a, Mat.Ring, Prim.Torus);
        expect(ring, `stage ${a.stage}`).toHaveLength(1);
        expect(Math.abs(ring[0].a[0] - neckX(a))).toBeLessThan(0.2);
      }
    });
    And('at cytokinesis it is smaller than in telophase and lies between the two septin rings', () => {
      const r4 = of(ans[4], Mat.Ring)[0], r5 = of(ans[5], Mat.Ring)[0];
      expect(r5.R).toBeLessThan(0.8 * r4.R);
      const xs = of(ans[5], Mat.Septin).map((s) => s.a[0]).sort((a, b) => a - b);
      expect(xs).toHaveLength(2);
      expect(r5.a[0]).toBeGreaterThan(xs[0]);
      expect(r5.a[0]).toBeLessThan(xs[1]);
    });
    And('the cytokinesis stage carries a fission plane at the neck', () => {
      expect(ans[5].fission).toBeDefined();
      expect(Math.abs(ans[5].fission!.d * ans[5].fission!.n[0] - neckX(ans[5]))).toBeLessThan(0.1);
      for (const a of ans.slice(0, 5)) expect(a.fission).toBeUndefined();
    });
  });

  Scenario('The vacuole sends a stream toward the young bud', ({ Given, When, Then }) => {
    let an: Anatomy;
    Given('the budding yeast cell at stage 1', () => { an = yeast.build(7, 1); });
    When('its vacuoles are listed', () => undefined);
    Then('a vacuole tubule runs from the mother vacuole toward the neck', () => {
      const [t] = tubulesOf(an, Mat.Vacuole), big = of(an, Mat.Vacuole, Prim.Ellipsoid)[0];
      expect(t).toBeDefined();
      expect(primSdf(big, ...t.points[0])).toBeLessThan(0.05);
      const end = t.points[t.points.length - 1];
      expect(Math.abs(end[0] - neckX(an))).toBeLessThan(0.8);
      expect(tubulesOf(yeast.build(7, 0), Mat.Vacuole)).toHaveLength(0);
    });
  });

  Scenario('A migrating fibroblast puts its Golgi and centrosome in front of the nucleus', ({ Given, When, Then, And }) => {
    const parts = (a: Anatomy) => ({ golgi: of(a, Mat.Golgi), mtoc: of(a, Mat.Spindle, Prim.Ellipsoid)[0], nucleus: of(a, Mat.Nucleus)[0] });
    Given('the fibroblast cell at every stage', () => { ans = stages(fibro); });
    When('the Golgi, the centrosome and the nucleus are located', () => undefined);
    Then('every stage has a Golgi next to the nucleus with the centrosome beside it', () => {
      for (const a of ans) {
        const { golgi, mtoc, nucleus } = parts(a);
        expect(golgi.length, `stage ${a.stage}`).toBeGreaterThanOrEqual(2);
        expect(mtoc, `stage ${a.stage}`).toBeDefined();
        for (const g of golgi) {
          const d = primSdf(nucleus, ...g.a);
          expect(d, `stage ${a.stage}`).toBeGreaterThan(0);
          expect(d * fibro.umPerUnit, `stage ${a.stage}`).toBeLessThan(5);
        }
        const near = Math.min(...golgi.map((g) => Math.hypot(g.a[0] - mtoc.a[0], g.a[1] - mtoc.a[1], g.a[2] - mtoc.a[2])));
        expect(near * fibro.umPerUnit).toBeLessThan(4);
      }
    });
    And('in the migrating cell they lie between the nucleus and the leading edge', () => {
      const { golgi, mtoc, nucleus } = parts(ans[2]);
      // the lamellipodium leads along +x
      for (const g of golgi) expect(g.a[0]).toBeGreaterThan(nucleus.a[0] + nucleus.b[0]);
      expect(mtoc.a[0]).toBeGreaterThan(nucleus.a[0] + nucleus.b[0]);
      expect(Math.abs(mtoc.a[2] - nucleus.a[2])).toBeLessThan(nucleus.b[2]);
    });
    And('the migrating nucleus sits behind the middle of the cell body', () => {
      expect(parts(ans[2]).nucleus.a[0]).toBeLessThan(ans[2].body[0].prim.a[0] - 0.1);
      // the centrosome stays at the centroid of the cell body
      expect(Math.abs(parts(ans[2]).mtoc.a[0] - ans[2].body[0].prim.a[0]) * fibro.umPerUnit).toBeLessThan(4.5);
    });
  });

  Scenario('Myofibroblast adhesions are supermature', ({ Given, When, Then, And }) => {
    const lengths = (a: Anatomy) => of(a, Mat.Adhesion).map((p) => 2 * Math.max(p.b[0], p.b[2]) * fibro.umPerUnit);
    Given('the fibroblast cell at every stage', () => { ans = stages(fibro); });
    When('the adhesion plaques are measured in micrometres', () => undefined);
    Then("the migrating cell's adhesions are 2 to 6 long", () => {
      for (const l of lengths(ans[2])) { expect(l).toBeGreaterThanOrEqual(2); expect(l).toBeLessThanOrEqual(6); }
    });
    And("the myofibroblast's adhesions are 8 to 30 long", () => {
      for (const l of lengths(ans[3])) { expect(l).toBeGreaterThanOrEqual(8); expect(l).toBeLessThanOrEqual(30); }
    });
  });
});
