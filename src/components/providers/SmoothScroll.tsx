"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { setLenis } from "./lenis-ref";

gsap.registerPlugin(ScrollTrigger);

// One smooth-scroll instance for the whole site, driven by GSAP's ticker so ScrollTrigger stays in sync.
// Locked while the intro is up; off for reduced motion (native scroll, ScrollTrigger still works).
export default function SmoothScroll() {
  useEffect(() => {
    // Pinned and sticky sections measure the page; re-measure once the web fonts have swapped in.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) ScrollTrigger.refresh();
    });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => void (alive = false);
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false });
    setLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    if (!useIntro.getState().done) lenis.stop();
    const onIntroDone = () => {
      lenis.start();
      ScrollTrigger.refresh();
    };
    window.addEventListener(INTRO_DONE_EVENT, onIntroDone);

    return () => {
      alive = false;
      window.removeEventListener(INTRO_DONE_EVENT, onIntroDone);
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  return null;
}
