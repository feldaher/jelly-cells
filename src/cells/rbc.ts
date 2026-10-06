// A human red blood cell: a biconcave disc ≈ 7.8 µm across, ≈ 2.5 µm thick at the
// rim and ≈ 1 µm at the centre, with no nucleus and no organelles, just a
// spectrin–actin membrane skeleton around a haemoglobin solution.

import { Mat, type Anatomy, type BodyPart, type CellType, type Label, type Stage, type Vec3 } from '../contracts';
import { cellSdf } from '../anatomy/sdf';
import { ell, finish, torus, union } from './common';

const Y = 1.0;
const RIM_R = 2.1, RIM_r = 0.95;

export const STAGES: Stage[] = [
  { name: 'Disc', title: 'Discocyte', blurb: 'The resting biconcave disc, with about 40% more membrane than a sphere of the same volume. That spare membrane is what lets it fold.' },
  { name: 'Echino I', title: 'Echinocyte I', blurb: 'Crenated: the rim bulges into bumps. ATP depletion, high pH or some drugs expand the outer leaflet of the membrane relative to the inner one (the bilayer-couple idea).' },
  { name: 'Echino III', title: 'Echinocyte III', blurb: 'The disc has rounded up and the bumps have become regular spicules all over the surface.' },
  { name: 'Sphere', title: 'Spherocyte', blurb: 'A sphere has the least surface for its volume, so it can no longer squeeze through narrow capillaries, and the spleen removes it.' },
];

/** Points spread evenly over a sphere (Fibonacci lattice). */
function fibonacci(n: number): Vec3[] {
  const out: Vec3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y);
    out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r]);
  }
  return out;
}

const SPHERE_R = 2.12;
const ECHINO3: Vec3 = [2.45, 1.45, 2.45];

function build(seed = 7, stage = 0): Anatomy {
  const st = Math.max(0, Math.min(3, stage));
  let body: BodyPart[];
  if (st === 0) {
    body = [union(torus([0, Y, 0], [0, 1, 0], RIM_R, RIM_r)), union(ell([0, Y, 0], [2.4, 0.42, 2.4]), 0.6)];
  } else if (st === 1) {
    // a thicker disc whose rim is crenated into a ring of bumps
    body = [union(torus([0, Y, 0], [0, 1, 0], RIM_R, 0.88)), union(ell([0, Y, 0], [2.35, 0.56, 2.35]), 0.6)];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      body.push(union(ell([Math.cos(a) * (RIM_R + 0.62), Y + (i % 2 ? 0.15 : -0.15), Math.sin(a) * (RIM_R + 0.62)], [0.42, 0.42, 0.42]), 0.35));
    }
  } else if (st === 2) {
    // an ellipsoid covered in regular spicules
    const c: Vec3 = [0, ECHINO3[1] + 0.1, 0];
    body = [union(ell(c, ECHINO3))];
    for (const d of fibonacci(18)) body.push(union(ell([c[0] + d[0] * ECHINO3[0], c[1] + d[1] * ECHINO3[1], c[2] + d[2] * ECHINO3[2]], [0.4, 0.4, 0.4]), 0.25));
  } else {
    body = [union(ell([0, SPHERE_R + 0.1, 0], [SPHERE_R, SPHERE_R, SPHERE_R]))];
  }
  return finish({
    cellType: 'rbc',
    stage: st,
    body,
    wallThickness: 0.1,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: st === 1 || st === 2 ? 0.45 : 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
}

function labels(an: Anatomy): Label[] {
  const b = an.body[0].prim;
  // a point just under the top surface, above (x, z)
  const under = (x: number, z: number): Vec3 => {
    let y = an.bounds.hi[1];
    while (y > an.bounds.lo[1] && cellSdf(an, x, y, z) > 0) y -= 0.01;
    return [x, y - 0.05, z];
  };
  const centre: Vec3 = an.stage >= 2 ? [b.a[0], b.a[1], b.a[2]] : [0, Y, 0];
  const labels: Label[] = [
    { id: 'membrane', name: 'Membrane skeleton', material: Mat.Wall, anchor: under(an.stage >= 2 ? 0.8 : RIM_R, 0), size: '≈ 0.1 µm thick',
      blurb: 'A triangular net of spectrin tethered to the membrane. It lets the cell fold through 3 µm capillaries and spring back. At about one circuit of the body a minute, that is some 170 000 circuits in its 120-day life, each through two capillary beds (lungs and tissues).' },
    { id: 'hb', name: 'Haemoglobin', material: Mat.Cytoplasm, anchor: an.stage >= 2 ? [centre[0] - 0.6, centre[1], centre[2] + 0.3] : [-RIM_R, Y, 0.3], size: '≈ 270 million per cell',
      blurb: 'The cytoplasm is a concentrated haemoglobin solution (about a third of the cell by mass) carrying oxygen from lungs to tissues.' },
  ];
  if (an.stage <= 1) {
    labels.push(
      { id: 'dimple', name: 'Central dimple', anchor: [0, Y, 0], size: an.stage === 0 ? '≈ 1 µm thick' : 'filling in',
        blurb: 'The biconcave shape gives a large surface for its volume: more membrane than a sphere needs, which is what makes the cell so deformable.' },
      { id: 'rim', name: 'Rim', anchor: [0.3, Y + 0.1, RIM_R], size: '≈ 2.5 µm thick',
        blurb: 'The thick torus-shaped rim. There is no nucleus to fill the middle: mammalian red cells eject theirs as they mature.' });
  }
  if (an.stage === 1 || an.stage === 2) {
    const spike = an.body[an.body.length - 1].prim.a;
    const c = an.stage === 2 ? centre : [0, Y, 0];
    const d = [spike[0] - c[0], spike[1] - c[1], spike[2] - c[2]], l = Math.hypot(d[0], d[1], d[2]);
    labels.push({ id: 'spicule', name: an.stage === 1 ? 'Crenation' : 'Spicule', anchor: [spike[0] - (d[0] / l) * 0.1, spike[1] - (d[1] / l) * 0.1, spike[2] - (d[2] / l) * 0.1], size: '≈ 0.5 µm',
      blurb: 'A bump of membrane pushed out because its outer leaflet has grown relative to the inner one. The shape change is reversible if the cause is removed.' });
  }
  if (an.stage === 3) labels.push({ id: 'sphere', name: 'Spherical shape', anchor: [centre[0] + 0.8, centre[1] + 0.8, centre[2]], size: '≈ 6 µm across',
    blurb: 'Same volume, less membrane: the spare surface that made the disc deformable is gone, and the cell becomes rigid and fragile.' });
  return labels;
}

export const rbc: CellType = {
  id: 'rbc',
  name: 'Red blood cell',
  title: ['Red Blood', 'Cell.'],
  tagline: ['No nucleus, no mitochondria.', 'Just a bag of haemoglobin', 'that folds and springs back.'],
  umPerUnit: 1.25,
  build,
  labels,
  stages: STAGES,
  stageLabel: 'Shape change',
  defaultStage: 0,
  key: [{ material: Mat.Wall, name: 'Membrane skeleton' }, { material: Mat.Cytoplasm, name: 'Haemoglobin' }],
  stiffness: { [Mat.Wall]: 2 },
  absorb: [0.06, 0.62, 0.55],
  camera: { dist: 19, yaw: -0.3, pitch: 0.75 },
  help: 'Grab the rim and pull, fold it over itself, or poke the dimple.',
  about: 'A human erythrocyte. Its biconcave disc has about 40% more membrane than a sphere of the same volume, and that spare membrane is what lets it deform so easily. Cut it and you will find nothing inside but haemoglobin.',
};
