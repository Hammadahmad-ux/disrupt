"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import alpine from "./logos/alpine.webp";
import bmw from "./logos/bmw.webp";
import hyundai from "./logos/hyundai.webp";
import mclaren from "./logos/mclaren.webp";
import mcmurtry from "./logos/mcmurtry.webp";
import nascar from "./logos/nascar.webp";
import renault from "./logos/renault.webp";
import zeekr from "./logos/zeekr.webp";
import styles from "./brands.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// "Trusted by": the brands' own logos, supplied by the client (DISRUPT ASSETS/BRAND LOGOS, 2026-10-21).
// `s` evens out their optical size: stacked marks (Alpine, Renault, BMW) need more height than long wordmarks.
type Brand = { name: string; src: string; w: number; h: number; s: number };
const BRANDS: Brand[] = [
  { name: "McLaren", ...pick(mclaren), s: 0.42 },
  { name: "Alpine", ...pick(alpine), s: 1.2 },
  { name: "Zeekr", ...pick(zeekr), s: 0.62 },
  { name: "BMW", ...pick(bmw), s: 1.05 },
  { name: "NASCAR", ...pick(nascar), s: 0.68 },
  { name: "Renault", ...pick(renault), s: 1.2 },
  { name: "McMurtry", ...pick(mcmurtry), s: 0.56 },
  { name: "Hyundai", ...pick(hyundai), s: 0.5 },
];
function pick(img: { src: string; width: number; height: number }) {
  return { src: img.src, w: img.width, h: img.height };
}
const ROW_A = BRANDS;
const ROW_B = [...BRANDS.slice(3), ...BRANDS.slice(0, 3)];

const BASE_SPEED = 42; // px/s idle drift
const GAIN = 0.32; // extra px/s per px/s of scroll velocity
const MAX_EXTRA = 1500;
const MAX_SKEW = 3; // degrees, leans the type into the direction of travel

/** The ">" notch from the logo's R, used between names. */
function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 100" aria-hidden="true" focusable="false">
      <path d="M0 0h27l33 50-33 50H0l33-50z" fill="currentColor" />
    </svg>
  );
}

