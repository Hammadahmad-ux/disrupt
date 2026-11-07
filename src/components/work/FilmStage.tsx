"use client";

import { useEffect } from "react";
import { preload } from "react-dom";
import { usePathname } from "next/navigation";
import { MEDIA, PROJECTS, loopSources } from "@/content/projects";
import { coverKey, lqipBg } from "./lqip";
import { registerMedia, useStage, type PrimeLevel } from "./stage-store";
import { useReducedMotion } from "./use-reduced-motion";
import styles from "./work.module.css";

// The film stage: one fixed, full-bleed media element per project, kept alive by app/work/layout.tsx
// across /work/<slug> pages, so the next-project fly-through lands on the same playing film. On a case page
// it is the hero itself. Only the active film plays; neighbours preload. The /work index is a plain picture
// grid (WorkGrid), so there the stage is switched off: hidden and paused.
//
// Loading: a project's media only loads once it is needed, so the stage never competes with what is on
// screen. On a case page that is the project in the URL (from the very first server render) and the
// neighbours the page warms; on the /work grid, the projects WorkGrid primes (idle, hover, focus, press).
// Posters are the AVIF ones the home page's drive cards already use (one file, one download); a tiny
// blurred placeholder sits behind each one until it is in.

// Same frame as content/projects.ts poster() (WebP), as AVIF: smaller, and shared with the home page cards.
const posterSrc = (slug: string) => `${MEDIA}/work/${slug}/poster.avif`;
const stillSrc = (slug: string, ext: "avif" | "webp") => `${MEDIA}/work/${slug}/stills/01-1600.${ext}`;

export default function FilmStage() {
  const pathname = usePathname();
  const off = pathname === "/work";
  // On a case page the URL names the project, so the server render already shows its poster in hero mode,
  // before CaseHero's effect sets the store (otherwise the hero is black until the page is hydrated).
  const here = pathname.startsWith("/work/") ? decodeURIComponent(pathname.slice("/work/".length).split("/")[0]) : null;
  const storeMode = useStage((s) => s.mode);
  const storeActive = useStage((s) => s.active);
  const warm = useStage((s) => s.warm);
  const look = useStage((s) => s.look);
  const primed = useStage((s) => s.primed);
  const reduced = useReducedMotion();
  const active = storeActive ?? here;
  const mode = off ? "off" : here && storeMode === "index" ? "hero" : storeMode;

  // What each project may load: the active film in full (it plays), warm neighbours in full, everything
  // else only as far as it was primed. Off (the grid) and with reduced motion, posters only.
  const full: PrimeLevel = off || reduced ? 1 : 3;
  const level = (slug: string) =>
    Math.max(primed[slug] ?? 0, slug === active ? full : 0, warm.includes(slug) ? (off ? 1 : full) : 0);

  // The case page's own poster is the first thing on screen: fetch it first.
  const first = here ? PROJECTS.find((p) => p.slug === here) : undefined;
  if (first?.type === "film" && active === here) preload(posterSrc(first.slug), { as: "image", fetchPriority: "high" });

  // Keep what has loaded: a project that stops being active or warm keeps its poster (and its buffer).
  useEffect(() => {
    const { prime } = useStage.getState();
    if (active) prime(active, full);
    if (warm.length) prime(warm, off ? 1 : full);
  }, [active, warm, off, full]);

  useEffect(() => {
    for (const p of PROJECTS) {
      const el = document.querySelector<HTMLVideoElement>(`video[data-stage="${p.slug}"]`);
      if (!el) continue;
      if (p.slug === active && !reduced && !off) el.play().catch(() => undefined);
      else el.pause();
    }
  }, [active, reduced, off]);

  // Leaving the Work section: the next visit starts fresh on the roster.
  useEffect(() => () => useStage.getState().setMode("index"), []);

  return (
    <div className={styles.stage} data-mode={mode} data-look={look} aria-hidden="true">
      {PROJECTS.map((p) => {
        const l = level(p.slug);
        const bg = l ? lqipBg(coverKey(p.slug, p.type)) : undefined;
        return p.type === "film" ? (
          <video
            key={p.slug}
            ref={(el) => {
              registerMedia(p.slug, el);
              return () => registerMedia(p.slug, null);
            }}
            data-stage={p.slug}
            className={styles.media}
            data-on={p.slug === active || undefined}
            muted
            loop
            playsInline
            preload={l >= 3 ? "auto" : l === 2 ? "metadata" : "none"}
            poster={l ? posterSrc(p.slug) : undefined}
            style={bg}
            disablePictureInPicture
          >
            {loopSources(p.slug).map((s) => (
              <source key={s.src} src={s.src} type={s.type} />
            ))}
          </video>
        ) : (
          <picture key={p.slug}>
            <source type="image/avif" srcSet={l ? stillSrc(p.slug, "avif") : undefined} />
            {/* A texture source for WebGL (NextProject), and the stills projects' hero. */}
            <img
              ref={(el) => {
                registerMedia(p.slug, el);
                return () => registerMedia(p.slug, null);
              }}
              data-stage={p.slug}
              className={styles.media}
              data-on={p.slug === active || undefined}
              src={l ? stillSrc(p.slug, "webp") : undefined}
              alt=""
              style={bg}
              fetchPriority={p.slug === here ? "high" : undefined}
              decoding="async"
            />
          </picture>
        );
      })}
      <div className={styles.stageShade} />
    </div>
  );
}
