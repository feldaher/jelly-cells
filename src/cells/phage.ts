// Bacteriophage T4, a virus of E. coli. Every dimension is from the cryo-EM structures as
// collected by Yap & Rossmann 2014 (Future Microbiol 9:1319): head 115 × 85 nm, tail 92.5 nm
// long and 24 nm wide around a tube 9 nm wide, baseplate 52 nm across and 27 nm high, six long
// tail fibres of 145 nm. Genome: 168 903 bp (Miller et al. 2003, Microbiol Mol Biol Rev 67:86).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type BodyPart, type CellType, type Label, type Vec3 } from '../contracts';
import { cone, ell, finish, union } from './common';

/** 20 nm per unit. */
const UM = 0.02;
const u = (nm: number) => nm / 1000 / UM;

export const T4 = {
  headLength: 115, headWidth: 85,
  tailLength: 92.5, sheathWidth: 24, tubeWidth: 9,
  baseplateWidth: 52, baseplateHeight: 27,
  fibreLength: 145,
  /** A fibre is about 4 nm thick; drawn at 14 nm so the soft body can hold it. */
  fibreDrawnWidth: 14,
  /** The capsid shell is about 3 nm thick. */
  shell: 3,
  genomeBp: 168903,
} as const;

function build(seed = 7): Anatomy {
  const headR: Vec3 = [u(T4.headLength / 2), u(T4.headWidth / 2), u(T4.headWidth / 2)];
  // the tail leaves the head at x = 0 and runs along +x
  const head: Vec3 = [-headR[0], 0, 0];
  const tailEnd = u(T4.tailLength), sheathR = u(T4.sheathWidth / 2);
  const plateR = u(T4.baseplateWidth / 2), plateH = u(T4.baseplateHeight / 2);
  const fibreR = u(T4.fibreDrawnWidth / 2), half = u(T4.fibreLength / 2);
  const body: BodyPart[] = [
    union(ell(head, headR)),
    union(cone([-0.25, 0, 0], [tailEnd, 0, 0], sheathR, sheathR), 0.12),
    union(ell([tailEnd - plateH * 0.4, 0, 0], [plateH, plateR, plateR]), 0.12),
  ];
  // Six fibres from the rim of the baseplate, folded up as on a free phage (Hu et al. 2015): the
  // near half lies along the sheath, the far half leans out past the joint to rest on the head.
  const rim = plateR - fibreR, onSheath = sheathR + fibreR, onHead = headR[1] + 0.18;
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * 2 * Math.PI + 0.3, c = Math.cos(t), s = Math.sin(t);
    const root: Vec3 = [tailEnd - plateH * 0.4, rim * c, rim * s];
    const knee: Vec3 = [root[0] - Math.sqrt(half * half - (onSheath - rim) ** 2), onSheath * c, onSheath * s];
    const tip: Vec3 = [knee[0] - Math.sqrt(half * half - (onHead - onSheath) ** 2), onHead * c, onHead * s];
    body.push(union(cone(root, knee, fibreR, fibreR), 0.1), union(cone(knee, tip, fibreR, fibreR), 0.1));
  }
  const an = finish({
    cellType: 'phage', stage: 0, body, wallThickness: u(T4.shell), cortexDepth: 0.2,
    mesh: { minSpacing: 0.42, maxSpacing: 0.56, minParticles: 120, skinGrid: 0.09 },
    organelles: [], tubules: [], seed,
  });
  const gap = u(T4.shell) + 0.12;
  // the tail tube, through the sheath from the head to the baseplate
  an.organelles.push({ kind: Prim.Capsule, material: Mat.ViralProtein, a: [0.1, 0, 0], b: [tailEnd - 0.1, 0, 0], R: 0, r: u(T4.tubeWidth / 2) });
  // the DNA, filling the head
  an.organelles.push(ell(head, [headR[0] - gap, headR[1] - gap, headR[2] - gap], Mat.Genome));
  return an;
}

