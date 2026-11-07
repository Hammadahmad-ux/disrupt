// GLSL for the alive background: topographic contour lines (isolines) of a slowly evolving,
// domain-warped noise field. Written once and wrapped for WebGL2 (GLSL ES 3.00) or WebGL1 (1.00).

export const CONTOUR_VERT_300 = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const CONTOUR_VERT_100 = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const HEADER_300 = `#version 300 es
precision highp float;
out vec4 outColor;
#define FRAG_COLOR outColor
`;

const HEADER_100 = `#extension GL_OES_standard_derivatives : enable
precision highp float;
#define FRAG_COLOR gl_FragColor
`;

const BODY = `
uniform vec2 uRes;      // drawing buffer size (px)
uniform vec2 uView;     // viewport size (CSS px)
uniform float uTime;    // field time (already slowed down)
uniform float uScroll;  // page scroll in CSS px, already scaled to the parallax rate
uniform vec3 uMouse;    // xy: smoothed pointer (CSS px, y down), z: influence 0..1
uniform vec2 uMouseVel; // smoothed pointer velocity (CSS px / s)
uniform float uCell;    // size of one noise unit in CSS px
uniform float uDensity; // contour levels per noise unit
uniform float uAlpha;   // opacity of a regular contour
uniform float uLineW;   // line width in drawing-buffer px

// 3D simplex noise. Ashima Arts / Stefan Gustavson (webgl-noise), MIT licence.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
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
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  // Pixel position in CSS px with the origin top-left, like the page.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * uView;

  // Pointer: a soft lens that pushes the lines aside, plus a little drag in the direction of travel.
  vec2 dm = p - uMouse.xy;
  float radius = 0.2 * max(uView.x, uView.y);
  float fall = exp(-dot(dm, dm) / (radius * radius)) * uMouse.z;
  p -= dm * fall * 0.28;
  p -= uMouseVel * fall * 0.05;

  // The field scrolls with the page, slower than the content.
  vec2 q = (p + vec2(0.0, uScroll)) / uCell;
  float t = uTime;

  // Domain warp gives the organic, river-like shapes of a real survey map.
  vec2 w = vec2(snoise(vec3(q * 0.45, t * 0.7)), snoise(vec3(q * 0.45 + 31.7, t * 0.7)));
  q += w * 0.5;
  float h = snoise(vec3(q, t)) + 0.24 * snoise(vec3(q * 2.07 + 5.1, t * 1.35));
  h += fall * 0.14; // a small hill under the pointer

  float v = h * uDensity;
  float fw = max(fwidth(v), 1e-4);
  float d = abs(fract(v - 0.5) - 0.5) / fw; // distance to the nearest contour, in buffer px

  // Every fifth contour is an "index contour", a touch heavier, as on printed survey maps.
  float idx = floor(v + 0.5);
  float isIndex = 1.0 - step(0.5, mod(idx, 5.0));
  float lw = uLineW * mix(1.0, 1.45, isIndex);
  float line = 1.0 - smoothstep(lw * 0.5 - 0.5, lw * 0.5 + 0.6, d);

  // Fade lines where they bunch up (steep slopes would turn into moire at this resolution).
  line *= 1.0 - smoothstep(0.22, 0.55, fw);

  // Slow patches of light and shade so the map has depth instead of an even wallpaper.
  float patchN = snoise(vec3(q * 0.23 + 11.0, t * 0.35));
  float patchMask = mix(0.45, 1.0, smoothstep(-0.55, 0.65, patchN));

  // Quieter in the middle where the copy sits, fuller towards the edges.
  vec2 uv = p / uView - 0.5;
  float edge = smoothstep(0.12, 0.62, length(uv * vec2(1.15, 1.0)));
  float centre = mix(0.7, 1.0, edge);

  float a = line * uAlpha * mix(1.0, 1.85, isIndex) * patchMask * centre;
  a *= 1.0 + fall * 0.85; // the lines near the pointer catch a little more light

  vec3 col = vec3(0.945, 0.937, 0.914);
  FRAG_COLOR = vec4(col * a, a);
}
`;

export const CONTOUR_FRAG_300 = HEADER_300 + BODY;
export const CONTOUR_FRAG_100 = HEADER_100 + BODY;
