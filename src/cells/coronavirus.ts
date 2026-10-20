// SARS-CoV-2, an enveloped RNA virus. Measured by cryo-electron tomography of intact virions:
// roughly spherical, diameters centred around 100 nm, 24 ± 9 spike trimers per virion
// (Ke et al. 2020, Nature 588:498); about 30 000 bases of RNA in a lumen about 80 nm across,
// packed with nucleocapsid protein into beads (Yao et al. 2020, Cell 183:730).
// Sources and how far each was checked: outputs/literature/2026-10-05_new-specimens-sources.md.

import { Mat, Prim, type Anatomy, type BodyPart, type CellType, type Label, type Vec3 } from '../contracts';
import { rng } from '../math/mat3';
import { cone, ell, finish, samplePoint, union } from './common';

/** 18 nm per unit. */
const UM = 0.018;
const u = (nm: number) => nm / 1000 / UM;

export const SARS2 = {
  diameter: 100,
  spikes: 24,
  /**
   * A spike stands about 20–25 nm out of the membrane (Ke et al. look for its centre 14 nm above
   * it). Drawn as a club 12 nm thick at the stalk and 16 nm at the head; a real stalk is thinner.
   */
  spikeLength: 22, spikeHead: 16, spikeStalk: 12,
  /** A lipid bilayer is 4–5 nm thick; drawn 2.5 nm so that the spikes are not all membrane. */
  membraneDrawn: 2.5,
  /**
   * Beads of RNA and nucleocapsid protein (RNPs): about 15 nm across; 26 ± 11 were counted per
   * virion and 30–35 estimated (Yao et al. 2020, full text).
   */
  beadWidth: 15, beads: 30,
  genomeBases: 30000,
} as const;

function build(seed = 7): Anatomy {
  const rand = rng(seed);
  const R = u(SARS2.diameter / 2), wall = u(SARS2.membraneDrawn);
  const body: BodyPart[] = [union(ell([0, 0, 0], [R, R, R]))];
  const cores: { a: Vec3; b: Vec3 }[] = [];
  // Spikes: spread evenly (a golden-angle spiral) and then nudged, since on real virions they sit at random and tilt.
  for (let k = 0; k < SARS2.spikes; k++) {
    const y = 1 - (2 * (k + 0.5)) / SARS2.spikes, rad = Math.sqrt(1 - y * y), t = k * 2.39996 + (rand() - 0.5) * 0.35;
    const d: Vec3 = [rad * Math.cos(t), y, rad * Math.sin(t)];
    const at = (r: number): Vec3 => [d[0] * r, d[1] * r, d[2] * r];
    body.push(union(cone(at(R - 0.2), at(R + u(SARS2.spikeLength)), u(SARS2.spikeStalk / 2), u(SARS2.spikeHead / 2)), 0.08));
    cores.push({ a: at(R + 0.1), b: at(R + u(SARS2.spikeLength) - 0.3) });
  }
  const an = finish({
    cellType: 'coronavirus', stage: 0, body, wallThickness: wall, cortexDepth: 0.22,
    mesh: { minSpacing: 0.46, maxSpacing: 0.62, minParticles: 120, skinGrid: 0.1 },
    organelles: [], tubules: [], seed,
  });
  const o = an.organelles;
  for (const c of cores) o.push({ kind: Prim.Capsule, material: Mat.ViralProtein, a: c.a, b: c.b, R: 0, r: u(SARS2.spikeStalk / 2) - wall - 0.04 });
  // RNA beads, packed against one another under the membrane and through the middle.
  const br = u(SARS2.beadWidth / 2), reach = R - wall - br - 0.05;
  const beads: Vec3[] = [];
  for (let i = 0; i < SARS2.beads; i++) {
    const c = samplePoint(rand, [-reach, -reach, -reach], [reach, reach, reach], (p) => Math.hypot(p[0], p[1], p[2]) < reach && beads.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 2 * br + 0.03));
    if (c) { beads.push(c); o.push(ell(c, [br, br, br], Mat.Genome)); }
  }
  return an;
}

