// The default budding yeast cell. Sizes are stylised but plausible for
// S. cerevisiae: mother ≈ 5 µm across, bud ≈ 3 µm, a ~1 µm neck with a septin
// ring, a nucleus near the neck, a large vacuole, and a cortical mitochondrial network.
// The nucleus is sized from the cell volume (cycle/budding.ts); where the nucleolus, the
// spindle and the rings sit at each stage follows the sources given in
// docs/cell-cycles-organelles.md.

import { Mat, Prim, type Anatomy, type CellType, type Ellipsoid, type Label, type Primitive, type Stage, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, materialAt } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, union } from './common';
import { buddingNucleusRadius } from './cycle/budding';
import { ellipsoidVolume } from './cycle/geometry';

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

interface StagePlan {
  /** Bud size relative to BUD (0 = no bud) and its centre along x. */
  bud: number;
  budX: number;
  neckBlend: number;
  /** Nucleus centres; `share` is the part of the cell's nuclear volume each lobe holds. */
  nuclei: { c: Vec3; share: number }[];
  bridge?: { a: Vec3; b: Vec3; r: number };
  /** Nucleoli, as an offset from their nucleus centre in units of its radius. */
  nucleoli: { of: number; at: Vec3; r: Vec3 }[];
  /** Spindle ends (pole to pole), inside the nuclear envelope. */
  spindle?: [Vec3, Vec3];
  budTubules: number;
  budVacuole: number;
  septins: number;
  /** 1 when there is a myosin ring at the neck. */
  ring: number;
  /** A stream of vacuole membrane on its way to the bud. */
  vacuoleStream?: Vec3[];
  /** The neck is closed by a septum and the daughter is about to leave. */
  cytokinesis?: boolean;
  /** Late in the cycle the neck is a short tube of this radius between two rounded cells, from x = a to b. */
  neck?: { r: number; a: number; b: number };
}

/** In interphase the nucleolus lies opposite the spindle pole body, which faces the bud (+x). */
const AWAY: StagePlan['nucleoli'][number] = { of: 0, at: [-0.46, 0.44, 0.1], r: [0.4, 0.3, 0.42] };
/** In anaphase the ribosomal DNA is the last to separate: the nucleoli trail on the neck side. */
const trailing = (of: number, dir: number): StagePlan['nucleoli'][number] => ({ of, at: [0.42 * dir, 0.46, 0.1], r: [0.36, 0.27, 0.36] });

/** The cell cycle, stage by stage. Stage 2 (G2/M) is the classic budded cell. */
const PLAN: StagePlan[] = [
  { bud: 0, budX: 0, neckBlend: 0, nuclei: [{ c: [0.75, 0.3, 0.2], share: 1 }], nucleoli: [AWAY], budTubules: 0, budVacuole: 0, septins: 0, ring: 0 },
  { bud: 0.45, budX: 3.1, neckBlend: 0.35, nuclei: [{ c: [0.95, 0.15, 0.1], share: 1 }], nucleoli: [AWAY], budTubules: 1, budVacuole: 0, septins: 1, ring: 1,
    vacuoleStream: [[0.1, -0.5, -0.5], [1.0, -1.15, -0.75], [1.75, -0.75, -0.45]] },
  { bud: 1, budX: 3.75, neckBlend: 0.5, nuclei: [{ c: [1.15, 0.15, 0.1], share: 1 }], nucleoli: [AWAY], spindle: [[0.4, 0.15, 0.1], [1.9, 0.15, 0.1]],
    budTubules: 3, budVacuole: 0.5, septins: 1, ring: 1 },
  {
    bud: 1.08, budX: 3.95, neckBlend: 0.45,
    nuclei: [{ c: [0.95, 0.12, 0.1], share: 0.5 }, { c: [4.1, 0.05, 0.1], share: 0.36 }],
    bridge: { a: [1.5, 0.1, 0.1], b: [3.6, 0.05, 0.1], r: 0.26 },
    nucleoli: [trailing(0, 1)], spindle: [[0.35, 0.12, 0.1], [4.6, 0.05, 0.1]], budTubules: 3, budVacuole: 0.5, septins: 1, ring: 1,
  },
  {
    bud: 1.14, budX: 4.1, neckBlend: 0.3,
    nuclei: [{ c: [0.75, 0.12, 0.1], share: -1 }, { c: [4.35, 0.05, 0.1], share: -1 }],
    nucleoli: [trailing(0, 1), trailing(1, -1)], budTubules: 3, budVacuole: 0.55, septins: 2, ring: 1,
    neck: { r: 0.8, a: 2.15, b: 2.75 },
  },
  {
    bud: 1.16, budX: 4.45, neckBlend: 0.15,
    nuclei: [{ c: [0.6, 0.12, 0.1], share: -1 }, { c: [4.65, 0.05, 0.1], share: -1 }],
    nucleoli: [trailing(0, 1), trailing(1, -1)], budTubules: 3, budVacuole: 0.6, septins: 2, ring: 1, cytokinesis: true,
    neck: { r: 0.42, a: 2.2, b: 2.9 },
  },
];

