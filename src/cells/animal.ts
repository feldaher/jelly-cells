// A generic animal cell: the textbook composite, drawn with the proportions of a cultured
// human cell rounded up at confluence (≈ 20 µm across, Milo & Phillips, Cell Biology by the
// Numbers, BNID 103718 ff.). No wall, no chloroplasts, no large vacuole.
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, ell, finish, samplePoint, union, wander } from './common';

const UM = 3;
const u = (um: number) => um / UM;

/** Half-axes of the cell (µm): 20 µm across, a little flattened where it rests. */
const RADII: Vec3 = [u(10), u(8), u(10)];
/** Nucleus 8 µm across: nuclei are typically 2–10 µm, about 10 µm in a fibroblast (same source). */
const NUCLEUS_R = u(4);
/** The plasma membrane is 4–5 nm thick; drawn 0.15 µm so that it shows at all. */
const MEMBRANE = u(0.15);

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'animal', stage: 0, body: [union(ell([0, 0, 0], RADII))],
    wallThickness: MEMBRANE, cortexDepth: 0.25,
    mesh: { minSpacing: 0.45, maxSpacing: 0.64, minParticles: 120, skinGrid: 0.11 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  const nucleus: Vec3 = [0.35, 0.1, 0];

  // Nucleolus, then the nucleus that holds it.
  o.push(ell([nucleus[0] + 0.4, nucleus[1] + 0.25, 0.15], [u(1.1), u(1), u(1)], Mat.Nucleolus));
  o.push(ell(nucleus, [NUCLEUS_R, NUCLEUS_R * 0.94, NUCLEUS_R], Mat.Nucleus));

  // Rough ER: stacked flat cisternae on one side of the nucleus, continuous with its envelope in a real cell.
  for (let i = 0; i < 5; i++) o.push({ kind: Prim.Disc, material: Mat.ER, a: [nucleus[0] + NUCLEUS_R + 0.16 + 0.13 * i, nucleus[1], 0], b: [0.028, 0, 0], R: 1.05 - 0.09 * i, r: 0 });
  for (let i = 0; i < 3; i++) o.push({ kind: Prim.Disc, material: Mat.ER, a: [nucleus[0], nucleus[1], -(NUCLEUS_R + 0.16 + 0.13 * i)], b: [0, 0, 0.028], R: 0.9 - 0.1 * i, r: 0 });

  // Centrosome (two centrioles) and the Golgi gathered around it, on the other side of the nucleus.
  const mtoc: Vec3 = [nucleus[0] - NUCLEUS_R - 0.3, nucleus[1] + 0.25, 0.25];
  o.push(ell(mtoc, [0.08, 0.08, 0.08], Mat.Spindle));
  o.push(ell([mtoc[0] + 0.05, mtoc[1] - 0.17, mtoc[2] + 0.05], [0.08, 0.08, 0.08], Mat.Spindle));
  // stacks of about seven cisternae (Ladinsky et al. 1999), each about 1 µm across
  for (const g of [[mtoc[0] - 0.55, mtoc[1] - 0.1, mtoc[2] - 0.3], [mtoc[0] - 0.3, mtoc[1] - 0.25, mtoc[2] + 0.75], [mtoc[0] - 0.35, mtoc[1] - 0.3, mtoc[2] - 1.05]] as Vec3[])
    for (let i = 0; i < 7; i++) o.push({ kind: Prim.Disc, material: Mat.Golgi, a: [g[0], g[1] + (i - 3) * 0.045, g[2]], b: [0, 0.014, 0], R: u(0.55), r: 0 });

  // Everything else is scattered through the free cytoplasm.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(MEMBRANE + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  const lo: Vec3 = [-RADII[0], -RADII[1], -RADII[2]];
  // Mitochondria: tubes about 0.7 µm thick and a few µm long.
  const net = { organelles: o, tubules: an.tubules };
  for (let i = 0; i < 16; i++) {
    const start = samplePoint(rand, lo, RADII, free(0.3));
    if (!start) continue;
    const pts = wander(rand, start, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 3 + Math.floor(rand() * 3), 0.34, free(0.22));
    addTubule(net, pts, u(0.35), Mat.Mitochondrion);
  }
  // Lysosomes (0.1–1.2 µm; drawn 0.8) and peroxisomes (0.1–1 µm; drawn 0.5).
  const scatter = (count: number, r: number, material: Primitive['material']) => {
    for (let i = 0; i < count; i++) { const c = samplePoint(rand, lo, RADII, free(r + 0.06)); if (c) o.push(ell(c, [r, r, r], material)); }
  };
  scatter(12, u(0.4), Mat.Lysosome);
  scatter(10, u(0.25), Mat.Peroxisome);
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number, kind?: number) => an.organelles.find((x) => x.material === m && (kind === undefined || x.kind === kind))!;
  const nucleus = first(Mat.Nucleus), mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!;
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nucleus.a[0] - 0.7, nucleus.a[1] - 0.2, nucleus.a[2] + 0.5], size: '≈ 8 µm across',
      blurb: 'Holds the genome, about 2 m of DNA in a human cell, behind a double membrane pierced by a few thousand pores. Nuclei of animal cells are typically 2–10 µm across.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: first(Mat.Nucleolus).a, size: '≈ 2 µm',
      blurb: 'Where ribosomal RNA is made and ribosome subunits are put together. It has no membrane: it is a condensate that forms around the ribosomal genes.' },
    { id: 'rer', name: 'Rough ER', material: Mat.ER, anchor: first(Mat.ER).a, size: 'sheets ≈ 50 nm thick, drawn thicker',
      blurb: 'Flat sacs studded with ribosomes, continuous with the nuclear envelope. Proteins bound for membranes or for export are made into it. The ER holds up to 60 % of all the membrane in the cell (Milo & Phillips).' },
    { id: 'golgi', name: 'Golgi apparatus', material: Mat.Golgi, anchor: first(Mat.Golgi).a, size: 'stacks ≈ 1 µm across',
      blurb: 'Stacks of about seven flat cisternae (Ladinsky et al. 1999) that modify, sort and ship what the ER makes. In animal cells the stacks gather beside the centrosome.' },
    { id: 'centrosome', name: 'Centrosome', material: Mat.Spindle, anchor: first(Mat.Spindle).a, size: 'centrioles ≈ 0.25 × 0.5 µm',
      blurb: 'Two centrioles at right angles, from which the microtubules radiate. Plant and fungal cells have none.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: mito.points[1], size: '≈ 0.5–1 µm thick',
      blurb: 'Where most ATP is made. They are tubes that fuse and divide all the time, often a connected network, not separate beans; a mammalian cell has of the order of 1 000 by the usual count (Milo & Phillips). Sixteen are drawn.' },
    { id: 'lysosome', name: 'Lysosome', material: Mat.Lysosome, anchor: first(Mat.Lysosome).a, size: '0.1–1.2 µm',
      blurb: 'An acidic bag of digestive enzymes (pH about 4.5–5) that breaks down what the cell takes in and what it no longer needs.' },
    { id: 'peroxisome', name: 'Peroxisome', material: Mat.Peroxisome, anchor: first(Mat.Peroxisome).a, size: '0.1–1 µm',
      blurb: 'Breaks down very long fatty acids and detoxifies, making hydrogen peroxide and destroying it again with catalase.' },
    { id: 'membrane', name: 'Plasma membrane', material: Mat.Wall, anchor: [0, RADII[1] - MEMBRANE / 2, 0], size: '4–5 nm thick, drawn thicker',
      blurb: 'A lipid bilayer and its proteins, and nothing else: an animal cell has no wall. Its shape is held by the cytoskeleton beneath, which is why it can crawl, engulf and change shape.' },
  ];
}

export const animal: CellType = {
  id: 'animal',
  name: 'Animal cell',
  title: ['Animal', 'Cell.'],
  tagline: ['No wall, no chloroplasts.', 'A nucleus, and a membrane', 'for every job.'],
  umPerUnit: UM,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Plasma membrane' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.ER, name: 'Rough ER' }, { material: Mat.Golgi, name: 'Golgi apparatus' },
    { material: Mat.Spindle, name: 'Centrosome' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Lysosome, name: 'Lysosomes' }, { material: Mat.Peroxisome, name: 'Peroxisomes' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Mitochondrion]: 1.3 },
  camera: { dist: 24, yaw: -0.42, pitch: 0.6 },
  help: 'Grab it anywhere and pull: with no wall it is the softest specimen here.',
  about: 'The textbook animal cell, a composite of no one cell type, drawn at 3 µm per unit with the size of a cultured human cell rounded up among its neighbours (≈ 20 µm). Organelle sizes are typical values; the numbers of mitochondria, lysosomes and peroxisomes drawn are far below the real ones. Smooth ER, endosomes, ribosomes and the cytoskeleton are not drawn.',
};
