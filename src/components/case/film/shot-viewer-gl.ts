// "In this shot" viewer: one full-screen triangle that shows a shot frame (or the live shot loop) and
// swaps shots behind the studio light, the same slanted softbox band the Work roster paints its names
// with (components/work/paintwork-gl.ts): the band travels left to right, the new shot is left behind
// it, the picture bends a little under it like a reflection on clear coat, and highlights catch more
// light than shadows. Before the first shot arrives the frame is matte primer.
// Plain WebGL 1 (no three.js): two texture slots (A = what was on screen, B = what is coming) and
// a handful of uniforms. Textures are keyed by name ("s3" = shot 3 frame, "v0"/"v1" = live video).

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uPrimerA;
uniform float uPrimerB;
uniform vec3 uPrimer;
uniform vec3 uKey;
uniform vec2 uRes;
uniform float uP;
uniform float uD;
uniform float uGlint;
uniform float uStretch;
uniform float uTime;
uniform float uDrift;
uniform float uZoom;
uniform vec2 uFit;

const vec3 W = vec3(0.299, 0.587, 0.114);
const vec3 LIGHT = vec3(1.0, 0.97, 0.93);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

// Matte primer panel under a soft top light, with a breath of the project's key colour.
vec3 primer(vec2 uv) {
  return uPrimer * (0.78 + 0.34 * uv.y) + uKey * 0.018;
}

void main() {
  // Slanted band coordinate in canvas pixels (origin top-left), as on the roster.
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float slant = 0.36;
  float xs = px.x + (uRes.y - px.y) * slant;
  float span = uRes.x + uRes.y * slant;
  float bw = max(uRes.y * 0.2, 36.0) * uStretch;
  float front = mix(-bw * 2.6, span + bw * 2.6, uP);
  float dx = (xs - front) / bw;
  float lit = step(0.0001, uP) * step(uP, 0.9999);
  float behind = smoothstep(0.22, -0.22, dx);
  float reveal = clamp(max(behind, uD), 0.0, 1.0);

  // The picture is a touch overscanned so scroll can drift it (depth); the band bends it slightly.
  // uFit crops the picture to cover a canvas of another shape (the full-screen "stage" viewer).
  vec2 uv = (vUv - 0.5) * uFit / uZoom + 0.5 + vec2(0.0, uDrift);
  float prof = exp(-dx * dx * 1.6) * lit;
  vec2 bend = vec2(-dx * prof * 0.006, 0.0);
  vec3 a = texture2D(uA, uv + bend).rgb;
  a = mix(a, primer(vUv), uPrimerA);
  float ca = exp(-dx * dx * 6.0) * lit * 0.0035;
  vec3 b = vec3(
    texture2D(uB, uv + bend + vec2(ca, 0.0)).r,
    texture2D(uB, uv + bend).g,
    texture2D(uB, uv + bend - vec2(ca, 0.0)).b
  );
  b = mix(b, primer(vUv), uPrimerB);
  vec3 col = mix(a, b, reveal);

  // The gantry light: a crisp reflection with a soft halo. Bright paint catches more of it.
  float bar = smoothstep(0.42, 0.16, abs(dx));
  float core = exp(-dx * dx * 26.0);
  float halo = exp(-dx * dx * 0.8);
  float lum = dot(col, W);
  col += LIGHT * (bar * 0.16 + core * 0.46 + halo * 0.06) * (0.35 + 0.9 * lum) * lit;
  // Fresh paint just behind the light reads a little hotter, then settles.
  col *= 1.0 + 0.12 * smoothstep(-3.0, -0.2, dx) * smoothstep(0.4, -0.2, dx) * lit;

  // Idle glint: the same light passing over a still now and then.
  if (uGlint >= 0.0) {
    float gf = mix(-bw * 2.6, span + bw * 2.6, uGlint);
    float gd = (xs - gf) / bw;
    col += LIGHT * (exp(-gd * gd * 7.0) * 0.12 + exp(-gd * gd * 40.0) * 0.14) * (0.25 + lum);
  }

  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.3;
  col += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 61.0) - 0.5) * 0.016;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export type ViewerState = {
  /** Texture shown before / under the band (A) and the one revealed behind it (B). "" = primer. */
  a: string;
  b: string;
  /** Band travel 0..1 (B is left behind it). */
  p: number;
  /** Straight dissolve A -> B, 0..1 (used for the live loop hand-offs). */
  d: number;
  /** Idle glint position 0..1, or -1 for none. */
  glint: number;
  /** Band width multiplier (scroll speed stretches it). */
  stretch: number;
  /** Vertical drift of the picture inside the frame (uv units, small). */
  drift: number;
  time: number;
};