export const STAGES: Stage[] = [
  { name: 'G1', title: 'Unbudded', blurb: 'The cell grows and decides whether to divide. There is no bud yet; the bud scars show where earlier daughters left. The nucleolus sits on the far side of the nucleus from the spindle pole body.' },
  { name: 'S', title: 'Bud emergence', blurb: 'DNA is replicated while a septin ring marks the neck, with a ring of myosin II inside it, and a small bud starts to grow. Mitochondria and a stream of vacuole membrane are already being pulled in.' },
  { name: 'G2/M', title: 'Budded', blurb: 'The bud grows and the nucleus migrates to the neck with a short spindle inside it, pointing at the bud. The nucleus has grown with the cell: it stays near 7 % of the cell volume (Jorgensen et al. 2007).' },
  { name: 'Ana', title: 'Anaphase', blurb: 'Closed mitosis: the nuclear envelope stays intact, and the nucleus stretches through the neck into a dumbbell as the spindle elongates. The nucleolus is the last part to follow.' },
  { name: 'Telo', title: 'Telophase', blurb: 'The two nuclei separate and the spindle is taken apart. The septin collar splits into two rings, one on each side of the myosin ring.' },
  { name: 'Cyto', title: 'Cytokinesis', blurb: 'The actomyosin ring contracts to a point between the septin rings (Bi et al. 1998; Lippincott et al. 2001) while a chitin septum closes the neck behind it. Then the daughter is released, leaving a bud scar on her mother.' },
];

