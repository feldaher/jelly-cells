// The cell's render skin: the engine's surface nets and embedding applied to its anatomy.

import { Mat, type Anatomy, type Plane } from '../contracts';
import { buildSkinGeometry as engineSkin } from '../engine/mesh/surface';
import { anatomyShape } from '../anatomy/shape';

export type { RestMesh } from '../engine/contracts';
export { embedMesh, embedPoints, moveEmbedded, TetGrid, updateSkin } from '../engine/mesh/embed';

export const buildSkinGeometry = (an: Anatomy, planes: Plane[], lo: number[], hi: number[], g: number) => engineSkin(anatomyShape(an, planes), lo, hi, g);

export const SKIN_MATERIAL = Mat.Cytoplasm;
