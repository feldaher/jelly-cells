// Jelly Cells' organelle hooks for the engine's organelle shader (cell-engine render/wgsl.ts):
// the nucleoid's breathing, moving tubes, pores, cristae, grana, FtsZ clusters and the vacuole.
// Cell uniform app values: cell.k.z = µm per unit, cell.k.w = cell type, cell.m.x = microtubule reach.

fn umPerUnit() -> f32 { return cell.k.z; }
/** The cell's place in the dropdown: 0 budding yeast, 1 fission yeast, 2 E. coli, 3 red cell, 4 fibroblast, 5 microglia, 6 neuron. */
fn cellKind() -> i32 { return i32(cell.k.w + 0.5); }
fn isMat(m: f32, id: f32) -> bool { return abs(m - id) < 0.5; }

fn hash11(x: f32) -> f32 { return fract(sin(x * 127.1 + 3.7) * 43758.5453); }
fn hash31(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3f(1.0, 0.0, 0.0)), u.x), mix(hash31(i + vec3f(0.0, 1.0, 0.0)), hash31(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash31(i + vec3f(0.0, 0.0, 1.0)), hash31(i + vec3f(1.0, 0.0, 1.0)), u.x), mix(hash31(i + vec3f(0.0, 1.0, 1.0)), hash31(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

/** The E. coli nucleoid breathes: density shifts along its length and back, 5–10 % within 5 s (real time). */
fn nucleoidSwell(rest: vec3f, time: f32) -> f32 {
  let x = rest.x * umPerUnit();
  let wave = sin(x * 5.2) * sin(6.2832 * time / WAVE_PERIOD) + 0.6 * sin(x * 9.1 + 1.7) * sin(6.2832 * time / (0.63 * WAVE_PERIOD) + 0.9);
  // its surface is lobed, not smooth: bundles of DNA show as bumps
  let lobes = noise3(rest * umPerUnit() * 7.0) - 0.5;
  return WAVE_AMPLITUDE * 0.62 * wave + 0.16 * lobes;
}

fn hookOrganelleOffset(pos: vec3f, nrm: vec3f, rest: vec4f, time: f32) -> vec3f {
  // radius of the nucleoid: 0.32 µm
  if (isMat(rest.w, 12.0)) { return normalize(nrm) * nucleoidSwell(rest.xyz, time) * 0.32 / umPerUnit(); }
  return vec3f(0.0);
}

/** Distance (µm) of a microtubule end from the middle of its bundle at cell time t (s): grow, pause at the tip, collapse. */
fn microtubuleEnd(t: f32, reach: f32) -> f32 {
  let rest = MT_REST * reach;
  let span = reach - rest;
  let grow = span / MT_GROW;
  let period = grow + MT_DWELL + span / MT_SHRINK;
  let u = t - period * floor(t / period);
  if (u < grow) { return rest + MT_GROW * u; }
  if (u < grow + MT_DWELL) { return reach; }
  return reach - MT_SHRINK * (u - grow - MT_DWELL);
}

/** Whether this stretch of a moving tube is there at the moment. */
fn hookOrganelleHidden(mat: f32, coord: f32, rest: vec3f) -> bool {
  let id = floor(coord + 1e-4);
  if (id < 127.5) { return false; }
  let um = umPerUnit();
  if (isMat(mat, 13.0)) {
    // each half of each bundle keeps its own time
    let side = sign(rest.x);
    let reach = cell.m.x * um;
    let period = (1.0 - MT_REST) * reach * (1.0 / MT_GROW + 1.0 / MT_SHRINK) + MT_DWELL;
    let t = F.params.x * MT_SPEEDUP + hash11(id * 2.0 + side) * period;
    return abs(rest.x) * um > microtubuleEnd(t, reach);
  }
  // carried organelles: short stretches travelling along the track, even tracks one way, odd the other
  let s = fract(coord) * 32.0 * um;
  let dir = 1.0 - 2.0 * (id - 2.0 * floor(id / 2.0));
  let along = (s - dir * TRANSPORT_SPEED * TRANSPORT_SPEEDUP * F.params.x) / TRANSPORT_SPACING + hash11(id);
  return fract(along) > TRANSPORT_LENGTH / TRANSPORT_SPACING;
}

/** 1 on a nuclear pore, 0 off it: a dot wherever a random point of the lattice lies within a pore radius of the envelope. */
fn poreAt(rest: vec3f) -> f32 {
  let p = rest * umPerUnit() / PORE_CELL;
  let i = floor(p);
  var d = 9.0;
  for (var x = -1; x <= 1; x++) { for (var y = -1; y <= 1; y++) { for (var z = -1; z <= 1; z++) {
    let c = i + vec3f(f32(x), f32(y), f32(z));
    let q = c + vec3f(hash31(c), hash31(c + 17.3), hash31(c + 41.9));
    d = min(d, distance(p, q));
  } } }
  return 1.0 - smoothstep(0.75, 1.0, d * PORE_CELL / PORE_RADIUS);
}

fn hookOrganelleSurface(base0: vec3f, mat: f32, coord: f32, rest: vec3f) -> vec3f {
  var base = base0;
  let um = umPerUnit();
  let kind = cellKind();
  if (isMat(mat, 2.0)) {
    // Nuclear envelope. In the yeasts the pores are large enough to see; in the animal cells what
    // shows is chromatin: dense clumps in microglia, hardly any in a neuron.
    if (um < 1.4) { base = mix(base, base * 0.45, poreAt(rest)); }
    else {
      var clumps = 0.18;
      if (kind == 5) { clumps = 0.5; }
      if (kind == 6) { clumps = 0.06; }
      base = mix(base, base * 0.5, clumps * smoothstep(0.45, 0.7, noise3(rest * 3.2)));
    }
  }
  if (isMat(mat, 5.0)) {
    // cristae: folds of the inner membrane across the tube (drawn far wider apart than they are)
    let s = fract(coord) * 32.0;
    base = mix(base, base * 0.7, smoothstep(0.5, 0.95, sin(s * 46.0)) * 0.5);
  }
  if (isMat(mat, 18.0)) {
    // grana: the stacks of thylakoids show as darker spots about half a micrometre across
    base = mix(base, base * 0.55, smoothstep(0.52, 0.7, noise3(rest * um * 2.4)));
  }
  if (isMat(mat, 12.0)) {
    // denser DNA is darker: the same wave that moves the surface
    base = base * (1.0 - 0.9 * nucleoidSwell(rest, F.params.x));
  }
  if (isMat(mat, 14.0) && kind == 2) {
    // FtsZ sits in clusters that travel around the ring
    let ang = atan2(rest.z, rest.y);
    let ringR = max(length(rest.yz) * um, 0.05);
    let turn = TREADMILL_SPEED * TREADMILL_SPEEDUP * F.params.x / ringR;
    base = base * (0.55 + 0.9 * smoothstep(0.35, 0.65, noise3(vec3f(cos(ang - turn), sin(ang - turn), 0.0) * 2.6 + 4.0)));
  }
  return base;
}

fn hookOrganelleGlow(base: vec3f, N: vec3f, V: vec3f, mat: f32) -> vec3f {
  // FM4-64 stains the vacuole membrane, not its lumen: bright only where seen edge-on
  if (abs(mat - 4.0) < 0.5) { return base * (0.12 + 1.3 * pow(1.0 - max(dot(N, V), 0.0), 3.0)); }
  return defaultGlow(base, N, V);
}

fn hookOrganelleFinish(c: vec3f, N: vec3f, V: vec3f, mat: f32, emissive: f32) -> vec3f {
  // vacuoles are fluid-filled and glassy
  if (abs(mat - 4.0) < 0.5) { return mix(c, studio(reflect(-V, N)), fresnel(dot(N, V), 0.04) * (1.0 - emissive)); }
  return c;
}

fn hookSectionOpacity(mat: f32) -> f32 {
  if (abs(mat - 4.0) < 0.5) { return 0.55; }      // vacuole sap is clear-ish
  if (abs(mat - 1.0) < 0.5) { return 0.8; }
  return 0.9;
}
