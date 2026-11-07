"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PROJECTS } from "@/content/projects";
import { scrollToId } from "@/components/providers/lenis-ref";
import { InlineServiceMedia, type ServiceMediaSpec } from "./ServiceMedia";
import styles from "./services.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Service = { title: string; desc: string; media: ServiceMediaSpec };

// CONFIRM WITH ADIL: service names and descriptions are placeholders.
const SERVICES: Service[] = [
  {
    title: "CGI films",
    desc: "Full CGI car films for launches, campaigns and social. We build the car, the world and the camera moves, then cut, grade and finish in house.",
    media: { kind: "video", slug: "audi-rs5-estate" },
  },
  {
    title: "CGI stills and retouching",
    desc: "Key visuals of the car, lit, rendered and retouched. Hero images for launches, print and online, made to match the film.",
    media: { kind: "image", slug: "zeekr-launch", n: 1 },
  },
  {
    title: "VFX and compositing",
    desc: "CGI cars and effects blended into live-action footage. Tracking, light matching and compositing, so the car sits in the shot for real.",
    media: { kind: "video", slug: "nascar" },
  },
  {
    title: "Direction and production",
    desc: "From the first idea and storyboard to the final grade. One team that writes, directs and delivers the whole film.",
    media: { kind: "video", slug: "audi-rebirth" },
  },
];

const credit = (slug: string) => {
  const p = PROJECTS.find((x) => x.slug === slug);
  return p ? `${p.title} · ${p.kind}` : "";
};

const toWork = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  scrollToId("work");
};

// "What we do" (after the Cuberto reference Hammad picked, made our own): a stack of dark glass cards.
// Each one starts as a slim bar (name + number) and opens as you scroll to it: the description, a
// link to the work and a clip of that service on the right fade in. Reduced motion: all cards open.
export default function ServicesSection() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.querySelectorAll("[data-title-line]"), {
          yPercent: 112,
          duration: 1.3,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, start: "top 78%", once: true },
        });
        gsap.from(root.querySelectorAll("[data-head-in]"), {
          opacity: 0,
          y: 18,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          delay: 0.15,
          scrollTrigger: { trigger: root, start: "top 78%", once: true },
        });

        root.querySelectorAll<HTMLElement>("[data-card]").forEach((card) => {
          const body = card.querySelector("[data-body]");
          const media = card.querySelector("[data-media]");
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: card, start: "top 82%", end: "top 42%", scrub: 0.6 },
          });
          tl.fromTo(body, { height: 0 }, { height: "auto" }, 0)
            .fromTo(card, { "--open": 0 }, { "--open": 1 }, 0)
            .fromTo(media, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1 }, 0.15);
        });
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="services" className={styles.section} aria-labelledby="services-title">
      <div className={styles.head}>
        <div>
          <p className={`t-label ${styles.label}`} data-head-in>
            <span className={styles.dash} aria-hidden="true" />
            Services
          </p>
          <h2 id="services-title" className={styles.title}>
            <span className={styles.mask}>
              <span data-title-line>What we do</span>
            </span>
          </h2>
        </div>
        {/* CONFIRM WITH ADIL */}
        <p className={styles.intro} data-head-in>
          CGI and VFX for car brands. One team, from the first frame to the final grade.
        </p>
      </div>

      <ol className={styles.cards}>
        {SERVICES.map((s, i) => (
          <li key={s.title} className={styles.card} data-card>
            <div className={styles.media} data-media aria-hidden="true">
              <InlineServiceMedia spec={s.media} className={styles.mediaBox} />
              <p className={`t-label ${styles.credit}`}>{credit(s.media.slug)}</p>
            </div>
            <div className={styles.top}>
              <h3 className={styles.name}>{s.title}</h3>
              <span className={`t-label ${styles.num}`} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className={styles.body} data-body>
              <div className={styles.bodyInner}>
                <p className={styles.desc}>{s.desc}</p>
                <a href="#work" className={styles.explore} onClick={toWork}>
                  See the work
                  <span className={styles.arrow} aria-hidden="true" />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.foot} data-head-in>
        <p>Not sure which one you need?</p>
        <a
          href="#contact"
          className={styles.link}
          onClick={(e) => {
            e.preventDefault();
            scrollToId("contact");
          }}
        >
          Tell us about the car <span className={styles.chev} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
