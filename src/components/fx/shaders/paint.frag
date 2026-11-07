// Screen-paint field (ping-pong): rg = flow velocity in uv units per second.
// Each frame: advect by its own velocity, dissipate, then splat a capsule from the previous to the
// current pointer position. Short-lived on purpose: a thin film of water on glass, not a trail.
precision highp float;

uniform sampler2D uPrev;
uniform vec2 uPointerA;   // previous pointer, uv
uniform vec2 uPointerB;   // current pointer, uv
uniform vec2 uPointerVel; // uv per second
uniform float uRadius;    // brush radius, in height-relative uv
uniform float uAspect;    // width / height
uniform float uDt;
uniform float uActive;    // 0 when the pointer did not move this frame
varying vec2 vUv;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 vel = texture2D(uPrev, vUv).rg;
  vel = texture2D(uPrev, vUv - vel * uDt * 0.9).rg;
  vel *= pow(0.90, uDt * 60.0); // settles in about half a second

  vec2 asp = vec2(uAspect, 1.0);
  float d = segmentDistance(vUv * asp, uPointerA * asp, uPointerB * asp);
  vel += uPointerVel * smoothstep(uRadius, 0.0, d) * uActive * 0.45;

  gl_FragColor = vec4(vel, 0.0, 1.0);
}
