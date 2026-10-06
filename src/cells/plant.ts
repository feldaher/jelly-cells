// A plant cell: a palisade mesophyll cell of a leaf, a walled column whose cytoplasm is a thin
// layer, lined with chloroplasts, around one large vacuole. Sizes are typical textbook values
// except the chloroplast number (Pyke & Leech 1991, 1992: about 80–120 per Arabidopsis mesophyll cell).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type CellType, type Label, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, anchorIn, bowl, bowlMid, cone, ell, finish, norm3, samplePoint, union, wander } from './common';

const UM = 6;
const u = (um: number) => um / UM;

/** The column: 20 µm wide and 52 µm long, rounded at both ends. */
const R = u(10), HALF = u(16);
/** Primary wall 0.1–0.3 µm; drawn 0.6 µm so that it shows. */
const WALL = u(0.6);
/** Chloroplasts: discs 5 µm across and 1.6 µm thick (real ones are lens-shaped, 2–3 µm thick at the middle). */
const CHLOROPLAST = { R: u(2.5), half: u(0.8) };
/** Vacuole: fills the column except for a layer of cytoplasm, about 2 µm, under the wall. */
const VACUOLE = { r: R - WALL - 2 * CHLOROPLAST.half - 0.07, from: -HALF - 0.15, to: HALF + 0.15 };
/** Nucleus: a lens 6.6 µm across and 3.6 µm thick, flattened against the wall (typical values). */
const NUCLEUS = { r: u(3.3), half: u(1.8) };

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'plant', stage: 0, body: [union(cone([-HALF, 0, 0], [HALF, 0, 0], R, R))],
    wallThickness: WALL, cortexDepth: 0.25,
    mesh: { minSpacing: 0.4, maxSpacing: 0.52, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  // The nucleus: a flattened lens pressed against the wall, bulging into the vacuole.
  const nucleus: Vec3 = [0.55, R - WALL - NUCLEUS.half - 0.04, 0.15];
  o.push(ell([nucleus[0] + 0.12, nucleus[1], nucleus[2] + 0.1], [u(1), u(0.8), u(0.9)], Mat.Nucleolus));
  o.push(ell(nucleus, [NUCLEUS.r, NUCLEUS.half, NUCLEUS.r], Mat.Nucleus));

  // Chloroplasts: flat against the wall, in rings along the column, each ring turned from the last.
  // None where the nucleus sits.
  const rho = R - WALL - CHLOROPLAST.half - 0.035;
  const rings = 6, perRing = 8;
  for (let i = 0; i < rings; i++) {
    const x = -HALF + 0.25 + (i * (HALF * 2 - 0.5)) / (rings - 1);
    for (let k = 0; k < perRing; k++) {
      const t = ((k + 0.5 * (i % 2)) / perRing) * 2 * Math.PI + (rand() - 0.5) * 0.05;
      const c: Vec3 = [x + (rand() - 0.5) * 0.06, rho * Math.cos(t), rho * Math.sin(t)];
      if (Math.hypot(c[0] - nucleus[0], c[1] - nucleus[1], c[2] - nucleus[2]) < NUCLEUS.r + CHLOROPLAST.R + 0.05) continue;
      o.push({ kind: Prim.Disc, material: Mat.Chloroplast, a: c, b: [0, CHLOROPLAST.half * Math.cos(t), CHLOROPLAST.half * Math.sin(t)], R: CHLOROPLAST.R, r: 0 });
    }
  }

  // Rough ER: sheets curved around the nucleus, continuous with its envelope, lying in the layer of cytoplasm.
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) o.push(bowl(nucleus, [side, 0, 0.2], NUCLEUS.r + 0.07 + 0.06 * i, 0.36, 0.012, Mat.ER));

  // The central vacuole: the whole length of the cell. The nucleus and the chloroplasts bulge into it.
  o.push({ kind: Prim.Capsule, material: Mat.Vacuole, a: [VACUOLE.from, 0, 0], b: [VACUOLE.to, 0, 0], R: 0, r: VACUOLE.r });

  // Everything else shares the thin layer of cytoplasm between the vacuole and the wall.
  const free = (margin: number) => (p: Vec3) => cellSdf(an, p[0], p[1], p[2]) < -(WALL + margin) && o.every((q) => primSdf(q, p[0], p[1], p[2]) > margin);
  const lo: Vec3 = [-HALF - R, -R, -R], hi: Vec3 = [HALF + R, R, R];
  // Golgi stacks (dictyosomes): unlike the single ribbon of an animal cell, a plant cell has many
  // small separate stacks of 5–8 slightly cupped cisternae, about 1 µm across; four are drawn,
  // each drawn about twice as thick as it is.
  for (let s = 0; s < 4; s++) {
    const g = samplePoint(rand, lo, hi, free(0.115));
    if (!g) continue;
    const axis = norm3([rand() - 0.5, rand() - 0.5, rand() - 0.5]), rc = u(2);
    for (let i = 0; i < 5; i++) o.push(bowl([g[0] - axis[0] * rc, g[1] - axis[1] * rc, g[2] - axis[2] * rc], axis, rc + (i - 2) * u(0.12), u(1), u(0.03), Mat.Golgi));
  }
  const net = { organelles: o, tubules: an.tubules };
  for (let i = 0; i < 14; i++) {
    const start = samplePoint(rand, lo, hi, free(0.1));
    if (!start) continue;
    addTubule(net, wander(rand, start, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 2, 0.16, free(0.08)), u(0.4), Mat.Mitochondrion);
  }
  const scatter = (count: number, r: number, material: Primitive['material']) => {
    for (let i = 0; i < count; i++) { const c = samplePoint(rand, lo, hi, free(r + 0.03)); if (c) o.push(ell(c, [r, r, r], material)); }
  };
  scatter(10, u(0.45), Mat.Peroxisome);
  // Cortical ER: a net of tubules just under the plasma membrane (real tubules ≈ 50 nm; drawn 0.2 µm).
  for (let i = 0; i < 10; i++) {
    const start = samplePoint(rand, lo, hi, free(0.04));
    if (start) addTubule(net, wander(rand, start, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 5, 0.22, free(0.03)), u(0.1), Mat.ER);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const first = (m: number) => an.organelles.find((x) => x.material === m)!;
  return [
    { id: 'chloroplast', name: 'Chloroplast', material: Mat.Chloroplast, anchor: first(Mat.Chloroplast).a, size: '≈ 5 µm across, 2–3 µm thick',
      blurb: 'Where light is turned into sugar. Inside its double envelope, stacks of thylakoid membranes carry the chlorophyll. The darker spots stand for grana, the stacks of thylakoids, about half a micrometre across. An Arabidopsis mesophyll cell holds about 80 to 120 chloroplasts (Pyke & Leech 1991, 1992); fewer than fifty are drawn. Like mitochondria they descend from bacteria and keep a small genome of their own.' },
    { id: 'vacuole', name: 'Central vacuole', material: Mat.Vacuole, anchor: [-1, -0.3, 0], size: 'most of the cell',
      blurb: 'One membrane (the tonoplast) around water, ions, sugars and waste. It takes up about half of this cell and can reach nine tenths of a large mature one, pressing the cytoplasm into a layer a few micrometres thick against the wall. The nucleus and the chloroplasts bulge into it. Its pressure against the wall, turgor, is what keeps a leaf stiff.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [0, R - WALL / 2, 0], size: '0.1–0.3 µm, drawn thicker',
      blurb: 'Cellulose fibres in a gel of pectin and hemicellulose, outside the plasma membrane. It lets the cell hold several atmospheres of turgor. Neighbouring cells are joined through it by plasmodesmata, channels about 50 nm wide (not drawn).' },
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [first(Mat.Nucleus).a[0] - 0.3, first(Mat.Nucleus).a[1], first(Mat.Nucleus).a[2] - 0.2], size: '≈ 6–7 µm across',
      blurb: 'Pressed flat against the wall by the vacuole. Its genome works with two others in the same cell: the chloroplast\'s and the mitochondrion\'s.' },
    { id: 'rer', name: 'Rough ER', material: Mat.ER, anchor: anchorIn(an, an.organelles.filter((x) => x.material === Mat.ER && x.kind === Prim.Bowl).map(bowlMid), Mat.ER), size: 'sheets ≈ 50 nm thick, drawn thicker',
      blurb: 'Ribosome-studded sheets curved around the nucleus and continuous with its envelope. A net of tubules continues from them under the whole plasma membrane, and in plants the ER also runs through the plasmodesmata from one cell into the next.' },
    { id: 'golgi', name: 'Golgi stack', material: Mat.Golgi, anchor: anchorIn(an, an.organelles.filter((x) => x.material === Mat.Golgi).map(bowlMid), Mat.Golgi), size: '≈ 1 µm across',
      blurb: 'Plant cells have no single Golgi ribbon: dozens to hundreds of small separate stacks, each of five to eight slightly cupped cisternae, travel along actin filaments. They make the pectin and hemicellulose of the wall. Four are drawn.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: anchorIn(an, an.tubules.filter((t) => t.material === Mat.Mitochondrion).flatMap((t) => t.points), Mat.Mitochondrion), size: '≈ 0.5–1 µm',
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
  about: 'A palisade mesophyll cell from the upper layer of a leaf, lying on its side, drawn at 6 µm per unit: about 20 µm wide and 50 µm long. The chloroplast number per cell is measured (80–120 in Arabidopsis; fewer than fifty drawn). The other sizes are typical textbook values. The wall is drawn thicker than it is. Plasmodesmata are 50 nm channels, four hundred times narrower than the cell, and cannot be drawn at this scale; the cytoskeleton is left out.',
};