export function buildYeast(seed = 7, stage = 2): Anatomy {
  const plan = PLAN[Math.max(0, Math.min(PLAN.length - 1, stage))];
  const rand = rng(seed);
  const mother = MOTHER;
  const bud: Ellipsoid = { centre: [plan.budX, 0, 0.1], radii: [BUD.radii[0] * plan.bud, BUD.radii[1] * plan.bud, BUD.radii[2] * plan.bud] };
  const an: Anatomy = finish({
    cellType: 'yeast',
    stage,
    body: [
      union(ell(mother.centre, mother.radii)),
      ...(plan.bud > 0 ? [union(ell(bud.centre, bud.radii), plan.neckBlend)] : []),
      ...(plan.neck ? [union(cone([plan.neck.a, 0, 0.05], [plan.neck.b, 0, 0.05], plan.neck.r, plan.neck.r), 0.15)] : []),
    ],
    wallThickness: 0.18,
    cortexDepth: 0.3,
    mesh: { minSpacing: 0.36, maxSpacing: stage >= 3 ? 0.6 : 0.72, minParticles: 120, skinGrid: 0.11 },
    organelles: [], tubules: [], seed,
  });
  // Nuclear volume: 7 % of the cell's, or of each cell's own once there are two nuclei.
  const vMother = ellipsoidVolume(mother.radii), vBud = ellipsoidVolume(bud.radii);
  const nucleusR = plan.nuclei.map((n, i) => {
    const r = n.share < 0 ? buddingNucleusRadius(i === 0 ? vMother : vBud) : buddingNucleusRadius(vMother + vBud) * Math.cbrt(n.share);
    return [1.03 * r, 0.99 * r, 0.98 * r] as Vec3;
  });

  const organelles: Primitive[] = [];
  const add = (kind: Primitive['kind'], material: Primitive['material'], a: Vec3, b: Vec3, R = 0, r = 0) =>
    organelles.push({ kind, material, a, b, R, r });

  // Septin hourglass at the neck, just beneath the wall (split in two at telophase).
  if (plan.bud > 0) {
    let neckX = 2.2, neckR = Infinity;
    for (let x = 1.6; x <= plan.budX; x += 0.02) {
      const r = sectionRadius(an, x);
      if (r < neckR) { neckR = r; neckX = x; }
    }
    const ringR = (x: number) => Math.max(0.2, sectionRadius(an, x) - an.wallThickness - 0.2);
    // Myosin ring: just inside the septin collar.
    const tube = 0.06;
    let myosinR = Math.max(0.1, ringR(neckX) - 0.17);
    // at cytokinesis it has contracted almost to a point, and the septum has closed the neck behind it
    if (plan.cytokinesis) {
      myosinR = 0.08;
      add(Prim.Disc, Mat.Septum, [neckX, 0, 0], [0.05, 0, 0], sectionRadius(an, neckX) - 0.05, myosinR + tube + 0.01);
      an.fission = { n: [1, 0, 0], d: neckX };
    }
    if (plan.septins === 1) add(Prim.Torus, Mat.Septin, [neckX, 0, 0], [1, 0, 0], ringR(neckX), 0.1);
    else for (const dx of [-0.16, 0.16]) add(Prim.Torus, Mat.Septin, [neckX + dx, 0, 0], [1, 0, 0], ringR(neckX + dx), 0.09);
    // myosin II ring inside the septin collar, from bud emergence; it contracts at cytokinesis
    if (plan.ring > 0) add(Prim.Torus, Mat.Ring, [neckX, 0, 0], [1, 0, 0], myosinR, plan.cytokinesis ? 0.05 : tube);
  }

  // Bud scars: chitin rings on the mother's far side, from earlier divisions.
  const jitter = () => (rand() - 0.5) * 0.25;
  for (const d of [[-0.85, 0.4, 0.35], [-0.55, -0.25, 0.8], [-0.7, 0.62, -0.35]] as Vec3[]) {
    const dir = norm([d[0] + jitter(), d[1] + jitter(), d[2] + jitter()]);
    const p = surfacePoint(mother, dir, 0);
    add(Prim.Torus, Mat.BudScar, p, ellipsoidNormal(mother, p), 0.36, 0.09);
  }

  // The spindle and the nucleoli, then the nucleus that holds them (one, a dumbbell, or two).
  const net = { organelles, tubules: an.tubules };
  if (plan.spindle) addTubule(net, plan.spindle, 0.05, Mat.Spindle);
  for (const n of plan.nucleoli) {
    const c = plan.nuclei[n.of].c, r = nucleusR[n.of][0], k = r / 0.975;
    add(Prim.Ellipsoid, Mat.Nucleolus, [c[0] + n.at[0] * r, c[1] + n.at[1] * r, c[2] + n.at[2] * r], [n.r[0] * k, n.r[1] * k, n.r[2] * k]);
  }
  plan.nuclei.forEach((n, i) => add(Prim.Ellipsoid, Mat.Nucleus, n.c, nucleusR[i]));
  if (plan.bridge) add(Prim.Capsule, Mat.Nucleus, plan.bridge.a, plan.bridge.b, 0, plan.bridge.r);

  // Mitochondrial network hugging the cortex of mother and bud.
  const mkTubules = (e: Ellipsoid, count: number, segs: number, avoid: (u: Vec3) => boolean) => {
    for (let i = 0; i < count; i++) {
      const radius = 0.12 + rand() * 0.04;
      const pts = tubule(e, rand, avoid, segs + Math.floor(rand() * 3), 0.55, 0.36);
      addTubule(net, pts, radius, Mat.Mitochondrion);
    }
  };
  mkTubules(mother, 8, 5, (u) => plan.bud > 0 && u[0] > 0.72);
  if (plan.budTubules) mkTubules(bud, plan.budTubules, plan.bud < 0.7 ? 1 : 3, (u) => u[0] < -0.6);

  // Vacuoles: a big one plus a lobe in the mother, a small one inherited by the bud.
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.85, -0.15, -0.1], [1.15, 1.1, 1.1]);
  add(Prim.Ellipsoid, Mat.Vacuole, [-0.35, 0.95, 0.8], [0.5, 0.46, 0.46]);
  if (plan.budVacuole) {
    const v = plan.budVacuole;
    add(Prim.Ellipsoid, Mat.Vacuole, [bud.centre[0] + 0.2 * plan.bud, 0.1, -0.25 * plan.bud], [v, v * 0.9, v * 0.9]);
  }
  // Vacuole inheritance: a tubular stream leaves the mother's vacuole for the young bud.
  if (plan.vacuoleStream) addTubule(net, plan.vacuoleStream, 0.1, Mat.Vacuole);

  an.organelles = organelles;
  return an;
}

