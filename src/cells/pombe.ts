// Fission yeast, Schizosaccharomyces pombe: a rod that grows at its tips and divides in
// the middle. Lengths, the nuclear size and the order of events come from cycle/pombe.ts
// (measured values, with sources). Filament diameters are drawn several times too thick.

import { Mat, Prim, type Anatomy, type BodyPart, type CellType, type Label, type Primitive, type Stage, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, materialAt, primSdf } from '../anatomy/sdf';
import { addTubule, anchorIn, bowl, bowlMid, cone, ell, finish, lerp3, norm3, samplePoint, union } from './common';
import { waistOverlap } from './cycle/geometry';
import { POMBE, pombeDaughterNucleusRadius, pombeLength, pombeNucleusRadius, pombeTipGrowth } from './cycle/pombe';

const UM = 1.25;
const u = (um: number) => um / UM;

/** Cell radius and wall thickness (≈ 0.2 µm) in sim units. */
const R = u(POMBE.diameter / 2);
const WALL = u(0.2);

interface Plan {
  /** Cycle phase the stage is drawn at. */
  phase: number;
  nuclei: 'one' | 'metaphase' | 'anaphase' | 'two';
  /** Interphase microtubule bundles (gone in mitosis, when tubulin builds the spindle). */
  bundles: boolean;
  /** Radius of the ring as a fraction of its full radius (0 = no ring). */
  ring: number;
  /** Waist between the daughters as a fraction of the cell radius (1 = an intact rod). */
  waist: number;
  /** How far the mitochondria have pulled back from the division plane (µm). */
  mitoGap: number;
}

const PLAN: Plan[] = [
  { phase: 0, nuclei: 'one', bundles: true, ring: 0, waist: 1, mitoGap: 0 },
  { phase: POMBE.netoPhase, nuclei: 'one', bundles: true, ring: 0, waist: 1, mitoGap: 0 },
  { phase: POMBE.growthEnd, nuclei: 'one', bundles: true, ring: 0, waist: 1, mitoGap: 0 },
  { phase: 0.8, nuclei: 'metaphase', bundles: false, ring: 1, waist: 1, mitoGap: 0 },
  { phase: 0.85, nuclei: 'anaphase', bundles: false, ring: 1, waist: 1, mitoGap: 0.3 },
  { phase: 0.93, nuclei: 'two', bundles: false, ring: 0.5, waist: 1, mitoGap: 0.6 },
  { phase: 1, nuclei: 'two', bundles: false, ring: 0, waist: 0.5, mitoGap: 0.9 },
];

export const STAGES: Stage[] = [
  { name: 'Born', title: 'Newborn (early G2)', blurb: 'Half of its mother: 7 µm long. S phase was finished before the cells separated, so a newborn fission yeast is already in G2. It grows at one tip only, the old end it inherited.' },
  { name: 'NETO', title: 'New end take-off', blurb: 'At 9.5 µm, a third of the way through the cycle, the end made by the last division starts to grow too, and the cell lengthens about a third faster (Mitchison & Nurse 1985). The birth scar marks where that end began.' },
  { name: 'G2', title: 'Late G2', blurb: 'At 14 µm growth stops. The nucleus has kept pace: it stays near 8 % of the cell volume (Neumann & Nurse 2007), held in the middle by microtubule bundles pushing against both tips.' },
  { name: 'Meta', title: 'Metaphase', blurb: 'Closed mitosis: the envelope stays intact and a short spindle forms inside the nucleus. The interphase microtubules are gone. Around the middle, a band of nodes has condensed into the contractile ring within about 10 minutes (Wu et al. 2003).' },
  { name: 'Ana', title: 'Anaphase B', blurb: 'The spindle elongates to nearly 12 µm and pushes the two nuclei toward the ends; mitochondria travel with the spindle poles. The ring waits, fully assembled, until mitosis is over.' },
  { name: 'Sept', title: 'Septation', blurb: 'The ring closes and a septum of new wall grows inward behind it. It is the wall being built, far more than the ring pulling, that works against turgor (Proctor et al. 2012). The cell outline does not change. G1 and S phase happen now, in the two nuclei.' },
  { name: 'Fiss', title: 'Cell separation', blurb: 'The middle layer of the septum is digested from the outside in. As the daughters part, turgor of about 1.5 MPa bulges each new end into a dome, without any growth (Atilgan et al. 2015).' },
];

