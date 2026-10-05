// Volumes of the simple solids the cycle laws are stated for (any consistent unit).

/** A cylinder of total length L (tip to tip) with hemispherical ends of radius R. */
export function rodVolume(L: number, R: number): number {
  return Math.PI * R * R * (L - 2 * R) + (4 / 3) * Math.PI * R ** 3;
}

export function ellipsoidVolume(r: readonly [number, number, number]): number {
  return (4 / 3) * Math.PI * r[0] * r[1] * r[2];
}

/** Radius of the sphere with volume V. */
export function sphereRadius(V: number): number {
  return Math.cbrt((3 * V) / (4 * Math.PI));
}

/**
 * Two equal rods on one axis that overlap so that the waist between them has radius f·R
 * (f = 1: one smooth rod; f → 0: two rods touching at a point). Returns how far the
 * hemispherical ends overlap along the axis.
 */
export function waistOverlap(R: number, f: number): number {
  const c = Math.min(1, Math.max(0, f));
  return 2 * R * (1 - Math.sqrt(1 - c * c));
}
