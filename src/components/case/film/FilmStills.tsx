"use client";

import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { lqipOf, stillSet, type CaseData } from "@/content/cases";
import { Chevron } from "@/components/work/Chevron";
import { Picture } from "../shared/Picture";
import { useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import s from "../shared/shared.module.css";
import f from "./film.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Stills block for a film project that also has stills (McLaren). A light-box strip: on desktop the
// section holds while scrolling drives the stills sideways under a fixed studio light, like cars rolling
// under a gantry; the counter follows. Phones and reduced motion: a plain swipe strip with snap points.
// Captions are draft: // CONFIRM WITH ADIL.
// Loading: the stills slide in sideways (the browser's lazy loading would only see them once on screen), so the
// whole strip starts loading 1.5 screens before the section, each still over its blurred stand-in.

const pad2 = (n: number) => String(n).padStart(2, "0");

export function FilmStills({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useReveal<HTMLDivElement>();
  const stills = data.stills;
  const first = stills[0];
  const sameMaster = stills.every((x) => x.masterW === first.masterW && x.masterH === first.masterH);
  const headId = `${data.slug}-stills`;
  useEagerNear(rootRef, "150% 0px", data.slug);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const stage = root.querySelector<HTMLElement>("[data-stage]")!;
      const track = root.querySelector<HTMLElement>("[data-track]")!;
      const count = root.querySelector<HTMLElement>("[data-count]")!;
      const items = [...track.querySelectorAll<HTMLElement>("[data-still]")];
      const mark = (i: number) => {
        count.textContent = pad2(i + 1);
        items.forEach((el, j) => el.toggleAttribute("data-on", j === i));
      };
      const mm = gsap.matchMedia();

      mm.add("(min-width: 761px) and (prefers-reduced-motion: no-preference)", () => {
        root.dataset.pin = "";
        const travel = () => Math.max(0, track.scrollWidth - stage.clientWidth);
        const setRunway = () => root.style.setProperty("--travel", `${travel()}px`);
        setRunway();
        gsap.to(track, {
          x: () => -travel(),
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: setRunway,
            onUpdate: (self) => mark(Math.round(self.progress * (items.length - 1))),
          },
        });
        const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
        return () => {
          cancelAnimationFrame(raf);
          delete root.dataset.pin;
          root.style.removeProperty("--travel");
        };
      });

      mm.add("(max-width: 760px), (prefers-reduced-motion: reduce)", () => {
        const onScroll = () => {
          const max = track.scrollWidth - track.clientWidth;
          mark(max > 0 ? Math.round((track.scrollLeft / max) * (items.length - 1)) : 0);
        };
        track.addEventListener("scroll", onScroll, { passive: true });
        return () => track.removeEventListener("scroll", onScroll);
      });
    },
    { scope: rootRef, dependencies: [data.slug], revertOnUpdate: true },
  );

  return (
    <section ref={rootRef} className={f.stills} aria-labelledby={headId}>
      <div className={f.stillsStage} data-stage>
        <div ref={headRef} className={f.stillsHead}>
          <div className={f.headMain}>
            <p className={`t-label ${s.kicker} ${s.reveal}`}>
              <Chevron className={s.keyChev} />
              <span>Also in stills</span>
              <span className={s.keyNum}>{pad2(stills.length)}</span>
            </p>
            <h2 id={headId} className={`${s.h2} ${s.reveal}`} style={{ "--d": 80 } as CSSProperties}>
              Stills
            </h2>
          </div>
          <div className={`${f.stillsMeta} ${s.reveal}`} style={{ "--d": 160 } as CSSProperties}>
            <p className={f.count} aria-hidden="true">
              <span data-count>01</span>
              <span className={f.countOf}> / {pad2(stills.length)}</span>
            </p>
            <p className="t-label">
              {sameMaster ? `${first.masterW} × ${first.masterH} masters` : "Full-resolution masters"} · captions draft
            </p>
          </div>
        </div>

        <div className={f.trackWrap}>
          <ul className={f.stillTrack} data-track tabIndex={0} aria-label={`${data.title} stills`}>
            {stills.map((st, i) => (
              <li
                key={st.n}
                className={f.stillItem}
                data-still
                data-on={i === 0 || undefined}
                style={{ "--ar": st.w / st.h } as CSSProperties}
              >
                <figure className={f.stillFig}>
                  <div className={`${s.media} ${f.stillMedia}`} style={{ "--ar": st.w / st.h } as CSSProperties}>
                    <Picture
                      set={stillSet(data.slug, st.n)}
                      w={st.w}
                      h={st.h}
                      alt={st.alt}
                      sizes="(max-width: 760px) 86vw, 62vw"
                      lqip={lqipOf(data, "stills", st.n)}
                    />
                  </div>
                  <figcaption className={f.figcap}>
                    <span className={`${s.tc} ${s.keyNum}`}>{pad2(st.n)}</span>
                    {/* CONFIRM WITH ADIL: caption */}
                    <span className={f.stillCap}>{st.caption}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <span className={f.gantry} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
