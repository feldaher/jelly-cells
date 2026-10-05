import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { bladeMesh, KnifePart, startKnife, type Knife } from '../src/cut/knife';
import type { WorldMesh } from '../src/render/renderer';
import { freshCell } from './helpers';

const feature = await loadFeature('features/knife.feature');

describeFeature(feature, ({ Scenario }) => {
  let k: Knife, m: WorldMesh;
  const given = (Given: (s: string, f: () => void) => void) => Given('a knife over a yeast cell', () => {
    // a blade along a slanted stroke, so nothing lines up with the world axes by accident
    const along: [number, number, number] = [0.8, 0, 0.6], n: [number, number, number] = [0.6, 0, -0.8];
    k = startKnife({ n, d: 0.3 }, [freshCell()], along, [n[0] * 0.3, 0, n[2] * 0.3], 9);
  });
  const built = (When: (s: string, f: () => void) => void) => When('its mesh is built', () => { m = bladeMesh(k)!; });
  const verts = () => Array.from({ length: m.pos.length / 3 }, (_, i) => ({
    p: [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]], local: [m.rest[4 * i], m.rest[4 * i + 1], m.rest[4 * i + 2]], part: m.rest[4 * i + 3],
  }));
  const offPlane = (p: number[]) => Math.abs(k.plane.n[0] * p[0] + k.plane.n[1] * p[1] + k.plane.n[2] * p[2] - k.plane.d);
  const alongOf = (p: number[]) => k.along[0] * (p[0] - k.centre[0]) + k.along[2] * (p[2] - k.centre[2]);

  Scenario('The blade keeps the cutting edge the physics presses with', ({ Given, When, Then, And }) => {
    given(Given); built(When);
    Then('the lowest steel vertices lie on the blade plane at the edge height', () => {
      const steel = verts().filter((v) => v.part === KnifePart.Blade || v.part === KnifePart.Bevel);
      const minY = Math.min(...steel.map((v) => v.p[1]));
      expect(minY).toBeCloseTo(k.edgeY, 4);
      const lowest = steel.filter((v) => v.p[1] < minY + 1e-4);
      expect(lowest.length).toBeGreaterThanOrEqual(2);
      for (const v of lowest) expect(offPlane(v.p)).toBeLessThan(1e-4);
      // the edge under the cell is level, as the physics assumes: it spans the cell at edge height
      const span = lowest.map((v) => alongOf(v.p));
      expect(Math.max(...span) - Math.min(...span)).toBeGreaterThan(5);
    });
    And('the blade is thicker at the spine than at the edge', () => {
      const steel = verts().filter((v) => v.part === KnifePart.Blade || v.part === KnifePart.Bevel);
      const maxY = Math.max(...steel.map((v) => v.p[1]));
      const spine = Math.max(...steel.filter((v) => v.p[1] > maxY - 0.2).map((v) => offPlane(v.p)));
      expect(spine).toBeGreaterThan(0.03);
      expect(spine).toBeLessThan(0.12);
    });
  });

  Scenario('The knife has steel, a bolster, a wooden handle and rivets', ({ Given, When, Then, And }) => {
    given(Given); built(When);
    Then('it has blade, bolster, wood and rivet parts', () => {
      const parts = new Set(verts().map((v) => v.part));
      for (const p of [KnifePart.Blade, KnifePart.Bolster, KnifePart.Wood, KnifePart.Rivet]) expect(parts.has(p)).toBe(true);
    });
    And('the handle lies beyond the heel of the blade', () => {
      const heel = Math.min(...verts().filter((v) => v.part === KnifePart.Blade || v.part === KnifePart.Bevel).map((v) => alongOf(v.p)));
      const wood = verts().filter((v) => v.part === KnifePart.Wood).map((v) => alongOf(v.p));
      expect(Math.max(...wood)).toBeLessThan(heel + 0.6);
      expect(Math.min(...wood)).toBeLessThan(heel - 2.5);
    });
    And('every vertex carries knife-local coordinates for the grain and the brushing', () => {
      const X = k.along, Z = k.plane.n, o = [k.centre[0], k.edgeY, k.centre[2]];
      for (const v of verts()) for (let a = 0; a < 3; a++) {
        expect(v.p[a]).toBeCloseTo(o[a] + X[a] * v.local[0] + (a === 1 ? v.local[1] : 0) + Z[a] * v.local[2], 3);
      }
    });
    And('every normal is unit length', () => {
      for (let i = 0; i < m.normal.length; i += 3) expect(Math.hypot(m.normal[i], m.normal[i + 1], m.normal[i + 2])).toBeCloseTo(1, 4);
    });
  });
});
