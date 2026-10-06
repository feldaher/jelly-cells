// A multipolar neuron: a large soma with a prominent nucleolus and Nissl bodies,
// an axon leaving from the hillock, and branching dendrites. The axon is cut
// short: a real one can be a metre long.

import { Mat, Prim, type Anatomy, type BodyPart, type CellType, type Label, type Stage, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, materialAt, primSdf } from '../anatomy/sdf';
import { addTubule, anchorIn, bowl, bowlMid, cone, ell, finish, golgiRibbon, lerp3, norm3, samplePoint, union, wander } from './common';

const SOMA: Vec3 = [0, 1.7, 0];
const SOMA_R: Vec3 = [2.0, 1.6, 1.9];
const HILLOCK = { a: [1.6, 1.55, 0] as Vec3, b: [3.0, 1.1, 0.05] as Vec3 };
const AXON1 = { a: HILLOCK.b, b: [6.5, 0.6, 0.5] as Vec3 };
const AXON2 = { a: AXON1.b, b: [10.0, 0.5, 0.2] as Vec3 };
const APICAL = { a: [-1.4, 2.0, 0] as Vec3, b: [-4.6, 1.3, -0.4] as Vec3 };

export const STAGES: Stage[] = [
  { name: 'Healthy', title: 'Healthy', blurb: 'An intact neuron: a large soma packed with Nissl bodies, a long axon ending in a terminal, and a crown of dendrites.' },
  { name: 'Axotomy', title: 'Axotomy', blurb: 'The axon has been cut. The distal part degenerates (Wallerian degeneration) and the stump seals into a retraction bulb where transported organelles pile up.' },
  { name: 'Chromat.', title: 'Chromatolysis', blurb: 'Days later the soma swells, the nucleus moves to the edge and the Nissl bodies dissolve: the cell is switching from signalling to repair.' },
  { name: 'Regen.', title: 'Regeneration', blurb: 'A new axon sprouts from the stump, led by a growth cone that feels its way forward. Nissl bodies and the nucleus return to normal.' },
];

/** Where the axon is cut: part-way along its first segment. */
const STUMP: Vec3 = lerp3(AXON1.a, AXON1.b, 0.7);
/** How far along the main dendrite the Golgi outpost sits. */
const OUTPOST_AT = 0.3;
const GROWTH = { a: STUMP, b: [8.2, 0.5, 0.6] as Vec3 };

const PLAN = [
  { soma: 1, nucleusOffset: [0.1, 0.1, 0] as Vec3, nucleolus: 0.3, nissl: 9, nisslSize: 1, axon: 'intact' },
  { soma: 1, nucleusOffset: [0.1, 0.1, 0] as Vec3, nucleolus: 0.3, nissl: 9, nisslSize: 1, axon: 'stump' },
  { soma: 1.1, nucleusOffset: [-0.95, 0.1, 0.6] as Vec3, nucleolus: 0.36, nissl: 3, nisslSize: 0.6, axon: 'stump' },
  { soma: 1.04, nucleusOffset: [-0.4, 0.1, 0.25] as Vec3, nucleolus: 0.34, nissl: 6, nisslSize: 0.85, axon: 'sprout' },
] as const;

