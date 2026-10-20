// Shared shapes for every layer of the simulation. This file is the contract:
// geometry, physics, cutting and rendering all agree on these types and nothing else.
//
// Units: sim units; each cell type says how many µm one unit stands for (`umPerUnit`).
// World is y-up, the floor is the plane y = 0.

import type { Plane, Primitive as EnginePrimitive, Vec3 } from '@feldaher/cell-engine/contracts';

// The engine's types (soft bodies, meshes, cuts); this file adds the cells.
export type { CutChild, CutPlan, Piece, Plane, PrimKind, SimMesh, SimParams, SkinMesh, Vec3, WorldMesh } from '@feldaher/cell-engine/contracts';
export { Prim, PRIM_STRIDE } from '@feldaher/cell-engine/contracts';

/** Material ids. The numeric values are shared with the WGSL shaders. */
export const Mat = {
  Cytoplasm: 0,
  Wall: 1,
  Nucleus: 2,
  Nucleolus: 3,
  Vacuole: 4,
  Mitochondrion: 5,
  Septin: 6,
  BudScar: 7,
  Actin: 8,
  Adhesion: 9,
  Lysosome: 10,
  ER: 11,
  /** Bacterial chromosome (no envelope around it). */
  Nucleoid: 12,
  /** Microtubules: interphase bundles, the mitotic spindle, the centrosome. */
  Spindle: 13,
  /** The cytokinetic ring: actomyosin in yeasts, FtsZ in bacteria. */
  Ring: 14,
  /** New cell wall laid down across the cell at division. */
  Septum: 15,
  Golgi: 16,
  /** Chemoreceptor array. */
  Receptor: 17,
  Chloroplast: 18,
  /** Peroxisomes, and the Woronin bodies fungi make from them. */
  Peroxisome: 19,
  /** A virus's nucleic acid, packed with or without protein. */
  Genome: 20,
  /** Structural protein of a virus drawn as a solid part: a tail tube, a spike. */
  ViralProtein: 21,
  /** Small membrane carriers: secretory vesicles, endosomes, the Spitzenkörper of a hypha. */
  Vesicle: 22,
  /** Stress-induced protein and RNA condensate (a stress granule); shown only while a stress has formed them. */
  Condensate: 23,
} as const;
export type Material = (typeof Mat)[keyof typeof Mat];
export const MATERIAL_COUNT = 24;
/** Colour slots for materials in the GPU frame uniform (see common.wgsl). */
export const MATERIAL_SLOTS = 24;

/** One organelle or body SDF primitive (see the engine's Primitive), with a Jelly Cells material. */
export type Primitive = EnginePrimitive<Material>;

export interface Ellipsoid {
  centre: Vec3;
  radii: Vec3;
}

/**
 * One term of the body SDF, combined in order with the running result.
 * 'morph' starts a second body: parts before it are body A, it and the parts after it
 * are body B, and the cell is (1 − t)·A + t·B with t = this part's `blend`.
 * At most one 'morph' part per body.
 */
export interface BodyPart {
  prim: Primitive;
  op: 'union' | 'subtract' | 'morph';
  /** Smooth blend radius (sim units); 0 = hard. For 'morph', the interpolation weight t ∈ [0, 1]. */
  blend: number;
}

export interface Anatomy {
  cellType: CellTypeId;
  /** Position in the cell type's stages (0 when it has none); fractional between two stages while morphing. */
  stage: number;
  /** The outer body: parts are combined in order (the first one's op is ignored). */
  body: BodyPart[];
  /** Box that contains the body (sim units). */
  bounds: { lo: Vec3; hi: Vec3 };
  /** Cell wall / cortex thickness drawn on knife faces (sim units). */
  wallThickness: number;
  /** Depth below the surface whose tets count as wall/cortex in the simulation. */
  cortexDepth: number;
  /** Lattice spacing limits for the tet mesh. */
  mesh: { minSpacing: number; maxSpacing: number; minParticles: number; skinGrid: number };
  /** Organelles in paint priority order: earlier entries win where they overlap. */
  organelles: Primitive[];
  /** Tubular organelles as polylines (their capsules are also in `organelles`). */
  tubules: { points: Vec3[]; radius: number; material: Material; motion?: TubeMotion }[];
  seed: number;
  /**
   * Set on the stage at which the cell has just divided: the rest-space plane through the
   * bridge that still joins the daughters. The world splits the cell along it.
   */
  fission?: Plane;
}

/**
 * How a tubule moves, drawn by the shader: 'instability' = both ends grow out from the middle,
 * pause and collapse (microtubules); 'transport' = short stretches travel along it (organelles
 * carried on a track; only the travelling stretches are drawn).
 */
export type TubeMotion = 'instability' | 'transport';

export type CellTypeId = 'yeast' | 'pombe' | 'ecoli' | 'rbc' | 'fibroblast' | 'microglia' | 'neuron' | 'animal' | 'plant' | 'aspergillus' | 'phage' | 'coronavirus';

/** A teaching label pinned to a point inside the cell. */
export interface Label {
  id: string;
  name: string;
  /** Rest-space anchor; it rides along with the jelly. */
  anchor: Vec3;
  /** The material it names, for highlighting (omit for regions such as "axon"). */
  material?: Material;
  /** Real size, e.g. "≈ 2 µm across". */
  size: string;
  blurb: string;
}