/** The classic budded cell (G2). */
export function defaultAnatomy(seed = 7): Anatomy {
  return buildYeast(seed, 2);
}

function yeastLabels(an: Anatomy): Label[] {
  const all = (m: number) => an.organelles.filter((o) => o.material === m);
  const [nucleus, budNucleus] = all(Mat.Nucleus).filter((o) => o.kind === Prim.Ellipsoid);
  const [nucleolus, budNucleolus] = all(Mat.Nucleolus);
  const septin = all(Mat.Septin)[0], bridge = all(Mat.Nucleus).find((o) => o.kind === Prim.Capsule);
  const scar = all(Mat.BudScar)[0], vacuole = all(Mat.Vacuole)[0];
  const mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!.points;
  const spindle = an.tubules.find((t) => t.material === Mat.Spindle)?.points;
  const ring = all(Mat.Ring)[0], septum = all(Mat.Septum)[0];
  const bud = an.body[1]?.prim;
  const inward = (p: Vec3, n: Vec3, d: number): Vec3 => [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d];
  /** A point in a nucleus, on the side away from its nucleolus. */
  const awayFrom = (n: Primitive, o: Primitive | undefined): Vec3 => {
    // with no nucleolus to avoid, stay off the spindle that runs through the middle
    if (!o) return [n.a[0], n.a[1] + 0.45 * Math.min(...n.b), n.a[2]];
    const d = norm([n.a[0] - o.a[0], n.a[1] - o.a[1], n.a[2] - o.a[2]]);
    const k = 0.45 * Math.min(...n.b);
    return [n.a[0] + d[0] * k, n.a[1] + d[1] * k, n.a[2] + d[2] * k];
  };
  const labels: Label[] = [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: awayFrom(nucleus, nucleolus), size: '≈ 2 µm across',
      blurb: 'Holds the 16 chromosomes. In budding yeast the nuclear envelope never breaks down: the nucleus squeezes through the neck and divides between mother and bud.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 0.8 µm',
      blurb: 'A crescent against the nuclear envelope where ribosomal RNA is made and ribosomes are assembled. In interphase it lies opposite the spindle pole body (Yang et al. 1989); in anaphase it is the last part of the nucleus to divide.' },
    { id: 'vacuole', name: 'Vacuole', material: Mat.Vacuole, anchor: vacuole.a, size: 'up to ≈ 2.5 µm',
      blurb: 'The yeast lysosome: stores amino acids and ions, degrades proteins, and buffers the cell against osmotic stress by swelling or fragmenting.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerpV(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'A branched tubular network just under the cortex. It is actively pulled into the bud so the daughter inherits its share.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [MOTHER.centre[0], MOTHER.centre[1] + MOTHER.radii[1] - 0.08, MOTHER.centre[2]], size: '≈ 0.1–0.2 µm thick',
      blurb: 'Glucans, mannoproteins and chitin. Far stiffer than the cytoplasm: it resists the cell\'s turgor pressure of several atmospheres.' },
    { id: 'scar', name: 'Bud scar', anchor: inward(scar.a, scar.b, 0.1), size: '≈ 1 µm ring',
      blurb: 'A chitin ring left on the mother at each division. Counting scars tells you how many daughters she has had (the record is a few dozen).' },
  ];
  // the outermost point of the ring's tube that is not swallowed by the wall band
  let septinAnchor: Vec3 | null = null;
  if (septin) for (let k = septin.r * 0.9; k > -septin.r && !septinAnchor; k -= 0.01) {
    const p: Vec3 = [septin.a[0], septin.a[1], septin.a[2] + septin.R + k];
    if (materialAt(an, ...p) === Mat.Septin) septinAnchor = p;
  }
  if (septinAnchor) labels.push({ id: 'septin', name: 'Septin ring', material: Mat.Septin, anchor: septinAnchor, size: '≈ 1 µm ring',
    blurb: 'Filaments that form an hourglass collar at the neck. They act as a diffusion barrier between mother and bud and mark where the cell will divide; at cytokinesis the collar splits into two rings.' });
  if (bud) labels.push({ id: 'bud', name: 'Bud (daughter)', anchor: [bud.a[0] - 0.25 * bud.b[0], bud.a[1] - 0.3 * bud.b[1], bud.a[2] + 0.2 * bud.b[2]], size: `≈ ${(2 * bud.b[0]).toFixed(1)} µm`,
    blurb: 'The daughter cell growing out of the mother. Growth is polarised toward the bud tip until it is almost as large as its mother.' });
  if (bridge) labels.push({ id: 'bridge', name: 'Anaphase bridge', material: Mat.Nucleus, anchor: [(bridge.a[0] + bridge.b[0]) / 2, (bridge.a[1] + bridge.b[1]) / 2, (bridge.a[2] + bridge.b[2]) / 2 + 0.15], size: '≈ 0.5 µm thick',
    blurb: 'The nucleus stretched through the neck by the elongating spindle, pulling one set of chromosomes into the bud.' });
  if (budNucleus) labels.push({ id: 'daughter-nucleus', name: 'Daughter nucleus', material: Mat.Nucleus, anchor: awayFrom(budNucleus, budNucleolus), size: '≈ 1.5 µm',
    blurb: 'The daughter\'s own nucleus, with a full set of chromosomes, already in the bud.' });
  if (spindle) labels.push({ id: 'spindle', name: 'Spindle', material: Mat.Spindle, anchor: lerpV(spindle[0], spindle[1], bridge ? 0.08 : 0.5), size: bridge ? '≈ 4 µm and growing' : '≈ 1.5 µm',
    blurb: bridge
      ? 'Microtubules between the two spindle pole bodies, inside the envelope. A fast phase of elongation carries one pole through the neck; a slower one takes the spindle to its full length (Yeh et al. 1995).'
      : 'A short bar of microtubules inside the nucleus, between the two spindle pole bodies embedded in its envelope. It is already aimed through the neck.' });
  if (ring && an.stage >= 4) labels.push({ id: 'ring', name: 'Contractile ring', material: Mat.Ring, anchor: [ring.a[0], ring.a[1], ring.a[2] + ring.R], size: 'a thin band, drawn thicker',
    blurb: an.stage === 5
      ? 'Myosin II and actin, contracting to a point. Yeast can divide without it, more slowly: the septum does much of the work (Bi et al. 1998).'
      : 'Myosin II has sat at the neck since the bud emerged. At the end of anaphase actin joins it, and the ring is ready to contract (Bi et al. 1998).' });
  if (septum) labels.push({ id: 'septum', name: 'Septum', material: Mat.Septum, anchor: [septum.a[0], septum.a[1], septum.a[2] + septum.r + 0.04], size: '',
    blurb: 'A plate of chitin that grows inward behind the ring and seals the neck. What is left of it on the mother is the bud scar.' });
  return labels;
}

