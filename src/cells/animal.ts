// A generic animal cell: the textbook composite, drawn with the proportions of a cultured
// human cell rounded up at confluence (≈ 20 µm across, Milo & Phillips, Cell Biology by the
// Numbers, BNID 103718 ff.). No wall, no chloroplasts, no large vacuole.
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, anchorIn, bowl, bowlMid, ell, finish, golgiRibbon, norm3, ray, samplePoint, union, wander } from './common';

const UM = 3;
const u = (um: number) => um / UM;

/** Half-axes of the cell (µm): 20 µm across, a little flattened where it rests. */
const RADII: Vec3 = [u(10), u(8), u(10)];
/** Nucleus 8 µm across: nuclei are typically 2–10 µm, about 10 µm in a fibroblast (same source). */
const NUCLEUS_R = u(4);
/** The plasma membrane is 4–5 nm thick; drawn 0.15 µm so that it shows at all. */
const MEMBRANE = u(0.15);
/**
 * Rough ER sheets (sim units): the first lies just off the nuclear envelope. Real sheets are about
 * 50 nm thick and, where stacked, 100 nm or so apart; drawn 120 nm thick and 300 nm apart.
 */
const ER = { gap: 0.13, spacing: 0.1, half: 0.02 };
/**
 * The Golgi ribbon (µm). Seven cisternae per stack, each stack about 1 µm wide and deep
 * (Ladinsky et al. 1999). Measured on the label card's micrograph, seven cisternae take up about
 * 0.3 µm; they are drawn twice as far apart so that they can be told apart. The radius at which
 * the ribbon curls around the centrosome, and the number of stacks drawn, are ours.
 */
