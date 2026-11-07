"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import gsap from "gsap";
import { frameSrc, mmss, type CaseData } from "@/content/cases";
import { poster } from "@/content/projects";
import { getLenis } from "@/components/providers/lenis-ref";
import { getMedia, useStage } from "@/components/work/stage-store";
import { closeFilm, registerFilmPoster, registerFilmVideo, useFilmPlayer } from "./film-player-store";
import styles from "./player.module.css";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const pad2 = (n: number) => String(n).padStart(2, "0");

// Lights down: the page dims to black and the hero loop crossfades into the full film with sound. The film
// starts at the loop's cover size and settles to its own frame (contain), so the loop seems to become the
// film. Custom controls: chevron play/pause, timecode scrubber, mute, full screen, close (Esc).
// Keyboard: Space/K play-pause, arrows seek 5 s, J/L 10 s, M mute, F full screen, Esc close.
// Opened with openFilm() (film-player-store.ts); mounted once per film case by CaseShell.
// Loading: the film loads on play (its header on hover/focus of a play control, warmFilm). Until it has a
// frame to show, the video holds a poster: the hero's poster from the start, else the clicked frame.
export default function LightsDownPlayer({ data }: { data: CaseData }) {
  const film = data.film!;
  const open = useFilmPlayer((s) => s.open);
  const token = useFilmPlayer((s) => s.token);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [idle, setIdle] = useState(false);
  const [ended, setEnded] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const stageWasPlaying = useRef<HTMLVideoElement | null>(null);
  const idleT = useRef(0);

  // The picture held while the film buffers (set by openFilm before play): the hero poster from the
  // start, the shot's frame from a shot, or the clicked frame (a caller can pass its own).
  useEffect(() => {
    // The hero's own poster file (the stage's, whatever format it chose): already downloaded, no new request.
    const cover = () => {
      const el = getMedia(data.slug);
      return el instanceof HTMLVideoElement && el.getAttribute("poster") ? el.poster : poster(data.slug);
    };
    registerFilmPoster((at) => {
      if (at < 0.25) return cover();
      const shot = data.shots.find((x) => at >= x.in - 0.05 && at < x.out);
      return shot ? frameSrc(data.slug, shot.n, 1600, "webp") : cover();
    });
    return () => registerFilmPoster(null);
  }, [data.slug, data.shots]);

  // Open / close choreography.
  useEffect(() => {
    const dialog = dialogRef.current!;
    const video = videoRef.current!;
    const scrim = scrimRef.current!;
    const ui = uiRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;
    let tl: gsap.core.Timeline | null = null;

    if (open) {
      if (!dialog.open) {
        opener.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
        getLenis()?.stop();
        html.style.overflow = "hidden";
      }
      // The film starts at the size the loop fills the screen (cover) and settles to its own frame.
      const W = innerWidth;
      const H = innerHeight;
      const a = film.width / film.height;
      const fit = W / H > a ? { w: H * a, h: H } : { w: W, h: W / a };
      const cover = Math.max(W / fit.w, H / fit.h);
      tl = gsap.timeline();
      if (reduced) {
        tl.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
        tl.fromTo(video, { opacity: 0, scale: 1 }, { opacity: 1, duration: 0.2 }, 0.1);
        tl.fromTo(ui, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.1);
      } else {
        tl.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.75, ease: "power2.inOut" }, 0);
        tl.fromTo(video, { opacity: 0, scale: cover }, { opacity: 1, duration: 0.7, ease: "power1.inOut" }, 0.2);
        tl.to(video, { scale: 1, duration: 1.1, ease: "expo.inOut" }, 0.35);
        tl.fromTo(ui, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.9);
      }
      // Once the film covers the loop, the loop rests (one video decoding at a time).
      tl.call(() => {
        const active = useStage.getState().active;
        const el = active ? getMedia(active) : null;
        if (el instanceof HTMLVideoElement && !el.paused) {
          el.pause();
          stageWasPlaying.current = el;
        }
      });
      playRef.current?.focus({ preventScroll: true });
    } else if (dialog.open) {
      video.pause();
      const resume = stageWasPlaying.current;
      stageWasPlaying.current = null;
      resume?.play().catch(() => undefined);
      tl = gsap.timeline({
        onComplete: () => {
          dialog.close();
          html.style.overflow = "";
          getLenis()?.start();
          opener.current?.focus?.({ preventScroll: true });
        },
      });
      const d = reduced ? 0.2 : 1;
      tl.to(ui, { opacity: 0, duration: 0.25 * d }, 0);
      tl.to(video, { opacity: 0, duration: 0.45 * d, ease: "power1.in" }, 0);
      tl.to(scrim, { opacity: 0, duration: 0.6 * d, ease: "power2.inOut" }, 0.2 * d);
    }
    return () => {
      tl?.kill();
    };
  }, [open, token, film.width, film.height]);

  // Safety net: leaving the page with the player open.
  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
      if (useFilmPlayer.getState().open) useFilmPlayer.getState().hide();
    },
    [],
  );

  // Playhead: rAF while playing, so the scrubber and timecode move smoothly without re-rendering React.
  useEffect(() => {
    const video = videoRef.current!;
    let raf = 0;
    const draw = () => {
      const d = video.duration || film.duration;
      const t = video.currentTime;
      scrubRef.current?.style.setProperty("--p", String(Math.min(1, t / d)));
      if (video.buffered.length) {
        scrubRef.current?.style.setProperty("--b", String(Math.min(1, video.buffered.end(video.buffered.length - 1) / d)));
      }
      const r = rangeRef.current;
      if (r && document.activeElement !== r) r.value = String(t);
      if (r) r.setAttribute("aria-valuetext", `${mmss(t)} of ${mmss(d)}`);
      if (timeRef.current) timeRef.current.textContent = mmss(t);
      if (!video.paused) raf = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    video.addEventListener("play", start);
    video.addEventListener("seeked", start);
    video.addEventListener("timeupdate", start);
    video.addEventListener("progress", start);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("play", start);
      video.removeEventListener("seeked", start);
      video.removeEventListener("timeupdate", start);
      video.removeEventListener("progress", start);
    };
  }, [film.duration]);

  // Controls hide after a moment of stillness while the film plays (not while a control has focus).
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleT.current);
    idleT.current = window.setTimeout(() => {
      const v = videoRef.current;
      const inBar = uiRef.current?.contains(document.activeElement) && document.activeElement?.matches(":focus-visible");
      if (v && !v.paused && !inBar) setIdle(true);
    }, 2600);
  };
  useEffect(() => () => window.clearTimeout(idleT.current), []);

  const toggle = () => {
    const v = videoRef.current!;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => undefined);
    } else v.pause();
    wake();
  };
  const seekBy = (s: number) => {
    const v = videoRef.current!;
    v.currentTime = Math.min(Math.max(0, v.currentTime + s), (v.duration || film.duration) - 0.05);
    wake();
  };
  const toggleMute = () => {
    const v = videoRef.current!;
    v.muted = !v.muted;
    wake();
  };
  const fullscreen = () => {
    const dialog = dialogRef.current!;
    const v = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else if (dialog.requestFullscreen) dialog.requestFullscreen().catch(() => undefined);
    else v.webkitEnterFullscreen?.();
    wake();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
    wake();
    const t = e.target as HTMLElement;
    const onButton = t.tagName === "BUTTON";
    const onRange = t === rangeRef.current;
    if (e.key === "Tab") {
      // Focus trap: Tab cycles through the player's controls.
      const els = [...dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      const nextI = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === els.length - 1 ? 0 : i + 1;
      e.preventDefault();
      els[nextI].focus();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if ((k === " " && !onButton) || k === "k") {
      e.preventDefault();
      toggle();
    } else if (k === "arrowright" || k === "arrowleft") {
      e.preventDefault();
      seekBy(k === "arrowright" ? 5 : -5);
    } else if (k === "l" || k === "j") {
      seekBy(k === "l" ? 10 : -10);
    } else if (k === "m") {
      toggleMute();
    } else if (k === "f") {
      fullscreen();
    } else if ((k === "home" || k === "end") && !onRange) {
      e.preventDefault();
      seekBy(k === "home" ? -1e6 : 1e6);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={`${data.title}, full film`}
      data-idle={idle || undefined}
      onCancel={(e) => {
        e.preventDefault();
        closeFilm();
      }}
      onClose={() => {
        // Closed by the browser itself (e.g. a second Esc): tidy up without the animation.
        if (!useFilmPlayer.getState().open) return;
        videoRef.current?.pause();
        document.documentElement.style.overflow = "";
        getLenis()?.start();
        stageWasPlaying.current?.play().catch(() => undefined);
        stageWasPlaying.current = null;
        closeFilm();
      }}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      onPointerDown={wake}
      style={{ "--key-ui": data.keyUi } as CSSProperties}
    >
      <div ref={scrimRef} className={styles.scrim} aria-hidden="true" />
      <video
        ref={(el) => {
          videoRef.current = el;
          registerFilmVideo(el);
          return () => registerFilmVideo(null);
        }}
        className={styles.video}
        src={film.src}
        preload="none"
        playsInline
        disablePictureInPicture
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          wake();
        }}
        onPause={() => {
          setPlaying(false);
          setIdle(false);
        }}
        onEnded={() => {
          setEnded(true);
          setIdle(false);
        }}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
      />

      <div ref={uiRef} className={styles.ui}>
        <div className={styles.top}>
          <p className={`t-label ${styles.title}`}>
            <span className={styles.count}>
              {pad2(data.index + 1)} / {pad2(data.total)}
            </span>
            {data.title}
            <span className={styles.dim}> · Full film</span>
          </p>
          <button type="button" className={styles.close} onClick={closeFilm} aria-label="Close film" data-no-roll>
            <span className="t-label">Close</span>
            <span className={styles.x} aria-hidden="true" />
          </button>
        </div>

        {muted && open ? (
          <button type="button" className={`t-label ${styles.soundOff}`} onClick={toggleMute} data-no-roll>
            Sound off · tap to turn on
          </button>
        ) : null}

        <div className={styles.bar}>
          <button
            ref={playRef}
            type="button"
            className={styles.play}
            data-paused={!playing || undefined}
            onClick={toggle}
            aria-label={playing ? "Pause" : ended ? "Play again" : "Play"}
            data-no-roll
          >
            <span />
            <span />
          </button>
          <p className={`t-label ${styles.tc}`} aria-hidden="true">
            <span ref={timeRef}>0:00</span>
            <span className={styles.dim}> / {film.runtime}</span>
          </p>
          <div ref={scrubRef} className={styles.scrub} data-wait={waiting || undefined}>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.buffered} />
              <span className={styles.played} />
              <span className={styles.head} />
            </span>
            <input
              ref={rangeRef}
              className={styles.range}
              type="range"
              min={0}
              max={film.duration}
              step={0.1}
              defaultValue={0}
              aria-label="Seek"
              onInput={(e) => {
                const v = videoRef.current!;
                v.currentTime = Number(e.currentTarget.value);
                wake();
              }}
            />
          </div>
          <button
            type="button"
            className={styles.icon}
            onClick={toggleMute}
            aria-label={muted ? "Turn sound on" : "Mute"}
            aria-pressed={muted}
            data-no-roll
          >
            <span className={styles.speaker} data-muted={muted || undefined} aria-hidden="true" />
          </button>
          <button type="button" className={styles.icon} onClick={fullscreen} aria-label="Full screen" data-no-roll>
            <span className={styles.fs} aria-hidden="true" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
