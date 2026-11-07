"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { useIntro } from "@/components/intro/intro-store";
import { loopSources } from "@/content/projects";
import { LINEUP, carSet, carSrc, sceneSet, sceneSrc, type LineupCar } from "./lineup-data";
import s from "./lineup.module.css";

type Filter = "all" | "film" | "stills";

const LEVELS = [LINEUP.slice(0, 3), LINEUP.slice(3, 6), LINEUP.slice(6, 9)];
const COUNT = { all: LINEUP.length, film: LINEUP.filter((c) => c.type === "film").length, stills: LINEUP.filter((c) => c.type === "stills").length };

// After the loader the bay lights come on like a car park's motion sensors: a ripple from the bottom-left
// entrance (bay 07) up to the top-right, each tube with its own flicker.
const bootDelay = (i: number) => {
  const row = 2 - Math.floor(i / 3);
  const col = i % 3;
  return 120 + (row + col) * 150 + ((i * 53) % 70);
};

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const subscribeHover = (cb: () => void) => {
  const mq = matchMedia(HOVER_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The logo's ">" chevron. */
function Chevron() {
  return (
    <svg width="0.9em" height="0.9em" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 1.5 8.5 6 4 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export default function Lineup() {
  const canHover = useSyncExternalStore(subscribeHover, () => matchMedia(HOVER_QUERY).matches, () => true);
  const reduced = useSyncExternalStore(subscribeReduced, () => matchMedia(REDUCED_QUERY).matches, () => false);
  const introDone = useIntro((st) => st.done);

  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null); // film whose loop plays in its bay (hover dwell)
  const [flick, setFlick] = useState<string | null>(null); // one tired tube flickers now and then
  const [strike, setStrike] = useState<string[]>([]); // bays switched back on by a filter strike up again
  const strikeTimer = useRef(0);
  const garageRef = useRef<HTMLElement>(null);
  const raf = useRef(0);

  // Depth: the cars drift a few pixels against the cursor, the walls and lights stay put.
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!canHover || reduced || raf.current) return;
    const el = e.currentTarget;
    const x = e.clientX;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", `${(((x - r.left) / r.width - 0.5) * -14).toFixed(1)}px`);
    });
  };

  const isOff = (c: LineupCar) => filter !== "all" && c.type !== filter;
  const activeCar = LINEUP.find((c) => c.slug === active && !isOff(c));
  const activeLevel = activeCar ? Math.floor(LINEUP.indexOf(activeCar) / 3) : -1;

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Lights on once the loader has gone (or after 3.5 s, whatever happens first).
  useEffect(() => {
    if (booted) return;
    const t = window.setTimeout(() => setBooted(true), introDone || reduced ? 200 : 3500);
    return () => window.clearTimeout(t);
  }, [introDone, reduced, booted]);

  // Decode the scene frames once the lights are on, so the first hover opens without a hitch.
  useEffect(() => {
    if (!booted) return;
    const root = garageRef.current;
    if (!root) return;
    const run = () => root.querySelectorAll<HTMLImageElement>("[data-scene] img").forEach((img) => img.decode().catch(() => {}));
    const w = window as Window & { requestIdleCallback?: Window["requestIdleCallback"] };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 600);
    return () => window.clearTimeout(t);
  }, [booted]);

  // Hover dwell (mouse only): rest on a film's bay and its loop starts playing there. On touch screens the
  // lit bay keeps showing the car itself, which is the point of the page (and saves data).
  useEffect(() => {
    if (!canHover || !activeCar || activeCar.type !== "film" || reduced) return;
    const slug = activeCar.slug;
    const t = window.setTimeout(() => setPlaying(slug), 1100);
    return () => window.clearTimeout(t);
  }, [activeCar, canHover, reduced]);

  useEffect(() => () => window.clearTimeout(strikeTimer.current), []);

  const pickFilter = (f: Filter) => {
    const wasOff = (c: LineupCar) => filter !== "all" && c.type !== filter;
    const willBeOff = (c: LineupCar) => f !== "all" && c.type !== f;
    setStrike(LINEUP.filter((c) => wasOff(c) && !willBeOff(c)).map((c) => c.slug));
    window.clearTimeout(strikeTimer.current);
    strikeTimer.current = window.setTimeout(() => setStrike([]), 900);
    setFilter(f);
    setPlaying(null);
  };

  // Now and then one tube flickers (a real car park is never perfect). Not on reduced motion.
  useEffect(() => {
    if (!booted || reduced) return;
    let t = 0;
    let off = 0;
    const next = () => {
      t = window.setTimeout(() => {
        const pool = LINEUP.filter((c) => c.slug !== active);
        setFlick(pool[Math.floor(Math.random() * pool.length)].slug);
        off = window.setTimeout(() => setFlick(null), 700);
        next();
      }, 5200 + Math.random() * 4200);
    };
    next();
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(off);
    };
  }, [booted, reduced, active]);

  // Touch screens: the bay crossing the middle of the screen is the lit one.
  useEffect(() => {
    if (canHover) return;
    const root = garageRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.slug ?? null);
      },
      { rootMargin: "-46% 0px -46% 0px" },
    );
    root.querySelectorAll("[data-slug]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [canHover]);

  const enter = (c: LineupCar) => {
    if (isOff(c)) return;
    if (c.slug !== active) setPlaying(null);
    setActive(c.slug);
  };

  return (
    <main className={s.page}>
      <header className={s.head}>
        <div className={s.headMain}>
          <p className={`t-label ${s.kicker}`}>
            <span>Work</span>
            <span className={s.dot} aria-hidden="true" />
            <span>{String(LINEUP.length).padStart(2, "0")} parked · 01 free</span>
          </p>
          <h1 className={s.title}>Know them by their shape.</h1>
        </div>
        <div className={s.headSide}>
          <p className={s.lede}>Every car we have made, parked in one place. Find the one you know and open its film.</p>
          <div className={s.filters} role="group" aria-label="Show">
            {(["all", "film", "stills"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={s.filter}
                aria-pressed={filter === f}
                onClick={() => pickFilter(f)}
                data-no-roll
              >
                {f === "all" ? "All" : f === "film" ? "Films" : "Stills"} <span>{String(COUNT[f]).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <section
        ref={garageRef}
        className={s.garage}
        aria-label="Projects"
        data-boot={booted ? "on" : "off"}
        data-active={activeCar ? "" : undefined}
        onPointerMove={onMove}
        onPointerLeave={(e) => {
          if (!canHover) return;
          e.currentTarget.style.setProperty("--px", "0px");
          setActive(null);
          setPlaying(null);
        }}
      >
        <div className={s.slab} aria-hidden="true">
          <span className={s.datum}>Roof · +09.00</span>
        </div>
        {LEVELS.map((cars, li) => (
          <div key={li} className={s.level} data-on={activeLevel === li ? "" : undefined}>
            <div className={s.bays}>
              {cars.map((c) => (
                <Bay
                  key={c.slug}
                  car={c}
                  index={LINEUP.indexOf(c)}
                  on={activeCar?.slug === c.slug}
                  off={isOff(c)}
                  play={playing === c.slug && activeCar?.slug === c.slug}
                  flick={flick === c.slug}
                  strike={strike.includes(c.slug)}
                  onEnter={() => canHover && enter(c)}
                  onFocus={() => enter(c)}
                />
              ))}
            </div>
            <div className={s.slab} aria-hidden="true">
              <span className={s.datum}>
                Level {String(3 - li).padStart(2, "0")} · {li === 2 ? "±00.00" : `+0${(2 - li) * 3}.00`}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className={s.free} aria-label="Start a project">
        <div className={s.freeBay}>
          <span className={s.freeLed} aria-hidden="true" />
          <span className={s.freeNo} aria-hidden="true">
            10
          </span>
          <div className={s.freeText}>
            <p className="t-label">Bay 10 · Free</p>
            <p className={s.freeTitle}>Your launch parks here next.</p>
          </div>
          <span className={s.freeLines} aria-hidden="true">
            <span>Reserved</span>
          </span>
          <Link href="/#contact" className={s.freeCta}>
            <Chevron /> Let&apos;s talk
          </Link>
        </div>
      </section>
    </main>
  );
}

type BayProps = {
  car: LineupCar;
  index: number;
  on: boolean;
  off: boolean;
  play: boolean;
  flick: boolean;
  strike: boolean;
  onEnter: () => void;
  onFocus: () => void;
};

function Bay({ car: c, index, on, off, play, flick, strike, onEnter, onFocus }: BayProps) {
  const { bx, by, bw, bh } = c.box;
  const style = {
    "--d": `${bootDelay(index)}ms`,
    "--w": c.w,
    "--ar": c.box.car,
  } as CSSProperties;
  // The scene frame, sized and offset so the car inside it lands exactly on the cut-out.
  const sceneStyle = {
    width: `${100 / bw}%`,
    height: `${100 / bh}%`,
    left: `${(-bx / bw) * 100}%`,
    top: `${(-by / bh) * 100}%`,
    "--cx": `${(bx + bw / 2) * 100}%`,
    "--cy": `${(by + bh / 2) * 100}%`,
  } as CSSProperties;

  return (
    <Link
      href={`/work/${c.slug}`}
      className={s.bay}
      style={style}
      data-slug={c.slug}
      data-on={on ? "" : undefined}
      data-off={off ? "" : undefined}
      data-play={play ? "" : undefined}
      data-flick={flick ? "" : undefined}
      data-strike={strike ? "" : undefined}
      aria-label={`${c.title}, ${c.format}`}
      tabIndex={off ? -1 : undefined}
      onPointerEnter={onEnter}
      onFocus={onFocus}
      data-no-roll
    >
      <span className={s.stripe} aria-hidden="true" />
      <span className={s.pool} aria-hidden="true" />

      <span className={s.car} aria-hidden="true">
        <picture className={s.scene} style={sceneStyle} data-scene>
          <source type="image/avif" srcSet={sceneSet(c.slug, "avif")} sizes="(max-width: 899px) 170vw, 64vw" />
          <img src={sceneSrc(c.slug)} srcSet={sceneSet(c.slug, "webp")} sizes="(max-width: 899px) 170vw, 64vw" alt="" loading="lazy" decoding="async" fetchPriority="low" />
        </picture>
        <span className={s.shade} />
        <span className={s.shadow} />
        <picture className={s.reflect}>
          <source type="image/avif" srcSet={carSet(c.slug, "avif")} sizes="(max-width: 899px) 82vw, 36vw" />
          <img src={carSrc(c.slug)} srcSet={carSet(c.slug, "webp")} sizes="(max-width: 899px) 82vw, 36vw" alt="" decoding="async" />
        </picture>
        <picture className={s.body}>
          <source type="image/avif" srcSet={carSet(c.slug, "avif")} sizes="(max-width: 899px) 82vw, 36vw" />
          <img src={carSrc(c.slug)} srcSet={carSet(c.slug, "webp")} sizes="(max-width: 899px) 82vw, 36vw" alt="" decoding="async" fetchPriority={index < 3 ? "high" : "auto"} />
        </picture>
      </span>

      {play && (
        <video
          className={s.film}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
          aria-hidden="true"
          onPlaying={(e) => {
            e.currentTarget.dataset.ready = "";
          }}
        >
          {loopSources(c.slug).map((src) => (
            <source key={src.src} src={src.src} type={src.type} />
          ))}
        </video>
      )}

      <span className={s.veil} aria-hidden="true" />
      <span className={s.cone} aria-hidden="true" />
      <span className={s.tube} aria-hidden="true" />
      <span className={s.led} aria-hidden="true" />

      <span className={s.tag} aria-hidden="true">
        <span className={s.no}>{c.n}</span>
        <span className={s.kind}>{c.format}</span>
      </span>

      <span className={s.plate}>
        <span className={s.plateBand} aria-hidden="true">
          <Chevron />
        </span>
        <span className={s.plateName}>{c.title}</span>
      </span>

      <span className={s.open} aria-hidden="true">
        {c.type === "film" ? "Open film" : "Open stills"} <Chevron />
      </span>
    </Link>
  );
}
