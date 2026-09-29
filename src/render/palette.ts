// "Varieties": three ways of looking at the same cell. Colours are sRGB hex;
// the renderer converts them to linear. Indices match the WGSL palette slots.

export interface Variety {
  id: 'brightfield' | 'fluorescence' | 'electron';
  name: string;
  /** Page / floor colour. */
  background: string;
  ink: string;
  /** Beer–Lambert absorption per µm of cytoplasm, rgb. */
  absorb: [number, number, number];
  scatter: string;
  scatterDensity: number;
  wall: string;
  nucleus: string;
  nucleolus: string;
  vacuole: string;
  mitochondrion: string;
  septin: string;
  budScar: string;
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
    wall: '#f4efe2', nucleus: '#9d8fc4', nucleolus: '#5d4a8e', vacuole: '#cfe0e6',
    mitochondrion: '#d9724e', septin: '#3f9a8c', budScar: '#b79c73',
    membrane: '#3a2f2a', membraneStrength: 0.35, emissive: 0, refraction: 0.035, gloss: 0.7,
    swatch: ['#f4efe2', '#e5c68e'],
  },
  {
    id: 'fluorescence', name: 'Fluoro', background: '#16181b', ink: '#e8e6e1',
    absorb: [0.2, 0.17, 0.12], scatter: '#2a3440', scatterDensity: 0.1,
    wall: '#6f86ff', nucleus: '#ff4f6a', nucleolus: '#ffb3c0', vacuole: '#c46bff',
    mitochondrion: '#57ff7c', septin: '#35e3ff', budScar: '#9fb4ff',
    membrane: '#e070ff', membraneStrength: 0.25, emissive: 1, refraction: 0.03, gloss: 0.3,
    swatch: ['#16181b', '#57ff7c'],
  },
  {
    id: 'electron', name: 'EM', background: '#d9d9d6', ink: '#1a1a1a',
    absorb: [0.5, 0.5, 0.48], scatter: '#8e8e89', scatterDensity: 0.6,
    wall: '#dcdcd7', nucleus: '#76766f', nucleolus: '#2e2e2c', vacuole: '#ededea',
    mitochondrion: '#3c3c39', septin: '#262624', budScar: '#8c8c88',
    membrane: '#121212', membraneStrength: 0.85, emissive: 0, refraction: 0.02, gloss: 0.35,
    swatch: ['#ecece8', '#6a6a66'],
  },
];

export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
}

/** Packs a variety into 14 vec4 palette slots (see common.wgsl). */
export function packPalette(v: Variety): Float32Array {
  const o = new Float32Array(14 * 4);
  const set = (i: number, rgb: number[], w = 1) => { o.set(rgb, 4 * i); o[4 * i + 3] = w; };
  set(0, v.absorb);
  set(1, hexToLinear(v.scatter), v.scatterDensity);
  set(2, hexToLinear(v.wall));
  set(3, hexToLinear(v.nucleus));
  set(4, hexToLinear(v.nucleolus));
  set(5, hexToLinear(v.vacuole));
  set(6, hexToLinear(v.mitochondrion));
  set(7, hexToLinear(v.septin));
  set(8, hexToLinear(v.budScar));
  set(9, hexToLinear(v.background));
  set(10, hexToLinear(v.membrane), v.membraneStrength);
  set(11, [v.refraction, v.emissive, v.gloss], 0);
  set(12, hexToLinear(v.ink));
  return o;
}
