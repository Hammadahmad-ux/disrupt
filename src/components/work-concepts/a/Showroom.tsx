"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { getLenis } from "@/components/providers/lenis-ref";
import { CARS, pad2 } from "./showroom-data";
import { COUNT, ShowroomGL, type PanelRect } from "./showroom-gl";
import s from "./showroom.module.css";

// SHOWROOM: the work page as a car turntable. Scroll (or drag, or pick a shape in the strip) turns the
// ring; the car at the front is big, lit and named. One sticky stage, STEP_VH of scroll per car, and the
// ring snaps to the nearest car when the scroll comes to rest.

const STEP_VH = 62;
const LAST = COUNT - 1;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Mode = "view" | "turn" | null;

export default function Showroom() {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const degRef = useRef<HTMLSpanElement>(null);
  const progRef = useRef<HTMLSpanElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const api = useRef<{ goTo: (i: number) => void } | null>(null);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [gl, setGl] = useState<"pending" | "ok" | "off">("pending");
  const [media, setMedia] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const stage = stageRef.current!;
    const hit = hitRef.current!;
    const chip = chipRef.current!;
    const small = matchMedia("(max-width: 767px)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The site intro waits for the nine pictures (a loader task); the ring spins in once both the
    // pictures and the intro are done.
    const intro0 = useIntro.getState();
    const track = !intro0.done;
    if (track) intro0.register("showroom", 2);
    let texturesReady = false;
    let introDone = intro0.done;
    let begun = false;
    const begin = () => {
      if (begun || !texturesReady || !introDone || !view) return;
      begun = true;
      setGl("ok");
      const o = { v: 0 };
      gsap.to(o, { v: 1, duration: reduce ? 0.01 : 1.2, ease: "power2.out", onUpdate: () => view?.setReady(o.v) });
      if (!reduce) gsap.fromTo(intro, { v: 2.6 }, { v: 0, duration: 2.8, ease: "expo.out" });
      sweep(cur, 1, 1.0);
    };
    const onIntroDone = () => {
      introDone = true;
      begin();
    };
    window.addEventListener(INTRO_DONE_EVENT, onIntroDone);

    let view: ShowroomGL | null = null;
    try {
      view = new ShowroomGL(canvasRef.current!, {
        images: CARS.map((c) => (small ? c.imageSm : c.image)),
        labels: CARS.map((c, i) => `${pad2(i + 1)}`),
        small,
        onProgress: (p) => track && useIntro.getState().report("showroom", p),
        onReady: () => {
          texturesReady = true;
          begin();
        },
      });
    } catch {
      if (track) useIntro.getState().report("showroom", 1);
      requestAnimationFrame(() => setGl("off")); // no WebGL: plain picture of the front car
    }

    // ---------- layout ----------
    let top = 0;
    let step = 1;
    let rect: PanelRect = { cx: 0, cy: 0, width: 1, height: 1 };
    const measure = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      step = (h * STEP_VH) / 100;
      root.style.setProperty("--run", `${step * LAST + h}px`);
      top = root.getBoundingClientRect().top + window.scrollY;
      const mob = w < 768;
      const width = mob ? Math.min(w * 0.76, 420) : Math.min(w * 0.5, (h * 0.44 * 16) / 9, 940);
      const cy = mob ? h * 0.42 : h * 0.405;
      rect = { cx: w / 2, cy, width, height: (width * 9) / 16 };
      stage.style.setProperty("--fw", `${width}px`);
      stage.style.setProperty("--fh", `${rect.height}px`);
      stage.style.setProperty("--fy", `${cy}px`);
      view?.layout(w, h, rect, Math.min(window.devicePixelRatio || 1, mob ? 2 : 1.75));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);

    // ---------- scroll -> ring ----------
    const intro = { v: reduce ? 0 : 2.6 }; // the ring spins in on arrival
    let disp = clamp((window.scrollY - top) / step, 0, LAST);
    let prevRot = disp + intro.v;
    let cur = Math.round(disp);
    let dragging = false;
    let snapping = false;
    let lastScroll = performance.now();
    let snapTimer = 0;

    const scrollToY = (y: number, duration: number) => {
      const l = getLenis();
      if (l) l.scrollTo(y, duration === 0 ? { immediate: true, force: true } : { duration, force: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
      else window.scrollTo({ top: y, behavior: duration === 0 || reduce ? "auto" : "smooth" });
    };
    const snapTo = (y: number, duration: number) => {
      snapping = true;
      scrollToY(y, duration);
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => (snapping = false), duration * 1000 + 120);
    };
    const goTo = (i: number) => {
      const from = Math.round(clamp((window.scrollY - top) / step, 0, LAST));
      snapTo(top + clamp(i, 0, LAST) * step, reduce ? 0 : 0.9 + Math.min(Math.abs(i - from), 6) * 0.12);
    };
    api.current = { goTo };

    const onScroll = () => (lastScroll = performance.now());
    const onInput = () => {
      snapping = false;
      lastScroll = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onInput, { passive: true });
    window.addEventListener("touchstart", onInput, { passive: true });

    // ---------- light sweep + key colour ----------
    const sweepObj = { v: -2 };
    let sweepIdx = 0;
    const flash = { v: 0 };
    function sweep(i: number, dir: number, delay = 0) {
      if (!view || reduce) return;
      const u = view.uniforms[sweepIdx];
      u.uSweep.value = -2;
      sweepIdx = i;
      view.uniforms[i].uSweepDir.value = dir;
      gsap.killTweensOf(sweepObj);
      gsap.fromTo(
        sweepObj,
        { v: -1.25 },
        {
          v: 1.25,
          duration: 1.5,
          delay,
          ease: "power2.inOut",
          onUpdate: () => {
            if (!view) return;
            view.uniforms[i].uSweep.value = sweepObj.v;
            view.invalidate();
          },
        },
      );
      gsap.killTweensOf(flash);
      gsap.fromTo(flash, { v: 0 }, { v: 1, duration: 0.5, delay: delay + 0.25, yoyo: true, repeat: 1, ease: "sine.inOut", onUpdate: () => {
        stage.style.setProperty("--flash", flash.v.toFixed(3));
        view?.setKey(CARS[i].key, flash.v);
      } });
    }

    // ---------- hover media (6 s loop for films, a stills cycle for stills projects) ----------
    let mediaIdx = -1;
    let video: HTMLVideoElement | null = null;
    let stillTimer = 0;
    let hoverTimer = 0;
    const mix = { a: 0, b: 0 };
    const mixTo = (key: "a" | "b", v: number, duration: number) =>
      gsap.to(mix, {
        [key]: v,
        duration,
        ease: "power2.inOut",
        overwrite: "auto",
        onUpdate: () => {
          if (!view || mediaIdx < 0) return;
          view.uniforms[mediaIdx].uMixA.value = mix.a;
          view.uniforms[mediaIdx].uMixB.value = mix.b;
          view.invalidate();
        },
      });
    const stopMedia = () => {
      window.clearTimeout(hoverTimer);
      window.clearInterval(stillTimer);
      if (mediaIdx < 0) return;
      const i = mediaIdx;
      const v = video;
      video = null;
      setMedia(null);
      gsap.killTweensOf(mix);
      gsap.to(mix, {
        a: 0,
        duration: 0.35,
        onUpdate: () => {
          if (!view) return;
          view.uniforms[i].uMixA.value = mix.a;
          view.invalidate();
        },
        onComplete: () => {
          mix.b = 0;
          if (view) {
            view.uniforms[i].uMixB.value = 0;
            view.setMedia(i, "A", null);
            view.setMedia(i, "B", null);
          }
          v?.pause();
          v?.removeAttribute("src");
          v?.load();
          if (mediaIdx === i) mediaIdx = -1;
        },
      });
      mediaIdx = -1;
    };
    const startMedia = (i: number) => {
      if (!view || mediaIdx === i || reduce) return;
      stopMedia();
      mediaIdx = i;
      const car = CARS[i];
      if (car.hover.kind === "loop") {
        const v = document.createElement("video");
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        const src = car.hover.sources.find((x) => v.canPlayType(x.type)) ?? car.hover.sources[car.hover.sources.length - 1];
        v.src = src.src;
        video = v;
        v.addEventListener(
          "playing",
          () => {
            if (mediaIdx !== i || !view) return;
            view.setMedia(i, "A", view.videoTexture(v));
            mixTo("a", 1, 0.6);
            setMedia("Film loop · 6 s");
          },
          { once: true },
        );
        v.play().catch(() => {});
      } else {
        const srcs = car.hover.srcs;
        let n = 1; // still 01 is close to the cover, start from 02
        let layer: "A" | "B" = "A";
        const show = () => {
          const loader = new Image();
          const src = srcs[n % srcs.length];
          const label = `Still ${pad2((n % srcs.length) + 1)} / ${pad2(srcs.length)}`;
          n++;
          loader.onload = () => {
            if (mediaIdx !== i || !view) return;
            const tex = view.imageTexture(loader);
            view.setMedia(i, layer, tex);
            if (layer === "A" && mix.a < 0.5) mixTo("a", 1, 0.7);
            else mixTo("b", layer === "B" ? 1 : 0, 0.8);
            layer = layer === "A" ? "B" : "A";
            setMedia(label);
          };
          loader.src = src;
        };
        show();
        stillTimer = window.setInterval(() => {
          if (mediaIdx !== i) return;
          // after the first fade A is on top; alternate B / A from here
          show();
        }, 1700);
      }
    };

    // ---------- pointer: drag to turn, click to open, hover to preview ----------
    let downX = 0;
    let downScroll = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let moved = 0;
    let pointerId = -1;
    let px = -1;
    let py = -1;
    const dragUnit = () => rect.width * 0.6; // px of drag per car

    // Preview media starts only from a real pointer move, so a car that turns in under a resting
    // cursor keeps showing its clear picture.
    const updateMode = (fromPointer: boolean) => {
      if (!view || px < 0 || dragging) return;
      const i = view.pick(px, py);
      const m: Mode = i < 0 ? null : i === cur ? "view" : "turn";
      setMode(m);
      const settled = Math.abs(disp - cur) < 0.02 && Math.abs(intro.v) < 0.02;
      if (m === "view" && settled) {
        if (mediaIdx !== cur && fromPointer) {
          window.clearTimeout(hoverTimer);
          const want = cur;
          hoverTimer = window.setTimeout(() => want === cur && startMedia(want), 220);
        }
      } else if (mediaIdx >= 0 && m !== "view") stopMedia();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = 0;
      downX = lastX = e.clientX;
      lastT = e.timeStamp;
      vx = 0;
      downScroll = window.scrollY;
      pointerId = e.pointerId;
      snapping = false;
      chip.dataset.down = "1";
    };
    const onMove = (e: PointerEvent) => {
      const b = stage.getBoundingClientRect();
      px = e.clientX - b.left;
      py = e.clientY - b.top;
      chip.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      if (dragging && e.pointerId === pointerId) {
        const dx = e.clientX - downX;
        if (moved < 6 && Math.abs(dx) >= 6) {
          hit.setPointerCapture(e.pointerId);
          stopMedia();
          setMode("turn");
        }
        moved = Math.max(moved, Math.abs(dx));
        if (moved >= 6) {
          const y = clamp(downScroll - (dx / dragUnit()) * step, top, top + LAST * step);
          scrollToY(y, 0);
          lastScroll = performance.now();
        }
        const dt = Math.max(1, e.timeStamp - lastT);
        vx = vx * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
        lastX = e.clientX;
        lastT = e.timeStamp;
        return;
      }
      updateMode(true);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      delete chip.dataset.down;
      if (hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId);
      if (moved < 6) {
        const i = view ? view.pick(px, py) : -1;
        if (i === cur && Math.abs(disp - cur) < 0.15) router.push(`/work/${CARS[i].slug}`);
        else if (i >= 0) goTo(i);
        return;
      }
      // flick: carry the drag speed on, then settle on a car
      const carry = (-vx * 380) / dragUnit();
      const raw = clamp((window.scrollY - top) / step + carry, 0, LAST);
      goTo(Math.round(raw));
      updateMode(false);
    };
    const onCancel = () => {
      dragging = false;
      delete chip.dataset.down;
    };
    const onLeave = () => {
      px = py = -1;
      setMode(null);
      stopMedia();
    };
    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", onUp);
    hit.addEventListener("pointercancel", onCancel);
    hit.addEventListener("pointerleave", onLeave);

    const onKey = (e: KeyboardEvent) => {
      const r = root.getBoundingClientRect();
      if (r.top > 1 || r.bottom < window.innerHeight - 1) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=dialog]")) return;
      if (e.key === "ArrowRight") goTo(cur + 1);
      else if (e.key === "ArrowLeft") goTo(cur - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    // ---------- frame loop ----------
    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(stage);

    const tick = (_t: number, dtMs: number) => {
      if (!visible) return;
      const dt = Math.min(dtMs, 64);
      const target = clamp((window.scrollY - top) / step, 0, LAST);
      const k = dragging ? 0.55 : 0.2;
      disp += (target - disp) * (1 - Math.pow(1 - k, dt / 16.67));
      if (Math.abs(target - disp) < 1e-4) disp = target;
      const rot = disp + intro.v;
      const vel = (rot - prevRot) / Math.max(dt / 1000, 1 / 240);
      prevRot = rot;

      const idx = Math.round(disp);
      if (idx !== cur) {
        const dir = Math.sign(idx - cur) || 1;
        cur = idx;
        setActive(idx);
        stopMedia();
        sweep(idx, dir, 0.08);
        const btn = stripRef.current?.children[idx] as HTMLElement | undefined;
        if (btn && small) stripRef.current?.parentElement?.scrollTo({ left: btn.offsetLeft - (stage.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
      }

      if (mediaIdx >= 0 && video) view?.invalidate();
      view?.frame(rot, reduce ? 0 : vel);

      const deg = (((rot * 40) % 360) + 360) % 360;
      if (degRef.current) degRef.current.textContent = `${String(Math.round(deg)).padStart(3, "0")}°`;
      if (progRef.current) progRef.current.style.transform = `translate3d(${clamp(rot, 0, LAST) * 100}%, 0, 0)`;

      // snap to the nearest car once the scroll has come to rest inside the stage
      const now = performance.now();
      if (!dragging && !snapping && now - lastScroll > 150) {
        const raw = (window.scrollY - top) / step;
        if (raw > 0.002 && raw < LAST - 0.002) {
          const y = top + Math.round(raw) * step;
          if (Math.abs(window.scrollY - y) > 1) snapTo(y, reduce ? 0 : 0.65);
        }
      }
      if (px >= 0 && !dragging) updateMode(false);
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("touchstart", onInput);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(INTRO_DONE_EVENT, onIntroDone);
      hit.removeEventListener("pointerdown", onDown);
      hit.removeEventListener("pointermove", onMove);
      hit.removeEventListener("pointerup", onUp);
      hit.removeEventListener("pointercancel", onCancel);
      hit.removeEventListener("pointerleave", onLeave);
      window.clearTimeout(snapTimer);
      window.clearTimeout(hoverTimer);
      window.clearInterval(stillTimer);
      gsap.killTweensOf([sweepObj, flash, mix, intro]);
      video?.pause();
      api.current = null;
      view?.dispose();
    };
  }, [router]);

  const car = CARS[active];

  return (
    <section ref={rootRef} className={s.root} aria-labelledby="showroom-title">
      <div ref={stageRef} className={s.stage} style={{ "--key": car.key } as CSSProperties}>
        <div className={s.atmos} aria-hidden="true" />
        <div className={s.softbox} aria-hidden="true" />
        <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" data-on={gl === "ok" || undefined} />

        {gl === "off" && (
          <div className={s.fallback}>
            {/* eslint-disable-next-line @next/next/no-img-element -- no-WebGL fallback, pre-sized picture */}
            <img src={car.image} alt="" width={1600} height={900} />
          </div>
        )}

        <div ref={hitRef} className={s.hit} data-mode={mode ?? undefined} aria-hidden="true" />
        <div ref={chipRef} className={s.chip} data-mode={mode ?? undefined} aria-hidden="true">
          <span>{mode === "view" ? "View project" : "Turn"}</span>
        </div>

        <header className={s.hud}>
          <div className={s.hudLeft}>
            <h1 id="showroom-title" className="t-label">
              Work <i>·</i> {pad2(COUNT)} cars
            </h1>
            <p>Every car we have made, on one turntable. Find yours by its shape.</p>
          </div>
          <div className={s.hudRight} aria-hidden="true">
            <div className={s.count}>
              <span className={s.countNow}>{pad2(active + 1)}</span>
              <span className={s.countAll}>/{pad2(COUNT)}</span>
            </div>
            <div className="t-label">
              Turntable <span ref={degRef}>000°</span>
            </div>
          </div>
        </header>

        <p className={s.media} data-on={media ? "" : undefined} aria-hidden="true">
          <i />
          {media ?? ""}
        </p>

        <div className={s.plate}>
          <div className={s.names} aria-live="polite">
            {CARS.map((c, i) => (
              <h2 key={c.slug} className={s.name} data-state={i === active ? "on" : i < active ? "before" : "after"} aria-hidden={i !== active}>
                {c.title.split(" ").map((word, w, words) => (
                  <Fragment key={w}>
                    <span className={s.word}>
                      {[...word].map((ch, j) => (
                        <span key={j} style={{ "--j": w * 4 + j } as CSSProperties}>
                          {ch}
                        </span>
                      ))}
                    </span>
                    {w < words.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </h2>
            ))}
          </div>
          <div className={s.row}>
            <div className={s.metas}>
              {CARS.map((c, i) => (
                <p key={c.slug} className={s.meta} data-on={i === active || undefined} aria-hidden={i !== active}>
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized brand mark
                    <img className={s.logo} src={c.logo.src} alt={c.brand} width={c.logo.width} height={c.logo.height} data-tall={c.logo.width / c.logo.height < 2 || undefined} />
                  ) : (
                    <b className={s.brandText}>{c.brand}</b>
                  )}
                  <span className={s.sep} />
                  <span>{c.car}</span>
                  <span className={s.sep} />
                  <span>{c.kind}</span>
                </p>
              ))}
            </div>
            <Link href={`/work/${car.slug}`} className={s.cta}>
              <span>View project</span>
              <svg viewBox="0 0 10 16" aria-hidden="true">
                <path d="M2 2l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>

        <nav className={s.strip} aria-label="All cars">
          <div className={s.stripScroll}>
            <ol ref={stripRef}>
              {CARS.map((c, i) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    className={s.thumb}
                    aria-current={i === active || undefined}
                    aria-label={`${c.title}, ${c.car}`}
                    onClick={() => (i === active ? router.push(`/work/${c.slug}`) : api.current?.goTo(i))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 480w thumb, sized by CSS */}
                    <img src={c.thumb} alt="" width={480} height={270} />
                    <span className={s.thumbNo}>{pad2(i + 1)}</span>
                    <span className={s.tip}>{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className={s.track} aria-hidden="true">
            <span ref={progRef} />
          </div>
        </nav>
      </div>

      <ul className="sr-only">
        {CARS.map((c) => (
          <li key={c.slug}>
            <Link href={`/work/${c.slug}`}>
              {c.title}: {c.brand} {c.car}, {c.kind}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
