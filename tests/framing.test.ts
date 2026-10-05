import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { freeArea, framing, type Rect } from '../src/ui/frame';

const feature = await loadFeature('features/framing.feature');

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });

describeFeature(feature, ({ Scenario }) => {
  let w = 0, h = 0, obstacles: Rect[] = [];
  let free: Rect, frame: ReturnType<typeof framing>;
  /** Where the camera target (the centre of the unshifted image) lands on screen. */
  const targetOnScreen = () => ({ x: w * (0.5 + frame.lensShiftX), y: h * (0.5 - frame.lensShiftY) });
  const work = (When: (s: string, f: () => void) => void) =>
    When('the free area and the framing are worked out', () => { free = freeArea(obstacles, w, h); frame = framing(free, w, h); });

  Scenario('A control sheet along the bottom pushes the cell up', ({ Given, When, Then, And }) => {
    Given('a 390 by 844 phone screen with a readout across the top and a control sheet along the bottom', () => {
      w = 390; h = 844;
      obstacles = [rect(16, 20, 250, 110), rect(16, 120, 374, 190), rect(0, 690, 390, 844)];
    });
    work(When);
    Then('the free area lies between the readout and the sheet', () => expect(free).toEqual(rect(0, 190, 390, 690)));
    And('the camera target lands in the middle of the free area', () => {
      const t = targetOnScreen();
      expect(t.x).toBeCloseTo(195, 5);
      expect(t.y).toBeCloseTo(440, 5);
    });
    And("the cell is pulled back far enough to fit the screen's width", () => expect(frame.distScale).toBeCloseTo((1.05 * 844) / 390, 5));
  });

  Scenario('An open sheet taller than half the screen still pushes the cell up', ({ Given, When, Then, And }) => {
    Given('a 390 by 844 phone screen with a readout across the top and an open sheet covering the lower 60 percent', () => {
      w = 390; h = 844;
      obstacles = [rect(16, 20, 250, 110), rect(16, 120, 374, 190), rect(0, 338, 390, 844)];
    });
    work(When);
    Then('the free area lies between the readout and the sheet', () => expect(free).toEqual(rect(0, 190, 390, 338)));
    And('the camera target lands in the middle of the free area', () => expect(targetOnScreen().y).toBeCloseTo(264, 5));
  });

  Scenario('A control column on the right pushes the cell left', ({ Given, When, Then, And }) => {
    Given('an 844 by 390 phone screen with a control column on the right', () => {
      w = 844; h = 390;
      obstacles = [rect(16, 12, 300, 90), rect(604, 0, 844, 390)];
    });
    work(When);
    Then('the free area ends where the column starts', () => expect(free).toEqual(rect(0, 0, 604, 390)));
    And('the camera target lands in the middle of the free area', () => {
      const t = targetOnScreen();
      expect(t.x).toBeCloseTo(302, 5);
      expect(t.y).toBeCloseTo(195, 5);
    });
  });

  Scenario('A wide screen with nothing in the way is framed as before', ({ Given, When, Then, And }) => {
    Given('a 1600 by 1000 screen with nothing in the way', () => { w = 1600; h = 1000; obstacles = []; });
    work(When);
    Then('the lens is not shifted', () => { expect(frame.lensShiftX).toBe(0); expect(frame.lensShiftY).toBe(0); });
    And('the camera is not pulled back', () => expect(frame.distScale).toBe(1));
  });
});
