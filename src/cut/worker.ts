// Builds the pieces for a cut off the main thread, so letting go of the knife never stalls a frame.

import type { CellTypeId, Plane, SimMesh } from '../contracts';
import { anatomyOf } from '../cells';
import { buildChildren } from './cut';
import { mergeReports, sectionReport } from '../teach/section';

export interface CutRequest {
  id: number;
  cellType: CellTypeId;
  umPerUnit: number;
  seed: number;
  jobs: { parentPlanes: Plane[]; rest: Plane; parent: Pick<SimMesh, 'restPos' | 'tets' | 'restInv' | 'spacing'> }[];
}

self.onmessage = (e: MessageEvent<CutRequest>) => {
  const { id, cellType, umPerUnit, seed, jobs } = e.data;
  const an = anatomyOf(cellType, seed);
  let tmp = 0;
  const results = jobs.map((j) => buildChildren(an, j.parent, j.parentPlanes, j.rest, () => tmp++));
  const report = mergeReports(jobs.map((j) => sectionReport(an, j.parentPlanes, j.rest, umPerUnit)));
  (self as unknown as Worker).postMessage({ id, results, report });
};
