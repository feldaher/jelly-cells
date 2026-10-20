// The engine's contract: soft bodies made from signed distance fields. Meshing, embedding,
// XPBD, contact and cutting agree on these types and nothing else. The engine knows nothing
// about cells, organelles or tissues: a material is a number the app gives meaning to.
//
// Units: whatever length the app uses ("sim units"); density is 1 per unit³.

export type Vec3 = [number, number, number];

/** A material id. The app owns the table of what each id means. */
export type MaterialId = number;

/** Half-space n·x ≤ d is kept. n is unit length. */
export interface Plane {
  n: Vec3;
  d: number;
}

/** Lattice spacing limits for the tet mesh, and the cell size of the render skin grid. */
export interface MeshSpec {
  minSpacing: number;
  maxSpacing: number;
  minParticles: number;
  skinGrid: number;
  /** Padding of the shape's box before meshing (default 0.3 sim units). */
  pad?: number;
  /** Grid step of the volume estimate that picks the spacing (default 0.2 sim units). */
  volumeStep?: number;
}

/** What the engine meshes: a body as a signed distance (negative inside), cut by planes. */
export interface Shape {
  /** The body including its cut planes. */
  sdf(x: number, y: number, z: number): number;
  /** The body before cutting: knife creases and the normals of the natural surface come from it. */
  uncut(x: number, y: number, z: number): number;
  planes: Plane[];
  /** Material of the tet whose centroid is here. */
  material(x: number, y: number, z: number): MaterialId;
  /** Box that contains the uncut body. */
  bounds: { lo: Vec3; hi: Vec3 };
  mesh: MeshSpec;
}

/** Primitive kinds. The numeric values are shared with WGSL shaders that mirror primSdf. */
export const Prim = { Ellipsoid: 0, Capsule: 1, Torus: 2, Cone: 3, Disc: 4, Bowl: 5 } as const;
export type PrimKind = (typeof Prim)[keyof typeof Prim];

/**
 * One SDF primitive, in rest space.
 *  Ellipsoid: a = centre, b = radii
 *  Capsule:   a = start,  b = end, r = radius
 *  Torus:     a = centre, b = unit axis, R = major radius, r = minor radius
 *  Cone:      a = start,  b = end, R = radius at a, r = radius at b (rounded ends)
 *  Disc:      a = centre, b = axis scaled to the half-thickness, R = outer radius, r = inner radius
 *             (a flat washer; r = 0 makes it a full disc)
 *  Bowl:      a = centre of curvature, b = axis toward the middle of the bowl, scaled to the sine of its
 *             half-angle, R = radius of curvature, r = half-thickness
 *             (a curved sheet: the part of a spherical shell within that angle of the axis, with a rounded rim)
 */
export interface Primitive<M extends number = MaterialId> {
  kind: PrimKind;
  material: M;
  a: Vec3;
  b: Vec3;
  R: number;
  r: number;
}

/** Floats per primitive in a packed GPU buffer: [kind, material, R, r, a.xyz, op, b.xyz, blend]. */
export const PRIM_STRIDE = 12;

/** Tetrahedral simulation mesh of one piece. Arrays are flat xyz / 4-index. */
export interface SimMesh {
  restPos: Float32Array;
  pos: Float32Array;
  prevPos: Float32Array;
  vel: Float32Array;
  /** 0 for a particle that is held in place. */
  invMass: Float32Array;
  tets: Uint32Array;
  tetMaterial: Uint8Array;
  /** Inverse rest edge matrix Dm⁻¹ per tet, 9 floats column-major. */
  restInv: Float32Array;
  restVol: Float32Array;
  /** Unique tet edges, 2 indices each (for damping and mesh display). */
  edges: Uint32Array;
  /** Lattice spacing the mesh was built with (sim units). */
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
  /** 1 when the vertex belongs to a flat knife face, 0 on the natural surface. */
  isCutFace: Uint8Array;
  material: MaterialId;
  /** Rest-space normals from the SDF; when present, normals follow each tet's deformation exactly. */
  restNormal?: Float32Array;
  /** A per-vertex coordinate the app gives meaning to (Jelly Cells: which organelle, how far along a tube). */
  coord?: Float32Array;
  /** Per-vertex value in [0, 1] for a field view (absent otherwise). */
  scalar?: Float32Array;
}

export interface Piece {
  id: number;
  /** Rest-space cut planes bounding this piece (empty for an uncut body). */
  planes: Plane[];
  sim: SimMesh;
  skin: SkinMesh;
  /** Passenger meshes embedded in the same tets (Jelly Cells: organelles). */
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
  /** Volume of the rest shape relative to the mesh as built (1 = as built); the rest shape scales uniformly. */
  volume: number;
  /** Passes of solid contact between pieces per substep (default 1). */
  solidIters?: number;
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

/** A CPU-side triangle mesh in world space, uploaded as-is (used for the knife). */
export interface WorldMesh {
  pos: Float32Array;
  normal: Float32Array;
  /** 4 floats per vertex; w selects steel (0) or handle (1). */
  rest: Float32Array;
  idx: Uint32Array;
}

/** Rest-space triangle mesh before embedding. */
export interface RestMesh {
  pos: Float32Array;
  idx: Uint32Array;
  isCutFace: Uint8Array;
  normal?: Float32Array;
  /** Per-vertex coordinate carried into SkinMesh.coord. */
  coord?: Float32Array;
}

/** Makes the shape of a body for any set of cut planes, plus optional passengers embedded in each piece. */
export interface PieceSource {
  shape(planes: Plane[]): Shape;
  /** Material of the outer skin. */
  skinMaterial: MaterialId;
  /** Passenger meshes for a piece, already embedded in `sim` (e.g. via mesh/embed embedMesh with `grid`). */
  organelles?(planes: Plane[], sim: SimMesh, grid: import('./mesh/embed').TetGrid): SkinMesh[];
}
