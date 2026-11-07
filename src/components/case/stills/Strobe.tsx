"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { lqipOf, stillSet, type CaseData } from "@/content/cases";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { Picture } from "../shared/Picture";
import { useEagerNear } from "../shared/preload";
import { pad2, strobeFor } from "./stills-variants";
import x from "./stills.module.css";

type Props = {
  data: CaseData;
  /** "hero": inside CaseHero (scrolls with it), and it paints the hero title.
   *  "section": the first body section (used when the stage already shows the key still). */
  mode: "hero" | "section";
};

// Studio strobes. The modelling lights drop on the still the visitor arrived on, then three stills fire in:
// a 60 ms white flash, the still at full exposure, a short afterglow. The last one is the key still. In the
// hero the title turns to primer on the first flash and, on the last one, becomes a window cut into the key
// still: the room settles darker and only the letters keep the full exposure. A softbox then drifts across
// the set now and then. Reduced motion: no flashes, a crossfade to the key still.
// Flashes are 0.56 s apart, so there are never more than two in any one second (WCAG 2.3.1).
export function Strobe({ data, mode }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const seq = strobeFor(data);
  // Hero: the stills load first thing (priority). Section: they start 1.5 screens ahead.
  useEagerNear(rootRef, "150% 0px", data.slug);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !seq.length) return;
    const hero = mode === "hero" ? root.closest<HTMLElement>("[data-case-hero]") : null;
    const imgs = [...root.querySelectorAll<HTMLImageElement>("img")];
    const shade = root.querySelector<HTMLElement>("[data-shade]")!;
    const flash = root.querySelector<HTMLElement>("[data-flash]")!;
    const band = root.querySelector<HTMLElement>("[data-band]")!;
    const nums = [...root.querySelectorAll<HTMLElement>("[data-num]")];
    const label = root.querySelector<HTMLElement>("[data-label]")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const last = seq.length - 1;

    let disposed = false;
    let started = false;
    let visible = true;
    let tl: gsap.core.Timeline | null = null;
    let drift: gsap.core.Tween | null = null;
    let wait = 0;

    const fill = (v: string | null) => {
      if (!hero) return;
      if (v) {
        hero.dataset.fill = "strobe";
        hero.style.setProperty("--title-fill", v);
      } else {
        delete hero.dataset.fill;
        hero.style.removeProperty("--title-fill");
      }
    };
    // The title becomes a window cut into the key still. CaseHero's fill uses background-attachment: fixed,
    // which Chrome ignores on its title (the rise animation leaves a translate on it), so the fill is given as
    // an explicit first layer, registered with the cover-fitted still behind it (the strobe stage scrolls
    // with the hero, so the registration holds while scrolling). The trailing transparent layer takes the
    // "center / cover fixed" that CaseHero appends.
    let keyed = false;
    const keyFill = () => {
      const img = imgs[last];
      const src = img.currentSrc || img.src;
      const span = hero?.querySelector<HTMLElement>("[data-case-title] > span");
      if (!hero || !span) return `url("${src}")`;
      const W = Math.max(1, hero.clientWidth);
      const H = Math.max(1, hero.clientHeight);
      const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 16 / 9;
      const iw = W / H > ar ? W : H * ar;
      const ih = iw / ar;
      let L = 0;
      let T = 0;
      let el: HTMLElement | null = span;
      while (el && el !== hero) {
        L += el.offsetLeft;
        T += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      if (el !== hero) {
        const a = span.getBoundingClientRect();
        const b = hero.getBoundingClientRect();
        L = a.left - b.left;
        T = a.top - b.top;
      }
      const px = (W - iw) / 2 - L;
      const py = (H - ih) / 2 - T;
      return `url("${src}") ${px.toFixed(1)}px ${py.toFixed(1)}px / ${iw.toFixed(1)}px ${ih.toFixed(1)}px no-repeat, linear-gradient(transparent, transparent)`;
    };
    const paintKey = () => {
      keyed = true;
      fill(keyFill());
    };
    const lit = (i: number) => {
      nums.forEach((n, j) => {
        if (j === i) n.dataset.on = "";
        else if (j < i) {
          delete n.dataset.on;
          n.dataset.done = "";
        }
      });
      if (i === last) label.textContent = "Key still";
    };

    const startDrift = () => {
      if (reduced || disposed) return;
      drift = gsap.fromTo(
        band,
        { x: () => -band.offsetWidth },
        { x: () => innerWidth + band.offsetWidth * 0.2, duration: 6.5, ease: "sine.inOut", repeat: -1, repeatDelay: 4.5, delay: 0.6 },
      );
      if (!visible) drift.pause();
    };

    const run = () => {
      if (started || disposed) return;
      started = true;
      root.dataset.run = "";
      if (reduced) {
        tl = gsap.timeline();
        tl.to(imgs[last], { opacity: 1, duration: 0.2, ease: "power1.out" }, 0);
        tl.to(shade, { opacity: 0.68, duration: 0.2, ease: "power1.out" }, 0);
        tl.call(() => {
          paintKey();
          lit(last);
        }, [], 0.2);
        return;
      }
      tl = gsap.timeline({ onComplete: startDrift });
      // Modelling lights down on the still the visitor arrived on.
      tl.to(shade, { opacity: 0.74, duration: 0.45, ease: "power2.in" }, 0);
      const gap = 0.56;
      seq.forEach((_, i) => {
        const t = 0.55 + i * gap;
        tl!.set(flash, { opacity: 0.9 }, t);
        tl!.set(imgs, { opacity: (j: number) => (j === i ? 1 : 0) }, t);
        tl!.set(shade, { opacity: 0 }, t);
        tl!.call(() => {
          lit(i);
          // Mid-grey matte primer (the body's --primer is near black and vanished on dark stills).
          if (i === 0) fill("linear-gradient(#7a7a81, #7a7a81)");
          if (i === last) paintKey();
        }, [], t);
        tl!.fromTo(imgs[i], { scale: 1.045 }, { scale: 1, duration: i === last ? 0.8 : 1, ease: "power3.out", immediateRender: false }, t);
        tl!.to(flash, { opacity: 0, duration: 0.22, ease: "power2.out" }, t + 0.06);
        if (i < last) tl!.to(shade, { opacity: 0.52, duration: 0.4, ease: "power1.in" }, t + 0.08);
      });
      // The key still holds full exposure for a beat, then the room settles and only the title stays lit.
      tl.to(shade, { opacity: 0.68, duration: 1.3, ease: "power2.out" }, 0.55 + last * gap + 0.3);
    };

    const go = () => {
      // Let the roster's fly-through land (and the hero title rise) before the lights drop.
      wait = window.setTimeout(() => {
        const ready = Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
        const cap = new Promise((r) => window.setTimeout(r, 2400));
        Promise.race([ready, cap]).then(run);
      }, mode === "hero" ? 650 : 0);
    };

    // Pause the drift while the hero (or section) is off screen; the section mode fires when it is in view.
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (drift) {
          if (visible) drift.resume();
          else drift.pause();
        }
        if (mode === "section" && visible && e.intersectionRatio > 0.45 && !started && !wait) go();
      },
      { threshold: [0, 0.5] },
    );
    io.observe(hero ?? root);

    // Keep the window registered when the hero or the title changes size (resize, font swap).
    const ro = new ResizeObserver(() => {
      if (keyed) fill(keyFill());
    });
    if (hero) {
      ro.observe(hero);
      const span = hero.querySelector<HTMLElement>("[data-case-title] > span");
      if (span) ro.observe(span);
    }

    const onIntro = () => go();
    if (mode === "hero") {
      if (useIntro.getState().done) go();
      else window.addEventListener(INTRO_DONE_EVENT, onIntro, { once: true });
    }

    return () => {
      disposed = true;
      window.clearTimeout(wait);
      window.removeEventListener(INTRO_DONE_EVENT, onIntro);
      io.disconnect();
      ro.disconnect();
      tl?.kill();
      drift?.kill();
      fill(null);
    };
    // seq is derived from data; data.slug identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.slug, mode]);

  if (!seq.length) return null;
  const sizes = mode === "hero" ? "(max-aspect-ratio: 16/9) 178vh, 100vw" : "100vw";

  const inner = (
    <div ref={rootRef} className={x.strobe} data-mode={mode} aria-hidden="true">
      <div className={x.strobeStage}>
        {seq.map((n, i) => {
          const st = data.stills.find((s) => s.n === n)!;
          return (
            <Picture
              key={`${n}-${i}`}
              set={stillSet(data.slug, n)}
              w={st.w}
              h={st.h}
              alt=""
              sizes={sizes}
              priority={mode === "hero"}
              lqip={lqipOf(data, "stills", n)}
              className={x.strobePic}
              imgClassName={x.strobeImg}
            />
          );
        })}
        <span className={x.strobeShade} data-shade />
        <span className={x.strobeBand} data-band />
        <span className={x.strobeFlash} data-flash />
      </div>
      <p className={`t-label ${x.strobeTag}`}>
        <span data-label>Strobe</span>
        <span className={x.strobeSeq}>
          {seq.map((n, i) => (
            <span key={i} data-num>
              {pad2(n)}
            </span>
          ))}
        </span>
      </p>
    </div>
  );

  if (mode === "hero") return inner;
  const key = data.stills.find((s) => s.n === seq[seq.length - 1]);
  return (
    <section className={x.strobeSection} aria-label={`${data.title}, key still`}>
      {inner}
      {key ? <p className={`t-label ${x.strobeCaption}`}>{key.caption}</p> : null}
    </section>
  );
}
