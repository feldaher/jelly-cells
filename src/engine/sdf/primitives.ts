// Signed distance primitives, in rest space (sim units). WGSL shaders that draw them must mirror primSdf.

import { Prim, type Plane, type Primitive, type Vec3 } from '../contracts';

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

export function primSdf(p: Primitive, x: number, y: number, z: number): number {
  switch (p.kind) {
    case Prim.Ellipsoid: {
      const [rx, ry, rz] = p.b;
      const ax = (x - p.a[0]) / rx, ay = (y - p.a[1]) / ry, az = (z - p.a[2]) / rz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const k1 = Math.sqrt((ax * ax) / (rx * rx) + (ay * ay) / (ry * ry) + (az * az) / (rz * rz));
      if (k1 < 1e-9) return -Math.min(rx, ry, rz);
      return (k0 * (k0 - 1)) / k1;
    }
    case Prim.Cone: {
      // tapered capsule: radius runs linearly from R at a to r at b
      const bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2];
      const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
      const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
      const qx = pax - bax * h, qy = pay - bay * h, qz = paz - baz * h;
      return Math.sqrt(qx * qx + qy * qy + qz * qz) - (p.R + (p.r - p.R) * h);
    }
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
    case Prim.Disc: {
      // a flat washer: |b| is the half-thickness, b/|b| the axis
      const ht = Math.hypot(p.b[0], p.b[1], p.b[2]) || 1e-9;
      const qx = x - p.a[0], qy = y - p.a[1], qz = z - p.a[2];
      const h = (qx * p.b[0] + qy * p.b[1] + qz * p.b[2]) / ht;
      const rx = qx - (h * p.b[0]) / ht, ry = qy - (h * p.b[1]) / ht, rz = qz - (h * p.b[2]) / ht;
      const rad = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const dx = p.r > 0 ? Math.max(rad - p.R, p.r - rad) : rad - p.R, dy = Math.abs(h) - ht;
      return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
    }
    case Prim.Bowl: {
      // a curved sheet: the part of a spherical shell within the half-angle of the axis; |b| is the sine of that angle
      const s = Math.min(1, Math.hypot(p.b[0], p.b[1], p.b[2])) || 1e-9, c = Math.sqrt(1 - s * s);
      const qx = x - p.a[0], qy = y - p.a[1], qz = z - p.a[2];
      const h = (qx * p.b[0] + qy * p.b[1] + qz * p.b[2]) / s;
      const len = Math.sqrt(qx * qx + qy * qy + qz * qz), w = Math.sqrt(Math.max(0, len * len - h * h));
      // inside the cone of the bowl: distance to the sphere; outside it: distance to the rim circle
      return (c * w < s * h ? Math.abs(len - p.R) : Math.hypot(w - p.R * s, h - p.R * c)) - p.r;
    }
  }
  return Infinity;
}

/** Axis-aligned box around a primitive. */
export function primBounds(p: Primitive): { lo: Vec3; hi: Vec3 } {
  switch (p.kind) {
    case Prim.Ellipsoid:
      return { lo: [p.a[0] - p.b[0], p.a[1] - p.b[1], p.a[2] - p.b[2]], hi: [p.a[0] + p.b[0], p.a[1] + p.b[1], p.a[2] + p.b[2]] };
    case Prim.Disc: {
      const e = p.R + Math.hypot(p.b[0], p.b[1], p.b[2]);
      return { lo: [p.a[0] - e, p.a[1] - e, p.a[2] - e], hi: [p.a[0] + e, p.a[1] + e, p.a[2] + e] };
    }
    case Prim.Torus:
    case Prim.Bowl: {
      const e = p.R + p.r;
      return { lo: [p.a[0] - e, p.a[1] - e, p.a[2] - e], hi: [p.a[0] + e, p.a[1] + e, p.a[2] + e] };
    }
    default: {
      const e = Math.max(p.R, p.r);
      return {
        lo: [Math.min(p.a[0], p.b[0]) - e, Math.min(p.a[1], p.b[1]) - e, Math.min(p.a[2], p.b[2]) - e],
        hi: [Math.max(p.a[0], p.b[0]) + e, Math.max(p.a[1], p.b[1]) + e, Math.max(p.a[2], p.b[2]) + e],
      };
    }
  }
}

export function planeDist(pl: Plane, x: number, y: number, z: number): number {
  return pl.n[0] * x + pl.n[1] * y + pl.n[2] * z - pl.d;
}

/** Unit gradient of any scalar field, from four tetrahedral samples. */
export function gradient(f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, h = 1e-3): [number, number, number] {
  const a = f(x + h, y - h, z - h), b = f(x - h, y - h, z + h), c = f(x - h, y + h, z - h), d = f(x + h, y + h, z + h);
  const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
  const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  return [gx / l, gy / l, gz / l];
}
