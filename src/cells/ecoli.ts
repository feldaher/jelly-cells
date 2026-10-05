// Escherichia coli in fast growth (LB, 37 °C): a rod with no nucleus and no organelles.
// What changes through its 32-minute cycle is its length, its nucleoid and the ring that
// divides it; the numbers come from cycle/ecoli.ts. Flagella and pili (20 nm and thinner)
// are not drawn.

import { Mat, Prim, type Anatomy, type BodyPart, type CellType, type Label, type Stage, type Vec3 } from '../contracts';
import { cellSdf } from '../anatomy/sdf';
import { cone, ell, finish, union } from './common';
import { waistOverlap } from './cycle/geometry';
import { ECOLI, ecoliLength, ecoliReplication, ecoliWaist, ecoliZRingAge } from './cycle/ecoli';

const UM = 0.35;
const u = (um: number) => um / UM;

const R = u(ECOLI.width / 2);
/** Outer membrane, peptidoglycan and inner membrane together: about 30 nm. */
const WALL = u(0.03);
/** The bridge left at the last stage, for the daughters to break (fraction of the cell radius). */
const BRIDGE = 0.3;

/** Age (min) each stage is drawn at: birth, termination of replication, mid-D, constriction, division. */
export const ECOLI_STAGE_AGE = [0, ecoliZRingAge(), 20, 27, ECOLI.generationMin] as const;

/**
 * Nucleoid lobes per stage, in µm along the cell axis (centre, half-length). A drawing of the
 * replication state: one bilobed nucleoid while the old round runs, two nucleoids after it
 * terminates, each becoming bilobed as the next round advances. Lobes are listed outer pair
 * first so that a lobe keeps its place in the list as the cell grows.
 */
const NUCLEOID: [number, number][][] = [
  [[-0.3, 0.42], [0.3, 0.42]],
  [[-0.62, 0.5], [0.62, 0.5]],
  [[-1.02, 0.34], [1.02, 0.34], [-0.62, 0.34], [0.62, 0.34]],
  [[-1.25, 0.38], [1.25, 0.38], [-0.73, 0.38], [0.73, 0.38]],
  [[-1.4, 0.42], [1.4, 0.42], [-0.8, 0.42], [0.8, 0.42]],
];
/** Radial half-width of the nucleoid (µm): it is confined within the cylinder, with ribosome-rich cytoplasm around it. */
const NUCLEOID_RADIUS = 0.32;

export const STAGES: Stage[] = [
  { name: 'Born', title: 'Newborn', blurb: 'A cell 2.2 µm long that will divide in 32 minutes. Copying the chromosome takes 40, so it was born with replication already 70 % done, started by its mother. At 4 minutes it starts the round its own daughters will need.' },
  { name: 'Term', title: 'Replication ends', blurb: '12 minutes: the old round finishes and the two chromosomes move apart into two nucleoids. At about this moment FtsZ assembles into the Z ring at mid-cell, well before any constriction (den Blaauwen et al. 1999).' },
  { name: 'Z ring', title: 'Elongation', blurb: 'The rod lengthens exponentially: the longer it is, the faster it grows. Each nucleoid is already being copied again. The division machinery matures on the Z ring.' },
  { name: 'Constr', title: 'Constriction', blurb: 'The envelope grows inward at mid-cell and builds two new poles. How fast it closes is set by the wall-building enzyme PBP3, not by the Z ring (Coltharp et al. 2016).' },
  { name: 'Div', title: 'Division', blurb: 'Two daughters 2.2 µm long, each born mid-replication like their mother. The Z ring has left before the septum closes. The cell added the same length as its mother did, whatever its own size at birth: the adder rule.' },
];

