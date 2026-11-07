"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { MEDIA, PROJECTS } from "@/content/projects";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { WORK_META, pad2 } from "./work-meta";
import { lqipBg } from "./lqip";
import { CASE_PAGES_LINKED } from "@/content/site";
import { Chevron } from "./Chevron";
import s from "./work-grid.module.css";

// Work index: a plain grid of 16:9 pictures, one per project, where the car's shape reads clearly (client:
// "this page has to be simple... I need to be able to show the work simply"; people know a car by its shape).
// With a mouse, every picture names its project small at rest; hover or keyboard focus darkens that one
// picture and grows the name. On touch screens the name sits under the picture, so nothing covers the car.
// The only other motion is a gentle fade of the tiles on the first view of the page in a visit (none with
// reduced motion, none on the way back from a project).
// Pictures: web/public/media/work-index/grid/<slug>-{640,960,1600}.{avif,webp}, built by
// scripts/media/build-work-grid.mjs.
//
// Loading: the first two rows load at once (the first row first), the rest as they come near; a blurred
// placeholder of each picture sits behind it until it is in. Tiles link to the case pages only while
// CASE_PAGES_LINKED is on (content/site.ts).

const pic = (slug: string, w: number, ext: "avif" | "webp") => `${MEDIA}/work-index/grid/${slug}-${w}.${ext}`;
const set = (slug: string, ext: "avif" | "webp") => [640, 960, 1600].map((w) => `${pic(slug, w, ext)} ${w}w`).join(", ");

// 3 columns from 1100px, 2 from 640px (the first project spans both, so 9 tiles leave no gap), 1 on phones.
const SIZES = "(min-width: 1100px) 33.4vw, (min-width: 640px) 50vw, 100vw";
const SIZES_FIRST = "(min-width: 1100px) 33.4vw, 100vw";

const REDUCED = "(prefers-reduced-motion: reduce)";

// The fade plays once per visit: coming back to /work (browser Back, the case page's link) shows the grid at once.
let faded = false;

// A tile links to its case page only while case pages are linked (content/site.ts); otherwise it is a plain picture.
function Tile({ slug, label, style, children }: { slug: string; label: string; style: CSSProperties; children: ReactNode }) {
  if (CASE_PAGES_LINKED) {
    return (
      <Link href={`/work/${slug}`} className={s.tile} aria-label={label} data-tile data-no-roll style={style}>
        {children}
      </Link>
    );
  }
  return (
    <div className={s.tile} role="img" aria-label={label} data-tile data-static style={style}>
      {children}
    </div>
  );
}

export default function WorkGrid() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Hide the tiles before first paint (only when motion is fine), so they can fade in.
  useLayoutEffect(() => {
    if (faded || matchMedia(REDUCED).matches) return;
    rootRef.current!.dataset.reveal = "";
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    if (!("reveal" in root.dataset)) return;
    const tiles = [...root.querySelectorAll<HTMLElement>("[data-tile]")];
    const io = new IntersectionObserver(
      (entries) => {
        // Tiles that come in together sweep in left to right.
        const fresh = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        fresh
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
          .forEach((el, k) => {
            el.style.setProperty("--d", `${k * 70}ms`);
            el.dataset.in = "";
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    const start = () => {
      window.clearTimeout(failsafe);
      faded = true;
      tiles.forEach((t) => io.observe(t));
    };
    // On a first visit the loader is up: wait for it, so the fade is seen (never longer than 6 s).
    const failsafe = window.setTimeout(start, useIntro.getState().done ? 0 : 6000);
    if (!useIntro.getState().done) window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      window.clearTimeout(failsafe);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={s.page}>
      <header className={s.head} id="top">
        <p className={`t-label ${s.eyebrow}`}>
          Work <span aria-hidden="true">·</span> <span className={s.count}>{pad2(PROJECTS.length)}</span>
          <span className="sr-only"> projects</span>
        </p>
        <h1 className={s.title}>Selected work.</h1>
      </header>

      <ul className={s.grid} id="work" aria-label="Projects">
        {PROJECTS.map((p, i) => (
          <li key={p.slug} className={s.item}>
            <Tile slug={p.slug} label={`${p.title}, ${p.kind}`} style={{ "--key": WORK_META[p.slug]?.key ?? "#444" } as CSSProperties}>
              <span className={s.frame}>
                <picture className={s.pic}>
                  <source type="image/avif" srcSet={set(p.slug, "avif")} sizes={i === 0 ? SIZES_FIRST : SIZES} />
                  <img
                    src={pic(p.slug, 960, "webp")}
                    srcSet={set(p.slug, "webp")}
                    sizes={i === 0 ? SIZES_FIRST : SIZES}
                    width={1600}
                    height={900}
                    alt=""
                    loading={i < 6 ? "eager" : "lazy"}
                    fetchPriority={i < 3 ? "high" : undefined}
                    decoding="async"
                    style={lqipBg(`grid/${p.slug}`)}
                  />
                </picture>

                {/* Mouse, at rest: the name and what we made, small. */}
                <span className={`t-label ${s.label}`} aria-hidden="true">
                  <span className={s.labelName}>{p.title}</span>
                  <span> · </span>
                  <span className={s.labelKind}>{p.kind}</span>
                </span>

                {/* Mouse, on hover / keyboard focus: the name large, and where the link goes. */}
                <span className={s.focus} aria-hidden="true">
                  <span className={s.focusName}>{p.title}</span>
                  <span className={`t-label ${s.focusCta}`}>
                    <span className={s.rule} />
                    {CASE_PAGES_LINKED ? (
                      <>
                        View project
                        <Chevron className={s.chev} />
                      </>
                    ) : (
                      p.kind
                    )}
                  </span>
                </span>
              </span>

              {/* Touch screens: the name under the picture, so it never covers the car. */}
              <span className={s.cap} aria-hidden="true">
                <span className={s.capName}>{p.title}</span>
                <span className={`t-label ${s.capKind}`}>{p.kind}</span>
                {CASE_PAGES_LINKED && <Chevron className={s.capChev} />}
              </span>
            </Tile>
          </li>
        ))}
      </ul>
    </div>
  );
}
