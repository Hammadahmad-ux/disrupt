"use client";

import { useEffect, useRef, useState } from "react";
import { MEDIA, loopSources } from "@/content/projects";
import { lqipBg } from "@/components/work/lqip";

export type ServiceMediaSpec =
  | { kind: "video"; slug: string }
  | { kind: "image"; slug: string; n: number };

const REDUCED = "(prefers-reduced-motion: reduce)";

const stillSet = (slug: string, n: number, ext: "avif" | "webp") => {
  const base = `${MEDIA}/work/${slug}/stills/${String(n).padStart(2, "0")}`;
  return `${base}-800.${ext} 800w, ${base}-1600.${ext} 1600w`;
};

// The loop's poster as AVIF: the same file the home page's drive cards and the work stage show, so a
// frame seen once is never downloaded twice.
const posterAvif = (slug: string) => `${MEDIA}/work/${slug}/poster.avif`;

/** Placeholder behind a service picture or loop (see components/work/lqip.ts). */
const placeholder = (spec: ServiceMediaSpec) =>
  lqipBg(spec.kind === "video" ? `${spec.slug}/poster` : `${spec.slug}/${String(spec.n).padStart(2, "0")}`);

export type Preload = "none" | "metadata" | "auto";
const RANK: Record<Preload, number> = { none: 0, metadata: 1, auto: 2 };

/**
 * One media item for a service: a muted 6 s loop or a still. Videos start at preload="none"; `preload`
 * only ever upgrades it (none -> metadata near the viewport -> auto on intent). They play only while
 * `play` is true; the poster shows otherwise. `load` false holds back the poster / still itself (for media
 * far down the page); a blurred placeholder shows until the real picture is in.
 */
export function ServiceMedia({
  spec,
  play,
  preload,
  className,
  sizes,
  load = true,
}: {
  spec: ServiceMediaSpec;
  play: boolean;
  preload: Preload;
  className?: string;
  sizes: string;
  load?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (play) v.play().catch(() => undefined);
    else v.pause();
  }, [play]);

  useEffect(() => {
    const v = ref.current;
    if (v && RANK[preload] > RANK[(v.preload as Preload) || "none"]) v.preload = preload;
  }, [preload]);

  if (spec.kind === "image") {
    const n = String(spec.n).padStart(2, "0");
    return (
      <picture className={className}>
        <source type="image/avif" srcSet={stillSet(spec.slug, spec.n, "avif")} sizes={sizes} />
        <source type="image/webp" srcSet={stillSet(spec.slug, spec.n, "webp")} sizes={sizes} />
        <img
          src={`${MEDIA}/work/${spec.slug}/stills/${n}-800.webp`}
          alt=""
          width={1600}
          height={900}
          loading={load ? "eager" : "lazy"}
          decoding="async"
          style={placeholder(spec)}
        />
      </picture>
    );
  }

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      poster={load ? posterAvif(spec.slug) : undefined}
      width={1280}
      height={720}
      aria-hidden="true"
      tabIndex={-1}
      style={placeholder(spec)}
    >
      {loopSources(spec.slug).map((s) => (
        <source key={s.src} src={s.src} type={s.type} />
      ))}
    </video>
  );
}

/**
 * Inline media for touch screens and reduced motion (hidden by CSS where the cursor preview is used,
 * so nothing loads there). Plays only while on screen, never with reduced motion. The poster / still
 * loads a screen and a half before it arrives, the loop's first data 500 px before.
 */
export function InlineServiceMedia({ spec, className }: { spec: ServiceMediaSpec; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [near, setNear] = useState(false);
  const [soon, setSoon] = useState(false);

  useEffect(() => {
    const el = boxRef.current!;
    const see = new IntersectionObserver(([e]) => setInView(e.isIntersecting && !matchMedia(REDUCED).matches), {
      threshold: 0.35,
    });
    const warm = new IntersectionObserver(
      ([e]) => e.isIntersecting && !matchMedia(REDUCED).matches && setNear(true),
      { rootMargin: "500px 0px" },
    );
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
        spec={spec}
        play={inView}
        preload={near ? "metadata" : "none"}
        sizes="(max-width: 720px) 92vw, 260px"
        load={soon || near}
      />
    </div>
  );
}
