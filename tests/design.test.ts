import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import tokens from '../src/tokens.css?raw';
import style from '../src/style.css?raw';
import html from '../index.html?raw';
import { VARIETIES } from '../src/render/palette';

const feature = await loadFeature('features/design.feature');
/** A primitive token's value, e.g. prim('neutral-50') → '#fafafa'. */
const prim = (name: string) => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))![1];
const OLD_FONTS = /Newsreader|IBM Plex|'Inter'|family=Inter|Iowan/;

describeFeature(feature, ({ Scenario }) => {
  Scenario('The tokens are the design system\'s own file', ({ Then }) => {
    Then('src/tokens.css is the Academia Classy tokens file', () => {
      expect(tokens).toMatch(/Academia Classy — design tokens/);
      expect(tokens).toMatch(/--font-heading: "Inder"/);
    });
  });

  Scenario('Only the design system\'s fonts are used', ({ Then }) => {
    Then('the page and its styles name no font family outside the design system\'s three', () => {
      expect(style).not.toMatch(OLD_FONTS);
      expect(html).not.toMatch(OLD_FONTS);
      expect(html).toMatch(/family=Inder&family=Inria\+Sans/);
    });
  });

  Scenario('Each microscope view sits on a design-system background', ({ Then }) => {
    Then('brightfield and EM use light-theme colours and fluorescence uses dark-theme colours', () => {
      const v = Object.fromEntries(VARIETIES.map((x) => [x.id, x]));
      expect(v.brightfield.background).toBe(prim('neutral-50'));
      expect(v.brightfield.ink).toBe(prim('neutral-900'));
      expect(v.electron.background).toBe(prim('neutral-200'));
      expect(v.electron.ink).toBe(prim('neutral-900'));
      expect(v.fluorescence.background).toBe(prim('neutral-900'));
      expect(v.fluorescence.ink).toBe(prim('neutral-100'));
    });
  });
  Scenario('Jelly Cells links back to the website and across to Turgor', ({ Then }) => {
    Then('the page has a navigation row linking to the website home and to Turgor', () => {
      const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
      expect(nav).toMatch(/href="https:\/\/feldaher\.github\.io\/"/);
      expect(nav).toMatch(/href="https:\/\/feldaher\.github\.io\/turgor\/"/);
    });
  });
});
