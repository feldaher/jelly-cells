import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { POMBE, pombeDaughterNucleusRadius, pombeLength, pombeNucleusRadius, pombeTipGrowth, pombeVolume } from '../src/cells/cycle/pombe';
import { ECOLI, ecoliLength, ecoliReplication, ecoliWaist, ecoliZRingAge } from '../src/cells/cycle/ecoli';

const feature = await loadFeature('features/cyclelaws.feature');
const sphere = (r: number) => (4 / 3) * Math.PI * r ** 3;

describeFeature(feature, ({ Scenario }) => {
  Scenario('Fission yeast grows in two linear segments and then stops', ({ Given, When, Then, And }) => {
    let L: number[] = [];
    Given('the fission yeast length law', () => undefined);
    When('the length is read at birth, at new end take-off, at the end of growth and at division', () => {
      L = [0, POMBE.netoPhase, POMBE.growthEnd, 1].map(pombeLength);
    });
    Then('the lengths are 7, 9.5, 14 and 14 micrometres', () => {
      [7, 9.5, 14, 14].forEach((x, i) => expect(L[i]).toBeCloseTo(x, 6));
    });
    And('the cell grows faster after new end take-off than before', () => {
      const before = (pombeLength(0.2) - pombeLength(0.1)) / 0.1, after = (pombeLength(0.6) - pombeLength(0.5)) / 0.1;
      expect(after).toBeGreaterThan(before);
    });
    And('only the old end has grown before new end take-off', () => {
      expect(pombeTipGrowth(POMBE.netoPhase).newEnd).toBeCloseTo(0, 6);
      expect(pombeTipGrowth(POMBE.netoPhase).oldEnd).toBeCloseTo(2.5, 6);
      const late = pombeTipGrowth(POMBE.growthEnd);
      expect(late.newEnd).toBeGreaterThan(0);
      expect(late.oldEnd + late.newEnd).toBeCloseTo(7, 6);
    });
  });

  Scenario('The fission yeast nucleus keeps 8 percent of the cell volume', ({ Given, When, Then, And }) => {
    let r: number[] = [];
    Given('the fission yeast length law', () => undefined);
    When('the nucleus radius is computed at birth and at division', () => { r = [7, 14].map(pombeNucleusRadius); });
    Then('the nuclear volume is 8 percent of the rod volume both times', () => {
      expect(sphere(r[0]) / pombeVolume(7)).toBeCloseTo(0.08, 6);
      expect(sphere(r[1]) / pombeVolume(14)).toBeCloseTo(0.08, 6);
    });
    And('two daughter nuclei together have the volume of the mother nucleus', () => {
      expect(2 * sphere(pombeDaughterNucleusRadius(14))).toBeCloseTo(sphere(r[1]), 6);
    });
  });

  Scenario('E. coli elongates exponentially', ({ Given, When, Then }) => {
    let L: number[] = [];
    Given('the E. coli growth law', () => undefined);
    When('the length is read at birth, at half a generation and at division', () => {
      L = [0, ECOLI.generationMin / 2, ECOLI.generationMin].map(ecoliLength);
    });
    Then('the lengths are 2.2, 2.2 times the square root of two, and 4.4 micrometres', () => {
      expect(L[0]).toBeCloseTo(2.2, 6);
      expect(L[1]).toBeCloseTo(2.2 * Math.SQRT2, 6);
      expect(L[2]).toBeCloseTo(4.4, 6);
    });
  });

  Scenario('E. coli replication rounds overlap in fast growth', ({ Given, When, Then, And }) => {
    Given('the E. coli growth law', () => undefined);
    When('the replication state is read through the cycle', () => undefined);
    Then('a newborn cell carries a chromosome that is 70 percent replicated', () => {
      expect(ecoliReplication(0).oldRound).toBeCloseTo(0.7, 6);
      expect(ecoliReplication(0).newRound).toBe(0);
    });
    And('the next round starts at 4 minutes and the old one ends at 12 minutes', () => {
      const r = ecoliReplication(0);
      expect(r.initiationAge).toBe(4);
      expect(r.terminationAge).toBe(12);
      expect(ecoliReplication(12).oldRound).toBeCloseTo(1, 6);
      // a daughter inherits the round its mother started: 28 of 40 minutes done
      expect(ecoliReplication(ECOLI.generationMin).newRound).toBeCloseTo(ecoliReplication(0).oldRound, 6);
    });
    And('the cell has one nucleoid before termination and two after', () => {
      expect(ecoliReplication(11.9).nucleoids).toBe(1);
      expect(ecoliReplication(12).nucleoids).toBe(2);
    });
    And('it has two origins before initiation and four after', () => {
      expect(ecoliReplication(3.9).origins).toBe(2);
      expect(ecoliReplication(4).origins).toBe(4);
    });
  });

  Scenario('The Z ring is there before the cell constricts', ({ Given, When, Then, And }) => {
    Given('the E. coli growth law', () => undefined);
    When('the waist is read through the cycle', () => undefined);
    Then('the Z ring assembles at the start of the D period', () => {
      expect(ecoliZRingAge()).toBe(ECOLI.generationMin - ECOLI.dMin);
    });
    And('the waist is full at that time and closed at division', () => {
      expect(ecoliWaist(ecoliZRingAge())).toBe(1);
      expect(ecoliWaist(ECOLI.generationMin)).toBeCloseTo(0, 6);
    });
    And('it never widens', () => {
      let last = 1;
      for (let a = 0; a <= ECOLI.generationMin; a += 0.5) { const w = ecoliWaist(a); expect(w).toBeLessThanOrEqual(last + 1e-12); last = w; }
    });
  });
});
