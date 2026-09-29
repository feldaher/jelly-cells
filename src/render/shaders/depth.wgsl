// Depth-only passes: key-light shadow map, bottom-up floor map, jelly back faces.

struct Cam { viewProj: mat4x4f };
@group(0) @binding(0) var<uniform> cam: Cam;

@vertex fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f {
  return cam.viewProj * vec4f(pos, 1.0);
}
