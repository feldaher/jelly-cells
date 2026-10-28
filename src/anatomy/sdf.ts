// Signed distance fields of the cell and its organelles, in rest space (sim units).
// The WGSL in cell-engine's render/shaders/common.wgsl mirrors primSdf / cellSdf exactly. The primitives are the engine's.

import { Mat, type Anatomy, type BodyPart, type Ellipsoid, type Material, type Plane, type Vec3 } from '../contracts';
import { planeDist, primBounds, primSdf, smax, smin } from '@feldaher/cell-engine/sdf/primitives';
import { packPrimitives } from '@feldaher/cell-engine/render/primitives';

export { gradient, planeDist, primBounds, primSdf, smax, smin } from '@feldaher/cell-engine/sdf/primitives';

export function ellipsoidSdf(e: Ellipsoid, x: number, y: number, z: number): number {
  const px = x - e.centre[0], py = y - e.centre[1], pz = z - e.centre[2];
  const [rx, ry, rz] = e.radii;
  const ax = px / rx, ay = py / ry, az = pz / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const k1 = Math.sqrt((ax * ax) / (rx * rx) + (ay * ay) / (ry * ry) + (az * az) / (rz * rz));
  if (k1 < 1e-9) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

/**
 * The whole cell: its body parts combined in order by smooth union / subtraction.
 * A 'morph' part closes the body so far (A) and starts a second one (B); the result is (1 − t)·A + t·B.
 */
export function cellSdf(an: Anatomy, x: number, y: number, z: number): number {
  const body = an.body;
  let d = primSdf(body[0].prim, x, y, z);
  let dA = 0, t = -1;
  for (let i = 1; i < body.length; i++) {
    const b = body[i], p = primSdf(b.prim, x, y, z);
    if (b.op === 'morph') { dA = d; t = b.blend; d = p; }
    else if (b.op === 'union') d = b.blend > 0 ? smin(d, p, b.blend) : Math.min(d, p);
    else d = b.blend > 0 ? smax(d, -p, b.blend) : Math.max(d, -p);
  }
  return t < 0 ? d : dA + (d - dA) * t;
}

/** Box around the union parts of a body, padded by their blends. */
export function bodyBounds(body: BodyPart[]): { lo: Vec3; hi: Vec3 } {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  body.forEach((b, i) => {
    if (i > 0 && b.op === 'subtract') return;
    const bb = primBounds(b.prim), pad = b.op === 'morph' ? 0 : b.blend;
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], bb.lo[k] - pad); hi[k] = Math.max(hi[k], bb.hi[k] + pad); }
  });
  return { lo, hi };
}

/** A piece: the cell clipped by its knife half-spaces. */
export function pieceSdf(an: Anatomy, planes: Plane[], x: number, y: number, z: number): number {
  let d = cellSdf(an, x, y, z);
  for (const pl of planes) d = Math.max(d, planeDist(pl, x, y, z));
  return d;
}

/**
 * Which material occupies a rest-space point. Anything within `wallDepth` of the
 * cell surface is wall; otherwise the first organelle containing the point wins.
 */
export function materialAt(an: Anatomy, x: number, y: number, z: number, wallDepth = an.wallThickness): Material {
  if (cellSdf(an, x, y, z) > -wallDepth) return Mat.Wall;
  for (const o of an.organelles) {
    if (o.material === Mat.BudScar) continue;
    if (primSdf(o, x, y, z) < 0) return o.material;
  }
  return Mat.Cytoplasm;
}

/**
 * Packs body parts then organelles as [kind, material, R, r, a.xyz, op, b.xyz, blend]
 * for the GPU storage buffer (op: 0 union, 1 subtract, 2 morph).
 */
export function packAnatomyGPU(an: Anatomy): Float32Array {
  return packPrimitives(an.body, an.organelles);
}
