@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowCmp: sampler_comparison;
@group(1) @binding(2) var floorMap: texture_depth_2d;

/** Height range of the bottom-up floor map (see renderer: camera at y = -FLOOR_BELOW looking up). */
const FLOOR_BELOW = 0.5;
const FLOOR_RANGE = 20.0;

fn shadowAt(world: vec3f, soft: f32) -> f32 {
  let lp = F.lightViewProj * vec4f(world, 1.0);
  let uv = lp.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0)) || lp.z > 1.0) { return 1.0; }
  let texel = 1.0 / vec2f(textureDimensions(shadowMap));
  var s = 0.0;
  for (var i = -2; i <= 2; i++) {
    for (var j = -2; j <= 2; j++) {
      s += textureSampleCompareLevel(shadowMap, shadowCmp, uv + vec2f(f32(i), f32(j)) * texel * soft, lp.z - 0.003);
    }
  }
  return s / 25.0;
}

/** Height of the lowest body surface above a floor point (large when nothing is overhead). */
fn bodyHeightAt(x: f32, z: f32) -> f32 {
  let fp = F.floorViewProj * vec4f(x, 0.0, z, 1.0);
  let uv = fp.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 1e3; }
  let dims = vec2f(textureDimensions(floorMap));
  let d = textureLoad(floorMap, vec2i(uv * dims), 0);
  if (d >= 1.0) { return 1e3; }
  return d * FLOOR_RANGE - FLOOR_BELOW;
}

fn contactOcclusion(world: vec3f) -> f32 {
  var occ = 0.0;
  var wsum = 0.0;
  for (var r = 0; r < 3; r++) {
    let rad = 0.35 + f32(r) * 0.55;
    for (var k = 0; k < 8; k++) {
      let a = f32(k) * PI / 4.0 + f32(r) * 0.4;
      let h = bodyHeightAt(world.x + cos(a) * rad, world.z + sin(a) * rad);
      let w = 1.0 / (1.0 + f32(r));
      occ += w * (1.0 - smoothstep(0.0, 1.6, h));
      wsum += w;
    }
  }
  return occ / wsum;
}
