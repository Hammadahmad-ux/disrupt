"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { PROJECTS } from "@/content/projects";
import type { CaseData } from "@/content/cases";
import { getLenis } from "@/components/providers/lenis-ref";
import { PlayButton } from "@/components/case/shared/PlayButton";
import { useStage } from "./stage-store";
import { formatLabel, pad2 } from "./work-meta";
import { Chevron } from "./Chevron";
import styles from "./work.module.css";

// Case hero: the film stage (app/work/layout.tsx) IS the hero, so the loop that filled the roster's letters
// keeps playing here without a cut. Title bottom-left with a short rule in the project's key colour,
// "Play film" (lights-down player) bottom-right for films. `layer`: an optional template layer between the
// stage and the title (e.g. the stills strobe); it can paint the title by setting data-fill and
// --title-fill on the [data-case-hero] element.
export default function CaseHero({ data, layer }: { data: CaseData; layer?: ReactNode }) {
  const p = PROJECTS[data.index];

  useEffect(() => {
    const st = useStage.getState();
    st.setMode("hero", data.slug);
    // "Back to work" pulls back out of this project's row on the roster.
    st.setLast(data.slug);
    const lenis = getLenis();
    if (lenis) {
      lenis.start();
      lenis.scrollTo(0, { immediate: true, force: true });
    } else window.scrollTo(0, 0);
  }, [data.slug]);

  return (
    <section className={styles.caseHero} data-case-hero aria-labelledby="case-title">
      {layer ? <div className={styles.heroLayer}>{layer}</div> : null}
      <Link href="/work" className={`t-label ${styles.back}`}>
        <Chevron back /> Back to work
      </Link>
      <div className={styles.caseBottom}>
        <div className={styles.caseHead}>
          <p className={`t-label ${styles.caseMeta}`}>
            <span className={styles.rise}>
              {pad2(data.index + 1)} / {pad2(data.total)} <span aria-hidden="true">·</span> {data.kind}
            </span>
          </p>
          <h1 id="case-title" className={styles.caseTitle} data-case-title>
            <span className={styles.rise} style={{ animationDelay: "0.08s" }}>
              {data.title}
            </span>
          </h1>
          <div className={styles.caseFoot}>
            <span className={styles.caseRule} aria-hidden="true" />
            <p className={`t-label ${styles.caseMeta}`}>
              <span className={styles.rise} style={{ animationDelay: "0.16s" }}>
                {formatLabel(p)}
              </span>
            </p>
          </div>
        </div>
        {data.film ? (
          <div className={styles.casePlay}>
            <PlayButton data={data} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
