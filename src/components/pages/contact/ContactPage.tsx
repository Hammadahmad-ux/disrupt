"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import ContactForm from "@/components/contact/ContactForm";
import { CONTACT, SOCIAL } from "@/components/contact/contact-details";
import { Chevron } from "@/components/work/Chevron";
import { lqipBg } from "@/components/work/lqip";
import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";
import { still } from "@/content/projects";
import s from "./contact-page.module.css";

// Contact page. Kept simple (client: "too much going on"): the client's question in big type, then the
// enquiry form on a quiet dark sheet beside the direct details (email with copy, phone, studio, UK time,
// socials) and one calm still: the McMurtry from behind, its taillights the only red besides the accent.
// A short "what happens next" band closes the page before the footer.
// Motion: the headline rises once and the rest fades in, on the first view in a visit, after the loader.
// None with reduced motion.

const ukTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

// CONFIRM WITH ADIL: the three steps and the reply time (no reply time has been agreed yet).
const STEPS = [
  { title: "We reply", text: "We read every message and reply within 1–2 working days." },
  { title: "We talk it through", text: "A short call about the car, the timing and where the work will be seen." },
  { title: "You get a plan", text: "A clear plan and a quote, so you know what you get and when." },
] as const;

// The still: McMurtry Spéirling Pure from behind, in the dark (client CGI, 1600x1819 master).
const STILL_SLUG = "mcmurtry";
const STILL_N = 5;
const stillSet = (ext: "avif" | "webp") =>
  ([800, 1600] as const).map((w) => `${still(STILL_SLUG, STILL_N, w).replace(/\.webp$/, `.${ext}`)} ${w}w`).join(", ");
const STILL_SIZES = "(min-width: 900px) 38vw, 100vw";

const REDUCED = "(prefers-reduced-motion: reduce)";

// The fade plays once per visit; coming back to the page shows it at once.
let shown = false;

function UkClock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const tick = () => (el.textContent = ukTime.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);
  return <span ref={ref} className={s.clock} />;
}

export default function ContactPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef(0);
  const [copied, setCopied] = useState(false);

  // Hide the blocks before first paint (only when motion is fine), so they can come in.
  useLayoutEffect(() => {
    if (shown || matchMedia(REDUCED).matches) return;
    rootRef.current!.dataset.reveal = "";
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    if (!("reveal" in root.dataset)) return;
    let raf = 0;
    const start = () => {
      window.clearTimeout(failsafe);
      shown = true;
      raf = requestAnimationFrame(() => (root.dataset.in = ""));
    };
    // On a first visit the loader is up: wait for it, so the reveal is seen (never longer than 6 s).
    const failsafe = window.setTimeout(start, useIntro.getState().done ? 0 : 6000);
    if (!useIntro.getState().done) window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      window.clearTimeout(failsafe);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${CONTACT.email}`;
    }
  };

  const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

  return (
    <div ref={rootRef} className={s.page}>
      <header className={s.head}>
        <p className={`t-label ${s.eyebrow}`} data-r style={d(0)}>
          <Chevron className={s.eyebrowChev} />
          Contact
        </p>
        {/* Client wording (WEBSITE WORDING AMMENDS.pdf). */}
        <h1 className={s.title}>
          <span className={s.mask}>
            <span className={s.line}>
              Got a cool <span className={s.nowrap}>idea?</span>
            </span>
          </span>
        </h1>
        <p className={s.sub} data-r style={d(180)}>
          Tell us more about it, let&rsquo;s bring it to life.
        </p>
      </header>

      <div className={s.body}>
        <section className={s.direct} aria-labelledby="contact-direct" data-r style={d(260)}>
          <h2 id="contact-direct" className={`t-label ${s.label}`}>
            Email us
          </h2>
          <div className={s.mailRow}>
            <a href={`mailto:${CONTACT.email}`} className={s.mail}>
              {CONTACT.email}
            </a>
            <button
              type="button"
              className={s.copy}
              onClick={copyEmail}
              data-no-roll
              data-copied={copied ? "" : undefined}
              aria-label="Copy email address"
            >
              <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
            </button>
            <span className="sr-only" role="status">
              {copied ? "Email address copied" : ""}
            </span>
          </div>

          <dl className={s.facts}>
            <div className={s.fact}>
              <dt className="t-label">Phone</dt>
              <dd>
                <a href={`tel:${CONTACT.phoneHref}`} className={s.factLink}>
                  {CONTACT.phone}
                </a>
              </dd>
            </div>
            <div className={s.fact}>
              <dt className="t-label">Studio</dt>
              <dd>{CONTACT.location}</dd>
            </div>
            <div className={s.fact}>
              <dt className="t-label">UK time</dt>
              <dd>
                <UkClock />
              </dd>
            </div>
            {SOCIAL.length > 0 && (
            <div className={s.fact}>
              {/* CONFIRM WITH ADIL: social links (placeholders in contact-details.ts). */}
              <dt className="t-label">Follow</dt>
              <dd>
                <ul className={s.social}>
                  {SOCIAL.map((x) => (
                    <li key={x.label}>
                      <a href={x.href} className={s.factLink} target="_blank" rel="noreferrer">
                        {x.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            )}
          </dl>
        </section>

        <section className={s.formArea} aria-labelledby="contact-form" data-r style={d(340)}>
          <h2 id="contact-form" className="sr-only">
            Send us a message
          </h2>
          <div className={s.sheet}>
            <span className={s.lamp} aria-hidden="true" />
            <ContactForm />
          </div>
        </section>

        <section className={s.next} aria-labelledby="contact-next">
          <h2 id="contact-next" className={`t-label ${s.label} ${s.nextLabel}`} data-r style={d(420)}>
            What happens next
          </h2>
          <ol className={s.steps}>
            {STEPS.map((step, i) => (
              <li key={step.title} className={s.step} data-r style={d(460 + i * 80)}>
                <span className={`t-label ${s.num}`} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                  <Chevron className={s.numChev} />
                </span>
                <h3 className={s.stepTitle}>{step.title}</h3>
                <p className={s.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <figure className={s.still} data-r style={d(420)}>
          <picture className={s.pic}>
            <source type="image/avif" srcSet={stillSet("avif")} sizes={STILL_SIZES} />
            <img
              src={still(STILL_SLUG, STILL_N, 800)}
              srcSet={stillSet("webp")}
              sizes={STILL_SIZES}
              width={1600}
              height={1819}
              alt="The McMurtry Spéirling Pure from behind in a dark studio, its taillights glowing red."
              loading="lazy"
              decoding="async"
              style={lqipBg(`${STILL_SLUG}/0${STILL_N}`, "50% 58%")}
            />
          </picture>
          <figcaption className={`t-label ${s.caption}`}>McMurtry Spéirling Pure · CGI stills</figcaption>
        </figure>
      </div>
    </div>
  );
}
