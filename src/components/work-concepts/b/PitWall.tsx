"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis } from "@/components/providers/lenis-ref";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { BRANDS, PRINTS, cover, filmSources, kindLabel, type Print } from "./data";
import s from "./pit-wall.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// PIT WALL (work concept B): the work as a wall of prints in a dark studio. Every project is one big
// picture of its car, at the frame's own aspect, with the car's name under it, so people find the car
// by its shape first. A strip light hangs over each print and flickers on as it scrolls in. Hover a
// print and the studio lights go down on the rest: the still starts moving (its film), and the film's
// colour spills onto the wall around it. The dock below filters the wall and doubles as a lap chart.

type Kind = "all" | "film" | "stills";
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "film", label: "Films" },
  { id: "stills", label: "Stills" },
];

// Salon hang on a 12-column wall. Slots cycle through PATTERN; an ultra-wide print takes a whole row
// and restarts the cycle. Re-hung whenever the filter changes.
type Slot = { col: string; mt: string; depth: number };
const PATTERN: Slot[] = [
  { col: "1 / span 7", mt: "0px", depth: 0 },
  { col: "9 / span 4", mt: "clamp(2rem, 13vw, 13rem)", depth: 1 },
  { col: "2 / span 5", mt: "0px", depth: 0.5 },
  { col: "8 / span 5", mt: "clamp(2rem, 8vw, 8rem)", depth: -0.6 },
];
const WIDE: Slot = { col: "1 / -1", mt: "0px", depth: 0 };

function hang(list: Print[]) {
  const out = new Map<string, Slot>();
  let k = 0;
  for (const p of list) {
    if (p.w / p.h > 2.2) {
      out.set(p.slug, WIDE);
      k = 0;
    } else out.set(p.slug, PATTERN[k++ % PATTERN.length]);
  }
  return out;
}

// A print with its light off: no tube, the frame shut to a slit, the name below its line.
function lightsOff(p: HTMLElement) {
  gsap.set(p.querySelector("[data-frame]"), { clipPath: "inset(49.6% 0% 49.6% 0%)" });
  gsap.set(p.querySelectorAll("[data-strip], [data-cone]"), { opacity: 0 });
  gsap.set(p.querySelector("[data-media]"), { scale: 1.32 });
  gsap.set(p.querySelector("[data-line]"), { yPercent: 105 });
  gsap.set(p.querySelectorAll("[data-fade]"), { opacity: 0 });
}

// Light on: the strip light stutters on like a studio tube, then the print opens from a slit of light.
function lightsOn(p: HTMLElement, paused = false) {
  const frame = p.querySelector("[data-frame]");
  const lights = p.querySelectorAll("[data-strip], [data-cone]");
  return gsap
    .timeline({ paused })
    .to(lights, { keyframes: { opacity: [0, 0.9, 0.1, 0.7, 0.2, 1] }, duration: 0.6, ease: "none" })
    .to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.25, ease: "expo.inOut" }, 0.22)
    .to(p.querySelector("[data-media]"), { scale: 1.12, duration: 1.8, ease: "expo.out" }, 0.3)
    .to(p.querySelector("[data-line]"), { yPercent: 0, duration: 1.1, ease: "expo.out" }, 0.75)
    .to(p.querySelectorAll("[data-fade]"), { opacity: 1, duration: 0.8, stagger: 0.08, ease: "power2.out" }, 0.9)
    .set(lights, { clearProps: "opacity" })
    .set(frame, { clearProps: "clipPath" });
}

const pad = (n: number) => String(n).padStart(2, "0");
const timecode = (t: number) => `00:${pad(Math.floor(t))}:${pad(Math.floor((t % 1) * 24))}`;
const matches = (p: Print, k: Kind, b: string | null) => (k === "all" || p.type === k) && (!b || p.brand === b);

