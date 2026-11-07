"use client";

import { Fragment, useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useGSAP } from "@gsap/react";
import { scrollToId } from "@/components/providers/lenis-ref";
import { lqipBg } from "@/components/work/lqip";
import ContourField from "./ContourField";
import {
  ABOUT,
  FACTS,
  LEAD,
  STATEMENT,
  STILLS,
  fallbackSrc,
  sizes,
  srcSet,
  type StudioStill,
} from "./studio-content";
import styles from "./studio.module.css";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, useGSAP);

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function Still({ s }: { s: StudioStill }) {
  const vars = {
    "--x": s.d.x,
    "--w": s.d.w,
    "--t": s.d.t != null ? `${s.d.t}vw` : "auto",
    "--b": s.d.b != null ? `${s.d.b}vw` : "auto",
    "--mw": s.m.w,
    "--ma": s.m.align === "end" ? "flex-end" : "flex-start",
    "--ar": s.ar,
    "--pos": s.pos ?? "50% 50%",
    // Stills on the right half hang their caption from the right edge.
    "--cap-justify": s.d.x > 60 ? "flex-end" : "flex-start",
  } as CSSProperties;

  return (
    <div className={styles.still} style={vars} data-still data-speed={s.d.speed}>
      <figure className={styles.drift} data-drift>
        <figcaption className={styles.cap}>
          {/* Screen readers get the plain caption; the visible slate scrambles in, so it is hidden from them. */}
          <span className="sr-only">{`${s.project}, ${s.view}`}</span>
          <span className={styles.capProject} data-cap data-text={s.project} aria-hidden="true">
            {s.project}
          </span>
          <span className={styles.capSep} aria-hidden="true">
            {" · "}
          </span>
          <span className={styles.capView} data-cap data-text={s.view} aria-hidden="true">
            {s.view}
          </span>
        </figcaption>
        <div className={styles.frame} data-frame>
          <picture>
            <source type="image/avif" srcSet={srcSet(s, "avif")} sizes={sizes(s)} />
            <img
              className={styles.img}
              src={fallbackSrc(s)}
              srcSet={srcSet(s, "webp")}
              sizes={sizes(s)}
              width={s.iw}
              height={s.ih}
              alt={s.alt}
              loading="lazy"
              decoding="async"
              style={lqipBg(`${s.slug}/${String(s.n).padStart(2, "0")}`, s.pos)}
              data-img
            />
          </picture>
        </div>
      </figure>
    </div>
  );
}

