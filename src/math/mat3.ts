// Small 3×3 helpers on column-major number arrays: m[col*3 + row].

export type M3 = Float64Array | number[];

export function det3(m: ArrayLike<number>, o = 0): number {
  return (
    m[o] * (m[o + 4] * m[o + 8] - m[o + 7] * m[o + 5]) -
    m[o + 3] * (m[o + 1] * m[o + 8] - m[o + 7] * m[o + 2]) +
    m[o + 6] * (m[o + 1] * m[o + 5] - m[o + 4] * m[o + 2])
  );
}

/** Inverse of a column-major 3×3 into `out` at offset `oo`. Returns the determinant. */
export function inv3(m: ArrayLike<number>, out: Float32Array | Float64Array, oo = 0): number {
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const s = 1 / det;
  out[oo + 0] = A * s; out[oo + 3] = B * s; out[oo + 6] = C * s;
  out[oo + 1] = -(b * i - c * h) * s; out[oo + 4] = (a * i - c * g) * s; out[oo + 7] = -(a * h - b * g) * s;
  out[oo + 2] = (b * f - c * e) * s; out[oo + 5] = -(a * f - c * d) * s; out[oo + 8] = (a * e - b * d) * s;
  return det;
}

/**
 * Rotation part of A (column-major) by Müller et al.'s iterative quaternion method
 * ("A Robust Method to Extract the Rotational Part of Deformations", 2016).
 * `q` is the warm-start quaternion [x, y, z, w], updated in place.
 */
export function extractRotation(A: ArrayLike<number>, q: number[] = [0, 0, 0, 1], iters = 20): number[] {
  for (let it = 0; it < iters; it++) {
    const R = quatToMat(q);
    // omega = (r0×a0 + r1×a1 + r2×a2) / |r0·a0 + r1·a1 + r2·a2| + eps
    let wx = 0, wy = 0, wz = 0, dot = 0;
    for (let k = 0; k < 3; k++) {
      const rx = R[3 * k], ry = R[3 * k + 1], rz = R[3 * k + 2];
      const ax = A[3 * k], ay = A[3 * k + 1], az = A[3 * k + 2];
      wx += ry * az - rz * ay; wy += rz * ax - rx * az; wz += rx * ay - ry * ax;
      dot += rx * ax + ry * ay + rz * az;
    }
    const s = 1 / (Math.abs(dot) + 1e-9);
    wx *= s; wy *= s; wz *= s;
    const w = Math.hypot(wx, wy, wz);
    if (w < 1e-9) break;
    const h = w / 2, sh = Math.sin(h) / w;
    const dq = [wx * sh, wy * sh, wz * sh, Math.cos(h)];
    const nq = quatMul(dq, q);
    const l = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
    q[0] = nq[0] / l; q[1] = nq[1] / l; q[2] = nq[2] / l; q[3] = nq[3] / l;
  }
  return quatToMat(q);
}

export function quatMul(a: number[], b: number[]): number[] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** Column-major rotation matrix of quaternion [x, y, z, w]. */
export function quatToMat(q: number[]): number[] {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
}

export function axisAngleMat(ax: number, ay: number, az: number, angle: number): number[] {
  const l = Math.hypot(ax, ay, az) || 1, s = Math.sin(angle / 2) / l;
  return quatToMat([ax * s, ay * s, az * s, Math.cos(angle / 2)]);
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