function labels(an: Anatomy): Label[] {
  const head = an.body[0].prim, tail = an.body[1].prim, plate = an.body[2].prim, fibre = an.body[3].prim, far = an.body[4].prim;
  const mid = (a: Vec3, b: Vec3, t = 0.5): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return [
    { id: 'head', name: 'Head', material: Mat.Wall, anchor: [head.a[0], head.b[1] - an.wallThickness / 2, 0], size: '115 × 85 nm',
      blurb: 'A protein shell about 3 nm thick, an icosahedron stretched along one axis, built from 930 copies of one protein with others at the corners and on the surface (Fokine et al. 2004). It is drawn smooth here; the real one has flat faces and 12 corners.' },
    { id: 'dna', name: 'DNA genome', material: Mat.Genome, anchor: head.a, size: '168 903 base pairs, ≈ 56 µm of DNA',
      blurb: 'One double-stranded DNA molecule coding for about 300 proteins (Miller et al. 2003), wound into the head by a motor at its base until it is nearly as dense as a crystal. Stretched out it would be 500 times as long as the head.' },
    { id: 'sheath', name: 'Tail sheath', material: Mat.Cytoplasm, anchor: [mid(tail.a, tail.b)[0], tail.R * 0.72, 0], size: '92.5 nm long, 24 nm wide',
      blurb: '23 rings of six sheath proteins, held stretched like a cocked spring. When the baseplate grips a bacterium the sheath contracts to 42 nm long and 33 nm wide (Kostyuchenko et al. 2005) and drives the tube through the cell envelope. Contraction is not animated here.' },
    { id: 'tube', name: 'Tail tube', material: Mat.ViralProtein, anchor: mid(tail.a, tail.b), size: '9 nm wide, with a 4 nm channel',
      blurb: 'A rigid hollow tube inside the sheath. After contraction about half of it sticks out below the baseplate, crosses the periplasm, and the DNA passes down its channel into the cell (Hu et al. 2015).' },
    { id: 'baseplate', name: 'Baseplate', material: Mat.Cytoplasm, anchor: [plate.a[0], plate.b[1] * 0.55, 0], size: '52 nm across, 27 nm high',
      blurb: 'A six-sided dome of about 15 different proteins. It senses that the fibres have bound, flattens into a star 61 nm across, and that change triggers the sheath (Kostyuchenko et al. 2003).' },
    { id: 'fibre', name: 'Long tail fibre', material: Mat.Cytoplasm, anchor: mid(far.a, far.b, 0.6), size: '145 nm long, ≈ 4 nm thick (drawn 14 nm)',
      blurb: 'Six jointed fibres whose tips recognise the surface of E. coli (its lipopolysaccharide or the porin OmpC). Most stay folded up against the tail and head until the phage has found a place to infect (Hu et al. 2015), which is how they are drawn; on the cell they swing down and the phage stands on them.' },
    { id: 'knee', name: 'Fibre joint', anchor: fibre.b, size: '',
      blurb: 'Each fibre is two rods of about 70 nm joined at a hinge, so they can fold up against the particle and swing down to grip a cell.' },
  ];
}

export const phage: CellType = {
  id: 'phage',
  name: 'Bacteriophage T4',
  title: ['Bacteriophage', 'T4.'],
  tagline: ['Not a cell: a virus', 'of bacteria.', 'A head of DNA on a spring.'],
  umPerUnit: UM,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Protein shell' }, { material: Mat.Cytoplasm, name: 'Sheath, baseplate, fibres' },
    { material: Mat.Genome, name: 'DNA' }, { material: Mat.ViralProtein, name: 'Tail tube' },
  ],
  stiffness: { [Mat.Wall]: 4, [Mat.Genome]: 2, [Mat.ViralProtein]: 4 },
  camera: { dist: 30, yaw: -0.5, pitch: 0.55 },
  help: 'Grab the head or a fibre and pull. Cut the head to find the DNA.',
  about: 'Bacteriophage T4, which infects E. coli, drawn at 20 nm per unit: the whole particle is about 200 nm long, one tenth of the E. coli in this collection. It is not a cell: it has no metabolism and cannot reproduce on its own. All dimensions are from cryo-electron microscopy (Yap & Rossmann 2014). The head is drawn as a smooth ellipsoid, the fibres more than three times too thick, and the neck, collar and short fibres are left out.',
};
