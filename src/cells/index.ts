// The cell types offered in the dropdown.

import type { Anatomy, CellType, CellTypeId } from '../contracts';
import { yeast } from './yeast';
import { rbc } from './rbc';
import { fibroblast } from './fibroblast';
import { microglia } from './microglia';
import { neuron } from './neuron';

export const CELL_TYPES: CellType[] = [yeast, rbc, fibroblast, microglia, neuron];

export function cellType(id: CellTypeId): CellType {
  const t = CELL_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Unknown cell type ${id}`);
  return t;
}

const cache = new Map<string, Anatomy>();
/** The anatomy of a cell type, built once per seed. */
export function anatomyOf(id: CellTypeId, seed = 7): Anatomy {
  const key = `${id}:${seed}`;
  let an = cache.get(key);
  if (!an) { an = cellType(id).build(seed); cache.set(key, an); }
  return an;
}
