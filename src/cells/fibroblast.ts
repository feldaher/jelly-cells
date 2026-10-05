// A fibroblast spread on a surface: a thin lamella with a nuclear hump, a
// leading-edge lamellipodium and a trailing tail. Stress fibres run along its
// base and end in focal adhesions. Drawn ≈ 4× smaller than life.
// The Golgi and centrosome sit beside the nucleus and swing to its front when the cell
// polarises (Kupfer et al. 1982), with the nucleus pulled rearward (Gomes et al. 2005);
// adhesion lengths follow Goffin et al. 2006.

import { Mat, type Anatomy, type BodyPart, type CellType, type Label, type Stage, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, materialAt, primSdf } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, lerp3, union, wander } from './common';

export const STAGES: Stage[] = [
  { name: 'Round', title: 'Rounded', blurb: 'Just landed in the wound bed: round, with a thin skirt of membrane feeling for the matrix. Only small nascent adhesions so far.' },
  { name: 'Spread', title: 'Spreading', blurb: 'The cell flattens into a pancake. Adhesions mature at its edge and radial actin fibres begin to pull on them.' },
  { name: 'Migrate', title: 'Migrating', blurb: 'Polarised and crawling into the wound: a leading lamellipodium, a trailing tail, and stress fibres anchored in focal adhesions. The nucleus has moved to the rear, leaving the centrosome and Golgi in front of it, facing the wound.' },
  { name: 'Myofib.', title: 'Myofibroblast', blurb: 'Under tension and TGF-β the fibroblast becomes a myofibroblast: thick α-smooth-muscle-actin fibres anchored in "supermature" adhesions 8–30 µm long pull the wound closed. If it persists, fibrosis and scarring follow.' },
];

interface Plan {
  body: BodyPart[];
  nucleus: { c: Vec3; r: Vec3 };
  /** Mid-height of the lamella, where fibre ends are measured. */
  midY: number;
  fibres: 'none' | 'radial' | 'parallel' | 'thick';
  flatMito: boolean;
  /** Direction (angle in the xz plane, 0 = the leading edge) in which the Golgi and centrosome lie from the nucleus. */
  golgi: number;
}

/** Where the Golgi points before the cell has a front: any direction will do. */
const UNPOLARISED = 2.2;

function planFor(stage: number): Plan {
  switch (stage) {
    case 0: return {
      body: [union(ell([0, 1.75, 0], [2.3, 1.7, 2.3])), union(ell([0, 0.32, 0], [3.0, 0.32, 3.0]), 0.8)],
      nucleus: { c: [0, 1.8, 0], r: [1.2, 1.0, 1.1] }, midY: 0.32, fibres: 'none', flatMito: false, golgi: UNPOLARISED,
    };
    case 1: return {
      body: [union(ell([0, 0.45, 0], [3.8, 0.45, 3.6])), union(ell([0, 0.8, 0], [1.7, 0.8, 1.5]), 0.8)],
      nucleus: { c: [0, 0.8, 0], r: [1.4, 0.52, 1.15] }, midY: 0.45, fibres: 'radial', flatMito: true, golgi: UNPOLARISED,
    };
    case 3: return {
      body: [
        union(ell([0, 0.5, 0], [5.2, 0.5, 3.0])),
        union(ell([0.3, 0.8, 0], [1.9, 0.8, 1.5]), 0.8),
        union(ell([-1.6, 0.4, 2.7], [1.7, 0.4, 1.3]), 0.8),
        union(ell([2.4, 0.4, -2.7], [1.7, 0.4, 1.3]), 0.8),
      ],
      nucleus: { c: [0.3, 0.8, 0], r: [1.5, 0.52, 1.1] }, midY: 0.5, fibres: 'thick', flatMito: true, golgi: 0,
    };
    default: return {
      body: [
        union(ell([0, 0.45, 0], [4.6, 0.45, 2.4])),
        union(ell([-0.7, 0.75, 0], [1.9, 0.75, 1.4]), 0.8),
        union(ell([3.9, 0.36, 0], [1.5, 0.36, 3.0]), 0.8),
        union(cone([-3.8, 0.42, 0.1], [-6.2, 0.4, 0.6], 0.75, 0.4), 0.6),
      ],
      // the nucleus sits behind the cell centre, the centrosome stays near it
      nucleus: { c: [-0.7, 0.75, 0], r: [1.45, 0.5, 1.05] }, midY: 0.36, fibres: 'parallel', flatMito: true, golgi: 0,
    };
  }
}

