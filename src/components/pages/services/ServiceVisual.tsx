"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceMedia } from "@/components/services/ServiceMedia";
import type { ServiceVisual as Visual } from "./services-content";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * A service's picture: a muted loop (or a still) that plays only while at least a quarter of it is on
 * screen, never with reduced motion. The poster / still loads a screen and a half before it arrives, the
 * loop's first data 600 px before; a blurred placeholder shows until then (ServiceMedia).
 */
export default function ServiceVisual({ visual, className }: { visual: Visual; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [near, setNear] = useState(false);
  const [soon, setSoon] = useState(false);

  useEffect(() => {
    const el = boxRef.current!;
    const still = matchMedia(REDUCED).matches;
    const see = new IntersectionObserver(([e]) => setPlay(e.isIntersecting && !still), { threshold: 0.25 });
    const warm = new IntersectionObserver(([e]) => e.isIntersecting && !still && setNear(true), {
      rootMargin: "600px 0px",
    });
    const early = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSoon(true);
        early.disconnect();
      },
      { rootMargin: "150% 0px" },
    );
    see.observe(el);
    warm.observe(el);
    early.observe(el);
    return () => {
      see.disconnect();
      warm.disconnect();
      early.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} className={className}>
      <ServiceMedia
        spec={visual}
        play={play}
        preload={near ? "metadata" : "none"}
        sizes="(min-width: 900px) 56vw, 100vw"
        load={soon || near}
      />
    </div>
  );
}
