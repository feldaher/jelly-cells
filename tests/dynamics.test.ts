import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import organelleWgsl from '../src/render/shaders/organelle.wgsl?raw';
import { CELL_TYPES, cellType } from '../src/cells';
import { DYNAMICS, dynamicsWgsl, microtubuleEnd, microtubulePeriod, poreCount } from '../src/cells/cycle/dynamics';
import { buildPiece } from '../src/mesh/piece';
import { COORD_MOVING, COORD_SPAN } from '../src/mesh/organelleMesh';
import { Mat, Prim, type Anatomy, type CellTypeId, type Primitive } from '../src/contracts';
import { of, tubulesOf } from './measure';

const feature = await loadFeature('features/dynamics.feature');
const stages = (id: Parameters<typeof cellType>[0]) => cellType(id).stages!.map((_, i) => cellType(id).build(7, i));
/** Prims of a material grouped into stacks: discs that share an axis line. */
function stacks(an: Anatomy, material: number) {
  const g = new Map<string, number>();
  for (const d of of(an, material, Prim.Disc)) { const k = `${d.a[0].toFixed(3)},${d.a[2].toFixed(3)}`; g.set(k, (g.get(k) ?? 0) + 1); }
  return [...g.values()];
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  Scenario('Titles are set the same way for every cell', ({ Given, Then, And }) => {
    Given('every cell type', () => expect(CELL_TYPES.length).toBe(12));
    Then('each title is one or two lines and ends with a full stop', () => {
      for (const c of CELL_TYPES) {
        expect(c.title.length, c.id).toBeGreaterThanOrEqual(1);
        expect(c.title.length, c.id).toBeLessThanOrEqual(2);
        expect(c.title[c.title.length - 1], c.id).toMatch(/\.$/);
      }
    });
    And('no title breaks a word across lines', () => {
      for (const c of CELL_TYPES) for (const line of c.title.slice(0, -1)) expect(line, c.id).not.toMatch(/[-.]$/);
    });
    And("the lines of a title spell the cell's name", () => {
      for (const c of CELL_TYPES) expect(c.title.join(' ').replace(/\.$/, '').toLowerCase(), c.id).toBe(c.name.toLowerCase());
    });
  });

  Scenario('Fission yeast microtubules grow, pause at the tip and collapse', ({ Given, When, Then, And }) => {
    const reach = 6.5, m = DYNAMICS.microtubule;
    let T = 0;
    Given('the table of organelle motions', () => undefined);
    When('a microtubule end is followed through one cycle in a 14 micrometre cell', () => { T = microtubulePeriod(reach); });
    Then('it grows at 1.86 micrometres per minute', () => {
      expect(m.growUmPerMin).toBe(1.86);
      expect((microtubuleEnd(60, reach) - microtubuleEnd(0, reach)) / 1).toBeCloseTo(1.86, 6);
    });
    And('it stays at the tip for 1.5 minutes', () => {
      const arrive = ((1 - m.restFraction) * reach / m.growUmPerMin) * 60;
      expect(microtubuleEnd(arrive + 1, reach)).toBeCloseTo(reach, 6);
      expect(microtubuleEnd(arrive + 89, reach)).toBeCloseTo(reach, 6);
      expect(microtubuleEnd(arrive + 95, reach)).toBeLessThan(reach);
    });
    And('it shrinks faster than it grew, back toward the nucleus', () => {
      expect(m.shrinkUmPerMin).toBeGreaterThan(m.growUmPerMin);
      expect(microtubuleEnd(T - 0.01, reach)).toBeCloseTo(m.restFraction * reach, 1);
    });
    And('the cycle repeats', () => {
      for (const t of [10, 100, 200]) expect(microtubuleEnd(t + T, reach)).toBeCloseTo(microtubuleEnd(t, reach), 6);
    });
  });

  Scenario('The rates reach the shader from the same table', ({ Given, When, Then, And }) => {
    let wgsl = '';
    Given('the table of organelle motions', () => undefined);
    When('the shader constants are generated', () => { wgsl = dynamicsWgsl(); });
    Then('every rate and its speed-up appear in them', () => {
      const m = DYNAMICS;
      for (const [name, v] of [
        ['MT_GROW', m.microtubule.growUmPerMin / 60], ['MT_SHRINK', m.microtubule.shrinkUmPerMin / 60], ['MT_DWELL', m.microtubule.dwellMin * 60],
        ['MT_SPEEDUP', m.microtubule.speedup], ['TRANSPORT_SPEED', m.transport.umPerSec], ['TRANSPORT_SPEEDUP', m.transport.speedup],
        ['WAVE_PERIOD', m.nucleoidWave.periodSec], ['WAVE_AMPLITUDE', m.nucleoidWave.amplitude], ['TREADMILL_SPEED', m.treadmill.umPerSec],
        ['TREADMILL_SPEEDUP', m.treadmill.speedup], ['PORE_CELL', m.pores.latticeUm],
      ] as [string, number][]) expect(wgsl, name).toContain(`const ${name} = ${v}`);
    });
    And('the organelle shader uses them', () => {
      for (const name of ['MT_GROW', 'TRANSPORT_SPEED', 'WAVE_PERIOD', 'TREADMILL_SPEED', 'PORE_CELL']) expect(organelleWgsl, name).toContain(name);
    });
  });

  Scenario('Tubes carry their length to the shader', ({ Given, When, Then, And }) => {
    let an: Anatomy, piece: ReturnType<typeof buildPiece>;
    const coordOf = (m: number) => piece.organelles.find((o) => o.material === m)!.coord!;
    Given('the fission yeast cell in late G2', () => { an = cellType('pombe').build(7, 2); });
    When('its organelle meshes are built', () => { piece = buildPiece(an, [], 1); });
    Then('every microtubule vertex is flagged as moving and carries its distance along the tube', () => {
      const c = coordOf(Mat.Spindle);
      expect(c.length).toBeGreaterThan(0);
      for (const x of c) expect(Math.floor(x)).toBeGreaterThanOrEqual(COORD_MOVING);
      expect(new Set(Array.from(c, (x) => Math.floor(x))).size).toBe(tubulesOf(an, Mat.Spindle).length);
    });
    And('other organelles are not flagged as moving', () => {
      for (const o of piece.organelles) if (o.material !== Mat.Spindle) for (const x of o.coord!) expect(Math.floor(x)).toBeLessThan(COORD_MOVING);
    });
    And("a mitochondrion's vertices run from zero to its length", () => {
      const c = coordOf(Mat.Mitochondrion), first = Array.from(c).filter((x) => Math.floor(x) === 0).map((x) => (x % 1) * COORD_SPAN);
      const t = tubulesOf(an, Mat.Mitochondrion)[0].points;
      let L = 0;
      for (let i = 1; i < t.length; i++) L += Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1], t[i][2] - t[i - 1][2]);
      expect(Math.min(...first)).toBeLessThan(0.05);
      // a smooth curve through the points is a little longer than the polyline
      expect(Math.max(...first)).toBeGreaterThan(0.97 * L);
      expect(Math.max(...first)).toBeLessThan(1.15 * L);
    });
  });

  Scenario('The budding yeast mitochondrion is as thick as measured', ({ Given, Then }) => {
    let ans: Anatomy[] = [];
    Given('the budding yeast cell at every stage', () => { ans = stages('yeast'); });
    Then('its mitochondrial tubules are 0.34 micrometres across', () => {
      for (const a of ans) for (const t of tubulesOf(a, Mat.Mitochondrion)) expect(2 * t.radius * cellType('yeast').umPerUnit).toBeCloseTo(0.34, 2);
    });
  });

  Scenario('The yeast nuclear envelope carries the measured number of pores', ({ Given, Then }) => {
    Given('the table of organelle motions', () => undefined);
    Then('the pore pattern gives between 65 and 182 pores on a budding yeast nucleus', () => {
      const n = of(cellType('yeast').build(7, 2), Mat.Nucleus, Prim.Ellipsoid)[0];
      const r = Math.cbrt(n.b[0] * n.b[1] * n.b[2]);
      const count = poreCount(4 * Math.PI * r * r);
      expect(count).toBeGreaterThan(65);
      expect(count).toBeLessThan(182);
    });
  });

  ScenarioOutline('The Golgi is one ribbon of stacks of seven curved cisternae', ({ Given, Then, And }, v) => {
    let ct = cellType('fibroblast');
    let ans: Anatomy[] = [];
    const unit = (b: number[]) => { const l = Math.hypot(b[0], b[1], b[2]); return [b[0] / l, b[1] / l, b[2] / l]; };
    const cisternae = (a: Anatomy) => of(a, Mat.Golgi, Prim.Bowl);
    /** Cisternae grouped into stacks: those sharing an axis. */
    const stackOf = (a: Anatomy) => {
      const g = new Map<string, Primitive[]>();
      for (const c of cisternae(a)) { const k = unit(c.b).map((x) => x.toFixed(3)).join(); g.set(k, [...(g.get(k) ?? []), c]); }
      return [...g.values()];
    };
    Given('the <cell> cell at every stage', () => { ct = cellType(v.cell as CellTypeId); ans = (ct.stages ?? [null]).map((_, i) => ct.build(7, i)); });
    Then('its Golgi cisternae are curved sheets, hollow side toward the centrosome', () => {
      for (const a of ans) {
        const mtoc = of(a, Mat.Spindle)[0];
        expect(cisternae(a).length, `stage ${a.stage}`).toBeGreaterThanOrEqual(28);
        // every cisterna is part of a sphere centred on the centrosome
        for (const c of cisternae(a)) expect(Math.hypot(c.a[0] - mtoc.a[0], c.a[1] - mtoc.a[1], c.a[2] - mtoc.a[2]) * ct.umPerUnit).toBeLessThan(0.05);
      }
    });
    And('they form stacks of seven, each about 1 micrometre wide', () => {
      for (const a of ans) {
        const st = stackOf(a);
        expect(st.length, `stage ${a.stage}`).toBeGreaterThanOrEqual(4);
        for (const stack of st) {
          expect(stack).toHaveLength(7);
          expect(new Set(stack.map((c) => c.R.toFixed(4))).size).toBe(7);
          for (const c of stack) { const w = 2 * c.R * Math.hypot(...c.b) * ct.umPerUnit; expect(w).toBeGreaterThan(0.8); expect(w).toBeLessThan(1.4); }
        }
      }
    });
    And('neighbouring stacks meet at every level, so the ribbon is one piece', () => {
      for (const a of ans) {
        const st = stackOf(a), axes = st.map((s) => unit(s[0].b));
        // walk the ribbon: each stack must have a neighbour within the angle its narrowest cisterna spans
        const reached = new Set([0]);
        for (let grew = true; grew;) {
          grew = false;
          for (const i of [...reached]) for (let j = 0; j < st.length; j++) {
            if (reached.has(j)) continue;
            const angle = Math.acos(Math.min(1, axes[i][0] * axes[j][0] + axes[i][1] * axes[j][1] + axes[i][2] * axes[j][2]));
            const span = Math.min(...st[i].map((c) => Math.asin(Math.hypot(...c.b)))) + Math.min(...st[j].map((c) => Math.asin(Math.hypot(...c.b))));
            if (angle <= span) { reached.add(j); grew = true; }
          }
        }
        expect(reached.size, `stage ${a.stage}`).toBe(st.length);
      }
    });
  });

  Scenario('Rough ER wraps the nucleus of the animal cell in curved sheets', ({ Given, Then }) => {
    let an: Anatomy;
    Given('the animal cell', () => { an = cellType('animal').build(); });
    Then('its rough ER sheets are curved about the centre of the nucleus and lie outside it', () => {
      const nucleus = of(an, Mat.Nucleus)[0], er = of(an, Mat.ER, Prim.Bowl);
      expect(er.length).toBeGreaterThanOrEqual(5);
      for (const e of er) {
        expect(Math.hypot(e.a[0] - nucleus.a[0], e.a[1] - nucleus.a[1], e.a[2] - nucleus.a[2])).toBeLessThan(1e-6);
        expect(e.R - e.r).toBeGreaterThan(Math.max(...nucleus.b));
      }
    });
  });

  Scenario('Nissl bodies are stacks of flat cisternae', ({ Given, Then }) => {
    let ans: Anatomy[] = [];
    Given('the neuron cell at every stage', () => { ans = stages('neuron'); });
    Then('every Nissl body is a stack of three flat cisternae', () => {
      for (const a of ans) {
        const s = stacks(a, Mat.ER);
        expect(s.length, `stage ${a.stage}`).toBeGreaterThanOrEqual(3);
        for (const n of s) expect(n).toBe(3);
        expect(of(a, Mat.ER).length).toBe(3 * s.length);
      }
    });
  });

  Scenario('Mitochondria travel along the healthy axon in both directions', ({ Given, Then, And }) => {
    let ans: Anatomy[] = [];
    const tracks = (a: Anatomy) => a.tubules.filter((t) => t.motion === 'transport');
    Given('the neuron cell at every stage', () => { ans = stages('neuron'); });
    Then('the healthy axon has a track of moving mitochondria each way', () => {
      const t = tracks(ans[0]);
      expect(t).toHaveLength(2);
      for (const tr of t) {
        expect(tr.material).toBe(Mat.Mitochondrion);
        expect(tr.points[tr.points.length - 1][0] - tr.points[0][0]).toBeGreaterThan(5);
      }
    });
    And('a cut axon keeps its tracks inside the stump', () => {
      const reach = Math.max(...tracks(ans[0]).flatMap((t) => t.points.map((p) => p[0])));
      for (const a of ans.slice(1, 3)) {
        expect(tracks(a)).toHaveLength(2);
        expect(Math.max(...tracks(a).flatMap((t) => t.points.map((p) => p[0])))).toBeLessThan(reach - 3);
      }
    });
  });
});
