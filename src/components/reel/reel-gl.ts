import {
  Camera,
  DoubleSide,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from "three";

// The showreel "screen" drawn in WebGL: one finely divided plane carrying the muted reel. The vertex
// shader curves it like a cinema screen, twists it like a sheet and tilts it in perspective; the
// fragment shader gives it rounded corners, a thick-glass edge (refraction + colour fringe), a rim
// light, a scroll-driven reflection sweep and a "projector warm-up" from grey to full colour.
// Everything is in CSS pixels, so at rest the plane lands exactly on the DOM frame box.

const vertexShader = /* glsl */ `
uniform vec2 uRes;      // stage size, css px
uniform vec2 uSize;     // frame size, css px
uniform vec2 uOffset;   // frame centre from stage centre, css px, y up
uniform float uBend;    // edges pushed toward the viewer, css px (curved cinema screen)
uniform float uBow;    // top and bottom edges pushed toward the viewer, css px (flex with scroll speed)
uniform float uTwist;   // rotation about x that grows along x, radians (sheet twist)
uniform vec3 uRot;      // x, y, z rotation, radians
uniform float uPersp;   // camera distance, css px

varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vNormal;

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

vec3 shape(vec2 p) {
  float nx = p.x / (uSize.x * 0.5);
  float ny = p.y / (uSize.y * 0.5);
  vec3 q = vec3(p, uBend * nx * nx + uBow * ny * ny);
  q = rotX(uTwist * nx) * q;
  return rotZ(uRot.z) * rotY(uRot.y) * rotX(uRot.x) * q;
}

void main() {
  // The mesh is 6 px larger than the frame so the anti-aliased edge has room to fade.
  vec2 p = position.xy * (uSize + 6.0);
  vLocal = p;
  vUv = p / uSize + 0.5;
  vec3 pos = shape(p);
  vec3 px = shape(p + vec2(1.0, 0.0));
  vec3 py = shape(p + vec2(0.0, 1.0));
  vNormal = normalize(cross(px - pos, py - pos));
  pos.xy += uOffset;
  float w = max((uPersp - pos.z) / uPersp, 0.05);
  gl_Position = vec4(pos.x * 2.0 / uRes.x, pos.y * 2.0 / uRes.y, 0.0, w);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uSize;
uniform float uRadius;
uniform float uLife;    // 0 = grey and dim, 1 = full colour
uniform float uSweep;   // reflection band position along the diagonal
uniform float uDim;     // legibility pool behind the words
uniform float uAlpha;

varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vNormal;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 cover(vec2 uv) {
  float fa = uSize.x / uSize.y;
  float ta = uTexSize.x / uTexSize.y;
  vec2 s = fa > ta ? vec2(1.0, ta / fa) : vec2(fa / ta, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 halfSize = uSize * 0.5;
  float d = sdRound(vLocal, halfSize, uRadius);
  float aa = max(fwidth(d), 0.001);
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  if (alpha <= 0.0) discard;

  // Thick-glass edge: the picture is pulled inward and splits into colour near the rim.
  float inside = -d;
  float edge = 1.0 - smoothstep(0.0, 34.0, inside);
  vec2 dir = vLocal / halfSize;
  vec2 uv = cover(clamp(vUv, 0.0, 1.0));
  vec2 pull = -dir * edge * edge * 0.010;
  vec2 fringe = dir * edge * 0.0035;
  vec3 col;
  col.r = texture2D(uTex, uv + pull + fringe).r;
  col.g = texture2D(uTex, uv + pull).g;
  col.b = texture2D(uTex, uv + pull - fringe).b;

  // Projector warm-up.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma) * 0.42 + 0.02, col, uLife);

  // Light the curved surface: it darkens as it turns away and catches a soft sheen.
  vec3 n = normalize(vNormal);
  if (n.z < 0.0) n = -n;
  float facing = clamp(n.z, 0.0, 1.0);
  col *= mix(0.58, 1.0, pow(facing, 1.6));
  vec3 h = normalize(normalize(vec3(-0.45, 0.6, 0.9)) + vec3(0.0, 0.0, 1.0));
  float sheen = pow(max(dot(n, h), 0.0), 90.0);
  col += sheen * 0.16 * (1.0 - uLife * 0.6);

  // Soft pool behind the words so the type stays readable on bright shots.
  vec2 q = vLocal / halfSize;
  float pool = 1.0 - smoothstep(0.0, 1.05, length(q * vec2(0.78, 1.25)));
  col *= 1.0 - uDim * pool;

  // Reflection sweep: a wide soft band and a thin bright line crossing the glass on a diagonal.
  float s = (vUv.x + (1.0 - vUv.y) * 0.42) / 1.42;
  float wide = exp(-pow((s - uSweep) / 0.085, 2.0));
  float thin = exp(-pow((s - uSweep - 0.07) / 0.010, 2.0));
  col += (wide * 0.075 + thin * 0.05) * (0.6 + 0.4 * facing);

  // Rim light: a hairline just inside the edge, brightest at the top left, plus a faint inner glow.
  float rim = 1.0 - smoothstep(0.4, 1.6, inside);
  float lit = 0.35 + 0.65 * clamp(dot(normalize(dir + 0.0001), normalize(vec2(-0.75, 0.66))) * 0.5 + 0.5, 0.0, 1.0);
  col = mix(col, vec3(1.0), rim * 0.42 * lit);
  col += edge * edge * 0.045;

  float a = alpha * uAlpha;
  gl_FragColor = vec4(col * a, a);
}
`;

export type ReelUniforms = {
  resW: number;
  resH: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  bend: number;
  bow: number;
  twist: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  sweep: number;
  dim: number;
  alpha: number;
};

export class ReelGL {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new Camera();
  private material: ShaderMaterial;
  private geometry: PlaneGeometry;
  private poster: Texture;
  private videoTex: VideoTexture | null = null;
  private radius: number;

  constructor(
    canvas: HTMLCanvasElement,
    private video: HTMLVideoElement,
    posterUrl: string,
    radius: number,
  ) {
    this.radius = radius;
    // Ask for the context ourselves so a device without WebGL2 fails quietly (the caller keeps the
    // CSS fallback) instead of three logging errors.
    const attrs: WebGLContextAttributes = { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" };
    const context = canvas.getContext("webgl2", attrs);
    if (!context) throw new Error("WebGL2 unavailable");
    this.renderer = new WebGLRenderer({ canvas, context, ...attrs });
    this.renderer.setClearColor(0x000000, 0);

    this.poster = new TextureLoader().load(posterUrl);
    this.prep(this.poster);

    this.geometry = new PlaneGeometry(1, 1, 120, 60);
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTex: { value: this.poster },
        uTexSize: { value: new Vector2(1920, 1080) },
        uRes: { value: new Vector2(1, 1) },
        uSize: { value: new Vector2(1, 1) },
        uOffset: { value: new Vector2(0, 0) },
        uBend: { value: 0 },
        uBow: { value: 0 },
        uTwist: { value: 0 },
        uRot: { value: new Vector3() },
        uPersp: { value: 1400 },
        uRadius: { value: radius },
        uLife: { value: 1 },
        uSweep: { value: -1 },
        uDim: { value: 0 },
        uAlpha: { value: 1 },
      },
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private prep(t: Texture) {
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = false;
  }

  /** Switch from the poster to the live video once it has real frames. */
  useVideo() {
    if (this.videoTex) return;
    this.videoTex = new VideoTexture(this.video);
    this.prep(this.videoTex);
    this.material.uniforms.uTex.value = this.videoTex;
    if (this.video.videoWidth) this.material.uniforms.uTexSize.value.set(this.video.videoWidth, this.video.videoHeight);
  }

  resize(w: number, h: number) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
  }

  render(u: ReelUniforms) {
    const m = this.material.uniforms;
    m.uRes.value.set(u.resW, u.resH);
    m.uSize.value.set(u.w, u.h);
    m.uOffset.value.set(u.ox, u.oy);
    m.uBend.value = u.bend;
    m.uBow.value = u.bow;
    m.uTwist.value = u.twist;
    m.uRot.value.set(u.rx, u.ry, u.rz);
    m.uPersp.value = Math.max(u.resH, 600) * 1.7;
    m.uRadius.value = this.radius;
    m.uLife.value = u.life;
    m.uSweep.value = u.sweep;
    m.uDim.value = u.dim;
    m.uAlpha.value = u.alpha;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.poster.dispose();
    this.videoTex?.dispose();
    this.renderer.dispose();
  }
}
