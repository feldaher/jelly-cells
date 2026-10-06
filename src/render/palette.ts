// "Varieties": three ways of looking at the same cell. Colours are sRGB hex;
// the renderer converts them to linear. Slots match the WGSL Frame palette/mats.

import { Mat, MATERIAL_SLOTS, type Material, type Vec3 } from '../contracts';

export interface Variety {
  id: 'brightfield' | 'fluorescence' | 'electron';
  name: string;
  /** Page / floor colour. */
  background: string;
  ink: string;
  /** Beer–Lambert absorption per unit of cytoplasm, rgb. */
  absorb: Vec3;
  /** In-scattering colour of the cytoplasm (also its key swatch). */
  scatter: string;
  scatterDensity: number;
  /** Colour of every material other than cytoplasm. */
  colors: Partial<Record<Material, string>>;
  membrane: string;
  membraneStrength: number;
  /** 0 = lit pigment, 1 = self-luminous (fluorescence). */
  emissive: number;
  refraction: number;
  /** How mirror-like the jelly surface is (0–1). */
  gloss: number;
  swatch: [string, string];
}

export const VARIETIES: Variety[] = [
  {
    id: 'brightfield', name: 'Brightfield', background: '#e4e0da', ink: '#1d1b19',
    absorb: [0.2, 0.28, 0.5], scatter: '#ecdcbc', scatterDensity: 0.32,
    colors: {
      [Mat.Wall]: '#f4efe2', [Mat.Nucleus]: '#9d8fc4', [Mat.Nucleolus]: '#5d4a8e', [Mat.Vacuole]: '#cfe0e6',
      [Mat.Mitochondrion]: '#d9724e', [Mat.Septin]: '#3f9a8c', [Mat.BudScar]: '#b79c73',
      [Mat.Actin]: '#b8434f', [Mat.Adhesion]: '#4c5fa8', [Mat.Lysosome]: '#d9a638', [Mat.ER]: '#5b6fb8',
      [Mat.Nucleoid]: '#8f7fc0', [Mat.Spindle]: '#3d8f5a', [Mat.Ring]: '#c2356b', [Mat.Septum]: '#e9e2cf',
      [Mat.Golgi]: '#c98a2b', [Mat.Receptor]: '#2f8fa6',
      [Mat.Chloroplast]: '#5f9e3a', [Mat.Peroxisome]: '#c9892f', [Mat.Genome]: '#7d6fc0', [Mat.ViralProtein]: '#c2496b', [Mat.Vesicle]: '#d98f5c',
    },
    membrane: '#3a2f2a', membraneStrength: 0.35, emissive: 0, refraction: 0.035, gloss: 0.7,
    swatch: ['#f4efe2', '#e5c68e'],
  },
  {
    id: 'fluorescence', name: 'Fluoro', background: '#16181b', ink: '#e8e6e1',
    absorb: [0.2, 0.17, 0.12], scatter: '#2a3440', scatterDensity: 0.1,
    colors: {
      [Mat.Wall]: '#6f86ff', [Mat.Nucleus]: '#4f7bff', [Mat.Nucleolus]: '#b9ccff', [Mat.Vacuole]: '#c46bff',
      [Mat.Mitochondrion]: '#57ff7c', [Mat.Septin]: '#35e3ff', [Mat.BudScar]: '#9fb4ff',
      [Mat.Actin]: '#ff4f6a', [Mat.Adhesion]: '#ffd24a', [Mat.Lysosome]: '#ff8a3d', [Mat.ER]: '#ffe066',
      [Mat.Nucleoid]: '#4f8dff', [Mat.Spindle]: '#7dff5a', [Mat.Ring]: '#ff4fa0', [Mat.Septum]: '#a9c4ff',
      [Mat.Golgi]: '#ffb347', [Mat.Receptor]: '#3df0d0',
      [Mat.Chloroplast]: '#ff4a3d', [Mat.Peroxisome]: '#ffd24a', [Mat.Genome]: '#4f8dff', [Mat.ViralProtein]: '#ff5fb0', [Mat.Vesicle]: '#ff9d5c',
    },
    membrane: '#e070ff', membraneStrength: 0.25, emissive: 1, refraction: 0.03, gloss: 0.3,
    swatch: ['#16181b', '#57ff7c'],
  },
  {
    id: 'electron', name: 'EM', background: '#d9d9d6', ink: '#1a1a1a',
    absorb: [0.5, 0.5, 0.48], scatter: '#8e8e89', scatterDensity: 0.6,
    colors: {
      [Mat.Wall]: '#dcdcd7', [Mat.Nucleus]: '#76766f', [Mat.Nucleolus]: '#2e2e2c', [Mat.Vacuole]: '#ededea',
      [Mat.Mitochondrion]: '#3c3c39', [Mat.Septin]: '#262624', [Mat.BudScar]: '#8c8c88',
      [Mat.Actin]: '#4a4a46', [Mat.Adhesion]: '#1e1e1c', [Mat.Lysosome]: '#262624', [Mat.ER]: '#55554f',
      [Mat.Nucleoid]: '#b9b9b3', [Mat.Spindle]: '#30302e', [Mat.Ring]: '#1c1c1b', [Mat.Septum]: '#cfcfca',
      [Mat.Golgi]: '#484844', [Mat.Receptor]: '#222220',
      [Mat.Chloroplast]: '#3a3a37', [Mat.Peroxisome]: '#2a2a28', [Mat.Genome]: '#2e2e2c', [Mat.ViralProtein]: '#3c3c39', [Mat.Vesicle]: '#55554f',
    },
    membrane: '#121212', membraneStrength: 0.85, emissive: 0, refraction: 0.02, gloss: 0.35,
    swatch: ['#ecece8', '#6a6a66'],
  },
];

/** Display colour of a material (cytoplasm shows its scatter colour). */
export function materialHex(v: Variety, m: Material): string {
  return m === Mat.Cytoplasm ? v.scatter : v.colors[m] ?? v.scatter;
}

export function hexToLinear(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
}

/** 6 general palette slots + one colour per material slot, as vec4s (see common.wgsl). */
export function packPalette(v: Variety, absorbOverride?: Vec3): Float32Array {
  const o = new Float32Array((6 + MATERIAL_SLOTS) * 4);
  const set = (i: number, rgb: ArrayLike<number>, w = 1) => { o.set(rgb, 4 * i); o[4 * i + 3] = w; };
  set(0, v.id === 'brightfield' && absorbOverride ? absorbOverride : v.absorb);
  set(1, hexToLinear(v.scatter), v.scatterDensity);
  set(2, hexToLinear(v.background));
  set(3, hexToLinear(v.membrane), v.membraneStrength);
  set(4, [v.refraction, v.emissive, v.gloss], 0);
  set(5, hexToLinear(v.ink));
  for (let m = 1; m < MATERIAL_SLOTS; m++) set(6 + m, hexToLinear(v.colors[m as Material] ?? v.scatter));
  return o;
}
