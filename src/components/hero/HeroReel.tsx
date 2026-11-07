"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { scrollToId } from "@/components/providers/lenis-ref";
import { openReel, warmReel } from "@/components/reel-player/reel-player-store";
import { MEDIA } from "@/content/projects";
import styles from "./hero.module.css";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// Home hero: the full-screen showreel with a simple centred statement over it (Hammad's layout),
// and a scroll cue (client removed the caption and pause control).
export default function HeroReel() {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [glReady, setGlReady] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => matchMedia(REDUCED).matches, () => true);
  const onGlReady = useCallback(() => setGlReady(true), []);

  // Intro progress tasks, the synced caption and the progress line.
  useEffect(() => {
    const video = videoRef.current!;
    const { register, report } = useIntro.getState();
    register("hero-poster", 0.15);
    register("hero-video", 0.55);
    const poster = new window.Image();
    poster.src = video.poster;
    poster.decode().catch(() => undefined).then(() => report("hero-poster", 1));
    const onProgress = () => {
      if (video.buffered.length) report("hero-video", Math.min(0.95, video.buffered.end(0) / 3));
    };
    const onReady = () => report("hero-video", 1);
    video.addEventListener("progress", onProgress);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onReady, true);
    if (video.readyState >= 2) onReady();
    // The film starts downloading only now, after the page's code has loaded: on a slow connection a 10 MB
    // film fetched straight from the HTML would starve the scripts (dead buttons) and the next page's data.
    // The poster shows until then. Reduced motion keeps the poster only.
    // It plays the plain 1080p file, not the HLS ladder: the stream started at 360p and looked blurry (Adil, 2026-11-06).
    let visible = true;
    if (matchMedia(REDUCED).matches) onReady();
    else {
      video.preload = "auto";
      video.src = `${MEDIA}/hero-1080.h264.mp4`;
      if (visible) video.play().catch(onReady);
    }

    // Off screen: pause to save the decoder, unless the visitor paused it themselves.
    const io = new IntersectionObserver(([entry]) => {
      if (matchMedia(REDUCED).matches) return;
      visible = entry.isIntersecting;
      if (visible) video.play().catch(() => undefined);
      else video.pause();
    });
    io.observe(rootRef.current!);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = video.currentTime || 0;
      if (barRef.current && video.duration) barRef.current.style.transform = `scaleX(${t / video.duration})`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onReady, true);
    };
  }, []);

  // Load-in once the loader has opened: lines rise out of masks, the rest fades up.
  useEffect(() => {
    const root = rootRef.current!;
    const lines = root.querySelectorAll("[data-hero-line]");
    const items = root.querySelectorAll("[data-hero-in]");
    if (matchMedia(REDUCED).matches) return;
    const play = () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(lines, { yPercent: 115 }, { yPercent: 0, duration: 1.2, stagger: 0.09 }, 0.1);
      tl.fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.07 }, 0.25);
    };
    if (useIntro.getState().done) return;
    gsap.set(lines, { yPercent: 115 });
    gsap.set(items, { autoAlpha: 0, y: 14 });
    window.addEventListener(INTRO_DONE_EVENT, play, { once: true });
    return () => window.removeEventListener(INTRO_DONE_EVENT, play);
  }, []);


  return (
    <section ref={rootRef} id="top" className={styles.hero} aria-labelledby="hero-title">
      <video
        ref={videoRef}
        className={styles.video}
        style={{ opacity: glReady ? 0 : 1 }}
        muted
        loop
        playsInline
        preload="none"
        poster={`${MEDIA}/hero-poster.avif`}
        aria-label="DISRUPT showreel, 39 seconds, no sound"
      />
      {!reduced && <HeroCanvas video={videoRef} onReady={onGlReady} />}
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.content}>
        <p className={`t-label ${styles.eyebrow}`} data-hero-in>
          Independent CGI &amp; Creative Studio
        </p>
        <h1 id="hero-title" className={styles.title}>
          <span className="sr-only">DISRUPT: </span>
          <span className={styles.line}>
            <span data-hero-line>Ordinary isn&rsquo;t</span>
          </span>
          <span className={styles.line}>
            <span data-hero-line>our thing.</span>
          </span>
        </h1>
        <p className={styles.sub} data-hero-in>
          CGI and motion studio turning unconventional ideas
          <br />
          into unforgettable visuals.
        </p>
        <div className={styles.actions} data-hero-in>
          <button type="button" className={styles.ghost} onClick={openReel} onPointerEnter={warmReel} onFocus={warmReel}>
            <span className={styles.play} aria-hidden="true" />
            Watch showreel <span className={styles.dur}>1:23</span>
          </button>
          <a
            href="#contact"
            className={styles.solid}
            onClick={(e) => {
              e.preventDefault();
              scrollToId("contact");
            }}
          >
            Start a project <span className={styles.chev} aria-hidden="true" />
          </a>
        </div>
      </div>


      <a
        href="#work"
        className={styles.scrollCue}
        data-hero-in
        onClick={(e) => {
          e.preventDefault();
          scrollToId("work");
        }}
        aria-label="Scroll to the work"
        data-no-roll
      >
        <span className={styles.cueLine} aria-hidden="true" />
        <span className="t-label">Scroll</span>
      </a>

      <span className={styles.progress} aria-hidden="true">
        <span ref={barRef} />
      </span>
    </section>
  );
}