const UNIFORMS = [
  "uA",
  "uB",
  "uPrimerA",
  "uPrimerB",
  "uPrimer",
  "uKey",
  "uRes",
  "uP",
  "uD",
  "uGlint",
  "uStretch",
  "uTime",
  "uDrift",
  "uZoom",
  "uFit",
] as const;

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export class ShotViewerGL {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private u = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private tex = new Map<string, WebGLTexture>();
  private blank: WebGLTexture;
  private primer: [number, number, number];
  private key: [number, number, number];
  private dprMax: number;
  private aspect: number;
  private w = 1;
  private h = 1;
  private onLost: (e: Event) => void;
  lost = false;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: { dprMax: number; primer: string; key: string; aspect?: number; onLost?: () => void },
  ) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    this.dprMax = opts.dprMax;
    this.aspect = opts.aspect ?? 0;
    this.primer = rgb(opts.primer);
    this.key = rgb(opts.key);

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    this.prog = prog;
    for (const k of UNIFORMS) this.u[k] = gl.getUniformLocation(prog, k);

    // One triangle that covers the canvas.
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // A 1x1 stand-in, so a slot never samples an unbound texture.
    this.blank = this.makeTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 22]));

    this.onLost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
      opts.onLost?.();
    };
    canvas.addEventListener("webglcontextlost", this.onLost);
    this.resize();
  }

  private makeTexture() {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  has(key: string) {
    return this.tex.has(key);
  }

  /** Upload an image or the current video frame under a key. False if the browser refuses it. */
  upload(key: string, src: TexImageSource) {
    if (this.lost) return false;
    const gl = this.gl;
    let t = this.tex.get(key);
    if (!t) {
      t = this.makeTexture();
      this.tex.set(key, t);
    } else gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    } catch {
      this.tex.delete(key);
      gl.deleteTexture(t);
      return false;
    }
    return true;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (w === this.w && h === this.h && this.canvas.width === w) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  draw(st: ViewerState) {
    if (this.lost) return;
    const gl = this.gl;
    const u = this.u;
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const ta = st.a ? this.tex.get(st.a) : undefined;
    const tb = st.b ? this.tex.get(st.b) : undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ta ?? this.blank);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tb ?? this.blank);
    gl.uniform1i(u.uA, 0);
    gl.uniform1i(u.uB, 1);
    gl.uniform1f(u.uPrimerA, ta ? 0 : 1);
    gl.uniform1f(u.uPrimerB, tb ? 0 : 1);
    gl.uniform3fv(u.uPrimer, this.primer);
    gl.uniform3fv(u.uKey, this.key);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1f(u.uP, st.p);
    gl.uniform1f(u.uD, st.d);
    gl.uniform1f(u.uGlint, st.glint);
    gl.uniform1f(u.uStretch, st.stretch);
    gl.uniform1f(u.uTime, st.time);
    gl.uniform1f(u.uDrift, st.drift);
    gl.uniform1f(u.uZoom, 1.05);
    // Cover fit: the picture keeps its own shape and is cropped to the canvas (no-op when they match).
    const ca = this.w / this.h;
    const pa = this.aspect || ca;
    if (Math.abs(ca - pa) < 0.02) gl.uniform2f(u.uFit, 1, 1);
    else if (ca > pa) gl.uniform2f(u.uFit, 1, pa / ca);
    else gl.uniform2f(u.uFit, ca / pa, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    for (const t of this.tex.values()) gl.deleteTexture(t);
    this.tex.clear();
    gl.deleteTexture(this.blank);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    // Free the context only once the canvas has left the page: a canvas that stays (React's dev
    // remount) hands the same context to the next viewer, and a lost one would be useless to it.
    if (!this.canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
