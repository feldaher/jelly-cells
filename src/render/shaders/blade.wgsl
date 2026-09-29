// The steel knife (vertices are pre-transformed on the CPU; rest.w = 0 steel, 1 handle).
struct VIn { @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) rest: vec4f };
struct VOut { @builtin(position) clip: vec4f, @location(0) world: vec3f, @location(1) nrm: vec3f, @location(2) kind: f32 };

@vertex fn vs(v: VIn) -> VOut {
  var o: VOut;
  o.clip = F.viewProj * vec4f(v.pos, 1.0);
  o.world = v.pos; o.nrm = v.nrm; o.kind = v.rest.w;
  return o;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  var N = normalize(in.nrm);
  let V = normalize(F.camPos.xyz - in.world);
  if (dot(N, V) < 0.0) { N = -N; }
  let L = F.lightDir.xyz;
  let sh = shadowAt(in.world, 1.0);
  var c: vec3f;
  if (in.kind < 0.5) {
    let R = reflect(-V, N);
    c = studio(R) * vec3f(0.74, 0.76, 0.8) * fresnel(dot(N, V), 0.55) + vec3f(ggx(N, V, L, 0.22)) * 0.9 * sh + vec3f(0.035);
  } else {
    c = vec3f(0.045, 0.032, 0.028) * (0.4 + 0.6 * max(dot(N, L), 0.0) * sh) + vec3f(ggx(N, V, L, 0.38) * 0.2 * sh);
  }
  return vec4f(c, 1.0);
}
