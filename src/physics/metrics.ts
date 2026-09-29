import type { SimMesh } from '../contracts';
import { tetVolume } from '../mesh/tetgen';

export function tetSignedVolume(s: SimMesh, t: number): number {
  return tetVolume(s.pos, s.tets[4 * t], s.tets[4 * t + 1], s.tets[4 * t + 2], s.tets[4 * t + 3]);
}

export function currentVolume(s: SimMesh): number {
  let v = 0;
  for (let t = 0; t < s.tets.length / 4; t++) v += tetSignedVolume(s, t);
  return v;
}

export function restVolume(s: SimMesh): number {
  let v = 0;
  for (const x of s.restVol) v += x;
  return v;
}

export function kinetic(s: SimMesh): number {
  let e = 0;
  for (let i = 0; i < s.invMass.length; i++) {
    if (s.invMass[i] === 0) continue;
    e += (0.5 / s.invMass[i]) * (s.vel[3 * i] ** 2 + s.vel[3 * i + 1] ** 2 + s.vel[3 * i + 2] ** 2);
  }
  return e;
}

export function totalMass(s: SimMesh): number {
  let m = 0;
  for (const w of s.invMass) if (w > 0) m += 1 / w;
  return m;
}

export function centreOfMass(s: SimMesh, pos: Float32Array = s.pos): number[] {
  const c = [0, 0, 0];
  let m = 0;
  for (let i = 0; i < s.invMass.length; i++) {
    const mi = s.invMass[i] > 0 ? 1 / s.invMass[i] : 0;
    m += mi;
    for (let k = 0; k < 3; k++) c[k] += mi * pos[3 * i + k];
  }
  return c.map((x) => x / m);
}

export function linearMomentum(s: SimMesh): number[] {
  const p = [0, 0, 0];
  for (let i = 0; i < s.invMass.length; i++) {
    const mi = s.invMass[i] > 0 ? 1 / s.invMass[i] : 0;
    for (let k = 0; k < 3; k++) p[k] += mi * s.vel[3 * i + k];
  }
  return p;
}
