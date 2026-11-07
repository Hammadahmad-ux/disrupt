"use client";

import { useState, type CSSProperties } from "react";
import type { CreditGroup } from "@/content/cases";
import { useReveal } from "./reveal";
import s from "./shared.module.css";
import c from "./case.module.css";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Credits as an accordion (the lists will be long once Adil sends them). The first group starts open.
 * Each header is a real button (aria-expanded / aria-controls); closed panels are inert.
 */
export function Credits({ slug, groups }: { slug: string; groups: CreditGroup[] }) {
  const [open, setOpen] = useState<boolean[]>(() => groups.map((_, i) => i === 0));
  const ref = useReveal<HTMLElement>();
  const id = `${slug}-credits`;
  return (
    <section ref={ref} className={`${s.section} ${c.credits}`} aria-labelledby={id}>
      <div className={`${c.creditsHead} ${s.reveal}`}>
        <h2 id={id} className={s.h2}>
          Credits
        </h2>
        {/* CONFIRM WITH ADIL: full credits list */}
        <p className={c.creditsNote}>Full credits to follow from the studio.</p>
      </div>
      <ul className={`${c.acc} ${s.reveal}`} style={{ "--d": 120 } as CSSProperties}>
        {groups.map((g, i) => {
          const panel = `${id}-${i}`;
          return (
            <li key={g.group} className={c.accItem}>
              <h3 className={c.accHead}>
                <button
                  type="button"
                  className={c.accBtn}
                  aria-expanded={open[i]}
                  aria-controls={panel}
                  onClick={() => setOpen((o) => o.map((v, j) => (j === i ? !v : v)))}
                  data-no-roll
                >
                  <span className={c.accName}>{g.group}</span>
                  <span className={`t-label ${c.accCount}`}>{pad2(g.items.length)}</span>
                  <span className={c.accSign} aria-hidden="true" />
                </button>
              </h3>
              <div id={panel} className={c.accPanel} data-open={open[i] || undefined} inert={!open[i]}>
                <div className={c.accInner}>
                  <dl className={c.accList}>
                    {g.items.map((it) => (
                      <div key={it.role} className={c.accRow}>
                        <dt className="t-label">{it.role}</dt>
                        <dd className={it.confirm ? s.tbc : undefined}>{it.name}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