/** A vacuole's place in the cell, relative to its size: generated once, so vacuoles keep their identity from stage to stage. */
const VACUOLES = (() => {
  const rand = rng(41);
  return Array.from({ length: 20 }, (_, i) => ({
    side: i % 2 ? 1 : -1,
    s: 0.12 + 0.8 * ((Math.floor(i / 2) + rand() * 0.8) / 10),
    rho: 0.15 + rand() * 0.4,
    theta: rand() * Math.PI * 2,
    r: u(0.27 + rand() * 0.13),
  }));
})();

function build(seed = 7, stage = 2): Anatomy {
  const st = Math.max(0, Math.min(PLAN.length - 1, stage));
  const plan = PLAN[st];
  const Lum = pombeLength(plan.phase);
  const L = u(Lum), half = L / 2;

  // Body: two daughter rods on one axis; while they overlap by a full diameter they are one rod.
  const overlap = waistOverlap(R, plan.waist);
  const k = plan.waist < 1 ? 0.15 : 0;
  const body: BodyPart[] = [
    union(cone([-half + R, 0, 0], [overlap / 2 - R, 0, 0], R, R)),
    union(cone([R - overlap / 2, 0, 0], [half - R, 0, 0], R, R), k),
  ];
  const an = finish({
    cellType: 'pombe', stage: st, body, wallThickness: WALL, cortexDepth: 0.3,
    mesh: { minSpacing: 0.36, maxSpacing: 0.52, minParticles: 120, skinGrid: 0.11 },
    organelles: [], tubules: [], seed,
    ...(st === PLAN.length - 1 ? { fission: { n: [1, 0, 0] as Vec3, d: 0 } } : {}),
  });
  const o = an.organelles;

  // Septum, then the ring that leads it inward.
  const ringTube = 0.06;
  const ringR = (R - WALL - ringTube - 0.04) * plan.ring;
  if (plan.ring > 0 && plan.ring < 1) o.push({ kind: Prim.Disc, material: Mat.Septum, a: [0, 0, 0], b: [u(0.09), 0, 0], R: R - WALL / 2, r: ringR + ringTube });
  if (plan.ring > 0) o.push({ kind: Prim.Torus, material: Mat.Ring, a: [0, 0, 0], b: [1, 0, 0], R: ringR, r: ringTube });
  if (plan.waist < 1) {
    // the closed septum, now splitting into the two new ends: it fills the bridge between the daughters
    let w = 0;
    while (w < R && cellSdf(an, 0, 0, w + 0.005) < 0) w += 0.005;
    o.push({ kind: Prim.Disc, material: Mat.Septum, a: [0, 0, 0], b: [u(0.09), 0, 0], R: w, r: 0 });
  }

  // Birth scar: where the new end (+x) began. It is left behind as that end grows after NETO.
  o.push({ kind: Prim.Torus, material: Mat.BudScar, a: [half - R - u(pombeTipGrowth(plan.phase).newEnd), 0, 0], b: [1, 0, 0], R, r: 0.045 });

  // Nuclei: one in the middle; a dumbbell around the anaphase spindle; then one per daughter.
  const rn = u(pombeNucleusRadius(Lum)), rd = u(pombeDaughterNucleusRadius(Lum));
  const nuclei: { c: Vec3; r: number }[] = [];
  let spindle: [Vec3, Vec3] | null = null;
  if (plan.nuclei === 'one' || plan.nuclei === 'metaphase') {
    nuclei.push({ c: [0, 0, 0], r: rn });
    if (plan.nuclei === 'metaphase') spindle = [[-(rn - 0.12), 0, 0], [rn - 0.12, 0, 0]];
  } else if (plan.nuclei === 'anaphase') {
    // late anaphase B: spindle 11 µm, under the measured maximum of 11.9 ± 0.9 µm
    const pole = u(11 / 2);
    nuclei.push({ c: [-(pole - rd + 0.1), 0, 0], r: rd }, { c: [pole - rd + 0.1, 0, 0], r: rd });
    spindle = [[-pole, 0, 0], [pole, 0, 0]];
  } else {
    // each nucleus back in the middle of its own half
    nuclei.push({ c: [-half / 2, 0, 0], r: rd }, { c: [half / 2, 0, 0], r: rd });
  }
  const mt = { organelles: o, tubules: an.tubules };
  if (spindle) addTubule(mt, spindle, 0.05, Mat.Spindle);
  // Nucleolus: a cap on one side of each nucleus, off the spindle axis.
  for (const n of nuclei) o.push(ell([n.c[0], n.c[1] - 0.5 * n.r, n.c[2] + 0.2 * n.r], [0.5 * n.r, 0.34 * n.r, 0.46 * n.r], Mat.Nucleolus));
  const nucleusPrims: Primitive[] = nuclei.map((n) => ell(n.c, [n.r, n.r, n.r], Mat.Nucleus));
  o.push(...nucleusPrims);
  // the envelope stretched around the spindle between the two lobes
  if (plan.nuclei === 'anaphase') o.push({ kind: Prim.Capsule, material: Mat.Nucleus, a: nuclei[0].c, b: nuclei[1].c, R: 0, r: 0.13 });

  // Interphase microtubules: bundles along the long axis, passing the nucleus, reaching toward both tips.
  if (plan.bundles) {
    for (let i = 0; i < POMBE.mtBundles; i++) {
      const th = Math.PI / 2 + (i * 2 * Math.PI) / POMBE.mtBundles;
      const at = (x: number, rho: number): Vec3 => [x, rho * Math.cos(th), rho * Math.sin(th)];
      const tip = half - 0.45, mid = rn + 0.1;
      // drawn dynamic: each end grows to the tip, pauses and collapses (cycle/dynamics.ts)
      addTubule(mt, [at(-tip, 0.2), at(-tip / 2, 0.7 * mid), at(0, mid), at(tip / 2, 0.7 * mid), at(tip, 0.2)], 0.045, Mat.Spindle, 'instability');
    }
  }

  // Mitochondria: tubules along the microtubules' direction, just under the cortex. Each is drawn
  // as two halves that meet at the middle, so that at division they simply part (Dnm1 cuts them).
  const rand = rng(seed);
  const rho = R - 0.42, gap = u(plan.mitoGap);
  for (let i = 0; i < 4; i++) {
    const th = Math.PI / 4 + (i * Math.PI) / 2, wob = 0.25 + rand() * 0.2, ph = rand() * 6;
    for (const side of [-1, 1]) {
      const x0 = side * Math.max(gap, 0.02), x1 = side * (half - 0.75 * R);
      const pts: Vec3[] = [];
      for (let j = 0; j <= 4; j++) {
        const x = x0 + ((x1 - x0) * j) / 4, a = th + wob * Math.sin(ph + 1.3 * x);
        pts.push([x, rho * Math.cos(a), rho * Math.sin(a)]);
      }
      addTubule(mt, pts, 0.11, Mat.Mitochondrion);
    }
  }

  // Vacuoles: many small ones, more as the cell grows, shared between the two halves.
  const count = Math.round(Lum * 1.4);
  for (const v of VACUOLES.slice(0, count)) {
    const c: Vec3 = [v.side * v.s * (half - R * 0.8), v.rho * Math.cos(v.theta), v.rho * Math.sin(v.theta)];
    // keep clear of the nuclei and of the division plane once the ring is there
    for (const n of nuclei) {
      const need = n.r + v.r + 0.08;
      if (Math.hypot(c[0] - n.c[0], c[1] - n.c[1], c[2] - n.c[2]) < need) {
        const lat = Math.hypot(c[1] - n.c[1], c[2] - n.c[2]);
        c[0] = n.c[0] + (c[0] >= n.c[0] ? 1 : -1) * Math.sqrt(Math.max(0, need * need - lat * lat));
      }
    }
    if (plan.ring > 0 || plan.waist < 1) c[0] = v.side * Math.max(Math.abs(c[0]), v.r + 0.3);
    if (cellSdf(an, ...c) < -(v.r + WALL)) o.push(ell(c, [v.r, v.r, v.r], Mat.Vacuole));
  }

  // Endoplasmic reticulum and Golgi, with their own random sequence so that everything above stays
  // where it was. As in budding yeast, the ER is the nuclear envelope plus a network lying against
  // the plasma membrane; it is drawn as tubules running the length of the cell under the wall,
  // interrupted where the septum grows. Their number and course are a drawing.
  const divided = plan.ring > 0 || plan.waist < 1;
  const erRho = R - WALL - 0.08, erGap = 0.35;
  for (let k = 0; k < 5; k++) {
    const t = (k / 5) * 2 * Math.PI + 0.4, y = erRho * Math.cos(t), z = erRho * Math.sin(t);
    const spans: [number, number][] = divided ? [[-half + R, -erGap], [erGap, half - R]] : [[-half + R, half - R]];
    for (const [x0, x1] of spans) addTubule(mt, [0, 1 / 3, 2 / 3, 1].map((f) => [x0 + (x1 - x0) * f, y, z] as Vec3), 0.03, Mat.ER);
  }
  // Golgi: unlike baker's yeast, fission yeast keeps its cisternae in small stacks. Four are drawn,
  // each of three cupped cisternae; the number of stacks and of cisternae is not a measured value.
  const golgiRand = rng(seed + 523);
  const clear = (p: Vec3) => cellSdf(an, ...p) < -(WALL + 0.3) && o.every((q) => primSdf(q, ...p) > 0.3) && (!divided || Math.abs(p[0]) > 0.6);
  for (let s = 0; s < 4; s++) {
    const side = s % 2 ? 1 : -1;
    const g = samplePoint(golgiRand, side < 0 ? [-half + R, -R, -R] : [0.2, -R, -R], side < 0 ? [-0.2, R, R] : [half - R, R, R], clear);
    const axis = norm3([golgiRand() - 0.5, golgiRand() - 0.5, golgiRand() - 0.5]);
    if (g) for (let i = 0; i < 3; i++) o.push(bowl([g[0] - axis[0] * 0.8, g[1] - axis[1] * 0.8, g[2] - axis[2] * 0.8], axis, 0.8 + (i - 1) * 0.07, 0.4, 0.018, Mat.Golgi));
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const all = (m: number) => an.organelles.filter((x) => x.material === m);
  const st = an.stage;
  const half = (an.bounds.hi[0] - an.bounds.lo[0]) / 2;
  const nuclei = all(Mat.Nucleus).filter((x) => x.kind === Prim.Ellipsoid);
  const nucleolus = all(Mat.Nucleolus)[0];
  const n0 = nuclei[0], rn = n0.b[0];
  const mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!;
  const vacuole = all(Mat.Vacuole).find((v) => materialAt(an, ...v.a) === Mat.Vacuole)!;
  const scar = all(Mat.BudScar)[0];
  const ring = all(Mat.Ring)[0], septum = all(Mat.Septum)[0];
  const spindles = an.tubules.filter((t) => t.material === Mat.Spindle);
  const mitotic = st === 3 || st === 4;
  const out: Label[] = [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [n0.a[0], n0.a[1] + 0.4 * rn, n0.a[2] + 0.45 * rn], size: `≈ ${(2 * rn * UM).toFixed(1)} µm across`,
      blurb: nuclei.length > 1
        ? 'One of the two daughter nuclei. The envelope never broke down. For one sphere to become two of the same total volume its area has to grow by about a quarter, and the envelope does expand rapidly in mitosis (Neumann & Nurse 2007).'
        : 'Three chromosomes. Its volume stays close to 8 % of the cell\'s over a 35-fold range of cell sizes, whatever the DNA content (Neumann & Nurse 2007). Its position decides where the cell will divide.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 1 µm',
      blurb: 'Where ribosomes are made: a cap that fills one side of the nucleus.' },
    { id: 'wall', name: 'Cell wall', material: Mat.Wall, anchor: [-half / 2, R - 0.06, 0], size: '≈ 0.2 µm thick',
      blurb: 'Glucans and galactomannan. Stiff (about 50 MPa) and inflated by a turgor pressure of about 1.5 MPa (Atilgan et al. 2015): the rod shape is the wall\'s, and the cell grows only where the wall is remodelled, at the tips.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito.points[1], mito.points[2], 0.5), size: '≈ 0.3 µm thick',
      blurb: st >= 5
        ? 'Cut by the dynamin Dnm1 where the cell divides, so that each daughter keeps its share (Jourdain et al. 2009).'
        : 'Long tubules lying along the microtubules. They are not carried along them: they are pulled out and retracted by growing and shrinking microtubule ends (Yaffe et al. 2003).' },
    { id: 'vacuole', name: 'Vacuoles', material: Mat.Vacuole, anchor: vacuole.a, size: '≈ 0.5 µm each',
      blurb: 'Many small vacuoles rather than one large one. In water they fuse within minutes into a few large ones, and in salt they fragment: a way to keep the cytosol at the right concentration (Bone et al. 1998).' },
    { id: 'scar', name: 'Birth scar', anchor: [scar.a[0], R - 0.1, 0], size: 'a ring around the cell',
      blurb: 'A ridge left where the previous septum joined the side wall. The wall beyond it is the new end. Until NETO the scar stays at the base of that end; afterwards the end grows away from it.' },
  ];
  if (st <= 2) {
    const b = spindles[0].points;
    out.push(
      { id: 'mt', name: 'Microtubule bundle', material: Mat.Spindle, anchor: lerp3(b[1], b[2], 0.6), size: '25 nm filaments, drawn thicker; shown 60× faster',
        blurb: 'Three or four bundles run the length of the cell, growing ends toward the tips. Each end grows at about 1.9 µm a minute, pushes on the tip for a minute and a half, then collapses back to the nucleus and starts again. Each push shoves the nucleus back: the balance keeps it in the middle (Tran et al. 2001).' },
      { id: 'old-end', name: 'Old end', anchor: [-half + 0.5, 0, 0.3], size: '',
        blurb: 'The tip inherited from the mother. It grows from birth.' },
      { id: 'new-end', name: 'New end', anchor: [half - 0.5, 0, 0.3], size: '',
        blurb: st === 0 ? 'Made by the last division. It will not grow until NETO.' : st === 1 ? 'Just starting to grow: new end take-off.' : 'Growing since NETO: the cell now extends at both tips.' });
  }
  if (mitotic) {
    const s = spindles[0].points;
    out.push({ id: 'spindle', name: 'Spindle', material: Mat.Spindle, anchor: lerp3(s[0], s[1], 0.5), size: st === 3 ? `≈ ${(2 * rn * UM).toFixed(1)} µm` : '≈ 11 µm',
      blurb: st === 3
        ? 'A bar of microtubules between the two spindle pole bodies, inside the intact nucleus. It holds a constant length while the chromosomes attach.'
        : 'Elongating at its middle, where microtubules from the two poles overlap. It reaches 11.9 ± 0.9 µm in wild-type cells, and scales with cell length (Krüger et al. 2019).' });
  }
  if (ring) out.push({ id: 'ring', name: 'Contractile ring', material: Mat.Ring, anchor: [0, 0, ring.R], size: 'a thin band, drawn thicker',
    blurb: st === 5
      ? 'Actin and myosin II, closing. It started to constrict about 37 minutes after the spindle poles separated (Wu et al. 2003), and guides the septum that grows behind it.'
      : 'Actin, myosin II and formin. It condensed from a band of membrane-bound nodes placed by the nucleus (Daga & Chang 2005), and now waits for the end of anaphase.' });
  if (septum && st === 5) out.push({ id: 'septum', name: 'Septum', material: Mat.Septum, anchor: [0, 0, (septum.R - WALL / 2 + septum.r) / 2], size: '',
    blurb: 'New wall laid down as a closing diaphragm: a primary septum flanked by two secondary ones, which will become the daughters\' new ends.' });
  if (st === 6) out.push({ id: 'new-ends', name: 'New cell ends', anchor: [0.3, 0, 0.2], size: '',
    blurb: 'The two halves of the septum, now the daughters\' new ends. They are softer than the side wall and bulge into domes under turgor as the cells part.' });
  const erTubes = an.tubules.filter((t) => t.material === Mat.ER), stacks = all(Mat.Golgi);
  if (erTubes.length) out.push({ id: 'er', name: 'Cortical ER', material: Mat.ER, anchor: anchorIn(an, erTubes.flatMap((t) => t.points.slice(1, -1)), Mat.ER), size: 'tubules and sheets under the membrane, drawn as tubules',
    blurb: 'The endoplasmic reticulum of a yeast is its nuclear envelope plus a network lying flat against the plasma membrane, joined by a few tubules. Here the cortical network is drawn as five tubules running the length of the cell. It is cut in two with the cell at division.' });
  if (stacks.length) out.push({ id: 'golgi', name: 'Golgi stack', material: Mat.Golgi, anchor: anchorIn(an, stacks.map(bowlMid), Mat.Golgi), size: 'drawn ≈ 0.5 µm across',
    blurb: 'Fission yeast keeps its Golgi cisternae in small stacks, as animal and plant cells do, where baker\'s yeast has them scattered singly. The number of stacks and of cisternae drawn is not a measured value.' });
  return out;
}

