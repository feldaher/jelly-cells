import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freshCell, simulate } from './helpers';
import { nuclearHog1, relVolume, volumeLoss } from '../src/cells/stress/osmotic';
import { RunTracker } from '../src/teach/runs';
import { tetStrain } from '../src/teach/fields';
import { currentVolume, restVolume } from '../src/physics/metrics';
import { defaultParams } from '../src/physics/params';
import { planeToRest, type Pose } from '../src/cut/cut';
import { axisAngleMat } from '../src/math/mat3';
import { hexToLinear, reporterVariety } from '../src/render/palette';
import { CELL_TYPES } from '../src/cells';
import { yeastOsmotic } from '../src/cells/stress/osmotic';
import { cellType } from '../src/cells';
import { World } from '../src/app/world';
import { Mat, type Piece, type Plane, type Vec3 } from '../src/contracts';

const feature = await loadFeature('features/stress.feature');

/** Samples the law every 0.05 min. */
function follow(nacl: number, minutes: number) {
  let peakAt = 0, peak = -1, lowest = Infinity, highestVolume = -Infinity;
  for (let i = 0; i <= minutes * 20; i++) {
    const t = i / 20, h = nuclearHog1(nacl, t), v = relVolume(nacl, t);
    if (h > peak + 1e-9) { peak = h; peakAt = t; }
    lowest = Math.min(lowest, v); highestVolume = Math.max(highestVolume, v);
  }
  return { peakAt, peak, lowest, highestVolume };
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Nuclear Hog1 peaks when it was measured to', ({ Given, When, Then }, v) => {
    let r: ReturnType<typeof follow>;
    Given('a yeast cell put in <nacl> M NaCl', () => {});
    When('its response is followed for 60 minutes', () => { r = follow(Number(v.nacl), 60); });
    Then('nuclear Hog1 is highest at <peak> minutes', () => { expect(r.peakAt).toBeCloseTo(Number(v.peak), 1); });
  });

  ScenarioOutline('The cell loses the volume that was measured', ({ Given, When, Then }, v) => {
    let r: ReturnType<typeof follow>;
    Given('a yeast cell put in <nacl> M NaCl', () => {});
    When('its response is followed for 60 minutes', () => { r = follow(Number(v.nacl), 60); });
    Then('its lowest volume is <volume> percent of the unstressed cell', () => { expect(100 * r.lowest).toBeCloseTo(Number(v.volume), 5); });
  });

  const regained = (nacl: number) => 1 - (1 - relVolume(nacl, 45)) / volumeLoss(nacl);
  Scenario('A mild shock is recovered from', ({ Given, When, Then }) => {
    let r = 0;
    Given('a yeast cell put in 0.4 M NaCl', () => {});
    When('45 minutes have passed', () => { r = regained(0.4); });
    Then('it has regained at least 90 percent of the volume it lost', () => { expect(r).toBeGreaterThanOrEqual(0.9); expect(r).toBeLessThan(1); });
  });

  Scenario('A severe shock is hardly recovered from', ({ Given, When, Then }) => {
    let r = 0;
    Given('a yeast cell put in 0.8 M NaCl', () => {});
    When('45 minutes have passed', () => { r = regained(0.8); });
    Then('it has regained 10 percent of the volume it lost', () => { expect(r).toBeCloseTo(0.1, 3); });
  });

  Scenario('Hog1 adapts perfectly after a mild shock', ({ Given, When, Then }) => {
    let h = 1;
    Given('a yeast cell put in 0.1 M NaCl', () => {});
    When('45 minutes have passed', () => { h = nuclearHog1(0.1, 45); });
    Then('nuclear Hog1 is back within 2 percent of its unstressed level', () => { expect(h).toBeLessThan(0.02); });
  });

  Scenario('A weak shock gives a weaker signal than a saturating one', ({ Given, When, Then }) => {
    let weak = 0;
    Given('a yeast cell put in 0.1 M NaCl', () => {});
    When('its response is followed for 60 minutes', () => { weak = follow(0.1, 60).peak; });
    Then('its highest nuclear Hog1 is below that of a cell in 0.4 M NaCl', () => {
      expect(weak).toBeGreaterThan(0);
      expect(weak).toBeLessThan(follow(0.4, 60).peak);
      expect(follow(0.4, 60).peak).toBeCloseTo(1, 5);
    });
  });

  Scenario('Without salt nothing happens', ({ Given, When, Then }) => {
    let r: ReturnType<typeof follow>;
    Given('a yeast cell put in 0 M NaCl', () => {});
    When('its response is followed for 60 minutes', () => { r = follow(0, 60); });
    Then('its volume stays at 100 percent and nuclear Hog1 at zero', () => {
      expect(r.lowest).toBe(1); expect(r.highestVolume).toBe(1); expect(r.peak).toBe(0);
    });
  });

  Scenario('The soft body shrinks to the volume it is given', ({ Given, When, Then, And }) => {
    let cell: Piece;
    Given('a yeast cell resting on the floor', () => { cell = freshCell(0); simulate([cell], 0.5); });
    When('its rest volume is set to 70 percent and it settles', () => { simulate([cell], 2, { ...defaultParams(), volume: 0.7 }); });
    Then('its measured volume is within 3 percent of 70 percent', () => {
      expect(Math.abs(currentVolume(cell.sim) / restVolume(cell.sim) - 0.7)).toBeLessThan(0.03);
    });
    And('it shows no deformation', () => {
      const e = tetStrain(cell.sim, Math.cbrt(0.7));
      let mean = 0;
      for (const x of e) mean += x / e.length;
      // what is left is the sag under its own weight, as for a full-size cell
      const sag = freshCell(0);
      simulate([sag], 2.5);
      const e0 = tetStrain(sag.sim);
      let mean0 = 0;
      for (const x of e0) mean0 += x / e0.length;
      expect(mean).toBeLessThan(mean0 + 0.02);
      // without the scale the shrinkage itself would read as strain
      const raw = tetStrain(cell.sim);
      let meanRaw = 0;
      for (const x of raw) meanRaw += x / raw.length;
      expect(meanRaw).toBeGreaterThan(mean + 0.05);
    });
  });

  Scenario('A cut through a shrunken cell lands where it is drawn', ({ Given, When, Then }) => {
    const k = Math.cbrt(0.45);
    let pose: Pose, rest: Plane;
    const world: Plane = { n: [0.6, 0, 0.8], d: 1.7 };
    Given('a rest shape shrunk to 45 percent of its volume, turned and moved', () => {
      pose = { R: axisAngleMat(0.2, 1, 0.4, 0.9), c: [2, 1.5, -1], C: [0.4, 2, 0.1] };
    });
    When('a world plane is carried into rest space', () => { rest = planeToRest(world, pose, k); });
    Then('every rest point on that plane sits on the world plane', () => {
      const { R, c, C } = pose;
      for (const [u, v] of [[0, 0], [1.3, -0.7], [-2, 0.4]]) {
        // a point on the rest plane: n·X = d
        const n = rest.n, ref: Vec3 = [0, 1, 0];
        const a: Vec3 = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
        const b: Vec3 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
        const X = [0, 1, 2].map((i) => n[i] * rest.d + u * a[i] + v * b[i]);
        const q = [X[0] - C[0], X[1] - C[1], X[2] - C[2]];
        // world = k·R·(X − C) + c, R column-major
        const x = [0, 1, 2].map((row) => k * (R[row] * q[0] + R[3 + row] * q[1] + R[6 + row] * q[2]) + c[row]);
        expect(world.n[0] * x[0] + world.n[1] * x[1] + world.n[2] * x[2]).toBeCloseTo(world.d, 5);
      }
      expect(Math.hypot(...rest.n)).toBeCloseTo(1, 6);
    });
  });

  Scenario('A run records the lowest volume and the time of the peak', ({ Given, When, Then, And }) => {
    let run: RunTracker, early: number | null = 0;
    Given('a run in 0.8 M NaCl', () => { run = new RunTracker('osmotic', 0.8); });
    When('the response is sampled every tenth of a minute for 30 minutes', () => {
      for (let i = 0; i <= 300; i++) {
        const t = i / 10;
        run.observe(t, relVolume(0.8, t), yeastOsmotic.at(0.8, t));
        if (i === 100) early = run.record.peakMinutes;
      }
    });
    Then("the run's lowest volume is 45 percent", () => { expect(run.record.lowestVolume).toBeCloseTo(0.45, 5); });
    And('its peak is at 15 minutes', () => { expect(run.record.peakMinutes).toBeCloseTo(15, 1); expect(run.record.minutes).toBe(30); });
    And('the peak was not reported before it had passed', () => { expect(early).toBeNull(); });
  });

  Scenario('The Hog1 view lights the nucleus with the signal', ({ Given, Then }) => {
    let nucleus = 0, cytoplasm = 0;
    const green = (minutes: number) => {
      const v = reporterVariety(yeastOsmotic.look(yeastOsmotic.at(0.4, minutes)));
      nucleus = hexToLinear(v.colors[Mat.Nucleus]!)[1];
      cytoplasm = hexToLinear(v.scatter)[1];
    };
    Given('the Hog1 view of an unstressed cell', () => green(0));
    Then('the nucleus is as bright as the cytoplasm', () => { expect(nucleus).toBeCloseTo(cytoplasm, 2); expect(cytoplasm).toBeGreaterThan(0.05); });
    Given('the Hog1 view at the largest response', () => green(5));
    Then('the nucleus is brighter than the cytoplasm', () => { expect(nucleus).toBeGreaterThan(1.5 * cytoplasm); });
  });

  Scenario('Starting a stress starts the clock', ({ Given, When, Then, And }) => {
    let world: World, mass0 = 0;
    Given('a yeast cell in the world', () => { world = new World('yeast'); mass0 = world.stats().massPg; });
    When('0.4 M NaCl is added and one second passes', () => {
      world.setStress('osmotic', 0.4);
      expect(world.stressMinutes).toBe(0);
      for (let i = 0; i < 60; i++) world.update(1 / 60);
    });
    Then('about one cell minute has passed', () => { expect(world.stressMinutes).toBeGreaterThan(0.9); expect(world.stressMinutes).toBeLessThan(1.1); });
    And('the cell has started to shrink', () => {
      expect(world.params.volume).toBeLessThan(0.8);
      expect(world.stats().volumePct).toBeLessThan(90);
    });
    And('it weighs less by the water it lost', () => {
      // water at 1 pg/µm³ out of a cell at 1.1 pg/µm³
      const lost = 1 - world.params.volume;
      expect(world.stats().massPg / mass0).toBeCloseTo(1 - lost / 1.1, 5);
    });
  });

  Scenario('Only cells with a measured response have a stress lab', ({ Then, And }) => {
    const of = (id: string) => cellType('yeast').stress?.find((r) => r.id === id);
    Then('budding yeast has a salt response with the five measured doses', () => {
      expect(of('osmotic')?.doses).toEqual([0.1, 0.4, 0.6, 0.8, 1.0]);
      expect(of('osmotic')?.reporter).toBe('Hog1-GFP');
      expect(of('osmotic')?.baseline).toBe(0);
    });
    And('budding yeast has a heat response at 42 and 46 degrees', () => {
      expect(of('heat')?.doses).toEqual([42, 46]);
      expect(of('heat')?.reporter).toBe('Pab1-GFP');
      expect(of('heat')?.baseline).toBe(30);
    });
    And('no other cell has a stress lab', () => {
      for (const c of CELL_TYPES) if (c.id !== 'yeast') expect(c.stress).toBeUndefined();
    });
  });
});
