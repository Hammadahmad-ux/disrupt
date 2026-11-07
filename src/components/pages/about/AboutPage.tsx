import type { CSSProperties } from "react";
import Link from "next/link";
import { ABOUT, FACTS, LEAD, STATEMENT } from "@/components/studio/studio-content";
import { CONTACT } from "@/components/contact/contact-details";
import { Chevron } from "@/components/work/Chevron";
import { lqipBg } from "@/components/work/lqip";
import { CTA, HERO_PICTURE, LOGOS, PRINCIPLES, SIDE_PICTURE, stillSet, stillSrc } from "./about-content";
import AboutMotion from "./AboutMotion";
import s from "./about.module.css";

// About page: a quiet, editorial page on the dark ink. Every section shares one grid: a small label on
// the left (behind the logo's ">" chevron in taillight red), the content from the fourth column on.
//   1. The statement, set wide, with one cinema-wide still under it (slow parallax).
//   2. The studio: the two approved paragraphs, who leads it, the facts, one portrait still.
//   3. How we work: three principles, one line each.
//   4. Brands we have worked with: the client's logo files, still and calm (the home page has the moving row).
//   5. A single link on to the contact page.
// Motion lives in AboutMotion (gentle reveals, the parallax); the page reads fine without it.

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function Label({ children, id }: { children: string; id: string }) {
  return (
    <h2 className={`t-label ${s.label}`} id={id} data-rv>
      <Chevron className={s.labelChev} />
      {children}
    </h2>
  );
}

export default function AboutPage() {
  const hero = HERO_PICTURE.still;
  const side = SIDE_PICTURE.still;

  return (
    <div className={s.page} data-about>
      <AboutMotion />

      {/* ---------- 1. Statement + hero still ---------- */}
      <section className={s.hero} aria-labelledby="about-title">
        <div className={`t-label ${s.heroTop}`} data-hero-fade>
          <p className={s.heroEyebrow}>
            <Chevron className={s.labelChev} />
            About the studio
          </p>
          <p className={s.heroWhere}>{FACTS[0].value}</p>
        </div>

        {/* Client wording (Adil, 2026-10-23). Each phrase never breaks inside, so phones get clean lines. */}
        <h1 className={s.statement} id="about-title">
          {STATEMENT.map((sentence, i) => (
            <span className={s.line} key={i}>
              {sentence.map((phrase, j) => (
                <span key={j}>
                  {j > 0 && " "}
                  <span className={s.mask}>
                    <span className={s.word} style={d(120 + (i * 2 + j) * 90)}>
                      {phrase}
                    </span>
                  </span>
                </span>
              ))}
            </span>
          ))}
        </h1>

        <figure className={s.heroFigure}>
          <div className={s.heroFrame} data-hero-frame>
            <picture>
              <source
                type="image/avif"
                srcSet={stillSet(hero, "avif", true)}
                sizes="(min-width: 900px) calc(100vw - 2 * clamp(16px, 2.8vw, 40px)), 100vw"
              />
              <img
                className={s.heroImg}
                src={stillSrc(hero)}
                srcSet={stillSet(hero, "webp", true)}
                sizes="(min-width: 900px) calc(100vw - 2 * clamp(16px, 2.8vw, 40px)), 100vw"
                width={HERO_PICTURE.w}
                height={HERO_PICTURE.h}
                alt={hero.alt}
                fetchPriority="high"
                decoding="async"
                style={lqipBg(HERO_PICTURE.lqip, "50% 24%")}
                data-parallax
              />
            </picture>
          </div>
          <figcaption className={`t-label ${s.caption}`} data-hero-fade>
            <span>
              {hero.project} <span aria-hidden="true">·</span> {hero.view}
            </span>
            <span className={s.captionNote}>CGI still</span>
          </figcaption>
        </figure>
      </section>

      {/* ---------- 2. The studio ---------- */}
      <section className={`${s.section} ${s.studio}`} aria-labelledby="about-studio">
        <Label id="about-studio">
          The studio
        </Label>

        {/* Client wording (Adil, 2026-10-23). */}
        <p className={s.lead} data-rv>
          {ABOUT[0]}
        </p>

        <div className={s.body}>
          <p className={s.bodyText} data-rv>
            {ABOUT[1]}
          </p>
          {/* CONFIRM WITH ADIL: who leads the studio (no name until Adil says so). */}
          <p className={`t-label ${s.leadBy}`} data-rv>
            <span className={s.dash} aria-hidden="true" />
            {LEAD}
          </p>
        </div>

        {/* CONFIRM WITH ADIL: facts (from the home studio section). */}
        <dl className={s.facts}>
          {FACTS.map((f) => (
            <div className={s.fact} key={f.label} data-rv>
              <dt className="t-label">{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <figure className={s.side} data-rv>
          <div className={s.sideFrame}>
            <picture>
              <source type="image/avif" srcSet={stillSet(side, "avif")} sizes="(min-width: 900px) 24vw, 100vw" />
              <img
                className={s.sideImg}
                src={stillSrc(side)}
                srcSet={stillSet(side, "webp")}
                sizes="(min-width: 900px) 24vw, 100vw"
                width={SIDE_PICTURE.w}
                height={SIDE_PICTURE.h}
                alt={side.alt}
                loading="lazy"
                decoding="async"
                style={lqipBg(SIDE_PICTURE.lqip)}
              />
            </picture>
          </div>
          <figcaption className={`t-label ${s.caption}`}>
            <span>
              {side.project} <span aria-hidden="true">·</span> {side.view}
            </span>
          </figcaption>
        </figure>
      </section>

      {/* ---------- 3. How we work ---------- */}
      <section className={s.section} aria-labelledby="about-approach">
        <Label id="about-approach">
          How we work
        </Label>
        <ol className={s.principles}>
          {PRINCIPLES.map((p, i) => (
            <li className={s.principle} key={p.title} data-rv>
              <span className={`t-label ${s.pNum}`} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className={s.pTitle}>{p.title}</h3>
              <p className={s.pLine}>{p.line}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- 4. Brands ---------- */}
      <section className={s.section} aria-labelledby="about-brands">
        <Label id="about-brands">
          Brands we&apos;ve worked with
        </Label>
        <ul className={s.logos}>
          {LOGOS.map((l) => (
            <li className={s.logoCell} key={l.name} data-rv>
              {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized logo files */}
              <img
                className={s.logo}
                src={l.src}
                width={l.w}
                height={l.h}
                alt={l.name}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{ "--k": l.k.toFixed(3) } as CSSProperties}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- 5. On to contact ---------- */}
      <section className={`${s.section} ${s.next}`} aria-labelledby="about-next">
        <Label id="about-next">
          Contact
        </Label>
        <div className={s.nextBody} data-rv>
          <div className={s.nextTop}>
            <p className={s.nextAsk}>{CTA.ask}</p>
            <a className={`t-label ${s.mail}`} href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>
          </div>
          <Link href="/contact" className={s.nextLink}>
            <span className={s.nextText}>{CTA.link}</span>
            <span className={s.nextArrow} aria-hidden="true">
              <Chevron />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