function build(seed = 7, stage = 2): Anatomy {
  const st = Math.max(0, Math.min(3, stage));
  const plan = planFor(st);
  const rand = rng(seed);
  const an = finish({
    cellType: 'fibroblast',
    stage: st,
    body: plan.body,
    wallThickness: 0.06,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
  const o = an.organelles;
  const nc = plan.nucleus.c;
  const nucleus = ell(nc, plan.nucleus.r, Mat.Nucleus);
  o.push(ell([nc[0] - 0.3, nc[1] + 0.1, nc[2] + 0.3], [0.28, 0.2, 0.28], Mat.Nucleolus), ell([nc[0] + 0.45, nc[1] + 0.05, nc[2] - 0.3], [0.24, 0.18, 0.24], Mat.Nucleolus), nucleus);

  // Centrosome and Golgi: beside the nucleus, in the lamella (or beside it in the rounded cell).
  const gy = plan.fibres === 'none' ? nc[1] : plan.body[0].prim.a[1];
  const beside = (th: number, out: number): Vec3 => {
    const cx = Math.cos(th), cz = Math.sin(th);
    const edge = 1 / Math.hypot(cx / plan.nucleus.r[0], cz / plan.nucleus.r[2]);
    return [nc[0] + cx * (edge + out), gy, nc[2] + cz * (edge + out)];
  };
  o.push(ell(beside(plan.golgi, 0.16), [0.08, 0.08, 0.08], Mat.Spindle));
  const golgi = [-0.36, 0, 0.36].map((d) => beside(plan.golgi + d, 0.5));
  for (const g of golgi) o.push(ell(g, [0.2, 0.09, 0.22], Mat.Golgi));

  // Actin fibres along the base, anchored in adhesions at their ends.
  const yF = 0.18;
  /** From (x, z), walk along (dx, dz) until near the edge, then back off so an adhesion plaque fits. */
  /** Height of the cell's underside at (x, z): the flattened body curves up toward its rim. */
  const baseY = (x: number, z: number) => {
    let y = 0;
    while (y < plan.midY && cellSdf(an, x, y, z) > 0) y += 0.01;
    return y;
  };
  // Adhesion plaques (half-length, half-height, half-width): 2–6 µm long, or 8–30 µm "supermature"
  // ones in the myofibroblast (Goffin et al. 2006). Here 2.6 µm and 8.8 µm.
  const big = plan.fibres === 'thick';
  const plaque: Vec3 = big ? [1.1, 0.08, 0.24] : [0.32, 0.07, 0.16];
  const edge = (x: number, z: number, dx: number, dz: number): Vec3 => {
    let t = 0;
    while (t < 12 && cellSdf(an, x + dx * (t + 0.05), plan.midY, z + dz * (t + 0.05)) < -0.3) t += 0.05;
    const px = (u: number) => x + dx * u, pz = (u: number) => z + dz * u;
    while (t > 0.5 && (cellSdf(an, px(t + plaque[0] + 0.03), baseY(px(t), pz(t)) + 0.14, pz(t + plaque[0] + 0.03)) > -0.08 || cellSdf(an, px(t), baseY(px(t), pz(t)) + 0.14, pz(t)) > -0.12)) t -= 0.05;
    return [px(t), Math.max(yF, baseY(px(t), pz(t)) + 0.18), pz(t)];
  };
  const fibres: Vec3[][] = [];
  if (plan.fibres === 'parallel' || plan.fibres === 'thick') {
    const zs = plan.fibres === 'thick' ? [-1.9, -1.35, -0.8, -0.27, 0.27, 0.8, 1.35, 1.9] : [-1.3, -0.65, 0, 0.65, 1.3];
    for (const z of zs) {
      const tilt = (rand() - 0.5) * 0.5 / 4;
      const l = Math.hypot(1, tilt);
      fibres.push([edge(0, z, -1 / l, -tilt / l), edge(0, z, 1 / l, tilt / l)]);
    }
  } else if (plan.fibres === 'radial') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.3;
      const start: Vec3 = [Math.cos(a) * 1.9, yF, Math.sin(a) * 1.7];
      fibres.push([start, edge(start[0], start[2], Math.cos(a), Math.sin(a))]);
    }
  }
  for (const f of fibres) {
    const ends = plan.fibres === 'radial' ? [f[1]] : f;
    for (const e of ends) o.push(ell([e[0], e[1] - 0.04, e[2]], plaque, Mat.Adhesion));
  }
  if (plan.fibres === 'none') {
    // nascent adhesions: small dots under the skirt
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      o.push(ell([Math.cos(a) * 1.9, 0.14, Math.sin(a) * 1.9], [0.16, 0.07, 0.16], Mat.Adhesion));
    }
  }
  for (const [a, b] of fibres) addTubule(an, [a, lerp3(a, b, 0.33), lerp3(a, b, 0.66), b], big ? 0.1 : 0.07, Mat.Actin);

  // Mitochondria wander through the cytoplasm around the nucleus.
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.28 && primSdf(nucleus, ...p) > 0.12 && golgi.every((g) => Math.hypot(p[0] - g[0], p[2] - g[2]) > 0.45);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const r = plan.flatMito ? 1.9 : 1.55;
    const start: Vec3 = [nc[0] + Math.cos(ang) * r, plan.flatMito ? plan.midY : nc[1] - 0.2, nc[2] + Math.sin(ang) * r * 0.8];
    if (!ok(start)) continue;
    addTubule(an, wander(rand, start, [Math.cos(ang), 0, Math.sin(ang)], 5, 0.45, ok, plan.flatMito), 0.1, Mat.Mitochondrion);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const nuc = an.organelles.find((x) => x.material === Mat.Nucleus)!;
  const nucleolus = an.organelles.find((x) => x.material === Mat.Nucleolus)!;
  // the most deeply embedded adhesion, so its label is clear of the cortex
  const adhesion = an.organelles.filter((x) => x.material === Mat.Adhesion).sort((p, q) => cellSdf(an, ...p.a) - cellSdf(an, ...q.a))[0];
  const len = (t: { points: Vec3[] }) => Math.hypot(...([0, 1, 2].map((k) => t.points[t.points.length - 1][k] - t.points[0][k]) as Vec3));
  // a point on the longest fibre that is not hidden under the nucleus or an adhesion
  const fibreAt = an.tubules.filter((t) => t.material === Mat.Actin).sort((a, b) => len(b) - len(a))
    .flatMap((t) => [0.5, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75].map((u) => lerp3(t.points[0], t.points[t.points.length - 1], u)))
    .find((p) => materialAt(an, ...p) === Mat.Actin);
  // a mitochondrial segment not crossed by a fibre
  const mids = an.tubules.filter((t) => t.material === Mat.Mitochondrion).flatMap((t) => t.points.slice(1).map((p, i) => lerp3(t.points[i], p, 0.5)));
  const mitoAt = mids.find((p) => materialAt(an, ...p) === Mat.Mitochondrion) ?? mids[0];
  const labels: Label[] = [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nuc.a[0] - 0.55, nuc.a[1] - 0.05, nuc.a[2] - 0.3], size: '≈ 12 µm across',
      blurb: 'Flattened by the spread cell above it. Stress fibres press down on it, so the nucleus itself feels how hard the cell is pulling.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 2 µm',
      blurb: 'Ribosome factories. Fibroblasts often show two or three.' },
    { id: 'adhesion', name: an.stage === 0 ? 'Nascent adhesion' : 'Focal adhesion', material: Mat.Adhesion, anchor: adhesion.a, size: an.stage === 0 ? '< 0.5 µm' : an.stage === 3 ? '8–30 µm long, "supermature"' : '2–6 µm long',
      blurb: an.stage === 3
        ? 'Integrin clusters grown to 8–30 µm. They bear about four times the stress of ordinary adhesions, and only fibres anchored in them are tense enough to recruit α-smooth-muscle actin (Goffin et al. 2006).'
        : 'Integrin clusters that anchor the cell to the extracellular matrix. They grow under tension: a mechanosensing hub (talin, vinculin, FAK).' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: mitoAt, size: '≈ 0.5 µm thick',
      blurb: 'Spread through the cytoplasm, powering the myosin motors that keep the fibres under tension.' },
  ];
  const golgi = an.organelles.find((x) => x.material === Mat.Golgi)!, mtoc = an.organelles.find((x) => x.material === Mat.Spindle)!;
  const polarised = an.stage >= 2;
  labels.push(
    { id: 'golgi', name: 'Golgi apparatus', material: Mat.Golgi, anchor: golgi.a, size: '',
      blurb: polarised
        ? 'Stacked cisternae that sort and ship membrane and matrix proteins. In a cell at a wound edge the Golgi turns to face the wound within minutes (Kupfer et al. 1982), so that new membrane and collagen are delivered to the front.'
        : 'Stacked cisternae that sort and ship membrane and matrix proteins, gathered around the centrosome on one side of the nucleus. Which side is arbitrary until the cell picks a direction.' },
    { id: 'centrosome', name: 'Centrosome', material: Mat.Spindle, anchor: mtoc.a, size: '',
      blurb: polarised
        ? 'The microtubule-organising centre. It stays near the middle of the cell while the nucleus is pulled rearward by actin flowing back from the leading edge: that is how it comes to lie in front of the nucleus (Gomes et al. 2005).'
        : 'Two centrioles from which the microtubules radiate. The Golgi gathers around it.' });
  if (fibreAt) labels.push({ id: 'fibre', name: an.stage === 3 ? 'α-SMA stress fibre' : an.stage === 1 ? 'Radial fibre' : 'Stress fibre', material: Mat.Actin, anchor: fibreAt, size: an.stage === 3 ? '≈ 0.5 µm thick' : '≈ 0.3 µm thick',
    blurb: an.stage === 3
      ? 'Thick bundles containing α-smooth-muscle actin: the myofibroblast contracts like a muscle cell and pulls the wound edges together.'
      : 'A contractile bundle of actin and myosin II. Stress fibres pull on the substrate and are how a fibroblast senses and remodels matrix stiffness.' });
  if (an.stage === 0) labels.push({ id: 'skirt', name: 'Spreading skirt', anchor: [2.5, 0.3, 0.5], size: '',
    blurb: 'The first contact with the matrix: a thin rim of membrane that probes the surface before the cell commits to spreading.' });
  if (an.stage === 1) labels.push({ id: 'edge', name: 'Spreading edge', anchor: [3.3, 0.45, 0.5], size: '≈ 0.2 µm thin',
    blurb: 'Actin polymerising at the edge pushes the membrane out in all directions; the cell is not yet polarised.' });
  if (an.stage === 2) labels.push(
    { id: 'lamellipodium', name: 'Lamellipodium', anchor: [4.3, 0.36, 0.4], size: '≈ 0.2 µm thin',
      blurb: 'The leading edge: a sheet pushed forward by a branched actin network. It is how the cell crawls into a wound.' },
    { id: 'tail', name: 'Trailing edge', anchor: [-5.2, 0.4, 0.4], size: '',
      blurb: 'The rear of a migrating cell. Adhesions here must let go for the cell to move forward.' });
  return labels;
}

export const fibroblast: CellType = {
  id: 'fibroblast',
  name: 'Fibroblast',
  title: ['Fibro-', 'blast.'],
  tagline: ['Flat, spread and pulling.', 'The cell that closes wounds.', 'Cut it to find its fibres.'],
  umPerUnit: 4,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Wound response',
  defaultStage: 2,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Actin, name: 'Stress fibres' }, { material: Mat.Adhesion, name: 'Focal adhesions' },
    { material: Mat.Mitochondrion, name: 'Mitochondria' }, { material: Mat.Golgi, name: 'Golgi apparatus' },
    { material: Mat.Spindle, name: 'Centrosome' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 3, [Mat.Nucleolus]: 3, [Mat.Actin]: 5, [Mat.Adhesion]: 3 },
  camera: { dist: 25, yaw: -0.35, pitch: 0.8 },
  help: 'Grab the leading edge and drag it, or lift the nucleus.',
  about: 'A dermal fibroblast crawling on a surface, drawn about four times smaller than life. It is flat, a few µm at the nucleus and thinner at the edges. Stress fibres anchored in focal adhesions let it pull on the matrix: a textbook mechanosensor.',
};
