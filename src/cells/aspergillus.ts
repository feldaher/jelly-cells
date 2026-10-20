// The tip of a hypha of the mould Aspergillus nidulans: a tube that grows only at its apex,
// divided by septa that have a hole in the middle, with many nuclei in one compartment
// (about 60 µm³ of cytoplasm per nucleus: Fiddy & Trinci 1976).
// The width (≈ 3 µm) is read off a published image with a scale bar (Taheri-Talesh et al. 2012,
// PLoS One 7:e31218, fig. 4); septal pore 50–500 nm, Woronin bodies as wide as the pore or wider
// and 100–200 nm from it (as summarised for filamentous fungi; not read in a primary source).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, anchorIn, cone, ell, finish, samplePoint, union, wander } from './common';

const UM = 1.25;
const u = (um: number) => um / UM;

export const HYPHA = {
  /** Width of the hypha, µm: read against the scale bar of Taheri-Talesh et al. 2012, fig. 4H. */
  width: 3,
  /** Cytoplasm per haploid nucleus, µm³ (Fiddy & Trinci 1976, J Gen Microbiol 97:169). */
  volumePerNucleus: 60,
  /** Drawn: from 12 µm behind the middle to the tip, with the last septum 5 µm from the cut end. */
  back: -12, tip: 12, septum: -7,
  /** Septal pore 50–500 nm (range given for filamentous fungi); drawn 0.4 µm. */
  pore: 0.4,
  /** Wall of chitin and glucans: of the order of 0.1 µm (typical value). */
  wall: 0.1,
} as const;

