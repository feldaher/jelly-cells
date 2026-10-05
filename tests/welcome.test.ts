import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import html from '../index.html?raw';
import { CELL_TYPES } from '../src/cells';
import { markWelcomed, shouldWelcome, type SeenStore } from '../src/ui/welcome';

const feature = await loadFeature('features/welcome.feature');
const dialog = html.slice(html.indexOf('<dialog class="welcome"'), html.indexOf('</dialog>', html.indexOf('<dialog class="welcome"')));
const text = dialog.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

describeFeature(feature, ({ Scenario }) => {
  Scenario('The welcome says what this is and what you can do', ({ Given, Then, And }) => {
    Given('the page markup', () => expect(dialog.length).toBeGreaterThan(0));
    Then('the welcome is a dialog with a title and a start button', () => {
      expect(html).toMatch(/<dialog class="welcome" id="welcome" aria-labelledby="welcome-title"/);
      expect(dialog).toMatch(/<h2 id="welcome-title"/);
      expect(dialog).toMatch(/<button[^>]*id="welcome-start"/);
    });
    And('it names every cell in the dropdown', () => {
      for (const c of CELL_TYPES) expect(text, c.name).toContain(c.name);
    });
    And('it tells the visitor they can grab, cut, play and read labels', () => {
      for (const w of [/\bgrab\b/i, /\bcut\b/i, /\bplay\b/i, /\blabel/i]) expect(text).toMatch(w);
    });
    And('it is short: under 120 words', () => expect(text.split(' ').length).toBeLessThan(120));
    And('a button on the page opens it again', () => expect(html).toMatch(/<button[^>]*id="welcome-open"/));
  });

  Scenario('The welcome shows once', ({ Given, When, Then, And }) => {
    let store: SeenStore, show = false;
    Given('a visitor who has never been here', () => {
      const m = new Map<string, string>();
      store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
    });
    When('the page decides whether to welcome them', () => { show = shouldWelcome(store); });
    Then('it does', () => expect(show).toBe(true));
    And('after they start, it does not welcome them again', () => {
      markWelcomed(store);
      expect(shouldWelcome(store)).toBe(false);
    });
  });

  Scenario('A browser that refuses storage still gets a welcome', ({ Given, When, Then, And }) => {
    let store: SeenStore, show = false;
    Given('a browser whose storage throws', () => {
      store = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    });
    When('the page decides whether to welcome them', () => { show = shouldWelcome(store); });
    Then('it does', () => expect(show).toBe(true));
    And('starting does not fail', () => expect(() => markWelcomed(store)).not.toThrow());
  });
});
