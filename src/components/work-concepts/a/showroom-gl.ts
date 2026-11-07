import {
  BackSide,
  CanvasTexture,
  DataTexture,
  FrontSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
  VideoTexture,
  WebGLRenderer,
  type IUniform,
} from "three";

// SHOWROOM turntable. Nine curved light boxes stand in a ring on a glossy floor. The ring turns with
// scroll or drag; the box at the front steps forward, is fully lit and gets a studio light sweep as it
// arrives, the others turn away and dim. The floor carries a turntable dial (ticks + bay numbers) that
// turns with the ring, a fixed red ">" pointer at the front and a soft reflection of every box.
// All sizes are world units: a box is 16 x 9.

export const COUNT = 9;
const THETA = (Math.PI * 2) / COUNT; // one bay
const PW = 16;
const PH = 9;
const LIFT = 0.42; // gap between box and floor

// Ring layout. Small screens close the gaps between boxes so the neighbours still peek in at the sides.
type Geo = { ARC: number; R: number; PUSH: number; RING_IN: number; RING_OUT: number; FLOOR: number };
function geometry(small: boolean): Geo {
  const fill = small ? 0.92 : 0.8; // share of a bay the box covers
  const ARC = fill * THETA;
  const R = PW / ARC; // ring radius (~29.8 on desktop)
  const PUSH = small ? 1.2 : 3.2; // how far the front box steps forward
  const RING_IN = R + PUSH + 1.1;
  const RING_OUT = R + PUSH + 4.2;
  return { ARC, R, PUSH, RING_IN, RING_OUT, FLOOR: RING_OUT + 1.5 };
}

const panelVert = ({ R, ARC }: Geo) => /* glsl */ `
uniform float uPhi;
uniform float uPush;
uniform float uMirror;
varying vec2 vUv;
void main() {
  float r = ${R.toFixed(4)} + uPush;
  float s = r / ${R.toFixed(4)};
  float a = uPhi + position.x * ${ARC.toFixed(5)};
  float y = ${LIFT.toFixed(3)} + (position.y + 0.5) * ${PH.toFixed(1)} * s;
  if (uMirror > 0.5) y = -y;
  vec3 p = vec3(sin(a) * r, y, cos(a) * r - ${R.toFixed(4)});
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

// Three layers per box: base picture, then A and B for hover media (video loop or a stills cycle).
const sampleChunk = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMixA;
uniform float uMixB;
vec3 pic(vec2 uv) {
  vec3 c = texture2D(uTex, uv).rgb;
  if (uMixA > 0.001) {
    vec3 m = texture2D(uTexA, uv).rgb;
    if (uMixB > 0.001) m = mix(m, texture2D(uTexB, uv).rgb, uMixB);
    c = mix(c, m, uMixA);
  }
  return c;
}
`;

