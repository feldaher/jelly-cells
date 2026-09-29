// "Show mesh": tetrahedron edges drawn over everything.
struct Cam { viewProj: mat4x4f, color: vec4f };
@group(0) @binding(0) var<uniform> cam: Cam;
@vertex fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f { return cam.viewProj * vec4f(pos, 1.0); }
@fragment fn fs() -> @location(0) vec4f { return cam.color; }
