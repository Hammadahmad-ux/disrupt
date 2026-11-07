"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { openReel, useReelPlayer } from "@/components/reel-player/reel-player-store";
import { MEDIA } from "@/content/projects";
import { REEL_CREDITS, REEL_DURATION, creditAt } from "@/content/reel";
import type { ReelGL, ReelUniforms } from "./reel-gl";
import styles from "./reel.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Showreel section. A curved, twisted "cinema screen" carrying the muted reel rises with the page,
// straightens and grows into a near full-bleed frame while the stage is held; PLAY and REEL slide in
// from the frame edges around a round glass button. The whole frame is one real button that opens
// the full reel with sound. The screen flexes with scroll speed and leans a little toward the mouse.
// Without WebGL the same motion runs on the DOM frame (tilt only); reduced motion gets a still frame.

type Shape = {
  size: number; // 0 = small card, 1 = full frame
  bend: number; // cinema-screen curve, as a share of the width
  twist: number;
  rx: number;
  ry: number;
  rz: number;
  ox: number; // offset from the frame centre, share of the stage
  oy: number;
  life: number; // projector warm-up, grey -> colour
  sweep: number; // reflection band position
  dim: number; // legibility pool behind the words
  exit: number; // 0..1 while the section scrolls away
};

const REST: Shape = { size: 1, bend: 0, twist: 0, rx: 0, ry: 0, rz: 0, ox: 0, oy: 0, life: 1, sweep: 1.6, dim: 0.38, exit: 0 };
const START_DESKTOP: Shape = { size: 0, bend: 0.2, twist: 0.42, rx: -0.42, ry: 0.36, rz: -0.07, ox: 0.05, oy: 0.12, life: 0, sweep: -0.4, dim: 0, exit: 0 };
const START_MOBILE: Shape = { size: 0, bend: 0.16, twist: 0.36, rx: -0.36, ry: 0.3, rz: -0.06, ox: 0.02, oy: 0.08, life: 0, sweep: -0.4, dim: 0, exit: 0 };

const REDUCED = "(prefers-reduced-motion: reduce)";
const PHONE = "(max-width: 700px)";

const fmt = (s: number) => `0:${String(Math.min(Math.floor(s), 59)).padStart(2, "0")}`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The ">" notch from the logo's R: the play mark and, thinner, the corner marks.
function Chevron({ className, thin = false, corner }: { className?: string; thin?: boolean; corner?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-c={corner} data-mark={corner ? "" : undefined}>
      <path d={thin ? "M7 3h5l9 9-9 9H7l9-9z" : "M4 2h8l10 10-10 10H4l10-10z"} />
    </svg>
  );
}

const letters = (word: string) =>
  word.split("").map((c, i) => (
    <span key={i} className={styles.char} data-ch="">
      {c}
    </span>
  ));

