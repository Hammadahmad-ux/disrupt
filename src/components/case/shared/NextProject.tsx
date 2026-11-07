"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { PROJECTS } from "@/content/projects";
import type { CaseData } from "@/content/cases";
import { getLenis } from "@/components/providers/lenis-ref";
import { PaintworkGL, type RowFrame } from "@/components/work/paintwork-gl";
import { buildMask, type TextMask } from "@/components/work/text-mask";
import { getMedia, useStage } from "@/components/work/stage-store";
import { stagePoster, formatLabel } from "@/components/work/work-meta";
import { Chevron } from "@/components/work/Chevron";
import c from "./case.module.css";

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (a: number, b: number, v: number) => Math.min(b, Math.max(a, v));
const DEG = Math.PI / 180;

type Props = { data: CaseData; next: CaseData; prev: CaseData };

// The wheel or trackpad stream that carried the visitor to the end of the runway keeps coming after the
// fly-through has landed (trackpad momentum lasts a second or two), and would scroll the next case straight
// past its hero. Hold the wheel through the fly-through (~0.9 s) and the first moments on the new hero, then
// keep swallowing the stream while events arrive less than 240 ms apart, for at most 2.6 s. A fresh scroll
// after a pause goes through.
function holdMomentum() {
  const t0 = performance.now();
  let last = t0;
  const opts: AddEventListenerOptions = { capture: true, passive: false };
  const end = () => {
    window.removeEventListener("wheel", onWheel, opts);
    window.clearTimeout(cap);
  };
  function onWheel(e: WheelEvent) {
    const now = performance.now();
    if (now - t0 > 2600 || (now - last > 240 && now - t0 > 1600)) {
      end();
      return;
    }
    last = now;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  window.addEventListener("wheel", onWheel, opts);
  const cap = window.setTimeout(end, 2600);
}

// "Keep scrolling to paint the next name." The next project's name sits full-width in primer at the bottom
// of the page; the scroll runway paints it with that project's own film under the studio light (the
// roster's PAINTWORK renderer, one row). At the end of the runway the camera pushes into the thickest
// stroke until the film fills the screen, and the next case opens on that same playing film (the work
// layout's film stage). Small "Previous / All work / Next" links are there for people who do not scroll.
// No WebGL: the name is painted with the poster behind a slanted CSS edge. Reduced motion: painted, no
// runway and no auto-open. Loading: 3.5 screens before the runway the film stage is asked for the next
// project's poster (the same file the name is painted with until the film runs) and the next page's data is
// prefetched, so the name paints with a real picture and the jump is instant.

/** The picture the film stage holds for a project (its poster, or still 01), so the name's paint and the next
 *  hero share one file; the content default when the stage has not chosen one yet. */
function stageCover(slug: string, fallback: string) {
  const el = getMedia(slug);
  if (el instanceof HTMLVideoElement) return el.getAttribute("poster") ? el.poster : fallback;
  if (el instanceof HTMLImageElement && (el.currentSrc || el.getAttribute("src"))) return el.currentSrc || el.src;
  return fallback;
}
export function NextProject({ data, next, prev }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const flyRef = useRef<(() => void) | null>(null);
  const nextP = PROJECTS[next.index];
  const href = `/work/${next.slug}`;

  useEffect(() => {
    const root = rootRef.current!;
    const stage = root.querySelector<HTMLElement>("[data-stage]")!;
    const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
    const wrap = root.querySelector<HTMLElement>("[data-wrap]")!;
    const name = root.querySelector<HTMLElement>("[data-name]")!;
    const base = root.querySelector<HTMLElement>("[data-base]")!;
    const pct = root.querySelector<HTMLElement>("[data-pct]")!;
    const fades = [...root.querySelectorAll<HTMLElement>("[data-fade]")];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let gl: PaintworkGL | null = null;
    let glFailed = false;
    let mask: TextMask | null = null;
    let ready = false; // fonts in, name fitted
    let flying = false;
    let armed = false; // the visitor has been inside the runway before reaching its end
    let primed = false;
    let warmed = false;
    let switched = false;
    let lastY = scrollY;
    let lastT = performance.now();
    let vel = 0;
    let lean = 0;
    let rest = 0;
    let lastPaint = -1;
    const row = { paint: 0, boost: 0, scale: 1, fx: 0, glint: -1, alpha: 1 };
    const amb = { level: 0.08, tint: 1, sharp: 0 };
    const tweens: gsap.core.Animation[] = [];

    root.dataset.gl = reduced ? "off" : "pending";

    // The name fills the width on one line; long ones get smaller. On phones a long name would end up
    // tiny on one line, so it breaks onto lines instead, sized by its longest word.
    const fit = () => {
      delete wrap.dataset.lines;
      wrap.style.fontSize = "100px";
      const w = name.getBoundingClientRect().width;
      const avail = wrap.parentElement!.clientWidth - parseFloat(getComputedStyle(wrap.parentElement!).paddingLeft) * 2;
      let fs = Math.min((100 * avail) / Math.max(1, w), innerHeight * 0.3, 340);
      const text = name.firstChild;
      if (innerWidth <= 760 && fs < 72 && text instanceof Text && /\s/.test(text.data.trim())) {
        const range = document.createRange();
        let widest = 1;
        let i = 0;
        for (const word of text.data.split(/(\s+)/)) {
          if (word.trim()) {
            range.setStart(text, i);
            range.setEnd(text, i + word.length);
            widest = Math.max(widest, range.getBoundingClientRect().width);
          }
          i += word.length;
        }
        range.detach();
        wrap.dataset.lines = "";
        fs = Math.min((100 * avail * 0.98) / widest, innerHeight * 0.13);
      }
      wrap.style.fontSize = `${fs.toFixed(2)}px`;
    };

    const ensureGl = () => {
      if (gl || glFailed || reduced) return;
      try {
        gl = new PaintworkGL(canvas, [next.slug], { [next.slug]: next.key }, getMedia, () =>
          stageCover(next.slug, stagePoster(nextP)),
        );
        root.dataset.gl = "on";
        if (ready) mask = buildMask(name, base, gl.pixelRatio);
        gl.setMasks([mask]);
      } catch {
        glFailed = true;
        gl = null;
        root.dataset.gl = "off";
      }
    };

    // Zoom that makes the deepest stroke cover the whole stage (as the roster's fly-through).
    const zoomFor = () => {
      const m = mask!;
      const r = name.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const x = r.left - cr.left - m.pad + m.pivot.x;
      const y = r.top - cr.top - m.pad + m.pivot.y;
      const w = cr.width;
      const h = cr.height;
      const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
      return (far / m.pivot.r) * 1.15;
    };

    const go = () => {
      const st = useStage.getState();
      st.setLast(next.slug);
      st.setMode("hero", next.slug);
      router.push(href);
    };

    const fly = () => {
      if (flying) return;
      flying = true;
      router.prefetch(href);
      getLenis()?.stop();
      holdMomentum();
      const st = useStage.getState();
      st.setActive(next.slug, []);
      if (!gl || !mask || reduced) {
        tweens.push(gsap.to(stage, { opacity: 0, duration: reduced ? 0.2 : 0.45, ease: "power1.out", onComplete: go }));
        return;
      }
      // Lights down into the stroke: the UI fades, the light passes once more, the room goes dark and the
      // camera pushes into the thickest stroke until the film inside fills the screen.
      const tl = gsap.timeline({ onComplete: go });
      tweens.push(tl);
      tl.to(fades, { autoAlpha: 0, duration: 0.25, ease: "power1.out" }, 0);
      tl.to(stage, { "--seam": 0, duration: 0.3 }, 0);
      tl.to(row, { boost: 1, duration: 0.2, ease: "power2.out" }, 0);
      tl.fromTo(row, { glint: 0 }, { glint: 1, duration: 0.42, ease: "power2.inOut", immediateRender: false }, 0.02);
      tl.set(row, { glint: -1 }, 0.45);
      tl.to(amb, { level: 0, duration: 0.5, ease: "power2.inOut" }, 0.05);
      tl.to(row, { scale: zoomFor(), duration: 0.8, ease: "expo.in" }, 0.12);
      tl.to(row, { fx: 1, duration: 0.45, ease: "power2.inOut" }, 0.42);
      tl.to(amb, { tint: 0, sharp: 1, duration: 0.1, ease: "none" }, 0.82);
    };
    flyRef.current = fly;

    const frame = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const y = scrollY;
      const dy = y - lastY;
      lastY = y;
      vel += (dy - vel) * Math.min(1, dt * 14);

      const vh = innerHeight;
      const r = root.getBoundingClientRect();

      // Well before the runway: the next poster (the name's paint until the film runs, and the no-WebGL
      // fill) and the next page's data.
      if (!primed && r.top < vh * 3.5) {
        primed = true;
        useStage.getState().prime(next.slug, 1);
        router.prefetch(href);
      }
      // Warm the next film a little before the runway, play it on the stage once close.
      if (!warmed && r.top < vh * 2.5) {
        warmed = true;
        const st = useStage.getState();
        if (!st.warm.includes(next.slug)) st.setActive(st.active ?? data.slug, [...st.warm, next.slug]);
      }
      if (!flying) {
        if (!switched && r.top < vh * 1.2) {
          switched = true;
          useStage.getState().setActive(next.slug, [data.slug]);
        } else if (switched && r.top > vh * 1.6) {
          switched = false;
          useStage.getState().setActive(data.slug, [next.slug]);
        }
      }
      if (r.top < vh * 2) ensureGl();
      if (r.top > vh * 1.05 || r.bottom < 0) return;

      // Runway progress: from the stage entering (its top at 35% of the screen) to the page end.
      const span = vh * 0.35 + r.height - vh;
      const p = clamp(0, 1, (vh * 0.35 - r.top) / Math.max(1, span));
      if (p < 0.85) armed = true;
      const paint = reduced ? 1 : clamp(0, 1, (p - 0.04) / 0.88);
      if (Math.abs(paint - lastPaint) > 0.001) {
        lastPaint = paint;
        root.style.setProperty("--paint", paint.toFixed(4));
        pct.textContent = `${String(Math.round(paint * 100)).padStart(3, "0")}%`;
      }
      row.paint = paint;

      // The end of the runway opens the next case (scrolling down, after having been inside it).
      const lenis = getLenis();
      if (!flying && !reduced && armed && p >= 0.995 && vel > -0.5 && !(lenis && lenis.isStopped)) fly();

      if (!gl || !mask || !ready) return;
      const cr = canvas.getBoundingClientRect();
      const nr = name.getBoundingClientRect();
      lean += ((flying ? 0 : clamp(-2, 2, vel * 0.06)) - lean) * Math.min(1, dt * 6);
      // Idle glint once the name is fully painted and the page rests.
      if (paint < 0.999 || Math.abs(vel) > 0.08 || flying) rest = 0;
      else rest += dt;
      const gt = (rest - 0.6) % 4.5;
      const idle = rest > 0.6 && gt < 1.4 ? 0.5 - 0.5 * Math.cos((gt / 1.4) * Math.PI) : -1;
      amb.level = flying ? amb.level : 0.08 + 0.2 * paint;

      const x = nr.left - cr.left - mask.pad;
      const yy = nr.top - cr.top - mask.pad;
      const f: RowFrame = {
        x,
        y: yy,
        paint: Math.max(row.paint, row.boost),
        side: 1,
        glint: row.glint >= 0 ? row.glint : idle,
        alpha: row.alpha,
        offsetX: 0,
        scale: row.scale,
        pivotX: x + mask.pivot.x,
        pivotY: yy + mask.pivot.y,
        fx: row.fx,
        film: next.slug,
      };
      gl.render({
        rows: [f],
        bgFrom: next.slug,
        bgTo: next.slug,
        bgMix: 1,
        level: amb.level,
        tint: amb.tint,
        sharp: amb.sharp,
        smear: clamp(-0.05, 0.05, vel * 0.0012),
        tilt: lean * DEG * 0.5,
        skew: -Math.tan(lean * DEG) * 1.4,
        stretch: 1 + Math.min(1.2, Math.abs(vel) * 0.03),
        focusY: nr.top - cr.top + nr.height / 2,
        time: now / 1000,
      });
    };
    gsap.ticker.add(frame);

    const rebuild = () => {
      fit();
      if (gl) {
        gl.resize();
        mask = buildMask(name, base, gl.pixelRatio);
        gl.setMasks([mask]);
      }
    };

    let resizeT = 0;
    let lastW = innerWidth;
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        if (disposed || flying) return;
        if (innerWidth !== lastW) {
          lastW = innerWidth;
          rebuild();
        } else gl?.resize();
      }, 160);
    };
    window.addEventListener("resize", onResize);

    (async () => {
      const weight = getComputedStyle(name).fontWeight;
      try {
        await document.fonts.load(`${weight} 100px "Zalando Sans"`);
        await document.fonts.ready;
      } catch {}
      if (disposed) return;
      fit();
      ready = true;
      const g = gl as PaintworkGL | null; // assigned by ensureGl() from the ticker
      if (g) {
        mask = buildMask(name, base, g.pixelRatio);
        g.setMasks([mask]);
      }
    })();

    return () => {
      disposed = true;
      flyRef.current = null;
      gsap.ticker.remove(frame);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeT);
      tweens.forEach((t) => t.kill());
      gl?.dispose();
    };
  }, [data.slug, next.slug, next.key, href, nextP, router]);

  const onNext = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || !flyRef.current) return;
    e.preventDefault();
    flyRef.current();
  };

  // "All work": the roster pulls back out of this project's row, with this project's film.
  const onAll = () => useStage.getState().setActive(data.slug, []);

  return (
    <section
      ref={rootRef}
      className={c.next}
      aria-labelledby={`${data.slug}-next`}
      style={{ "--next-key": next.keyUi, "--next-poster": `url(${stagePoster(nextP)})` } as CSSProperties}
    >
      <div className={c.nextStage} data-stage>
        <canvas className={c.nextGl} aria-hidden="true" />
        <div className={c.nextTop} data-fade>
          <p className="t-label" id={`${data.slug}-next`}>
            Next project <span className={c.nextCount}>{pad2(next.index + 1)} / {pad2(next.total)}</span>
          </p>
          <p className={`t-label ${c.nextKind}`}>
            {next.kind} · {formatLabel(nextP)}
          </p>
        </div>

        <Link
          href={href}
          className={c.nextNameWrap}
          data-wrap
          data-no-roll
          onClick={onNext}
          prefetch={false}
          aria-label={`Next project: ${next.title}`}
        >
          <span className={c.nextPrimer} aria-hidden="true">
            {next.title}
          </span>
          <span className={c.nextName} data-name>
            {next.title}
            <span className={c.base} data-base aria-hidden="true" />
          </span>
        </Link>

        <div className={c.nextMeter} data-fade aria-hidden="true">
          <p className="t-label">Keep scrolling to paint it</p>
          <span className={c.nextBar}>
            <span />
          </span>
          <p className={`t-label ${c.nextPct}`} data-pct>
            000%
          </p>
        </div>

        <nav className={c.nextNav} aria-label="More work" data-fade>
          <Link href={`/work/${prev.slug}`} className={`t-label ${c.navLink} ${c.navPrev}`}>
            <Chevron back /> Previous <span className={c.navDim}>{prev.title}</span>
          </Link>
          <Link href="/work" className={`t-label ${c.navLink} ${c.navAll}`} onClick={onAll}>
            All work
          </Link>
          <Link href={href} className={`t-label ${c.navLink} ${c.navNext}`} onClick={onNext} prefetch={false}>
            Next <span className={c.navDim}>{next.title}</span> <Chevron />
          </Link>
        </nav>
      </div>
    </section>
  );
}
