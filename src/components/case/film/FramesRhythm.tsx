"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { frameSet, lqipOf, mmss, timecode, type CaseData, type Shot } from "@/content/cases";
import { filmVariant, rhythmFor, rhythmSet } from "./film-variants";
import { Chevron } from "@/components/work/Chevron";
import { openFilm, warmFilm } from "../shared/film-player-store";
import { Picture } from "../shared/Picture";
import { useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import s from "../shared/shared.module.css";
import f from "./film.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Frames rhythm: frames from the film at a size the shot viewer cannot give them, in one of three
// layouts (layout.framesPreset) so the pages differ: "full" (full-bleed run; 5:2 films get a black
// letterbox matte), "two-up" (staggered pairs that move at different speeds), "offset" (one frame and a
// studio note per row, alternating sides). Each frame arrives in matte primer and the studio light,
// tied to scroll, passes over it and leaves the paint behind, the same move as the Work roster.
// Every frame is a button that plays the film from that shot. Reduced motion: painted, no parallax.
// Loading: each picture carries its blurred stand-in and the section's pictures start loading 1.5 screens
// ahead, so the light always leaves the real frame behind it.

const pad2 = (n: number) => String(n).padStart(2, "0");
const COUNT = { full: 3, "two-up": 4, offset: 3 } as const;

// CONFIRM WITH ADIL: studio notes beside the frames ("offset" layout).
const NOTES = [
  { label: "Studio note · the look", text: "Copy to come: a short note from the studio on the look of this sequence." },
  { label: "Studio note · the build", text: "Copy to come: what was modelled, lit and simulated for these shots." },
  { label: "Studio note · the light", text: "Copy to come: how the light was set up, and why." },
];

/** k frames spread evenly through the film (never the same one twice). */
function pick(shots: Shot[], k: number) {
  const out: Shot[] = [];
  for (let j = 0; j < k; j++) {
    const sh = shots[Math.min(shots.length - 1, Math.floor(((j + 0.5) * shots.length) / k))];
    if (sh && !out.includes(sh)) out.push(sh);
  }
  return out;
}

/** One frame of the rhythm: its picture, caption, stand-in and where "Play from" starts the film. */
type Item = {
  n: number;
  w: number;
  h: number;
  at: number;
  play: number;
  title: string;
  set: ReturnType<typeof frameSet>;
  lqip?: string;
};

/** The rhythm's own frames (moments that are not in "In this shot", rhythm-frames.json), or, for a film
 *  without them, shot frames spread through the film. */
function itemsFor(data: CaseData, k: number): Item[] {
  const own = rhythmFor(data);
  if (own.length) return own.map((f) => ({ ...f, set: rhythmSet(data.slug, f.n), lqip: lqipOf(data, "rhythm", f.n) }));
  return pick(data.shots, k).map((sh) => ({
    n: sh.n,
    w: sh.w,
    h: sh.h,
    at: sh.at,
    play: sh.in,
    title: sh.title,
    set: frameSet(data.slug, sh.n),
    lqip: lqipOf(data, "frames", sh.n),
  }));
}

type FrameProps = {
  shot: Item;
  sizes: string;
  /** Parallax speed: 0 = moves with the page; positive = drifts up faster (depth). */
  speed?: number;
  /** Black letterbox matte (5:2 films in the full-bleed run). */
  matte?: boolean;
};

function Frame({ shot, sizes, speed = 0, matte = false }: FrameProps) {
  const button = (
    <button
      type="button"
      className={f.shot}
      data-shot
      style={{ "--ar": shot.w / shot.h } as CSSProperties}
      // Hold this very frame while the film buffers from here.
      onClick={() => openFilm({ at: shot.play, poster: shot.set.src })}
      onPointerEnter={warmFilm}
      onFocus={warmFilm}
      aria-haspopup="dialog"
      aria-label={`Play the film from ${mmss(shot.play)}: ${shot.title}`}
    >
      <span className={f.par} data-par>
        <Picture set={shot.set} w={shot.w} h={shot.h} alt="" sizes={sizes} lqip={shot.lqip} />
      </span>
      <span className={f.primerLayer} aria-hidden="true" />
      <span className={f.band} aria-hidden="true" />
      <span className={f.framePlay} aria-hidden="true">
        <span className={f.ring}>
          <Chevron className={s.keyChev} />
        </span>
        Play from {mmss(shot.play)}
      </span>
    </button>
  );
  const caption = (
    <figcaption className={matte ? `${f.figcap} ${f.matteCap}` : f.figcap}>
      <span className={`${s.tc} ${s.keyNum}`}>{pad2(shot.n)}</span>
      <span className={f.capTitle}>{shot.title}</span>
      <span className={`${s.tc} ${f.capTc}`}>{timecode(shot.at)}</span>
    </figcaption>
  );
  return (
    <figure className={f.fig} data-fx data-speed={speed || undefined}>
      {matte ? (
        // 5:2: the frame in a black letterbox; the ratio sits in the top bar, the caption in the bottom one.
        <div className={f.matte}>
          <span className={`${s.tc} ${f.matteTl}`} aria-hidden="true">
            2.50 : 1
          </span>
          {button}
          {caption}
        </div>
      ) : (
        <>
          {button}
          {caption}
        </>
      )}
    </figure>
  );
}

export function FramesRhythm({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useReveal<HTMLElement>();
  const preset = data.layout.framesPreset;
  const picks = itemsFor(data, COUNT[preset]);
  const { framesTitle } = filmVariant(data);
  const wide = data.aspect > 2;
  const headId = `${data.slug}-frames`;
  useEagerNear(rootRef, "150% 0px", data.slug);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        root.querySelectorAll<HTMLElement>("[data-fx]").forEach((fig) => {
          const shot = fig.querySelector<HTMLElement>("[data-shot]")!;
          const par = fig.querySelector<HTMLElement>("[data-par]")!;
          // Depth inside the frame: the picture drifts against the page.
          gsap.fromTo(
            par,
            { yPercent: -3.2 },
            { yPercent: 3.2, ease: "none", scrollTrigger: { trigger: shot, start: "top bottom", end: "bottom top", scrub: true } },
          );
          // Primer to paint under the light, tied to scroll.
          gsap.fromTo(
            shot,
            { "--sweep": 0 },
            // Painted by the time the frame is half in view, so a frame is never seen grey for long.
            { "--sweep": 1, ease: "none", scrollTrigger: { trigger: shot, start: "top 96%", end: "top 42%", scrub: 0.5 } },
          );
          const sp = Number(fig.dataset.speed || 0);
          if (sp) {
            gsap.fromTo(
              fig,
              { y: sp * 70 },
              { y: -sp * 70, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } },
            );
          }
        });
      });
    },
    { scope: rootRef, dependencies: [data.slug], revertOnUpdate: true },
  );

  const sizesFull = "100vw";
  const sizesBig = "(max-width: 760px) 100vw, 58vw";
  const sizesSmall = "(max-width: 760px) 80vw, 34vw";

  return (
    <section ref={rootRef} className={f.frames} data-preset={preset} aria-labelledby={headId}>
      <header ref={headRef} className={f.framesHead}>
        <div className={f.headMain}>
          <p className={`t-label ${s.kicker} ${s.reveal}`}>
            <Chevron className={s.keyChev} />
            <span>Frames</span>
            <span className={s.keyNum}>{pad2(picks.length)}</span>
          </p>
          <h2 id={headId} className={`${s.h2} ${s.reveal}`} style={{ "--d": 80 } as CSSProperties}>
            {/* CONFIRM WITH ADIL: draft heading */}
            {framesTitle}
          </h2>
        </div>
        {preset !== "offset" ? (
          // CONFIRM WITH ADIL: a line on the look of the film
          <div className={`${s.box} ${s.reveal}`} style={{ "--d": 160 } as CSSProperties}>
            <span className={s.draft}>Text box · copy to come</span>
            <p className={s.body}>A few words from the studio on the look of the film: the grade, the light and the lenses.</p>
          </div>
        ) : (
          <p className={`${s.body} ${s.reveal} ${f.headAside}`} style={{ "--d": 160 } as CSSProperties}>
            Select a frame to watch the film from that moment.
          </p>
        )}
      </header>

      {preset === "full" ? (
        <div className={f.fullStack}>
          {picks.map((sh) => (
            <Frame key={sh.n} shot={sh} sizes={sizesFull} matte={wide} />
          ))}
        </div>
      ) : null}

      {preset === "two-up" ? (
        <div className={f.twoUp}>
          {Array.from({ length: Math.ceil(picks.length / 2) }, (_, r) => {
            const [a, b] = [picks[r * 2], picks[r * 2 + 1]];
            return (
              <div key={a.n} className={f.pair} data-flip={r % 2 === 1 || undefined}>
                <Frame shot={a} sizes={sizesBig} />
                {b ? <Frame shot={b} sizes={sizesSmall} speed={1} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {preset === "offset" ? (
        <div className={f.offset}>
          {picks.map((sh, k) => {
            const note = NOTES[k % NOTES.length];
            return (
              <div key={sh.n} className={f.offRow} data-flip={k % 2 === 1 || undefined}>
                <Frame shot={sh} sizes={sizesBig} />
                {/* CONFIRM WITH ADIL: studio note */}
                <div className={`${s.box} ${f.note}`} data-fx-note>
                  <span className={s.draft}>Text box · copy to come</span>
                  <p className={`t-label ${f.noteLabel}`}>{note.label}</p>
                  <p className={s.body}>{note.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