export const pombe: CellType = {
  id: 'pombe',
  name: 'Fission yeast',
  title: ['Fission', 'Yeast.'],
  tagline: ['A rod that grows at its tips', 'and splits in the middle.', 'Play its cycle to the end.'],
  umPerUnit: UM,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Cell cycle',
  defaultStage: 2,
  key: [
    { material: Mat.Wall, name: 'Cell wall' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.ER, name: 'ER' }, { material: Mat.Golgi, name: 'Golgi stacks' },
    { material: Mat.Spindle, name: 'Microtubules' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Vacuole, name: 'Vacuoles' }, { material: Mat.Ring, name: 'Contractile ring' },
    { material: Mat.Septum, name: 'Septum' }, { material: Mat.BudScar, name: 'Birth scar' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Nucleus]: 2, [Mat.Nucleolus]: 2.5, [Mat.Vacuole]: 0.7, [Mat.Mitochondrion]: 1.3, [Mat.Spindle]: 2.5, [Mat.Ring]: 3, [Mat.Septum]: 4, [Mat.BudScar]: 4 },
  camera: { dist: 27, yaw: -0.42, pitch: 0.62 },
  help: 'Grab an end and bend the rod, or press play and watch it divide.',
  about: 'Schizosaccharomyces pombe. A cylinder 3.6 µm wide that only ever grows in length, from 7 to 14 µm, then builds a wall across its middle. Most of its cycle is G2; mitosis is closed, inside an intact nuclear envelope. Microtubules and the two rings are drawn thicker than life so that they can be seen.',
};
