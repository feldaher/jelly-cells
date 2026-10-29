// "What did I cut?": what a knife plane passes through, measured on the plane.

import { Mat, type Anatomy, type Material, type Plane, type SectionEntry, type Vec3 } from '../contracts';
import { cellSdf, materialAt, pieceSdf } from '../anatomy/sdf';

/**
 * Samples the section of the piece bounded by `planes` along `plane` (rest space) and
 * reports, per material, its area, the equivalent diameter of its largest profile and
 * how many separate profiles it has. Sorted by area, largest first.
 */
export function sectionReport(an: Anatomy, planes: Plane[], plane: Plane, umPerUnit: number, step = 0.04): SectionEntry[] {
  const n = plane.n;
  const ref: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(n, ref)), v = cross(n, u);
  const o: Vec3 = [n[0] * plane.d, n[1] * plane.d, n[2] * plane.d];
  // extent of the body's box projected on (u, v)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const { lo, hi } = an.bounds;
  for (let c = 0; c < 8; c++) {
    const p = [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]];
    const su = dot(p, u), sv = dot(p, v);
    u0 = Math.min(u0, su); u1 = Math.max(u1, su); v0 = Math.min(v0, sv); v1 = Math.max(v1, sv);
  }
  const nu = Math.ceil((u1 - u0) / step), nv = Math.ceil((v1 - v0) / step);
  const grid = new Int8Array(nu * nv).fill(-1);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const su = u0 + (i + 0.5) * step, sv = v0 + (j + 0.5) * step;
    const x = o[0] + u[0] * su + v[0] * sv, y = o[1] + u[1] * su + v[1] * sv, z = o[2] + u[2] * su + v[2] * sv;
    if (cellSdf(an, x, y, z) >= 0 || pieceSdf(an, planes, x, y, z) >= 0) continue;
    grid[i + nu * j] = materialAt(an, x, y, z, an.wallThickness);
  }

  // Connected profiles per material (4-neighbourhood flood fill).
  const seen = new Uint8Array(grid.length);
  const stats = new Map<Material, { cells: number; count: number; largest: number }>();
  const stack: number[] = [];
  for (let s = 0; s < grid.length; s++) {
    const m = grid[s];
    if (m < 0 || seen[s]) continue;
    let size = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const ci = c % nu, cj = (c - ci) / nu;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= nu || nj >= nv) continue;
        const q = ni + nu * nj;
        if (!seen[q] && grid[q] === m) { seen[q] = 1; stack.push(q); }
      }
    }
    const e = stats.get(m as Material) ?? { cells: 0, count: 0, largest: 0 };
    e.cells += size;
    // ignore specks from sampling a membrane edge-on
    if (size * step * step > 0.004) e.count++;
    e.largest = Math.max(e.largest, size);
    stats.set(m as Material, e);
  }
  const a = step * step * umPerUnit * umPerUnit;
  return [...stats.entries()]
    .filter(([, e]) => e.count > 0)
    .map(([material, e]) => ({ material, areaUm2: e.cells * a, widthUm: 2 * Math.sqrt((e.largest * a) / Math.PI), count: e.count }))
    .sort((x, y) => y.areaUm2 - x.areaUm2);
}

/** Combines the reports of several pieces cut by the same stroke. */
export function mergeReports(reports: SectionEntry[][]): SectionEntry[] {
  const m = new Map<Material, SectionEntry>();
  for (const r of reports) for (const e of r) {
    const x = m.get(e.material);
    if (!x) m.set(e.material, { ...e });
    else { x.areaUm2 += e.areaUm2; x.count += e.count; x.widthUm = Math.max(x.widthUm, e.widthUm); }
  }
  return [...m.values()].sort((a, b) => b.areaUm2 - a.areaUm2);
}

/** Section entries worth listing (the cytoplasm and wall are always there). */
export function notableEntries(report: SectionEntry[]): SectionEntry[] {
  return report.filter((e) => e.material !== Mat.Cytoplasm && e.material !== Mat.Wall);
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a: Vec3): Vec3 { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
