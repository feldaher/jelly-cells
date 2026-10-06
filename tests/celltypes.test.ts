import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { cellType } from '../src/cells';
import { cellSdf, materialAt, primSdf } from '../src/anatomy/sdf';
import { buildSimMesh, tetComponents } from '../src/mesh/tetgen';
import { buildPiece } from '../src/mesh/piece';
import { paramsFor } from '../src/physics/params';
import { currentVolume, restVolume } from '../src/physics/metrics';
import { placeOnFloor, simulate } from './helpers';
import { Mat, Prim, type Anatomy, type CellType, type CellTypeId, type Label, type Piece, type SimMesh } from '../src/contracts';

const feature = await loadFeature('features/celltypes.feature');

function monteCarloVolume(an: Anatomy, n = 150000) {
  const { lo, hi } = an.bounds;
  let inside = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    if (cellSdf(an, lo[0] + rnd() * (hi[0] - lo[0]), lo[1] + rnd() * (hi[1] - lo[1]), lo[2] + rnd() * (hi[2] - lo[2])) < 0) inside++;
  }
  return (inside / n) * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}

function extent(p: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/** Thickness of the body along y through (x, z). */
function thicknessAt(an: Anatomy, x: number, z: number) {
  let n = 0;
  for (let y = an.bounds.lo[1]; y < an.bounds.hi[1]; y += 0.005) if (cellSdf(an, x, y, z) < 0) n++;
  return n * 0.005;
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let ct: CellType;
  let an: Anatomy;
  let sim: SimMesh;
  let labels: Label[];
  let piece: Piece;
  const given = (Given: (s: string, f: () => void) => void, id?: CellTypeId) =>
    Given(id ? `the ${id} cell type` : 'the <type> cell type', () => undefined);

  ScenarioOutline('Every cell type builds a sound soft body', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('its simulation mesh is built', () => { sim = buildSimMesh(an, []); });
    Then('every tetrahedron has a positive rest volume', () => { for (const x of sim.restVol) expect(x).toBeGreaterThan(0); });
    And('the tetrahedra form a single connected component', () => {
      expect(new Set(tetComponents(sim.tets, sim.restPos.length / 3)).size).toBe(1);
    });
    And('the summed tetrahedron volume is within 6 percent of the body volume', () => {
      const vol = sim.restVol.reduce((a, b) => a + b, 0), ref = monteCarloVolume(an);
      expect(Math.abs(vol - ref) / ref).toBeLessThan(0.06);
    });
    And('the particle count stays within the real-time budget', () => {
      const n = sim.restPos.length / 3;
      expect(n).toBeGreaterThan(300);
      expect(n).toBeLessThan(2400);
    });
  });

  ScenarioOutline('Labels point at what they name', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('its labels are listed', () => { labels = ct.labels(an); });
    Then('there are at least three labels', () => expect(labels.length).toBeGreaterThanOrEqual(3));
    And('every label anchor lies inside the cell', () => {
      for (const l of labels) expect(cellSdf(an, ...l.anchor), l.name).toBeLessThan(0);
    });
    And('every label with a material sits inside that material', () => {
      for (const l of labels) if (l.material !== undefined) expect(materialAt(an, ...l.anchor), l.name).toBe(l.material);
    });
  });

  ScenarioOutline('Every cell type comes to rest on the floor', ({ Given, When, Then, And }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); an = ct.build(); });
    When('it is dropped on the floor and left for two seconds', () => {
      piece = buildPiece(an, [], 0);
      placeOnFloor(piece, 0.3);
      simulate([piece], 2, paramsFor(ct));
    });
    Then('no particle is below the floor', () => {
      let minY = Infinity;
      for (let i = 1; i < piece.sim.pos.length; i += 3) minY = Math.min(minY, piece.sim.pos[i]);
      expect(minY).toBeGreaterThan(-1e-3);
    });
    And('its volume is within 3 percent of rest', () => {
      expect(Math.abs(currentVolume(piece.sim) / restVolume(piece.sim) - 1)).toBeLessThan(0.03);
    });
  });

  Scenario('A red blood cell has no nucleus and a dimple', ({ Given, When, Then, And }) => {
    given(Given, 'rbc');
    When('its anatomy is built', () => { ct = cellType('rbc'); an = ct.build(); });
    Then('it has no nucleus, nucleolus or mitochondria', () => {
      const banned: number[] = [Mat.Nucleus, Mat.Nucleolus, Mat.Mitochondrion];
      expect(an.organelles.filter((o) => banned.includes(o.material))).toHaveLength(0);
    });
    And('it is thinner at its centre than at its rim', () => {
      const centre = thicknessAt(an, 0, 0);
      let rim = 0;
      for (let r = 1; r < 3.2; r += 0.1) rim = Math.max(rim, thicknessAt(an, r, 0));
      expect(centre).toBeGreaterThan(0.3);
      expect(centre).toBeLessThan(0.7 * rim);
    });
  });

  Scenario('A fibroblast lies flat and spread', ({ Given, When, Then, And }) => {
    given(Given, 'fibroblast');
    When('its anatomy is built', () => { ct = cellType('fibroblast'); an = ct.build(); });
    Then('it is less than a third as tall as it is long', () => {
      const e = extent(buildSimMesh(an, []).restPos);
      expect(e.size[1]).toBeLessThan(Math.max(e.size[0], e.size[2]) / 3);
    });
    And('it has stress fibres ending in focal adhesions', () => {
      const fibres = an.tubules.filter((t) => t.material === Mat.Actin);
      const adhesions = an.organelles.filter((o) => o.material === Mat.Adhesion);
      expect(fibres.length).toBeGreaterThanOrEqual(3);
      for (const f of fibres) {
        const end = f.points[f.points.length - 1];
        const near = adhesions.some((a) => Math.hypot(a.a[0] - end[0], a.a[1] - end[1], a.a[2] - end[2]) < 0.5);
        expect(near).toBe(true);
      }
    });
  });

  Scenario('A neuron reaches far beyond its soma', ({ Given, When, Then, And }) => {
    given(Given, 'neuron');
    When('its anatomy is built', () => { ct = cellType('neuron'); an = ct.build(); });
    Then('it is more than three soma diameters long', () => {
      const soma = an.body[0].prim;
      const e = extent(buildSimMesh(an, []).restPos);
      expect(Math.max(e.size[0], e.size[2])).toBeGreaterThan(3 * 2 * soma.b[0]);
    });
    And('it has Nissl bodies and a nucleolus', () => {
      expect(an.organelles.filter((o) => o.material === Mat.ER).length).toBeGreaterThanOrEqual(3);
      expect(an.organelles.some((o) => o.material === Mat.Nucleolus)).toBe(true);
    });
  });

  Scenario('Microglia are ramified', ({ Given, When, Then, And }) => {
    given(Given, 'microglia');
    When('its anatomy is built', () => { ct = cellType('microglia'); an = ct.build(); });
    Then('at least four processes leave the soma', () => {
      const soma = an.body[0].prim;
      const primary = an.body.filter((b) => b.prim.kind === Prim.Cone &&
        Math.hypot(b.prim.a[0] - soma.a[0], b.prim.a[1] - soma.a[1], b.prim.a[2] - soma.a[2]) < Math.max(...soma.b) + 0.3);
      expect(primary.length).toBeGreaterThanOrEqual(4);
    });
    And('it has lysosomes', () => {
      expect(an.organelles.filter((o) => o.material === Mat.Lysosome).length).toBeGreaterThanOrEqual(2);
    });
  });

  const mats = (m: number) => an.organelles.filter((o) => o.material === m);
  const um = () => ct.umPerUnit;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const built = (When: (s: string, f: () => void) => void, id: CellTypeId) => When('its anatomy is built', () => { ct = cellType(id); an = ct.build(); });

  Scenario('An animal cell has the textbook organelles and no wall', ({ Given, When, Then, And }) => {
    given(Given, 'animal'); built(When, 'animal');
    Then('it has a nucleus with a nucleolus, rough ER, a Golgi stack, a centrosome, mitochondria, lysosomes and peroxisomes', () => {
      for (const m of [Mat.Nucleus, Mat.Nucleolus, Mat.ER, Mat.Golgi, Mat.Spindle, Mat.Mitochondrion, Mat.Lysosome, Mat.Peroxisome]) expect(mats(m).length, String(m)).toBeGreaterThanOrEqual(1);
      const n = mats(Mat.Nucleus)[0], nl = mats(Mat.Nucleolus)[0];
      expect(dist(n.a, nl.a) + nl.b[0]).toBeLessThan(n.b[0]);
      expect(mats(Mat.Golgi).filter((o) => o.kind === Prim.Bowl).length).toBeGreaterThanOrEqual(7);
    });
    And('it has no chloroplast and no vacuole', () => { expect(mats(Mat.Chloroplast)).toHaveLength(0); expect(mats(Mat.Vacuole)).toHaveLength(0); });
    And('it is about 20 micrometres across', () => {
      const w = (an.bounds.hi[0] - an.bounds.lo[0]) * um();
      expect(w).toBeGreaterThan(17); expect(w).toBeLessThan(23);
    });
    And("its membrane is far thinner than a plant cell's wall", () => {
      const plant = cellType('plant');
      expect(an.wallThickness * um()).toBeLessThan(0.5 * plant.build().wallThickness * plant.umPerUnit);
    });
  });

  Scenario('A plant cell is a walled column lined with chloroplasts around a vacuole', ({ Given, When, Then, And }) => {
    given(Given, 'plant'); built(When, 'plant');
    Then('it is more than twice as long as it is wide', () => {
      const s = [0, 1, 2].map((k) => an.bounds.hi[k] - an.bounds.lo[k]);
      expect(s[0]).toBeGreaterThan(2 * s[1]);
    });
    And('it has at least 30 chloroplasts, each 5 micrometres across and lying flat between the vacuole and the wall', () => {
      const cp = mats(Mat.Chloroplast), vac = mats(Mat.Vacuole)[0];
      expect(cp.length).toBeGreaterThanOrEqual(30);
      for (const c of cp) {
        expect(c.kind).toBe(Prim.Disc);
        expect(2 * c.R * um()).toBeCloseTo(5, 0);
        const ht = Math.hypot(...c.b);
        // its two faces: one clear of the vacuole, the other inside the wall
        const face = (s: number) => [0, 1, 2].map((k) => c.a[k] + (s * c.b[k] * (ht + 0.01)) / ht);
        const f = [face(1), face(-1)];
        for (const p of f) { expect(primSdf(vac, p[0], p[1], p[2])).toBeGreaterThan(0); expect(cellSdf(an, p[0], p[1], p[2])).toBeLessThan(-an.wallThickness); }
        // flat against the wall: its axis points along the surface normal
        const g = [0, 1, 2].map((k) => { const e = [0, 0, 0]; e[k] = 1e-3; return cellSdf(an, c.a[0] + e[0], c.a[1] + e[1], c.a[2] + e[2]) - cellSdf(an, c.a[0] - e[0], c.a[1] - e[1], c.a[2] - e[2]); });
        const gl = Math.hypot(...g);
        expect(Math.abs((g[0] * c.b[0] + g[1] * c.b[1] + g[2] * c.b[2]) / (gl * ht))).toBeGreaterThan(0.95);
      }
    });
    And('its central vacuole takes up more than half of the cell, with the nucleus pressed flat against the wall', () => {
      const nuc = mats(Mat.Nucleus)[0];
      expect(nuc.b[1]).toBeLessThan(0.7 * nuc.b[0]);
      expect(-cellSdf(an, nuc.a[0], nuc.a[1] + nuc.b[1], nuc.a[2]) * um()).toBeLessThan(1.2);
      const vac = mats(Mat.Vacuole)[0];
      let inCell = 0, inVac = 0, s = 99;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const { lo, hi } = an.bounds;
      for (let i = 0; i < 60000; i++) {
        const p = [0, 1, 2].map((k) => lo[k] + rnd() * (hi[k] - lo[k]));
        if (cellSdf(an, p[0], p[1], p[2]) < 0) { inCell++; if (primSdf(vac, p[0], p[1], p[2]) < 0) inVac++; }
      }
      expect(inVac / inCell).toBeGreaterThan(0.5);
    });
    And('it has a nucleus, mitochondria, peroxisomes, Golgi stacks and rough ER', () => {
      for (const m of [Mat.Nucleus, Mat.Mitochondrion, Mat.Peroxisome, Mat.Golgi, Mat.ER]) expect(mats(m).length, String(m)).toBeGreaterThanOrEqual(1);
    });
  });

  Scenario('Bacteriophage T4 has the measured head, tail and fibres', ({ Given, When, Then, And }) => {
    given(Given, 'phage'); built(When, 'phage');
    const nm = (x: number) => x * um() * 1000;
    Then('its head is 115 nm long and 85 nm wide', () => {
      const head = an.body[0].prim;
      expect(head.kind).toBe(Prim.Ellipsoid);
      expect(nm(2 * head.b[0])).toBeCloseTo(115, 0); expect(nm(2 * head.b[1])).toBeCloseTo(85, 0); expect(nm(2 * head.b[2])).toBeCloseTo(85, 0);
    });
    And('its tail is 92.5 nm long and 24 nm wide, with a tube 9 nm wide inside', () => {
      const head = an.body[0].prim, tail = an.body[1].prim, tube = mats(Mat.ViralProtein)[0];
      // from where it leaves the head to its far end
      expect(nm(tail.b[0] - (head.a[0] + head.b[0]))).toBeCloseTo(92.5, 0);
      expect(nm(2 * tail.R)).toBeCloseTo(24, 0);
      expect(nm(2 * tube.r)).toBeCloseTo(9, 0);
    });
    And('it has a baseplate 52 nm across and six long tail fibres of 145 nm', () => {
      const plate = an.body[2].prim;
      expect(nm(2 * plate.b[1])).toBeCloseTo(52, 0);
      const fibres = an.body.slice(3).map((b) => b.prim);
      expect(fibres).toHaveLength(12);
      for (let i = 0; i < 12; i += 2) {
        expect(dist(fibres[i].b, fibres[i + 1].a)).toBeLessThan(1e-6);
        expect(nm(dist(fibres[i].a, fibres[i].b) + dist(fibres[i + 1].a, fibres[i + 1].b))).toBeCloseTo(145, 0);
      }
    });
    And('its DNA lies inside the head', () => {
      const head = an.body[0].prim, dna = mats(Mat.Genome);
      expect(dna).toHaveLength(1);
      for (let k = 0; k < 3; k++) { expect(dna[0].a[k]).toBeCloseTo(head.a[k], 6); expect(dna[0].b[k]).toBeLessThan(head.b[k]); }
    });
  });

  Scenario('A coronavirus is an enveloped sphere with spikes', ({ Given, When, Then, And }) => {
    given(Given, 'coronavirus'); built(When, 'coronavirus');
    const nm = (x: number) => x * um() * 1000;
    Then('its envelope is about 100 nm across', () => {
      const env = an.body[0].prim;
      expect(nm(2 * env.b[0])).toBeGreaterThan(90); expect(nm(2 * env.b[0])).toBeLessThan(110);
    });
    And('24 spikes stand out from it', () => {
      const env = an.body[0].prim, spikes = an.body.slice(1).map((b) => b.prim);
      expect(spikes).toHaveLength(24);
      for (const s of spikes) expect(Math.hypot(...s.b) - env.b[0]).toBeGreaterThan(1);
      expect(mats(Mat.ViralProtein)).toHaveLength(24);
    });
    And('its RNA, packed in beads, lies inside the envelope', () => {
      const env = an.body[0].prim, beads = mats(Mat.Genome);
      expect(beads.length).toBeGreaterThanOrEqual(20);
      for (const b of beads) expect(Math.hypot(...b.a) + b.b[0]).toBeLessThan(env.b[0] - an.wallThickness);
    });
  });

  Scenario('An Aspergillus hypha is a tube with many nuclei and a pierced septum', ({ Given, When, Then, And }) => {
    given(Given, 'aspergillus'); built(When, 'aspergillus');
    Then('it is 3 micrometres wide and more than five times as long', () => {
      const tube = an.body[0].prim, width = 2 * tube.R * um(), length = (an.body[1].prim.b[0] + an.body[1].prim.r - tube.a[0] + tube.R) * um();
      expect(width).toBeCloseTo(3, 5); expect(length).toBeGreaterThan(5 * width);
    });
    And('its septum has a central pore with Woronin bodies beside it', () => {
      const septum = mats(Mat.Septum)[0], wb = mats(Mat.Peroxisome);
      expect(septum.kind).toBe(Prim.Disc);
      expect(2 * septum.r * um()).toBeGreaterThanOrEqual(0.05); expect(2 * septum.r * um()).toBeLessThanOrEqual(0.5);
      expect(wb.length).toBeGreaterThanOrEqual(2);
      for (const w of wb) expect(dist(w.a, septum.a) * um()).toBeLessThan(0.8);
    });
    And('the tip compartment holds one nucleus for about every 60 cubic micrometres of cytoplasm', () => {
      const septum = mats(Mat.Septum)[0], tube = an.body[0].prim, dome = an.body[1].prim;
      const nuclei = mats(Mat.Nucleus).filter((n) => n.a[0] > septum.a[0]).length;
      const length = (dome.b[0] + dome.r - septum.a[0]) * um(), radius = tube.R * um();
      const perNucleus = (Math.PI * radius * radius * length) / nuclei;
      expect(nuclei).toBeGreaterThan(1);
      expect(perNucleus).toBeGreaterThan(45); expect(perNucleus).toBeLessThan(80);
    });
    And('a Spitzenkörper sits at the very tip', () => {
      const spk = mats(Mat.Vesicle)[0];
      const dome = an.body[1].prim;
      expect(dome.b[0] + dome.r - spk.a[0]).toBeLessThan(1);
      expect(cellSdf(an, spk.a[0] + spk.b[0], 0, 0)).toBeLessThan(-an.wallThickness);
    });
    And('its Golgi is single rings, more of them toward the tip but none in the dome, and microtubules run its length', () => {
      const rings = mats(Mat.Golgi), dome = an.body[1].prim, tipX = dome.b[0] + dome.r, septum = mats(Mat.Septum)[0];
      expect(rings.length).toBeGreaterThanOrEqual(6);
      for (const g of rings) { expect(g.kind).toBe(Prim.Torus); expect((tipX - g.a[0]) * um()).toBeGreaterThan(1.3); }
      const mid = (septum.a[0] + tipX) / 2;
      expect(rings.filter((g) => g.a[0] > mid).length).toBeGreaterThan(rings.filter((g) => g.a[0] <= mid).length);
      const mts = an.tubules.filter((x) => x.material === Mat.Spindle);
      expect(mts.length).toBeGreaterThanOrEqual(3);
      for (const m of mts) expect((m.points[m.points.length - 1][0] - m.points[0][0]) * um()).toBeGreaterThan(12);
    });
  });

  Scenario('Budding yeast has ER against its membrane and a Golgi that is not stacked', ({ Given, When, Then, And }) => {
    given(Given, 'yeast'); built(When, 'yeast');
    Then('its ER sheets lie within 0.4 micrometres of the cell wall', () => {
      const sheets = mats(Mat.ER).filter((o) => o.kind === Prim.Bowl);
      expect(sheets.length).toBeGreaterThanOrEqual(5);
      for (const e of sheets) {
        const l = Math.hypot(...e.b), mid = [0, 1, 2].map((k) => e.a[k] + (e.b[k] / l) * e.R);
        const depth = -cellSdf(an, mid[0], mid[1], mid[2]) * um();
        expect(depth).toBeGreaterThan(an.wallThickness * um()); expect(depth).toBeLessThan(an.wallThickness * um() + 0.4);
      }
    });
    And('its Golgi cisternae are single, no two in a stack', () => {
      const g = mats(Mat.Golgi);
      expect(g.length).toBeGreaterThanOrEqual(8);
      for (const c of g) expect(c.kind).toBe(Prim.Disc);
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) expect(dist(g[i].a, g[j].a) * um()).toBeGreaterThan(0.4);
    });
  });

  Scenario("A neuron's Golgi wraps its nucleus and sends an outpost into a dendrite", ({ Given, When, Then, And }) => {
    given(Given, 'neuron'); built(When, 'neuron');
    const nearNucleus = (o: (typeof an.organelles)[number]) => dist(o.a, mats(Mat.Nucleus)[0].a) < 1e-6;
    Then('most of its Golgi cisternae are curved about the nucleus', () => {
      const g = mats(Mat.Golgi);
      expect(g.every((o) => o.kind === Prim.Bowl)).toBe(true);
      expect(g.filter(nearNucleus).length).toBeGreaterThanOrEqual(28);
    });
    And('a few sit in the main dendrite, far from the soma', () => {
      const soma = an.body[0].prim, post = mats(Mat.Golgi).filter((o) => !nearNucleus(o));
      expect(post.length).toBeGreaterThanOrEqual(2);
      for (const o of post) {
        const l = Math.hypot(...o.b), mid = [0, 1, 2].map((k) => o.a[k] + (o.b[k] / l) * o.R);
        expect(primSdf(soma, mid[0], mid[1], mid[2])).toBeGreaterThan(0);
        expect(cellSdf(an, mid[0], mid[1], mid[2])).toBeLessThan(0);
      }
    });
    And('microtubules run along the axon', () => {
      const mts = an.tubules.filter((x) => x.material === Mat.Spindle);
      expect(mts.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...mts.map((m) => m.points[m.points.length - 1][0]))).toBeGreaterThan(6);
    });
  });

  ScenarioOutline('Microtubules radiate from the centrosome', ({ Given, When, Then }, v) => {
    Given('the <type> cell type', () => { ct = cellType(v.type as CellTypeId); });
    When('its anatomy is built', () => { an = ct.build(); });
    Then('at least eight microtubules start at the centrosome and none passes through the nucleus', () => {
      const mtoc = mats(Mat.Spindle).find((o) => o.kind === Prim.Ellipsoid)!, nucleus = mats(Mat.Nucleus)[0];
      const mts = an.tubules.filter((x) => x.material === Mat.Spindle);
      expect(mts.length).toBeGreaterThanOrEqual(8);
      for (const m of mts) {
        expect(dist(m.points[0], mtoc.a)).toBeLessThan(1e-6);
        for (const p of m.points) expect(primSdf(nucleus, p[0], p[1], p[2])).toBeGreaterThan(0);
      }
    });
  });
});
