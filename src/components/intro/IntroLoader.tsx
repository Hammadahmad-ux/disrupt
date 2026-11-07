"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { I_CENTER, WordmarkDraw, WordmarkGlyphs } from "./Wordmark";
import { WORDMARK_WIDTH } from "./wordmark-paths";
import { INTRO_DONE_EVENT, INTRO_SEEN_KEY, totalProgress, useIntro } from "./intro-store";
import styles from "./intro.module.css";

// Seconds from navigation start. The draw loop timings live in intro.module.css (--cycle, --stagger).
const CLOSE_AT = 2.66; // first visit: written, erased, written again, then the window opens (~3.6 s total)
const CLOSE_AT_REPEAT = 0.75;
const HARD_CAP = 3.0; // Hammad: 3-4 s max. Close by this point even if the page is still loading.
const DISPLAY_RATE = 1.2; // max climb of the shown percentage per second

export default function IntroLoader() {
  const [mounted, setMounted] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const holesRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const logo = logoRef.current!;
    const holes = holesRef.current!;
    const label = labelRef.current!;
    const count = countRef.current!;
    const html = document.documentElement;
    const repeat = html.classList.contains("intro-repeat");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Place the mask's logo-shaped holes exactly over the drawn logo.
    let box = logo.getBoundingClientRect();
    const place = (scale = 1) => {
      const k = box.width / WORDMARK_WIDTH;
      const cx = box.left + I_CENTER.x * k;
      const cy = box.top + I_CENTER.y * k;
      holes.setAttribute(
        "transform",
        `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy}) translate(${box.left} ${box.top}) scale(${k})`,
      );
    };
    place();
    const onResize = () => {
      box = logo.getBoundingClientRect();
      place();
    };
    window.addEventListener("resize", onResize);

    let shown = 0;
    let last = performance.now();
    let closing = false;
    let skip = false;
    let raf = 0;
    const tweens: gsap.core.Animation[] = [];

    const finish = () => {
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, "1");
      } catch {}
      html.classList.remove("intro-active");
      useIntro.getState().finish();
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      setMounted(false);
    };

    const close = () => {
      closing = true;
      const tl = gsap.timeline({ onComplete: finish });
      tweens.push(tl);
      tl.to(label, { opacity: 0, duration: 0.3 }, 0);

      if (reduced) {
        tl.to(root, { opacity: 0, duration: 0.45, ease: "power1.out" }, 0);
        return;
      }

      // 1. Finish the writing wherever the loop is (it may be mid-erase), then hold the full logo.
      const strokes = [...logo.querySelectorAll<SVGPathElement>("[data-stroke]")];
      for (const s of strokes) {
        const off = parseFloat(getComputedStyle(s).strokeDashoffset) || 0;
        s.style.animation = "none";
        s.style.strokeDashoffset = String(off);
        tl.to(s, { strokeDashoffset: 0, duration: 0.18 + 0.22 * Math.min(1, Math.abs(off)), ease: "power2.out" }, 0);
      }

      // 2. A short gather beat (the logo pinches in), then the letters turn into windows onto the site.
      tl.to(logo, { scale: 0.92, duration: 0.2, ease: "power2.in" }, ">");
      tl.set(holes, { attr: { opacity: 1 } }, ">");
      tl.set(logo, { opacity: 0 }, "<");

      // 3. Zoom into the "I" until its window is bigger than the screen (expo-in, like a hard push-in).
      const k = box.width / WORDMARK_WIDTH;
      const cx = box.left + I_CENTER.x * k;
      const cy = box.top + I_CENTER.y * k;
      const iw = I_CENTER.width * k * 0.92;
      const ih = I_CENTER.height * k * 0.92;
      const need = Math.max(
        (2 * Math.max(cx, innerWidth - cx)) / iw,
        (2 * Math.max(cy, innerHeight - cy)) / ih,
      ) * 1.15;
      const z = { s: 0.92 };
      tl.to(z, { s: need, duration: 0.72, ease: "expo.in", onUpdate: () => place(z.s) }, "<");
      if (skip) tl.timeScale(1.8);
    };

    const onSkip = () => {
      skip = true;
      for (const t of tweens) t.timeScale(1.8);
    };
    root.addEventListener("pointerdown", onSkip);
    window.addEventListener("keydown", onSkip);

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = totalProgress(useIntro.getState().tasks) || 1;
      shown = Math.min(target, shown + dt * DISPLAY_RATE * (skip || repeat ? 3 : 1));
      count.textContent = String(Math.round(shown * 100)).padStart(3, "0");

      if (!closing) {
        const t = now / 1000; // seconds since navigation start
        const minAt = reduced ? 0.7 : repeat ? CLOSE_AT_REPEAT : CLOSE_AT;
        if ((shown >= 0.999 && t >= minAt) || (skip && t >= 0.5) || t >= HARD_CAP) close();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointerdown", onSkip);
      window.removeEventListener("keydown", onSkip);
      tweens.forEach((t) => t.kill());
    };
  }, []);

  if (!mounted) return null;

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true" data-intro>
      {/* Black veil with logo-shaped holes (hidden until the reveal): the site shows through them. */}
      <svg className={styles.veil} width="100%" height="100%" focusable="false">
        <defs>
          <mask id="intro-window" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="#fff" />
            <g ref={holesRef} opacity="0">
              <WordmarkGlyphs fill="#000" />
            </g>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="#000" mask="url(#intro-window)" />
      </svg>

      <div ref={logoRef} className={styles.logo}>
        <WordmarkDraw />
      </div>

      <div ref={labelRef} className={styles.label}>
        Loading<span ref={countRef} className={styles.count}>000</span>
      </div>
    </div>
  );
}