function lerpV(a: Vec3, b: Vec3, t: number): Vec3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export const yeast: CellType = {
  id: 'yeast',
  name: 'Budding yeast',
  title: ['Budding', 'Yeast.'],
  tagline: ['A mother and her bud.', 'A little wobble.', 'Cut it open to look inside.'],
  umPerUnit: 1,
  build: buildYeast,
  labels: yeastLabels,
  stages: STAGES,
  stageLabel: 'Cell cycle',
  defaultStage: 2,
  key: [
    { material: Mat.Wall, name: 'Cell wall' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Vacuole, name: 'Vacuole' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Spindle, name: 'Spindle' }, { material: Mat.Septin, name: 'Septin ring' },
    { material: Mat.Ring, name: 'Myosin ring' }, { material: Mat.Septum, name: 'Septum' }, { material: Mat.BudScar, name: 'Bud scars' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Mitochondrion]: 1.3, [Mat.Septin]: 3, [Mat.BudScar]: 4, [Mat.Spindle]: 2.5, [Mat.Ring]: 3, [Mat.Septum]: 4 },
  camera: { dist: 21, yaw: -0.42, pitch: 0.6 },
  help: 'Grab any part (mother, bud or neck) and pull.',
  about: 'Saccharomyces cerevisiae, baker\'s yeast, dividing by budding. The mother (≈ 5 µm) grows a daughter through a narrow neck ringed by septins. A stiff cell wall makes the whole thing much firmer than an animal cell. Play the cycle to the end and the daughter leaves.',
};
