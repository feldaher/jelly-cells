// A fibroblast spread on a surface: a thin lamella with a nuclear hump, a
// leading-edge lamellipodium and a trailing tail. Stress fibres run along its
// base and end in focal adhesions. Drawn ≈ 4× smaller than life.

import { Mat, type Anatomy, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cellSdf, primSdf } from '../anatomy/sdf';
import { addTubule, cone, ell, finish, lerp3, union, wander } from './common';

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const an = finish({
    cellType: 'fibroblast',
    stage: 0,
    body: [
      union(ell([0, 0.45, 0], [4.6, 0.45, 2.4])),
      union(ell([0.3, 0.75, 0], [1.9, 0.75, 1.4]), 0.8),
      union(ell([3.9, 0.36, 0], [1.5, 0.36, 3.0]), 0.8),
      union(cone([-3.8, 0.42, 0.1], [-6.2, 0.4, 0.6], 0.75, 0.4), 0.6),
    ],
    wallThickness: 0.06,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
  const o = an.organelles;
  const nucleus = ell([0.3, 0.75, 0], [1.45, 0.5, 1.05], Mat.Nucleus);
  o.push(ell([0.0, 0.85, 0.3], [0.28, 0.2, 0.28], Mat.Nucleolus), ell([0.75, 0.8, -0.3], [0.24, 0.18, 0.24], Mat.Nucleolus), nucleus);

  // Stress fibres along the base, each anchored at both ends in a focal adhesion.
  const fibres: Vec3[][] = [];
  const yF = 0.18;
  for (const z of [-1.3, -0.65, 0, 0.65, 1.3]) {
    const tilt = (rand() - 0.5) * 0.5;
    // run outward until the lamella (measured at mid-height) gets close to its edge
    const end = (sign: number): Vec3 => {
      let x = 0;
      while (cellSdf(an, x + sign * 0.05, 0.36, z + tilt * (x + sign * 0.05) / 4) < -0.3) x += sign * 0.05;
      // back off until an adhesion plaque at the base fits inside the cell
      while (Math.abs(x) > 0.5 && cellSdf(an, x + sign * 0.35, 0.14, z + (tilt * x) / 4) > -0.08) x -= sign * 0.05;
      return [x, yF, z + (tilt * x) / 4];
    };
    fibres.push([end(-1), end(1)]);
  }
  for (const [a, b] of fibres) {
    o.push(ell([a[0], 0.14, a[2]], [0.32, 0.07, 0.16], Mat.Adhesion), ell([b[0], 0.14, b[2]], [0.32, 0.07, 0.16], Mat.Adhesion));
  }
  for (const [a, b] of fibres) {
    const pts = [a, lerp3(a, b, 0.33), lerp3(a, b, 0.66), b];
    addTubule(an, pts, 0.07, Mat.Actin);
  }

  // Mitochondria wander through the lamella around the nucleus.
  const ok = (p: Vec3) => cellSdf(an, ...p) < -0.28 && primSdf(nucleus, ...p) > 0.12;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const start: Vec3 = [0.3 + Math.cos(ang) * 1.9, 0.45, Math.sin(ang) * 1.45];
    if (!ok(start)) continue;
    addTubule(an, wander(rand, start, [Math.cos(ang), 0, Math.sin(ang)], 5, 0.45, ok, true), 0.1, Mat.Mitochondrion);
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const nucleolus = an.organelles.find((x) => x.material === Mat.Nucleolus)!;
  const adhesion = an.organelles.find((x) => x.material === Mat.Adhesion)!;
  const len = (t: { points: Vec3[] }) => Math.hypot(...([0, 1, 2].map((k) => t.points[t.points.length - 1][k] - t.points[0][k]) as Vec3));
  const fibre = an.tubules.filter((t) => t.material === Mat.Actin).sort((a, b) => len(b) - len(a))[0].points;
  const mito = an.tubules.find((t) => t.material === Mat.Mitochondrion)!.points;
  return [
    { id: 'nucleus', name: 'Nucleus', material: Mat.Nucleus, anchor: [-0.4, 0.7, -0.35], size: '≈ 12 µm across',
      blurb: 'Flattened by the spread cell above it. Stress fibres press down on it, so the nucleus itself feels how hard the cell is pulling.' },
    { id: 'nucleolus', name: 'Nucleolus', material: Mat.Nucleolus, anchor: nucleolus.a, size: '≈ 2 µm',
      blurb: 'Ribosome factories. Fibroblasts often show two or three.' },
    { id: 'fibre', name: 'Stress fibre', material: Mat.Actin, anchor: lerp3(fibre[1], fibre[2], 0.5), size: '≈ 0.3 µm thick',
      blurb: 'A contractile bundle of actin and myosin II. Stress fibres pull on the substrate and are how a fibroblast senses and remodels matrix stiffness.' },
    { id: 'adhesion', name: 'Focal adhesion', material: Mat.Adhesion, anchor: adhesion.a, size: '≈ 1–5 µm long',
      blurb: 'Integrin clusters that anchor the fibre ends to the extracellular matrix. They grow under tension: a mechanosensing hub (talin, vinculin, FAK).' },
    { id: 'lamellipodium', name: 'Lamellipodium', anchor: [4.3, 0.36, 0.4], size: '≈ 0.2 µm thin',
      blurb: 'The leading edge: a sheet pushed forward by a branched actin network. It is how the cell crawls into a wound.' },
    { id: 'mito', name: 'Mitochondria', material: Mat.Mitochondrion, anchor: lerp3(mito[0], mito[1], 0.5), size: '≈ 0.5 µm thick',
      blurb: 'Spread through the thin lamella, powering the myosin motors that keep the fibres under tension.' },
    { id: 'tail', name: 'Trailing edge', anchor: [-5.2, 0.4, 0.4], size: '',
      blurb: 'The rear of a migrating cell. Adhesions here must let go for the cell to move forward.' },
  ];
}

export const fibroblast: CellType = {
  id: 'fibroblast',
  name: 'Fibroblast',
  title: ['Fibro-', 'blast.'],
  tagline: ['Flat, spread and pulling.', 'The cell that closes wounds.', 'Cut it to find its fibres.'],
  umPerUnit: 4,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Cortex' }, { material: Mat.Cytoplasm, name: 'Cytoplasm' },
    { material: Mat.Nucleus, name: 'Nucleus' }, { material: Mat.Nucleolus, name: 'Nucleolus' },
    { material: Mat.Actin, name: 'Stress fibres' }, { material: Mat.Adhesion, name: 'Focal adhesions' },
    { material: Mat.Mitochondrion, name: 'Mitochondria' },
  ],
  stiffness: { [Mat.Wall]: 1.5, [Mat.Nucleus]: 3, [Mat.Nucleolus]: 3, [Mat.Actin]: 5, [Mat.Adhesion]: 3 },
  camera: { dist: 25, yaw: -0.35, pitch: 0.8 },
  help: 'Grab the leading edge and drag it, or lift the nucleus.',
  about: 'A dermal fibroblast crawling on a surface, drawn about four times smaller than life. It is flat, a few µm at the nucleus and thinner at the edges. Stress fibres anchored in focal adhesions let it pull on the matrix: a textbook mechanosensor.',
};