function build(seed = 7, stage = 0): Anatomy {
  const plan = PLAN[Math.max(0, Math.min(PLAN.length - 1, stage))];
  const rand = rng(seed);
  const somaR: Vec3 = [SOMA_R[0] * plan.soma, SOMA_R[1] * plan.soma, SOMA_R[2] * plan.soma];
  const somaC: Vec3 = [SOMA[0], somaR[1] + 0.1, SOMA[2]];
  const axon: BodyPart[] = plan.axon === 'intact'
    ? [union(cone(AXON1.a, AXON1.b, 0.46, 0.42), 0.2), union(cone(AXON2.a, AXON2.b, 0.42, 0.42), 0.2), union(ell([10.2, 0.5, 0.2], [0.6, 0.5, 0.55]), 0.3)]
    : [union(cone(AXON1.a, STUMP, 0.46, 0.43), 0.2), union(ell(STUMP, [0.72, 0.62, 0.66]), 0.3)];
  if (plan.axon === 'sprout') {
    axon.push(union(cone(GROWTH.a, GROWTH.b, 0.42, 0.38), 0.2), union(ell([GROWTH.b[0] + 0.35, GROWTH.b[1] - 0.05, GROWTH.b[2]], [0.85, 0.32, 0.95]), 0.3));
  }
  const an = finish({
    cellType: 'neuron',
    stage,
    body: [
      union(ell(somaC, somaR)),
      union(cone(HILLOCK.a, HILLOCK.b, 0.95, 0.46), 0.5),
      ...axon,
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
  const nc: Vec3 = [somaC[0] + plan.nucleusOffset[0], somaC[1] + plan.nucleusOffset[1], somaC[2] + plan.nucleusOffset[2]];
  const nucleus = ell(nc, [0.95, 0.9, 0.95], Mat.Nucleus);
  const nr = plan.nucleolus;
  o.push(ell([nc[0] + 0.2, nc[1] + 0.25, nc[2] + 0.2], [nr, nr, nr], Mat.Nucleolus), nucleus);
  // Nissl bodies: stacks of rough ER scattered through the soma (never in the hillock);
  // in chromatolysis only a few small ones survive, out at the periphery.
  const soma = ell(somaC, somaR);
  const peripheral = plan.nissl < 5;
  let placed = 0;
  for (let i = 0; i < 60 && placed < plan.nissl; i++) {
    const p = samplePoint(rand, [somaC[0] - 1.8 * plan.soma, somaC[1] - 1.1, somaC[2] - 1.5], [somaC[0] + 1.2, somaC[1] + 1.1, somaC[2] + 1.5], (q) => {
      const d = primSdf(soma, ...q);
      return d < -0.45 && (!peripheral || d > -0.8) && primSdf(nucleus, ...q) > 0.45 &&
        o.filter((x) => x.material === Mat.ER).every((x) => Math.hypot(x.a[0] - q[0], x.a[1] - q[1], x.a[2] - q[2]) > 0.75);
    });
    if (!p) break;
    // a Nissl body is a stack of rough ER cisternae: three are drawn, the middle one first
    const k = plan.nisslSize, R = ((0.34 + rand() * 0.1 + 0.26 + rand() * 0.1) / 2) * k;
    for (const dy of [0, -0.075, 0.075]) o.push({ kind: Prim.Disc, material: Mat.ER, a: [p[0], p[1] + dy, p[2]], b: [0, 0.02, 0], R, r: 0 });
    placed++;
  }
  // Mitochondria on the move: one track out and one back along the axon, as far as it goes.
  // Only short stretches of each track are drawn, travelling (cycle/dynamics.ts).
  const axonEnd = plan.axon === 'intact' ? AXON2.b : plan.axon === 'sprout' ? GROWTH.b : lerp3(AXON1.a, STUMP, 0.92);
  for (const dz of [0.2, -0.2]) {
    const via: Vec3[] = plan.axon === 'intact' ? [AXON1.a, AXON1.b, axonEnd] : plan.axon === 'sprout' ? [AXON1.a, STUMP, axonEnd] : [AXON1.a, axonEnd];
    addTubule(an, via.map((q) => [q[0], q[1], q[2] + dz] as Vec3), 0.09, Mat.Mitochondrion, 'transport');
  }
  // Mitochondria at rest: strung along the axon, or piled up in the retraction bulb / growth cone.
  if (plan.axon === 'intact') {
    for (const t of [0.15, 0.5, 0.82]) addTubule(an, [lerp3(AXON1.a, AXON2.b, t), lerp3(AXON1.a, AXON2.b, t + 0.07)], 0.1, Mat.Mitochondrion);
  } else {
    for (const [dx, dz] of [[-0.25, 0.15], [0.05, -0.2], [0.2, 0.2]]) addTubule(an, [[STUMP[0] + dx - 0.2, STUMP[1], STUMP[2] + dz], [STUMP[0] + dx + 0.2, STUMP[1] + 0.05, STUMP[2] + dz]], 0.1, Mat.Mitochondrion);
    addTubule(an, [lerp3(AXON1.a, STUMP, 0.35), lerp3(AXON1.a, STUMP, 0.5)], 0.1, Mat.Mitochondrion);
    if (plan.axon === 'sprout') addTubule(an, [lerp3(GROWTH.a, GROWTH.b, 0.4), lerp3(GROWTH.a, GROWTH.b, 0.6)], 0.1, Mat.Mitochondrion);
  }
  addTubule(an, [lerp3(APICAL.a, APICAL.b, 0.35), lerp3(APICAL.a, APICAL.b, 0.6), lerp3(APICAL.a, APICAL.b, 0.8)], 0.11, Mat.Mitochondrion);
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.3 && primSdf(nucleus, ...p) > 0.15 && o.every((x) => x.material !== Mat.ER || primSdf(x, ...p) > 0.1);
  for (let i = 0; i < 4; i++) {
    const start = samplePoint(rand, [somaC[0] - 1.6, somaC[1] - 1.2, -1.5], [somaC[0] + 1.6, somaC[1] + 1.2, 1.5], ok);
    if (start) addTubule(an, wander(rand, start, norm3([rand() - 0.5, 0, rand() - 0.5]), 4, 0.42, ok), 0.1, Mat.Mitochondrion);
  }

  // Golgi: in a neuron the ribbon wraps part of the nucleus, on the side of the main dendrite.
  // Seven curved cisternae per stack, about 1 µm wide, drawn twice as far apart as they are.
  const toDendrite = norm3([APICAL.a[0] - nc[0], 0, APICAL.a[2] - nc[2]]);
  o.push(...golgiRibbon(nc, toDendrite, [0, 1, 0], { inner: 0.95 + 0.13, spacing: 0.045, halfThickness: 0.0125, width: 0.55, stacks: 5 }));
  // A Golgi outpost: a small stack out in the dendrite, where part of the secretory traffic is
  // handled locally (Horton & Ehlers 2003, J Neurosci 23:6188).
  const post = lerp3(APICAL.a, APICAL.b, OUTPOST_AT);
  for (let i = 0; i < 3; i++) o.push(bowl([post[0], post[1] - 0.6, post[2]], [0, 1, 0], 0.6 + (i - 1) * 0.045, 0.3, 0.0125, Mat.Golgi));
  // Microtubules: bundles running the length of the axon and of the dendrite (25 nm tubes, drawn
  // 0.1 µm thick). They are the tracks along which the mitochondria above travel.
  const axonPath: Vec3[] = plan.axon === 'intact' ? [HILLOCK.a, AXON1.a, AXON1.b, axonEnd] : plan.axon === 'sprout' ? [HILLOCK.a, AXON1.a, STUMP, axonEnd] : [HILLOCK.a, AXON1.a, axonEnd];
  addTubule(an, axonPath.map((q) => [q[0], q[1] + 0.1, q[2]] as Vec3), 0.025, Mat.Spindle);
  addTubule(an, [0.05, 0.35, 0.65, 0.92].map((t) => { const q = lerp3(APICAL.a, APICAL.b, t); return [q[0], q[1] + 0.06, q[2] + 0.08] as Vec3; }), 0.025, Mat.Spindle);
  return an;
}

function labels(an: Anatomy): Label[] {
  const nissl = an.organelles.find((x) => x.material === Mat.ER)!;
  const nuc = an.organelles.find((x) => x.material === Mat.Nucleus)!;
  const nucleolus = an.organelles.find((x) => x.material === Mat.Nucleolus)!;
  const mito = an.tubules.find((t) => !t.motion)!.points;
  const away = norm3([nuc.a[0] - nucleolus.a[0], nuc.a[1] - nucleolus.a[1], nuc.a[2] - nucleolus.a[2]]);
  const labels: Label[] = [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [nuc.a[0] + away[0] * 0.45, nuc.a[1] + away[1] * 0.45, nuc.a[2] + away[2] * 0.45], size: '≈ 10 µm',
      blurb: an.stage === 2
        ? 'Pushed to the edge of the swollen soma: a hallmark of chromatolysis, as the cell reorganises for repair.'
        : 'Large and pale (euchromatic): a neuron transcribes a great deal to maintain its enormous volume of axon and dendrites. It never divides again.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 2 µm',
      blurb: 'Unusually prominent in neurons (the "owl\'s eye" look), because of their huge demand for ribosomes. It grows further during regeneration.' },
    { id: 'nissl', name: 'Nissl body', material: Mat.ER, anchor: nissl.a, size: '≈ 1 µm stacks',
      blurb: 'Stacks of flat rough-ER cisternae studded with ribosomes, stained blue by Nissl dyes. They dissolve after axonal injury (chromatolysis) as the cell switches to repair.' },
    { id: 'hillock', name: 'Axon hillock', anchor: lerp3(HILLOCK.a, HILLOCK.b, 0.55), size: '',
      blurb: 'Where the axon leaves the soma. It has no Nissl bodies, and next to it sits the initial segment where action potentials fire.' },
    { id: 'dendrite', name: 'Dendrite', anchor: lerp3(APICAL.a, APICAL.b, 0.45), size: '≈ 1–3 µm thick',
      blurb: 'Branches that receive synaptic input. Their tree can hold thousands of synapses.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito[0], mito[1], 0.5), size: '≈ 0.3 µm thick',
      blurb: (an.stage === 0 ? 'Carried along the axon to where energy is needed, at synapses and nodes.' : 'Still being shipped down the axon, they pile up at its sealed end.')
        + ' Some sit still while others travel, outward and back, switching between the two states (Morris & Hollenbeck 1993). The moving ones are shown 4× faster than life.' },
  ];
  if (an.stage === 0) {
    labels.push(
      { id: 'axon', name: 'Axon', anchor: lerp3(AXON2.a, AXON2.b, 0.3), size: '≈ 1 µm thick, up to 1 m long',
        blurb: 'Carries signals away from the soma. Everything it needs is shipped along microtubules, which is why axons are so vulnerable to injury.' },
      { id: 'terminal', name: 'Axon terminal', anchor: [10.2, 0.5, 0.2], size: '≈ 1–2 µm', blurb: 'The bouton, where neurotransmitter is released onto the next cell.' });
  } else {
    labels.push(
      { id: 'axon', name: 'Axon stump', anchor: lerp3(AXON1.a, STUMP, 0.6), size: '≈ 1 µm thick', blurb: 'What is left of the axon after the cut. The distal part, cut off from the soma, has degenerated.' },
      { id: 'bulb', name: 'Retraction bulb', anchor: STUMP, size: '≈ 3 µm',
        blurb: 'The sealed, swollen end of the cut axon, where transported organelles pile up. In the central nervous system it often stalls here; peripheral axons go on to regrow.' });
  }
  if (an.stage === 3) labels.push({ id: 'cone', name: 'Growth cone', anchor: [GROWTH.b[0] + 0.35, GROWTH.b[1] - 0.05, GROWTH.b[2]], size: '≈ 5–10 µm',
    blurb: 'The motile tip of the regrowing axon: actin-rich lamellipodia and filopodia that read guidance cues and pull the axon forward.' });
  const cisternae = an.organelles.filter((x) => x.material === Mat.Golgi), post = lerp3(APICAL.a, APICAL.b, OUTPOST_AT);
  const isOutpost = (x: (typeof cisternae)[number]) => Math.hypot(bowlMid(x)[0] - post[0], bowlMid(x)[1] - post[1], bowlMid(x)[2] - post[2]) < 0.2;
  const ribbon = cisternae.filter((x) => !isOutpost(x)), outpost = cisternae.filter(isOutpost);
  if (ribbon.length) labels.push({ id: 'golgi', name: 'Golgi apparatus', material: Mat.Golgi, anchor: anchorIn(an, ribbon.map(bowlMid), Mat.Golgi), size: 'cisternae ≈ 1 µm wide',
    blurb: 'A ribbon of stacks of curved cisternae wrapped around part of the nucleus, large in a neuron because so much membrane and so many receptors and channels have to be made and shipped down the axon and dendrites.' });
  if (outpost.length && materialAt(an, ...bowlMid(outpost[1] ?? outpost[0])) === Mat.Golgi) labels.push({ id: 'outpost', name: 'Golgi outpost', material: Mat.Golgi, anchor: bowlMid(outpost[1] ?? outpost[0]), size: '< 1 µm',
    blurb: 'A small piece of Golgi far from the cell body, in a dendrite. Proteins made in the dendrite can be finished and delivered locally instead of travelling from the soma. Outposts are found in neurons and hardly anywhere else (Horton & Ehlers 2003).' });
  const tracks = an.tubules.filter((t) => t.material === Mat.Spindle);
  if (tracks.length) labels.push({ id: 'mt', name: 'Microtubules', material: Mat.Spindle, anchor: anchorIn(an, tracks.flatMap((t) => t.points.slice(1)), Mat.Spindle), size: '25 nm thick, drawn thicker',
    blurb: 'Bundles of microtubules run the whole length of the axon and the dendrites. They are the rails for everything that is shipped: kinesin motors carry cargo outward along them, dynein brings it back. In the axon they all point the same way, plus end out; in dendrites they are mixed.' });
  return labels;
}

export const neuron: CellType = {
  id: 'neuron',
  name: 'Neuron',
  title: ['Neuron.'],
  tagline: ['A soma, an axon,', 'a crown of dendrites.', 'Pull it by the axon.'],
  umPerUnit: 2,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Injury response',
  defaultStage: 0,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.ER, name: 'Nissl bodies' }, { material: Mat.Mitochondrion, name: 'Mitochondria' },
    { material: Mat.Golgi, name: 'Golgi apparatus' }, { material: Mat.Spindle, name: 'Microtubules' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 2.5, [Mat.Nucleolus]: 2.5, [Mat.ER]: 1.2 },
  camera: { dist: 38, yaw: -0.3, pitch: 0.8 },
  help: 'Grab the axon or a dendrite and pull, or lift the soma.',
  about: 'A multipolar neuron, drawn at about 2 µm per unit with its axon cut short. The soma holds a large nucleus with an "owl\'s eye" nucleolus and Nissl bodies (rough ER). One axon leaves from the hillock; several dendrites branch to collect input.',
};
