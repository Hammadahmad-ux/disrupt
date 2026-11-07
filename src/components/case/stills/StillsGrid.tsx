"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { lqipOf, stillSet, type CaseData, type CaseStill } from "@/content/cases";
import { Chevron } from "@/components/work/Chevron";
import { Picture } from "../shared/Picture";
import { useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import s from "../shared/shared.module.css";
import x from "./stills.module.css";
import { loupeFor, pad2, variantFor } from "./stills-variants";

/** 1 / 2 / 1 / 2 … rows; a pair row with one still left becomes a single. */
function rowsOf(list: CaseStill[]) {
  const rows: CaseStill[][] = [];
  let i = 0;
  let single = true;
  while (i < list.length) {
    if (single || list.length - i === 1) {
      rows.push([list[i]]);
      i += 1;
    } else {
      rows.push([list[i], list[i + 1]]);
      i += 2;
    }
    single = !single;
  }
  return rows;
}

// The rest of the set (every still but the one under the loupe) in a 1/2/1 rhythm with captions. Each print
// arrives in primer (grey, unlit) and a softbox sweeps across it, leaving the finished picture behind:
// primer to paint, the look-dev language of the Work page. Variants (stills-variants.ts): "bleed" runs the
// singles edge to edge with level pairs; "inset" alternates the singles left and right with the caption in
// the free columns and staggers the pairs. Reduced motion: no sweep.
// Loading: every print carries its blurred stand-in and the set starts loading 1.5 screens ahead, so the
// sweep always leaves the finished picture behind it.
export function StillsGrid({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useReveal<HTMLDivElement>();
  const v = variantFor(data);
  const loupe = loupeFor(data);
  const rest = data.stills.filter((st) => st.n !== loupe?.n);
  const rows = rowsOf(rest);
  const id = `${data.slug}-prints`;
  useEagerNear(rootRef, "150% 0px", data.slug);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const prints = [...root.querySelectorAll<HTMLElement>("[data-print]")];
    const tweens: gsap.core.Tween[] = [];
    prints.forEach((p) => p.style.setProperty("--p", "0"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const el = e.target as HTMLElement;
          const d = Number(el.dataset.delay || 0);
          tweens.push(gsap.to(el, { "--p": 1, duration: 1.7, delay: d, ease: "power2.inOut" }));
        }
      },
      { threshold: 0.28 },
    );
    prints.forEach((p) => io.observe(p));
    return () => {
      io.disconnect();
      tweens.forEach((t) => t.kill());
      prints.forEach((p) => p.style.removeProperty("--p"));
    };
  }, [data.slug]);

  if (!rows.length) return null;
  // Singles alternate sides (used by the "inset" variant).
  const sides = rows.map((row, i) =>
    row.length === 1 ? (rows.slice(0, i).filter((q) => q.length === 1).length % 2 ? "right" : "left") : undefined,
  );

  return (
    <section ref={rootRef} className={x.prints} data-grid={v.grid} aria-labelledby={id}>
      <div ref={headRef} className={x.printsHead}>
        <div className={x.headText}>
          <p className={`t-label ${s.kicker} ${s.reveal}`}>
            <Chevron className={s.keyChev} />
            <span id={id}>The set</span>
            <span className={x.draftTag}>Captions · draft</span>
          </p>
          <span className={`${s.keyRule} ${s.reveal}`} style={{ "--d": 120 } as CSSProperties} aria-hidden="true" />
        </div>
        {/* CONFIRM WITH ADIL: a short note on how the set was made */}
        <div className={`${s.box} ${x.printsBox}`}>
          <span className={s.draft}>Text box · draft copy</span>
          <p className={`${s.lead} ${s.reveal}`} style={{ "--d": 80 } as CSSProperties}>
            How the set was made.
          </p>
          <p className={`${s.body} ${s.reveal}`} style={{ "--d": 180 } as CSSProperties}>
            A short note from the studio on the build, the light and the finish of these frames.
          </p>
        </div>
      </div>

      {rows.map((row, ri) => {
        const isSingle = row.length === 1;
        const side = sides[ri];
        return (
          <div key={row.map((r) => r.n).join("-")} className={`${x.row} ${isSingle ? x.rowSingle : x.rowPair}`} data-side={side}>
            {row.map((st, j) => {
              const ar = st.w / st.h;
              return (
                <figure
                  key={st.n}
                  className={x.print}
                  data-print
                  data-delay={j ? 0.18 : 0}
                  data-tall={ar < 1 || undefined}
                  style={{ "--ar": ar } as CSSProperties}
                >
                  <div className={x.printMedia}>
                    <Picture
                      set={stillSet(data.slug, st.n)}
                      w={st.w}
                      h={st.h}
                      alt={st.alt}
                      sizes={isSingle ? (v.grid === "bleed" ? "100vw" : "(max-width: 760px) 100vw, 66vw") : "(max-width: 760px) 86vw, 50vw"}
                      lqip={lqipOf(data, "stills", st.n)}
                    />
                    <span className={x.prime} aria-hidden="true" />
                    <span className={x.sweep} aria-hidden="true" />
                  </div>
                  {/* CONFIRM WITH ADIL: caption */}
                  <figcaption className={x.cap}>
                    <span className={`${s.tc} ${s.keyNum}`}>{pad2(st.n)}</span>
                    <span className={x.capText}>{st.caption}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
