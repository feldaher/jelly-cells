// Signed distance fields of the cell and its organelles, in rest space (µm).
// The WGSL in render/shaders/anatomy.wgsl mirrors primSdf / cellSdf exactly.

import { Mat, Prim, PRIM_STRIDE, type Anatomy, type Ellipsoid, type Material, type Plane, type Primitive } from '../contracts';

export function ellipsoidSdf(e: Ellipsoid, x: number, y: number, z: number): number {
  const px = x - e.centre[0], py = y - e.centre[1], pz = z - e.centre[2];
  const [rx, ry, rz] = e.radii;
  const ax = px / rx, ay = py / ry, az = pz / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const k1 = Math.sqrt((ax * ax) / (rx * rx) + (ay * ay) / (ry * ry) + (az * az) / (rz * rz));
  if (k1 < 1e-9) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

export function primSdf(p: Primitive, x: number, y: number, z: number): number {
  switch (p.kind) {
    case Prim.Ellipsoid:
      return ellipsoidSdf({ centre: p.a, radii: p.b }, x, y, z);
    case Prim.Capsule: {
      const bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2];
      const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
      const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
      const qx = pax - bax * h, qy = pay - bay * h, qz = paz - baz * h;
      return Math.sqrt(qx * qx + qy * qy + qz * qz) - p.r;
    }
    case Prim.Torus: {
      const qx = x - p.a[0], qy = y - p.a[1], qz = z - p.a[2];
      const h = qx * p.b[0] + qy * p.b[1] + qz * p.b[2];
      const rx = qx - h * p.b[0], ry = qy - h * p.b[1], rz = qz - h * p.b[2];
      const radial = Math.sqrt(rx * rx + ry * ry + rz * rz) - p.R;
      return Math.sqrt(radial * radial + h * h) - p.r;
    }
  }
  return Infinity;
}

/** The whole cell: mother and bud fused by a smooth union at the neck. */
export function cellSdf(an: Anatomy, x: number, y: number, z: number): number {
  return smin(ellipsoidSdf(an.mother, x, y, z), ellipsoidSdf(an.bud, x, y, z), an.neckBlend);
}

export function planeDist(pl: Plane, x: number, y: number, z: number): number {
  return pl.n[0] * x + pl.n[1] * y + pl.n[2] * z - pl.d;
}

/** A piece: the cell clipped by its knife half-spaces. */
export function pieceSdf(an: Anatomy, planes: Plane[], x: number, y: number, z: number): number {
  let d = cellSdf(an, x, y, z);
  for (const pl of planes) d = Math.max(d, planeDist(pl, x, y, z));
  return d;
}

/** Unit gradient of any scalar field, from four tetrahedral samples. */
export function gradient(f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, h = 1e-3): [number, number, number] {
  const a = f(x + h, y - h, z - h), b = f(x - h, y - h, z + h), c = f(x - h, y + h, z - h), d = f(x + h, y + h, z + h);
  const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
  const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  return [gx / l, gy / l, gz / l];
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

/** Packs organelles as [kind, material, R, r, a.xyz, 0, b.xyz, 0] for the GPU storage buffer. */
export function packAnatomyGPU(an: Anatomy): Float32Array {
  const out = new Float32Array(Math.max(1, an.organelles.length) * PRIM_STRIDE);
  an.organelles.forEach((o, i) => {
    const b = i * PRIM_STRIDE;
    out[b] = o.kind; out[b + 1] = o.material; out[b + 2] = o.R; out[b + 3] = o.r;
    out.set(o.a, b + 4); out.set(o.b, b + 8);
  });
  return out;
}
