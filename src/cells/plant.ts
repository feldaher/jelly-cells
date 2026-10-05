// A plant cell: a palisade mesophyll cell of a leaf, a walled column whose cytoplasm is a thin
// layer, lined with chloroplasts, around one large vacuole. Sizes are typical textbook values
// except the chloroplast number (Pyke & Leech 1991, 1992: about 80–120 per Arabidopsis mesophyll cell).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, samplePoint, union, wander } from './common';

const UM = 6;
const u = (um: number) => um / UM;

/** The column: 20 µm wide and 52 µm long, rounded at both ends. */
const R = u(10), HALF = u(16);
/** Primary wall 0.1–0.3 µm; drawn 0.6 µm so that it shows. */
const WALL = u(0.6);
/** Chloroplasts: discs 5 µm across and 1.6 µm thick (real ones are lens-shaped, 2–3 µm thick at the middle). */
const CHLOROPLAST = { R: u(2.5), half: u(0.8) };
/** Vacuole: fills the column except for a layer under the wall and the end where the nucleus sits. */
const VACUOLE = { r: R - WALL - 2 * CHLOROPLAST.half - 0.07, from: -HALF - 0.15, to: HALF - 1.25 };

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'plant', stage: 0, body: [union(cone([-HALF, 0, 0], [HALF, 0, 0], R, R))],
    wallThickness: WALL, cortexDepth: 0.25,
    mesh: { minSpacing: 0.4, maxSpacing: 0.52, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  const nucleus: Vec3 = [HALF + 0.75, -0.1, 0.1];

  o.push(ell([nucleus[0] + 0.15, nucleus[1] + 0.12, nucleus[2]], [u(1), u(0.9), u(0.9)], Mat.Nucleolus));
  o.push(ell(nucleus, [u(3.3), u(3.1), u(3.1)], Mat.Nucleus));

  // Chloroplasts: flat against the wall, in rings along the column, each ring turned from the last.
  const rho = R - WALL - CHLOROPLAST.half - 0.035;
  const rings = 6, perRing = 8;
  for (let i = 0; i < rings; i++) {
    const x = -HALF + 0.25 + (i * (HALF * 2 - 1.5)) / (rings - 1);
    for (let k = 0; k < perRing; k++) {
      const t = ((k + 0.5 * (i % 2)) / perRing) * 2 * Math.PI + (rand() - 0.5) * 0.05;
      o.push({ kind: Prim.Disc, material: Mat.Chloroplast, a: [x + (rand() - 0.5) * 0.06, rho * Math.cos(t), rho * Math.sin(t)], b: [0, CHLOROPLAST.half * Math.cos(t), CHLOROPLAST.half * Math.sin(t)], R: CHLOROPLAST.R, r: 0 });
    }
  }

  // The central vacuole.
  o.push({ kind: Prim.Capsule, material: Mat.Vacuole, a: [VACUOLE.from, 0, 0], b: [VACUOLE.to, 0, 0], R: 0, r: VACUOLE.r });

  // The rest of the organelles share the cytoplasm at the nuclear end.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(WALL + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  const lo: Vec3 = [VACUOLE.to + 0.2, -R, -R], hi: Vec3 = [HALF + R, R, R];
  // Rough ER beside the nucleus.
  for (let i = 0; i < 3; i++) o.push({ kind: Prim.Disc, material: Mat.ER, a: [nucleus[0], nucleus[1] + u(3.1) + 0.09 + 0.07 * i, nucleus[2]], b: [0, 0.018, 0], R: 0.42 - 0.05 * i, r: 0 });
  // Golgi stacks (dictyosomes): many small separate stacks of 5–8 cisternae; three drawn.
  for (let s = 0; s < 3; s++) {
    const g = samplePoint(rand, lo, hi, free(0.24));
    if (g) for (let i = 0; i < 5; i++) o.push({ kind: Prim.Disc, material: Mat.Golgi, a: [g[0], g[1] + (i - 2) * 0.03, g[2]], b: [0, 0.009, 0], R: u(0.5), r: 0 });
  }
  const net = { organelles: o, tubules: an.tubules };
  for (let i = 0; i < 9; i++) {
    const start = samplePoint(rand, lo, hi, free(0.14));
    if (!start) continue;
    addTubule(net, wander(rand, start, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 2, 0.16, free(0.1)), u(0.4), Mat.Mitochondrion);
  }
  const scatter = (count: number, r: number, material: Primitive['material']) => {
    for (let i = 0; i < count; i++) { const c = samplePoint(rand, lo, hi, free(r + 0.04)); if (c) o.push(ell(c, [r, r, r], material)); }
  };
  scatter(6, u(0.45), Mat.Peroxisome);
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number) => an.organelles.find((x) => x.material === m)!;
  const mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!;
  return [
    { id: 'chloroplast', name: 'Chloroplast', material: Mat.Chloroplast, anchor: first(Mat.Chloroplast).a, size: '≈ 5 µm across, 2–3 µm thick',
      blurb: 'Where light is turned into sugar. Inside its double envelope, stacks of thylakoid membranes carry the chlorophyll. An Arabidopsis mesophyll cell holds about 80 to 120 (Pyke & Leech 1991, 1992); 48 are drawn. Like mitochondria they descend from bacteria and keep a small genome of their own.' },
    { id: 'vacuole', name: 'Central vacuole', material: Mat.Vacuole, anchor: [0, 0, 0], size: 'most of the cell',
      blurb: 'One membrane (the tonoplast) around water, ions, sugars and waste. In a mature cell it can take up nine tenths of the volume, pressing the cytoplasm into a thin layer against the wall; it is drawn smaller here to leave room for the nucleus. Its pressure against the wall, turgor, is what keeps a leaf stiff.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [0, R - WALL / 2, 0], size: '0.1–0.3 µm, drawn thicker',
      blurb: 'Cellulose fibres in a gel of pectin and hemicellulose, outside the plasma membrane. It lets the cell hold several atmospheres of turgor. Neighbouring cells are joined through it by plasmodesmata, channels about 50 nm wide (not drawn).' },
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [first(Mat.Nucleus).a[0] - 0.25, first(Mat.Nucleus).a[1] - 0.2, first(Mat.Nucleus).a[2] + 0.2], size: '≈ 6–7 µm',
      blurb: 'Pushed to the side by the vacuole. Its genome works with two others in the same cell: the chloroplast\'s and the mitochondrion\'s.' },
    { id: 'rer', name: 'Rough ER', material: Mat.ER, anchor: first(Mat.ER).a, size: 'sheets ≈ 50 nm thick, drawn thicker',
      blurb: 'Ribosome-studded sheets continuous with the nuclear envelope. In plants the ER also runs through the plasmodesmata from one cell into the next.' },
    { id: 'golgi', name: 'Golgi stack', material: Mat.Golgi, anchor: first(Mat.Golgi).a, size: '≈ 1 µm across',
      blurb: 'Plant cells have no single Golgi apparatus: dozens to hundreds of small stacks travel separately along actin filaments. They make the pectin and hemicellulose of the wall. Three are drawn.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: mito.points[0], size: '≈ 0.5–1 µm',
      blurb: 'Plant cells respire as well as photosynthesise: mitochondria supply ATP in the dark and to everything the chloroplasts do not feed.' },
    { id: 'peroxisome', name: 'Peroxisome', material: Mat.Peroxisome, anchor: first(Mat.Peroxisome).a, size: '0.5–1.5 µm',
      blurb: 'In a leaf they sit against the chloroplasts and recycle the product of photorespiration, the reaction in which the enzyme Rubisco takes up oxygen instead of carbon dioxide.' },
    { id: 'column', name: 'Palisade cell', anchor: [-HALF, -0.7, 0.6], size: '≈ 20 × 50 µm',
      blurb: 'The cells of the upper layer of a leaf stand side by side like columns, long axis toward the light. This one lies on its side.' },
  ];
}

