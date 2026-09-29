import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { defaultAnatomy } from '../src/anatomy/anatomy';
import { cellSdf, gradient } from '../src/anatomy/sdf';
import { buildSimMesh } from '../src/mesh/tetgen';
import { buildPiece } from '../src/mesh/piece';
import { Mat, type Anatomy, type Piece, type SimMesh } from '../src/contracts';

const feature = await loadFeature('features/mesh.feature');

function monteCarloVolume(an: Anatomy, n = 200000) {
  const lo = [-3, -2.6, -2.6], hi = [5.8, 2.6, 2.6];
  let inside = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    const x = lo[0] + rnd() * (hi[0] - lo[0]), y = lo[1] + rnd() * (hi[1] - lo[1]), z = lo[2] + rnd() * (hi[2] - lo[2]);
    if (cellSdf(an, x, y, z) < 0) inside++;
  }
  return (inside / n) * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}

function components(sim: SimMesh) {
  const n = sim.pos.length / 3, parent = new Int32Array(n).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let t = 0; t < sim.tets.length; t += 4)
    for (let k = 1; k < 4; k++) parent[find(sim.tets[t + k])] = find(sim.tets[t]);
  const roots = new Set<number>();
  for (let i = 0; i < n; i++) roots.add(find(i));
  return roots.size;
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The render skin faces outward', ({ Given, When, Then }) => {
    let pc: Piece;
    Given('the default yeast anatomy', () => { an = defaultAnatomy(); });
    When('the piece is built', () => { pc = buildPiece(an, [], 0); });
    Then('almost every skin triangle faces away from the cell', () => {
      const { restPos: p, idx } = pc.skin;
      let out = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [3 * idx[t], 3 * idx[t + 1], 3 * idx[t + 2]];
        const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
        const g = gradient((x, y, z) => cellSdf(an, x, y, z), cx, cy, cz);
        if (n[0] * g[0] + n[1] * g[1] + n[2] * g[2] > 0) out++;
      }
      expect(out / (idx.length / 3)).toBeGreaterThan(0.99);
    });
  });

  let an: Anatomy;
  let sim: SimMesh;
  let piece: Piece;

  const givenAnatomy = (Given: (s: string, f: () => void) => void) =>
    Given('the default yeast anatomy', () => { an = defaultAnatomy(); });
  const whenBuilt = (When: (s: string, f: () => void) => void) =>
    When('the simulation mesh is built', () => { sim = buildSimMesh(an, []); });

  Scenario('Every tetrahedron is right side out', ({ Given, When, Then }) => {
    givenAnatomy(Given); whenBuilt(When);
    Then('every tetrahedron has a positive rest volume', () => {
      expect(sim.tets.length).toBeGreaterThan(0);
      for (const v of sim.restVol) expect(v).toBeGreaterThan(0);
    });
  });

  Scenario('The mesh fills the cell', ({ Given, When, Then }) => {
    givenAnatomy(Given); whenBuilt(When);
    Then('the summed tetrahedron volume is within 4 percent of the cell volume', () => {
      const vol = sim.restVol.reduce((a, b) => a + b, 0);
      const ref = monteCarloVolume(an);
      expect(Math.abs(vol - ref) / ref).toBeLessThan(0.04);
    });
  });

  Scenario('Mother and bud are one body', ({ Given, When, Then, And }) => {
    givenAnatomy(Given); whenBuilt(When);
    Then('the tetrahedra form a single connected component', () => {
      expect(components(sim)).toBe(1);
    });
    And('particles exist on both sides of the neck', () => {
      let m = 0, b = 0;
      for (let i = 0; i < sim.restPos.length; i += 3) {
        if (sim.restPos[i] < an.mother.centre[0]) m++;
        if (sim.restPos[i] > an.bud.centre[0]) b++;
      }
      expect(m).toBeGreaterThan(50);
      expect(b).toBeGreaterThan(10);
    });
  });

  Scenario('Organelles give the mesh its materials', ({ Given, When, Then, And }) => {
    givenAnatomy(Given); whenBuilt(When);
    Then('tetrahedra at the surface are cell wall', () => {
      // A tet with a vertex on the surface and its centroid near it is wall.
      let wall = 0, surface = 0;
      for (let t = 0; t < sim.tets.length / 4; t++) {
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < 4; k++) { const i = sim.tets[4 * t + k] * 3; cx += sim.restPos[i] / 4; cy += sim.restPos[i + 1] / 4; cz += sim.restPos[i + 2] / 4; }
        if (cellSdf(an, cx, cy, cz) > -0.1) { surface++; if (sim.tetMaterial[t] === Mat.Wall) wall++; }
      }
      expect(surface).toBeGreaterThan(0);
      expect(wall / surface).toBeGreaterThan(0.95);
    });
    And('some tetrahedra are nucleus and some are vacuole', () => {
      expect(sim.tetMaterial.some((m) => m === Mat.Nucleus)).toBe(true);
      expect(sim.tetMaterial.some((m) => m === Mat.Vacuole)).toBe(true);
    });
  });

  Scenario('The render skin rides inside the mesh', ({ Given, When, Then, And }) => {
    givenAnatomy(Given);
    When('the piece is built', () => { piece = buildPiece(an, [], 0); });
    Then('every skin vertex has barycentric weights summing to one', () => {
      const b = piece.skin.bary;
      for (let i = 0; i < b.length; i += 4) expect(Math.abs(b[i] + b[i + 1] + b[i + 2] + b[i + 3] - 1)).toBeLessThan(1e-4);
    });
    And('every skin vertex is reconstructed from its tetrahedron at rest', () => {
      const { skin, sim: s } = piece;
      let worst = 0, minBary = 1;
      for (let v = 0; v < skin.tetId.length; v++) {
        const t = skin.tetId[v];
        for (let k = 0; k < 3; k++) {
          let x = 0;
          for (let j = 0; j < 4; j++) x += skin.bary[4 * v + j] * s.restPos[s.tets[4 * t + j] * 3 + k];
          worst = Math.max(worst, Math.abs(x - skin.restPos[3 * v + k]));
        }
        for (let j = 0; j < 4; j++) minBary = Math.min(minBary, skin.bary[4 * v + j]);
      }
      expect(worst).toBeLessThan(1e-3);
      expect(minBary).toBeGreaterThan(-0.6);
    });
  });
});