const R = u(HYPHA.width / 2), TIP_R = u(1.05);
const BACK = u(HYPHA.back), DOME = u(HYPHA.tip - 1.05 - 0.75), SEPTUM_X = u(HYPHA.septum);
const WALL = u(HYPHA.wall);
/** Nuclei of the tip compartment (µm along the hypha): two, as its volume divided by 60 µm³ gives. One more behind the septum. */
const NUCLEI_UM = [-10.3, -2.2, 5.2];

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'aspergillus', stage: 0,
    body: [union(cone([BACK, 0, 0], [DOME, 0, 0], R, R)), union(cone([DOME, 0, 0], [DOME + u(0.75), 0, 0], R, TIP_R), 0.25)],
    wallThickness: WALL, cortexDepth: 0.25,
    mesh: { minSpacing: 0.45, maxSpacing: 0.62, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  // The septum: a plate of wall grown inward, leaving a pore.
  o.push({ kind: Prim.Disc, material: Mat.Septum, a: [SEPTUM_X, 0, 0], b: [u(0.07), 0, 0], R: R - 0.02, r: u(HYPHA.pore / 2) });
  // Woronin bodies, tethered close to the pore on both sides.
  for (const [dx, dy, dz] of [[0.32, 0.3, 0.1], [0.34, -0.22, -0.28], [-0.33, 0.12, 0.3]]) o.push(ell([SEPTUM_X + u(dx), u(dy), u(dz)], [u(0.14), u(0.14), u(0.14)], Mat.Peroxisome));
  // Spitzenkörper: the cluster of vesicles at the growing tip.
  const tipX = DOME + u(0.75) + TIP_R;
  o.push(ell([tipX - WALL - u(0.42), 0, 0], [u(0.26), u(0.3), u(0.3)], Mat.Vesicle));
  // Nuclei.
  for (const x of NUCLEI_UM) {
    o.push(ell([u(x + 0.3), u(0.25), 0], [u(0.26), u(0.24), u(0.24)], Mat.Nucleolus));
    o.push(ell([u(x), u(0.05), 0], [u(0.95), u(0.72), u(0.72)], Mat.Nucleus));
  }
  // Vacuoles: large behind the septum, smaller further forward, none near the tip.
  o.push(ell([u(-8.4), u(-0.05), u(0.1)], [u(0.55), u(0.95), u(0.95)], Mat.Vacuole));
  o.push(ell([u(-5.4), u(0.1), u(-0.05)], [u(0.6), u(0.9), u(0.9)], Mat.Vacuole));
  o.push(ell([u(0.6), u(0.35), u(-0.3)], [u(0.4), u(0.5), u(0.5)], Mat.Vacuole));
  // Golgi equivalents: single ring-shaped and fenestrated cisternae, not stacks, more and more of
  // them toward the tip but none in the apical dome (Pantazopoulou & Peñalva 2009, Mol Biol Cell
  // 20:4335). Their size (0.5 µm) and number are a drawing.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(WALL + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  for (const [x0, x1, count] of [[-6, 1, 2], [1, 6, 3], [6.5, 10.2, 6]]) {
    for (let i = 0; i < count; i++) {
      const c = samplePoint(rand, [u(x0), -R, -R], [u(x1), R, R], free(u(0.32)));
      if (!c) continue;
      const t = rand() * Math.PI * 2, tilt = (rand() - 0.5) * 0.8;
      o.push({ kind: Prim.Torus, material: Mat.Golgi, a: c, b: [Math.sin(tilt), Math.cos(tilt) * Math.cos(t), Math.cos(tilt) * Math.sin(t)], R: u(0.2), r: u(0.055) });
    }
  }
  const net = { organelles: o, tubules: an.tubules };
  // Microtubules: long tubes running the length of the hypha to the tip (25 nm, drawn 0.1 µm).
  // Hyphal tip cells grow ten times slower without them (Horio & Oakley 2005, Mol Biol Cell 16:918).
  for (const t of [0.5, 2.6, 4.7]) {
    const y = u(1.1) * Math.cos(t), z = u(1.1) * Math.sin(t), x0 = SEPTUM_X + u(0.5), x1 = tipX - u(1.3);
    addTubule(net, [0, 0.25, 0.5, 0.75, 1].map((f) => [x0 + (x1 - x0) * f, y * (f > 0.9 ? 0.6 : 1), z * (f > 0.9 ? 0.6 : 1)] as Vec3), u(0.05), Mat.Spindle);
  }
  // Mitochondria: tubes lying along the hypha.
  for (let i = 0; i < 9; i++) {
    const start = samplePoint(rand, [SEPTUM_X + u(0.5 + (i % 3) * 5), -R, -R], [SEPTUM_X + u(5 + (i % 3) * 5), R, R], free(u(0.24)));
    if (!start) continue;
    addTubule(net, wander(rand, start, [1, 0, 0], 5, u(0.5), free(u(0.19))), u(0.15), Mat.Mitochondrion);
  }
  // ER: the nuclear envelopes plus strands through the cytoplasm (drawn 0.12 µm thick).
  for (let i = 0; i < 4; i++) {
    const start = samplePoint(rand, [SEPTUM_X + u(1 + i * 4), -R, -R], [SEPTUM_X + u(4 + i * 4), R, R], free(u(0.1)));
    if (start) addTubule(net, wander(rand, start, [1, 0, 0], 6, u(0.45), free(u(0.08))), u(0.06), Mat.ER);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number) => an.organelles.find((x) => x.material === m)!;
  const nuclei = an.organelles.filter((x) => x.material === Mat.Nucleus);
  const tubes = (m: number) => an.tubules.filter((t) => t.material === m);
  const spk = first(Mat.Vesicle), n = nuclei[2];
  return [
    { id: 'tip', name: 'Hyphal tip', anchor: [DOME + u(0.2), u(0.7), u(0.5)], size: 'hypha ≈ 3 µm wide',
      blurb: 'A hypha lengthens only here. New wall and membrane are delivered to the dome of the tip, and turgor pushes it forward; behind the tip the wall hardens and the tube keeps its width.' },
    { id: 'spk', name: 'Spitzenkörper', material: Mat.Vesicle, anchor: spk.a, size: '≈ 0.5 µm',
      blurb: 'German for "tip body": a dense cluster of secretory vesicles held just behind the apex. Vesicles arrive along microtubules and actin and leave for the wall. Where the Spitzenkörper sits decides which way the hypha grows (Harris et al. 2005).' },
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [n.a[0] - u(0.4), n.a[1] - u(0.2), n.a[2] + u(0.2)], size: '≈ 2 µm',
      blurb: 'One of many. A hypha is not divided into one cell per nucleus: each compartment holds several, sharing one cytoplasm, about 60 µm³ of it per nucleus (Fiddy & Trinci 1976), which in a hypha this wide is one nucleus every 8 µm or so. A real tip compartment is longer than the stretch drawn and holds many more.' },
    { id: 'septum', name: 'Septum', material: Mat.Septum, anchor: [SEPTUM_X, u(0.85), 0], size: 'pore 50–500 nm',
      blurb: 'A cross-wall that grows inward like a closing iris and stops, leaving a pore. Cytoplasm, mitochondria and even nuclei can pass from one compartment to the next.' },
    { id: 'woronin', name: 'Woronin body', material: Mat.Peroxisome, anchor: first(Mat.Peroxisome).a, size: 'as wide as the pore or wider',
      blurb: 'A dense protein crystal made in a peroxisome and tethered 100–200 nm from the pore. If the hypha is torn, the rush of cytoplasm sweeps it into the pore and plugs it within seconds, so that one wound does not empty the whole mycelium.' },
    { id: 'golgi', name: 'Golgi equivalent', material: Mat.Golgi, anchor: (() => { const g = an.organelles.filter((x) => x.material === Mat.Golgi); const t = g[g.length - 1]; const [e1] = perpendicular(t.b); return [t.a[0] + e1[0] * t.R, t.a[1] + e1[1] * t.R, t.a[2] + e1[2] * t.R] as Vec3; })(), size: 'drawn ≈ 0.5 µm rings',
      blurb: 'Filamentous fungi have no Golgi stacks. Their Golgi is a network of single cisternae, many of them ring-shaped or pierced by holes, which crowds toward the growing tip but stays out of the dome at the very end (Pantazopoulou & Peñalva 2009). The size and number of rings drawn are not measured values.' },
    { id: 'mt', name: 'Microtubule', material: Mat.Spindle, anchor: anchorIn(an, tubes(Mat.Spindle).map((t) => t.points[2]), Mat.Spindle), size: '25 nm thick, drawn thicker',
      blurb: 'Long microtubules run the length of the hypha with their growing ends at the tip. Vesicles and nuclei travel along them. Without them the tip still grows, but ten times more slowly (Horio & Oakley 2005).' },
    { id: 'vacuole', name: 'Vacuole', material: Mat.Vacuole, anchor: an.organelles.filter((x) => x.material === Mat.Vacuole)[1].a, size: '',
      blurb: 'Small near the tip, larger with distance from it: older parts of a hypha are mostly vacuole, which lets the fungus extend far with little new cytoplasm.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: anchorIn(an, tubes(Mat.Mitochondrion).map((t) => t.points[1]), Mat.Mitochondrion), size: '≈ 0.3 µm thick',
      blurb: 'Long tubes lying along the hypha, most numerous just behind the tip, where growth uses the most energy.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [u(1.9), R - WALL / 2, 0], size: '≈ 0.1 µm',
      blurb: 'Chitin and glucans, not the cellulose of plants. It is the target of the echinocandin antifungal drugs, and one reason fungi can push through soil, wood and tissue.' },
  ];
}

