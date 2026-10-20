// The cell's tet mesh: the engine's tetgen applied to its anatomy.

import type { Anatomy, Plane, SimMesh } from '../contracts';
import * as engine from '@feldaher/cell-engine/mesh/tetgen';
import { anatomyShape } from '../anatomy/shape';
import { materialAt } from '../anatomy/sdf';

export { tetComponents, tetQuality, tetVolume } from '@feldaher/cell-engine/mesh/tetgen';

export const pieceBounds = (an: Anatomy) => engine.pieceBounds(anatomyShape(an, []));
export const estimateVolume = (an: Anatomy, planes: Plane[], step?: number) => engine.estimateVolume(anatomyShape(an, planes), step);
export const chooseSpacing = (an: Anatomy, planes: Plane[]) => engine.chooseSpacing(anatomyShape(an, planes));
export const buildSimMesh = (an: Anatomy, planes: Plane[], spacing?: number): SimMesh => engine.buildSimMesh(anatomyShape(an, planes), spacing);
export const finishSimMesh = (an: Anatomy, rest: Float32Array, tets: Uint32Array, spacing: number): SimMesh =>
  engine.finishSimMesh((x, y, z) => materialAt(an, x, y, z, an.cortexDepth), rest, tets, spacing);
