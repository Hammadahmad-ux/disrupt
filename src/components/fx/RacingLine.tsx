"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { buildRacingLine, lengthAtY, pointAt, SECTION_IDS, type RacingGeometry, type SectionBox } from "./alive/racing-line-path";
import styles from "./alive/racing-line.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HEAD_AT = 0.62; // the drawing tip rides at 62% of the viewport height
const HOT_LONG = 300; // px of warm line behind the tip
const HOT_SHORT = 120; // px of hot line right behind the tip
// Copy the line should not cut through when it sweeps into a section.
const TEXT_SELECTOR = "h1, h2, h3, h4, p, li, dt, dd, label, legend, blockquote, figcaption";

// One taillight-red line that runs from below the hero to the contact section. It keeps to one side
// inside each section and sweeps across between them, like a racing line through corners, and it is
// drawn as you scroll with a bright tip that rides at a fixed height in the viewport.
// Reduced motion: fully drawn, still and faint. Phones: a thinner line in the side gutter.
export default function RacingLine() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const svg = root.querySelector("svg");
      const head = root.querySelector<HTMLElement>("[data-head]");
      if (!svg || !head) return;
      const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));
      const drawn = paths.filter((p) => p.dataset.role === "drawn");
      const hotLong = paths.filter((p) => p.dataset.role === "hot-long");
      const hotShort = paths.filter((p) => p.dataset.role === "hot-short");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

      let geo: RacingGeometry | null = null;
      let total = 0; // browser path length
      let ratio = 1; // browser length / lookup-table length
      const state = { p: 0 };

      const measure = () => {
        const box = root.getBoundingClientRect();
        const W = box.width;
        const H = box.height;
        if (W < 2 || H < 2) return;
        const boxes: SectionBox[] = [];
        for (const id of SECTION_IDS) {
          const el = document.getElementById(id);
          if (!el) continue;
          // A pinned section's real footprint is its pin spacer.
          const parent = el.parentElement;
          const target = parent?.classList.contains("pin-spacer") ? parent : el;
          const r = target.getBoundingClientRect();
          // Where the copy starts on each side, as an offset from the section top (offsets stay
          // right even while a pinned section is fixed to the viewport).
          const er = el.getBoundingClientRect();
          const textTop = { left: Infinity, right: Infinity };
          for (const n of el.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) {
            const nr = n.getBoundingClientRect();
            if (nr.width < 1 || nr.height < 1) continue;
            const off = nr.top - er.top;
            const left = nr.left - box.left;
            const right = nr.right - box.left;
            if (off < 0 || right < 0 || left > W) continue;
            if (left < W * 0.4) textTop.left = Math.min(textTop.left, off);
            if (right > W * 0.6) textTop.right = Math.min(textTop.right, off);
          }
          boxes.push({ id, top: r.top - box.top, bottom: r.bottom - box.top, textTop });
        }
        // The line picks up where the hero's scroll cue hairline ends, so the cue "drops" into it.
        const cue = document.querySelector('#top a[href="#work"]')?.getBoundingClientRect();
        const startX = cue && cue.width > 0 ? cue.left + cue.width / 2 - box.left : undefined;
        geo = buildRacingLine({ width: W, height: H, vh: window.innerHeight, boxes, compact: W < 760, startX });
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        for (const p of paths) p.setAttribute("d", geo.d);
        total = drawn[0]?.getTotalLength() || geo.lut.length;
        ratio = geo.lut.length > 0 ? total / geo.lut.length : 1;
        if (reduced) {
          for (const p of drawn) p.style.strokeDasharray = "none";
          return;
        }
        for (const p of drawn) p.style.strokeDasharray = `${total} ${total + 20}`;
        for (const p of hotLong) p.style.strokeDasharray = `${HOT_LONG} ${total + HOT_LONG}`;
        for (const p of hotShort) p.style.strokeDasharray = `${HOT_SHORT} ${total + HOT_SHORT}`;
      };

      const render = () => {
        if (!geo || reduced) return;
        const s = lengthAtY(geo.lut, state.p * geo.endY);
        const sb = s * ratio;
        const visible = sb > 0.5;
        const off = visible ? total - sb : total + 4; // +4 hides the round cap at the very start
        for (const p of drawn) p.style.strokeDashoffset = `${off}`;
        for (const p of hotLong) p.style.strokeDashoffset = `${visible ? HOT_LONG - sb : HOT_LONG + 4}`;
        for (const p of hotShort) p.style.strokeDashoffset = `${visible ? HOT_SHORT - sb : HOT_SHORT + 4}`;
        const pt = pointAt(geo.lut, s);
        head.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
        head.style.opacity = visible ? "1" : "0";
        root.toggleAttribute("data-finished", state.p > 0.998);
      };

      if (reduced) {
        root.setAttribute("data-static", "");
        measure();
        const ro = new ResizeObserver(() => measure());
        ro.observe(root);
        ScrollTrigger.addEventListener("refresh", measure);
        return () => {
          ro.disconnect();
          ScrollTrigger.removeEventListener("refresh", measure);
        };
      }

      measure();

      // Scroll speed warms the tip a little; it cools as soon as scrolling stops.
      const heat = { v: 0 };
      const setHeat = () => root.style.setProperty("--heat", heat.v.toFixed(3));
      const heatTo = gsap.quickTo(heat, "v", { duration: 0.6, ease: "power2.out", onUpdate: setHeat });
      const cool = gsap.delayedCall(0.18, () => heatTo(0)).pause();

      gsap.fromTo(state, { p: 0 }, {
        p: 1,
        ease: "none",
        onUpdate: render,
        scrollTrigger: {
          trigger: root,
          start: `top ${HEAD_AT * 100}%`,
          // Ends when the line's last point reaches the tip height, or at the bottom of the page.
          // Refreshed last (low priority) so pinned sections above have their spacers in place.
          end: () => {
            measure();
            const top = root.getBoundingClientRect().top + window.scrollY;
            const endY = geo?.endY ?? root.offsetHeight;
            const natural = top + endY - window.innerHeight * HEAD_AT;
            const startAt = top - window.innerHeight * HEAD_AT;
            return Math.max(startAt + 1, Math.min(natural, ScrollTrigger.maxScroll(window) - 1));
          },
          scrub: 0.9,
          refreshPriority: -10,
          onUpdate: (self) => {
            heatTo(Math.min(1, Math.abs(self.getVelocity()) / 2600));
            cool.restart(true);
          },
        },
      });

      // The drive has its own red road and marker, so the line steps aside (fades out) while the
      // drive holds the screen, and comes back for the corner into the reel.
      const work = document.getElementById("work");
      if (work) {
        ScrollTrigger.create({
          trigger: work,
          start: "top 30%",
          end: "bottom 70%",
          onToggle: (self) => gsap.to(root, { opacity: self.isActive ? 0 : 1, duration: 0.6, ease: "power2.out", overwrite: true }),
        });
      }

      // Sections that load media or build pins change the page height after the first layout:
      // refresh ScrollTrigger once the height settles (guarded so a refresh cannot loop).
      let settled = root.offsetHeight;
      const onRefresh = () => {
        settled = root.offsetHeight;
        render();
      };
      ScrollTrigger.addEventListener("refresh", onRefresh);
      let timer = 0;
      const ro = new ResizeObserver(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (Math.abs(root.offsetHeight - settled) > 2) ScrollTrigger.refresh();
        }, 300);
      });
      ro.observe(root);

      return () => {
        window.clearTimeout(timer);
        ro.disconnect();
        ScrollTrigger.removeEventListener("refresh", onRefresh);
        cool.kill();
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <path data-role="drawn" className={`${styles.path} ${styles.glowWide}`} />
        <path data-role="drawn" className={`${styles.path} ${styles.glow}`} />
        <path data-role="drawn" className={`${styles.path} ${styles.core}`} />
        <path data-role="hot-long" className={`${styles.path} ${styles.hotGlow}`} />
        <path data-role="hot-short" className={`${styles.path} ${styles.hot}`} />
      </svg>
      <div data-head className={styles.head}>
        <span className={styles.halo} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
