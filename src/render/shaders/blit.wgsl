// Final composite to the canvas: gamma, a gentle vignette and dither.
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var<uniform> bg: vec4f;

struct VOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f };

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let p = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  var o: VOut;
  o.clip = vec4f(p[vi], 0.0, 1.0);
  o.uv = p[vi] * vec2f(0.5, -0.5) + 0.5;
  return o;
}

fn toSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  var c = textureLoad(src, vec2i(in.clip.xy), 0).rgb;
  // soft shoulder so highlights roll off instead of clipping
  let peak = max(c.r, max(c.g, c.b));
  if (peak > 0.8) { c *= (0.8 + (1.0 - exp(-(peak - 0.8) * 2.5)) * 0.2) / peak; }
  let d = distance(in.uv, vec2f(0.5));
  c *= 1.0 - bg.w * smoothstep(0.45, 0.9, d);
  var s = toSrgb(max(c, vec3f(0.0)));
  let n = fract(sin(dot(in.clip.xy, vec2f(12.9898, 78.233))) * 43758.5453);
  s += (n - 0.5) / 255.0;
  return vec4f(s, 1.0);
}
