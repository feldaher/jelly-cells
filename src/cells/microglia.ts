// A microglial cell, from surveilling (a small soma with a crown of thin, branching
// processes that constantly probe the brain) to amoeboid (round and phagocytic).

import { Mat, type Anatomy, type BodyPart, type CellType, type Label, type Stage, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { add3, addTubule, anchorIn, bowlMid, cone, ell, finish, golgiRibbon, lerp3, norm3, samplePoint, scale3, union, wander } from './common';

/** How far along activation each stage is: process length, thickness, branching, soma size, lysosomes. */
const PLAN = [
  { len: 1, R: 0.62, r: 0.4, branches: 2, soma: 1, lysosomes: [0.42, 0.28, 0.24, 0.2, 0.2, 0.17] },
  { len: 0.85, R: 0.66, r: 0.44, branches: 1, soma: 1.05, lysosomes: [0.42, 0.3, 0.26, 0.22, 0.2, 0.18, 0.17] },
  { len: 0.55, R: 0.78, r: 0.56, branches: 0, soma: 1.15, lysosomes: [0.46, 0.34, 0.3, 0.26, 0.24, 0.22, 0.2, 0.18, 0.17] },
  { len: 0.26, R: 0.95, r: 0.8, branches: 0, soma: 1.3, lysosomes: [0.52, 0.46, 0.36, 0.32, 0.28, 0.26, 0.24, 0.22, 0.2, 0.2, 0.18, 0.17] },
];

export const STAGES: Stage[] = [
  { name: 'Surveil', title: 'Surveilling', blurb: 'The healthy brain: a small soma and long, fine, branching processes that never rest. They extend and retract minute by minute, sampling their surroundings (Nimmerjahn et al. 2005).' },
  { name: 'Primed', title: 'Primed', blurb: 'After a first insult or with ageing: processes a little shorter and thicker, fewer branches, more lysosomes. The cell over-reacts to the next hit.' },
  { name: 'Reactive', title: 'Reactive', blurb: 'Within minutes of an injury, ATP from damaged cells (sensed by P2Y12) draws the process tips toward the lesion, while the soma stays put (Davalos et al. 2005). Over the following hours the processes retract and thicken, the soma swells, and P2Y12 is switched off (Haynes et al. 2006).' },
  { name: 'Amoeboid', title: 'Amoeboid', blurb: 'The phagocytic state: round, mobile, with stubby pseudopods and a cytoplasm crowded with phagolysosomes full of debris.' },
];

const SOMA_R: Vec3 = [1.6, 1.35, 1.5];

function build(seed = 7, stage = 0): Anatomy {
  const plan = PLAN[Math.max(0, Math.min(PLAN.length - 1, stage))];
  const rand = rng(seed);
  const somaR = scale3(SOMA_R, plan.soma);
  const soma: Vec3 = [0, somaR[1] + 0.1, 0];
  const body: BodyPart[] = [union(ell(soma, somaR))];
  const primaries: { a: Vec3; b: Vec3 }[] = [];
  const secondaries: BodyPart[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const dir = norm3([Math.cos(th), -0.2 + (rand() - 0.5) * 0.15, Math.sin(th)]);
    const a = add3(soma, scale3([dir[0], 0, dir[2]], 1.1 * plan.soma));
    const len = (3.1 + rand() * 0.8) * plan.len + 0.4;
    const b = add3(a, scale3(dir, len));
    b[1] = Math.max(0.1 + plan.r, b[1]);
    primaries.push({ a, b });
    body.push(union(cone(a, b, plan.R, plan.r), 0.5));
    // side branches: two at most while surveilling, none once activated
    const branches = plan.branches === 2 ? 1 + (rand() < 0.5 ? 1 : 0) : plan.branches;
    const turns = [rand(), rand()];
    for (let k = 0; k < branches; k++) {
      const at = lerp3(a, b, 0.55 + turns[k] * 0.2);
      const turn = (k === 0 ? 1 : -1) * (0.6 + turns[k] * 0.3);
      const bd = norm3([Math.cos(th + turn), -0.1, Math.sin(th + turn)]);
      const tip = add3(at, scale3(bd, (1.5 + turns[k] * 0.6) * plan.len));
      tip[1] = Math.max(0.42, tip[1]);
      secondaries.push(union(cone(at, tip, 0.42, 0.36), 0.3));
    }
  }
  const an = finish({
    cellType: 'microglia',
    stage,
    body: [...body, ...secondaries],
    wallThickness: 0.08,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
  const o = an.organelles;
  const nc: Vec3 = [soma[0] - 0.15, soma[1], soma[2] + 0.1];
  const nucleus = ell(nc, [1.0, 0.72, 0.82], Mat.Nucleus);
  o.push(ell([nc[0] - 0.25, nc[1] + 0.15, nc[2] + 0.2], [0.22, 0.18, 0.22], Mat.Nucleolus), nucleus);
  // Lysosomes and phagolysosomes, in the cytoplasm around the nucleus.
  const somaEll = ell(soma, somaR);
  const inSoma = (p: Vec3, r: number) => primSdf(somaEll, ...p) < -r - 0.2 && primSdf(nucleus, ...p) > r + 0.08
    && o.filter((x) => x.material === Mat.Lysosome).every((l) => Math.hypot(l.a[0] - p[0], l.a[1] - p[1], l.a[2] - p[2]) > l.b[0] + r + 0.05);
  const lo = add3(soma, scale3(somaR, -0.9)), hi = add3(soma, scale3(somaR, 0.9));
  for (const r of plan.lysosomes) {
    const p = samplePoint(rand, lo, hi, (q) => inSoma(q, r));
    if (p) o.push(ell(p, [r, r, r], Mat.Lysosome));
  }
  // Mitochondria: one along each primary process, a few in the soma.
  for (const { a, b } of primaries) addTubule(an, [lerp3(a, b, 0.2), lerp3(a, b, 0.45), lerp3(a, b, 0.7)], 0.1, Mat.Mitochondrion);
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.3 && primSdf(nucleus, ...p) > 0.12 && o.every((x) => x.material !== Mat.Lysosome || primSdf(x, ...p) > 0.1);
  for (let i = 0; i < 3; i++) {
    const start = samplePoint(rand, lo, hi, ok);
    if (start) addTubule(an, wander(rand, start, [rand() - 0.5, 0, rand() - 0.5], 4, 0.4, ok), 0.1, Mat.Mitochondrion);
  }
  // Centrosome and Golgi: microglia have little cytoplasm, and a small Golgi ribbon beside the
  // nucleus. Three stacks are drawn, with four of their cisternae, wherever the soma has room.
  const mtoc: Vec3 = [nc[0] + 1.0 + 0.14, nc[1] + 0.05, nc[2]];
  if (primSdf(somaEll, ...mtoc) < -0.3) {
    o.push(ell(mtoc, [0.06, 0.06, 0.06], Mat.Spindle));
    o.push(...golgiRibbon(mtoc, [1, 0.15, 0.1], [0, 1, 0], { inner: 0.34, spacing: 0.045, halfThickness: 0.012, width: 0.5, stacks: 3, levels: 4 }).filter((b) => primSdf(somaEll, ...bowlMid(b)) < -0.15));
  }
  return an;
}

const PROCESS = [
  { name: 'Ramified process', size: '≈ 20–40 µm long', blurb: 'Thin branches that extend and retract every few minutes, surveying their patch of brain. At an injury they swing toward it within minutes.' },
  { name: 'Ramified process', size: '≈ 20–30 µm long', blurb: 'Still surveying, but shorter and thicker than in a naive brain: the primed cell is ready to over-react.' },
  { name: 'Retracting process', size: '≈ 10 µm long', blurb: 'Pulled in and thickened as the cell turns toward the lesion and switches its metabolism to defence.' },
  { name: 'Pseudopod', size: '≈ 5 µm', blurb: 'A stubby extension of the amoeboid cell, used to crawl to debris and engulf it.' },
];

function labels(an: Anatomy): Label[] {
  const phago = an.organelles.find((x) => x.material === Mat.Lysosome)!;
  const nuc = an.organelles.find((x) => x.material === Mat.Nucleus)!;
  const p0 = an.body[1].prim;
  const mito = an.tubules[0].points;
  const tip = an.body[an.body.length - 1].prim;
  const proc = PROCESS[an.stage] ?? PROCESS[0];
  const labels: Label[] = [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nuc.a[0] + 0.35, nuc.a[1] - 0.15, nuc.a[2] - 0.2], size: '≈ 5 µm, bean-shaped',
      blurb: 'Microglia have small, elongated nuclei with dense heterochromatin. They are the brain\'s resident macrophages, born in the yolk sac.' },
    { id: 'phago', name: 'Phagolysosome', material: Mat.Lysosome, anchor: phago.a, size: '≈ 1 µm',
      blurb: 'Microglia eat: dead cells, debris and even whole synapses. What they engulf ends up in acidic lysosomes like this one, more and more of them as the cell activates.' },
    { id: 'process', name: proc.name, anchor: lerp3(p0.a, p0.b, 0.5), size: proc.size, blurb: proc.blurb },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'Threaded into the processes, fuelling their constant motion.' },
  ];
  if (an.stage <= 1) labels.push({ id: 'tip', name: 'Process tip', anchor: lerp3(tip.a, tip.b, 0.85), size: '< 1 µm',
    blurb: 'The tips carry the purinergic receptor P2Y12, which senses ATP and ADP leaking from damaged cells: the "come here" signal. Without it, processes still move but cannot turn toward an injury (Haynes et al. 2006).' });
  const cisternae = an.organelles.filter((x) => x.material === Mat.Golgi), mtoc = an.organelles.find((x) => x.material === Mat.Spindle);
  if (cisternae.length) labels.push({ id: 'golgi', name: 'Golgi apparatus', material: Mat.Golgi, anchor: anchorIn(an, cisternae.map(bowlMid), Mat.Golgi), size: 'cisternae ≈ 1 µm wide',
    blurb: 'A small ribbon of stacked, curved cisternae beside the nucleus. It makes the receptors on the processes and loads the lysosomes with their enzymes; it grows as the cell activates.' });
  if (mtoc) labels.push({ id: 'centrosome', name: 'Centrosome', material: Mat.Spindle, anchor: mtoc.a, size: '',
    blurb: 'Two centrioles from which the microtubules radiate into the processes.' });
  return labels;
}

export const microglia: CellType = {
  id: 'microglia',
  name: 'Microglia',
  title: ['Microglia.'],
  tagline: ['The brain\'s sentinel.', 'Always reaching,', 'always tasting.'],
  umPerUnit: 1.5,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Activation',
  defaultStage: 0,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Golgi, name: 'Golgi apparatus' }, { material: Mat.Spindle, name: 'Centrosome' },
    { material: Mat.Lysosome, name: 'Lysosomes' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2.5, [Mat.Nucleolus]: 2.5, [Mat.Lysosome]: 1.5 },
  camera: { dist: 24, yaw: -0.4, pitch: 0.8 },
  help: 'Grab a process and pull it, or lift the soma and let the branches dangle.',
  about: 'A surveilling microglial cell, the immune cell of the central nervous system, drawn at roughly 1.5 µm per unit. In the healthy brain it is highly ramified; after injury it retracts its processes and becomes amoeboid.',
};
