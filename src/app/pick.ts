// Screen rays and ray casting against the deformed skins.

import type { Piece, Vec3 } from '../contracts';
import { invert, transformPoint, type M4 } from '../math/mat4';

export interface Ray { o: Vec3; d: Vec3 }

export function screenRay(viewProj: M4, x: number, y: number, w: number, h: number): Ray {
  const inv = invert(viewProj);
  const nx = (2 * x) / w - 1, ny = 1 - (2 * y) / h;
  const a = transformPoint(inv, [nx, ny, 0]), b = transformPoint(inv, [nx, ny, 1]);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  return { o: a as Vec3, d: [d[0] / l, d[1] / l, d[2] / l] };
}

export function raycast(pieces: Piece[], r: Ray): { piece: Piece; point: Vec3; t: number } | null {
  let best: { piece: Piece; point: Vec3; t: number } | null = null;
  for (const piece of pieces) {
    const { pos: P, idx } = piece.skin;
    for (let i = 0; i < idx.length; i += 3) {
      const a = 3 * idx[i], b = 3 * idx[i + 1], c = 3 * idx[i + 2];
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const px = r.d[1] * e2z - r.d[2] * e2y, py = r.d[2] * e2x - r.d[0] * e2z, pz = r.d[0] * e2y - r.d[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const tx = r.o[0] - P[a], ty = r.o[1] - P[a + 1], tz = r.o[2] - P[a + 2];
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (r.d[0] * qx + r.d[1] * qy + r.d[2] * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t > 0 && (!best || t < best.t)) best = { piece, t, point: [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t] };
    }
  }
  return best;
}

export function rayPlane(r: Ray, n: Vec3, p: Vec3): Vec3 | null {
  const den = n[0] * r.d[0] + n[1] * r.d[1] + n[2] * r.d[2];
  if (Math.abs(den) < 1e-6) return null;
  const t = (n[0] * (p[0] - r.o[0]) + n[1] * (p[1] - r.o[1]) + n[2] * (p[2] - r.o[2])) / den;
  if (t < 0) return null;
  return [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t];
}
