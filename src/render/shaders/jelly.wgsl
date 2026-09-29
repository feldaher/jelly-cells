// The jelly: front faces of a piece's skin. Refracts the opaque scene by the
// thickness of jelly along the view ray, absorbs it (Beer–Lambert), adds milky
// scattering, a thin-edge back glow, Fresnel reflections and GGX highlights.
// Knife faces show a stained section of whatever organelle lies in the plane.

@group(2) @binding(0) var<uniform> piece: PieceU;

@group(3) @binding(0) var sceneColor: texture_2d<f32>;
@group(3) @binding(1) var linSampler: sampler;
@group(3) @binding(2) var sceneDepth: texture_depth_2d;
@group(3) @binding(3) var backDepth: texture_depth_2d;

struct VIn { @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) rest: vec4f };
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) nrm: vec3f,
  @location(2) rest: vec3f,
  @location(3) cut: f32,
  @location(4) viewZ: f32,
};

@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  o.clip = F.viewProj * vec4f(v.pos, 1.0);
  o.world = v.pos; o.nrm = v.nrm; o.rest = v.rest.xyz; o.cut = v.rest.w;
  o.viewZ = -(F.view * vec4f(v.pos, 1.0)).z;
  return o;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let N = normalize(in.nrm);
  let V = normalize(F.camPos.xyz - in.world);
  let L = F.lightDir.xyz;
  let px = vec2i(in.clip.xy);
  let uv = in.clip.xy * F.screen.zw;
  let isCut = in.cut > 0.5;
  let emissive = F.palette[4].y;

  // Thickness of jelly behind this point, stopping at anything opaque inside it.
  let zBack = linearDepth(textureLoad(backDepth, px, 0));
  let zOpaque = linearDepth(textureLoad(sceneDepth, px, 0));
  let thick = max(0.0, min(zBack, zOpaque) - in.viewZ);
  let tRef = min(thick, 4.0);

  // Refraction: bend the view of the scene behind by the surface normal.
  let nView = (F.view * vec4f(N, 0.0)).xyz;
  // offset shrinks with distance so thin processes do not act as magnifying lenses
  var ruv = uv - nView.xy * vec2f(1.0, -1.0) * F.palette[4].x * tRef * (9.0 / max(in.viewZ, 1.0));
  ruv = clamp(ruv, vec2f(0.001), vec2f(0.999));
  // don't pull in things that sit in front of the jelly (the knife)
  let rpx = vec2i(ruv * F.screen.xy);
  if (linearDepth(textureLoad(sceneDepth, rpx, 0)) < in.viewZ) { ruv = uv; }
  let behind = textureSampleLevel(sceneColor, linSampler, ruv, 0.0).rgb;

  // Beer–Lambert absorption and milky in-scattering.
  let absorb = F.palette[0].rgb;
  let scat = F.palette[1];
  let sh = shadowAt(in.world, 1.0);
  let light = 0.55 + 0.45 * sh;
  var c = behind * exp(-absorb * thick);
  c = mix(c, scat.rgb * light, 1.0 - exp(-scat.w * thick));

  // Back-lit glow where the jelly is thin.
  let back = pow(max(dot(-L, V), 0.0), 2.0) * 0.5 + 0.25;
  c += scat.rgb * (1.0 - smoothstep(0.0, 1.4, thick)) * back * 0.35 * (1.0 - emissive);

  var rough = 0.16;
  var f0 = 0.035;
  if (isCut) {
    // A stained section through the rest-space anatomy.
    let s = sectionAt(in.rest);
    let m = s.x;
    if (m > 0.5) {
      let base = materialColor(m);
      let diff = 0.55 + 0.45 * max(dot(N, L), 0.0) * light;
      var opac = 0.9;
      if (abs(m - 4.0) < 0.5) { opac = 0.55; }      // vacuole sap is clear-ish
      if (abs(m - 1.0) < 0.5) { opac = 0.8; }
      var lit = mix(base * diff, base * 1.25, emissive);
      let hl = highlight();
      if (hl > -0.5) {
        if (abs(m - hl) < 0.5) { lit = lit * 1.2 + base * 0.25; opac = 1.0; } else { opac *= 0.3; }
      }
      c = mix(c, lit, opac);
    }
    let mem = F.palette[3];
    let line = 1.0 - smoothstep(0.012, 0.035, s.y);
    c = mix(c, mem.rgb, line * mem.w);
    rough = 0.08;
    f0 = 0.03;
  } else {
    // The wall is a thin milky film: strongest at grazing angles.
    let nv = max(dot(N, V), 0.0);
    let film = 0.12 + 0.55 * pow(1.0 - nv, 2.0);
    if (!isHidden(1.0)) { c = mix(c, F.mats[1].rgb * light, film * (1.0 - 0.6 * emissive)); }
    let scar = budScarAt(in.rest);
    c = mix(c, F.mats[7].rgb * light, scar * 0.85);
  }

  // Studio reflections and highlights.
  let nv = max(dot(N, V), 0.0);
  let fr = fresnel(nv, f0);
  c = mix(c, studio(reflect(-V, N)), fr * F.palette[4].z);
  c += vec3f(1.0, 0.98, 0.95) * ggx(N, V, L, rough) * 0.9 * sh;
  let fill = normalize(vec3f(0.7, 0.4, -0.6));
  c += vec3f(0.8, 0.85, 0.95) * ggx(N, V, fill, rough + 0.1) * 0.25;
  return vec4f(c, 1.0);
}
