"use client";

import { useEffect, useRef } from "react";
import { startContourField } from "./alive/contour-field";
import styles from "./alive/alive.module.css";

// The page's "alive" layer: faint topographic contour lines that drift, scroll with the page at a
// slower rate and bend around the mouse. Fixed behind every section; the opaque hero hides it.
// Reduced motion draws one still frame; without WebGL the layer stays empty (plain ink page).
export default function AliveBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (!layer || !canvas) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const stop = startContourField(canvas, {
      still,
      pointer,
      onFirstFrame: () => layer.setAttribute("data-ready", "true"),
    });
    return () => stop?.();
  }, []);

  return (
    <div ref={layerRef} className={styles.layer} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
