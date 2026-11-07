"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { PROJECTS } from "@/content/projects";
import { getLenis } from "@/components/providers/lenis-ref";
import { useIntro } from "@/components/intro/intro-store";
import { PaintworkGL, type RowFrame } from "./paintwork-gl";
import { buildMask, type TextMask } from "./text-mask";
import { getMedia, useStage } from "./stage-store";
import { WORK_META, formatLabel, indexOf, pad2, rowLabel, stagePoster } from "./work-meta";
import { Chevron } from "./Chevron";
import styles from "./work.module.css";

type Filter = "all" | "film" | "stills";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "film", label: "Films" },
  { id: "stills", label: "Stills" },
];
const matches = (f: Filter, i: number) => f === "all" || PROJECTS[i].type === f;
const count = (f: Filter) => PROJECTS.filter((_, i) => matches(f, i)).length;
const DEG = Math.PI / 180;
const clamp = (a: number, b: number, v: number) => Math.min(b, Math.max(a, v));
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const KEYS = Object.fromEntries(Object.entries(WORK_META).map(([k, v]) => [k, v.key]));

type Api = { fly: (i: number) => void; toRow: (i: number) => void; refilter: () => void };

// PAINTWORK, the Work index: a roster of project names. The name on the focus line (mid-screen, marked by
// a red tick) is painted with its own film under a sweeping studio light; the rest stay matte primer.
// The DOM keeps the real text and links (transparent once WebGL draws); paintwork-gl.ts draws the paint.
export default function WorkIndex() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [focus, setFocus] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filterRef = useRef<Filter>("all");
  const api = useRef<Api | null>(null);

  useEffect(() => {
    filterRef.current = filter;
    api.current?.refilter();
  }, [filter]);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const roster = root.querySelector<HTMLElement>("[data-roster]")!;
    const names = [...root.querySelectorAll<HTMLElement>("[data-name]")];
    const bases = [...root.querySelectorAll<HTMLElement>("[data-base]")];
    const fades = () => [...root.querySelectorAll<HTMLElement>("[data-fade]")];
    const labels = [...root.querySelectorAll<HTMLElement>("[data-label]")];
    const topBand = root.querySelector<HTMLElement>("[data-top]")!;
    const plate = root.querySelector<HTMLElement>("[data-plate]")!;
    const prox = labels.map(() => 1);
    let topFade = 1;
    let fadeDist = 150;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { register, report } = useIntro.getState();
    register("work", 0.4);

    let gl: PaintworkGL | null = null;
    if (!reduced) {
      try {
        gl = new PaintworkGL(
          canvas,
          PROJECTS.map((p) => p.slug),
          KEYS,
          getMedia,
          (slug) => stagePoster(PROJECTS[indexOf(slug)]),
        );
      } catch {
        gl = null;
      }
    }
    useStage.getState().setLook(gl ? "gl" : "css");

    // Coming back from a case page: start inside that row's letters and pull back out.
    const entry = useStage.getState();
    const back = entry.mode === "hero" && entry.last ? indexOf(entry.last) : -1;

    let disposed = false;
    let ready = false;
    let shown = false;
    let masks: (TextMask | null)[] = PROJECTS.map(() => null);
    const rows = PROJECTS.map((_, i) => ({
      hover: 0,
      boost: 0,
      offsetX: 0,
      alpha: 1,
      vis: matches(filterRef.current, i) ? 1 : 0,
      scale: 1,
      fx: 0,
      glint: -1,
    }));
    const amb = { level: 0.2, tint: 1, sharp: 0 };
    const bg = { from: PROJECTS[0].slug, to: PROJECTS[0].slug, mix: 1 };
    const rects: DOMRect[] = names.map((n) => n.getBoundingClientRect());
    let focused = -1;
    let hovered = -1;
    let flying = false;
    let lean = 0;
    let vel = 0;
    let lastY = scrollY;
    let lastT = performance.now();
    let idle = 0;
    let snapped = true;
    let rest = 0; // seconds the roster has been still (drives the idle glint)
    let restRow = -1;
    const tweens: gsap.core.Animation[] = [];
    const focusY = () => innerHeight * 0.5;

    const visibleRows = () => PROJECTS.map((_, i) => i).filter((i) => matches(filterRef.current, i));

    const updatePlay = () => {
      const i = hovered >= 0 ? hovered : focused;
      if (i < 0) return;
      const slug = PROJECTS[i].slug;
      const vis = visibleRows();
      const k = vis.indexOf(focused);
      const warm = [vis[k - 1], vis[k + 1]].filter((n) => n !== undefined).map((n) => PROJECTS[n].slug);
      useStage.getState().setActive(slug, warm);
      if (bg.to !== slug) {
        gsap.killTweensOf(bg);
        bg.from = bg.mix > 0.5 ? bg.to : bg.from;
        bg.to = slug;
        bg.mix = 0;
        gsap.to(bg, { mix: 1, duration: 0.9, ease: "power2.inOut" });
      }
    };

    const setHover = (i: number) => {
      if (i === hovered) return;
      if (hovered >= 0) gsap.to(rows[hovered], { hover: 0, duration: 0.45, ease: "power2.out", overwrite: "auto" });
      hovered = i;
      if (i >= 0) gsap.to(rows[i], { hover: 1, duration: 0.4, ease: "power2.inOut", overwrite: "auto" });
      if (i >= 0) root.dataset.hover = String(i);
      else delete root.dataset.hover;
      updatePlay();
    };

    // The roster's first row starts on the focus line, and the last one can reach it.
    const layoutPads = () => {
      roster.style.paddingTop = "";
      roster.style.paddingBottom = "";
      const fy = focusY();
      const top = names[0].getBoundingClientRect();
      const pt = parseFloat(getComputedStyle(roster).paddingTop);
      const firstCenter = top.top + scrollY + top.height / 2;
      roster.style.paddingTop = `${Math.max(0, pt + fy - firstCenter)}px`;
      const last = names[names.length - 1].getBoundingClientRect();
      const lastCenter = last.top + scrollY + last.height / 2;
      const docH = document.documentElement.scrollHeight;
      const pb = parseFloat(getComputedStyle(roster).paddingBottom);
      roster.style.paddingBottom = `${Math.max(0, pb + (lastCenter - fy + innerHeight) - docH)}px`;
      // The top band fades out over the scroll it takes to reach the header.
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 80;
      fadeDist = clamp(56, 150, topBand.offsetTop - headerBottom + 24);
    };

    const rebuild = () => {
      if (!gl) return;
      masks = names.map((n, i) => buildMask(n, bases[i], gl!.pixelRatio));
      gl.setMasks(masks);
    };

    // Zoom needed for the deepest stroke of row i to cover the whole screen (the pivot itself follows
    // the row every frame, so a late scroll correction cannot leave the window off-centre).
    const zoomFor = (i: number) => {
      const m = masks[i]!;
      const r = names[i].getBoundingClientRect();
      const x = r.left - m.pad + m.pivot.x;
      const y = r.top - m.pad + m.pivot.y;
      const w = innerWidth;
      const h = innerHeight;
      const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
      return (far / m.pivot.r) * 1.15;
    };

    const toRow = (i: number, immediate = false) => {
      const r = names[i].getBoundingClientRect();
      const target = scrollY + r.top + r.height / 2 - focusY();
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(target, { immediate, force: immediate, duration: 0.9, easing: expoOut });
      else window.scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" });
    };

    const fly = (i: number) => {
      if (flying) return;
      const p = PROJECTS[i];
      const href = `/work/${p.slug}`;
      flying = true;
      router.prefetch(href);
      getLenis()?.stop();
      const s = rows[i];
      s.boost = Math.max(s.boost, s.hover);
      hovered = -1;
      const stage = useStage.getState();
      stage.setLast(p.slug);
      if (bg.to !== p.slug) {
        bg.from = bg.to;
        bg.to = p.slug;
        bg.mix = 0;
      }
      stage.setActive(p.slug, []);
      const go = () => {
        useStage.getState().setMode("hero", p.slug);
        router.push(href);
      };
      if (!gl || !ready || !masks[i]) {
        tweens.push(gsap.to(root, { opacity: 0, duration: 0.4, ease: "power1.out", onComplete: go }));
        return;
      }
      const need = zoomFor(i);
      const tl = gsap.timeline({ onComplete: go });
      tweens.push(tl);
      // 0-250 ms: the light passes over the name once more, the rest slides off, the plate fades and the
      // room goes dark. 120-900 ms: the camera pushes into the thickest stroke (expo-in, like the loader's
      // "I") until the film inside it fills the screen; the grade melts into the plain video on the way.
      tl.to(fades(), { autoAlpha: 0, duration: 0.25, ease: "power1.out" }, 0);
      tl.to(bg, { mix: 1, duration: 0.5, ease: "power2.out" }, 0);
      rows.forEach((o, j) => {
        if (j === i) return;
        const k = Math.abs(j - i);
        tl.to(o, { offsetX: -innerWidth * 1.15, duration: 0.6, ease: "power3.in" }, 0.025 * k);
        tl.to(o, { alpha: 0, duration: 0.35, ease: "power1.in" }, 0.2 + 0.025 * k);
      });
      tl.to(s, { boost: 1, duration: 0.22, ease: "power2.out" }, 0);
      tl.fromTo(s, { glint: 0 }, { glint: 1, duration: 0.42, ease: "power2.inOut", immediateRender: false }, 0.02);
      tl.set(s, { glint: -1 }, 0.45);
      tl.to(amb, { level: 0, duration: 0.5, ease: "power2.inOut" }, 0.05);
      tl.to(s, { scale: need, duration: 0.78, ease: "expo.in" }, 0.12);
      tl.to(s, { fx: 1, duration: 0.45, ease: "power2.inOut" }, 0.4);
      // Safety net for the last frames: whatever corner the stroke has not reached yet already shows the film.
      tl.to(amb, { tint: 0, sharp: 1, duration: 0.1, ease: "none" }, 0.8);
    };

    const refilter = () => {
      rows.forEach((s, i) => {
        gsap.to(s, { vis: matches(filterRef.current, i) ? 1 : 0, duration: 0.45, ease: "power2.out", overwrite: "auto" });
      });
      if (hovered >= 0 && !matches(filterRef.current, hovered)) setHover(-1);
      snapped = false;
      idle = 0;
    };

    api.current = { fly, toRow: (i) => toRow(i), refilter };

    // Hover paints a row quickly and swaps the light; scrolling or leaving returns to the focused row.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || flying || Math.abs(vel) > 1.5) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
      setHover(el && !el.hasAttribute("data-off") ? Number(el.dataset.row) : -1);
    };
    const onLeave = () => setHover(-1);
    roster.addEventListener("pointermove", onMove);
    roster.addEventListener("pointerleave", onLeave);

    const reveal = () => {
      shown = true;
      root.dataset.gl = gl ? "on" : "off";
      report("work", 1);
      const stage = useStage.getState();
      if (stage.mode === "hero") stage.setMode("index");
      if (back < 0 || !gl) return;
      // Reverse fly-through: out of the letters, the other names slide back in.
      const s = rows[back];
      const tl = gsap.timeline({ delay: 0.05 });
      tweens.push(tl);
      tl.to(amb, { sharp: 0, tint: 1, duration: 0.12, ease: "none" }, 0);
      tl.to(s, { scale: 1, duration: 0.95, ease: "expo.out" }, 0.04);
      tl.to(s, { fx: 0, duration: 0.6, ease: "power2.out" }, 0.2);
      tl.to(s, { boost: 0, duration: 0.6, ease: "power1.out" }, 0.75);
      tl.to(amb, { level: 0.2, duration: 0.9, ease: "power2.out" }, 0.3);
      rows.forEach((o, j) => {
        if (j === back) return;
        const k = Math.abs(j - back);
        tl.to(o, { offsetX: 0, duration: 0.8, ease: "power3.out" }, 0.25 + 0.03 * k);
        tl.to(o, { alpha: 1, duration: 0.5, ease: "power1.out" }, 0.25 + 0.03 * k);
      });
      tl.fromTo(fades(), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power1.out", clearProps: "opacity,visibility" }, 0.55);
    };

    const frame = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const fy = focusY();
      const y = scrollY;
      const v = y - lastY;
      lastY = y;
      vel += (v - vel) * Math.min(1, dt * 14);

      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < names.length; i++) {
        const r = names[i].getBoundingClientRect();
        rects[i] = r;
        if (!matches(filterRef.current, i)) continue;
        const dist = r.top + r.height / 2 - fy;
        if (Math.abs(dist) < Math.abs(bestDist)) {
          best = i;
          bestDist = dist;
        }
      }
      if (!flying && best >= 0 && best !== focused) {
        focused = best;
        setFocus(best);
        updatePlay();
        router.prefetch(`/work/${PROJECTS[best].slug}`);
      }
      if (Math.abs(vel) > 1.5 && hovered >= 0) setHover(-1);

      // The top band fades before it reaches the header; row labels step aside for the spec plate.
      if (!flying) {
        const tf = clamp(0, 1, 1 - y / fadeDist);
        if (Math.abs(tf - topFade) > 0.004) {
          topFade = tf;
          topBand.style.setProperty("--fade", tf.toFixed(3));
        }
        const pr = plate.getBoundingClientRect();
        for (let i = 0; i < labels.length; i++) {
          const lr = labels[i].getBoundingClientRect();
          const gap = Math.max(pr.top - lr.bottom, lr.top - pr.bottom);
          const v2 = Math.min(clamp(0, 1, (gap - 8) / 48), clamp(0, 1, (lr.top - 96) / 40));
          if (Math.abs(v2 - prox[i]) > 0.01) {
            prox[i] = v2;
            labels[i].style.setProperty("--prox", v2.toFixed(3));
          }
        }
      }

      // Rest on a row: once the wheel stops, ease the nearest name onto the line.
      const lenis = getLenis();
      if (ready && !flying && lenis && !lenis.isStopped) {
        if (Math.abs(v) > 0.05 || lenis.isScrolling) {
          idle = 0;
          if (Math.abs(v) > 0.5) snapped = false;
        } else idle += dt;
        if (!snapped && idle > 0.14 && best >= 0) {
          snapped = true;
          if (Math.abs(bestDist) > 1.5) lenis.scrollTo(lenis.scroll + bestDist, { duration: 0.9, easing: expoOut });
        }
      }

      // Speed lean: the rows tilt and slant with the scroll speed, and settle when it stops.
      const leanT = flying ? 0 : clamp(-3, 3, vel * 0.09);
      lean += (leanT - lean) * Math.min(1, dt * 6);

      if (!gl || !ready) return;
      // Idle glint: once the roster has rested on a row for a moment, the light passes over its paint now
      // and then (every 6.5 s, 1.5 s per pass).
      const target = hovered >= 0 ? hovered : focused;
      if (target !== restRow || Math.abs(vel) > 0.08 || flying) {
        rest = 0;
        restRow = target;
      } else rest += dt;
      const gt = (rest - 1.1) % 6.5;
      const idleGlint = rest > 1.1 && gt < 1.5 ? 0.5 - 0.5 * Math.cos((gt / 1.5) * Math.PI) : -1;

      // Hovering another name takes the light off the focused one, so only one name is ever painted.
      let h1 = -1;
      let h2 = -1;
      let hi = -1;
      rows.forEach((s, i) => {
        if (s.hover > h1) {
          h2 = h1;
          h1 = s.hover;
          hi = i;
        } else if (s.hover > h2) h2 = s.hover;
      });
      // Scroll paint: a row's distance to the focus line over the distance to its neighbour on the line's
      // side, so between two rows the light is half-way across both (one painting, one stripping).
      const vis = visibleRows();
      const centre = (i: number) => rects[i].top + rects[i].height / 2;
      const frows: RowFrame[] = rows.map((s, i) => {
        const m = masks[i];
        const r = rects[i];
        let scrollPaint = 0;
        let d = 0;
        if (m && !flying) {
          d = centre(i) - fy;
          const k = vis.indexOf(i);
          const nb = k < 0 ? -1 : d > 0 ? (vis[k - 1] ?? -1) : (vis[k + 1] ?? -1);
          const travel = nb >= 0 ? Math.abs(centre(i) - centre(nb)) : r.height + m.lineH;
          scrollPaint = clamp(0, 1, 1 - (Math.abs(d) / Math.max(1, travel) - 0.04) / 0.92);
        }
        const other = Math.max(0, i === hi ? h2 : h1);
        const fromScroll = scrollPaint * (1 - other);
        const own = Math.max(s.hover, s.boost);
        const paint = Math.max(fromScroll, own);
        // Which way the paint sits relative to the light: scrolling paints the arriving row behind the band
        // and strips the leaving row behind it; a hover paints, and stripping for a hover works like leaving.
        const side = own >= fromScroll ? 1 : other > 0.001 ? -1 : d < 0 ? -1 : 1;
        return {
          x: r.left - (m?.pad ?? 0),
          y: r.top - (m?.pad ?? 0),
          paint,
          side,
          glint: s.glint >= 0 ? s.glint : i === target && !flying ? idleGlint : -1,
          alpha: s.alpha * s.vis,
          offsetX: s.offsetX,
          scale: s.scale,
          pivotX: r.left - (m?.pad ?? 0) + (m?.pivot.x ?? 0),
          pivotY: r.top - (m?.pad ?? 0) + (m?.pivot.y ?? 0),
          fx: s.fx,
          film: PROJECTS[i].slug,
        };
      });
      gl.render({
        rows: frows,
        bgFrom: bg.from,
        bgTo: bg.to,
        bgMix: bg.mix,
        level: amb.level,
        tint: amb.tint,
        sharp: amb.sharp,
        smear: clamp(-0.07, 0.07, vel * 0.0016),
        tilt: lean * DEG * 0.55,
        skew: -Math.tan(lean * DEG) * 1.6,
        stretch: 1 + Math.min(1.4, Math.abs(vel) * 0.035),
        focusY: fy,
        time: now / 1000,
      });
      if (!shown) reveal();
    };
    gsap.ticker.add(frame);

    let lastW = innerWidth;
    let resizeT = 0;
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        if (disposed) return;
        gl?.resize();
        if (innerWidth !== lastW) {
          lastW = innerWidth;
          rebuild();
        }
        layoutPads();
      }, 160);
    };
    window.addEventListener("resize", onResize);

    (async () => {
      const weight = getComputedStyle(names[0]).fontWeight;
      try {
        await document.fonts.load(`${weight} 100px "Zalando Sans"`);
        await document.fonts.ready;
      } catch {}
      if (disposed) return;
      layoutPads();
      rebuild();
      if (back >= 0) {
        toRow(back, true);
        if (gl && masks[back]) {
          Object.assign(rows[back], { scale: zoomFor(back), fx: 1, boost: 1 });
          rows.forEach((o, j) => {
            if (j !== back) Object.assign(o, { offsetX: -innerWidth * 1.15, alpha: 0 });
          });
          Object.assign(amb, { level: 0, tint: 0, sharp: 1 });
          gsap.set(fades(), { autoAlpha: 0 });
        }
      }
      ready = true;
      if (!gl) reveal();
    })();

    return () => {
      disposed = true;
      api.current = null;
      gsap.ticker.remove(frame);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeT);
      roster.removeEventListener("pointermove", onMove);
      roster.removeEventListener("pointerleave", onLeave);
      tweens.forEach((t) => t.kill());
      gsap.killTweensOf(bg);
      gsap.killTweensOf(rows);
      gsap.killTweensOf(amb);
      gl?.dispose();
    };
  }, [router]);

  const onRowClick = (e: MouseEvent, i: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    api.current?.fly(i);
  };

  const visible = PROJECTS.map((_, i) => i).filter((i) => matches(filter, i));
  const fp = PROJECTS[focus];
  const pos = Math.max(0, visible.indexOf(focus));

  return (
    <div ref={rootRef} className={styles.page}>
      <canvas ref={canvasRef} className={styles.gl} aria-hidden="true" />

      <div className={styles.top} data-fade data-top>
        <div className={styles.intro}>
          <p className={`t-label ${styles.eyebrow}`}>
            Work <span aria-hidden="true">·</span> {pad2(PROJECTS.length)}
          </p>
          <p className={styles.lede}>CGI and VFX films and stills for car brands.</p>
        </div>
        <div className={styles.filters} role="group" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`t-label ${styles.filter}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label} {pad2(count(f.id))}
            </button>
          ))}
        </div>
      </div>

      <h1 className="sr-only">Work</h1>
      <ol className={styles.roster} id="work" data-roster data-no-roll>
        {PROJECTS.map((p, i) => {
          const off = !matches(filter, i);
          return (
            <li
              key={p.slug}
              className={styles.row}
              data-row={i}
              data-off={off || undefined}
              data-focus={i === focus || undefined}
              style={{ "--poster": `url(${stagePoster(p)})` } as CSSProperties}
            >
              <div className={styles.clip}>
                <Link
                  href={`/work/${p.slug}`}
                  className={styles.link}
                  onClick={(e) => onRowClick(e, i)}
                  onFocus={() => api.current?.toRow(i)}
                  tabIndex={off ? -1 : undefined}
                  aria-hidden={off || undefined}
                  prefetch={false}
                >
                  <span className={styles.name} data-name>
                    {p.title}
                    <sup className={styles.num} data-fade data-skip>
                      {pad2(i + 1)}
                    </sup>
                    <span className={styles.base} data-base aria-hidden="true" />
                  </span>
                  <span className={`t-label ${styles.label}`} data-fade data-label>
                    {rowLabel(p)}
                  </span>
                </Link>
              </div>
              <div className={styles.hair} aria-hidden="true">
                <span className="t-label">
                  {p.title} · {p.type === "film" ? "Film" : "Stills"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <span className={styles.tick} aria-hidden="true" data-fade />

      <aside className={styles.plate} data-fade data-plate data-no-roll aria-label="Project in focus">
        <div key={fp.slug} className={styles.plateIn}>
          <p className={`t-label ${styles.plateCount}`}>
            {pad2(pos + 1)} / {pad2(visible.length)}
          </p>
          <p className={styles.plateTitle}>{fp.title}</p>
          <p className={`t-label ${styles.plateMeta}`}>
            {fp.kind}
            <span className={styles.plateFormat}>
              {" "}
              <span aria-hidden="true">·</span> {formatLabel(fp)}
            </span>
          </p>
          <p className={styles.plateBlurb}>{fp.blurb}</p>
          <Link href={`/work/${fp.slug}`} className={`t-label ${styles.open}`} onClick={(e) => onRowClick(e, focus)} prefetch={false}>
            Open project <Chevron />
          </Link>
        </div>
      </aside>
    </div>
  );
}
