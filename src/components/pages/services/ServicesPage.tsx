"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { PROJECTS } from "@/content/projects";
import { Chevron } from "@/components/work/Chevron";
import { scrollToId } from "@/components/providers/lenis-ref";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import ServiceVisual from "./ServiceVisual";
import { CTA, FULL_LIST, INTRO, PROCESS, SERVICES } from "./services-content";
import s from "./services.module.css";

// Services page (client: "simple and clean"; his reference is recomfarmhouse.com/our-services). Structure
// borrowed as an idea only: a calm run of service rows, then how we work and a plain full list, then a
// call to action. DISRUPT's own: dark ink page, wide Zalando display type, Geist Mono labels, landscape
// car pictures (people know a car by its shape), the logo's ">" chevron as the only ornament and one
// red accent on the service numbers. Motion: a gentle fade-up of each block as it comes in, once per
// visit, none with reduced motion. Each service's loop plays only while it is on screen.

const REDUCED = "(prefers-reduced-motion: reduce)";
const pad2 = (n: number) => String(n).padStart(2, "0");

const credit = (slug: string) => {
  const p = PROJECTS.find((x) => x.slug === slug);
  return p ? `${p.title} · ${p.kind}` : "";
};

const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  scrollToId(id);
};

// The fade plays once per visit; coming back to /services shows the page at once.
let revealed = false;

export default function ServicesPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Hide the blocks before first paint (only when motion is fine), so they can fade in.
  useLayoutEffect(() => {
    if (revealed || matchMedia(REDUCED).matches) return;
    rootRef.current!.dataset.reveal = "";
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    if (!("reveal" in root.dataset)) return;
    const blocks = [...root.querySelectorAll<HTMLElement>("[data-rv]")];
    const io = new IntersectionObserver(
      (entries) => {
        // Blocks that come in together follow each other, top to bottom, then left to right.
        entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({ el: e.target as HTMLElement, r: e.boundingClientRect }))
          .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)
          .forEach(({ el }, k) => {
            el.style.setProperty("--d", `${Math.min(k, 6) * 90}ms`);
            el.dataset.in = "";
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const start = () => {
      window.clearTimeout(failsafe);
      revealed = true;
      blocks.forEach((b) => io.observe(b));
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
      {/* ---------- Heading ---------- */}
      <header className={s.head}>
        <p className={`t-label ${s.eyebrow}`} data-rv>
          Services <span aria-hidden="true">·</span> <span className={s.count}>{pad2(SERVICES.length)}</span>
        </p>
        <h1 className={s.title} data-rv>
          What we do.
        </h1>
        <p className={s.lede} data-rv>
          {INTRO}
        </p>

        <nav className={s.index} aria-label="On this page" data-rv>
          <ol className={s.indexList}>
            {SERVICES.map((sv, i) => (
              <li key={sv.id}>
                <a href={`#${sv.id}`} className={`t-label ${s.indexLink}`} onClick={jump(sv.id)}>
                  <span className={s.indexNum} aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                  {sv.title}
                </a>
              </li>
            ))}
          </ol>
          <a href="#full-list" className={`t-label ${s.indexAll}`} onClick={jump("full-list")}>
            Full list
            <Chevron className={s.chev} />
          </a>
        </nav>
      </header>

      {/* ---------- Services ---------- */}
      <ol className={s.services} aria-label="Services">
        {SERVICES.map((sv, i) => (
          <li key={sv.id} id={sv.id} className={s.row} data-side={i % 2 ? "right" : "left"}>
            <figure className={s.media} data-rv>
              <ServiceVisual visual={sv.visual} className={s.frame} />
              <figcaption className={`t-label ${s.credit}`}>{credit(sv.visual.slug)}</figcaption>
            </figure>

            <div className={s.copy} data-rv>
              <p className={`t-label ${s.num}`}>
                <Chevron className={s.numChev} />
                {pad2(i + 1)}
              </p>
              <h2 className={s.name}>{sv.title}</h2>
              <p className={s.desc}>{sv.desc}</p>
              <h3 className={`t-label ${s.listLabel}`}>What you get</h3>
              <ul className={s.list}>
                {sv.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <Link href="/work" className={`t-label ${s.more}`}>
                See the work
                <Chevron className={s.chev} />
              </Link>
            </div>
          </li>
        ))}
      </ol>

      {/* ---------- How we work ---------- */}
      <section className={s.process} aria-labelledby="process-title">
        <div className={s.sectionHead} data-rv>
          <p className={`t-label ${s.eyebrow}`}>Process</p>
          <h2 id="process-title" className={s.sectionTitle}>
            How we work.
          </h2>
        </div>
        <ol className={s.steps}>
          {PROCESS.map((p, i) => (
            <li key={p.title} className={s.step} data-rv>
              <span className={`t-label ${s.stepNum}`} aria-hidden="true">
                {pad2(i + 1)}
              </span>
              <h3 className={s.stepTitle}>{p.title}</h3>
              <p className={s.stepLine}>{p.line}</p>
              {i < PROCESS.length - 1 && <Chevron className={s.stepChev} />}
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Full list ---------- */}
      <section id="full-list" className={s.full} aria-labelledby="full-title">
        <div className={s.fullHead} data-rv>
          <p className={`t-label ${s.eyebrow}`}>Everything we do</p>
          <h2 id="full-title" className={s.sectionTitle}>
            Full list.
          </h2>
        </div>
        <dl className={s.groups}>
          {FULL_LIST.map((g) => (
            <div key={g.group} className={s.group} data-rv>
              <dt className={`t-label ${s.groupName}`}>{g.group}</dt>
              <dd className={s.groupItems}>
                <ul>
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- Call to action ---------- */}
      <section className={s.cta} aria-labelledby="cta-title">
        <h2 id="cta-title" className={s.ctaTitle} data-rv>
          {CTA.title}
        </h2>
        <div className={s.ctaSide} data-rv>
          <p className={s.ctaLine}>{CTA.line}</p>
          <div className={s.actions}>
            <Link href="/contact" className={s.button}>
              Start a project
              <Chevron className={s.buttonChev} />
            </Link>
            <Link href="/work" className={`t-label ${s.quiet}`}>
              See the work
              <Chevron className={s.chev} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
