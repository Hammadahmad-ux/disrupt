import { CONTOUR_FRAG_100, CONTOUR_FRAG_300, CONTOUR_VERT_100, CONTOUR_VERT_300 } from "./contour-shader";

// Raw WebGL engine for the alive background. Cheap on purpose: one full-screen triangle, a reduced
// drawing buffer, ~30 fps when idle, no work while the tab is hidden or while the opaque hero fills the screen.

type Options = {
  /** Draw one still frame (prefers-reduced-motion) instead of animating. */
  still: boolean;
  /** Let the lines bend around a mouse pointer (fine pointer + hover only). */
  pointer: boolean;
  /** Called once, after the first frame is on screen. */
  onFirstFrame?: () => void;
};

type GL = WebGLRenderingContext | WebGL2RenderingContext;

// Idle drift is capped at ~30 fps (24 on touch devices). While the page scrolls or the mouse moves
// the field follows at display rate (max ~60 fps), otherwise the slower-scrolling map would judder.
const IDLE_MS = 1000 / 30;
const IDLE_MS_TOUCH = 1000 / 24;
const ACTIVE_MS = 1000 / 60;
const TIME_SCALE = 0.028; // how fast the terrain evolves
const SCROLL_RATE = 0.32; // the map scrolls at a third of the page speed

const UNIFORMS = [
  "uRes",
  "uView",
  "uTime",
  "uScroll",
  "uMouse",
  "uMouseVel",
  "uCell",
  "uDensity",
  "uAlpha",
  "uLineW",
] as const;
type UniformName = (typeof UNIFORMS)[number];

function compile(gl: GL, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== "production") console.warn("[alive] shader:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function setup(canvas: HTMLCanvasElement) {
  const attrs: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  };
  let gl: GL | null = canvas.getContext("webgl2", attrs);
  let vsSrc = CONTOUR_VERT_300;
  let fsSrc = CONTOUR_FRAG_300;
  if (!gl) {
    gl = canvas.getContext("webgl", attrs);
    if (!gl || !gl.getExtension("OES_standard_derivatives")) return null;
    vsSrc = CONTOUR_VERT_100;
    fsSrc = CONTOUR_FRAG_100;
  }
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // One triangle that covers the screen.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  const u = {} as Record<UniformName, WebGLUniformLocation | null>;
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(prog, name);
  return { gl, prog, buf, u };
}

