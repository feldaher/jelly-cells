import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import html from '../index.html?raw';
import { cellType } from '../src/cells';
import { micrograph } from '../src/teach/micrographs';
import type { CellType, CellTypeId, Micrograph } from '../src/contracts';

const feature = await loadFeature('features/micrographs.feature');
/** Files shipped in public/micrographs, as site paths. */
const shipped = new Set(Object.keys(import.meta.glob('../public/micrographs/*')).map((k) => k.replace('../public/', '')));

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Every label has a credited micrograph', ({ Given, When, Then, And }, v) => {
    let ct: CellType;
    let names: string[] = [];
    const pics = () => names.map((n) => [n, micrograph(ct.id, n)] as [string, Micrograph]);
    Given('the <cell> cell type', () => { ct = cellType(v.cell as CellTypeId); });
    When('its labels are listed at every stage', () => {
      for (let s = 0; s < (ct.stages?.length ?? 1); s++) names.push(...ct.labels(ct.build(7, s)).map((l) => l.name));
      names = [...new Set(names)];
    });
    Then('each label has a micrograph', () => { for (const [n, m] of pics()) expect(m, n).toBeDefined(); });
    And('each micrograph is public domain, CC0, CC BY or CC BY-SA with an author', () => {
      for (const [n, m] of pics()) {
        expect(m.license, n).toMatch(/^(Public domain|CC0|CC BY(-SA)? [0-9.]+)$/);
        expect(m.author.trim().length, n).toBeGreaterThan(1);
      }
    });
    And("each micrograph file is in the site's public folder", () => {
      for (const [n, m] of pics()) {
        expect(m.src, n).toMatch(/^micrographs\/[a-z0-9-]+\.(jpg|png|webp)$/);
        expect(shipped.has(m.src), `${n}: public/${m.src}`).toBe(true);
      }
    });
    And('each micrograph names its Commons file and says what it shows', () => {
      for (const [n, m] of pics()) {
        expect(m.commons, n).toMatch(/^File:.+\.(jpe?g|png|tiff?|gif|webp)$/i);
        expect(m.caption.length, n).toBeGreaterThan(15);
      }
    });
  });

  Scenario('The physics notes open in a modal', ({ Given, Then, And }) => {
    Given('the page markup', () => { expect(html.length).toBeGreaterThan(0); });
    Then('the physics notes are in a dialog with a close button', () => {
      expect(html).toMatch(/<dialog[^>]*id="inside"/);
      expect(html).toMatch(/id="inside-close"/);
    });
    And('a button opens them', () => expect(html).toMatch(/<button[^>]*id="inside-open"/));
    And('they state the XPBD update and the Green–Lagrange strain', () => {
      const dialog = html.slice(html.indexOf('<dialog'), html.indexOf('</dialog>'));
      expect(dialog).toContain('Δλ');
      expect(dialog).toContain('Green–Lagrange');
      expect(dialog).toMatch(/E\s*=\s*½/);
    });
  });
});
