struct VOut { @builtin(position) clip: vec4f, @location(0) world: vec3f };

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let c = array<vec2f, 4>(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(1, 1));
  let p = vec3f(c[vi].x * 120.0 + F.camPos.x, 0.0, c[vi].y * 120.0 + F.camPos.z);
  var o: VOut;
  o.clip = F.viewProj * vec4f(p, 1.0);
  o.world = p;
  return o;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let bg = F.palette[2].rgb;
  let sh = shadowAt(in.world, 2.2);
  let ao = contactOcclusion(in.world);
  // shadow light is tinted by the jelly it passed through
  let tint = exp(-F.palette[0].rgb * 1.2);
  let shadowCol = bg * mix(vec3f(0.62), tint * 0.8, 0.45);
  var c = mix(shadowCol, bg, sh);
  c *= 1.0 - 0.55 * ao;
  return vec4f(c, 1.0);
}