/** Starts the contour field on a canvas. Returns a cleanup function, or null if WebGL is unavailable. */
export function startContourField(canvas: HTMLCanvasElement, opts: Options): (() => void) | null {
  let ctx = setup(canvas);
  if (!ctx) return null;

  let raf = 0;
  let lastFrame = 0;
  let lastScroll = -1;
  let lastDrawScroll = -1;
  const idleMs = matchMedia("(pointer: coarse)").matches ? IDLE_MS_TOUCH : IDLE_MS;
  let fieldTime = 7.3; // start mid-evolution so the first frame is already interesting
  let firstDone = false;
  let lost = false;

  // Viewport and hero geometry (CSS px).
  let viewW = 1;
  let viewH = 1;
  let heroBottom = 0;

  // Pointer, smoothed in the loop.
  const target = { x: -9999, y: -9999, on: 0 };
  const mouse = { x: -9999, y: -9999, on: 0, vx: 0, vy: 0 };
  let lastPointer = { x: 0, y: 0, t: 0 };
  const rawVel = { x: 0, y: 0 };

  // Opaque light sheet (#studio): while it covers the whole viewport the field is hidden too.
  let sheetTop = Infinity;
  let sheetBottom = -Infinity;
  let sheetAt = 0;
  const measureSheet = () => {
    const sheet = document.getElementById("studio")?.firstElementChild;
    if (!sheet) return;
    const r = sheet.getBoundingClientRect();
    sheetTop = r.top + window.scrollY;
    sheetBottom = r.bottom + window.scrollY;
  };

  const measureHero = () => {
    const hero = document.getElementById("top");
    heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : 0;
    measureSheet();
  };

  const resize = () => {
    if (!ctx) return;
    viewW = Math.max(1, canvas.clientWidth);
    viewH = Math.max(1, canvas.clientHeight);
    // Lines are faint, so a reduced buffer is invisible to the eye: 0.5x on 1x screens, 0.75x on retina.
    const scale = 0.5 * Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(viewW * scale));
    const h = Math.max(1, Math.round(viewH * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.gl.viewport(0, 0, w, h);
    measureHero();
    if (opts.still) draw();
  };

  const draw = () => {
    if (!ctx || lost) return;
    const { gl, u } = ctx;
    const small = viewW < 700;
    const cell = Math.min(760, Math.max(320, Math.max(viewW, viewH) * (small ? 0.62 : 0.44)));
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform2f(u.uView, viewW, viewH);
    gl.uniform1f(u.uTime, fieldTime);
    gl.uniform1f(u.uScroll, opts.still ? 0 : window.scrollY * SCROLL_RATE);
    gl.uniform3f(u.uMouse, mouse.x, mouse.y, mouse.on);
    gl.uniform2f(u.uMouseVel, mouse.vx, mouse.vy);
    gl.uniform1f(u.uCell, cell);
    gl.uniform1f(u.uDensity, small ? 2.8 : 3.3);
    gl.uniform1f(u.uAlpha, small ? 0.095 : 0.088);
    // ~1.1 CSS px wide on every screen, whatever the buffer scale.
    gl.uniform1f(u.uLineW, Math.max(0.9, (canvas.width / viewW) * 1.15));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!firstDone) {
      firstDone = true;
      opts.onFirstFrame?.();
    }
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const sy = window.scrollY;
    const active = Math.abs(sy - lastScroll) > 0.3 || Math.abs(sy - lastDrawScroll) > 0.3 || now - lastPointer.t < 300;
    lastScroll = sy;
    if (now - lastFrame < (active ? ACTIVE_MS : idleMs) - 2) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : idleMs / 1000;
    lastFrame = now;

    // Smooth the pointer (position, presence and velocity).
    const k = 1 - Math.exp(-dt * 5.5);
    if (mouse.x < -9000 && target.x > -9000) {
      mouse.x = target.x;
      mouse.y = target.y;
    }
    mouse.x += (target.x - mouse.x) * k;
    mouse.y += (target.y - mouse.y) * k;
    mouse.on += (target.on - mouse.on) * (1 - Math.exp(-dt * 2.2));
    const idle = now - lastPointer.t > 120;
    const vk = 1 - Math.exp(-dt * (idle ? 3 : 8));
    mouse.vx += ((idle ? 0 : rawVel.x) - mouse.vx) * vk;
    mouse.vy += ((idle ? 0 : rawVel.y) - mouse.vy) * vk;

    fieldTime += dt * TIME_SCALE;
    // The hero is opaque: while it fills the viewport there is nothing to show.
    if (sy + viewH <= heroBottom - 1) return;
    // Same for the studio sheet once it has opened to full bleed (pins above it can move it, so the
    // box is re-measured twice a second rather than cached once).
    if (now - sheetAt > 500) {
      sheetAt = now;
      measureSheet();
    }
    if (sy >= sheetTop + 1 && sy + viewH <= sheetBottom - 1) return;
    lastDrawScroll = sy;
    draw();
  };

  const start = () => {
    if (opts.still || raf || lost) return;
    lastFrame = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVisibility = () => (document.hidden ? stop() : start());

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const now = performance.now();
    const dtp = Math.max(8, now - lastPointer.t);
    if (lastPointer.t && now - lastPointer.t < 200) {
      rawVel.x = Math.max(-2500, Math.min(2500, ((e.clientX - lastPointer.x) / dtp) * 1000));
      rawVel.y = Math.max(-2500, Math.min(2500, ((e.clientY - lastPointer.y) / dtp) * 1000));
    }
    lastPointer = { x: e.clientX, y: e.clientY, t: now };
    target.x = e.clientX;
    target.y = e.clientY;
    target.on = 1;
  };
  const onPointerOut = (e: PointerEvent) => {
    if (!e.relatedTarget) target.on = 0;
  };
  const onBlur = () => {
    target.on = 0;
  };

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stop();
  };
  const onRestored = () => {
    ctx = setup(canvas);
    lost = !ctx;
    if (!ctx) return;
    resize();
    if (!opts.still) start();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  // Page height changes (sections loading) move the hero bottom only rarely; re-measure on load too.
  window.addEventListener("load", measureHero);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  document.addEventListener("visibilitychange", onVisibility);
  if (opts.pointer && !opts.still) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", onBlur);
  }

  resize();
  if (opts.still) draw();
  else if (!document.hidden) start();

  return () => {
    stop();
    ro.disconnect();
    window.removeEventListener("load", measureHero);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerout", onPointerOut);
    window.removeEventListener("blur", onBlur);
    if (ctx) {
      const { gl, prog, buf } = ctx;
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      // No loseContext(): React (dev Strict Mode) may remount on the same canvas and reuse this context.
    }
    ctx = null;
  };
}
