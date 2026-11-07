"use client";

import type { CSSProperties } from "react";
import type { CaseData } from "@/content/cases";
import { Chevron } from "@/components/work/Chevron";
import { PlayButton } from "./PlayButton";
import { useReveal } from "./reveal";
import s from "./shared.module.css";
import c from "./case.module.css";

const pad2 = (n: number) => String(n).padStart(2, "0");

type Props = {
  data: CaseData;
  /** Spec list on the left, intro on the right. */
  flip?: boolean;
  /** "Watch the full film" under the spec list (films only). */
  showPlay?: boolean;
};

/**
 * Title-side facts: the intro text box (lead + body, draft until Adil sends copy) and the spec list
 * (Client, Brand, Year, Our role, Services, Format, Runtime/Stills) with mono labels.
 * Values still to confirm read "To confirm" in a quiet dashed style.
 */
export function SpecSheet({ data, flip = false, showPlay = true }: Props) {
  const ref = useReveal<HTMLElement>();
  const id = `${data.slug}-about`;
  return (
    <section ref={ref} className={`${s.section} ${c.spec}`} data-flip={flip || undefined} aria-labelledby={id}>
      <div className={c.specIntro}>
        <p className={`t-label ${s.kicker} ${s.reveal}`}>
          <Chevron className={s.keyChev} />
          <span id={id}>Case study</span>
          <span className={s.keyNum}>
            {pad2(data.index + 1)} / {pad2(data.total)}
          </span>
        </p>
        {/* CONFIRM WITH ADIL: intro copy */}
        <div className={`${s.box} ${c.introBox}`}>
          {data.intro.draft ? <span className={s.draft}>Text box · draft copy</span> : null}
          <p className={`${s.lead} ${s.reveal}`} style={{ "--d": 80 } as CSSProperties}>
            {data.intro.lead}
          </p>
          {data.intro.body ? (
            <p className={`${s.body} ${s.reveal}`} style={{ "--d": 200 } as CSSProperties}>
              {data.intro.body}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <dl className={c.specList}>
          {data.spec.map((f, i) => (
            <div key={f.label} className={`${c.specRow} ${s.reveal}`} style={{ "--d": 120 + i * 60 } as CSSProperties}>
              <dt className="t-label">{f.label}</dt>
              <dd className={f.confirm ? s.tbc : undefined}>{f.value}</dd>
            </div>
          ))}
        </dl>
        {showPlay && data.film ? (
          <div className={`${c.specPlay} ${s.reveal}`} style={{ "--d": 560 } as CSSProperties}>
            <PlayButton data={data} variant="line" label="Watch the full film" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