function Row({ id, items, tone }: { id: "a" | "b"; items: readonly Brand[]; tone: "solid" | "outline" }) {
  return (
    <div className={`${styles.row} ${styles[tone]}`} data-row={id}>
      <div className={styles.track} data-track>
        {[0, 1].map((copy) => (
          <div className={styles.set} key={copy} data-set>
            {items.map((b) => (
              <span className={styles.item} key={b.name} data-item>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized logos in a marquee */}
                <img
                  className={styles.logo}
                  src={b.src}
                  width={b.w}
                  height={b.h}
                  style={{ "--s": b.s } as React.CSSProperties}
                  alt=""
                  decoding="async"
                  draggable={false}
                />
                <Chevron className={styles.chev} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Two rows of huge names drifting in opposite directions. Scrolling speeds them up and flips their
// direction with the scroll. Logos brighten as they pass the centre and their chevrons turn red.
export default function BrandMarquee() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const stage = root.querySelector<HTMLElement>("[data-stage]")!;
      const readout = root.querySelector<HTMLElement>("[data-readout]")!;
      const tracksA = gsap.utils.toArray<HTMLElement>("[data-row='a'] [data-track]", root);
      const tracksB = gsap.utils.toArray<HTMLElement>("[data-row='b'] [data-track]", root);
      const rowA = root.querySelector<HTMLElement>("[data-row='a']")!;
      const setA = rowA.querySelector<HTMLElement>("[data-set]")!;
      const setB = root.querySelector<HTMLElement>("[data-row='b'] [data-set]")!;

      let wA = 1;
      let wB = 1;
      let rowW = 1;
      let spans: { left: number; right: number }[] = [];
      const measure = () => {
        wA = setA.offsetWidth || 1;
        wB = setB.offsetWidth || 1;
        rowW = rowA.offsetWidth || 1;
        spans = Array.from(setA.querySelectorAll<HTMLElement>("[data-item]"), (el) => ({
          left: el.offsetLeft,
          right: el.offsetLeft + el.offsetWidth,
        }));
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(setA);
      ro.observe(setB);
      document.fonts?.ready.then(measure).catch(() => undefined);

      // Start the rows out of phase so the same names never stack.
      let xA = -wA * 0.08;
      let xB = -wB * 0.46;
      let lastIdx = -1;

      const render = (skew: number) => {
        const a = `translate3d(${xA.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
        const b = `translate3d(${xB.toFixed(2)}px,0,0) skewX(${(-skew).toFixed(2)}deg)`;
        for (const t of tracksA) t.style.transform = a;
        for (const t of tracksB) t.style.transform = b;
        // Which name of the top row sits under the centre of the viewfinder.
        const pos = gsap.utils.wrap(0, wA, rowW / 2 - xA);
        const idx = spans.findIndex((s) => pos >= s.left && pos < s.right);
        if (idx !== -1 && idx !== lastIdx) {
          lastIdx = idx;
          readout.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(ROW_A.length).padStart(2, "0")}  ${ROW_A[idx].name}`;
        }
      };

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The viewfinder opens like a shutter as the section comes up.
        gsap.fromTo(
          stage,
          { "--open": 0.06 },
          {
            "--open": 1,
            ease: "none",
            scrollTrigger: { trigger: stage, start: "top 92%", end: "center 52%", scrub: 0.8 },
          },
        );
        gsap.from(root.querySelectorAll("[data-head] > *"), {
          opacity: 0,
          y: 16,
          duration: 1,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, start: "top 80%", once: true },
        });

        let visible = false;
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "120px 0px" });
        io.observe(root);

        let dir = 1;
        let vel = 0;
        let speed = BASE_SPEED;
        let lastY = window.scrollY;
        const tick = (_t: number, deltaMs: number) => {
          const y = window.scrollY;
          const dy = y - lastY;
          lastY = y;
          if (!visible) return;
          const dt = Math.min(deltaMs, 64) / 1000 || 1 / 60;
          if (Math.abs(dy) > 0.5) dir = dy > 0 ? 1 : -1;
          vel += (dy / dt - vel) * 0.18;
          const target = BASE_SPEED + Math.min(Math.abs(vel) * GAIN, MAX_EXTRA);
          speed += (target - speed) * 0.08;
          xA = gsap.utils.wrap(-wA, 0, xA - speed * dt * dir);
          xB = gsap.utils.wrap(-wB, 0, xB + speed * dt * dir);
          const skew = gsap.utils.clamp(-MAX_SKEW, MAX_SKEW, (speed - BASE_SPEED) * 0.004 * dir);
          render(skew);
        };
        gsap.ticker.add(tick);
        return () => {
          gsap.ticker.remove(tick);
          io.disconnect();
        };
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        render(0);
      });
      render(0);

      return () => {
        mm.revert();
        ro.disconnect();
      };
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="brands" className={styles.section} aria-labelledby="brands-title">
      <div className={styles.head} data-head>
        <h2 id="brands-title" className={`t-label ${styles.label}`}>
          <span className={styles.dash} aria-hidden="true" />
          Trusted by
        </h2>
        <p className={`t-label ${styles.count}`}>{String(BRANDS.length).padStart(2, "0")} marques</p>
      </div>

      <ul className="sr-only">
        {BRANDS.map((b) => (
          <li key={b.name}>{b.name}</li>
        ))}
      </ul>

      <div className={styles.stage} data-stage aria-hidden="true">
        <div className={styles.layer}>
          <Row id="a" items={ROW_A} tone="solid" />
          <Row id="b" items={ROW_B} tone="outline" />
        </div>


        <div className={`${styles.layer} ${styles.lit}`}>
          <Row id="a" items={ROW_A} tone="outline" />
          <Row id="b" items={ROW_B} tone="solid" />
        </div>

        <p className={`t-label ${styles.readout}`}>
          <span className={styles.dot} />
          <span data-readout>01 / 07  Audi</span>
        </p>
      </div>
    </section>
  );
}