export interface CellType {
  id: CellTypeId;
  name: string;
  /** The title as it is set: one line, or two when the name has a word to break at, e.g. ["Budding", "Yeast."]. */
  title: [string] | [string, string];
  tagline: string[];
  /** How many µm one sim unit stands for. */
  umPerUnit: number;
  /** The anatomy at an integer stage. Fractional stages come from `anatomyOf`, which morphs neighbours. */
  build(seed?: number, stage?: number): Anatomy;
  /** Optional life stages a slider can step through (e.g. the yeast cell cycle). */
  stages?: Stage[];
  /** What the stage slider is called, e.g. "Cell cycle" or "Injury response". */
  stageLabel?: string;
  defaultStage?: number;
  labels(an: Anatomy): Label[];
  /** Materials listed in the key, with this cell type's names for them. */
  key: { material: Material; name: string }[];
  /** Stiffness multipliers per material (missing = 1). */
  stiffness: Partial<Record<Material, number>>;
  /** Brightfield cytoplasm absorption override (e.g. haemoglobin red). */
  absorb?: Vec3;
  camera: { dist: number; yaw: number; pitch: number };
  help: string;
  about: string;
  /** The stresses this cell has a measured response to; cells without any have no stress lab. */
  stress?: StressResponse[];
}

/** A cell's state some time after a stress began. */
export interface StressState {
  /** Cell volume relative to the unstressed cell. */
  relVolume: number;
  /** What the reporter reads out (see `StressResponse.signalName`): 0 = as unstressed, 1 = the largest response. */
  signal: number;
  /** How far visible condensates (foci) have formed, 0–1. */
  foci: number;
}

/** How the Reporter view is lit: brightness of each part relative to the unstressed cytoplasm. */
export interface ReporterLook {
  cytoplasm: number;
  nucleus: number;
  condensate: number;
}

export type StressId = 'osmotic' | 'heat';

/** A cell type's measured response to one kind of stress (src/cells/stress). */
export interface StressResponse {
  id: StressId;
  /** Short name on its button, e.g. "Salt". */
  name: string;
  /** The tagged protein the Reporter view shows, e.g. "Hog1-GFP". */
  reporter: string;
  /** What `StressState.signal` measures, e.g. "Nuclear Hog1". */
  signalName: string;
  /** The dose at which the cell is unstressed (0 M NaCl, 30 °C). */
  baseline: number;
  /** The doses that were measured; the lab offers these. */
  doses: number[];
  /** A dose as text with its unit, e.g. "0.4 M" or "42 °C". */
  format(dose: number): string;
  /** How many times faster than real time the response is shown. */
  speedup: number;
  /** Where the numbers come from, as shown to the player. */
  source: string;
  /** What the live graph plots, the main line first. */
  traces: { key: 'signal' | 'foci'; name: string }[];
  /**
   * State `minutes` after the dose was set to `dose`, for a cell that was in state `from` at
   * that moment (unstressed when omitted). A response that does not model a change from one
   * stressed state to another ignores `from`.
   */
  at(dose: number, minutes: number, from?: StressState): StressState;
  look(state: StressState): ReporterLook;
}

/** One stress experiment as the player measured it. */
export interface RunRecord {
  stress: StressId;
  dose: number;
  /** Cell minutes observed so far. */
  minutes: number;
  /** Lowest volume seen, relative to the unstressed cell. */
  lowestVolume: number;
  /** Highest reporter signal seen, 0–1. */
  highestSignal: number;
  /** Minute at which the signal was highest; null until it has passed its peak. */
  peakMinutes: number | null;
  /** Whether visible condensates were seen. */
  foci: boolean;
  /** The samples taken, for the live graph. */
  trace: TracePoint[];
  /** Minutes at which the dose was changed during the run (e.g. back to the growth temperature). */
  changes: number[];
}

/** One sample of a run. */
export interface TracePoint {
  minutes: number;
  signal: number;
  foci: number;
}

/** A real image of a labelled structure, from Wikimedia Commons, shown on its label card. */
export interface Micrograph {
  /** Path under the site root, e.g. "micrographs/yeast-nucleus.jpg". */
  src: string;
  /** Commons file title, e.g. "File:Yeast membrane proteins.jpg". */
  commons: string;
  author: string;
  license: 'Public domain' | 'CC0' | 'CC BY 2.0' | 'CC BY 2.5' | 'CC BY 3.0' | 'CC BY 4.0' | 'CC BY-SA 2.0' | 'CC BY-SA 2.5' | 'CC BY-SA 3.0' | 'CC BY-SA 4.0';
  modality: 'TEM' | 'SEM' | 'Freeze-fracture EM' | 'Cryo-ET' | 'Fluorescence' | 'Confocal' | 'Two-photon' | 'Light' | 'Phase contrast' | 'DIC';
  /** What the image shows and in what organism/tissue. */
  caption: string;
}

/** One organelle type met by a knife cut. */
export interface SectionEntry {
  material: Material;
  /** Section area in µm². */
  areaUm2: number;
  /** Equivalent diameter of the largest profile, µm. */
  widthUm: number;
  /** Number of separate profiles. */
  count: number;
}

/**
 * What the jelly is coloured by: its anatomy, how much it is deformed (mechanical strain),
 * or where a fluorescently tagged protein is (the cell type's stress reporter).
 */
export type ViewMode = 'anatomy' | 'deformation' | 'reporter';

/** A point in a cell's life that the anatomy can be built at (e.g. a cell-cycle phase). */
export interface Stage {
  /** Short name on the slider, e.g. "G1". */
  name: string;
  /** Title of the stage, e.g. "Unbudded". */
  title: string;
  blurb: string;
}

export interface Stats {
  massPg: number;
  volumePct: number;
  kineticMicroJ: number;
  pieces: number;
}
