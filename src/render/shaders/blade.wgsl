// The chef's knife. Vertices are pre-transformed on the CPU; rest.xyz are knife-local
// coordinates (x handle → tip, y up from the edge, z across the blade) and rest.w the part:
// 0 blade flat, 1 wood, 2 bolster, 3 rivet, 4 edge bevel (see KnifePart in cut/knife.ts).
struct VIn { @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) rest: vec4f };
struct VOut { @builtin(position) clip: vec4f, @location(0) world: vec3f, @location(1) nrm: vec3f, @location(2) local: vec3f, @location(3) @interpolate(flat) part: f32 };

@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  o.clip = F.viewProj * vec4f(v.pos, 1.0);
  o.world = v.pos; o.nrm = v.nrm; o.local = v.rest.xyz; o.part = v.rest.w;
  return o;
}

fn hash1(x: f32) -> f32 { return fract(sin(x * 127.1) * 43758.5453); }
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn fbm(p: vec2f) -> f32 { return 0.5 * noise2(p) + 0.3 * noise2(p * 2.3 + 7.1) + 0.2 * noise2(p * 5.1 + 3.7); }

/**
 * What a mirror at `origin` shows along `R`. Above the horizon, the studio. Below it the ray is
 * followed to the table: if it passes through the cell on the way (the floor map holds the
 * height of the cell's underside over every table point) it shows the cell, otherwise the
 * table with whatever shadow lies on it.
 */
fn mirror(origin: vec3f, R: vec3f) -> vec3f {
  let sky = studio(R);
  if (R.y > 0.06) { return sky; }
  let tFloor = min(origin.y / max(-R.y, 0.02), 16.0);
  var cellHit = 0.0;
  var cellY = 0.0;
  for (var i = 1; i <= 10; i++) {
    let q = origin + R * (tFloor * f32(i) / 10.0);
    let under = bodyHeightAt(q.x, q.z);
    if (under < 100.0 && q.y > under - 0.1 && q.y < min(under + 4.0, 5.0)) { cellHit = 1.0; cellY = q.y; break; }
  }
  let onTable = origin + R * tFloor;
  let table = F.palette[2].rgb * mix(0.5, 0.95, shadowAt(onTable, 1.5));
  let jelly = mix(F.palette[1].rgb, F.palette[2].rgb, 0.25) * (0.62 + 0.1 * cellY);
  let below = mix(table, jelly, cellHit);
  return mix(below, sky, smoothstep(-0.06, 0.06, R.y));
}

/** A reflection smeared along `T`, the direction across the brushing scratches. */
fn brushed(origin: vec3f, N: vec3f, V: vec3f, T: vec3f, spread: f32) -> vec3f {
  var c = vec3f(0.0);
  for (var i = -2; i <= 2; i++) {
    let n = normalize(N + T * (f32(i) * spread));
    c += mirror(origin, reflect(-V, n)) * (1.0 - 0.15 * abs(f32(i)));
  }
  return c / 4.1;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  var N = normalize(in.nrm);
  let V = normalize(F.camPos.xyz - in.world);
  if (dot(N, V) < 0.0) { N = -N; }
  let L = F.lightDir.xyz;
  let sh = shadowAt(in.world, 1.0);
  let nv = max(dot(N, V), 0.0);
  let p = in.local;
  // derivatives are taken here, outside any branch: the direction across the brushing scratches
  let dpx = dpdx(in.world); let dpy = dpdy(in.world);
  let dsx = dpdx(p.x); let dsy = dpdy(p.x);
  var T = cross(N, dpx * dsy - dpy * dsx);
  T = T / max(length(T), 1e-6);
  var c: vec3f;
  if (in.part > 0.5 && in.part < 1.5) {
    // Walnut: growth rings cut lengthwise show as wavy lines along the handle, with fine pores.
    let warp = fbm(vec2f(p.x * 0.9, p.y * 2.0 + p.z * 3.0));
    let rings = sin((p.y * 7.0 + p.z * 9.0 + warp * 5.0 + 0.35 * sin(p.x * 1.7)) * 3.1);
    let grain = smoothstep(-0.6, 0.9, rings);
    let pores = noise2(vec2f(p.x * 40.0, (p.y + p.z) * 260.0));
    var wood = mix(vec3f(0.16, 0.075, 0.035), vec3f(0.40, 0.21, 0.10), grain);
    wood *= 0.82 + 0.3 * pores;
    let diff = 0.28 + 0.72 * max(dot(N, L), 0.0) * (0.35 + 0.65 * sh);
    // an oiled finish: a soft sheen, a little of the room at grazing angles
    c = wood * diff + vec3f(ggx(N, V, L, 0.32)) * 0.35 * sh + mirror(in.world, reflect(-V, N)) * fresnel(nv, 0.04) * 0.5;
  } else if (in.part > 2.5 && in.part < 3.5) {
    // brass rivets
    let brass = vec3f(0.86, 0.62, 0.26);
    c = mirror(in.world, reflect(-V, N)) * brass * fresnel(nv, 0.75) + brass * ggx(N, V, L, 0.25) * 1.2 * sh;
  } else {
    // Steel. The flat is satin: ground from spine to edge, so the scratches run up the blade and
    // a reflection smears along its length. The bevel and the bolster are polished.
    let steel = vec3f(0.77, 0.78, 0.80);
    let isFlat = in.part < 0.5;
    let scratch = hash1(floor(p.x * 260.0)) - 0.5;
    var Nm = N;
    var spread = 0.012;
    var rough = 0.14;
    if (isFlat) {
      // a slight hollow in the grind: the face turns upward toward the spine, so the blade shows
      // the table and the cell near its edge and the room above them toward its back
      let hollow = vec3f(0.0, 1.0, 0.0) * (p.y - 0.9) * 0.16;
      Nm = normalize(N + hollow + T * scratch * 0.05);
      spread = 0.07;
      rough = 0.3;
    }
    let refl = brushed(in.world, Nm, V, T, spread);
    c = refl * steel * fresnel(nv, 0.72) + steel * ggx(Nm, V, L, rough) * 1.1 * sh + vec3f(0.02);
    // the grind line: the shoulder between flat and bevel catches the light
    if (in.part > 3.5) { c += vec3f(0.06) * sh; }
    // a faint darkening where the flat meets the spine, as on a forged blade
    if (isFlat) { c *= 0.94 + 0.06 * smoothstep(0.0, 0.5, p.y); }
  }
  return vec4f(c, 1.0);
}