export default function ReelSection() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);
  const creditRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const shape = useRef<Shape>({ ...REST });

  // Scroll choreography (scrubbed). Timeline units are viewport heights of scroll, so they line up
  // with the section height in reel.module.css (250svh desktop, 220svh phone).
  useGSAP(
    () => {
      const root = rootRef.current!;
      const frame = frameRef.current!;
      const S = shape.current;
      const mm = gsap.matchMedia();
      mm.add({ phone: PHONE, motion: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
        const { phone, motion } = ctx.conditions as { phone: boolean; motion: boolean };
        if (!motion) {
          Object.assign(S, REST);
          root.dataset.live = "on";
          return;
        }
        Object.assign(S, phone ? START_MOBILE : START_DESKTOP);
        const TOTAL = phone ? 2.2 : 2.5;
        const E = 1; // rising in, stage not yet held
        const M = phone ? 0.78 : 0.92; // held: straighten + grow
        const q = gsap.utils.selector(root);
        const left = q('[data-side="l"] [data-ch]');
        const right = q('[data-side="r"] [data-ch]');
        const marks = q("[data-mark]");
        const away = (dir: number) => () => dir * frame.offsetWidth * (phone ? 1.05 : 0.6);

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const live = self.progress * TOTAL > E + M * 0.6 ? "on" : "off";
              if (root.dataset.live !== live) root.dataset.live = live;
            },
          },
        });

        // The screen: unbends while it rises, then grows into the frame once held.
        tl.to(S, { bend: 0, twist: 0, rx: 0, ry: 0, rz: 0, duration: E + M * 0.85 - 0.12, ease: "power2.inOut" }, 0.12)
          .to(S, { ox: 0, oy: 0, duration: E + M * 0.8, ease: "power2.inOut" }, 0)
          .to(S, { size: 1, duration: M + 0.3, ease: "power2.inOut" }, E - 0.3)
          .to(S, { life: 1, duration: E + M * 0.6 - 0.2, ease: "power1.inOut" }, 0.2)
          .to(S, { sweep: 1.6, duration: E + M, ease: "sine.inOut" }, 0)
          .to(S, { dim: 0.38, duration: M * 0.45, ease: "power1.inOut" }, E + M * 0.5);

        // Staggered fromTo tweens only pre-set their first target, so park every letter and mark first.
        gsap.set(left, { x: away(-1), skewX: -16 });
        gsap.set(right, { x: away(1), skewX: 16 });
        gsap.set(marks, { autoAlpha: 0 });

        // PLAY and REEL slide in from the frame edges, letter by letter, leading letters first.
        const word = { duration: M * 0.5, ease: "power3.out" };
        tl.fromTo(left, { x: away(-1), skewX: -16 }, { ...word, x: 0, skewX: 0, stagger: { each: M * 0.045, from: "end" } }, E + M * 0.46)
          .fromTo(right, { x: away(1), skewX: 16 }, { ...word, x: 0, skewX: 0, stagger: { each: M * 0.045, from: "start" } }, E + M * 0.46);

        // The glass button spins in; the corner marks lock on; labels settle.
        tl.fromTo(q("[data-glass]"), { scale: 0.25, rotate: -140, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: M * 0.42, ease: "back.out(1.5)" }, E + M * 0.56)
          .fromTo(
            marks,
            { autoAlpha: 0, scale: 0.5, x: (i: number) => [26, -26, -26, 26][i], y: (i: number) => [26, 26, -26, -26][i] },
            { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: M * 0.3, ease: "power3.out", stagger: M * 0.03 },
            E + M * 0.72,
          )
          .fromTo(q("[data-tag]"), { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: M * 0.25, ease: "power2.out" }, E + M * 0.8)
          .fromTo(q("[data-caption]"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: M * 0.3, ease: "power2.out" }, E + M * 0.7)
          .set({}, {}, TOTAL);

        // Leaving: the screen recedes and dims a little, the title drifts apart and fades before it
        // reaches the header.
        gsap
          .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: root, start: "bottom bottom", end: "bottom top", scrub: true } })
          .to(S, { exit: 1, duration: 1 }, 0)
          .to(q('[data-side="l"]'), { xPercent: -14, duration: 1 }, 0)
          .to(q('[data-side="r"]'), { xPercent: 14, duration: 1 }, 0)
          .to(q("[data-side], [data-face]"), { autoAlpha: 0, duration: 0.24, ease: "power1.in" }, 0.1);
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  // Engine: video only while near, WebGL screen (lazy), render loop, live caption, pointer feel.
  useEffect(() => {
    const root = rootRef.current!;
    const stage = stageRef.current!;
    const frame = frameRef.current!;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const hit = hitRef.current!;
    const creditEl = creditRef.current!;
    const tcEl = tcRef.current!;
    const segs = Array.from(stripRef.current!.children) as HTMLElement[];
    const fills = segs.map((s) => s.firstElementChild as HTMLElement);
    const reduced = matchMedia(REDUCED).matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

    let gl: ReelGL | null = null;
    let glTried = false;
    let disposed = false;
    let near = false;
    let stageW = 1;
    let stageH = 1;
    let fw = 1;
    let fh = 1;
    let fcx = 0;
    let fcy = 0;
    let radius = 12;
    let phone = false;

    const measure = () => {
      stageW = stage.clientWidth || 1;
      stageH = stage.clientHeight || 1;
      fw = frame.offsetWidth || 1;
      fh = frame.offsetHeight || 1;
      fcx = frame.offsetLeft + fw / 2 - stageW / 2;
      fcy = stageH / 2 - (frame.offsetTop + fh / 2);
      radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 12;
      phone = matchMedia(PHONE).matches;
      gl?.resize(stageW, stageH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);

    // Playback is tighter than "near": the screen warms up early, the video only plays while visible.
    let seen = false;
    const play = () => {
      if (reduced || !seen || useReelPlayer.getState().open) return;
      video.play().catch(() => undefined);
    };

    const onVideoData = () => gl?.useVideo();
    video.addEventListener("loadeddata", onVideoData);

    const ensureGL = () => {
      if (glTried || reduced) return;
      glTried = true;
      import("./reel-gl")
        .then(({ ReelGL }) => {
          if (disposed) return;
          try {
            gl = new ReelGL(canvas, video, `${MEDIA}/hero-poster.webp`, radius);
          } catch {
            gl = null;
            return;
          }
          measure();
          if (video.readyState >= 2) gl.useVideo();
          root.dataset.gl = "on";
          frame.style.transform = "";
        })
        .catch(() => undefined);
    };

    const onLost = (e: Event) => {
      e.preventDefault();
      gl = null;
      root.dataset.gl = "off";
    };
    canvas.addEventListener("webglcontextlost", onLost);

    const io = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        if (near) {
          ensureGL();
          if (!reduced && video.preload === "none") video.preload = "auto";
        }
      },
      { rootMargin: "80% 0px 80% 0px" },
    );
    io.observe(root);
    const playIo = new IntersectionObserver(
      ([entry]) => {
        seen = entry.isIntersecting;
        if (seen) play();
        else video.pause();
      },
      { rootMargin: "8% 0px 8% 0px" },
    );
    playIo.observe(root);

    // The full player takes over: pause the preview, resume when it closes.
    const unsub = useReelPlayer.subscribe((s) => (s.open ? video.pause() : play()));

    // Pointer: the screen leans a little toward the mouse.
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
    };
    if (fine && !reduced) window.addEventListener("pointermove", onMove, { passive: true });

    // Live caption: timecode, the project on screen and the edit strip.
    let lastSec = -1;
    let lastTitle = "";
    let lastOn = -1;
    const lastFill = fills.map(() => -1);
    const caption = () => {
      const t = video.currentTime || 0;
      const sec = Math.floor(t);
      if (sec !== lastSec) {
        lastSec = sec;
        tcEl.textContent = fmt(sec);
      }
      const c = creditAt(t);
      if (c.title !== lastTitle) {
        lastTitle = c.title;
        creditEl.textContent = c.title;
      }
      let on = 0;
      REEL_CREDITS.forEach((s, i) => {
        const f = Math.round(clamp01((t - s.from) / (s.to - s.from)) * 1000) / 1000;
        if (t >= s.from && t < s.to) on = i;
        if (f !== lastFill[i]) {
          lastFill[i] = f;
          fills[i].style.transform = `scaleX(${f})`;
        }
      });
      if (on !== lastOn) {
        if (lastOn >= 0) segs[lastOn].removeAttribute("data-on");
        segs[on].setAttribute("data-on", "");
        lastOn = on;
      }
    };

    // Render loop on GSAP's ticker (same clock as Lenis + ScrollTrigger).
    let lastY = window.scrollY;
    let vel = 0;
    let flex = 0;
    let flexV = 0;
    let tiltX = 0;
    let tiltY = 0;
    let clipped = false;
    let scaled = false;
    let cssApplied = false;
    const u: ReelUniforms = { resW: 1, resH: 1, w: 1, h: 1, ox: 0, oy: 0, bend: 0, bow: 0, twist: 0, rx: 0, ry: 0, rz: 0, life: 1, sweep: 2, dim: 0, alpha: 1 };

    const tick = (_time: number, deltaMs: number) => {
      if (!near) return;
      caption();
      if (reduced) return;
      const dt = Math.min(Math.max(deltaMs / 1000, 0.001), 0.05);

      // Scroll speed -> a damped spring, so the screen flexes when you scroll fast and settles after.
      const y = window.scrollY;
      const v = (y - lastY) / dt;
      lastY = y;
      vel += (v - vel) * Math.min(1, dt * 12);
      const target = Math.max(-1, Math.min(1, vel / 2600));
      flexV += ((target - flex) * 150 - flexV * 14) * dt;
      flex += flexV * dt;
      tiltX += (py * 0.07 - tiltX) * Math.min(1, dt * 3);
      tiltY += (px * 0.1 - tiltY) * Math.min(1, dt * 3);

      const S = shape.current;
      const e = S.exit;
      const startW = fw * (phone ? 0.86 : 0.5);
      const startH = startW / (16 / 9);
      const shrink = 1 - 0.07 * e;
      const baseW = startW + (fw - startW) * S.size;
      const baseH = startH + (fh - startH) * S.size;
      const w = baseW * shrink;
      const h = baseH * shrink;
      const dx = S.ox * stageW;
      const dy = S.oy * stageH;

      // The DOM layer (words, marks) recedes with the screen on the way out.
      if (e > 0.0005) {
        hit.style.transform = `scale(${shrink.toFixed(4)})`;
        scaled = true;
      } else if (scaled) {
        hit.style.transform = "";
        scaled = false;
      }

      if (gl) {
        u.resW = stageW;
        u.resH = stageH;
        u.w = w;
        u.h = h;
        u.ox = fcx + dx;
        u.oy = fcy + dy;
        u.bend = (S.bend + Math.abs(flex) * 0.022) * w;
        u.bow = Math.abs(flex) * 0.035 * h;
        u.twist = S.twist;
        u.rx = S.rx + flex * 0.05 + tiltX;
        u.ry = S.ry + tiltY;
        u.rz = S.rz;
        u.life = S.life * (1 - 0.3 * e);
        u.sweep = S.sweep;
        u.dim = S.dim;
        gl.render(u);

        // Keep the words inside the screen while it is still growing.
        const l = (fw - baseW) / 2 + dx;
        const r = (fw - baseW) / 2 - dx;
        const t = (fh - baseH) / 2 - dy;
        const b = (fh - baseH) / 2 + dy;
        if (Math.max(Math.abs(l), Math.abs(r), Math.abs(t), Math.abs(b)) > 0.5) {
          hit.style.clipPath = `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${radius}px)`;
          clipped = true;
        } else if (clipped) {
          hit.style.clipPath = "";
          clipped = false;
        }
      } else {
        // CSS fallback: tilt and scale the DOM frame (no bend).
        const s = (w / fw).toFixed(4);
        frame.style.transform = `translate3d(${dx.toFixed(1)}px, ${(-dy).toFixed(1)}px, 0) perspective(1600px) rotateX(${(-(S.rx + flex * 0.05 + tiltX)).toFixed(4)}rad) rotateY(${(S.ry + tiltY).toFixed(4)}rad) rotateZ(${(-S.rz).toFixed(4)}rad) scale(${s})`;
        frame.style.setProperty("--sweep", `${((S.sweep - 0.5) * 120).toFixed(1)}%`);
        cssApplied = true;
      }
    };
    gsap.ticker.add(tick);

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      io.disconnect();
      playIo.disconnect();
      ro.disconnect();
      unsub();
      window.removeEventListener("pointermove", onMove);
      video.removeEventListener("loadeddata", onVideoData);
      canvas.removeEventListener("webglcontextlost", onLost);
      video.pause();
      if (cssApplied) frame.style.transform = "";
      hit.style.transform = "";
      hit.style.clipPath = "";
      gl?.dispose();
      gl = null;
    };
  }, []);

  // Magnetic glass button: it drifts toward the pointer inside the frame.
  const onHitMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const g = glassRef.current;
    if (!g) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = Math.max(-34, Math.min(34, (e.clientX - (r.left + r.width / 2)) * 0.06));
    const my = Math.max(-26, Math.min(26, (e.clientY - (r.top + r.height / 2)) * 0.08));
    g.style.setProperty("--mx", `${mx.toFixed(1)}px`);
    g.style.setProperty("--my", `${my.toFixed(1)}px`);
  };
  const onHitLeave = () => {
    const g = glassRef.current;
    if (!g) return;
    g.style.setProperty("--mx", "0px");
    g.style.setProperty("--my", "0px");
  };

  return (
    <section ref={rootRef} id="reel" className={styles.section} aria-labelledby="reel-title" data-live="on" data-gl="off">
      <h2 id="reel-title" className="sr-only">
        Showreel
      </h2>
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div ref={frameRef} className={styles.frame}>
          <div className={styles.media} aria-hidden="true">
            <video
              ref={videoRef}
              className={styles.video}
              muted
              loop
              playsInline
              preload="none"
              poster={`${MEDIA}/hero-poster.webp`}
              tabIndex={-1}
            >
              <source src={`${MEDIA}/hero-1080.av1.mp4`} type='video/mp4; codecs="av01.0.08M.10"' />
              <source src={`${MEDIA}/hero-1080.hevc.mp4`} type='video/mp4; codecs="hvc1.2.4.L120.B0"' />
              <source src={`${MEDIA}/hero-1080.h264.mp4`} type='video/mp4; codecs="avc1.640029"' />
            </video>
          </div>

          <button
            ref={hitRef}
            type="button"
            className={styles.hit}
            aria-label="Play the showreel with sound"
            onClick={openReel}
            onPointerMove={onHitMove}
            onPointerLeave={onHitLeave}
          >
            <span className={styles.word} data-side="l" aria-hidden="true">
              {letters("Play")}
            </span>
            <span className={styles.glassWrap} data-glass="" aria-hidden="true">
              <span ref={glassRef} className={styles.glass} data-face="">
                <Chevron className={styles.chev} />
              </span>
            </span>
            <span className={styles.word} data-side="r" aria-hidden="true">
              {letters("Reel")}
            </span>
            {(["tl", "tr", "br", "bl"] as const).map((c) => (
              <Chevron key={c} className={styles.mark} thin corner={c} />
            ))}
            <span className={styles.tag} data-tag="" aria-hidden="true">
              <span className={styles.tagDot} />
              Muted preview
            </span>
          </button>
        </div>

        <div className={styles.caption} data-caption="">
          <p>
            Showreel<span className={styles.sep}>·</span>
            {fmt(REEL_DURATION)}
            <span className={styles.sep}>·</span>
            <span className={styles.dim}>Sound on</span>
          </p>
          <div ref={stripRef} className={styles.strip} aria-hidden="true">
            {REEL_CREDITS.map((c) => (
              <span key={c.from} className={styles.seg} style={{ flexGrow: c.to - c.from }}>
                <span className={styles.fill} />
              </span>
            ))}
          </div>
          <p className={styles.right} aria-hidden="true">
            <span className={`${styles.dim} ${styles.wide}`}>In this shot</span>
            <span ref={creditRef} className={styles.credit}>
              {REEL_CREDITS[0].title}
            </span>
            <span className={styles.tc}>
              <span ref={tcRef}>0:00</span>
              <span className={`${styles.dim} ${styles.wide}`}> / {fmt(REEL_DURATION)}</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
