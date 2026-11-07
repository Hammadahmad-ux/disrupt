"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ContactForm from "./ContactForm";
import { CONTACT } from "./contact-details";
import styles from "./contact.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Contact: a big question on the left, the enquiry form in a glass panel on the right.
export default function ContactSection() {
  const rootRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const panel = panelRef.current!;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "expo.out" },
          scrollTrigger: { trigger: root, start: "top 72%", once: true },
          onStart: () => panel.setAttribute("data-seen", ""),
        });
        tl.from(root.querySelectorAll("[data-line]"), { yPercent: 112, duration: 1.3, stagger: 0.09 }, 0);
        // Opacity, not autoAlpha: hidden (visibility) content would drop out of the keyboard tab order
        // until it had been scrolled into view.
        tl.from(root.querySelectorAll("[data-in]"), { opacity: 0, y: 20, duration: 1.1, stagger: 0.07 }, 0.2);
        tl.from(panel, { opacity: 0, y: 48, duration: 1.4 }, 0.1);
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        panel.setAttribute("data-seen", "");
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${CONTACT.email}`;
    }
  };

  return (
    <section ref={rootRef} id="contact" className={styles.section} aria-labelledby="contact-title">
      <div className={styles.intro}>
        <p className={`t-label ${styles.label}`} data-in>
          <span className={styles.dash} aria-hidden="true" />
          Contact
        </p>
        {/* Client wording (WEBSITE WORDING AMMENDS.pdf). */}
        <h2 id="contact-title" className={styles.statement}>
          <span className={styles.mask}>
            <span data-line>Got a cool</span>
          </span>
          <span className={styles.mask}>
            <span data-line>idea?</span>
          </span>
        </h2>
        <p className={styles.lede} data-in>
          Tell us more about it, let&rsquo;s bring it to life.
        </p>

        <div className={styles.mail} data-in>
          <span className={`t-label ${styles.mailLabel}`}>Email us</span>
          <div className={styles.mailRow}>
            <a href={`mailto:${CONTACT.email}`} className={styles.mailLink}>
              {CONTACT.email}
            </a>
            <button type="button" className={styles.copy} onClick={copyEmail} aria-label="Copy email address">
              <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
            </button>
            <span className="sr-only" role="status">
              {copied ? "Email address copied" : ""}
            </span>
          </div>
        </div>

        <dl className={styles.details} data-in>
          <div>
            <dt className="t-label">Studio</dt>
            <dd>{CONTACT.location}</dd>
          </div>
          <div>
            <dt className="t-label">Phone</dt>
            <dd>
              <a href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phone}</a>
            </dd>
          </div>
        </dl>
      </div>

      <div
        ref={panelRef}
        className={styles.panel}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
      >
        <ContactForm />
      </div>
    </section>
  );
}
