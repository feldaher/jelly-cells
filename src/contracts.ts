// Shared shapes for every layer of the simulation. This file is the contract:
// geometry, physics, cutting and rendering all agree on these types and nothing else.
//
// Units: sim units; each cell type says how many µm one unit stands for (`umPerUnit`).
// World is y-up, the floor is the plane y = 0.

export type Vec3 = [number, number, number];

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
} as const;
export type Material = (typeof Mat)[keyof typeof Mat];
export const MATERIAL_COUNT = 12;

/** Primitive kinds. The numeric values are shared with the WGSL shaders. */
export const Prim = { Ellipsoid: 0, Capsule: 1, Torus: 2, Cone: 3 } as const;
export type PrimKind = (typeof Prim)[keyof typeof Prim];

/**
 * One organelle SDF primitive, in rest space.
 *  Ellipsoid: a = centre, b = radii
 *  Capsule:   a = start,  b = end, r = radius
 *  Torus:     a = centre, b = unit axis, R = major radius, r = minor radius
 *  Cone:      a = start,  b = end, R = radius at a, r = radius at b (rounded ends)
 */
export interface Primitive {
  kind: PrimKind;
  material: Material;
  a: Vec3;
  b: Vec3;
  R: number;
  r: number;
}

/**
 * Floats per primitive in the packed GPU buffer: [kind, material, R, r, a.xyz, op, b.xyz, blend].
 * Body parts come first, then organelles.
 */
export const PRIM_STRIDE = 12;

export interface Ellipsoid {
  centre: Vec3;
  radii: Vec3;
}

/** One term of the body SDF, combined in order with the running result. */
export interface BodyPart {
  prim: Primitive;
  op: 'union' | 'subtract';
  /** Smooth blend radius (sim units); 0 = hard. */
  blend: number;
}

export interface Anatomy {
  cellType: CellTypeId;
  /** Index into the cell type's stages (0 when it has none). */
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
  tubules: { points: Vec3[]; radius: number; material: Material }[];
  seed: number;
}

export type CellTypeId = 'yeast' | 'rbc' | 'fibroblast' | 'microglia' | 'neuron';

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
  /** Two display lines of the title, e.g. ["Budding", "Yeast."]. */
  title: [string, string];
  tagline: string[];
  /** How many µm one sim unit stands for. */
  umPerUnit: number;
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

/** Half-space n·x ≤ d is kept. n is unit length. */
export interface Plane {
  n: Vec3;
  d: number;
}

/** Tetrahedral simulation mesh of one piece. Arrays are flat xyz / 4-index. */
export interface SimMesh {
  restPos: Float32Array;
  pos: Float32Array;
  prevPos: Float32Array;
  vel: Float32Array;
  invMass: Float32Array;
  tets: Uint32Array;
  tetMaterial: Uint8Array;
  /** Inverse rest edge matrix Dm⁻¹ per tet, 9 floats column-major. */
  restInv: Float32Array;
  restVol: Float32Array;
  /** Unique tet edges, 2 indices each (for damping and mesh display). */
  edges: Uint32Array;
  /** Lattice spacing the mesh was built with (µm). */
  spacing: number;
}

/** A render surface whose vertices ride along inside the tets by barycentric weights. */
export interface SkinMesh {
  restPos: Float32Array;
  pos: Float32Array;
  normal: Float32Array;
  idx: Uint32Array;
  tetId: Uint32Array;
  /** 4 weights per vertex, summing to 1. */
  bary: Float32Array;
  /** 1 when the vertex belongs to a flat knife face, 0 on the natural cell surface. */
  isCutFace: Uint8Array;
  /** Organelle material, or Cytoplasm for the cell skin. */
  material: Material;
  /** Rest-space normals from the SDF; when present, normals follow each tet's deformation exactly. */
  restNormal?: Float32Array;
  /** Per-vertex value in [0, 1] shown by the deformation view (absent in the anatomy view). */
  scalar?: Float32Array;
}

/** What the jelly is coloured by: its anatomy, or how much it is deformed (mechanical strain). */
export type ViewMode = 'anatomy' | 'deformation';

/** A point in a cell's life that the anatomy can be built at (e.g. a cell-cycle phase). */
export interface Stage {
  /** Short name on the slider, e.g. "G1". */
  name: string;
  /** Title of the stage, e.g. "Unbudded". */
  title: string;
  blurb: string;
}

export interface Piece {
  id: number;
  /** Rest-space cut planes bounding this piece (empty for the intact cell). */
  planes: Plane[];
  sim: SimMesh;
  skin: SkinMesh;
  organelles: SkinMesh[];
  /** Pieces made by the same knife stroke share a group; contact between them eases in. */
  cutGroup?: number;
  /** Simulation time (s) at which the piece was swapped in. */
  bornAt?: number;
}

export interface SimParams {
  /** 0 (trembling) … 1 (set). */
  firmness: number;
  /** 0 (lively) … 1 (syrupy). */
  damping: number;
  substeps: number;
  gravity: number;
  friction: number;
  /** Stiffness multiplier per material id. */
  materialStiffness: number[];
}

/** A child piece plus where each of its particles sits inside the parent's rest mesh. */
export interface CutChild {
  piece: Piece;
  tetId: Uint32Array;
  bary: Float32Array;
}

/** A knife cut in world space: a plane plus which pieces it will split and into what. */
export interface CutPlan {
  world: Plane;
  splits: { parent: Piece; children: CutChild[] }[];
}

export interface Stats {
  massPg: number;
  volumePct: number;
  kineticMicroJ: number;
  pieces: number;
}
