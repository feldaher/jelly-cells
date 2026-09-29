// A multipolar neuron: a large soma with a prominent nucleolus and Nissl bodies,
// an axon leaving from the hillock, and branching dendrites. The axon is cut
// short: a real one can be a metre long.

import { Mat, type Anatomy, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, lerp3, norm3, samplePoint, union, wander } from './common';

const SOMA: Vec3 = [0, 1.7, 0];
const SOMA_R: Vec3 = [2.0, 1.6, 1.9];
const HILLOCK = { a: [1.6, 1.55, 0] as Vec3, b: [3.0, 1.1, 0.05] as Vec3 };
const AXON1 = { a: HILLOCK.b, b: [6.5, 0.6, 0.5] as Vec3 };
const AXON2 = { a: AXON1.b, b: [10.0, 0.5, 0.2] as Vec3 };
const APICAL = { a: [-1.4, 2.0, 0] as Vec3, b: [-4.6, 1.3, -0.4] as Vec3 };

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'neuron',
    body: [
      union(ell(SOMA, SOMA_R)),
      union(cone(HILLOCK.a, HILLOCK.b, 0.95, 0.46), 0.5),
      union(cone(AXON1.a, AXON1.b, 0.46, 0.42), 0.2),
      union(cone(AXON2.a, AXON2.b, 0.42, 0.42), 0.2),
      union(ell([10.2, 0.5, 0.2], [0.6, 0.5, 0.55]), 0.3),
      union(cone(APICAL.a, APICAL.b, 0.85, 0.5), 0.5),
      union(cone(APICAL.b, [-6.8, 0.75, -1.8], 0.5, 0.4), 0.25),
      union(cone(APICAL.b, [-6.6, 0.75, 1.0], 0.5, 0.4), 0.25),
      union(cone([-0.3, 1.3, 1.5], [-1.2, 0.6, 4.4], 0.72, 0.42), 0.5),
      union(cone([0.5, 1.3, -1.5], [1.4, 0.6, -4.4], 0.72, 0.42), 0.5),
      union(cone([0.8, 1.2, 1.3], [2.6, 0.6, 3.8], 0.62, 0.42), 0.5),
    ],
    wallThickness: 0.08,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.42, maxSpacing: 0.6, minParticles: 120, skinGrid: 0.11 },
    organelles: [],
    tubules: [],
    seed,
  });
  const o = an.organelles;
  const nucleus = ell([0.1, 1.8, 0], [0.95, 0.9, 0.95], Mat.Nucleus);
  o.push(ell([0.3, 2.05, 0.2], [0.3, 0.3, 0.3], Mat.Nucleolus), nucleus);
  // Nissl bodies: stacks of rough ER scattered through the soma (never in the hillock).
  const soma = ell(SOMA, SOMA_R);
  let placed = 0;
  for (let i = 0; i < 40 && placed < 9; i++) {
    const p = samplePoint(rand, [-1.6, 0.6, -1.5], [1.2, 2.8, 1.5], (q) =>
      primSdf(soma, ...q) < -0.45 && primSdf(nucleus, ...q) > 0.45 &&
      o.filter((x) => x.material === Mat.ER).every((x) => Math.hypot(x.a[0] - q[0], x.a[1] - q[1], x.a[2] - q[2]) > 0.75));
    if (!p) break;
    o.push(ell(p, [0.34 + rand() * 0.1, 0.12, 0.26 + rand() * 0.1], Mat.ER));
    placed++;
  }
  // Mitochondria strung along the axon and dendrites, plus a few in the soma.
  for (const t of [0.15, 0.5, 0.82]) addTubule(an, [lerp3(AXON1.a, AXON2.b, t), lerp3(AXON1.a, AXON2.b, t + 0.07)], 0.1, Mat.Mitochondrion);
  addTubule(an, [lerp3(APICAL.a, APICAL.b, 0.35), lerp3(APICAL.a, APICAL.b, 0.6), lerp3(APICAL.a, APICAL.b, 0.8)], 0.11, Mat.Mitochondrion);
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.3 && primSdf(nucleus, ...p) > 0.15 && o.every((x) => x.material !== Mat.ER || primSdf(x, ...p) > 0.1);
  for (let i = 0; i < 4; i++) {
    const start = samplePoint(rand, [-1.6, 0.5, -1.5], [1.6, 2.9, 1.5], ok);
    if (start) addTubule(an, wander(rand, start, norm3([rand() - 0.5, 0, rand() - 0.5]), 4, 0.42, ok), 0.1, Mat.Mitochondrion);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const nissl = an.organelles.find((x) => x.material === Mat.ER)!;
  const mito = an.tubules[0].points;
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [-0.2, 1.55, -0.3], size: '≈ 10 µm',
      blurb: 'Large and pale (euchromatic): a neuron transcribes a great deal to maintain its enormous volume of axon and dendrites. It never divides again.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: [0.3, 2.05, 0.2], size: '≈ 2 µm',
      blurb: 'Unusually prominent in neurons (the "owl\'s eye" look), because of their huge demand for ribosomes.' },
    { id: 'nissl', name: 'Nissl body', material: Mat.ER, anchor: nissl.a, size: '≈ 1 µm stacks',
      blurb: 'Stacks of rough ER studded with ribosomes, stained blue by Nissl dyes. They dissolve after axonal injury (chromatolysis) as the cell switches to repair.' },
    { id: 'hillock', name: 'Axon hillock', anchor: lerp3(HILLOCK.a, HILLOCK.b, 0.55), size: '',
      blurb: 'Where the axon leaves the soma. It has no Nissl bodies, and next to it sits the initial segment where action potentials fire.' },
    { id: 'axon', name: 'Axon', anchor: lerp3(AXON2.a, AXON2.b, 0.3), size: '≈ 1 µm thick, up to 1 m long',
      blurb: 'Carries signals away from the soma. Everything it needs is shipped along microtubules, which is why axons are so vulnerable to injury.' },
    { id: 'terminal', name: 'Axon terminal', anchor: [10.2, 0.5, 0.2], size: '≈ 1–2 µm',
      blurb: 'The bouton, where neurotransmitter is released onto the next cell.' },
    { id: 'dendrite', name: 'Dendrite', anchor: lerp3(APICAL.a, APICAL.b, 0.45), size: '≈ 1–3 µm thick',
      blurb: 'Branches that receive synaptic input. Their tree can hold thousands of synapses.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'Carried along the axon to where energy is needed, at synapses and nodes.' },
  ];
}

export const neuron: CellType = {
  id: 'neuron',
  name: 'Neuron',
  title: ['Neu-', 'ron.'],
  tagline: ['A soma, an axon,', 'a crown of dendrites.', 'Pull it by the axon.'],
  umPerUnit: 2,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.ER, name: 'Nissl bodies' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2.5, [Mat.Nucleolus]: 2.5, [Mat.ER]: 1.2 },
  camera: { dist: 38, yaw: -0.3, pitch: 0.8 },
  help: 'Grab the axon or a dendrite and pull, or lift the soma.',
  about: 'A multipolar neuron, drawn at about 2 µm per unit with its axon cut short. The soma holds a large nucleus with an "owl\'s eye" nucleolus and Nissl bodies (rough ER). One axon leaves from the hillock; several dendrites branch to collect input.',
};
