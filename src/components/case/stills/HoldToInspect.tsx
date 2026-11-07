"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { lqipOf, stillSet, stillSrc, type CaseData } from "@/content/cases";
import { MEDIA } from "@/content/projects";
import { Chevron } from "@/components/work/Chevron";
import { Picture } from "../shared/Picture";
import { preloadImage, useEagerNear } from "../shared/preload";
import { useReveal } from "../shared/reveal";
import s from "../shared/shared.module.css";
import x from "./stills.module.css";
import { LoupeGL } from "./loupe-gl";
import { loupeFor, masterLabel, pad2, variantFor } from "./stills-variants";

const clamp = (a: number, b: number, v: number) => Math.min(b, Math.max(a, v));

// Hold to inspect: one still full bleed. Press and hold (mouse) or long-press (touch) lowers a glass loupe
// onto the print: it opens at the print's own scale and zooms to the 3200 px render tile at 1:1 under the
// pointer, with the master-pixel position read out under it. The 3200 tile is fetched ahead on desktop (once
// the print is mostly in view, or the pointer is over it) and otherwise on the first press; the on-screen
// picture fills the loupe until it arrives. Release closes it. Keyboard: the
// "Inspect at 1:1" button pins the loupe at layout.loupeAt; arrow keys move it, Esc closes it.
// On touch the loupe sits above the finger so the finger never hides it.
export function HoldToInspect({ data }: { data: CaseData }) {
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useReveal<HTMLDivElement>();
  const footRef = useReveal<HTMLDivElement>();
  const st = loupeFor(data);
  const v = variantFor(data);
  const [u0, v0] = data.layout.loupeAt ?? [0.5, 0.5];
  const id = `${data.slug}-inspect`;
  useEagerNear(rootRef, "150% 0px", data.slug);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !st) return;
    const frame = root.querySelector<HTMLElement>("[data-frame]")!;
    const img = frame.querySelector<HTMLImageElement>("img")!;
    const lens = root.querySelector<HTMLElement>("[data-lens]")!;
    const glass = root.querySelector<HTMLElement>("[data-glass]")!;
    const canvas = glass.querySelector<HTMLCanvasElement>("canvas")!;
    const readX = root.querySelector<HTMLElement>("[data-rx]")!;
    const readY = root.querySelector<HTMLElement>("[data-ry]")!;
    const readZ = root.querySelector<HTMLElement>("[data-rz]")!;
    const ring = root.querySelector<HTMLElement>("[data-ring]")!;
    const hint = root.querySelector<HTMLElement>("[data-hint]")!;
    const btn = root.querySelector<HTMLButtonElement>("[data-btn]")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ar = st.w / st.h;
    const sameOrigin = MEDIA.startsWith("/");

    let disposed = false;
    let gl: LoupeGL | null = null;
    let glFailed = false;
    let hiStarted = false;
    let hi: HTMLImageElement | null = null;
    let isOpen = false;
    let pinned = false;
    let pid = -1;
    let holdT = 0;
    let sx = 0;
    let sy = 0;
    let last: { x: number; y: number; touch: boolean } | null = null;
    let u = u0;
    let vv = v0;
    const prog = { t: 0 };

    gsap.set(lens, { xPercent: -50, yPercent: -50, scale: 0.4, autoAlpha: 0 });
    btn.setAttribute("aria-pressed", "false");
    readZ.textContent = "1:1";

    // The picture is object-fit: cover inside the frame: its on-screen size and offset.
    const geo = () => {
      const r = frame.getBoundingClientRect();
      const W = Math.max(1, r.width);
      const H = Math.max(1, r.height);
      const iw = W / H > ar ? W : H * ar;
      const ih = iw / ar;
      // object-position follows layout.loupeAt horizontally (phones crop the still to a square).
      return { r, iw, ih, ox: (W - iw) * u0, oy: (H - ih) / 2 };
    };

    const toCssLoupe = () => {
      root.dataset.loupe = "css";
      glass.style.backgroundImage = `url("${hi ? hi.src : img.currentSrc || img.src}")`;
    };

    const draw = () => {
      const g = geo();
      const R = lens.offsetWidth / 2;
      const e = prog.t;
      if (gl && gl.ready) {
        gl.resize(R * 2);
        const fin = gl.texW / st.w3200;
        const disp = gl.texW / g.iw;
        gl.render({ cx: u * gl.texW, cy: vv * gl.texH, radius: R, scale: disp + (fin - disp) * e });
      } else if (!gl && glFailed) {
        const bw = g.iw + (st.w3200 - g.iw) * e;
        const bh = g.ih + (st.h3200 - g.ih) * e;
        glass.style.backgroundSize = `${bw.toFixed(1)}px ${bh.toFixed(1)}px`;
        glass.style.backgroundPosition = `${(R - u * bw).toFixed(1)}px ${(R - vv * bh).toFixed(1)}px`;
      }
      readX.textContent = `X ${String(Math.round(u * st.masterW)).padStart(4, "0")}`;
      readY.textContent = `Y ${String(Math.round(vv * st.masterH)).padStart(4, "0")}`;
    };

    const ensureGl = () => {
      if (gl || glFailed) return;
      if (!sameOrigin) {
        glFailed = true;
        toCssLoupe();
        return;
      }
      try {
        gl = new LoupeGL(canvas);
        if (img.complete && img.naturalWidth) gl.setImage(img);
        root.dataset.loupe = "gl";
      } catch {
        gl?.dispose();
        gl = null;
        glFailed = true;
        toCssLoupe();
      }
    };

    // The 3200 px render tile (AVIF when the page already uses it), fetched once: ahead of the first hold on
    // desktop, else on the first press.
    let hiP: Promise<HTMLImageElement | null> | null = null;
    const fetchHi = () => {
      if (!hiP) {
        const fmt = (img.currentSrc || "").endsWith(".avif") ? "avif" : "webp";
        const url = (f: "avif" | "webp") => stillSrc(data.slug, st.n, 3200, f);
        hiP = preloadImage(url(fmt)).then((im) => im ?? (fmt === "avif" ? preloadImage(url("webp")) : null));
      }
      return hiP;
    };
    const ensureHi = () => {
      if (hiStarted) return;
      hiStarted = true;
      root.dataset.tile = "loading";
      readZ.textContent = "Loading 3200 px";
      fetchHi()
        .then((im) => {
          if (disposed) return;
          if (!im) throw new Error("tile");
          hi = im;
          if (gl) {
            try {
              gl.setImage(im);
            } catch {
              gl.dispose();
              gl = null;
              glFailed = true;
            }
          }
          if (!gl) toCssLoupe();
          root.dataset.tile = "hi";
          readZ.textContent = "1:1 · 3200 px";
          draw();
        })
        .catch(() => {
          root.dataset.tile = "lo";
          readZ.textContent = "1:1";
        });
    };

    const openLoupe = () => {
      if (!isOpen) {
        isOpen = true;
        root.dataset.open = "";
        root.dataset.tried = "";
        ensureGl();
        ensureHi();
        gsap.to(lens, { autoAlpha: 1, scale: 1, duration: reduced ? 0 : 0.34, ease: "power3.out", overwrite: "auto" });
        gsap.to(prog, { t: 1, duration: reduced ? 0 : 0.55, ease: "power3.out", onUpdate: draw, overwrite: "auto" });
      }
      btn.setAttribute("aria-pressed", String(pinned));
      draw();
    };
    const closeLoupe = () => {
      if (!isOpen) return;
      isOpen = false;
      pinned = false;
      delete root.dataset.open;
      btn.setAttribute("aria-pressed", "false");
      gsap.to(lens, { autoAlpha: 0, scale: 0.4, duration: reduced ? 0 : 0.24, ease: "power2.in", overwrite: "auto" });
      gsap.to(prog, { t: 0, duration: reduced ? 0 : 0.24, ease: "power2.in", onUpdate: draw, overwrite: "auto" });
    };

    // Lens centre on the pointer (mouse) or above the finger (touch); magnify the point under it.
    const place = (cx: number, cy: number, touch: boolean) => {
      const g = geo();
      const fx = cx - g.r.left;
      const fy = cy - g.r.top;
      u = clamp(0, 1, (fx - g.ox) / g.iw);
      vv = clamp(0, 1, (fy - g.oy) / g.ih);
      const D = lens.offsetWidth;
      let ly = fy;
      if (touch) {
        // Above the finger; below it only when the screen's top edge would cut the loupe.
        ly = cy - D * 0.74 - D / 2 < 8 ? fy + D * 0.74 : fy - D * 0.74;
      }
      gsap.set(lens, { x: fx, y: ly });
      draw();
    };
    const placeUV = (pu: number, pv: number) => {
      const g = geo();
      u = clamp(0, 1, pu);
      vv = clamp(0, 1, pv);
      gsap.set(lens, { x: g.ox + u * g.iw, y: g.oy + vv * g.ih });
      draw();
    };

    // The resting "hold here" mark sits on layout.loupeAt.
    const placeHint = () => {
      const g = geo();
      hint.style.left = `${(g.ox + u0 * g.iw).toFixed(1)}px`;
      hint.style.top = `${(g.oy + v0 * g.ih).toFixed(1)}px`;
    };
    placeHint();

    const qx = gsap.quickTo(ring, "x", { duration: 0.3, ease: "power3.out" });
    const qy = gsap.quickTo(ring, "y", { duration: 0.3, ease: "power3.out" });

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // A touch hold takes 280 ms to open the loupe: start the tile now.
      if (img.complete && img.currentSrc) fetchHi();
      pid = e.pointerId;
      last = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
      root.dataset.tried = "";
      if (e.pointerType !== "touch") {
        e.preventDefault();
        frame.setPointerCapture?.(e.pointerId);
        pinned = false;
        place(e.clientX, e.clientY, false);
        openLoupe();
        return;
      }
      sx = e.clientX;
      sy = e.clientY;
      window.clearTimeout(holdT);
      holdT = window.setTimeout(() => {
        holdT = 0;
        if (pid < 0 || !last) return;
        pinned = false;
        place(last.x, last.y, true);
        openLoupe();
        navigator.vibrate?.(8);
      }, 280);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        const r = frame.getBoundingClientRect();
        qx(e.clientX - r.left);
        qy(e.clientY - r.top);
      }
      if (e.pointerId !== pid) return;
      last = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
      if (holdT && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) {
        // The finger is scrolling the page, not holding.
        window.clearTimeout(holdT);
        holdT = 0;
        pid = -1;
        return;
      }
      if (isOpen) place(e.clientX, e.clientY, last.touch);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      window.clearTimeout(holdT);
      holdT = 0;
      pid = -1;
      if (isOpen && !pinned) closeLoupe();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (img.complete && img.currentSrc) fetchHi();
      const r = frame.getBoundingClientRect();
      gsap.set(ring, { x: e.clientX - r.left, y: e.clientY - r.top });
      ring.dataset.on = "";
    };
    const onLeave = () => delete ring.dataset.on;
    // While the loupe is open a moving finger steers it instead of scrolling the page.
    const onTouchMove = (e: TouchEvent) => {
      if (isOpen && e.cancelable) e.preventDefault();
    };
    const onContext = (e: Event) => {
      if (isOpen || holdT) e.preventDefault();
    };
    const onScroll = () => {
      if (isOpen && pid >= 0 && last) place(last.x, last.y, last.touch);
    };
    const onDragStart = (e: Event) => e.preventDefault();
    const onBlur = () => {
      pid = -1;
      closeLoupe();
    };

    const onBtn = () => {
      root.dataset.tried = "";
      if (isOpen && pinned) {
        closeLoupe();
        return;
      }
      pinned = true;
      placeUV(u0, v0);
      openLoupe();
    };
    const onBtnKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeLoupe();
        return;
      }
      if (!pinned) return;
      const step = e.shiftKey ? 0.08 : 0.02;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = d[e.key];
      if (!m) return;
      e.preventDefault();
      placeUV(u + m[0], vv + m[1]);
    };

    frame.addEventListener("pointerdown", onDown);
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerup", onUp);
    frame.addEventListener("pointercancel", onUp);
    frame.addEventListener("lostpointercapture", onUp);
    frame.addEventListener("pointerenter", onEnter);
    frame.addEventListener("pointerleave", onLeave);
    frame.addEventListener("touchmove", onTouchMove, { passive: false });
    frame.addEventListener("contextmenu", onContext);
    frame.addEventListener("dragstart", onDragStart);
    btn.addEventListener("click", onBtn);
    btn.addEventListener("keydown", onBtnKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("blur", onBlur);

    // Desktop: once the print is mostly in view (and its own picture is in), fetch the tile in the background,
    // so the first hold is sharp at once. Not on touch or Save-Data (it is a large file).
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let preT = 0;
    const prefetch = () => {
      if (img.complete && img.currentSrc) preT = window.setTimeout(() => !disposed && fetchHi(), 400);
      else img.addEventListener("load", prefetch, { once: true });
    };
    const hio = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        hio.disconnect();
        prefetch();
      },
      { threshold: 0.4 },
    );
    if (!conn?.saveData && matchMedia("(hover: hover) and (pointer: fine)").matches) hio.observe(frame);

    const ro = new ResizeObserver(() => {
      placeHint();
      if (isOpen) {
        if (pinned) placeUV(u, vv);
        else draw();
      }
    });
    ro.observe(frame);

    return () => {
      disposed = true;
      window.clearTimeout(holdT);
      frame.removeEventListener("pointerdown", onDown);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerup", onUp);
      frame.removeEventListener("pointercancel", onUp);
      frame.removeEventListener("lostpointercapture", onUp);
      frame.removeEventListener("pointerenter", onEnter);
      frame.removeEventListener("pointerleave", onLeave);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("contextmenu", onContext);
      frame.removeEventListener("dragstart", onDragStart);
      btn.removeEventListener("click", onBtn);
      btn.removeEventListener("keydown", onBtnKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("blur", onBlur);
      ro.disconnect();
      hio.disconnect();
      window.clearTimeout(preT);
      img.removeEventListener("load", prefetch);
      gsap.killTweensOf([lens, prog, ring]);
      gl?.dispose();
    };
  }, [data.slug, st, u0, v0]);

  if (!st) return null;
  const total = data.stills.length;

  return (
    <section ref={rootRef} className={x.inspect} aria-labelledby={id}>
      <div ref={headRef} className={x.inspectHead}>
        <div className={x.headText}>
          <p className={`t-label ${s.kicker} ${s.reveal}`}>
            <Chevron className={s.keyChev} />
            <span id={id}>Hold to inspect</span>
          </p>
          <h2 className={`${s.h2} ${s.reveal}`} style={{ "--d": 90 } as CSSProperties}>
            Look closer
          </h2>
        </div>
        <p className={`t-label ${x.inspectFacts} ${s.reveal}`} style={{ "--d": 160 } as CSSProperties}>
          <span className={s.keyNum}>
            Still {pad2(st.n)} / {pad2(total)}
          </span>
          <span>{masterLabel(st)} master</span>
        </p>
      </div>

      <div className={x.inspectFrame} data-frame style={{ "--ar": st.w / st.h, "--fx": u0 } as CSSProperties}>
        <Picture
          set={stillSet(data.slug, st.n)}
          w={st.w}
          h={st.h}
          alt={st.alt}
          sizes="100vw"
          className={x.inspectPic}
          lqip={lqipOf(data, "stills", st.n)}
        />
        <span className={x.inspectShade} aria-hidden="true" />
        <span className={x.hintSpot} data-hint aria-hidden="true">
          <span className={`t-label ${x.hintWord}`}>
            <span className={x.hintMouse}>Hold</span>
            <span className={x.hintFinger}>Long-press</span>
          </span>
        </span>
        <span className={x.ring} data-ring aria-hidden="true">
          <span className={x.ringIn}>
            <span className="t-label">Hold</span>
          </span>
        </span>
        <span className={x.lens} data-lens aria-hidden="true">
          <span className={x.lensGlass} data-glass>
            <canvas />
          </span>
          <span className={x.lensCross} />
          <span className={`${s.tc} ${x.lensRead}`}>
            <span data-rx />
            <span data-ry />
            <span data-rz className={x.lensZoom} />
          </span>
        </span>
        <button type="button" className={x.inspectBtn} data-btn aria-describedby={`${id}-how`}>
          <span className={x.inspectIcon} aria-hidden="true" />
          <span>Inspect at 1:1</span>
        </button>
      </div>

      <div ref={footRef} className={x.inspectFoot}>
        {/* CONFIRM WITH ADIL: detail note for this still */}
        <div className={`${s.box} ${x.noteBox}`}>
          <span className={s.draft}>Text box · draft copy</span>
          <p className={`${s.lead} ${s.reveal}`}>{st.caption}</p>
          <p className={`${s.body} ${s.reveal}`} style={{ "--d": 120 } as CSSProperties}>
            {v.note}
          </p>
        </div>
        <p id={`${id}-how`} className={`${x.how} ${s.reveal}`} style={{ "--d": 200 } as CSSProperties}>
          <span className={x.hintMouse}>Press and hold anywhere on the frame.</span>
          <span className={x.hintFinger}>Touch and hold anywhere on the frame.</span> The loupe shows the 3200 px render
          tile at 1:1 and reads out the position on the {masterLabel(st)} master. With a keyboard, use the button, then the
          arrow keys.
        </p>
      </div>
    </section>
  );
}
