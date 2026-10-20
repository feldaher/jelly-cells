// Cutting the cell: the engine's cut with the cell's anatomy as the source of new pieces.

import type { Anatomy, CutChild, CutPlan, Piece, Plane, SimMesh } from '../contracts';
import * as engine from '../engine/cut/cut';
import { anatomySource } from '../anatomy/shape';

export { applyCut, bestFitPose, findSplits, planeToRest, transferState, type Pose, type SplitJob } from '../engine/cut/cut';

export const buildChildren = (an: Anatomy, parent: Pick<SimMesh, 'restPos' | 'tets' | 'restInv' | 'spacing'>, parentPlanes: Plane[], rest: Plane, nextId: () => number): CutChild[] =>
  engine.buildChildren(anatomySource(an), parent, parentPlanes, rest, nextId);
export const planCut = (an: Anatomy, pieces: Piece[], world: Plane, nextId: () => number): CutPlan => engine.planCut(anatomySource(an), pieces, world, nextId);
