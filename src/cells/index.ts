// The cell types offered in the dropdown.

import type { Anatomy, CellType, CellTypeId, Label } from '../contracts';
import { morphAnatomy } from '../anatomy/morph';
import { yeast } from './yeast';
import { pombe } from './pombe';
import { ecoli } from './ecoli';
import { rbc } from './rbc';
import { fibroblast } from './fibroblast';
import { microglia } from './microglia';
import { neuron } from './neuron';

export const CELL_TYPES: CellType[] = [yeast, pombe, ecoli, rbc, fibroblast, microglia, neuron];

export function cellType(id: CellTypeId): CellType {
  const t = CELL_TYPES.find((c) => c.id === id);
  if (!t) throw new Error(`Unknown cell type ${id}`);
  return t;
}

const cache = new Map<string, Anatomy>();
/**
 * The anatomy of a cell type at a stage. Whole stages are built once per seed;
 * a fractional stage blends its two neighbours (see anatomy/morph.ts).
 */
export function anatomyOf(id: CellTypeId, seed = 7, stage?: number): Anatomy {
  const t = cellType(id);
  const last = (t.stages?.length ?? 1) - 1;
  const st = Math.max(0, Math.min(last, stage ?? t.defaultStage ?? 0));
  const i = Math.floor(st);
  if (st > i) return morphAnatomy(anatomyOf(id, seed, i), anatomyOf(id, seed, i + 1), st - i);
  const key = `${id}:${seed}:${st}`;
  let an = cache.get(key);
  if (!an) { an = t.build(seed, st); cache.set(key, an); }
  return an;
}

/** Labels at a (possibly fractional) stage: those of the nearest whole stage. */
export function labelsAt(id: CellTypeId, seed: number, stage: number): Label[] {
  return cellType(id).labels(anatomyOf(id, seed, Math.round(stage)));
}
