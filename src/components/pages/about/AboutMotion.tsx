"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";

gsap.registerPlugin(ScrollTrigger);

const REDUCED = "(prefers-reduced-motion: reduce)";

// The About page's only motion, kept small on purpose (client: "too much going on"):
//  - the statement's phrases rise out of a mask and the hero still opens like a cinema letterbox, once the
//    loader is gone;
//  - the rest fades up gently as it scrolls into view (items that arrive together follow each other);
//  - the hero still drifts a little slower than the page (scrubbed parallax).
// Nothing is hidden with reduced motion or before this script runs (data-reveal is set here, not in the HTML).
export default function AboutMotion() {
  // Hide the reveal items before first paint, only when motion is fine.
  useLayoutEffect(() => {
    if (matchMedia(REDUCED).matches) return;
    document.querySelector<HTMLElement>("[data-about]")?.setAttribute("data-reveal", "");
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-about]");
    if (!root || !root.hasAttribute("data-reveal")) return;

    // Scroll reveals.
    const items = [...root.querySelectorAll<HTMLElement>("[data-rv]")];
    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.top - rb.top || ra.left - rb.left;
          })
          .forEach((el, k) => {
            el.style.setProperty("--d", `${Math.min(k, 6) * 80}ms`);
            el.setAttribute("data-in", "");
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    // Hero: wait for the loader so the first moment is seen (never longer than 6 s).
    const start = () => {
      window.clearTimeout(failsafe);
      root.setAttribute("data-hero-in", "");
      items.forEach((el) => io.observe(el));
    };
    const failsafe = window.setTimeout(start, useIntro.getState().done ? 0 : 6000);
    if (!useIntro.getState().done) window.addEventListener(INTRO_DONE_EVENT, start, { once: true });

    // Slow parallax on the hero still: it is drawn 10% larger and drifts within its frame.
    const img = root.querySelector<HTMLElement>("[data-parallax]");
    const frame = root.querySelector<HTMLElement>("[data-hero-frame]");
    const ctx = gsap.context(() => {
      if (!img || !frame) return;
      gsap.fromTo(
        img,
        { yPercent: -4, scale: 1.1 },
        {
          yPercent: 4,
          scale: 1.1,
          ease: "none",
          scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }, root);

    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      window.clearTimeout(failsafe);
      io.disconnect();
      ctx.revert();
    };
  }, []);

  return null;
}
