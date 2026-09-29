// The default budding yeast cell. Sizes are stylised but plausible for
// S. cerevisiae: mother ≈ 5 µm across, bud ≈ 3 µm, a ~1 µm neck with a septin
// ring, a nucleus near the neck, a large vacuole, and a cortical mitochondrial network.

import { Mat, Prim, type Anatomy, type CellType, type Ellipsoid, type Label, type Primitive, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf } from '../anatomy/sdf';
import { addTubule, ell, finish, union } from './common';

export const MOTHER: Ellipsoid = { centre: [0, 0, 0], radii: [2.5, 2.3, 2.3] };
export const BUD: Ellipsoid = { centre: [3.75, 0, 0.1], radii: [1.6, 1.45, 1.45] };

const norm = (v: Vec3): Vec3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function surfacePoint(e: Ellipsoid, dir: Vec3, depth: number): Vec3 {
  // Point along `dir` from the centre, `depth` µm inside the ellipsoid surface.
  const u = norm(dir);
  const t = 1 / Math.hypot(u[0] / e.radii[0], u[1] / e.radii[1], u[2] / e.radii[2]);
  const s = t - depth;
  return [e.centre[0] + u[0] * s, e.centre[1] + u[1] * s, e.centre[2] + u[2] * s];
}

function ellipsoidNormal(e: Ellipsoid, p: Vec3): Vec3 {
  return norm([(p[0] - e.centre[0]) / e.radii[0] ** 2, (p[1] - e.centre[1]) / e.radii[1] ** 2, (p[2] - e.centre[2]) / e.radii[2] ** 2]);
}

/** A tubule wandering just under the cortex: a random walk on a shrunken ellipsoid. */
function tubule(e: Ellipsoid, rand: () => number, avoid: (u: Vec3) => boolean, segments: number, stepLen: number, depth: number): Vec3[] {
  let u: Vec3;
  do { u = norm([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]); } while (avoid(u));
  let t = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
  const pts: Vec3[] = [surfacePoint(e, u, depth)];
  const rMean = (e.radii[0] + e.radii[1] + e.radii[2]) / 3;
  for (let i = 0; i < segments; i++) {
    // keep t tangent, wiggle it, step along it
    const dot = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];
    t = norm([t[0] - dot * u[0] + (rand() - 0.5) * 0.9, t[1] - dot * u[1] + (rand() - 0.5) * 0.9, t[2] - dot * u[2] + (rand() - 0.5) * 0.9]);
    const a = stepLen / rMean;
    const nu = norm([u[0] + t[0] * a, u[1] + t[1] * a, u[2] + t[2] * a]);
    if (avoid(nu)) break;
    u = nu;
    pts.push(surfacePoint(e, u, depth));
  }
  return pts;
}

/** Radius of the cell's cross-section at x (along the mother→bud axis). */
function sectionRadius(an: Anatomy, x: number): number {
  let lo = 0, hi = 4;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (cellSdf(an, x, MOTHER.centre[1], m + MOTHER.centre[2]) < 0) lo = m; else hi = m;
  }
  return lo;
}

export function defaultAnatomy(seed = 7): Anatomy {
  const rand = rng(seed);
  const mother = MOTHER, bud = BUD;
  const an: Anatomy = finish({
    cellType: 'yeast',
    body: [union(ell(mother.centre, mother.radii)), union(ell(bud.centre, bud.radii), 0.5)],
    wallThickness: 0.18,
    cortexDepth: 0.3,
    mesh: { minSpacing: 0.36, maxSpacing: 0.72, minParticles: 120, skinGrid: 0.11 },
    organelles: [], tubules: [], seed,
  });

  // Neck: the narrowest section between the two centres.
  let neckX = 2.2, neckR = Infinity;
  for (let x = 1.6; x <= 3.0; x += 0.02) {
    const r = sectionRadius(an, x);
    if (r < neckR) { neckR = r; neckX = x; }
  }

  const organelles: Primitive[] = [];
  const add = (kind: Primitive['kind'], material: Primitive['material'], a: Vec3, b: Vec3, R = 0, r = 0) =>
    organelles.push({ kind, material, a, b, R, r });

  // Septin hourglass at the neck, just beneath the wall.
  add(Prim.Torus, Mat.Septin, [neckX, 0, 0], [1, 0, 0], neckR - an.wallThickness - 0.16, 0.1);

  // Bud scars: chitin rings on the mother's far side, from earlier divisions.
  const jitter = () => (rand() - 0.5) * 0.25;
  for (const d of [[-0.85, 0.4, 0.35], [-0.55, -0.25, 0.8], [-0.7, 0.62, -0.35]] as Vec3[]) {
    const dir = norm([d[0] + jitter(), d[1] + jitter(), d[2] + jitter()]);
    const p = surfacePoint(mother, dir, 0);
    add(Prim.Torus, Mat.BudScar, p, ellipsoidNormal(mother, p), 0.36, 0.09);
  }

  // Nucleus migrating toward the neck, with a crescent-ish nucleolus.
  add(Prim.Ellipsoid, Mat.Nucleolus, [1.5, 0.45, 0.2], [0.38, 0.3, 0.42]);
  add(Prim.Ellipsoid, Mat.Nucleus, [1.15, 0.15, 0.1], [0.95, 0.9, 0.88]);

  // Mitochondrial network hugging the cortex of mother and bud.
  const neckDir = norm([1, 0, 0]);
  const net = { organelles, tubules: an.tubules };
  const mkTubules = (e: Ellipsoid, count: number, segs: number, avoid: (u: Vec3) => boolean) => {
    for (let i = 0; i < count; i++) {
      const radius = 0.12 + rand() * 0.04;
      const pts = tubule(e, rand, avoid, segs + Math.floor(rand() * 3), 0.55, 0.36);
      addTubule(net, pts, radius, Mat.Mitochondrion);
    }
  };
  mkTubules(mother, 8, 5, (u) => u[0] * neckDir[0] > 0.72);
  mkTubules(bud, 3, 3, (u) => u[0] < -0.6);

  // Vacuoles: a big one plus a lobe in the mother, a small one in the bud.
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.85, -0.15, -0.1], [1.15, 1.1, 1.1]);
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.35, 0.95, 0.8], [0.5, 0.46, 0.46]);
  add(Prim.Ellipsoid, Mat.Vacuole, [3.95, 0.1, -0.15], [0.5, 0.45, 0.45]);

  an.organelles = organelles;
  return an;
}

