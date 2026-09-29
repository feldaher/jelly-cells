// Shared shapes for every layer of the simulation. This file is the contract:
// geometry, physics, cutting and rendering all agree on these types and nothing else.
//
// Units: 1 sim unit = 1 µm of cell. World is y-up, the floor is the plane y = 0.

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
} as const;
export type Material = (typeof Mat)[keyof typeof Mat];
export const MATERIAL_COUNT = 8;

/** Primitive kinds. The numeric values are shared with the WGSL shaders. */
export const Prim = { Ellipsoid: 0, Capsule: 1, Torus: 2 } as const;
export type PrimKind = (typeof Prim)[keyof typeof Prim];

/**
 * One organelle SDF primitive, in rest space.
 *  Ellipsoid: a = centre, b = radii
 *  Capsule:   a = start,  b = end, r = radius
 *  Torus:     a = centre, b = unit axis, R = major radius, r = minor radius
 */
export interface Primitive {
  kind: PrimKind;
  material: Material;
  a: Vec3;
  b: Vec3;
  R: number;
  r: number;
}

/** Floats per primitive in the packed GPU buffer: [kind, material, R, r, a.xyz, pad, b.xyz, pad]. */
export const PRIM_STRIDE = 12;

export interface Ellipsoid {
  centre: Vec3;
  radii: Vec3;
}

export interface Anatomy {
  mother: Ellipsoid;
  bud: Ellipsoid;
  /** Smooth-union radius joining mother and bud (µm). */
  neckBlend: number;
  /** Cell wall thickness used for rendering sections (µm). */
  wallThickness: number;
  /** Organelles in paint priority order: earlier entries win where they overlap. */
  organelles: Primitive[];
  /** Mitochondrial tubules as polylines (their capsules are also in `organelles`). */
  tubules: { points: Vec3[]; radius: number }[];
  seed: number;
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
