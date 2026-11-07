import Link from "next/link";
import { getCase, frameSet, stillSet, stillSrc, frameSrc, lqipOf, type CaseData } from "@/content/cases";
import { MEDIA } from "@/content/projects";
import { CASE_PAGES_LINKED } from "@/content/site";
import { rhythmFor, rhythmSet } from "@/components/case/film/film-variants";
import { withLqip } from "@/components/case/shared/lqip";
import { Chevron } from "@/components/work/Chevron";
import CaseFilm from "./CaseFilm";
import Gallery, { type GalleryItem } from "./Gallery";
import s from "./simple.module.css";

// A case study, kept simple (client feedback 2026-10-24, ref recomfarmhouse.com project pages; 2026-10-31: no intro
// text and no credits; Adil 2026-11-04: just the main title): title, the film playing by itself, then every picture from the project in one grid you
// scroll down. Pictures open full size in a simple viewer.

const pad2 = (n: number) => String(n).padStart(2, "0");
const rhythmFull = (slug: string, n: number) => `${MEDIA}/work/${slug}/rhythm/${pad2(n)}.webp`;
const gridPic = (slug: string) => `${MEDIA}/work-index/grid/${slug}-640.webp`;

function pictures(d: CaseData): GalleryItem[] {
  // Film frames: the shot frames and the extra "rhythm" frames together, in film order.
  const frames: (GalleryItem & { at: number })[] = [
    ...d.shots.map((sh) => ({
      key: `f${sh.n}`,
      at: sh.at,
      set: frameSet(d.slug, sh.n),
      full: frameSrc(d.slug, sh.n, 1600, "webp"),
      w: sh.w,
      h: sh.h,
      alt: `${d.title}: ${sh.title}`,
      lqip: lqipOf(d, "frames", sh.n),
    })),
    ...(d.type === "film"
      ? rhythmFor(d).map((r) => ({
          key: `r${r.n}`,
          at: r.at,
          set: rhythmSet(d.slug, r.n),
          full: rhythmFull(d.slug, r.n),
          w: r.w,
          h: r.h,
          alt: `${d.title}: ${r.title}`,
          lqip: lqipOf(d, "rhythm", r.n),
        }))
      : []),
  ].sort((a, b) => a.at - b.at);
  const stills: GalleryItem[] = d.stills.map((st) => ({
    key: `s${st.n}`,
    set: stillSet(d.slug, st.n),
    full: stillSrc(d.slug, st.n, 3200, "webp"),
    w: st.w,
    h: st.h,
    alt: st.alt,
    lqip: lqipOf(d, "stills", st.n),
  }));
  return d.type === "stills" ? stills : [...frames, ...stills];
}

export default function SimpleCase({ data: raw }: { data: CaseData }) {
  const d = withLqip(raw);
  const prev = getCase(d.prev)!;
  const next = getCase(d.next)!;
  const items = pictures(d);

  return (
    <article className={s.page} style={{ "--key": d.keyUi } as React.CSSProperties}>
      <header className={s.head}>
        <Link href="/work" className={`t-label ${s.back}`}>
          <Chevron back className={s.backChev} /> All work
        </Link>
        <h1 className={s.title}>{d.title}</h1>
        <hr className={s.rule} />
      </header>

      {d.film ? (
        <CaseFilm
          src={d.film.src}
          stream={d.slug}
          poster={`${MEDIA}/work/${d.slug}/poster.webp`}
          lqip={lqipOf(d, "poster")}
          width={d.film.width}
          height={d.film.height}
          title={d.title}
          runtime={d.film.runtime}
        />
      ) : null}

      <Gallery items={items} title={d.title} />

      {CASE_PAGES_LINKED ? (
        <nav className={s.pager} aria-label="More projects">
          {[
            { c: prev, label: "Previous" },
            { c: next, label: "Next" },
          ].map(({ c, label }) => (
            <Link key={label} href={`/work/${c.slug}`} className={s.pagerLink} data-no-roll>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-built picture */}
              <img src={gridPic(c.slug)} alt="" width={640} height={360} loading="lazy" decoding="async" className={s.pagerPic} />
              <span className={`t-label ${s.pagerLabel}`}>{label}</span>
              <span className={s.pagerName}>{c.title}</span>
            </Link>
          ))}
        </nav>
      ) : (
        <div className={s.pagerSolo}>
          <Link href="/work" className={`t-label ${s.back}`}>
            <Chevron back className={s.backChev} /> All work
          </Link>
        </div>
      )}
    </article>
  );
}