// Touch screens have no hover: the print nearest the middle of the screen plays instead.
const HOVERLESS = "(hover: none)";
const subscribe = (cb: () => void) => {
  const mq = matchMedia(HOVERLESS);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useHoverless = () => useSyncExternalStore(subscribe, () => matchMedia(HOVERLESS).matches, () => false);

export default function PitWall() {
  const root = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [brand, setBrand] = useState<string | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [current, setCurrent] = useState(PRINTS[0].slug);
  const [live, setLive] = useState(false); // intro is done and the wall is up
  const hoverless = useHoverless();
  const leave = useRef(0);
  const reveals = useRef<gsap.core.Timeline[]>([]);
  const busy = useRef(false);

  const visible = PRINTS.filter((p) => matches(p, kind, brand));
  const slots = hang(visible);
  const on = hoverless ? (live ? current : null) : lit;
  const litAt = visible.findIndex((p) => p.slug === on);

  const light = (slug: string) => {
    window.clearTimeout(leave.current);
    setLit(slug);
  };
  const unlight = () => {
    window.clearTimeout(leave.current);
    leave.current = window.setTimeout(() => setLit(null), 90);
  };

  // Re-hang the wall for a new filter: lights out across the wall, re-hang in the dark, then the
  // tubes come back on one print at a time.
  const refilter = (k: Kind, b: string | null) => {
    const el = root.current;
    if (!el || busy.current || (k === kind && b === brand)) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    reveals.current.forEach((t) => t.progress(1));
    const end = el.querySelector("[data-end]");
    const rehang = () => {
      flushSync(() => {
        setKind(k);
        setBrand(b);
        setLit(null);
      });
      const wall = el.querySelector<HTMLElement>("[data-wall]")!;
      const top = wall.getBoundingClientRect().top;
      if (top < 0) {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(wall, { offset: -120, immediate: true, force: true });
        else window.scrollTo(0, scrollY + top - 120);
      }
      ScrollTrigger.refresh();
    };
    if (reduce) {
      rehang();
      return;
    }
    busy.current = true;
    const floats = (sel: string) => gsap.utils.toArray<HTMLElement>(sel, el).map((p) => p.querySelector("[data-float]"));
    gsap
      .timeline()
      .to(floats("[data-print]:not([hidden])"), { opacity: 0, duration: 0.26, stagger: 0.02, ease: "power2.in" })
      .to(end, { opacity: 0, duration: 0.25 }, 0)
      .add(() => {
        rehang();
        gsap.set(floats("[data-print]"), { opacity: 1 });
        gsap.utils.toArray<HTMLElement>("[data-print]:not([hidden])", el).forEach((p, i) => {
          lightsOff(p);
          lightsOn(p).delay(0.08 + i * 0.1);
        });
        gsap.to(end, { opacity: 1, duration: 0.6, delay: 0.9 });
        gsap.delayedCall(0.5, () => void (busy.current = false));
      });
  };

  const onScreen = (slug: string) => {
    const r = root.current?.querySelector(`[data-print][data-slug="${slug}"] [data-frame]`)?.getBoundingClientRect();
    return !!r && r.bottom > 80 && r.top < innerHeight - 80;
  };

  const jump = (slug: string) => {
    const el = root.current?.querySelector<HTMLElement>(`[data-print][data-slug="${slug}"] [data-frame]`);
    if (!el) return;
    const offset = -(innerHeight - el.offsetHeight) / 2;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
    else el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  useGSAP(
    (_, contextSafe) => {
      const el = root.current!;
      const prints = gsap.utils.toArray<HTMLElement>("[data-print]", el);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const narrow = matchMedia("(max-width: 760px)").matches; // one column: no floating depth
      reveals.current = [];

      // Which print is nearest the middle of the screen (dock lap chart, touch playback).
      const spy = () => {
        const mid = innerHeight / 2;
        let best = "";
        let bd = Infinity;
        for (const p of prints) {
          if (p.hidden) continue;
          const r = p.querySelector("[data-frame]")!.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bd) {
            bd = d;
            best = p.dataset.slug!;
          }
        }
        if (best) setCurrent(best);
      };

      if (!reduce) {
        // Lights off until the wall is up.
        gsap.set(el.querySelectorAll("[data-intro-line]"), { yPercent: 110 });
        gsap.set(el.querySelectorAll("[data-intro-fade]"), { opacity: 0, y: 16 });
        gsap.set(el.querySelector("[data-dock]"), { opacity: 0, y: 40 });
        prints.forEach(lightsOff);
      }

      const start = contextSafe!(() => {
        setLive(true);
        ScrollTrigger.create({ start: 0, end: "max", onUpdate: spy, onRefresh: spy });
        if (reduce) return;

        gsap.to(el.querySelectorAll("[data-intro-line]"), { yPercent: 0, duration: 1.2, stagger: 0.09, ease: "expo.out" });
        gsap.to(el.querySelectorAll("[data-intro-fade]"), { opacity: 1, y: 0, duration: 1, stagger: 0.06, delay: 0.25, ease: "expo.out" });
        gsap.to(el.querySelector("[data-dock]"), { opacity: 1, y: 0, duration: 1, delay: 0.6, ease: "expo.out" });

        prints.forEach((p) => {
          const media = p.querySelector("[data-media]")!;
          const float = p.querySelector("[data-float]")!;
          const tl = lightsOn(p, true);
          reveals.current.push(tl);
          ScrollTrigger.create({ trigger: p, start: "top 90%", once: true, onEnter: () => tl.play() });

          // Drift: the picture slides inside its frame, and the smaller prints float at their own depth.
          gsap.fromTo(
            media,
            { yPercent: -5 },
            { yPercent: 5, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } },
          );
          const depth = Number(p.dataset.depth || 0);
          if (depth && !narrow) {
            gsap.fromTo(
              float,
              { y: 70 * depth },
              { y: -70 * depth, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } },
            );
          }
        });
      });

      if (useIntro.getState().done) start();
      else window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
      return () => window.removeEventListener(INTRO_DONE_EVENT, start);
    },
    { scope: root },
  );

  const counts = (k: Kind, b: string | null) => PRINTS.filter((p) => matches(p, k, b)).length;

  return (
    <div ref={root} className={s.root} data-lit={on ?? undefined} data-hoverless={hoverless || undefined}>
      <div className={s.room} aria-hidden="true" />

      <header className={s.intro}>
        <div className={s.introHead}>
          <p className={`t-label ${s.kicker}`} data-intro-fade>
            Work <span className={s.kickerDot}>·</span> {pad(PRINTS.length)} projects
          </p>
          <h1 className={s.title}>
            <span className={s.titleMask}>
              <span data-intro-line>Find the car.</span>
            </span>
            <span className={s.titleMask}>
              <span data-intro-line>Roll the film.</span>
            </span>
          </h1>
        </div>
        <div className={s.introSide}>
          <p className={s.lede} data-intro-fade>
            Nine launches in CGI for Audi, McLaren, Zeekr, CUPRA, McMurtry, Alpine and NASCAR. Spot the car, roll
            its film, open the project.
          </p>
          <div className={s.brands} role="group" aria-label="Filter by brand" data-intro-fade data-no-roll>
            <button
              type="button"
              className={s.brandBtn}
              aria-pressed={brand === null}
              onClick={() => refilter(kind, null)}
            >
              All brands
            </button>
            {BRANDS.map((b) => {
              const n = counts(kind, b);
              return (
                <button
                  key={b}
                  type="button"
                  className={s.brandBtn}
                  aria-pressed={brand === b}
                  disabled={n === 0}
                  onClick={() => refilter(kind, brand === b ? null : b)}
                >
                  {b}
                  <span className={s.count}>{pad(n)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section className={s.wall} data-wall aria-label="Projects" id="work">
        {PRINTS.map((p, i) => (
          <PrintCard
            key={p.slug}
            p={p}
            slot={slots.get(p.slug) ?? PATTERN[0]}
            delay={litAt < 0 ? 0 : Math.max(0, Math.abs(visible.indexOf(p) - litAt) - 1) * 0.07}
            on={on === p.slug}
            hidden={!matches(p, kind, brand)}
            eager={i < 2}
            onLight={light}
            onUnlight={unlight}
          />
        ))}
        {visible.length === 0 && (
          <p className={s.empty}>
            Nothing on this wall yet.{" "}
            <button type="button" className={s.emptyBtn} onClick={() => refilter("all", null)}>
              Show all
            </button>
          </p>
        )}
      </section>

      <footer className={s.end} data-end>
        <p className={`t-label ${s.endLabel}`}>End of the wall</p>
        <Link href="/#contact" className={s.endLink}>
          Your car next? Let&apos;s talk
          <Chevron />
        </Link>
      </footer>

      <nav className={s.dock} aria-label="Filter and jump to a project" data-dock data-no-roll>
        <div className={s.kinds} role="group" aria-label="Show">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={s.kind}
              aria-pressed={kind === k.id}
              onClick={() => refilter(k.id, brand)}
            >
              {k.label}
              <span className={s.count}>{pad(counts(k.id, brand))}</span>
            </button>
          ))}
        </div>
        <span className={s.sep} aria-hidden="true" />
        <ol className={s.lap}>
          {visible.map((p) => {
            const c = cover(p.slug, true);
            return (
              <li key={p.slug} className={s.lapItem} data-current={current === p.slug || undefined}>
                <button
                  type="button"
                  className={s.lapBtn}
                  style={{ "--tint": p.tint } as CSSProperties}
                  aria-label={`${p.n} ${p.title}, ${p.car}`}
                  aria-current={current === p.slug ? "true" : undefined}
                  onClick={() => jump(p.slug)}
                  onPointerEnter={() => !hoverless && onScreen(p.slug) && light(p.slug)}
                  onPointerLeave={() => !hoverless && unlight()}
                >
                  <span className={s.bar} aria-hidden="true" />
                  <span className={s.lapName} aria-hidden="true">
                    {p.n} {p.title}
                  </span>
                  <span className={s.tip} aria-hidden="true">
                    <picture>
                      <source type="image/avif" srcSet={c.avif} />
                      <img src={c.webp} alt="" loading="lazy" decoding="async" width={320} height={180} />
                    </picture>
                    <span className={s.tipName}>
                      {p.n} {p.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

type CardProps = {
  p: Print;
  slot: Slot;
  delay: number;
  on: boolean;
  hidden: boolean;
  eager: boolean;
  onLight: (slug: string) => void;
  onUnlight: () => void;
};

function PrintCard({ p, slot, delay, on, hidden, eager, onLight, onUnlight }: CardProps) {
  const media = useRef<HTMLDivElement>(null);
  const spill = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const wide = slot === WIDE;
  const big = wide ? 2400 : 1600;
  const c = cover(p.slug);
  const c800 = cover(p.slug, true);
  const sizes = wide ? "(max-width: 760px) 100vw, 96vw" : "(max-width: 760px) 100vw, 60vw";
  const film = p.type === "film";

  // Lit: the print plays (film) or flicks through its stills, and its colour spills onto the wall.
  useEffect(() => {
    if (!on) return;
    const box = media.current!;
    const canvas = spill.current!;
    const g = canvas.getContext("2d");
    const base = img.current!;
    let src: HTMLImageElement | HTMLVideoElement = base;
    let raf = 0;
    let timer = 0;
    let video = box.querySelector("video");
    let onPlaying: (() => void) | null = null;
    const sources = filmSources(p);

    if (sources.length) {
      if (!video) {
        video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
        video.className = s.video;
        video.setAttribute("aria-hidden", "true");
        for (const x of sources) {
          const so = document.createElement("source");
          so.src = x.src;
          so.type = x.type;
          video.appendChild(so);
        }
        box.appendChild(video);
      }
      const v = video;
      // "matched" starts on the print's own frame, so the still simply starts to move. "lands" plays the
      // moments before the print's frame once and stops on it.
      v.loop = p.clip !== "lands";
      if ((p.clip === "matched" || p.clip === "lands") && v.readyState >= 1) v.currentTime = 0;
      onPlaying = () => {
        v.dataset.shown = "";
        src = v;
      };
      v.addEventListener("playing", onPlaying);
      v.play().catch(() => {});
    } else if (p.flick?.length) {
      let layers = [...box.querySelectorAll<HTMLImageElement>("img[data-flick]")];
      if (!layers.length) {
        layers = p.flick.map((u) => {
          const im = document.createElement("img");
          im.src = u;
          im.alt = "";
          im.decoding = "async";
          im.className = s.flick;
          im.dataset.flick = "";
          box.appendChild(im);
          return im;
        });
      }
      const all = [base, ...layers];
      let k = 0;
      const label = () => {
        if (readout.current) readout.current.textContent = `${pad(k + 1)} / ${pad(all.length)}`;
      };
      label();
      timer = window.setInterval(() => {
        k = (k + 1) % all.length;
        layers.forEach((l, j) => {
          if (j === k - 1) l.dataset.shown = "";
          else delete l.dataset.shown;
        });
        src = all[k];
        label();
      }, 1150);
    }

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ready = src instanceof HTMLVideoElement ? src.readyState >= 2 : src.complete && src.naturalWidth > 0;
      if (g && ready) g.drawImage(src, 0, 0, canvas.width, canvas.height);
      if (src instanceof HTMLVideoElement && readout.current) readout.current.textContent = timecode(src.currentTime);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      if (video) {
        video.pause();
        delete video.dataset.shown;
        if (onPlaying) video.removeEventListener("playing", onPlaying);
      }
      box.querySelectorAll<HTMLElement>("img[data-flick]").forEach((l) => delete l.dataset.shown);
    };
  }, [on, p]);

  const style = {
    "--col": slot.col,
    "--mt": slot.mt,
    "--tint": p.tint,
    "--ar": `${p.w} / ${p.h}`,
    "--d": `${delay}s`,
  } as CSSProperties;

  return (
    <article
      className={s.print}
      style={style}
      hidden={hidden}
      data-print
      data-slug={p.slug}
      data-depth={slot.depth}
      data-wide={wide || undefined}
      data-on={on || undefined}
    >
      <Link
        href={`/work/${p.slug}`}
        className={s.link}
        data-float
        onPointerEnter={(e) => e.pointerType === "mouse" && onLight(p.slug)}
        onPointerLeave={(e) => e.pointerType === "mouse" && onUnlight()}
        onPointerMove={(e) => {
          // The light's hotspot on the print follows the pointer across it.
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--lx", `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
        }}
        onFocus={() => onLight(p.slug)}
        onBlur={onUnlight}
      >
        <div className={s.stage} data-stage>
          <span className={s.cone} data-cone aria-hidden="true" />
          <span className={s.strip} data-strip aria-hidden="true" />
          <canvas ref={spill} className={s.spill} width={48} height={27} aria-hidden="true" />
          <div className={s.frame} data-frame>
            <div ref={media} className={s.media} data-media>
              <picture>
                <source type="image/avif" srcSet={`${c800.avif} 800w, ${c.avif} ${big}w`} sizes={sizes} />
                <img
                  ref={img}
                  className={s.img}
                  src={c.webp}
                  srcSet={`${c800.webp} 800w, ${c.webp} ${big}w`}
                  sizes={sizes}
                  width={big}
                  height={Math.round((big * p.h) / p.w)}
                  alt={`${p.title}: the ${p.car}`}
                  loading={eager ? "eager" : "lazy"}
                  fetchPriority={eager ? "high" : undefined}
                  decoding="async"
                />
              </picture>
            </div>
            <span className={s.falloff} aria-hidden="true" />
            <span className={s.gloss} aria-hidden="true" />
            <span className={s.shade} aria-hidden="true" />
            <span className={s.read} aria-hidden="true">
              <i className={s.rec} />
              {film ? "Rolling" : "Stills"}
              <span ref={readout} className={s.readTime}>
                {film ? "00:00:00" : ""}
              </span>
            </span>
            <span className={s.cue} aria-hidden="true">
              Open project
              <Chevron />
            </span>
          </div>
        </div>

        <div className={s.label}>
          <span className={s.num} data-fade>
            {p.n}
          </span>
          <div className={s.names}>
            <h2 className={s.name}>
              <span className={s.nameLine} data-line>
                {p.title}
              </span>
            </h2>
            <p className={s.sub} data-fade>
              <span className={s.car}>{p.car}</span>
              <span className={s.subSep} aria-hidden="true" />
              <span>{kindLabel(p)}</span>
            </p>
          </div>
          <span className={s.brand} data-fade>
            {p.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized brand mark
              <img
                className={s.logo}
                src={p.logo.src}
                alt={p.brand}
                width={p.logo.width}
                height={p.logo.height}
                style={{ height: p.logo.height / p.logo.width > 0.5 ? 26 : 13 }}
                loading="lazy"
              />
            ) : (
              <span className={s.brandTxt}>{p.brand}</span>
            )}
          </span>
        </div>
      </Link>
    </article>
  );
}

function Chevron() {
  return (
    <svg className={s.chev} width="0.9em" height="0.9em" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 1.5 8.5 6 4 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
