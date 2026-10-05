// The tip of a hypha of the mould Aspergillus nidulans: a tube that grows only at its apex,
// divided by septa that have a hole in the middle, with many nuclei in one compartment.
// The width (≈ 3 µm) is read off a published image with a scale bar (Taheri-Talesh et al. 2012,
// PLoS One 7:e31218, fig. 4); septal pore 50–500 nm, Woronin bodies as wide as the pore or wider
// and 100–200 nm from it (as summarised for filamentous fungi; not read in a primary source).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, samplePoint, union, wander } from './common';

const UM = 1;
const R = 1.5;
/** Where the drawn stretch of hypha starts and where the dome of the tip begins (µm). */
const BACK = -7.5, DOME = 6.2, TIP_R = 1.05;
const SEPTUM_X = -3.2;
/** Wall of chitin and glucans: of the order of 0.1 µm (typical value). */
const WALL = 0.1;
const PORE = 0.2;

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'aspergillus', stage: 0,
    body: [union(cone([BACK, 0, 0], [DOME, 0, 0], R, R)), union(cone([DOME, 0, 0], [DOME + 0.75, 0, 0], R, TIP_R), 0.25)],
    wallThickness: WALL, cortexDepth: 0.25,
    mesh: { minSpacing: 0.45, maxSpacing: 0.64, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  // The septum: a plate of wall grown inward, leaving a pore.
  o.push({ kind: Prim.Disc, material: Mat.Septum, a: [SEPTUM_X, 0, 0], b: [0.07, 0, 0], R: R - 0.02, r: PORE });
  // Woronin bodies, tethered close to the pore on both sides.
  for (const [dx, dy, dz] of [[0.32, 0.3, 0.1], [0.34, -0.22, -0.28], [-0.33, 0.12, 0.3]]) o.push(ell([SEPTUM_X + dx, dy, dz], [0.14, 0.14, 0.14], Mat.Peroxisome));
  // Spitzenkörper: the cluster of vesicles at the growing tip.
  o.push(ell([DOME + 0.75 + TIP_R - WALL - 0.42, 0, 0], [0.26, 0.3, 0.3], Mat.Golgi));
  // Nuclei, spaced along the tube: one behind the septum, four in the tip compartment.
  for (const [x, y, z] of [[-5.6, 0.1, -0.1], [-1.4, -0.12, 0.1], [0.9, 0.15, -0.12], [3.0, -0.1, 0.12], [4.9, 0.08, 0]]) {
    o.push(ell([x + 0.3, y + 0.25, z], [0.26, 0.24, 0.24], Mat.Nucleolus));
    o.push(ell([x, y, z], [0.95, 0.72, 0.72], Mat.Nucleus));
  }
  // Vacuoles: large behind the septum, small further forward, none at the tip.
  o.push(ell([-6.9, -0.05, 0.1], [0.5, 0.95, 0.95], Mat.Vacuole));
  o.push(ell([-4.2, 0.1, -0.05], [0.45, 0.9, 0.9], Mat.Vacuole));
  o.push(ell([-0.15, 0.35, -0.3], [0.32, 0.45, 0.45], Mat.Vacuole));
  // Mitochondria: tubes lying along the hypha, under the wall.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(WALL + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  const net = { organelles: o, tubules: an.tubules };
  for (let i = 0; i < 9; i++) {
    const start = samplePoint(rand, [SEPTUM_X + 0.5 + (i % 3) * 2.6, -R, -R], [SEPTUM_X + 3 + (i % 3) * 2.6, R, R], free(0.24));
    if (!start) continue;
    addTubule(net, wander(rand, start, [1, 0, 0], 5, 0.4, free(0.19)), 0.15, Mat.Mitochondrion);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number) => an.organelles.find((x) => x.material === m)!;
  const nuclei = an.organelles.filter((x) => x.material === Mat.Nucleus), mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!;
  const spk = first(Mat.Golgi), n = nuclei[3];
  return [
    { id: 'tip', name: 'Hyphal tip', anchor: [DOME + 0.2, 0.7, 0.5], size: 'hypha ≈ 3 µm wide',
      blurb: 'A hypha lengthens only here. New wall and membrane are delivered to the dome of the tip, and turgor pushes it forward; behind the tip the wall hardens and the tube keeps its width.' },
    { id: 'spk', name: 'Spitzenkörper', material: Mat.Golgi, anchor: spk.a, size: '≈ 0.5 µm',
      blurb: 'German for "tip body": a dense cluster of secretory vesicles held just behind the apex. Vesicles arrive along microtubules and actin and leave for the wall. Where the Spitzenkörper sits decides which way the hypha grows (Harris et al. 2005).' },
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [n.a[0] - 0.4, n.a[1] - 0.2, n.a[2] + 0.2], size: '≈ 2 µm',
      blurb: 'One of many. A hypha is not divided into one cell per nucleus: each compartment holds several, sharing one cytoplasm, and in the tip compartment they divide together.' },
    { id: 'septum', name: 'Septum', material: Mat.Septum, anchor: [SEPTUM_X, 0.85, 0], size: 'pore 50–500 nm',
      blurb: 'A cross-wall that grows inward like a closing iris and stops, leaving a pore. Cytoplasm, mitochondria and even nuclei can pass from one compartment to the next.' },
    { id: 'woronin', name: 'Woronin body', material: Mat.Peroxisome, anchor: first(Mat.Peroxisome).a, size: 'as wide as the pore or wider',
      blurb: 'A dense protein crystal made in a peroxisome and tethered 100–200 nm from the pore. If the hypha is torn, the rush of cytoplasm sweeps it into the pore and plugs it within seconds, so that one wound does not empty the whole mycelium.' },
    { id: 'vacuole', name: 'Vacuole', material: Mat.Vacuole, anchor: an.organelles.filter((x) => x.material === Mat.Vacuole)[1].a, size: '',
      blurb: 'Small near the tip, larger with distance from it: older parts of a hypha are mostly vacuole, which lets the fungus extend far with little new cytoplasm.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: mito.points[1], size: '≈ 0.3 µm thick',
      blurb: 'Long tubes lying along the hypha, most numerous just behind the tip, where growth uses the most energy.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [1.9, R - WALL / 2, 0], size: '≈ 0.1 µm',
      blurb: 'Chitin and glucans, not the cellulose of plants. It is the target of the echinocandin antifungal drugs, and one reason fungi can push through soil, wood and tissue.' },
  ];
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
    { material: Mat.Golgi, name: 'Spitzenkörper' }, { material: Mat.Vacuole, name: 'Vacuoles' },
    { material: Mat.Mitochondrion, name: 'Mitochondria' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Septum]: 4, [Mat.Mitochondrion]: 1.3 },
  camera: { dist: 36, yaw: -0.3, pitch: 0.6 },
  help: 'Grab the tip and bend the hypha, or cut through the septum to find its pore.',
  about: 'The last 15 µm of a hypha of the mould Aspergillus nidulans, drawn at 1 µm per unit. The hypha would run on for millimetres to the left; it is cut off behind the first septum. The width is read from a published micrograph; the pore and Woronin body sizes are the ranges given for filamentous fungi; the size, number and spacing of the nuclei and the wall thickness are typical values, not measurements. Microtubules, ER and the many small vesicles are not drawn.',
};
