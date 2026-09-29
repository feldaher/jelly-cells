// Shared uniforms, anatomy SDFs (mirroring src/anatomy/sdf.ts) and lighting.

struct Frame {
  viewProj: mat4x4f,
  view: mat4x4f,
  lightViewProj: mat4x4f,
  floorViewProj: mat4x4f,
  camPos: vec4f,
  lightDir: vec4f,   // unit vector toward the key light
  screen: vec4f,     // width, height, 1/width, 1/height
  proj: vec4f,       // P[2][2], P[3][2], near, far
  params: vec4f,     // time, organelle count, highlighted material (-1 none), hidden-material bitmask
  palette: array<vec4f, 6>,
  mats: array<vec4f, 16>,
};
// palette: 0 absorb | 1 scatter (w density) | 2 background | 3 membrane (w strength)
//          4 (refraction, emissive, gloss) | 5 ink.   mats[m] = colour of material m.

struct Cell { k: vec4f };                          // k = wall thickness, body part count
struct Prim { h: vec4f, a: vec4f, b: vec4f };      // h = kind, material, R, r; a.w = op; b.w = blend
struct PieceU { planes: array<vec4f, 8>, info: vec4f };  // info.x = plane count

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<uniform> cell: Cell;
@group(0) @binding(2) var<storage, read> prims: array<Prim>;

const PI = 3.14159265;

fn ellipsoidSdf(p: vec3f, c: vec3f, r: vec3f) -> f32 {
  let q = p - c;
  let k0 = length(q / r);
  let k1 = length(q / (r * r));
  if (k1 < 1e-6) { return -min(r.x, min(r.y, r.z)); }
  return k0 * (k0 - 1.0) / k1;
}

fn sminPoly(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn primSdf(i: u32, p: vec3f) -> f32 {
  let pr = prims[i];
  let kind = u32(pr.h.x + 0.5);
  if (kind == 0u) { return ellipsoidSdf(p, pr.a.xyz, pr.b.xyz); }
  if (kind == 1u) {
    let ba = pr.b.xyz - pr.a.xyz;
    let pa = p - pr.a.xyz;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - pr.h.w;
  }
  if (kind == 3u) {
    let ba = pr.b.xyz - pr.a.xyz;
    let pa = p - pr.a.xyz;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - mix(pr.h.z, pr.h.w, h);
  }
  let q = p - pr.a.xyz;
  let h = dot(q, pr.b.xyz);
  let radial = length(q - h * pr.b.xyz);
  return length(vec2f(radial - pr.h.z, h)) - pr.h.w;
}

fn smaxPoly(a: f32, b: f32, k: f32) -> f32 { return -sminPoly(-a, -b, k); }

fn bodyCount() -> u32 { return u32(cell.k.y + 0.5); }

/** The body: parts combined in order by smooth union (a.w = 0) or subtraction (a.w = 1). */
fn cellSdf(p: vec3f) -> f32 {
  var d = primSdf(0u, p);
  let n = bodyCount();
  for (var i = 1u; i < n; i++) {
    let q = primSdf(i, p);
    let k = max(prims[i].b.w, 1e-4);
    if (prims[i].a.w < 0.5) { d = sminPoly(d, q, k); } else { d = smaxPoly(d, -q, k); }
  }
  return d;
}

fn isHidden(m: f32) -> bool { return ((u32(F.params.w + 0.5) >> u32(m + 0.5)) & 1u) == 1u; }
fn highlight() -> f32 { return F.params.z; }

fn organelleCount() -> u32 { return u32(F.params.y + 0.5); }

/** Material under a rest-space point and its distance to the nearest visible membrane. */
fn sectionAt(p: vec3f) -> vec2f {
  let wall = cell.k.x;
  let cs = cellSdf(p);
  var edge = 1e3;
  var mat = 0.0;
  var found = false;
  if (!isHidden(1.0)) {
    edge = abs(cs + wall);
    if (cs > -wall) { mat = 1.0; found = true; }
  }
  let b0 = bodyCount();
  let n = b0 + organelleCount();
  for (var i = b0; i < n; i++) {
    let m = prims[i].h.y;
    if (isHidden(m)) { continue; }
    let d = primSdf(i, p);
    if (m > 6.5 && m < 7.5) {
      // bud scars: thickened chitin rings within the wall
      if (found && mat == 1.0 && d < 0.04) { mat = 7.0; }
      continue;
    }
    edge = min(edge, abs(d));
    if (!found && d < 0.0) { mat = m; found = true; }
  }
  return vec2f(mat, edge);
}

/** How strongly a point on the outer skin lies on a bud scar ring. */
fn budScarAt(p: vec3f) -> f32 {
  if (isHidden(7.0)) { return 0.0; }
  var s = 0.0;
  let b0 = bodyCount();
  let n = b0 + organelleCount();
  for (var i = b0; i < n; i++) {
    let m = prims[i].h.y;
    if (m < 6.5 || m > 7.5) { continue; }
    s = max(s, 1.0 - smoothstep(0.0, 0.06, primSdf(i, p)));
  }
  return s;
}

fn materialColor(m: f32) -> vec3f {
  let i = u32(m + 0.5);
  if (i == 0u) { return F.palette[1].rgb; }
  return F.mats[i].rgb;
}

fn linearDepth(d: f32) -> f32 { return F.proj.y / (d + F.proj.x); }

/** A soft studio: warm backdrop, an overhead softbox toward the key light and a cool strip behind. */
fn studio(d: vec3f) -> vec3f {
  let bg = F.palette[2].rgb;
  var c = mix(bg * 0.7, bg * 1.05, smoothstep(-0.3, 0.7, d.y));
  let L = F.lightDir.xyz;
  c += vec3f(1.9, 1.85, 1.75) * smoothstep(0.88, 0.97, dot(d, L));
  let strip = normalize(vec3f(0.75, 0.35, -0.55));
  c += vec3f(0.7, 0.8, 0.95) * smoothstep(0.93, 0.985, dot(d, strip));
  return c;
}

fn ggx(N: vec3f, V: vec3f, L: vec3f, rough: f32) -> f32 {
  let H = normalize(V + L);
  let a = rough * rough;
  let a2 = a * a;
  let nh = max(dot(N, H), 0.0);
  let dd = nh * nh * (a2 - 1.0) + 1.0;
  let D = a2 / (PI * dd * dd);
  let nl = max(dot(N, L), 0.0);
  let nv = max(dot(N, V), 1e-3);
  let k = a * 0.5;
  let G = nl / (nl * (1.0 - k) + k) * nv / (nv * (1.0 - k) + k);
  return D * G / (4.0 * nv);
}

fn fresnel(cosT: f32, f0: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0); }
