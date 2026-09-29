// A resting (surveilling) microglial cell: a small soma with a bean-shaped nucleus
// and a crown of thin, branching processes that constantly probe the brain.

import { Mat, type Anatomy, type BodyPart, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { add3, addTubule, cone, ell, finish, lerp3, norm3, samplePoint, scale3, union, wander } from './common';

const SOMA: Vec3 = [0, 1.45, 0];
const SOMA_R: Vec3 = [1.6, 1.35, 1.5];

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const body: BodyPart[] = [union(ell(SOMA, SOMA_R))];
  const primaries: { a: Vec3; b: Vec3 }[] = [];
  const secondaries: BodyPart[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const dir = norm3([Math.cos(th), -0.2 + (rand() - 0.5) * 0.15, Math.sin(th)]);
    const a = add3(SOMA, scale3([dir[0], 0, dir[2]], 1.1));
    const len = 3.1 + rand() * 0.8;
    const b = add3(a, scale3(dir, len));
    b[1] = Math.max(0.45, b[1]);
    primaries.push({ a, b });
    body.push(union(cone(a, b, 0.62, 0.4), 0.5));
    // one or two side branches
    const branches = 1 + (rand() < 0.5 ? 1 : 0);
    for (let k = 0; k < branches; k++) {
      const at = lerp3(a, b, 0.55 + rand() * 0.2);
      const turn = (k === 0 ? 1 : -1) * (0.6 + rand() * 0.3);
      const bd = norm3([Math.cos(th + turn), -0.1, Math.sin(th + turn)]);
      const tip = add3(at, scale3(bd, 1.5 + rand() * 0.6));
      tip[1] = Math.max(0.42, tip[1]);
      secondaries.push(union(cone(at, tip, 0.42, 0.36), 0.3));
    }
  }
  const an = finish({
    cellType: 'microglia',
    body: [...body, ...secondaries],
    wallThickness: 0.08,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
  const o = an.organelles;
  const nucleus = ell([-0.15, 1.45, 0.1], [1.0, 0.72, 0.82], Mat.Nucleus);
  o.push(ell([-0.4, 1.6, 0.3], [0.22, 0.18, 0.22], Mat.Nucleolus), nucleus);
  // Lysosomes and one large phagolysosome, in the cytoplasm around the nucleus.
  const inSoma = (p: Vec3, r: number) => primSdf(ell(SOMA, SOMA_R), ...p) < -r - 0.2 && primSdf(nucleus, ...p) > r + 0.08
    && o.filter((x) => x.material === Mat.Lysosome).every((l) => Math.hypot(l.a[0] - p[0], l.a[1] - p[1], l.a[2] - p[2]) > l.b[0] + r + 0.05);
  for (const r of [0.42, 0.28, 0.24, 0.2, 0.2, 0.17]) {
    const p = samplePoint(rand, [-1.4, 0.3, -1.3], [1.4, 2.6, 1.3], (q) => inSoma(q, r));
    if (p) o.push(ell(p, [r, r, r], Mat.Lysosome));
  }
  // Mitochondria: one along each primary process, a few in the soma.
  for (const { a, b } of primaries) addTubule(an, [lerp3(a, b, 0.2), lerp3(a, b, 0.45), lerp3(a, b, 0.7)], 0.1, Mat.Mitochondrion);
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.3 && primSdf(nucleus, ...p) > 0.12 && o.every((x) => x.material !== Mat.Lysosome || primSdf(x, ...p) > 0.1);
  for (let i = 0; i < 3; i++) {
    const start = samplePoint(rand, [-1.3, 0.4, -1.2], [1.3, 2.4, 1.2], ok);
    if (start) addTubule(an, wander(rand, start, [rand() - 0.5, 0, rand() - 0.5], 4, 0.4, ok), 0.1, Mat.Mitochondrion);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const phago = an.organelles.find((x) => x.material === Mat.Lysosome)!;
  const p0 = an.body[1].prim;
  const mito = an.tubules[0].points;
  const tip = an.body[an.body.length - 1].prim;
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [0.2, 1.3, -0.1], size: '≈ 5 µm, bean-shaped',
      blurb: 'Microglia have small, elongated nuclei with dense heterochromatin. They are the brain\'s resident macrophages, born in the yolk sac.' },
    { id: 'phago', name: 'Phagolysosome', material: Mat.Lysosome, anchor: phago.a, size: '≈ 1 µm',
      blurb: 'Microglia eat: dead cells, debris and even whole synapses. What they engulf ends up in acidic lysosomes like this one.' },
    { id: 'process', name: 'Ramified process', anchor: lerp3(p0.a, p0.b, 0.5), size: '≈ 20–40 µm long',
      blurb: 'Thin branches that extend and retract every few minutes, surveying their patch of brain. At an injury they swing toward it within minutes.' },
    { id: 'tip', name: 'Process tip', anchor: lerp3(tip.a, tip.b, 0.85), size: '< 1 µm',
      blurb: 'Tips are packed with purinergic receptors (P2Y12) that sense ATP leaking from damaged cells: the "come here" signal.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'Threaded into the processes, fuelling their constant motion.' },
  ];
}

export const microglia: CellType = {
  id: 'microglia',
  name: 'Microglia',
  title: ['Micro-', 'glia.'],
  tagline: ['The brain\'s sentinel.', 'Always reaching,', 'always tasting.'],
  umPerUnit: 1.5,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Lysosome, name: 'Lysosomes' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2.5, [Mat.Nucleolus]: 2.5, [Mat.Lysosome]: 1.5 },
  camera: { dist: 24, yaw: -0.4, pitch: 0.8 },
  help: 'Grab a process and pull it, or lift the soma and let the branches dangle.',
  about: 'A surveilling microglial cell, the immune cell of the central nervous system, drawn at roughly 1.5 µm per unit. In the healthy brain it is highly ramified; after injury it retracts its processes and becomes amoeboid.',
};