export const plant: CellType = {
  id: 'plant',
  name: 'Plant cell',
  title: ['Plant', 'Cell.'],
  tagline: ['A wall, a vacuole,', 'and a lining', 'of chloroplasts.'],
  umPerUnit: UM,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Cell wall' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Chloroplast, name: 'Chloroplasts' }, { material: Mat.Vacuole, name: 'Central vacuole' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.ER, name: 'Rough ER' }, { material: Mat.Golgi, name: 'Golgi stacks' },
    { material: Mat.Mitochondrion, name: 'Mitochondria' }, { material: Mat.Peroxisome, name: 'Peroxisomes' },
  ],
  stiffness: { [Mat.Wall]: 5, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Chloroplast]: 1.5 },
  camera: { dist: 26, yaw: -0.5, pitch: 0.6 },
  help: 'Grab an end and bend the column, or cut across it to see the chloroplasts ringing the vacuole.',
  about: 'A palisade mesophyll cell from the upper layer of a leaf, lying on its side, drawn at 6 µm per unit: about 20 µm wide and 50 µm long. The chloroplast number per cell is measured (80–120 in Arabidopsis; 48 drawn). The other sizes are typical textbook values. The vacuole is drawn smaller than in a mature cell, the wall thicker, and plasmodesmata, the cytoskeleton and smooth ER are left out.',
};