function labels(an: Anatomy): Label[] {
  const spike = an.organelles.find((x) => x.material === Mat.ViralProtein)!, bead = an.organelles.find((x) => x.material === Mat.Genome)!;
  const R = an.body[0].prim.b[0];
  // a point of the envelope away from every spike
  let free: Vec3 = [0, R - an.wallThickness / 2, 0], best = -1;
  for (let i = 0; i < 400; i++) {
    const y = 1 - (2 * (i + 0.5)) / 400, rad = Math.sqrt(1 - y * y), t = i * 2.39996;
    const d: Vec3 = [rad * Math.cos(t), y, rad * Math.sin(t)];
    const near = Math.min(...an.body.slice(1).map((b) => Math.hypot(b.prim.b[0] / Math.hypot(...b.prim.b) - d[0], b.prim.b[1] / Math.hypot(...b.prim.b) - d[1], b.prim.b[2] / Math.hypot(...b.prim.b) - d[2])));
    if (near > best) { best = near; free = [d[0] * (R - an.wallThickness / 2), d[1] * (R - an.wallThickness / 2), d[2] * (R - an.wallThickness / 2)]; }
  }
  return [
    { id: 'spike', name: 'Spike', material: Mat.ViralProtein, anchor: [(spike.a[0] + spike.b[0]) / 2, (spike.a[1] + spike.b[1]) / 2, (spike.a[2] + spike.b[2]) / 2], size: '≈ 20–25 nm tall; 24 ± 9 per virion',
      blurb: 'Three copies of the S protein, coated in sugars. It binds the ACE2 receptor on a human cell and then refolds to fuse the two membranes. A virion carries only 24 ± 9 of them, about one per 1 000 nm² of membrane, ten times sparser than on influenza virus, standing at random and able to tilt on their stalks (Ke et al. 2020). The crown they make gave coronaviruses their name.' },
    { id: 'envelope', name: 'Envelope', material: Mat.Wall, anchor: free, size: '≈ 100 nm across; bilayer 4–5 nm, drawn thinner',
      blurb: 'A lipid membrane taken from the host cell as the virus buds into its ER–Golgi compartment, packed with the viral M protein. Soap takes it apart, which is why washing hands works. Virions are roughly spherical and vary in size around 100 nm.' },
    { id: 'rna', name: 'RNA genome', material: Mat.Genome, anchor: bead.a, size: '≈ 30 000 bases, in beads ≈ 15 nm across',
      blurb: 'One strand of RNA, among the longest of any RNA virus, wound with the nucleocapsid protein into some 30 to 35 beads that fill a space about 80 nm across (Yao et al. 2020). It is read directly as a messenger RNA when it enters a cell.' },
    { id: 'virion', name: 'Virion', anchor: [0, -R * 0.45, R * 0.3], size: '',
      blurb: 'A virus particle outside a cell: genome, protein and here a membrane. It has no ribosomes and no metabolism; everything it does next is done by the cell it enters.' },
  ];
}

export const coronavirus: CellType = {
  id: 'coronavirus',
  name: 'Coronavirus',
  title: ['Coronavirus.'],
  tagline: ['Not a cell either:', 'RNA in a stolen membrane,', 'crowned with spikes.'],
  umPerUnit: UM,
  build,
  labels,
  key: [
    { material: Mat.Wall, name: 'Envelope (membrane)' }, { material: Mat.Cytoplasm, name: 'Interior' },
    { material: Mat.ViralProtein, name: 'Spike protein' }, { material: Mat.Genome, name: 'RNA with N protein' },
  ],
  stiffness: { [Mat.Wall]: 2, [Mat.Genome]: 1.5, [Mat.ViralProtein]: 3 },
  camera: { dist: 26, yaw: -0.42, pitch: 0.6 },
  help: 'Grab a spike and pull, or cut the particle open to see the RNA beads.',
  about: 'SARS-CoV-2, the virus of COVID-19, drawn at 18 nm per unit: about 100 nm across, a fifth of the width of the bacteriophage\'s host and a two-hundredth of the animal cell here. Size and spike number are from cryo-electron tomography of intact virions (Ke et al. 2020; Yao et al. 2020). The membrane is drawn thinner than it is and the spikes as plain clubs with stalks thicker than the real ones. The M protein, which packs the membrane, and the few copies of E are single molecules too small to draw at this scale.',
};
