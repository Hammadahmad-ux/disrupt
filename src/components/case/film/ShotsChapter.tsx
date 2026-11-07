"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { frameSet, frameSrc, lqipOf, mmss, timecode, type CaseData, type ShotTag } from "@/content/cases";
import { Chevron } from "@/components/work/Chevron";
import { openFilm, useFilmPlayer, warmFilm } from "../shared/film-player-store";
import { Picture } from "../shared/Picture";
import { preloadImage, useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import { ShotViewerGL, type ViewerState } from "./shot-viewer-gl";
import { filmVariant } from "./film-variants";
import windowsJson from "./shot-windows.json";
import s from "../shared/shared.module.css";
import f from "./film.module.css";

// "In this shot": a pinned viewer (about 58% of the width, on the project's shotsSide) and a column of
// numbered shot cards that scroll past it. The card on the focus line (mid-screen) is the shot in the
// viewer; changing shot passes the studio light over the frame and leaves the new shot behind it
// (shot-viewer-gl.ts). On desktop the viewer then plays that shot from the film itself, muted, as a
// short loop inside its own cut points (shot-windows.json), and the ruler under it runs the film's
// timecode. Phones: the viewer sticks to the top and the cards scroll under it (frames only, no film).
// Reduced motion: no pin, no light, no film; each card carries its own frame.
// layout.viewer "stage" (desktop): the viewer fills the screen and the cards roll over it on the other side,
// so the chapter plays like a projection rather than a split page (STAGE_MQ, film.module.css).
// Copy on the cards ("built") is draft: // CONFIRM WITH ADIL.
//
// Loading: the frame box shows the shot's blurred stand-in (lqip) from the first paint. The first frame (800 px,
// high priority) is fetched 2.5 screens before the chapter arrives; the canvas only takes over once it holds a
// real picture, and the first light sweep goes from the stand-in to the frame (never from an empty grey panel).
// Later shots: neighbours are fetched ahead; a shot that is not in yet is swept in as its stand-in and sharpens
// the moment its frame lands. Big canvases (stage viewer, retina) then swap in the 1600 px frame.

type Win = [number, number] | null;
const WINDOWS = (windowsJson as unknown as { windows: Record<string, Win[]> }).windows;

const pad2 = (n: number) => String(n).padStart(2, "0");
const TAG: Record<ShotTag, string> = { car: "Car", set: "Set", light: "Light", fx: "FX", camera: "Camera" };
const REDUCED = "(prefers-reduced-motion: reduce)";
/** Where the "stage" viewer applies; keep in sync with the stage block in film.module.css. */
const STAGE_MQ = "(min-width: 900px) and (min-aspect-ratio: 5/4)";
/** Shorter loops read as a twitch, not a shot: those stay stills (with the idle glint). */
const MIN_LOOP = 1.2;
const wait = (ms: number) => new Promise<null>((r) => window.setTimeout(() => r(null), ms));

/** Resolve once the video can show the frame it is parked on (or give up after `ms`). */
function whenReady(v: HTMLVideoElement, ms: number, cb: () => void) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    v.removeEventListener("seeked", check);
    v.removeEventListener("loadeddata", check);
    window.clearTimeout(t);
    cb();
  };
  const check = () => {
    if (v.readyState >= 2 && !v.seeking) finish();
  };
  v.addEventListener("seeked", check);
  v.addEventListener("loadeddata", check);
  const t = window.setTimeout(() => {
    done = true;
    v.removeEventListener("seeked", check);
    v.removeEventListener("loadeddata", check);
  }, ms);
  check();
  return () => {
    done = true;
    v.removeEventListener("seeked", check);
    v.removeEventListener("loadeddata", check);
    window.clearTimeout(t);
  };
}

