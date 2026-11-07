import type { ReactNode } from "react";
import { Chevron } from "@/components/work/Chevron";
import s from "./legal.module.css";

// Shared frame for the legal pages (/privacy, /terms): small mono eyebrow, the title in the site's wide
// display type, the "Last updated" date, then one calm reading column. The page passes its sections
// (h2 + p/ul) as children; the styles below set their rhythm.
export default function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <p className={`t-label ${s.eyebrow}`}>
          <Chevron className={s.eyebrowChev} />
          {eyebrow}
        </p>
        <h1 className={s.title}>{title}</h1>
        <p className={`t-label ${s.updated}`}>
          Last updated <time dateTime="2026-10-27">27 October 2026</time>
        </p>
      </header>
      {/* Inline links in running text stay plain (no letter roll). */}
      <div className={s.body} data-no-roll>
        {children}
      </div>
    </div>
  );
}