const panelFrag = /* glsl */ `
uniform float uLit;     // 1 = at the front, 0 = a bay or more away
uniform float uReady;   // picture loaded
uniform float uSweep;   // light band position, -1.2 .. 1.2
uniform float uSweepDir;
uniform float uHover;
uniform float uVel;     // turn speed, bays per second
uniform vec2 uCorner;   // corner radius in uv
varying vec2 vUv;
${sampleChunk}
void main() {
  vec2 uv = (vUv - 0.5) * (1.0 - 0.035 * uHover) + 0.5;
  float k = clamp(uVel, -4.0, 4.0) * 0.0075;
  vec3 c = vec3(0.0);
  if (abs(k) > 0.0004) {
    for (int i = -2; i <= 2; i++) c += pic(uv + vec2(k * float(i) * 0.5, 0.0));
    c /= 5.0;
    c.r = mix(c.r, pic(uv + vec2(k, 0.0)).r, 0.6);
    c.b = mix(c.b, pic(uv - vec2(k, 0.0)).b, 0.6);
  } else {
    c = pic(uv);
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.2 + 0.8 * uLit);
  // Showroom light: the front box is lit from above, the ones turning away fall into shadow.
  float top = mix(0.82, 1.0, smoothstep(0.0, 0.9, vUv.y));
  c *= (0.07 + 0.93 * uLit) * mix(1.0, top, 0.6) * uReady;
  // Studio light sweep: a soft-box reflection travelling across the paint.
  float d = (vUv.x - 0.5) * uSweepDir - (vUv.y - 0.5) * 0.55;
  float band = exp(-pow((d - uSweep) / 0.06, 2.0));
  float halo = exp(-pow((d - uSweep) / 0.28, 2.0));
  float spec = (band * 0.7 + halo * 0.17) * (0.55 + 0.7 * l) * uLit;
  c = 1.0 - (1.0 - c) * (1.0 - vec3(1.0, 0.975, 0.94) * spec);
  // Rounded corners + a thin light-box rim.
  vec2 q = abs(vUv - 0.5) - (0.5 - uCorner);
  float e = length(max(q, 0.0) / uCorner);
  float alpha = 1.0 - smoothstep(1.0 - fwidth(e) * 1.5, 1.0, e);
  vec2 ed = min(vUv, 1.0 - vUv) / uCorner;
  float rim = 1.0 - smoothstep(0.0, 0.5, min(ed.x, ed.y));
  c += rim * (0.05 + 0.16 * uLit) * uReady;
  gl_FragColor = vec4(c, alpha * uReady);
}
`;

const mirrorFrag = /* glsl */ `
uniform float uLit;
uniform float uReady;
uniform float uVel;
varying vec2 vUv;
${sampleChunk}
void main() {
  float y = vUv.y; // 0 where the box meets the floor
  float fade = pow(1.0 - clamp(y / 0.62, 0.0, 1.0), 2.2) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  if (fade < 0.002) discard;
  float b = 0.006 + y * 0.05;
  float k = clamp(uVel, -4.0, 4.0) * 0.01;
  vec3 c = vec3(0.0);
  c += pic(vUv + vec2(-b + k, b * 0.5));
  c += pic(vUv + vec2(b + k, b * 0.5));
  c += pic(vUv + vec2(0.0, b));
  c += pic(vUv + vec2(-b * 0.5 - k, -b * 0.3));
  c += pic(vUv + vec2(b * 0.5 - k, -b * 0.3));
  c /= 5.0;
  c *= 0.08 + 0.92 * uLit;
  gl_FragColor = vec4(c, fade * (0.2 + 0.42 * uLit) * uReady);
}
`;

const floorVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const floorFrag = ({ R, PUSH }: Geo) => /* glsl */ `
uniform sampler2D uDial;
uniform float uReady;
uniform vec3 uKey;
uniform float uFlash;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float dial = texture2D(uDial, vUv).r;
  // Only the near half of the dial is lit; the back of the ring falls into the dark.
  float near = smoothstep(${(-R * 1.15).toFixed(2)}, ${(PUSH + 2.0).toFixed(2)}, vWorld.z);
  float side = 1.0 - smoothstep(10.0, 34.0, abs(vWorld.x));
  float lightOn = near * mix(0.35, 1.0, side);
  // Pool of light on the floor in front of the lit box, tinted by the car's own colour.
  vec2 p = vec2(vWorld.x / 15.0, (vWorld.z - ${PUSH.toFixed(2)}) / 6.5);
  float pool = exp(-dot(p, p) * 1.6);
  vec3 col = vec3(0.945, 0.937, 0.914) * dial * 0.62 * lightOn + uKey * pool * (0.1 + 0.08 * uFlash);
  float a = clamp(dial * 0.62 * lightOn + pool * (0.1 + 0.08 * uFlash), 0.0, 1.0);
  gl_FragColor = vec4(col / max(a, 0.001), a * uReady);
}
`;

const pointerFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uReady;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(1.0, 0.231, 0.122, t.a * uReady);
}
`;

type U = Record<string, IUniform>;

function solidTexture(r: number, g: number, b: number) {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Turntable dial: fine ticks, a long tick and a bay label per car. Canvas y down = world +z. */
function dialTexture(labels: string[], size: number, { RING_IN, RING_OUT, FLOOR }: Geo) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const px = size / 2 / FLOOR;
  const cx = size / 2;
  const at = (a: number, r: number): [number, number] => [cx + Math.sin(a) * r * px, cx + Math.cos(a) * r * px];
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  // rings
  g.globalAlpha = 0.7;
  g.lineWidth = Math.max(2, size / 1000);
  g.beginPath();
  g.arc(cx, cx, RING_IN * px, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.3;
  g.beginPath();
  g.arc(cx, cx, RING_OUT * px, 0, Math.PI * 2);
  g.stroke();
  // fine ticks every 2 degrees, longer every 10
  for (let d = 0; d < 360; d += 2) {
    const a = (d / 180) * Math.PI;
    const long = d % 10 === 0;
    g.globalAlpha = long ? 0.85 : 0.5;
    g.lineWidth = Math.max(1.5, size / (long ? 900 : 1500));
    const [x1, y1] = at(a, RING_IN + 0.12);
    const [x2, y2] = at(a, RING_IN + (long ? 0.85 : 0.45));
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  // bays: long tick + label written along the ring, letters' tops toward the centre so the label in
  // the front bay reads left to right from the camera.
  const font = Math.round(size * 0.0105);
  g.font = `500 ${font}px ui-monospace, "Geist Mono", Menlo, monospace`;
  g.textBaseline = "middle";
  labels.forEach((label, i) => {
    const a = i * THETA;
    g.globalAlpha = 0.9;
    g.lineWidth = Math.max(2, size / 1000);
    const [x1, y1] = at(a, RING_IN - 0.25);
    const [x2, y2] = at(a, RING_OUT);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    const r = RING_IN + 1.55;
    const spacing = font * 0.92;
    const chars = [...label];
    const startOff = 0.45 * px; // just right of the bay tick
    chars.forEach((ch, j) => {
      const s = startOff + j * spacing;
      const ca = a + s / (r * px);
      const [x, y] = at(ca, r);
      g.save();
      g.translate(x, y);
      g.rotate(-ca);
      g.globalAlpha = 0.95;
      g.fillText(ch, 0, 0);
      g.restore();
    });
  });
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  return t;
}

/** The fixed red pointer at the front of the dial: the logo's ">" turned to point at the ring. */
function pointerTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 16;
  g.lineJoin = "miter";
  g.beginPath();
  g.moveTo(20, 96);
  g.lineTo(64, 34);
  g.lineTo(108, 96);
  g.stroke();
  const t = new CanvasTexture(c);
  return t;
}

export type PanelRect = { cx: number; cy: number; width: number; height: number };

export class ShowroomGL {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(30, 1, 1, 400);
  panels: Mesh[] = [];
  mirrors: Mesh[] = [];
  uniforms: U[] = [];
  floorU: U;
  pointerU: U;
  dial: Group;
  textures: Texture[] = [];
  private placeholder = solidTexture(10, 10, 12);
  private dirty = true;
  private w = 1;
  private h = 1;
  private rot = 0;
  private disposed = false;
  private g: Geo;

  constructor(
    canvas: HTMLCanvasElement,
    opts: { images: string[]; labels: string[]; small: boolean; onProgress?: (p: number) => void; onReady?: () => void },
  ) {
    this.g = geometry(opts.small);
    const G = this.g;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    const geo = new PlaneGeometry(1, 1, 48, 1);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const loader = new TextureLoader();
    let loaded = 0;

    for (let i = 0; i < COUNT; i++) {
      const u: U = {
        uTex: { value: this.placeholder },
        uTexA: { value: this.placeholder },
        uTexB: { value: this.placeholder },
        uMixA: { value: 0 },
        uMixB: { value: 0 },
        uPhi: { value: i * THETA },
        uPush: { value: 0 },
        uMirror: { value: 0 },
        uLit: { value: 0 },
        uReady: { value: 0 },
        uSweep: { value: -2 },
        uSweepDir: { value: 1 },
        uHover: { value: 0 },
        uVel: { value: 0 },
        uCorner: { value: [0.006, 0.0107] },
      };
      this.uniforms.push(u);
      const panel = new Mesh(
        geo,
        new ShaderMaterial({ uniforms: u, vertexShader: panelVert(G), fragmentShader: panelFrag, transparent: true, side: FrontSide }),
      );
      const mirrorU: U = { ...u, uMirror: { value: 1 } };
      const mirror = new Mesh(
        geo,
        new ShaderMaterial({ uniforms: mirrorU, vertexShader: panelVert(G), fragmentShader: mirrorFrag, transparent: true, depthWrite: false, side: BackSide }),
      );
      panel.frustumCulled = mirror.frustumCulled = false;
      this.panels.push(panel);
      this.mirrors.push(mirror);
      this.scene.add(mirror, panel);

      loader.load(opts.images[i], (t) => {
        if (this.disposed) return t.dispose();
        t.anisotropy = Math.min(8, maxAniso);
        t.minFilter = LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        this.textures[i] = t;
        u.uTex.value = t;
        this.dirty = true;
        loaded++;
        opts.onProgress?.(loaded / COUNT);
        if (loaded === COUNT) opts.onReady?.();
      });
    }

    // Floor dial (turns with the ring) and the fixed pointer.
    this.floorU = {
      uDial: { value: dialTexture(opts.labels, opts.small ? 2048 : 4096, G) },
      uReady: { value: 0 },
      uKey: { value: new Vector3(1, 1, 1) },
      uFlash: { value: 0 },
    };
    (this.floorU.uDial.value as Texture).anisotropy = Math.min(16, maxAniso);
    const floor = new Mesh(
      new PlaneGeometry(G.FLOOR * 2, G.FLOOR * 2),
      new ShaderMaterial({ uniforms: this.floorU, vertexShader: floorVert, fragmentShader: floorFrag(G), transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 5;
    this.dial = new Group();
    this.dial.position.set(0, 0, -G.R);
    this.dial.add(floor);
    this.scene.add(this.dial);

    this.pointerU = { uMap: { value: pointerTexture() }, uReady: { value: 0 } };
    const pointer = new Mesh(
      new PlaneGeometry(1.1, 1.1),
      new ShaderMaterial({
        uniforms: this.pointerU,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: pointerFrag,
        transparent: true,
        depthWrite: false,
      }),
    );
    pointer.rotation.x = -Math.PI / 2;
    pointer.position.set(0, 0.02, G.RING_IN - G.R - 0.75); // just inside the dial, pointing at the front car
    pointer.renderOrder = 6;
    this.scene.add(pointer);
  }

  /** Place the camera so the front box lands exactly on `rect` (css px inside a w x h stage). */
  layout(w: number, h: number, rect: PanelRect, dpr: number) {
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const fov = w / h < 1 ? 38 : 30;
    const cam = this.camera;
    cam.fov = fov;
    cam.aspect = w / h;
    const { R, PUSH, ARC } = this.g;
    const s = (R + PUSH) / R;
    const chord = 2 * (R + PUSH) * Math.sin(ARC / 2);
    const tan = Math.tan(((fov / 2) * Math.PI) / 180);
    const d = (chord * h) / (2 * rect.width * tan);
    const yc = LIFT + (PH * s) / 2;
    const elev = d * 0.15;
    cam.position.set(0, yc + elev, PUSH + d);
    cam.lookAt(0, yc, PUSH);
    cam.setViewOffset(w, h, 0, h / 2 - rect.cy, w, h);
    cam.updateProjectionMatrix();
    const cornerPx = w < 768 ? 4 : 6;
    for (const u of this.uniforms) u.uCorner.value = [cornerPx / rect.width, cornerPx / rect.height];
    this.dirty = true;
  }

  /** Per frame: ring position (in bays, may be fractional) and turn speed (bays per second). */
  frame(rot: number, vel: number) {
    const moving = Math.abs(rot - this.rot) > 1e-5 || Math.abs(vel) > 1e-3;
    this.rot = rot;
    if (moving) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    for (let i = 0; i < COUNT; i++) {
      let phi = (i - rot) * THETA;
      phi = Math.atan2(Math.sin(phi), Math.cos(phi)); // wrap to -PI..PI
      const t = Math.min(Math.abs(phi) / THETA, 1);
      const near = 1 - t * t * (3 - 2 * t);
      const u = this.uniforms[i];
      u.uPhi.value = phi;
      u.uPush.value = this.g.PUSH * near;
      u.uLit.value = Math.exp(-((phi / THETA) ** 2) * 1.7);
      u.uVel.value = vel;
      // draw order: far boxes first
      this.panels[i].renderOrder = 10 + Math.round(Math.cos(phi) * 100);
      this.mirrors[i].renderOrder = 1;
    }
    this.dial.rotation.y = -rot * THETA;
    this.renderer.render(this.scene, this.camera);
  }

  invalidate() {
    this.dirty = true;
  }

  setReady(v: number) {
    for (const u of this.uniforms) u.uReady.value = v;
    this.floorU.uReady.value = v;
    this.pointerU.uReady.value = v;
    this.dirty = true;
  }

  setKey(hex: string, flash: number) {
    const n = parseInt(hex.slice(1), 16);
    (this.floorU.uKey.value as Vector3).set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    this.floorU.uFlash.value = flash;
    this.dirty = true;
  }

  /** Which box is under a stage point (css px), front-most first; -1 for none. */
  pick(x: number, y: number) {
    const order = this.uniforms
      .map((u, i) => ({ i, c: Math.cos(u.uPhi.value as number) }))
      .filter((o) => o.c > 0.2)
      .sort((a, b) => b.c - a.c);
    const v = new Vector3();
    const { R, ARC } = this.g;
    for (const { i } of order) {
      const u = this.uniforms[i];
      const phi = u.uPhi.value as number;
      const r = R + (u.uPush.value as number);
      const s = r / R;
      const poly: [number, number][] = [];
      const pts = [-0.5, -0.25, 0, 0.25, 0.5];
      for (const yy of [0, 1]) {
        const list = yy ? [...pts].reverse() : pts;
        for (const px of list) {
          const a = phi + px * ARC;
          v.set(Math.sin(a) * r, LIFT + yy * PH * s, Math.cos(a) * r - R).project(this.camera);
          poly.push([((v.x + 1) / 2) * this.w, ((1 - v.y) / 2) * this.h]);
        }
      }
      if (inside(x, y, poly)) return i;
    }
    return -1;
  }

  setMedia(i: number, layer: "A" | "B", tex: Texture | null) {
    const slot = this.uniforms[i][layer === "A" ? "uTexA" : "uTexB"];
    const old = slot.value as Texture;
    if (old !== this.placeholder && old !== tex) old.dispose();
    slot.value = tex ?? this.placeholder;
    this.dirty = true;
  }

  imageTexture(img: HTMLImageElement) {
    const t = new Texture(img);
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  videoTexture(v: HTMLVideoElement) {
    const t = new VideoTexture(v);
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    return t;
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as ShaderMaterial).dispose();
      }
    });
    this.textures.forEach((t) => t?.dispose());
    (this.floorU.uDial.value as Texture).dispose();
    (this.pointerU.uMap.value as Texture).dispose();
    this.placeholder.dispose();
    this.renderer.dispose();
  }
}

function inside(x: number, y: number, poly: [number, number][]) {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}
