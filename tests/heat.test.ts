import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { yeastHeat } from '../src/cells/stress/heat';
import { buildYeast } from '../src/cells/yeast';
import { cellSdf, primSdf } from '../src/anatomy/sdf';
import { graphSpan, RunTracker, tracePath } from '../src/teach/runs';
import { cellType } from '../src/cells';
import { hexToLinear, reporterVariety } from '../src/render/palette';
import { shownEntries } from '../src/teach/section';
import { World } from '../src/app/world';
import { Mat, type Anatomy, type SectionEntry, type StressState } from '../src/contracts';

const feature = await loadFeature('features/heat.feature');

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let s: StressState, temp = 30;
  const moved = (Given: (t: string, f: () => void) => void, c: number) => Given(`a yeast cell moved to ${c} degrees`, () => { temp = c; });
  const after = (When: (t: string, f: () => void) => void, min: number) => When(`${min} minutes have passed`, () => { s = yeastHeat.at(temp, min); });

  Scenario('At the growth temperature nothing assembles', ({ Given, When, Then }) => {
    Given('a yeast cell kept at 30 degrees', () => { temp = 30; });
    after(When, 30);
    Then('no Pab1 has assembled and there are no foci', () => { expect(s.signal).toBe(0); expect(s.foci).toBe(0); });
  });

  Scenario('At 46 degrees Pab1 is still mostly soluble after two minutes', ({ Given, When, Then }) => {
    moved(Given, 46); after(When, 2);
    Then('less than a quarter of the largest response has assembled', () => { expect(s.signal).toBeLessThan(0.25); });
  });

  Scenario('At 46 degrees most Pab1 has assembled after eight minutes, in visible foci', ({ Given, When, Then, And }) => {
    moved(Given, 46); after(When, 8);
    Then('the assembly is at its largest', () => { expect(s.signal).toBeCloseTo(1, 5); });
    And('the foci are fully formed', () => { expect(s.foci).toBeCloseTo(1, 5); });
  });

  Scenario('At 42 degrees Pab1 assembles without visible foci', ({ Given, When, Then, And }) => {
    moved(Given, 42); after(When, 10);
    Then('assembled Pab1 is detectable', () => { expect(s.signal).toBeGreaterThan(0.05); });
    And('there are no foci', () => { expect(s.foci).toBe(0); });
    And('even after 30 minutes there are no foci and less has assembled than at 46 degrees', () => {
      const late = yeastHeat.at(42, 30);
      expect(late.foci).toBe(0);
      expect(late.signal).toBeGreaterThan(s.signal);
      expect(late.signal).toBeLessThan(yeastHeat.at(46, 10).signal);
    });
  });

  Scenario('Heat does not change the cell\'s volume here', ({ Given, When, Then }) => {
    moved(Given, 46); after(When, 8);
    Then('its volume is that of the unstressed cell', () => { expect(s.relVolume).toBe(1); });
  });

  ScenarioOutline('The yeast carries condensates in its cytoplasm at every stage', ({ Given, Then, And }, v) => {
    let an: Anatomy;
    const granules = () => an.organelles.filter((o) => o.material === Mat.Condensate);
    Given('the yeast anatomy at stage <stage>', () => { an = buildYeast(7, Number(v.stage)); });
    Then('it has at least six condensates', () => { expect(granules().length).toBeGreaterThanOrEqual(6); });
    And('each lies in the cytoplasm, clear of the wall and of every other organelle', () => {
      for (const g of granules()) {
        const [x, y, z] = g.a, r = g.b[0];
        expect(cellSdf(an, x, y, z)).toBeLessThan(-(an.wallThickness + r));
        for (const o of an.organelles) if (o !== g) expect(primSdf(o, x, y, z)).toBeGreaterThan(r);
      }
    });
    And('each is about a quarter of a micrometre across', () => {
      for (const g of granules()) { expect(2 * g.b[0]).toBeGreaterThan(0.2); expect(2 * g.b[0]).toBeLessThan(0.3); }
    });
  });

  Scenario('Condensates are not there until the heat has formed them', ({ Given, When, Then }) => {
    let world: World;
    // Only the stress clock is under test: one physics substep keeps the 4,000-odd frames cheap.
    const run = (minutes: number) => { for (let i = 0; i < minutes * 60; i++) world.update(1 / 60); };
    const hidden = () => (world.hiddenMaterials & (1 << Mat.Condensate)) !== 0;
    Given('a yeast cell in the world', () => { world = new World('yeast'); world.params.substeps = 1; });
    Then('its condensates are hidden', () => { expect(hidden()).toBe(true); });
    When('it is moved to 42 degrees for 30 cell minutes', () => { world.setStress('heat', 42); run(30); });
    Then('its condensates are still hidden', () => { expect(world.stressMinutes).toBeGreaterThan(29); expect(hidden()).toBe(true); });
    When('it is moved to 46 degrees for 8 cell minutes', () => { world.setStress('heat', 46); run(8); });
    Then('its condensates are shown', () => { expect(hidden()).toBe(false); });
  });

  Scenario('A cut through an unstressed cell reports no condensates', ({ Given, When, Then }) => {
    let report: SectionEntry[], shown: SectionEntry[];
    Given('a section report that crossed a condensate', () => {
      report = [{ material: Mat.Nucleus, areaUm2: 3, widthUm: 2, count: 1 }, { material: Mat.Condensate, areaUm2: 0.1, widthUm: 0.3, count: 1 }];
    });
    When('the cell has formed no foci', () => { shown = shownEntries(report, 1 << Mat.Condensate); });
    Then('the report lists no condensate', () => { expect(shown.map((e) => e.material)).toEqual([Mat.Nucleus]); });
    When('the cell has formed foci', () => { shown = shownEntries(report, 0); });
    Then('the report lists the condensate', () => { expect(shown.length).toBe(2); });
  });

  Scenario('The Pab1 view shows foci brighter than the cytoplasm', ({ Given, Then, And }) => {
    let granule = 0, cytoplasm = 0, nucleus = 0, before = 0;
    const view = (c: number, minutes: number) => {
      const v = reporterVariety(yeastHeat.look(yeastHeat.at(c, minutes)));
      granule = hexToLinear(v.colors[Mat.Condensate]!)[1];
      nucleus = hexToLinear(v.colors[Mat.Nucleus]!)[1];
      cytoplasm = hexToLinear(v.scatter)[1];
    };
    Given('the Pab1 view of an unstressed cell', () => { view(30, 0); before = cytoplasm; });
    Then('the condensates are no brighter than the cytoplasm', () => { expect(granule).toBeCloseTo(cytoplasm, 2); });
    And('the nucleus is dimmer than the cytoplasm', () => { expect(nucleus).toBeLessThan(0.7 * cytoplasm); });
    Given('the Pab1 view after 8 minutes at 46 degrees', () => view(46, 8));
    Then('the condensates are much brighter than the cytoplasm', () => { expect(granule).toBeGreaterThan(3 * cytoplasm); });
    And('the cytoplasm is dimmer than before', () => { expect(cytoplasm).toBeLessThan(0.8 * before); });
  });

  Scenario('A heat run records whether foci were seen', ({ Given, Then }) => {
    let run: RunTracker;
    const follow = (c: number, minutes: number) => {
      run = new RunTracker('heat', c);
      for (let i = 0; i <= minutes * 10; i++) run.observe(i / 10, 1, yeastHeat.at(c, i / 10));
    };
    Given('a run at 42 degrees followed for 30 minutes', () => follow(42, 30));
    Then('it saw no foci but some assembled Pab1', () => { expect(run.record.foci).toBe(false); expect(run.record.highestSignal).toBeGreaterThan(0.2); expect(run.record.highestSignal).toBeLessThan(0.8); });
    Given('a run at 46 degrees followed for 10 minutes', () => follow(46, 10));
    Then('it saw foci and the largest assembly', () => { expect(run.record.foci).toBe(true); expect(run.record.highestSignal).toBeCloseTo(1, 5); });
  });

  Scenario('Back at 30 degrees the assemblies dissolve within the hour', ({ Given, When, Then, And }) => {
    let hot: StressState;
    Given('a yeast cell that has spent 8 minutes at 46 degrees', () => { hot = yeastHeat.at(46, 8); });
    When('it is returned to 30 degrees', () => {});
    Then('at first everything is as it was at 46 degrees', () => { expect(yeastHeat.at(30, 0, hot)).toEqual(hot); });
    And('after 20 minutes it has partly dissolved', () => {
      const r = yeastHeat.at(30, 20, hot);
      expect(r.signal).toBeGreaterThan(0.3); expect(r.signal).toBeLessThan(0.9);
      expect(r.foci).toBeGreaterThan(0.3); expect(r.foci).toBeLessThan(0.9);
    });
    And('after 60 minutes nothing is assembled and the foci are gone', () => {
      expect(yeastHeat.at(30, 60, hot)).toEqual({ relVolume: 1, signal: 0, foci: 0 });
      expect(yeastHeat.at(30, 90, hot).signal).toBe(0);
    });
  });

  Scenario('Assemblies made at 42 degrees dissolve too', ({ Given, When, Then }) => {
    let warm: StressState;
    Given('a yeast cell that has spent 30 minutes at 42 degrees', () => { warm = yeastHeat.at(42, 30); });
    When('it is returned to 30 degrees', () => {});
    Then('after 60 minutes nothing is assembled', () => { expect(yeastHeat.at(30, 30, warm).signal).toBeGreaterThan(0); expect(yeastHeat.at(30, 60, warm).signal).toBe(0); });
  });

  Scenario('Heating a cell that is already assembling carries on from where it was', ({ Given, When, Then, And }) => {
    let warm: StressState;
    Given('a yeast cell that has spent 30 minutes at 42 degrees', () => { warm = yeastHeat.at(42, 30); });
    When('it is moved on to 46 degrees', () => {});
    Then('its assembled Pab1 never drops and reaches the largest response', () => {
      let last = warm.signal;
      expect(yeastHeat.at(46, 0, warm).signal).toBeCloseTo(warm.signal, 3);
      for (let m = 0; m <= 10; m += 0.25) { const x = yeastHeat.at(46, m, warm).signal; expect(x).toBeGreaterThanOrEqual(last - 1e-6); last = x; }
      expect(last).toBeCloseTo(1, 5);
      // it gets there sooner than a cell starting from 30 degrees
      expect(yeastHeat.at(46, 4, warm).signal).toBeGreaterThan(yeastHeat.at(46, 4).signal);
    });
    And('foci form', () => { expect(yeastHeat.at(46, 0, warm).foci).toBe(0); expect(yeastHeat.at(46, 10, warm).foci).toBeCloseTo(1, 5); });
  });

  Scenario('Cooling from 46 to 42 degrees keeps what has formed', ({ Given, When, Then }) => {
    let hot: StressState, after: StressState;
    Given('a yeast cell that has spent 8 minutes at 46 degrees', () => { hot = yeastHeat.at(46, 8); });
    When('it is moved to 42 degrees for 10 minutes', () => { after = yeastHeat.at(42, 10, hot); });
    Then('its assembled Pab1 and its foci are unchanged', () => { expect(after.signal).toBeCloseTo(hot.signal, 5); expect(after.foci).toBeCloseTo(hot.foci, 5); });
  });

  Scenario('The world carries the cell\'s state into recovery', ({ Given, When, Then }) => {
    let world: World;
    // Only the stress clock is under test: one physics substep keeps the 4,000-odd frames cheap.
    const run = (minutes: number) => { for (let i = 0; i < minutes * 60; i++) world.update(1 / 60); };
    const hidden = () => (world.hiddenMaterials & (1 << Mat.Condensate)) !== 0;
    Given('a yeast cell in the world, 8 cell minutes at 46 degrees', () => { world = new World('yeast'); world.params.substeps = 1; world.setStress('heat', 46); run(8.2); });
    When('it is returned to 30 degrees for 20 cell minutes', () => { world.setStress('heat', 30); run(20); });
    Then('its condensates are still shown and partly dissolved', () => {
      expect(hidden()).toBe(false);
      expect(world.stressed).toBe(true);
      const st = world.stressState();
      expect(st.foci).toBeGreaterThan(0.3); expect(st.foci).toBeLessThan(0.9);
    });
    When('45 more cell minutes pass', () => { run(45); });
    Then('its condensates are hidden again', () => { expect(hidden()).toBe(true); expect(world.stressState().signal).toBe(0); expect(world.stressed).toBe(false); });
  });

  Scenario('The stress granules have a label and a key entry', ({ Given, Then, And }) => {
    const yeast = cellType('yeast');
    Given('the yeast cell type', () => {});
    Then('its labels at every stage include a stress granule anchored on a condensate', () => {
      for (let st = 0; st < yeast.stages!.length; st++) {
        const an = buildYeast(7, st), l = yeast.labels(an).find((x) => x.material === Mat.Condensate);
        expect(l?.name).toBe('Stress granule');
        expect(an.organelles.some((o) => o.material === Mat.Condensate && o.a.every((x, k) => x === l!.anchor[k]))).toBe(true);
      }
    });
    And('its key lists stress granules', () => { expect(yeast.key.find((k) => k.material === Mat.Condensate)?.name).toBe('Stress granules'); });
  });

  Scenario('A run keeps a trace for the graph', ({ Given, When, Then, And }) => {
    let run: RunTracker;
    Given('a run at 46 degrees sampled every tenth of a minute for 8 minutes', () => {
      run = new RunTracker('heat', 46);
      for (let i = 0; i <= 80; i++) run.observe(i / 10, 1, yeastHeat.at(46, i / 10));
    });
    When('it carries on through 20 minutes of recovery', () => {
      const hot = yeastHeat.at(46, 8);
      run.markChange();
      for (let i = 1; i <= 200; i++) run.observe(8 + i / 10, 1, yeastHeat.at(30, i / 10, hot));
    });
    Then('its trace runs from 0 to 28 minutes without a gap', () => {
      const tr = run.record.trace;
      expect(tr[0].minutes).toBe(0); expect(tr[tr.length - 1].minutes).toBeCloseTo(28, 5);
      for (let i = 1; i < tr.length; i++) { expect(tr[i].minutes).toBeGreaterThan(tr[i - 1].minutes); expect(tr[i].minutes - tr[i - 1].minutes).toBeLessThan(0.5); }
    });
    And('it marks the change at 8 minutes', () => { expect(run.record.changes).toEqual([8]); });
    And("the trace's foci line is drawn left to right, rising then falling", () => {
      expect(graphSpan(28)).toBe(30); expect(graphSpan(3)).toBe(10); expect(graphSpan(30.5)).toBe(40);
      const pts = tracePath(run.record.trace, 'foci', 30, 300, 100).slice(1).split('L').map((p) => p.split(' ').map(Number));
      expect(pts[0]).toEqual([0, 100]);
      for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThanOrEqual(pts[i - 1][0]);
      expect(pts[pts.length - 1][0]).toBeCloseTo(280, 0);
      const top = Math.min(...pts.map((p) => p[1]));
      expect(top).toBeCloseTo(0, 0);
      expect(pts[pts.length - 1][1]).toBeGreaterThan(20);
    });
  });
});
