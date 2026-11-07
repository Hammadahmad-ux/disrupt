"use client";

import { useEffect, useRef } from "react";
import {
  Camera,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { ScreenPaint } from "@/components/fx/screen-paint";
import vertexShader from "@/components/fx/shaders/fullscreen.vert";
import fragmentShader from "@/components/fx/shaders/hero.frag";
import styles from "./hero.module.css";

// WebGL layer of the hero: the playing showreel through a thin "wet glass" film that the mouse disturbs.
// Mouse only (fine pointer); touch devices and reduced motion keep the plain <video>.
export default function HeroCanvas({
  video,
  onReady,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  onReady: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const el = video.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the plain <video> stays visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const texture = new VideoTexture(el);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;

    const paint = new ScreenPaint(canvas.clientWidth, canvas.clientHeight);
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uVideo: { value: texture },
        uPaint: { value: paint.texture },
        uResolution: { value: new Vector2(1, 1) },
        uVideoSize: { value: new Vector2(1920, 1080) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const scene = new Scene();
    const camera = new Camera();
    scene.add(new Mesh(new PlaneGeometry(2, 2), material));

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      paint.resize(w, h);
      material.uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pointer, in canvas uv (y up). Only real mouse movement disturbs the glass.
    const a = new Vector2(0.5, 0.5);
    const b = new Vector2(0.5, 0.5);
    let moved = false;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      b.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      moved = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    let raf = 0;
    let last = performance.now() / 1000;
    let ready = false;
    const prev = new Vector2(0.5, 0.5);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now() / 1000;
      const dt = Math.min(1 / 30, Math.max(1 / 240, now - last));
      last = now;
      if (!visible || el.readyState < 2) return;

      if (el.videoWidth) material.uniforms.uVideoSize.value.set(el.videoWidth, el.videoHeight);
      a.copy(prev);
      paint.update(renderer, dt, a, b, moved);
      prev.copy(b);
      moved = false;
      material.uniforms.uPaint.value = paint.texture;
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady();
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      paint.dispose();
      texture.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [video, onReady]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
