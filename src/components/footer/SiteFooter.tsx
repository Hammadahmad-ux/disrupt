"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToId } from "@/components/providers/lenis-ref";
import { openReel, warmReel } from "@/components/reel-player/reel-player-store";
import { useMenu } from "@/components/menu/menu-store";
import { CONTACT, SOCIAL } from "@/components/contact/contact-details";
import { isOn } from "@/content/site";
import car400avif from "./assets/topcar-400.avif";
import car400webp from "./assets/topcar-400.webp";
import car800avif from "./assets/topcar-800.avif";
import car800webp from "./assets/topcar-800.webp";
import ContourField from "@/components/studio/ContourField";
import styles from "./footer.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PAGES = [
  { id: "work", label: "Work", href: "/work" },
  { id: "reel", label: "Showreel", href: "#reel" },
  { id: "services", label: "Services", href: isOn("services") ? "/services" : "/#services" },
  { id: "about", label: isOn("about") ? "About" : "Studio", href: isOn("about") ? "/about" : "/#studio" },
  { id: "contact", label: "Contact", href: isOn("contact") ? "/contact" : "/#contact" },
];

// Brand names as type until Adil confirms logo use (same rule as the brand marquee).
const BRANDS = ["Audi", "McLaren", "Cupra", "Zeekr", "Alpine", "McMurtry", "NASCAR"];

// Footer panel colour (#0c0c0f) and a faint line tone, so the moving contour lines match the rest of the site.
const PANEL: [number, number, number] = [12 / 255, 12 / 255, 15 / 255];
const LINES: [number, number, number] = [40 / 255, 40 / 255, 46 / 255];

const ukTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

