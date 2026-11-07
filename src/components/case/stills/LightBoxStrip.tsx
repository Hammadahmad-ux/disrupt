"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { lqipOf, stillSet, type CaseData } from "@/content/cases";
import { Chevron } from "@/components/work/Chevron";
import { Picture } from "../shared/Picture";
import { useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import s from "../shared/shared.module.css";
import x from "./stills.module.css";
import { countWord, masterLabel, pad2, strobeFor, variantFor } from "./stills-variants";

gsap.registerPlugin(Draggable, InertiaPlugin);

const clamp = (a: number, b: number, v: number) => Math.min(b, Math.max(a, v));

// Light box: every still at its native aspect on one strip, like transparencies on a lit table. The still
// over the lamp (the centre) is fully lit; the others fall off into the dark and their pictures slide a
// little inside their frames as they move. Edge markings carry the still number and the master size.
// Desktop: drag and throw (Draggable + Inertia, snapping to each still), horizontal wheel, arrow keys and
// the buttons; a "< DRAG >" label is the cursor. Phones and coarse pointers: native horizontal scroll with
// snap. Reduced motion: no inertia, no parallax, moves are instant.
// Loading: the stills sit side by side in a moving carrier (the browser's lazy loading would only see each one
// once it is dragged into view), so the whole strip starts loading 1.5 screens before the section, each still
// over its blurred stand-in.
export function LightBoxStrip({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useReveal<HTMLDivElement>();
  const stepRef = useRef<((dir: number) => void) | null>(null);
  const stills = data.stills;
  const total = stills.length;
  const v = variantFor(data);
  const seq = strobeFor(data);
  const keyN = seq[seq.length - 1] ?? 1;
  const start = v.stripFrom === "key" ? Math.max(0, stills.findIndex((st) => st.n === keyN)) : 0;
  const [active, setActive] = useState(start);
  const id = `${data.slug}-lightbox`;
  useEagerNear(rootRef, "150% 0px", data.slug);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !total) return;
    const view = root.querySelector<HTMLElement>("[data-view]")!;
    const track = root.querySelector<HTMLElement>("[data-track]")!;
    const slides = [...track.querySelectorAll<HTMLElement>("[data-slide]")];
    const pics = slides.map((el) => el.querySelector<HTMLElement>("[data-pic]")!);
    const dims = slides.map((el) => el.querySelector<HTMLElement>("[data-dim]")!);
    const bar = root.querySelector<HTMLElement>("[data-bar]")!;
    const cursor = root.querySelector<HTMLElement>("[data-cursor]")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dragMQ = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");

    let mode: "drag" | "native" = "native";
    let vw = 1;
    let centres: number[] = [];
    let xs: number[] = [];
    let minX = 0;
    let maxX = 0;
    let idx = start;
    let target = start;
    let drag: Draggable | null = null;
    let tween: gsap.core.Tween | null = null;
    let raf = 0;
    let wheelT = 0;
    let wx = 0;
    let entered = false;

    const measure = () => {
      vw = Math.max(1, view.clientWidth);
      centres = slides.map((el) => el.offsetLeft + el.offsetWidth / 2);
      xs = centres.map((c) => vw / 2 - c);
      maxX = xs[0];
      minX = xs[xs.length - 1];
    };
    const curX = () => (mode === "drag" ? Number(gsap.getProperty(track, "x")) : -view.scrollLeft);
    const nearest = (xv: number) => {
      let best = 0;
      for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - xv) < Math.abs(xs[best] - xv)) best = i;
      return best;
    };

    // Light, parallax and the counter from the strip's position.
    const update = () => {
      const xNow = curX();
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < slides.length; i++) {
        const d = (centres[i] + xNow - vw / 2) / vw;
        const ad = Math.abs(d);
        if (ad < bestD) {
          bestD = ad;
          best = i;
        }
        const f = Math.max(0, 1 - ad * 1.6);
        dims[i].style.opacity = ((1 - f) * 0.64).toFixed(3);
        if (!reduced) {
          pics[i].style.transform = `translate3d(${clamp(-8, 8, -d * 9).toFixed(3)}%, 0, 0) scale(1.12)`;
          slides[i].style.transform = `scale(${(0.93 + 0.07 * f).toFixed(4)})`;
        }
      }
      const p = maxX === minX ? 1 : (maxX - xNow) / (maxX - minX);
      bar.style.transform = `scaleX(${clamp(0, 1, p).toFixed(4)})`;
      if (best !== idx) {
        slides[idx]?.removeAttribute("data-active");
        idx = best;
        setActive(best);
      }
      slides[idx].setAttribute("data-active", "");
    };

    const go = (i: number, instant = false) => {
      const to = clamp(0, total - 1, i);
      target = to;
      if (mode === "drag") {
        tween?.kill();
        tween = gsap.to(track, {
          x: xs[to],
          duration: instant || reduced ? 0 : 0.95,
          ease: "power3.inOut",
          overwrite: true,
          onUpdate: update,
          onComplete: () => {
            drag?.update();
            update();
          },
        });
      } else {
        view.scrollTo({ left: centres[to] - vw / 2, behavior: instant || reduced ? "auto" : "smooth" });
      }
    };
    stepRef.current = (dir: number) => go((tween?.isActive() ? target : idx) + dir);

    // ---- drag mode (desktop) ----
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical: the page scrolls as usual
      e.preventDefault();
      if (!tween?.isActive()) wx = curX();
      wx = clamp(minX, maxX, wx - e.deltaX * (e.deltaMode === 1 ? 32 : 1));
      tween?.kill();
      tween = gsap.to(track, {
        x: wx,
        duration: reduced ? 0 : 0.55,
        ease: "power3.out",
        overwrite: true,
        onUpdate: update,
        onComplete: () => drag?.update(),
      });
      window.clearTimeout(wheelT);
      wheelT = window.setTimeout(() => go(nearest(wx)), reduced ? 0 : 200);
    };

    const qx = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3.out" });
    const qy = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3.out" });
    const local = (e: PointerEvent) => {
      const r = view.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onPMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const [lx, ly] = local(e);
      qx(lx);
      qy(ly);
    };
    const onPEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const [lx, ly] = local(e);
      gsap.set(cursor, { x: lx, y: ly });
      qx(lx);
      qy(ly);
      cursor.dataset.on = "";
    };
    const onPLeave = () => delete cursor.dataset.on;

    const setupDrag = () => {
      mode = "drag";
      root.dataset.mode = "drag";
      view.scrollLeft = 0;
      measure();
      // Before the strip has come into view the carrier waits off to the right.
      const from = entered || reduced ? xs[target] : xs[target] + vw * 0.42;
      gsap.set(track, { x: from });
      drag = Draggable.create(track, {
        type: "x",
        trigger: view,
        bounds: { minX, maxX },
        inertia: !reduced,
        edgeResistance: 0.86,
        throwResistance: 2400,
        minDuration: 0.35,
        maxDuration: 1.3,
        snap: { x: (val: number) => xs[nearest(val)] },
        cursor: "none",
        activeCursor: "none",
        allowContextMenu: true,
        zIndexBoost: false,
        onPress() {
          tween?.kill();
          root.dataset.press = "";
        },
        onDrag() {
          update();
          cursor.dataset.dir = this.getDirection("velocity") === "left" ? "l" : "r";
        },
        onRelease() {
          delete root.dataset.press;
          delete cursor.dataset.dir;
          if (reduced) target = idx;
        },
        onThrowUpdate: update,
        onThrowComplete() {
          target = idx;
          update();
        },
        onClick(e: PointerEvent) {
          const li = (e.target as HTMLElement).closest<HTMLElement>("[data-slide]");
          const i = li ? slides.indexOf(li) : -1;
          if (i >= 0 && i !== idx) go(i);
        },
      })[0];
      view.addEventListener("wheel", onWheel, { passive: false });
      view.addEventListener("pointermove", onPMove);
      view.addEventListener("pointerenter", onPEnter);
      view.addEventListener("pointerleave", onPLeave);
      update();
    };

    // ---- native mode (touch, small screens) ----
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    const setupNative = () => {
      mode = "native";
      root.dataset.mode = "native";
      gsap.set(track, { clearProps: "transform" });
      measure();
      view.scrollLeft = centres[idx] - vw / 2;
      view.addEventListener("scroll", onScroll, { passive: true });
      update();
    };

    const teardown = () => {
      drag?.kill();
      drag = null;
      tween?.kill();
      window.clearTimeout(wheelT);
      cancelAnimationFrame(raf);
      raf = 0;
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("pointermove", onPMove);
      view.removeEventListener("pointerenter", onPEnter);
      view.removeEventListener("pointerleave", onPLeave);
      view.removeEventListener("scroll", onScroll);
      delete cursor.dataset.on;
    };
    const setup = () => {
      teardown();
      if (dragMQ.matches) setupDrag();
      else setupNative();
    };
    setup();
    dragMQ.addEventListener("change", setup);

    // The slide carrier is pushed in the first time the strip comes into view.
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || entered) return;
        entered = true;
        io.disconnect();
        if (mode === "drag" && !reduced) {
          tween = gsap.to(track, {
            x: xs[target],
            duration: 1.7,
            ease: "expo.out",
            onUpdate: update,
            onComplete: () => drag?.update(),
          });
        }
      },
      { threshold: 0.3 },
    );
    io.observe(view);

    // Keep the current still on the lamp when the layout changes.
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const w = view.clientWidth;
      if (w === lastW) return;
      lastW = w;
      measure();
      if (mode === "drag") {
        drag?.applyBounds({ minX, maxX });
        gsap.set(track, { x: entered || reduced ? xs[idx] : xs[target] + vw * 0.42 });
        drag?.update();
      } else view.scrollLeft = centres[idx] - vw / 2;
      update();
    });
    ro.observe(view);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        stepRef.current?.(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        go(e.key === "Home" ? 0 : total - 1);
      }
    };
    view.addEventListener("keydown", onKey);

    return () => {
      teardown();
      dragMQ.removeEventListener("change", setup);
      io.disconnect();
      ro.disconnect();
      view.removeEventListener("keydown", onKey);
      stepRef.current = null;
      gsap.set(track, { clearProps: "transform" });
      slides.forEach((el) => el.style.removeProperty("transform"));
    };
  }, [data.slug, start, total]);

  if (!total) return null;
  const cur = stills[Math.min(active, total - 1)];
  const first = stills[0];
  const lastSt = stills[total - 1];

  return (
    <section
      ref={rootRef}
      className={x.strip}
      aria-labelledby={id}
      style={{ "--ar-first": first.w / first.h, "--ar-last": lastSt.w / lastSt.h } as CSSProperties}
    >
      <div ref={headRef} className={x.stripHead}>
        <div className={x.headText}>
          <p className={`t-label ${s.kicker} ${s.reveal}`}>
            <Chevron className={s.keyChev} />
            <span id={id}>Light box</span>
          </p>
          <h2 className={`${s.h2} ${s.reveal}`} style={{ "--d": 90 } as CSSProperties}>
            {countWord(total)} frames
          </h2>
          <span className={`${s.keyRule} ${s.reveal}`} style={{ "--d": 180 } as CSSProperties} aria-hidden="true" />
        </div>
        <p className={`${x.count} ${s.reveal}`} style={{ "--d": 140 } as CSSProperties} aria-hidden="true">
          <span className={x.countNow}>
            <span key={active}>{pad2(active + 1)}</span>
          </span>
          <span className={x.countOf}>/ {pad2(total)}</span>
        </p>
      </div>

      <div className={x.stripStage}>
        <div
          className={x.view}
          data-view
          data-lenis-prevent-horizontal
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${data.title} stills. Use the arrow keys to move along the strip.`}
        >
          <ol className={x.track} data-track>
            {stills.map((st, i) => (
              <li
                key={st.n}
                className={x.slide}
                data-slide
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${total}`}
                style={{ "--ar": st.w / st.h } as CSSProperties}
              >
                <span className={x.mark} aria-hidden="true">
                  <span className={s.keyNum}>{pad2(st.n)}</span>
                  <span>{masterLabel(st)}</span>
                </span>
                <span className={x.frame}>
                  <span className={x.pic} data-pic>
                    <Picture
                      set={stillSet(data.slug, st.n)}
                      w={st.w}
                      h={st.h}
                      alt={st.alt}
                      sizes="(max-width: 760px) 90vw, 70vw"
                      lqip={lqipOf(data, "stills", st.n)}
                    />
                  </span>
                  <span className={x.dim} data-dim />
                </span>
              </li>
            ))}
          </ol>
          <span className={x.cursor} data-cursor aria-hidden="true">
            <span className={x.cursorPill}>
              <Chevron back />
              <span>Drag</span>
              <Chevron />
            </span>
          </span>
        </div>
      </div>

      <div className={x.stripFoot}>
        <span className={x.bar} aria-hidden="true">
          <span data-bar />
        </span>
        {/* CONFIRM WITH ADIL: still captions */}
        <p className={x.stripCap} aria-live="polite">
          <span className={`${s.tc} ${s.keyNum}`}>{pad2(cur.n)}</span>
          <span>{cur.caption}</span>
        </p>
        <div className={x.stripNav}>
          <span className={`t-label ${x.hint} ${x.hintDrag}`}>Drag or use the arrows</span>
          <span className={`t-label ${x.hint} ${x.hintTouch}`}>Swipe</span>
          <button
            type="button"
            className={x.navBtn}
            aria-label="Previous still"
            disabled={active === 0}
            onClick={() => stepRef.current?.(-1)}
          >
            <Chevron back />
          </button>
          <button
            type="button"
            className={x.navBtn}
            aria-label="Next still"
            disabled={active === total - 1}
            onClick={() => stepRef.current?.(1)}
          >
            <Chevron />
          </button>
        </div>
      </div>
    </section>
  );
}
