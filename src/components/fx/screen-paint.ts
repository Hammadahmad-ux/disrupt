import {
  Camera,
  HalfFloatType,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import vertexShader from "./shaders/fullscreen.vert";
import fragmentShader from "./shaders/paint.frag";

// Cursor "screen paint" field at 1/4 resolution (ping-pong). rg = flow velocity.
// Feeds the wet-glass refraction of anything that samples `texture`.
export class ScreenPaint {
  private read: WebGLRenderTarget;
  private write: WebGLRenderTarget;
  private scene = new Scene();
  private camera = new Camera();
  private material: ShaderMaterial;

  constructor(width: number, height: number) {
    const opts = { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
    this.read = new WebGLRenderTarget(1, 1, opts);
    this.write = new WebGLRenderTarget(1, 1, opts);
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPrev: { value: null },
        uPointerA: { value: new Vector2(0.5, 0.5) },
        uPointerB: { value: new Vector2(0.5, 0.5) },
        uPointerVel: { value: new Vector2() },
        uRadius: { value: 0.06 },
        uAspect: { value: 1 },
        uDt: { value: 1 / 60 },
        uActive: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    const w = Math.max(32, Math.round(width / 4));
    const h = Math.max(32, Math.round(height / 4));
    this.read.setSize(w, h);
    this.write.setSize(w, h);
    this.material.uniforms.uAspect.value = width / height;
  }

  get texture() {
    return this.read.texture;
  }

  /** a, b: previous and current pointer in uv (y up); active = the pointer moved this frame. */
  update(renderer: WebGLRenderer, dt: number, a: Vector2, b: Vector2, active: boolean) {
    const u = this.material.uniforms;
    u.uPrev.value = this.read.texture;
    u.uPointerA.value.copy(a);
    u.uPointerB.value.copy(b);
    u.uPointerVel.value.set((b.x - a.x) / dt, (b.y - a.y) / dt).clampLength(0, 6);
    u.uDt.value = dt;
    u.uActive.value = active ? 1 : 0;
    renderer.setRenderTarget(this.write);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    [this.read, this.write] = [this.write, this.read];
  }

  dispose() {
    this.read.dispose();
    this.write.dispose();
    this.material.dispose();
  }
}
