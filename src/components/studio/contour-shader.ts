// Topographic contour lines for the light Studio section (WebGL2, one full-screen triangle).
// A slow 3D simplex height field is sliced into evenly spaced contours; every fifth line is an index
// line, a little stronger, like a real survey map. The pointer raises a soft hill, so the lines ring
// around it. Colours are passed in so the lines stay a darker tone of the paper, never grey.

export const CONTOUR_VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const CONTOUR_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uRes;      // canvas size, device px
uniform float uDpr;
uniform float uTime;    // seconds, only advances while visible
uniform float uOffset;  // css px added to y (page scroll with parallax)
uniform vec3 uPointer;  // css px x, y (top-left origin), strength 0..1
uniform vec3 uPaper;
uniform vec3 uLine;

out vec4 outColor;

// 3D simplex noise: Ian McEwan, Stefan Gustavson (Ashima Arts), MIT licence.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

const float LEVELS = 7.0;   // contour lines per unit of height
const float SCALE = 1250.0; // css px per noise unit (bigger = broader hills)

void main() {
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 p = vec2(css.x, css.y + uOffset) / SCALE;
  float t = uTime * 0.028;

  float h = snoise(vec3(p * 1.0, t)) * 0.72
          + snoise(vec3(p * 2.3 + 7.31, t * 1.4)) * 0.22
          + snoise(vec3(p * 5.1 - 3.17, t * 1.9)) * 0.06;

  // Pointer hill (in screen space, so it follows the cursor exactly).
  vec2 d = (css - uPointer.xy) / 190.0;
  h += uPointer.z * 0.28 * exp(-dot(d, d));

  float v = h * LEVELS;
  float w = max(fwidth(v), 1e-4);          // level units per device px
  float f = fract(v);
  float dist = min(f, 1.0 - f) / w;         // device px to the nearest contour

  float k = floor(v + 0.5);
  bool index = mod(k, 5.0) < 0.5;
  float half_ = (index ? 0.85 : 0.5) * uDpr; // half line width, device px
  float cov = 1.0 - smoothstep(half_ - 0.5, half_ + 0.5, dist);

  // Fade where lines crowd together (steep slopes) so it never turns into a smudge.
  float spacing = 1.0 / w;                  // device px between neighbouring contours
  cov *= smoothstep(5.0 * uDpr, 14.0 * uDpr, spacing);

  float strength = index ? 1.0 : 0.62;
  vec3 col = mix(uPaper, uLine, cov * strength);
  outColor = vec4(col, 1.0);
}
`;