export const GOLGI = { innerUm: 1.9, spacingUm: 0.09, halfThicknessUm: 0.025, widthUm: 1.1, stacks: 7, vesicleUm: 0.16 };

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

  // Rough ER: sheets curved around the nucleus, with whose envelope they are continuous. In
  // secretory cells they are stacked like this, about 50 nm thick, and joined level to level by
  // spiral ramps (Terasaki et al. 2013, Cell 154:285); the ramps are not drawn.
  for (let i = 0; i < 4; i++) o.push(bowl(nucleus, [1, 0.15, 0.2], NUCLEUS_R + ER.gap + i * ER.spacing, 2 * (NUCLEUS_R + ER.gap + i * ER.spacing) * (0.82 - 0.07 * i), ER.half, Mat.ER));
  for (let i = 0; i < 3; i++) o.push(bowl(nucleus, [-0.25, -0.35, -1], NUCLEUS_R + ER.gap + i * ER.spacing, 2 * (NUCLEUS_R + ER.gap + i * ER.spacing) * (0.6 - 0.08 * i), ER.half, Mat.ER));

  // Centrosome: two centrioles at right angles (drawn as two dots), beside the nucleus.
  const mtoc: Vec3 = [nucleus[0] - NUCLEUS_R - 0.34, nucleus[1] + 0.2, 0.25];
  o.push(ell(mtoc, [0.07, 0.07, 0.07], Mat.Spindle));
  o.push(ell([mtoc[0] + 0.06, mtoc[1] - 0.15, mtoc[2] + 0.05], [0.07, 0.07, 0.07], Mat.Spindle));
  // Golgi: one ribbon curled around the centrosome, on the side away from the nucleus.
  const ribbon = golgiRibbon(mtoc, [-1, 0.1, 0.15], [0.15, 1, 0.25], { inner: u(GOLGI.innerUm), spacing: u(GOLGI.spacingUm), halfThickness: u(GOLGI.halfThicknessUm), width: u(GOLGI.widthUm), stacks: GOLGI.stacks });
  o.push(...ribbon);
  // Vesicles around the ribbon: there are hundreds within 0.2 µm of the cisternae (Ladinsky et al. 1999); a few are drawn.
  for (let i = 0; i < 16; i++) {
    const c = ribbon[Math.floor(rand() * ribbon.length)], mid = bowlMid(c), out = rand() < 0.5 ? -1 : 1;
    const r = out < 0 ? u(GOLGI.innerUm) - 0.07 - rand() * 0.06 : u(GOLGI.innerUm) + 6 * u(GOLGI.spacingUm) + 0.07 + rand() * 0.06;
    const d = norm3([mid[0] - mtoc[0] + (rand() - 0.5) * 0.25, mid[1] - mtoc[1] + (rand() - 0.5) * 0.35, mid[2] - mtoc[2] + (rand() - 0.5) * 0.25]);
    o.push(ell([mtoc[0] + d[0] * r, mtoc[1] + d[1] * r, mtoc[2] + d[2] * r], [u(GOLGI.vesicleUm / 2), u(GOLGI.vesicleUm / 2), u(GOLGI.vesicleUm / 2)], Mat.Golgi));
  }

  // Everything else is scattered through the free cytoplasm.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(MEMBRANE + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  const lo: Vec3 = [-RADII[0], -RADII[1], -RADII[2]];
  // Mitochondria: tubes about 0.7 µm thick and a few µm long.
  const net = { organelles: o, tubules: an.tubules };
  for (let i = 0; i < 30; i++) {
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
  // Endosomes: sorting stations for what the cell takes in, 0.1–0.5 µm (typical values).
  scatter(10, u(0.22), Mat.Vesicle);

  // Smooth ER: a network of tubules continuous with the sheets, reaching out to the cell edge.
  // Real tubules are about 50 nm thick; drawn 0.2 µm. A dozen stretches stand for the network.
  for (let i = 0; i < 12; i++) {
    const start = samplePoint(rand, lo, RADII, free(0.12));
    if (start) addTubule(net, wander(rand, start, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 6, 0.3, free(0.1)), u(0.1), Mat.ER);
  }
  // Microtubules: 25 nm tubes radiating from the centrosome to the cell edge (drawn 0.15 µm thick).
  // They may pass close by other organelles, which travel along them, but not through the nucleus.
  const nucleusPrim = o.find((q) => q.material === Mat.Nucleus)!;
  for (let i = 0; i < 16; i++) {
    const y = 1 - (2 * (i + 0.5)) / 16, rad = Math.sqrt(1 - y * y), t = i * 2.39996;
    const pts = ray(mtoc, [rad * Math.cos(t), y, rad * Math.sin(t)], 7, 0.5, (p) => cellSdf(an, p[0], p[1], p[2]) < -(MEMBRANE + 0.1) && primSdf(nucleusPrim, p[0], p[1], p[2]) > 0.12);
    if (pts.length > 2) addTubule(net, pts, u(0.075), Mat.Spindle);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number, kind?: number) => an.organelles.find((x) => x.material === m && (kind === undefined || x.kind === kind))!;
  const nucleus = first(Mat.Nucleus);
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nucleus.a[0] - 0.7, nucleus.a[1] - 0.2, nucleus.a[2] + 0.5], size: '≈ 8 µm across',
      blurb: 'Holds the genome, about 2 m of DNA in a human cell, behind a double membrane pierced by a few thousand pores. Nuclei of animal cells are typically 2–10 µm across.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: first(Mat.Nucleolus).a, size: '≈ 2 µm',
      blurb: 'Where ribosomal RNA is made and ribosome subunits are put together. It has no membrane: it is a condensate that forms around the ribosomal genes.' },
    { id: 'rer', name: 'Rough ER', material: Mat.ER, anchor: bowlMid(first(Mat.ER)), size: 'sheets ≈ 50 nm thick, drawn thicker',
      blurb: 'Flat sacs studded with ribosomes, curved around the nucleus and continuous with its envelope. Proteins bound for membranes or for export are made into them. Where the sheets are stacked they are joined, level to level, by spiral ramps like those of a parking garage (Terasaki et al. 2013). The ER holds up to 60 % of all the membrane in the cell (Milo & Phillips). The network of smooth ER tubules that runs out to the cell edge is not drawn.' },
    { id: 'golgi', name: 'Golgi apparatus', material: Mat.Golgi, anchor: bowlMid(first(Mat.Golgi, Prim.Bowl)), size: 'cisternae ≈ 1 µm wide; a stack of seven ≈ 0.3 µm thick, drawn thicker',
      blurb: 'One ribbon, not separate stacks: stacks of about seven curved, flattened cisternae stand side by side, and cisternae of the same rank are bridged from stack to stack (Ladinsky et al. 1999; Marsh et al. 2001). Each stack is cupped. Cargo from the ER enters at the cis face, is modified cisterna by cisterna, and leaves in vesicles from the trans face. In animal cells the ribbon curls around the centrosome, beside the nucleus. Real cisternae are pierced by holes and fringed with budding vesicles; the sheets drawn here are smooth, and only a few vesicles are shown.' },
    { id: 'centrosome', name: 'Centrosome', material: Mat.Spindle, anchor: first(Mat.Spindle).a, size: 'centrioles ≈ 0.25 × 0.5 µm',
      blurb: 'Two centrioles at right angles (drawn as two dots), from which the microtubules radiate. The Golgi ribbon gathers around it. Plant and fungal cells have none.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: anchorIn(an, an.tubules.filter((t) => t.material === Mat.Mitochondrion).map((t) => t.points[1]), Mat.Mitochondrion), size: '≈ 0.5–1 µm thick',
      blurb: 'Where most ATP is made. They are tubes that fuse and divide all the time, often a connected network, not separate beans; a mammalian cell has of the order of 1 000 by the usual count (Milo & Phillips). Thirty are drawn.' },
    { id: 'ser', name: 'Smooth ER', material: Mat.ER, anchor: anchorIn(an, an.tubules.filter((t) => t.material === Mat.ER).flatMap((t) => t.points), Mat.ER), size: 'tubules ≈ 50 nm thick, drawn thicker',
      blurb: 'The same membrane system as the rough sheets, drawn out into a network of tubules that reaches every corner of the cell and touches mitochondria, the Golgi and the plasma membrane (Marsh et al. 2001). No ribosomes here: this is where lipids are made and calcium is stored. A dozen stretches stand for the whole network.' },
    { id: 'mt', name: 'Microtubule', material: Mat.Spindle, anchor: anchorIn(an, an.tubules.filter((t) => t.material === Mat.Spindle).map((t) => t.points[Math.min(3, t.points.length - 1)]), Mat.Spindle), size: '25 nm thick, drawn thicker',
      blurb: 'Hollow tubes of tubulin that grow out from the centrosome to the cell edge, shrink back and grow again. Motor proteins carry vesicles and organelles along them, and they hold the Golgi ribbon and the ER network in place.' },
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
    { material: Mat.ER, name: 'ER' }, { material: Mat.Golgi, name: 'Golgi apparatus' },
    { material: Mat.Spindle, name: 'Centrosome, microtubules' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Lysosome, name: 'Lysosomes' }, { material: Mat.Peroxisome, name: 'Peroxisomes' },
    { material: Mat.Vesicle, name: 'Endosomes' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Mitochondrion]: 1.3 },
  camera: { dist: 24, yaw: -0.42, pitch: 0.6 },
  help: 'Grab it anywhere and pull: with no wall it is the softest specimen here.',
  about: 'The textbook animal cell, a composite of no one cell type, drawn at 3 µm per unit with the size of a cultured human cell rounded up among its neighbours (≈ 20 µm). Organelle sizes are typical values; the numbers of mitochondria, lysosomes and peroxisomes drawn are far below the real ones. Ribosomes, actin and intermediate filaments are not drawn; the Golgi cisternae and ER sheets are drawn thicker and further apart than they are.',
};
