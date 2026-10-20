// The cell's pieces: the engine's pieces with the cell's organelles in them.

import type { Anatomy, Piece, Plane } from '../contracts';
import * as engine from '../engine/mesh/piece';
import { anatomySource } from '../anatomy/shape';

export const buildPieces = (an: Anatomy, planes: Plane[], nextId: () => number): Piece[] => engine.buildPieces(anatomySource(an), planes, nextId);
export const buildPiece = (an: Anatomy, planes: Plane[], id: number): Piece => engine.buildPiece(anatomySource(an), planes, id);
