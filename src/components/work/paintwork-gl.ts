import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  VideoTexture,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import type { TextMask } from "./text-mask";

// PAINTWORK: one fixed WebGL canvas behind the roster's (transparent) DOM text.
//  1. Ambient light: the focused film, cover-fitted, blurred in two small passes, darkened and tinted.
//  2. Every roster name as a textured quad over its DOM box. The letters are windows: the film is sampled
//     in screen space. Unpainted letters are matte primer; a soft studio light band sweeps across as a
//     row reaches the focus line and leaves the film under a clear coat. Lean, slide and zoom are done
//     in the vertex shader, in CSS pixels, so at rest each quad sits exactly on its DOM text.

const fullscreenVert = /* glsl */ `
void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;

const common = /* glsl */ `
vec2 cover(vec2 uv, vec2 box, vec2 tex) {
  float rb = box.x / box.y;
  float rt = tex.x / max(tex.y, 1.0);
  vec2 s = rb > rt ? vec2(1.0, rt / rb) : vec2(rb / rt, 1.0);
  return (uv - 0.5) * s + 0.5;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

// Film(s) to a small target, 16 taps per pixel, cross-faded between the old and the new light.
const downFrag = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uSizeA;
uniform vec2 uSizeB;
uniform float uMix;
uniform vec2 uDst;
uniform vec2 uView;
${common}
void main() {
  vec2 uv = gl_FragCoord.xy / uDst;
  vec2 t = 1.0 / uDst;
  vec3 a = vec3(0.0);
  vec3 b = vec3(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) - 1.5) * 0.25 * t;
      a += texture(uA, cover(uv + o, uView, uSizeA)).rgb;
      b += texture(uB, cover(uv + o, uView, uSizeB)).rgb;
    }
  }
  gl_FragColor = vec4(mix(a, b, uMix) / 16.0, 1.0);
}
`;

const blurFrag = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDst;
uniform vec2 uDir;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst;
  vec2 d = uDir / uDst * 1.6;
  vec3 c = texture(uSrc, uv).rgb * 0.2270;
  c += (texture(uSrc, uv + d).rgb + texture(uSrc, uv - d).rgb) * 0.1945;
  c += (texture(uSrc, uv + d * 2.0).rgb + texture(uSrc, uv - d * 2.0).rgb) * 0.1216;
  c += (texture(uSrc, uv + d * 3.0).rgb + texture(uSrc, uv - d * 3.0).rgb) * 0.0540;
  c += (texture(uSrc, uv + d * 4.0).rgb + texture(uSrc, uv - d * 4.0).rgb) * 0.0162;
  gl_FragColor = vec4(c, 1.0);
}
`;

const compositeFrag = /* glsl */ `
uniform sampler2D uBlur;
uniform vec2 uRes;
uniform float uLevel;
uniform float uTint;
uniform vec3 uKey;
uniform float uSmear;
uniform float uTime;
uniform float uFocusY;
uniform sampler2D uFilm;
uniform vec2 uFilmSize;
uniform float uSharp;
${common}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = vec3(0.0);
  for (int i = -3; i <= 3; i++) c += texture(uBlur, uv + vec2(0.0, float(i) * uSmear / 6.0)).rgb;
  c /= 7.0;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // Tinted to the project's key colour (brought to one brightness, so a yellow key does not turn the room
  // olive while a red one stays deep), keeping a fifth of the film's own colour.
  vec3 key = uKey * (0.42 / max(dot(uKey, vec3(0.299, 0.587, 0.114)), 0.2));
  vec3 col = mix(c, key * (l * 1.4 + 0.05), uTint * 0.8) * uLevel;
  // The studio light hangs over the focus line: the room is brightest there and falls off above and below,
  // so the film reads as light, not as a muddy picture.
  float g = exp(-pow((uv.y - uFocusY) * 2.4, 2.0));
  col *= mix(1.0, 0.42 + 0.9 * g, uTint);
  col += key * g * 0.03 * uTint;
  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q * vec2(0.9, 1.2), q * vec2(0.9, 1.2)) * 1.1 * uTint;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.016 * (1.0 - uSharp);
  // End of the fly-through: the light behind the letters becomes the film itself.
  col = mix(col, texture(uFilm, cover(uv, uRes, uFilmSize)).rgb, uSharp);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const rowVert = /* glsl */ `
