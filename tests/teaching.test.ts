import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { sectionReport } from '../src/teach/section';
import { scaleBar } from '../src/teach/scale';
import { layoutLabels, type Box } from '../src/teach/labels';
import { wikiUrl } from '../src/teach/wiki';
import { Mat, type Anatomy, type CellType, type SectionEntry } from '../src/contracts';

const feature = await loadFeature('features/teaching.feature');

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let ct: CellType;
  let an: Anatomy;
  let report: SectionEntry[];
  const nucleus = () => an.organelles.find((o) => o.material === Mat.Nucleus)!;
  const yeast = (Given: (s: string, f: () => void) => void) =>
    Given('the yeast cell type', () => { ct = cellType('yeast'); an = ct.build(); });
  const throughNucleus = (When: (s: string, f: () => void) => void) =>
    When('the section through the nucleus centre is measured', () => {
      report = sectionReport(an, [], { n: [1, 0, 0], d: nucleus().a[0] }, ct.umPerUnit);
    });

  Scenario('A cut through the nucleus reports it', ({ Given, When, Then, And }) => {
    yeast(Given); throughNucleus(When);
    Then('the report lists the nucleus', () => expect(report.some((e) => e.material === Mat.Nucleus)).toBe(true));
    And('its width is close to the nucleus diameter', () => {
      const n = nucleus(), e = report.find((x) => x.material === Mat.Nucleus)!;
      const expected = 2 * Math.sqrt(n.b[1] * n.b[2]) * ct.umPerUnit;
      expect(Math.abs(e.widthUm - expected) / expected).toBeLessThan(0.15);
    });
  });

  Scenario('A cut that misses the nucleus does not report it', ({ Given, When, Then }) => {
    yeast(Given);
    When('a section through the far end of the mother is measured', () => {
      report = sectionReport(an, [], { n: [1, 0, 0], d: -2.0 }, ct.umPerUnit);
    });
    Then('the report does not list the nucleus', () => expect(report.some((e) => e.material === Mat.Nucleus)).toBe(false));
  });

  Scenario('Mitochondria are counted profile by profile', ({ Given, When, Then }) => {
    yeast(Given); throughNucleus(When);
    Then('mitochondria are reported as separate profiles', () => {
      const m = report.find((e) => e.material === Mat.Mitochondrion)!;
      expect(m.count).toBeGreaterThanOrEqual(2);
      // an oblique cut through a 0.3 µm tubule gives an elongated profile, still well under 1 µm
      expect(m.widthUm).toBeLessThan(1.0);
    });
  });

  Scenario('The scale bar picks a round length', ({ Given, When, Then, And }) => {
    let px = 0, bar = { um: 0, px: 0 };
    Given('a zoom of 37 pixels per micrometre', () => { px = 37; });
    When('the scale bar is chosen', () => { bar = scaleBar(px); });
    Then('its length is a round number of micrometres', () => expect([0.5, 1, 2, 5, 10, 20, 50, 100]).toContain(bar.um));
    And('it is between 50 and 160 pixels wide', () => {
      expect(bar.px).toBeGreaterThanOrEqual(50);
      expect(bar.px).toBeLessThanOrEqual(160);
    });
  });

  Scenario('Crowded labels do not overlap', ({ Given, When, Then }) => {
    let anchors: { x: number; y: number }[] = [], boxes: Box[] = [];
    Given('twelve labels anchored close together', () => {
      anchors = Array.from({ length: 12 }, (_, i) => ({ x: 600 + (i % 4) * 6, y: 400 + Math.floor(i / 4) * 6 }));
    });
    When('the labels are laid out', () => {
      boxes = layoutLabels(anchors, { x: 590, y: 420 }, anchors.map(() => ({ w: 120, h: 22 })));
    });
    Then('no two label boxes overlap', () => {
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    });
  });

  ScenarioOutline('Every label links to Wikipedia', ({ Given, When, Then }, v) => {
    let names: string[] = [];
    Given('the <cell> cell type', () => { ct = cellType(v.cell); });
    When('its labels are listed at every stage', () => {
      const stages = ct.stages?.length ?? 1;
      for (let s = 0; s < stages; s++) names.push(...ct.labels(ct.build(undefined, s)).map((l) => l.name));
      names = [...new Set(names)];
    });
    Then('each label links to an English Wikipedia article', () => {
      for (const name of names) expect(wikiUrl(name), name).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/[^\s]+$/);
    });
  });
});