/** Two unit vectors perpendicular to `n` and to each other. */
function perpendicular(n: Vec3): [Vec3, Vec3] {
  const t: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const e1 = c(n, t), l = Math.hypot(...e1), e: Vec3 = [e1[0] / l, e1[1] / l, e1[2] / l];
  return [e, c(n, e)];
}

export const aspergillus: CellType = {
  id: 'aspergillus',
  name: 'Aspergillus hypha',
  title: ['Aspergillus', 'Hypha.'],
  tagline: ['A tube that grows', 'at one end,', 'with nuclei to share.'],
  umPerUnit: UM,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Cell wall' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nuclei' }, { material: Mat.Nucleolus, name: 'Nucleoli' },
    { material: Mat.Septum, name: 'Septum' }, { material: Mat.Peroxisome, name: 'Woronin bodies' },
    { material: Mat.Vesicle, name: 'Spitzenkörper' }, { material: Mat.Golgi, name: 'Golgi equivalents' },
    { material: Mat.Vacuole, name: 'Vacuoles' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Spindle, name: 'Microtubules' }, { material: Mat.ER, name: 'ER' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Septum]: 4, [Mat.Mitochondrion]: 1.3 },
  camera: { dist: 40, yaw: -0.3, pitch: 0.6 },
  help: 'Grab the tip and bend the hypha, or cut through the septum to find its pore.',
  about: 'The last 24 µm of a hypha of the mould Aspergillus nidulans, drawn at 1.25 µm per unit. A real tip compartment is longer, and the septum is drawn close to the tip so that it fits. The width is read from a published micrograph, and the spacing of the nuclei follows the measured 60 µm³ of cytoplasm per nucleus (Fiddy & Trinci 1976). The pore and Woronin body sizes are the ranges given for filamentous fungi; the size of the nuclei and the wall thickness are typical values.',
};
