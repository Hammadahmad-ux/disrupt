"use client";

import { useEffect, type RefObject } from "react";

// Loading helpers for the case pages: pictures should be in (and decoded) before they are seen.

const cache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Fetch and decode an image once per page life (same src + mode = same promise). `high`: ask for it ahead of
 * other images. `cors`: crossOrigin="anonymous" (needed for WebGL textures when media moves to another host).
 * Resolves null on failure, never rejects.
 */
export function preloadImage(src: string, opts: { high?: boolean; cors?: boolean } = {}) {
  const key = `${opts.cors ? "c" : "n"}|${src}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((res) => {
      const im = new Image();
      if (opts.cors) im.crossOrigin = "anonymous";
      im.decoding = "async";
      if (opts.high) im.fetchPriority = "high";
      im.src = src;
      im.decode().then(
        () => res(im),
        () => {
          cache.delete(key); // let a later call try again
          res(null);
        },
      );
    });
    cache.set(key, p);
  }
  return p;
}

/** Turn the rendered lazy pictures inside `el` eager (hidden ones, e.g. display: none, are left alone). */
export function eagerImages(el: ParentNode) {
  for (const img of el.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
    if (img.getClientRects().length) img.loading = "eager";
  }
}

/**
 * Start a section's pictures loading when it comes within `rootMargin` of the screen (default: 1.5 screens
 * ahead), instead of when the browser's lazy loading reaches each one. Needed where pictures arrive sideways
 * or by transform (strips, pinned tracks): the browser only sees them once they are already in view.
 */
export function useEagerNear<T extends HTMLElement>(ref: RefObject<T | null>, rootMargin = "150% 0px", key?: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        eagerImages(el);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, key]);
}