uniform vec4 uRect;   // x, y, width, height of the mask box (css px, viewport, y down)
uniform vec2 uView;   // viewport, css px
uniform vec2 uPivot;  // zoom centre, css px
uniform float uScale;
uniform float uOffsetX;
uniform float uTilt;  // radians, about the row's left middle
uniform float uSkew;  // italic shear
varying vec2 vUv;
varying vec2 vPx;
void main() {
  vec2 q = position.xy + 0.5;
  vec2 local = vec2(q.x, 1.0 - q.y) * uRect.zw;
  vPx = local;
  vUv = q;
  local.x += (uRect.w * 0.5 - local.y) * uSkew;
  vec2 p = uRect.xy + local;
  vec2 o = uRect.xy + vec2(0.0, uRect.w * 0.5);
  vec2 d = p - o;
  float c = cos(uTilt);
  float s = sin(uTilt);
  p = o + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  p.x += uOffsetX;
  p = uPivot + (p - uPivot) * uScale;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}
`;

const rowFrag = /* glsl */ `
uniform sampler2D uMask;
uniform vec2 uMaskTexel;
uniform float uBevel;
uniform sampler2D uFilm;
uniform vec2 uFilmSize;
uniform sampler2D uAmb;
uniform vec2 uRes;
uniform vec4 uRect;
uniform float uPad;
uniform float uLineH;
uniform float uPaint;
uniform float uSide;
uniform float uGlint;
uniform float uAlpha;
uniform float uFx;
uniform float uTime;
uniform float uStretch;
uniform vec3 uPrimer;
uniform vec3 uKey;
varying vec2 vUv;
varying vec2 vPx;
${common}
const vec3 W = vec3(0.299, 0.587, 0.114);
void main() {
  float a = texture(uMask, vUv).r;
  if (a < 0.004) discard;

  // Bevel: the gradient of a blurred copy of the letters (a lower mip) gives a soft edge normal.
  vec2 e = uMaskTexel * uBevel;
  float hx = texture(uMask, vUv + vec2(e.x, 0.0), 2.2).r - texture(uMask, vUv - vec2(e.x, 0.0), 2.2).r;
  float hy = texture(uMask, vUv + vec2(0.0, e.y), 2.2).r - texture(uMask, vUv - vec2(0.0, e.y), 2.2).r;
  vec3 n = normalize(vec3(-hx, -hy, 0.6));
  float lacq = 1.0 - uFx;
  n = normalize(mix(vec3(0.0, 0.0, 1.0), n, lacq));
  vec3 L = normalize(vec3(-0.45, 0.7, 0.55));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float edge = 1.0 - n.z;

  // The gantry light: a slanted softbox reflection travelling left to right. Arriving rows (uSide > 0)
  // are painted behind it; leaving rows (uSide < 0) go back to primer behind it, so the light always
  // travels the same way. The reflection bends a little on the bevels.
  float slant = 0.36;
  float xs = vPx.x + (uRect.w - vPx.y) * slant;
  float span = uRect.z + uRect.w * slant;
  float bw = max(uLineH * 0.42, 26.0) * uStretch;
  float t = uSide > 0.0 ? uPaint : 1.0 - uPaint;
  float front = mix(-bw * 2.6, span + bw * 2.6, t);
  float behind = smoothstep(front + bw * 0.22, front - bw * 0.22, xs);
  float painted = uSide > 0.0 ? behind : 1.0 - behind;
  float xb = xs + n.x * uLineH * 0.22 * edge;
  float dx = (xb - front) / bw;
  float bar = smoothstep(0.42, 0.16, abs(dx));
  float core = exp(-dx * dx * 26.0);
  float halo = exp(-dx * dx * 0.8);

  // Paint: the film behind the page, seen through the letters (screen space), refracted a little at the
  // bevel and exposed for the dark page: the blurred ambient gives the local brightness of the film, so
  // dark shots open up and bright ones keep their highlights. The grade fades out for the fly-through so
  // the last frame matches the plain video exactly.
  vec2 suv = gl_FragCoord.xy / uRes;
  vec2 fuv = cover(suv, uRes, uFilmSize) + n.xy * 0.008 * edge * lacq;
  vec3 raw = texture(uFilm, fuv).rgb;
  float loc = dot(texture(uAmb, suv).rgb, W);
  vec3 g = raw * clamp(0.3 / (loc + 0.03), 1.0, 2.6);
  g = (1.0 - exp(-g * 1.6)) / (1.0 - exp(-1.6));
  g = clamp(mix(vec3(dot(g, W)), g, 1.2), 0.0, 1.0);
  vec3 film = mix(raw, g, lacq);

  // Clear coat: a thin softbox strip across the shoulder of each line, bent by the bevel, plus a rim.
  float ly = mod(vPx.y - uPad, uLineH) / uLineH + n.y * 0.18;
  float strip = exp(-pow((ly - 0.24) / 0.05, 2.0)) * 0.09 + exp(-pow((ly - 0.24) / 0.012, 2.0)) * 0.12;
  float rim = pow(edge, 1.4) * (0.25 + 0.75 * diff);
  vec3 paint = film * (0.9 + 0.16 * diff * lacq) + (strip * (0.6 + 0.4 * diff) + rim * 0.32) * lacq;

  // Primer: matte grey, lit softly from the upper left, with a breath of the ambient key light.
  // (top of each line a touch lighter, like a matte panel under a top light)
  float lyf = clamp(mod(vPx.y - uPad, uLineH) / uLineH, 0.0, 1.0);
  // Primer is matte: only a hint of the bevel shows.
  float pdiff = mix(0.55, diff, 0.4);
  vec3 primer = uPrimer * (0.8 + 0.36 * pdiff) * (1.1 - 0.2 * lyf) + uKey * 0.02;

  vec3 col = mix(primer, paint, painted);
  vec3 lightCol = vec3(1.0, 0.97, 0.93);
  // On matte primer the light is a broad sheen; on the clear coat it is a crisp reflection.
  float spec = mix(bar * 0.2 + halo * 0.07, bar * 0.42 + core * 0.55 + halo * 0.05, painted);
  col += lightCol * spec * (0.7 + 0.5 * diff) * lacq;
  // Idle glint: the same light passing over the finished paint now and then.
  float gd = (xb - mix(-bw * 2.6, span + bw * 2.6, uGlint)) / bw;
  col += lightCol * (exp(-gd * gd * 7.0) * 0.32 + exp(-gd * gd * 40.0) * 0.3) * painted * lacq * step(0.0, uGlint);
  float flake = step(0.993, hash(floor(gl_FragCoord.xy / 1.5) + floor(uTime * 14.0)));
  col += flake * (bar + core) * painted * 0.5 * lacq;
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

export type RowFrame = {
  x: number; // mask box, css px (viewport)
  y: number;
  paint: number;
  side: number; // 1: painted behind the light (arriving), -1: primer behind it (leaving)
  glint: number; // 0..1 position of a passing glint, -1 for none
  alpha: number;
  offsetX: number;
  scale: number;
  pivotX: number;
  pivotY: number;
  fx: number;
  film: string;
};

export type Frame = {
  rows: RowFrame[];
  bgFrom: string;
  bgTo: string;
  bgMix: number;
  level: number; // ambient brightness
  tint: number; // 1 = tinted, darkened ambient; 0 = the plain film
  sharp: number; // 0 = blurred ambient, 1 = the crisp film (end of the fly-through)
  smear: number; // uv units, vertical
  tilt: number;
  skew: number;
  stretch: number;
  focusY: number; // css px
  time: number;
};

type FilmEntry = { poster: Texture | null; media: Texture | null; el: HTMLVideoElement | HTMLImageElement | null; uploaded: boolean };

// The shaders write sRGB straight to the screen (no output conversion in a ShaderMaterial), so colours
// keep their hex values as written: no sRGB-to-linear conversion on the way in.
const srgb = (hex: string) => new Color().setStyle(hex, LinearSRGBColorSpace);
const PRIMER = srgb("#2c2c31");

export class PaintworkGL {
  private renderer: WebGLRenderer;
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh<PlaneGeometry, ShaderMaterial>;
  private quadScene = new Scene();
  private rowScene = new Scene();
  private geometry = new PlaneGeometry(1, 1);
  private rtA: WebGLRenderTarget;
  private rtB: WebGLRenderTarget;
  private down: ShaderMaterial;
  private blur: ShaderMaterial;
  private composite: ShaderMaterial;
  private rows: { mesh: Mesh<PlaneGeometry, ShaderMaterial>; mask: TextMask | null; tex: CanvasTexture | null }[] = [];
  private films = new Map<string, FilmEntry>();
  private black: Texture;
  private keys: Map<string, Color>;
  private view = new Vector2(1, 1);
  private res = new Vector2(1, 1);
  private dpr = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    slugs: string[],
    keys: Record<string, string>,
    private getMedia: (slug: string) => HTMLVideoElement | HTMLImageElement | null,
    private posterUrl: (slug: string) => string,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x050506, 1);
    this.keys = new Map(slugs.map((s) => [s, srgb(keys[s] ?? "#ffffff")]));

    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const cx = c.getContext("2d")!;
    cx.fillStyle = "#050506";
    cx.fillRect(0, 0, 2, 2);
    this.black = new CanvasTexture(c);

    const rt = () => new WebGLRenderTarget(4, 4, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    this.rtA = rt();
    this.rtB = rt();
    this.down = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: downFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uA: { value: this.black },
        uB: { value: this.black },
        uSizeA: { value: new Vector2(16, 9) },
        uSizeB: { value: new Vector2(16, 9) },
        uMix: { value: 0 },
        uDst: { value: new Vector2(4, 4) },
        uView: { value: this.view },
      },
    });
    this.blur = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: blurFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: { uSrc: { value: null }, uDst: { value: new Vector2(4, 4) }, uDir: { value: new Vector2(1, 0) } },
    });
    this.composite = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: compositeFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uBlur: { value: this.rtA.texture },
        uRes: { value: this.res },
        uLevel: { value: 0.18 },
        uTint: { value: 1 },
        uKey: { value: new Vector3(1, 1, 1) },
        uSmear: { value: 0 },
        uTime: { value: 0 },
        uFocusY: { value: 0.5 },
        uFilm: { value: this.black },
        uFilmSize: { value: new Vector2(16, 9) },
        uSharp: { value: 0 },
      },
    });
    this.quad = new Mesh(this.geometry, this.down);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    for (const slug of slugs) {
      const entry: FilmEntry = { poster: null, media: null, el: null, uploaded: false };
      this.films.set(slug, entry);
      const img = new Image();
      img.decoding = "async";
      img.src = posterUrl(slug);
      img
        .decode()
        .then(() => {
          const t = new Texture(img);
          t.minFilter = LinearFilter;
          t.generateMipmaps = false;
          t.needsUpdate = true;
          entry.poster = t;
        })
        .catch(() => undefined);
    }
    this.resize();
  }

  /** Call with one mask per roster row (null for a row that is not drawn). */
  setMasks(masks: (TextMask | null)[]) {
    for (const r of this.rows) {
      r.tex?.dispose();
      r.mesh.material.dispose();
      this.rowScene.remove(r.mesh);
    }
    this.rows = masks.map((mask) => {
      let tex: CanvasTexture | null = null;
      if (mask) {
        tex = new CanvasTexture(mask.canvas);
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
      }
      const material = new ShaderMaterial({
        vertexShader: rowVert,
        fragmentShader: rowFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRect: { value: new Vector4(0, 0, mask?.w ?? 1, mask?.h ?? 1) },
          uView: { value: this.view },
          uRes: { value: this.res },
          uPivot: { value: new Vector2() },
          uScale: { value: 1 },
          uOffsetX: { value: 0 },
          uTilt: { value: 0 },
          uSkew: { value: 0 },
          uMask: { value: tex },
          uMaskTexel: { value: new Vector2(mask ? 1 / mask.canvas.width : 1, mask ? 1 / mask.canvas.height : 1) },
          uBevel: { value: mask ? Math.max(2, (mask.fontSize * this.dpr) / 60) : 3 },
          uFilm: { value: this.black },
          uFilmSize: { value: new Vector2(16, 9) },
          uAmb: { value: this.rtA.texture },
          uPad: { value: mask?.pad ?? 0 },
          uLineH: { value: mask?.lineH ?? 100 },
          uPaint: { value: 0 },
          uSide: { value: 1 },
          uGlint: { value: -1 },
          uAlpha: { value: 1 },
          uFx: { value: 0 },
          uTime: { value: 0 },
          uStretch: { value: 1 },
          uPrimer: { value: new Vector3(PRIMER.r, PRIMER.g, PRIMER.b) },
          uKey: { value: new Vector3(1, 1, 1) },
        },
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = !!mask;
      this.rowScene.add(mesh);
      return { mesh, mask, tex };
    });
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.view.set(w, h);
    this.res.set(Math.round(w * this.dpr), Math.round(h * this.dpr));
    const bw = Math.max(32, Math.round(w / 8));
    const bh = Math.max(20, Math.round(h / 8));
    this.rtA.setSize(bw, bh);
    this.rtB.setSize(bw, bh);
  }

  get pixelRatio() {
    return this.dpr;
  }

  /** The film texture for a project: its live media once it has a frame, else its poster. */
  private film(slug: string): { tex: Texture; w: number; h: number } {
    const f = this.films.get(slug);
    if (!f) return { tex: this.black, w: 16, h: 9 };
    const el = this.getMedia(slug);
    if (el !== f.el) {
      f.media?.dispose();
      f.media = null;
      f.el = el;
      f.uploaded = false;
    }
    if (el instanceof HTMLVideoElement) {
      if (el.readyState >= 2 && el.videoWidth > 0) {
        if (!f.media) {
          // VideoTexture: three uploads it with texImage2D (a plain Texture would size it from the
          // element's width/height attributes, which are 0).
          f.media = new VideoTexture(el);
          f.media.minFilter = LinearFilter;
          f.media.generateMipmaps = false;
        }
        if (!el.paused || !f.uploaded) {
          f.media.needsUpdate = true;
          f.uploaded = true;
        }
        return { tex: f.media, w: el.videoWidth, h: el.videoHeight };
      }
    } else if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
      if (!f.media) {
        f.media = new Texture(el);
        f.media.minFilter = LinearFilter;
        f.media.generateMipmaps = false;
        f.media.needsUpdate = true;
      }
      return { tex: f.media, w: el.naturalWidth, h: el.naturalHeight };
    }
    if (f.poster) {
      const img = f.poster.image as HTMLImageElement;
      return { tex: f.poster, w: img.naturalWidth, h: img.naturalHeight };
    }
    return { tex: this.black, w: 16, h: 9 };
  }

  render(frame: Frame) {
    const r = this.renderer;
    const used = new Map<string, { tex: Texture; w: number; h: number }>();
    const get = (slug: string) => {
      let v = used.get(slug);
      if (!v) {
        v = this.film(slug);
        used.set(slug, v);
      }
      return v;
    };

    // 1. Ambient light.
    const a = get(frame.bgFrom);
    const b = get(frame.bgTo);
    const du = this.down.uniforms;
    du.uA.value = a.tex;
    du.uB.value = b.tex;
    (du.uSizeA.value as Vector2).set(a.w, a.h);
    (du.uSizeB.value as Vector2).set(b.w, b.h);
    du.uMix.value = frame.bgMix;
    (du.uDst.value as Vector2).set(this.rtA.width, this.rtA.height);
    this.quad.material = this.down;
    r.setRenderTarget(this.rtA);
    r.render(this.quadScene, this.camera);

    const bu = this.blur.uniforms;
    (bu.uDst.value as Vector2).set(this.rtA.width, this.rtA.height);
    this.quad.material = this.blur;
    for (let i = 0; i < 2; i++) {
      bu.uSrc.value = this.rtA.texture;
      (bu.uDir.value as Vector2).set(1, 0);
      r.setRenderTarget(this.rtB);
      r.render(this.quadScene, this.camera);
      bu.uSrc.value = this.rtB.texture;
      (bu.uDir.value as Vector2).set(0, 1);
      r.setRenderTarget(this.rtA);
      r.render(this.quadScene, this.camera);
    }

    const ka = this.keys.get(frame.bgFrom) ?? PRIMER;
    const kb = this.keys.get(frame.bgTo) ?? PRIMER;
    const key = new Color().copy(ka).lerp(kb, frame.bgMix);
    const cu = this.composite.uniforms;
    cu.uLevel.value = frame.level;
    cu.uTint.value = frame.tint;
    (cu.uKey.value as Vector3).set(key.r, key.g, key.b);
    cu.uSmear.value = frame.smear;
    cu.uTime.value = frame.time;
    cu.uFocusY.value = 1 - frame.focusY / this.view.y;
    cu.uSharp.value = frame.sharp;
    cu.uFilm.value = b.tex;
    (cu.uFilmSize.value as Vector2).set(b.w, b.h);
    this.quad.material = this.composite;
    r.setRenderTarget(null);
    r.autoClear = true;
    r.render(this.quadScene, this.camera);

    // 2. The roster.
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const f = frame.rows[i];
      if (!row.mask || !f) {
        row.mesh.visible = false;
        continue;
      }
      const offscreen = f.scale <= 1.001 && (f.y > this.view.y + 40 || f.y + row.mask.h < -40);
      row.mesh.visible = f.alpha > 0.002 && !offscreen;
      if (!row.mesh.visible) continue;
      const u = row.mesh.material.uniforms;
      (u.uRect.value as Vector4).set(f.x, f.y, row.mask.w, row.mask.h);
      (u.uPivot.value as Vector2).set(f.pivotX, f.pivotY);
      u.uScale.value = f.scale;
      u.uOffsetX.value = f.offsetX;
      u.uTilt.value = frame.tilt;
      u.uSkew.value = frame.skew;
      u.uPaint.value = f.paint;
      u.uSide.value = f.side;
      u.uGlint.value = f.glint;
      u.uAlpha.value = f.alpha;
      u.uFx.value = f.fx;
      u.uTime.value = frame.time;
      u.uStretch.value = frame.stretch;
      const k = this.keys.get(f.film) ?? PRIMER;
      (u.uKey.value as Vector3).set(k.r, k.g, k.b);
      if (f.paint > 0.001 || f.scale > 1.001) {
        const film = get(f.film);
        u.uFilm.value = film.tex;
        (u.uFilmSize.value as Vector2).set(film.w, film.h);
      } else {
        u.uFilm.value = this.black;
      }
    }
    r.autoClear = false;
    r.render(this.rowScene, this.camera);
    r.autoClear = true;
  }

  dispose() {
    for (const row of this.rows) {
      row.tex?.dispose();
      row.mesh.material.dispose();
    }
    for (const f of this.films.values()) {
      f.poster?.dispose();
      f.media?.dispose();
    }
    this.black.dispose();
    this.geometry.dispose();
    this.down.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.renderer.dispose();
  }
}