// Home "Studio": a light sheet between dark sections. Stills from the work are scattered across it at
// different sizes with small slate-style captions; they drift at their own speeds and wipe in as they
// arrive. A big two-line statement sits in the middle. Contour lines move slowly behind everything.
export default function StudioSection() {
  const rootRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // The stills load a screen and a half before the sheet arrives (native lazy loading starts later, or very
  // late in some browsers), so they are in before they wipe in; a blurred placeholder covers any gap.
  useEffect(() => {
    const root = rootRef.current!;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        root.querySelectorAll<HTMLImageElement>("img[loading=lazy]").forEach((img) => (img.loading = "eager"));
        io.disconnect();
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  const colA = STILLS.filter((s) => s.m.col === "a");
  const colB = STILLS.filter((s) => s.m.col === "b");

  useGSAP(
    () => {
      const root = rootRef.current!;
      const sheet = sheetRef.current!;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          desk: "(min-width: 900px)",
        },
        (ctx) => {
          const { motion, desk } = ctx.conditions as { motion: boolean; desk: boolean };
          if (!motion) return;

          // 1) The sheet arrives as a rounded card and opens to full bleed, then closes as it leaves.
          const inset = () => (desk ? Math.round(Math.min(56, window.innerWidth * 0.035)) : 10);
          const radius = desk ? 28 : 18;
          const closed = () => `inset(0px ${inset()}px 0px ${inset()}px round ${radius}px)`;
          const open = "inset(0px 0px 0px 0px round 0px)";
          gsap.fromTo(
            sheet,
            { clipPath: closed },
            {
              clipPath: open,
              ease: "none",
              scrollTrigger: { trigger: sheet, start: "top bottom", end: "top 20%", scrub: true, invalidateOnRefresh: true },
            },
          );
          gsap.fromTo(
            sheet,
            { clipPath: open },
            {
              clipPath: closed,
              ease: "none",
              immediateRender: false,
              scrollTrigger: { trigger: sheet, start: "bottom 80%", end: "bottom top", scrub: true, invalidateOnRefresh: true },
            },
          );

          // 2) Each still drifts at its own speed (desktop) or with its column (mobile).
          // Drift distance follows the viewport height, capped by its width: the layout is in vw, so a tall,
          // narrow window must not push neighbouring stills into each other.
          const amp = () => Math.min(window.innerHeight, window.innerWidth * 0.62) * 0.5;
          q<HTMLElement>("[data-still]").forEach((el) => {
            const drift = el.querySelector<HTMLElement>("[data-drift]")!;
            const speed = desk ? Number(el.dataset.speed) : el.closest("[data-col='b']") ? 0.1 : 0.02;
            gsap.fromTo(
              drift,
              { y: () => speed * amp() },
              {
                y: () => -speed * amp(),
                ease: "none",
                scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
              },
            );

            // 3) ...and wipes in from the bottom as it arrives, the image settling from a slight zoom,
            // while its caption types itself in like a slate.
            const frame = el.querySelector<HTMLElement>("[data-frame]")!;
            const img = el.querySelector<HTMLElement>("[data-img]")!;
            const caps = el.querySelectorAll<HTMLElement>("[data-cap]");
            // The trigger is the still's resting box; the drift pushes the visible image down by about
            // 0.9 * speed * amp when it arrives, so the start is offset to fire as the image itself shows.
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: el,
                start: () => `top+=${Math.round(speed * amp() * 0.9)} 90%`,
                once: true,
                invalidateOnRefresh: true,
              },
            });
            tl.fromTo(frame, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.out" }, 0)
              .fromTo(img, { scale: 1.28 }, { scale: 1, duration: 1.9, ease: "expo.out" }, 0)
              .fromTo(el.querySelector("figcaption"), { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, 0.12);
            caps.forEach((cap, i) => {
              tl.to(
                cap,
                {
                  duration: 0.8,
                  ease: "none",
                  scrambleText: { text: cap.dataset.text ?? cap.textContent ?? "", chars: SCRAMBLE_CHARS, speed: 0.5, revealDelay: 0.2 },
                },
                0.12 + i * 0.22,
              );
            });
          });

          // 4) The statement reads itself in: words go from faint to full ink as it moves up the screen,
          // and the two lines slide gently in opposite directions.
          gsap.fromTo(
            q("[data-word]"),
            { opacity: 0.13 },
            {
              opacity: 1,
              ease: "none",
              stagger: 0.12,
              scrollTrigger: { trigger: q("[data-statement]")[0], start: "top 85%", end: "top 28%", scrub: true },
            },
          );
          if (desk) {
            const lines = q<HTMLElement>("[data-line]");
            lines.forEach((line, i) => {
              const dir = i === 0 ? 1 : -1;
              gsap.fromTo(
                line,
                { x: () => dir * window.innerWidth * 0.035 },
                {
                  x: () => -dir * window.innerWidth * 0.015,
                  ease: "none",
                  scrollTrigger: { trigger: line, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
                },
              );
            });
          }

          // 5) Supporting copy rises in once.
          gsap.fromTo(
            q("[data-rise]"),
            { opacity: 0, y: 26 },
            {
              opacity: 1,
              y: 0,
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: q("[data-about]")[0], start: "top 88%", once: true },
            },
          );
        },
      );

      // Positions depend on the display font; re-measure once it has loaded.
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: rootRef },
  );

  const goContact = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollToId("contact");
  };

  // Each phrase stays on one line; each word is its own span for the read-in effect.
  const sentence = (phrases: string[], last: boolean) =>
    phrases.map((phrase, p) => {
      const parts = phrase.split(" ");
      return (
        <Fragment key={p}>
          <span className={styles.phrase}>
          {parts.map((w, i) => {
            const isLast = last && p === phrases.length - 1 && i === parts.length - 1 && w.endsWith(".");
            return (
              <span key={i} className={styles.word} data-word>
                {isLast ? w.slice(0, -1) : w}
                {isLast ? <span className={styles.stop}>.</span> : null}
                {i < parts.length - 1 ? " " : null}
              </span>
            );
          })}
          </span>
          {p < phrases.length - 1 ? " " : null}
        </Fragment>
      );
    });

  return (
    <section ref={rootRef} id="studio" className={styles.studio} aria-labelledby="studio-title" data-header="light">
      <div ref={sheetRef} className={styles.sheet}>
        <div className={styles.bg} aria-hidden="true">
          <ContourField sheetRef={sheetRef} />
        </div>

        <div className={styles.field}>
          <div className={styles.kicker}>
            <p className="t-label">The studio</p>
            <p className={`t-label ${styles.kickerNote}`}>Stills from our Zeekr, McMurtry and McLaren work</p>
          </div>

          <div className={styles.statement} data-statement>
            <h2 id="studio-title" className={styles.title}>
              <span className={styles.line} data-line>
                {sentence(STATEMENT[0], false)}
              </span>{" "}
              <span className={`${styles.line} ${styles.line2}`} data-line>
                {sentence(STATEMENT[1], true)}
              </span>
            </h2>

            <div className={styles.about} data-about>
              <dl className={styles.facts}>
                {FACTS.map((f) => (
                  <div key={f.label} className={styles.fact} data-rise>
                    <dt className="t-label">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>

              <div className={styles.copy}>
                {ABOUT.map((t) => (
                  <p key={t} className={styles.para} data-rise>
                    {t}
                  </p>
                ))}
                <p className={styles.lead} data-rise>
                  <span className={styles.leadRule} aria-hidden="true" />
                  <span className="t-label">{LEAD}</span>
                </p>
                <a href="#contact" className={styles.cta} onClick={goContact} data-rise>
                  <span>Talk to the studio</span>
                  <svg className={styles.ctaArrow} viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className={styles.gallery}>
            <div className={styles.col} data-col="a">
              {colA.map((s) => (
                <Still key={`${s.slug}-${s.n}`} s={s} />
              ))}
            </div>
            <div className={`${styles.col} ${styles.colB}`} data-col="b">
              {colB.map((s) => (
                <Still key={`${s.slug}-${s.n}`} s={s} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