function build(seed = 7, stage = 0): Anatomy {
  const st = Math.max(0, Math.min(STAGES.length - 1, stage));
  const age = ECOLI_STAGE_AGE[st], last = st === STAGES.length - 1;
  const L = u(ecoliLength(age)), half = L / 2;
  // two daughter rods; they are one rod until the waist starts to close
  const waist = Math.max(ecoliWaist(age), last ? BRIDGE : 0);
  const overlap = waistOverlap(R, waist);
  const body: BodyPart[] = [
    union(cone([-half + R, 0, 0], [overlap / 2 - R, 0, 0], R, R)),
    union(cone([R - overlap / 2, 0, 0], [half - R, 0, 0], R, R), waist < 1 ? 0.12 : 0),
  ];
  const an = finish({
    cellType: 'ecoli', stage: st, body, wallThickness: WALL, cortexDepth: 0.25,
    mesh: { minSpacing: 0.36, maxSpacing: 0.5, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
    ...(last ? { fission: { n: [1, 0, 0] as Vec3, d: 0 } } : {}),
  });
  const o = an.organelles;

  // Z ring: under the inner membrane at mid-cell, from termination until the septum is nearly closed.
  if (age >= ecoliZRingAge() && !last) {
    // as far out as it can sit with its whole section under the envelope (the waist is a V-shaped notch)
    const tube = 0.04, depth = WALL + tube + 0.015;
    let ringR = 0;
    while (ringR < R && cellSdf(an, 0, 0, ringR + 0.005) < -depth) ringR += 0.005;
    o.push({ kind: Prim.Torus, material: Mat.Ring, a: [0, 0, 0], b: [1, 0, 0], R: ringR, r: tube });
  }
  // Chemoreceptor arrays: a patch under the membrane at each pole.
  for (const side of [-1, 1]) o.push(ell([side * (half - WALL - 0.14), 0, 0], [0.07, 0.5, 0.5], Mat.Receptor));
  // Nucleoid.
  for (const [c, h] of NUCLEOID[st]) o.push(ell([u(c), 0, 0], [u(h), u(NUCLEOID_RADIUS), u(NUCLEOID_RADIUS)], Mat.Nucleoid));
  return an;
}

function labels(an: Anatomy): Label[] {
  const all = (m: number) => an.organelles.filter((x) => x.material === m);
  const st = an.stage, age = ECOLI_STAGE_AGE[st], rep = ecoliReplication(age);
  const half = u(ecoliLength(age)) / 2;
  const lobe = all(Mat.Nucleoid)[0], array = all(Mat.Receptor)[0], ring = all(Mat.Ring)[0];
  const pct = (x: number) => `${Math.round(100 * x)} %`;
  const out: Label[] = [
    { id: 'nucleoid', name: 'Nucleoid', material: Mat.Nucleoid, anchor: lobe.a, size: '4.6 million base pairs, ≈ 1.5 mm of DNA',
      blurb: (rep.nucleoids === 1
        ? `The chromosome: no envelope around it, just DNA compacted a thousandfold. Here it is ${pct(rep.oldRound)} replicated`
        : `One of two nucleoids. Each is ${pct(rep.newRound)} of the way through the next round of replication`)
        + `, with ${rep.origins} copies of the origin in the cell. Most RNA polymerase is here; most ribosomes are not (Bakshi et al. 2012).` },
    { id: 'envelope', name: 'Cell envelope', material: Mat.Wall, anchor: [-half / 2, R - WALL / 2, 0], size: '≈ 30 nm in all',
      blurb: 'Three layers: an inner membrane, a thin peptidoglycan wall in the periplasm, and an outer membrane. The wall is one bag-shaped molecule; the cell lengthens by inserting new strands along its cylinder.' },
    { id: 'ribosomes', name: 'Ribosome-rich cytoplasm', material: Mat.Cytoplasm, anchor: [half - u(0.22), 0, 0.3], size: '≈ 55 000 ribosomes (moderate growth)',
      blurb: 'Ribosomes are pushed out of the nucleoid into the two endcaps and the middle of the cell: only 10–15 % sit inside the dense DNA (Bakshi et al. 2012). Protein is made mostly here.' },
    { id: 'receptors', name: 'Chemoreceptor array', material: Mat.Receptor, anchor: array.a, size: 'a 12 nm hexagonal lattice',
      blurb: 'Receptors clustered at the pole (Maddock & Shapiro 1993), packed in the same hexagonal lattice in every bacterium looked at (Briegel et al. 2009). Packing them together is thought to be what makes chemotaxis so sensitive.' },
    { id: 'old-pole', name: 'Cell pole', anchor: [-half + 0.5, 0, -0.3], size: '',
      blurb: 'A pole is made at a division and kept for life: every cell has one older and one newer pole. Flagella, about 20 nm thick and several cell lengths long, leave from the sides and are not drawn.' },
  ];
  if (ring) out.push({ id: 'zring', name: 'Z ring', material: Mat.Ring, anchor: [0, 0, ring.R], size: 'a thin band, drawn thicker',
    blurb: st === 3
      ? 'Shrinking with the septum. FtsZ filaments treadmill around the ring and carry the wall-building enzymes with them, laying down ever smaller rings of wall (Bisson-Filho et al. 2017).'
      : 'FtsZ, a relative of tubulin, in filaments under the membrane. The Min proteins, sweeping from pole to pole, and the nucleoids themselves keep it from forming anywhere but here.' });
  if (st >= 3) out.push({ id: 'septum', name: st === 3 ? 'Constriction' : 'New poles', anchor: [0, 0, 0], size: '',
    blurb: st === 3
      ? 'All three envelope layers fold inward together: E. coli pinches rather than building a flat cross-wall.'
      : 'The two caps built during constriction. They are all that still joins the daughters.' });
  return out;
}

export const ecoli: CellType = {
  id: 'ecoli',
  name: 'E. coli',
  title: ['E.', 'coli.'],
  tagline: ['No nucleus, no organelles.', 'A chromosome, a ring,', 'and 32 minutes to divide.'],
  umPerUnit: UM,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Cell cycle',
  defaultStage: 0,
  key: [
    { material: Mat.Wall, name: 'Cell envelope' }, { material: Mat.Cytoplasm, name: 'Cytoplasm (ribosomes)' },
    { material: Mat.Nucleoid, name: 'Nucleoid' }, { material: Mat.Ring, name: 'Z ring' },
    { material: Mat.Receptor, name: 'Chemoreceptors' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleoid]: 1.3, [Mat.Ring]: 3, [Mat.Receptor]: 2 },
  camera: { dist: 30, yaw: -0.42, pitch: 0.62 },
  help: 'Grab a pole and bend the rod, or press play and watch it divide.',
  about: 'Escherichia coli growing fast, drawn at 0.35 µm per unit: 1 µm wide and 2.2 to 4.4 µm long. Lengths, the exponential growth law and the 32-minute generation come from 10 189 measured cell cycles (Tanouchi et al. 2017). There is nothing membrane-bound inside: the chromosome lies free as the nucleoid.',
};
