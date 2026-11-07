"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CONTOUR_FRAG, CONTOUR_VERT } from "./contour-shader";
import styles from "./studio.module.css";

// Paper (#f1efe9) and a darker paper tone for the lines. Kept in sync with --paper in globals.css.
const PAPER: [number, number, number] = [241 / 255, 239 / 255, 233 / 255];
const LINE: [number, number, number] = [216 / 255, 210 / 255, 197 / 255];
const PARALLAX = 0.55; // the lines travel at 55% of the page speed, so they sit "behind" the stills

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("[studio] contour shader:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/**
 * Animated contour lines behind the Studio section. The canvas is viewport-sized and sticky inside the
 * sheet, renders only while the sheet is on screen, and follows the page scroll with a little parallax.
 * No WebGL2: the canvas hides and the plain paper shows. Reduced motion: lines are still drawn (they
 * move exactly with the page, no drift, no pointer hill).
 */
type RGB = [number, number, number];

export default function ContourField({
  sheetRef,
  paper = PAPER,
  line = LINE,
}: {
  sheetRef: RefObject<HTMLElement | null>;
  /** Background and line colours (0..1). Defaults: the studio paper; the footer passes a dark set. */
  paper?: RGB;
  line?: RGB;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sheet = sheetRef.current;
    if (!canvas || !sheet) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      canvas.hidden = true;
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, CONTOUR_VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, CONTOUR_FRAG);
    const prog = gl.createProgram()!;
    if (!vs || !fs) {
      canvas.hidden = true;
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[studio] contour program:", gl.getProgramInfoLog(prog));
      canvas.hidden = true;
      return;
    }
    gl.useProgram(prog);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const uRes = u("uRes");
    const uDpr = u("uDpr");
    const uTime = u("uTime");
    const uOffset = u("uOffset");
    const uPointer = u("uPointer");
    gl.uniform3fv(u("uPaper"), paper);
    gl.uniform3fv(u("uLine"), line);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const parallax = reduced ? 1 : PARALLAX;

    let dpr = 1;
    let raf = 0;
    let visible = false;
    let time = Math.random() * 40; // a different landscape on every visit
    let last = 0;
    const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0, ts: 0 };

    const resize = () => {
      // Thin lines need some density, but big screens get a lower cap to keep the fill cost down.
      dpr = Math.min(window.devicePixelRatio || 1, canvas.clientWidth > 1600 ? 1.25 : 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      if (!raf) draw(performance.now());
    };

    const draw = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduced) time += dt;

      // Pointer: ease towards the target, and fade the hill in and out.
      const ease = 1 - Math.pow(0.0015, dt || 0.016);
      if (ptr.x < -9000) {
        ptr.x = ptr.tx;
        ptr.y = ptr.ty;
      }
      ptr.x += (ptr.tx - ptr.x) * ease;
      ptr.y += (ptr.ty - ptr.y) * ease;
      ptr.s += (ptr.ts - ptr.s) * (1 - Math.pow(0.02, dt || 0.016));

      const sheetTop = sheet.getBoundingClientRect().top;
      const canvasTop = canvas.getBoundingClientRect().top;
      // Sample y = canvas-local y + canvas top - parallax * sheet top (css px).
      const offset = canvasTop - parallax * sheetTop;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uOffset, offset);
      gl.uniform3f(uPointer, ptr.x, ptr.y - canvasTop, ptr.s);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Reduced motion: no loop; redraw only when the page scrolls (lines move exactly with the page).
    let pending = 0;
    const onScroll = () => {
      if (!visible || pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        draw(performance.now());
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (reduced) {
          if (visible) onScroll();
          return;
        }
        if (visible) start();
        else stop();
      },
      { rootMargin: "100px 0px" },
    );
    io.observe(sheet);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (reduced) window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: PointerEvent) => {
      ptr.tx = e.clientX;
      ptr.ty = e.clientY;
      ptr.ts = 1;
    };
    const onLeave = () => {
      ptr.ts = 0;
    };
    if (finePointer && !reduced) {
      sheet.addEventListener("pointermove", onMove, { passive: true });
      sheet.addEventListener("pointerleave", onLeave);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      stop();
      cancelAnimationFrame(pending);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
      sheet.removeEventListener("pointermove", onMove);
      sheet.removeEventListener("pointerleave", onLeave);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [sheetRef, paper, line]);

  return <canvas ref={canvasRef} className={styles.contours} aria-hidden="true" />;
}
