import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { World } from '../src/app/world';
import { restVolume } from '../src/physics/metrics';
import type { CellTypeId } from '../src/contracts';
import { bbox, deepestIntrusion } from './helpers';

const feature = await loadFeature('features/fission.feature');

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Playing the cycle to the end divides the cell', ({ Given, When, Then, And }, v) => {
    let w: World, last = 0;
    Given('a world with the <type> cell one stage before its last', () => {
      const id = v.type as CellTypeId;
      last = cellType(id).stages!.length - 1;
      w = new World(id);
      w.setCellType(id, last - 1);
      for (let f = 0; f < 30; f++) w.update(1 / 60);
    });
    When('it is morphed to the last stage and simulated until the morph ends', () => {
      w.morphTo(last, 2);
      for (let f = 0; f < 60 * 8 && (w.morphing || w.pieces.length < 2); f++) w.update(1 / 60);
      for (let f = 0; f < 90; f++) w.update(1 / 60);
    });
    Then('there are two pieces', () => {
      expect(w.morphing).toBe(false);
      expect(w.stage).toBe(last);
      expect(w.pieces).toHaveLength(2);
    });
    And('the smaller piece holds at least <share> percent of the volume', () => {
      const vols = w.pieces.map((p) => restVolume(p.sim));
      expect((100 * Math.min(...vols)) / (vols[0] + vols[1])).toBeGreaterThan(Number(v.share));
    });
    And('every particle is finite and above the floor', () => {
      for (const p of w.pieces) {
        for (const x of p.sim.pos) expect(Number.isFinite(x)).toBe(true);
        expect(bbox(p).lo[1]).toBeGreaterThan(-0.05);
      }
    });
    And('the daughters do not overlap', () => expect(deepestIntrusion(w.pieces)).toBeLessThan(0.5));
  });

  Scenario('Only the stage that carries a fission plane divides', ({ Given, When, Then }) => {
    let w: World, did = true;
    Given('a world with the pombe cell at its septation stage', () => { w = new World('pombe'); w.setCellType('pombe', 5); });
    When('it is asked to divide', () => { did = w.divide(); });
    Then('it refuses and stays one piece', () => {
      expect(did).toBe(false);
      expect(w.pieces).toHaveLength(1);
    });
  });

  Scenario('A divided cell is made whole when the stage changes', ({ Given, When, Then }) => {
    let w: World;
    Given('a world with the pombe cell divided in two', () => {
      w = new World('pombe');
      w.setCellType('pombe', 6);
      expect(w.divide()).toBe(true);
      expect(w.pieces).toHaveLength(2);
    });
    When('it is morphed to the first stage', () => { w.morphTo(0, 2); });
    Then('the world is at the first stage with one piece at once', () => {
      expect(w.stage).toBe(0);
      expect(w.pieces).toHaveLength(1);
    });
  });
});
