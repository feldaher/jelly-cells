// Builds the pieces for a cut off the main thread, so letting go of the knife never stalls a frame.

import type { Plane, SimMesh } from '../contracts';
import { defaultAnatomy } from '../anatomy/anatomy';
import { buildChildren } from './cut';

export interface CutRequest {
  id: number;
  seed: number;
  jobs: { parentPlanes: Plane[]; rest: Plane; parent: Pick<SimMesh, 'restPos' | 'tets' | 'restInv' | 'spacing'> }[];
}

const anatomies = new Map<number, ReturnType<typeof defaultAnatomy>>();

self.onmessage = (e: MessageEvent<CutRequest>) => {
  const { id, seed, jobs } = e.data;
  let an = anatomies.get(seed);
  if (!an) { an = defaultAnatomy(seed); anatomies.set(seed, an); }
  let tmp = 0;
  const results = jobs.map((j) => buildChildren(an!, j.parent, j.parentPlanes, j.rest, () => tmp++));
  (self as unknown as Worker).postMessage({ id, results });
};
