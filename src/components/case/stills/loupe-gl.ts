// A glass loupe drawn with WebGL: the render tile under the pointer, flat in the middle (1:1 at the centre),
// bending and splitting colour slightly towards the rim like a real lens, with a soft rim shade and a
// reflection on the glass. One small canvas, drawn only when something changes. Falls back to a CSS
// background loupe in HoldToInspect when WebGL is missing or the image cannot be uploaded.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexSize;  // texture pixels
uniform vec2 uCenter;   // texture pixel under the loupe centre
uniform float uRadius;  // loupe radius in CSS px
uniform float uScale;   // texture pixels per CSS px
varying vec2 vUv;

vec3 tap(vec2 px) {
  vec2 uv = px / uTexSize;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return mix(vec3(0.02, 0.02, 0.024), texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb, inside);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) { gl_FragColor = vec4(0.0); return; }
  float bend = 1.0 + 0.24 * pow(r, 4.0);
  vec2 base = uCenter + p * uRadius * uScale * bend;
  vec2 dir = r > 0.0001 ? p / r : vec2(0.0);
  float ca = 0.016 * pow(r, 3.0) * uRadius * uScale;
  vec3 col = vec3(tap(base + dir * ca).r, tap(base).g, tap(base - dir * ca).b);
  float rim = smoothstep(0.78, 1.0, r);
  col *= 1.0 - 0.38 * rim;
  float a = atan(p.y, p.x);
  float arc = smoothstep(0.84, 0.92, r) * (1.0 - smoothstep(0.92, 0.985, r));
  col += arc * pow(max(0.0, cos(a + 2.35)), 8.0) * 0.32;
  float edge = 1.0 - smoothstep(0.988, 1.0, r);
  gl_FragColor = vec4(col * edge, edge);
}`;

export type LoupeView = {
  /** Texture pixel under the loupe centre. */
  cx: number;
  cy: number;
  /** Loupe radius in CSS px. */
  radius: number;
  /** Texture pixels per CSS px. */
  scale: number;
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

export class LoupeGL {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null>;
  texW = 0;
  texH = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    this.prog = prog;
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.useProgram(prog);
    this.u = Object.fromEntries(["uTex", "uTexSize", "uCenter", "uRadius", "uScale"].map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1i(this.u.uTex, 0);
  }

  /** Upload a decoded image (throws on a tainted, cross-origin image). */
  setImage(img: HTMLImageElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) throw new Error(`texImage2D ${err}`);
    this.texW = img.naturalWidth;
    this.texH = img.naturalHeight;
  }

  get ready() {
    return this.texW > 0;
  }

  resize(cssSize: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(2, Math.round(cssSize * dpr));
    if (this.canvas.width !== px || this.canvas.height !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
  }

  render(v: LoupeView) {
    if (!this.ready) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uTexSize, this.texW, this.texH);
    gl.uniform2f(this.u.uCenter, v.cx, v.cy);
    gl.uniform1f(this.u.uRadius, v.radius);
    gl.uniform1f(this.u.uScale, v.scale);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.tex);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
