"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll reveal for case blocks: returns a ref for the container. Once mounted the container gets
 * [data-reveal]; when it scrolls into view it gets [data-in] (once). Pair with .reveal from
 * shared.module.css on the children. Without JS nothing is hidden.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.reveal = "";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.in = "";
        io.disconnect();
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
