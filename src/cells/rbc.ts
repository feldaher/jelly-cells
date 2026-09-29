// A human red blood cell: a biconcave disc ≈ 7.8 µm across, ≈ 2.5 µm thick at the
// rim and ≈ 1 µm at the centre, with no nucleus and no organelles, just a
// spectrin–actin membrane skeleton around a haemoglobin solution.

import { Mat, type Anatomy, type CellType, type Label } from '../contracts';
import { ell, finish, torus, union } from './common';

const Y = 1.0;
const RIM_R = 2.1, RIM_r = 0.95;

function build(seed = 7): Anatomy {
  return finish({
    cellType: 'rbc',
    stage: 0,
    body: [
      union(torus([0, Y, 0], [0, 1, 0], RIM_R, RIM_r)),
      union(ell([0, Y, 0], [2.4, 0.42, 2.4]), 0.6),
    ],
    wallThickness: 0.1,
    cortexDepth: 0.2,
    mesh: { minSpacing: 0.4, maxSpacing: 0.55, minParticles: 120, skinGrid: 0.1 },
    organelles: [],
    tubules: [],
    seed,
  });
}

function labels(): Label[] {
  return [
    { id: 'membrane', name: 'Membrane skeleton', material: Mat.Wall, anchor: [RIM_R, Y + RIM_r - 0.05, 0], size: '≈ 0.1 µm thick',
      blurb: 'A triangular net of spectrin tethered to the membrane. It lets the cell fold through 3 µm capillaries and spring back, about a million times in its 120-day life.' },
    { id: 'hb', name: 'Haemoglobin', material: Mat.Cytoplasm, anchor: [-RIM_R, Y, 0.3], size: '≈ 270 million per cell',
      blurb: 'The cytoplasm is a concentrated haemoglobin solution (about a third of the cell by mass) carrying oxygen from lungs to tissues.' },
    { id: 'dimple', name: 'Central dimple', anchor: [0, Y, 0], size: '≈ 1 µm thick',
      blurb: 'The biconcave shape gives a large surface for its volume: more membrane than a sphere needs, which is what makes the cell so deformable.' },
    { id: 'rim', name: 'Rim', anchor: [0.3, Y + 0.1, RIM_R], size: '≈ 2.5 µm thick',
      blurb: 'The thick torus-shaped rim. There is no nucleus to fill the middle: mammalian red cells eject theirs as they mature.' },
  ];
}

export const rbc: CellType = {
  id: 'rbc',
  name: 'Red blood cell',
  title: ['Red Blood', 'Cell.'],
  tagline: ['No nucleus, no mitochondria.', 'Just a bag of haemoglobin', 'that folds and springs back.'],
  umPerUnit: 1.25,
  build,
  labels,
  key: [{ material: Mat.Wall, name: 'Membrane skeleton' }, { material: Mat.Cytoplasm, name: 'Haemoglobin' }],
  stiffness: { [Mat.Wall]: 2 },
  absorb: [0.06, 0.62, 0.55],
  camera: { dist: 19, yaw: -0.3, pitch: 0.75 },
  help: 'Grab the rim and pull, fold it over itself, or poke the dimple.',
  about: 'A human erythrocyte. Its biconcave disc has about 40% more membrane than a sphere of the same volume, and that spare membrane is what lets it deform so easily. Cut it and you will find nothing inside but haemoglobin.',
};