function yeastLabels(an: Anatomy): Label[] {
  const find = (m: number) => an.organelles.find((o) => o.material === m)!;
  const nucleus = find(Mat.Nucleus), nucleolus = find(Mat.Nucleolus), septin = find(Mat.Septin);
  const scar = find(Mat.BudScar), vacuole = find(Mat.Vacuole);
  const mito = an.tubules[0].points;
  const inward = (p: Vec3, n: Vec3, d: number): Vec3 => [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d];
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nucleus.a[0] - 0.3, nucleus.a[1] - 0.35, nucleus.a[2]], size: '≈ 2 µm across',
      blurb: 'Holds the 16 chromosomes. In budding yeast the nuclear envelope never breaks down: the nucleus squeezes through the neck and divides between mother and bud.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 0.8 µm',
      blurb: 'A crescent against the nuclear envelope where ribosomal RNA is made and ribosomes are assembled.' },
    { id: 'vacuole', name: 'Vacuole', material: Mat.Vacuole, anchor: vacuole.a, size: 'up to ≈ 2.5 µm',
      blurb: 'The yeast lysosome: stores amino acids and ions, degrades proteins, and buffers the cell against osmotic stress by swelling or fragmenting.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerpV(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'A branched tubular network just under the cortex. It is actively pulled into the bud so the daughter inherits its share.' },
    { id: 'septin', name: 'Septin ring', material: Mat.Septin, anchor: [septin.a[0], septin.a[1], septin.a[2] + septin.R - 0.06], size: '≈ 1 µm ring',
      blurb: 'Filaments that form an hourglass collar at the neck. They act as a diffusion barrier between mother and bud and mark where the cell will divide.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [MOTHER.centre[0], MOTHER.centre[1] + MOTHER.radii[1] - 0.08, MOTHER.centre[2]], size: '≈ 0.1–0.2 µm thick',
      blurb: 'Glucans, mannoproteins and chitin. Far stiffer than the cytoplasm: it resists the cell\'s turgor pressure of several atmospheres.' },
    { id: 'scar', name: 'Bud scar', anchor: inward(scar.a, scar.b, 0.1), size: '≈ 1 µm ring',
      blurb: 'A chitin ring left on the mother at each division. Counting scars tells you how many daughters she has had (the record is a few dozen).' },
    { id: 'bud', name: 'Bud (daughter)', anchor: [BUD.centre[0] - 0.4, BUD.centre[1] - 0.5, BUD.centre[2] + 0.3], size: '≈ 3 µm',
      blurb: 'The daughter cell growing out of the mother. Growth is polarised toward the bud tip until it is almost as large as its mother.' },
  ];
}

function lerpV(a: Vec3, b: Vec3, t: number): Vec3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export const yeast: CellType = {
  id: 'yeast',
  name: 'Budding yeast',
  title: ['Budding', 'Yeast.'],
  tagline: ['A mother and her bud.', 'A little wobble.', 'Cut it open to look inside.'],
  umPerUnit: 1,
  build: defaultAnatomy,
  labels: yeastLabels,
  key: [
    { material: Mat.Wall, name: 'Cell wall' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Vacuole, name: 'Vacuole' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Septin, name: 'Septin ring' }, { material: Mat.BudScar, name: 'Bud scars' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Mitochondrion]: 1.3, [Mat.Septin]: 3, [Mat.BudScar]: 4 },
  camera: { dist: 21, yaw: -0.42, pitch: 0.6 },
  help: 'Grab any part (mother, bud or neck) and pull.',
  about: 'Saccharomyces cerevisiae, baker\'s yeast, dividing by budding. The mother (≈ 5 µm) grows a daughter through a narrow neck ringed by septins. A stiff cell wall makes the whole thing much firmer than an animal cell.',
};