// Footer: a dark panel framed in paper. A red racing line draws itself over the closing line, page
// links and contact sit either side, and the McLaren endurance car (client CGI, top-down, nose up) drives up and stops over the brand strip in
// front of an endless strip of the brands we have worked with, with one clear CTA over it.
export default function SiteFooter() {
  const rootRef = useRef<HTMLElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The car drives in as the footer arrives: start its picture a screen and a half early, so it never
  // arrives before its picture (native lazy loading starts later, or very late in some browsers).
  useEffect(() => {
    const root = rootRef.current!;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        root.querySelectorAll<HTMLImageElement>("img[loading=lazy]").forEach((img) => (img.loading = "eager"));
        io.disconnect();
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = clockRef.current!;
    const tick = () => (el.textContent = ukTime.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const line = root.querySelector<SVGPathElement>("[data-sign]")!;
        const len = line.getTotalLength();
        gsap.fromTo(
          line,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: root, start: "top 85%", end: "top 15%", scrub: 0.6 } },
        );

        gsap.from(root.querySelectorAll("[data-rise]"), {
          yPercent: 110,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, start: "top 70%" },
        });

        // The car drives up the page (towards the hero) as the footer comes in, and stops over the strip.
        gsap.fromTo(
          root.querySelector("[data-car]"),
          { yPercent: 45 },
          { yPercent: 0, ease: "power2.out", scrollTrigger: { trigger: root, start: "top 80%", end: "bottom bottom", scrub: 0.8 } },
        );
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  // "Showreel" opens the full reel player (the home reel section was removed). Every other link is a page:
  // the menu runs the page change (its curtain), or plain browser behaviour with a modifier key.
  const go = (id: string, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (id !== "reel" && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    e.preventDefault();
    if (id === "reel") openReel();
    else useMenu.getState().request(href);
  };

  return (
    <footer ref={rootRef} className={styles.footer} aria-labelledby="footer-title" data-header="hide">
      {/* Frame shape: the panel rises into a tab on top and steps down to the page edge in the middle. */}
      <svg className={styles.tab} viewBox="0 0 1000 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 50 C 110 50 120 0 230 0 H770 C 880 0 890 50 1000 50 Z" />
      </svg>
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.contours} aria-hidden="true">
          <ContourField sheetRef={panelRef} paper={PANEL} line={LINES} />
        </div>
        <div className={styles.statement}>
          <svg className={styles.sign} viewBox="0 0 600 160" fill="none" aria-hidden="true">
            {/* A racing line through two corners, finishing in the logo's ">" chevron. */}
            <path
              data-sign
              d="M8 128 C 90 128, 120 40, 200 44 S 300 140, 380 112 S 470 22, 540 30 L 584 58 L 540 86"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className={`t-label ${styles.eyebrow}`}>Next up · your idea</p>
          <h2 id="footer-title" className={styles.title}>
            <span className={styles.line}>
              <span data-rise>Let&rsquo;s make your next</span>
            </span>
            <span className={styles.line}>
              <span data-rise className={styles.accent}>
                big idea.
              </span>
            </span>
          </h2>
        </div>

        <div className={styles.garage}>
          <nav className={styles.col} aria-label="Footer">
            <p className={`t-label ${styles.colLabel}`}>Pages</p>
            <ul>
              {PAGES.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.href}
                    onClick={go(p.id, p.href)}
                    onPointerEnter={p.id === "reel" ? warmReel : undefined}
                    onFocus={p.id === "reel" ? warmReel : undefined}
                    className={styles.big}
                  >
                    {p.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.stage} aria-hidden="true">
            <picture className={styles.car} data-car>
              <source type="image/avif" srcSet={`${car400avif.src} 400w, ${car800avif.src} 800w`} sizes="(max-width: 760px) 30vw, 12vw" />
              <img
                src={car400webp.src}
                srcSet={`${car400webp.src} 400w, ${car800webp.src} 800w`}
                sizes="(max-width: 760px) 30vw, 12vw"
                width={car800webp.width}
                height={car800webp.height}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>

          <div className={`${styles.col} ${styles.colRight}`}>
            <p className={`t-label ${styles.colLabel}`}>Get in touch</p>
            <ul>
              <li>
                <a href={`mailto:${CONTACT.email}`} className={styles.big}>
                  Email
                </a>
              </li>
              <li>
                <a href={`tel:${CONTACT.phoneHref}`} className={styles.big}>
                  Call
                </a>
              </li>
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className={styles.big} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.small}>{CONTACT.email}</p>
          </div>
        </div>

        <div className={styles.strip} aria-label="Cars in our work">
          <div className={styles.track}>
            {[0, 1].map((k) => (
              <ul key={k} className={styles.brands} aria-hidden={k === 1 || undefined}>
                {BRANDS.map((b) => (
                  <li key={b}>
                    {b}
                    <span className={styles.dot} aria-hidden="true" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

      </div>

      <div className={styles.base}>
        <div className={styles.baseSide}>
          <p className={styles.legalText}>
            © 2026 DISRUPT · {CONTACT.location} · <span ref={clockRef} /> UK time
          </p>
        </div>
        <span className={styles.baseMid} aria-hidden="true">
          <svg className={styles.shoulderL} viewBox="0 0 40 44" preserveAspectRatio="none">
            <path d="M0 0 H40 V44 C 18 44 22 0 0 0 Z" />
          </svg>
          <svg className={styles.shoulderR} viewBox="0 0 40 44" preserveAspectRatio="none">
            <path d="M0 0 H40 C 18 0 22 44 0 44 Z" />
          </svg>
        </span>
        <div className={`${styles.baseSide} ${styles.legalLinks}`}>
          {/* Legal pages: shown only when switched on (content/site.ts); same page change as the other links. */}
          {isOn("privacy") && (
            <a href="/privacy" onClick={go("privacy", "/privacy")}>
              Privacy
            </a>
          )}
          {isOn("terms") && (
            <a href="/terms" onClick={go("terms", "/terms")}>
              Terms
            </a>
          )}
          <button type="button" onClick={() => scrollToId("top")}>
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  );
}