/** Inline stand-in under a frame box: the blurred shot, cover-cropped like the picture. */
const lqBg = (url: string | undefined): CSSProperties | undefined =>
  url ? { backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

export function ShotsChapter({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLOListElement>(null);
  const headRef = useReveal<HTMLElement>();
  const [active, setActive] = useState(0);
  const shots = data.shots;
  const film = data.film!;
  const dur = film.duration;
  const wide = data.aspect > 2;
  const sh = shots[active] ?? shots[0];
  const headId = `${data.slug}-shots`;
  const { shotsTitle } = filmVariant(data);
  const viewerMode = data.layout.viewer ?? "split";
  // Reduced motion shows a frame on every card: start those a screen and a half early.
  useEagerNear(cardsRef, "150% 0px", data.slug);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const list = data.shots;
    const slug = data.slug;
    const canvas = root.querySelector<HTMLCanvasElement>("[data-gl-canvas]")!;
    const frameEl = root.querySelector<HTMLElement>("[data-frame]")!;
    const video = root.querySelector<HTMLVideoElement>("[data-live]");
    const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")];
    const tcEl = root.querySelector<HTMLElement>("[data-tc]");
    const ruler = root.querySelector<HTMLElement>("[data-ruler]");
    const reduced = matchMedia(REDUCED).matches;
    const narrow = matchMedia("(max-width: 760px)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const wins = (WINDOWS[slug] ?? []).map((w) => (w && w[1] - w[0] >= MIN_LOOP ? w : null));
    const canLive =
      !!video &&
      !reduced &&
      !conn?.saveData &&
      wins.some(Boolean) &&
      matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)").matches;

    let disposed = false;
    let viewer: ShotViewerGL | null = null;
    let visible = false;
    let started = false;
    let glOn = false; // the canvas holds a real frame and is on screen
    let target = 0; // the card on the focus line
    let shown = -1; // the shot the viewer shows, or is sweeping to
    let seq = 0;
    let sweep: gsap.core.Tween | null = null;
    let fade: gsap.core.Tween | null = null;
    const st: ViewerState = { a: "", b: "", p: 1, d: 0, glint: -1, stretch: 1, drift: 0, time: 0 };
    // live loop
    let liveShot = -1;
    let liveKey = "v0";
    let uploading = false;
    let restarting = false;
    let lastVT = -1;
    let cancelWait: (() => void) | null = null;
    // motion
    let lastY = scrollY;
    let lastT = performance.now();
    let vel = 0;
    let idle = 0;
    let tcShown = "";
    let lastSig = ""; // what the canvas last drew (skip identical frames)
    let warmedAll = false;
    const mark = (t: number) => {
      const tc = timecode(t);
      if (tc === tcShown) return;
      tcShown = tc;
      if (tcEl) tcEl.textContent = tc;
      ruler?.style.setProperty("--t", Math.min(1, t / dur).toFixed(4));
    };

    // ---------- frames (textures) ----------
    // Texture keys: "q3" = shot 3's blurred stand-in, "s3" = its frame (800 px first; the 1600 px version is
    // swapped in under the same key when the canvas is big enough to show the difference).
    const frameUrl = (i: number, w: 800 | 1600) => frameSrc(slug, list[i].n, w, "webp");
    const loadLo = (i: number, high = false) => preloadImage(frameUrl(i, 800), { cors: true, high });
    const loadHi = (i: number) => preloadImage(frameUrl(i, 1600), { cors: true });
    const loadLq = (i: number) => {
      const u = lqipOf(data, "frames", list[i].n);
      return u ? preloadImage(u) : Promise.resolve(null);
    };
    const keyOf = (i: number) => `s${i}`;
    const lqKey = (i: number) => `q${i}`;
    const hiImgs = new Map<number, HTMLImageElement>();
    const needHi = () => !narrow && canvas.width > 900;
    const warmAround = (i: number) => {
      for (const j of [i, i + 1, i - 1, i + 2]) if (j >= 0 && j < list.length) loadLo(j);
    };
    /** Shot i's best picture onto the GPU (the 1600 if it is already here). False if WebGL refused it. */
    const uploadShot = (i: number, lo: HTMLImageElement) => !!viewer && viewer.upload(keyOf(i), hiImgs.get(i) ?? lo);
    // The stand-in is ~20 px wide: smoothed onto a small canvas first, so the GPU's stretch reads as a soft
    // blur (as the CSS one does) rather than as soft squares.
    const soften = (im: HTMLImageElement): TexImageSource => {
      const w = 96;
      const h = Math.max(1, Math.round((w * im.naturalHeight) / Math.max(1, im.naturalWidth)));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const x = cv.getContext("2d");
      if (!x) return im;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.filter = "blur(2px)"; // ignored where unsupported: the smoothing alone still helps
      x.drawImage(im, -4, -4, w + 8, h + 8); // overscan, so the blur does not pull dark into the edges
      return cv;
    };
    const uploadLq = (i: number, lq: HTMLImageElement | null) =>
      !!viewer && !!lq && (viewer.has(lqKey(i)) || viewer.upload(lqKey(i), soften(lq)));
    /** Big canvases: fetch the 1600 px frame and swap it in under the same key (a slight sharpening). */
    const upgrade = (i: number) => {
      if (!needHi() || hiImgs.has(i)) return;
      loadHi(i).then((im) => {
        if (!im || disposed || !viewer || hiImgs.has(i)) return;
        hiImgs.set(i, im);
        if (viewer.has(keyOf(i))) {
          viewer.upload(keyOf(i), im);
          lastSig = "";
        }
      });
    };

    const toDom = () => {
      // WebGL gone (or refused a texture): the plain frames take over.
      root.dataset.gl = "off";
      delete root.dataset.live;
      glOn = false;
      stopLive();
      viewer?.dispose();
      viewer = null;
    };

    // ---------- live shot loop (desktop) ----------
    const atIn = (i: number) => {
      const w = wins[i]!;
      return Math.min(w[1] - 0.05, Math.max(w[0], list[i].at));
    };
    const stopLive = () => {
      uploading = false;
      restarting = false;
      liveShot = -1;
      cancelWait?.();
      cancelWait = null;
      if (video && !video.paused) video.pause();
      delete root.dataset.live;
    };
    // Called once the shot's frame is on the GPU: the film's own bytes wait until the picture is in.
    const parkVideo = (i: number) => {
      if (!canLive || !video || !wins[i]) return;
      if (!video.getAttribute("src")) {
        video.crossOrigin = "anonymous";
        video.preload = "metadata"; // seeks fetch what each loop needs, not the whole film
        video.src = film.src;
      }
      try {
        video.currentTime = atIn(i);
      } catch {}
    };
    const playing = () => visible && !useFilmPlayer.getState().open;
    const startLive = (i: number) => {
      if (!canLive || !video || !wins[i] || !viewer || shown !== i || disposed) return;
      const token = seq;
      cancelWait?.();
      cancelWait = whenReady(video, 5000, () => {
        cancelWait = null;
        if (token !== seq || disposed || !viewer || shown !== i) return;
        if (Math.abs(video.currentTime - atIn(i)) > 0.2) return; // parked somewhere else
        // The still on screen is the frame at `at`; the film, parked on the same frame, dissolves in.
        liveKey = liveKey === "v0" ? "v1" : "v0";
        if (!viewer.upload(liveKey, video)) return;
        liveShot = i;
        uploading = true;
        lastVT = video.currentTime;
        st.a = st.b;
        st.b = liveKey;
        st.p = 0;
        st.d = 0;
        fade?.kill();
        fade = gsap.to(st, { d: 1, duration: 0.35, ease: "power1.inOut" });
        root.dataset.live = "";
        if (playing()) video.play().catch(() => undefined);
      });
    };
    const restartLoop = () => {
      if (!video || !viewer || liveShot < 0) return;
      const w = wins[liveShot]!;
      restarting = true;
      video.pause();
      const token = seq;
      // Hold the last frame (A), park the film at the loop start, then dissolve back into it (B).
      const frozen = liveKey;
      liveKey = frozen === "v0" ? "v1" : "v0";
      st.a = frozen;
      st.b = liveKey;
      st.p = 0;
      st.d = 0;
      fade?.kill();
      try {
        video.currentTime = w[0];
      } catch {}
      cancelWait?.();
      cancelWait = whenReady(video, 4000, () => {
        cancelWait = null;
        if (token !== seq || disposed || !viewer || !restarting) return;
        if (!viewer.upload(liveKey, video)) return;
        lastVT = video.currentTime;
        restarting = false;
        // A soft cut back to the top of the shot (a long dissolve would ghost a moving shot).
        fade = gsap.to(st, { d: 1, duration: 0.14, ease: "none" });
        if (playing()) video.play().catch(() => undefined);
      });
    };

    // ---------- shot changes ----------
    // The studio light passes over the frame and leaves `to` behind it. Only a real frame goes on to the loop.
    const sweepTo = (i: number, to: string, from?: string) => {
      const now = from ?? (st.p > 0.5 || st.d > 0.5 ? st.b : st.a);
      sweep?.kill();
      fade?.kill();
      st.a = now;
      st.b = to;
      st.p = 0;
      st.d = 0;
      st.glint = -1;
      idle = 0;
      sweep = gsap.to(st, {
        p: 1,
        duration: narrow ? 0.8 : 0.95,
        ease: "power2.inOut",
        onComplete: () => {
          sweep = null;
          if (st.b === keyOf(i)) startLive(i);
        },
      });
    };
    /** The frame landed while its stand-in was showing: it sharpens in place (a short dissolve), then plays. */
    const sharpen = (i: number) => {
      if (!viewer || shown !== i) return;
      parkVideo(i);
      if (sweep && st.b === lqKey(i)) {
        // Still under the light: the light leaves the frame behind instead.
        st.b = keyOf(i);
        lastSig = "";
        return;
      }
      if (st.b !== lqKey(i)) return;
      fade?.kill();
      st.a = lqKey(i);
      st.b = keyOf(i);
      st.p = 0;
      st.d = 0;
      fade = gsap.to(st, {
        d: 1,
        duration: 0.35,
        ease: "power1.inOut",
        onComplete: () => {
          fade = null;
          startLive(i);
        },
      });
    };
    const show = async (i: number) => {
      if (!viewer || !started || i === shown) return;
      shown = i;
      const token = ++seq;
      // Whatever was playing stops on its current frame (the texture just stops updating).
      stopLive();
      warmAround(i);
      const current = () => !disposed && token === seq && !!viewer;

      if (!glOn) {
        // First paint. The box shows the stand-in until the frame is decoded; then the canvas takes over with
        // that same stand-in and the light sweeps the frame in.
        const [lq, lo] = await Promise.all([loadLq(i), loadLo(i, true)]);
        if (!current()) return;
        if (!lo || !uploadShot(i, lo)) {
          // The frame did not load, or WebGL refused it: the plain <picture> takes over (it may get the AVIF).
          toDom();
          return;
        }
        const hasLq = uploadLq(i, lq);
        glOn = true;
        root.dataset.gl = "on";
        lastSig = "";
        parkVideo(i);
        sweepTo(i, keyOf(i), hasLq ? lqKey(i) : "");
      } else {
        const lo = viewer!.has(keyOf(i)) ? true : await Promise.race([loadLo(i, true), wait(160)]);
        if (!current()) return;
        if (lo) {
          if (lo !== true && !uploadShot(i, lo)) {
            toDom();
            return;
          }
          parkVideo(i);
          sweepTo(i, keyOf(i));
        } else {
          // Not here yet: the light leaves the stand-in now, and the frame sharpens in when it lands.
          const lq = await loadLq(i);
          if (!current()) return;
          if (uploadLq(i, lq)) sweepTo(i, lqKey(i));
          loadLo(i, true).then((im) => {
            if (!im || !current() || shown !== i) return;
            if (!uploadShot(i, im)) {
              toDom();
              return;
            }
            sharpen(i);
          });
        }
      }
      // Big canvases: this shot's 1600 px frame, and the next one's ahead (so it lands sharp, no swap).
      upgrade(i);
      if (i + 1 < list.length) upgrade(i + 1);
      // Desktop: keep the rest coming in the background, one at a time (800 px, a few KB each).
      if (!narrow && !warmedAll) {
        warmedAll = true;
        list.forEach((_, j) => window.setTimeout(() => !disposed && loadLo(j), 400 + j * 120));
      }
    };

    // ---------- WebGL ----------
    // The section renders with data-gl="wait" (the plain picture hidden, its stand-in showing), so the
    // browser does not fetch a frame that WebGL is about to draw anyway.
    if (reduced) root.dataset.gl = "off";
    else {
      try {
        const stage = data.layout.viewer === "stage" && matchMedia(STAGE_MQ).matches;
        viewer = new ShotViewerGL(canvas, {
          // The full-screen stage is a big canvas: a lower cap keeps it cheap.
          dprMax: narrow ? 1.5 : stage ? 1.25 : 1.75,
          aspect: data.aspect,
          primer: "#2e2e33",
          key: data.key,
          onLost: () => toDom(),
        });
        // The canvas stays hidden (the box shows the stand-in) until it holds a real frame.
        root.dataset.gl = "wait";
      } catch {
        viewer = null;
        root.dataset.gl = "off";
      }
    }
    const ro = new ResizeObserver(() => {
      viewer?.resize();
      lastSig = "";
      if (glOn && shown >= 0) upgrade(shown);
    });
    ro.observe(canvas);

    // ---------- observers ----------
    // The focus line: mid-screen on desktop, just under the stuck viewer on phones.
    const cio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.i);
          if (i === target) continue;
          target = i;
          setActive(i);
          if (viewer) show(i);
          else mark(list[i].at);
        }
      },
      { rootMargin: narrow ? "-56% 0px -43% 0px" : "-49% 0px -50% 0px" },
    );
    cards.forEach((c) => cio.observe(c));

    // The viewer on screen: render, play, and the first paint.
    const vio = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !started && e.intersectionRatio >= 0.35) {
          started = true;
          show(target);
        }
        if (!video) return;
        if (!visible) video.pause();
        else if (liveShot >= 0 && !restarting && playing()) video.play().catch(() => undefined);
      },
      { threshold: [0, 0.35, 0.6] },
    );
    vio.observe(frameEl);

    // Fetch the first frame (high priority) and its neighbours well before the chapter arrives, so the
    // first sweep can start the moment the viewer is in view.
    const pio = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || !viewer) return;
        pio.disconnect();
        loadLq(target);
        loadLo(target, true).then(() => {
          if (!disposed) warmAround(target);
        });
      },
      { rootMargin: "250% 0px" },
    );
    pio.observe(root);

    // The lights-down player takes the film: hold the loop while it is open.
    const unsub = useFilmPlayer.subscribe((p) => {
      if (!video) return;
      if (p.open) video.pause();
      else if (liveShot >= 0 && !restarting && visible) video.play().catch(() => undefined);
    });

    // ---------- frame loop ----------
    const tick = () => {
      if (disposed || !viewer || !visible) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const y = scrollY;
      vel += (y - lastY - vel) * Math.min(1, dt * 14);
      lastY = y;
      st.stretch = 1 + Math.min(1.1, Math.abs(vel) * 0.03);

      const r = root.getBoundingClientRect();
      const prog = (innerHeight - r.top) / (r.height + innerHeight);
      st.drift = (Math.min(1, Math.max(0, prog)) - 0.5) * 0.036;

      // Live loop: keep the texture fed, and loop inside the shot's own cut points.
      let fresh = false;
      if (video && liveShot >= 0 && uploading && !restarting) {
        const w = wins[liveShot]!;
        const t = video.currentTime;
        if (t >= w[1] || video.ended) restartLoop();
        else if (t !== lastVT && !video.seeking && video.readyState >= 2) {
          viewer.upload(liveKey, video);
          lastVT = t;
          fresh = true;
        }
      }

      // Idle glint over a still (never over the playing film).
      if (!sweep && liveShot < 0 && started) {
        idle += dt;
        const g = (idle - 2.4) % 6.5;
        st.glint = idle > 2.4 && g < 1.5 ? 0.5 - 0.5 * Math.cos((g / 1.5) * Math.PI) : -1;
      } else st.glint = -1;

      // Timecode and playhead.
      const cur = shown >= 0 ? shown : target;
      mark(liveShot >= 0 && video ? video.currentTime : list[cur].at);

      // Nothing to draw until the canvas holds a real frame (the box shows the stand-in meanwhile).
      if (!glOn) return;
      // Draw only when something moved (a resting still costs nothing).
      const sig = `${st.a}|${st.b}|${st.p.toFixed(4)}|${st.d.toFixed(4)}|${st.glint.toFixed(4)}|${st.stretch.toFixed(3)}|${st.drift.toFixed(4)}`;
      if (!fresh && sig === lastSig) return;
      lastSig = sig;
      st.time = now / 1000;
      viewer.draw(st);
    };
    gsap.ticker.add(tick);

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      cio.disconnect();
      vio.disconnect();
      pio.disconnect();
      ro.disconnect();
      unsub();
      sweep?.kill();
      fade?.kill();
      cancelWait?.();
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      viewer?.dispose();
      viewer = null;
    };
  }, [data, film.src, dur]);

  return (
    <section
      ref={rootRef}
      className={f.chapter}
      data-side={data.layout.shotsSide}
      data-viewer={viewerMode}
      data-gl="wait"
      aria-labelledby={headId}
      style={{ "--ar": data.aspect } as CSSProperties}
    >
      <header ref={headRef} className={f.chapterHead}>
        <div className={f.headMain}>
          <p className={`t-label ${s.kicker} ${s.reveal}`}>
            <Chevron className={s.keyChev} />
            <span>In this shot</span>
            <span className={s.keyNum}>{pad2(shots.length)} shots</span>
          </p>
          <h2 id={headId} className={`${s.h2} ${s.reveal}`} style={{ "--d": 80 } as CSSProperties}>
            {/* CONFIRM WITH ADIL: draft heading */}
            {shotsTitle}
          </h2>
        </div>
        {/* CONFIRM WITH ADIL: chapter note */}
        <div className={`${s.box} ${f.headBox} ${s.reveal}`} style={{ "--d": 160 } as CSSProperties}>
          <span className={s.draft}>Text box · draft copy</span>
          <p className={s.body}>
            What is on screen in each shot, and what was built for it: car, set, light and effects. Select a frame to
            watch the film from that moment.
          </p>
        </div>
      </header>

      <div className={f.shotsGrid}>
        <div className={f.viewerCol}>
          <div className={f.viewerSticky}>
            <div className={f.viewer} data-wide={wide || undefined}>
              <div className={f.slate} aria-hidden="true">
                <span className={`${s.tc} ${f.slateN}`}>
                  Shot <span className={s.keyNum}>{pad2(sh.n)}</span> / {pad2(shots.length)}
                </span>
                <span className={f.slateTitle}>
                  <span key={sh.n} className={f.roll}>
                    {sh.title}
                  </span>
                </span>
                <span className={`${s.tc} ${f.slateTags}`}>{sh.tags.map((t) => TAG[t]).join(" · ")}</span>
              </div>

              <button
                type="button"
                className={f.frame}
                data-frame
                onClick={() => openFilm({ at: sh.in })}
                onPointerEnter={warmFilm}
                onFocus={warmFilm}
                aria-haspopup="dialog"
                aria-label={`Play the film from ${mmss(sh.in)}: ${sh.title}`}
                style={lqBg(lqipOf(data, "frames", sh.n))}
              >
                <video data-live className={f.live} muted playsInline preload="none" disablePictureInPicture aria-hidden="true" />
                <Picture
                  key={sh.n}
                  className={f.still}
                  set={frameSet(data.slug, sh.n)}
                  w={sh.w}
                  h={sh.h}
                  alt=""
                  sizes="(max-width: 760px) 100vw, 56vw"
                  lqip={lqipOf(data, "frames", sh.n)}
                />
                <canvas data-gl-canvas className={f.canvas} aria-hidden="true" />
                <span className={f.framePlay} aria-hidden="true">
                  <span className={f.ring}>
                    <Chevron className={s.keyChev} />
                  </span>
                  Play from {mmss(sh.in)}
                </span>
              </button>

              <div
                className={f.ruler}
                data-ruler
                aria-hidden="true"
                style={{ "--t": Math.min(1, shots[0].at / dur).toFixed(4) } as CSSProperties}
              >
                <span className={f.tally} />
                <span className={`${s.tc} ${s.keyNum} ${f.tcNow}`} data-tc>
                  {timecode(shots[0].at)}
                </span>
                <span className={f.track}>
                  {shots.map((x, i) => (
                    <i
                      key={x.n}
                      className={f.seg}
                      data-on={i === active || undefined}
                      style={{ left: `${(x.in / dur) * 100}%`, width: `${((x.out - x.in) / dur) * 100}%` }}
                    />
                  ))}
                  <span className={f.headWrap}>
                    <span className={f.playhead} />
                  </span>
                </span>
                <span className={`${s.tc} ${f.tcEnd}`}>{timecode(dur)}</span>
              </div>
            </div>
          </div>
        </div>

        <ol ref={cardsRef} className={f.cards}>
          {shots.map((x, i) => (
            <li key={x.n} className={f.card} data-card data-i={i} data-on={i === active || undefined}>
              <span className={`${s.keyRule} ${f.cardMark}`} aria-hidden="true" />
              <div className={`${s.media} ${f.cardPic}`} style={{ "--ar": x.w / x.h } as CSSProperties}>
                <Picture
                  set={frameSet(data.slug, x.n)}
                  w={x.w}
                  h={x.h}
                  alt=""
                  sizes="(max-width: 760px) 100vw, 56vw"
                  lqip={lqipOf(data, "frames", x.n)}
                />
              </div>
              <div className={f.cardText}>
                <div className={f.cardTop}>
                  <span className={f.num} aria-hidden="true">
                    {pad2(x.n)}
                  </span>
                  <span className={`${s.tc} ${s.keyNum} ${f.cardTc}`}>
                    <span className={f.srOnly}>Timecode </span>
                    {timecode(x.in)} <Chevron /> {timecode(x.out)}
                  </span>
                </div>
                <div className={f.dim}>
                  <h3 className={f.cardTitle}>
                    <span className={f.srOnly}>Shot {x.n}: </span>
                    {x.title}
                  </h3>
                  {/* CONFIRM WITH ADIL: what DISRUPT built in this shot */}
                  <div className={`${s.box} ${f.builtBox}`}>
                    <span className={s.draft}>Draft</span>
                    <p>{x.built}</p>
                  </div>
                  <div className={f.cardFoot}>
                    <ul className={f.tags} aria-label="What was built">
                      {x.tags.map((t) => (
                        <li key={t} className="t-label">
                          {TAG[t]}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={`t-label ${f.playFrom}`}
                      onClick={() => openFilm({ at: x.in })}
                      onPointerEnter={warmFilm}
                      onFocus={warmFilm}
                      aria-haspopup="dialog"
                      aria-label={`Play the film from ${mmss(x.in)}: ${x.title}`}
                    >
                      <span className={f.ring} aria-hidden="true">
                        <Chevron className={s.keyChev} />
                      </span>
                      Play from {mmss(x.in)}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
