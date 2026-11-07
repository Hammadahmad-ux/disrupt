"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stopAllStreams } from "@/components/fx/hls";
import { getLenis } from "@/components/providers/lenis-ref";
import { CONTACT, SOCIAL } from "@/components/contact/contact-details";
import { ServiceMedia } from "@/components/services/ServiceMedia";
import { afterSettle } from "@/components/work/network";
import { MENU_ITEMS, currentIndex, glowSrc } from "./menu-items";
import { MENU_ID, useMenu } from "./menu-store";
import styles from "./menu.module.css";

gsap.registerPlugin(ScrollTrigger);

const REDUCED = "(prefers-reduced-motion: reduce)";
// The film preview needs a mouse and room; phones and tablets get the list and one still.
const PREVIEW = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';
const SKIP_INERT = new Set(["HEADER", "SCRIPT", "STYLE", "NOSCRIPT", "LINK", "NEXT-ROUTE-ANNOUNCER", "NEXTJS-PORTAL"]);
const COUNT = String(MENU_ITEMS.length).padStart(2, "0");
const pad2 = (n: number) => String(n).padStart(2, "0");
const ukTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

// The wipe's leading edge is the ">" notch from the left side of the logo's R: covered from x to the
// right, with the notch's point d px further in at mid height.
const notchDepth = (w: number, h: number) => Math.min(Math.max(w * 0.13, 56), h * 0.3);

function notchAt(x: number, w: number, h: number, d: number) {
  const r = w + d + 6;
  return `polygon(${x}px 0px, ${r}px 0px, ${r}px ${h}px, ${x}px ${h}px, ${x + d}px ${h / 2}px)`;
}

// p = 0 hidden, 1 covered.
function notch(p: number, w: number, h: number) {
  const d = notchDepth(w, h);
  return notchAt(w + 2 - p * (w + d + 4), w, h, d);
}

// Current wipe progress (and running tween) per element, so a wipe reversed or restarted half-way
// continues from where it is instead of fighting the old tween.
const progress = new WeakMap<HTMLElement, number>();
const running = new WeakMap<HTMLElement, gsap.core.Tween>();

function wipe(el: HTMLElement, to: number, vars: gsap.TweenVars) {
  running.get(el)?.kill();
  const st = { p: progress.get(el) ?? 0 };
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const apply = () => {
    progress.set(el, st.p);
    el.style.clipPath = st.p >= 1 ? "none" : notch(st.p, w, h);
  };
  apply();
  const tween = gsap.to(st, { p: to, ...vars, onUpdate: apply });
  running.set(el, tween);
  return tween;
}

function setWiped(el: HTMLElement, p: 0 | 1) {
  running.get(el)?.kill();
  progress.set(el, p);
  el.style.clipPath = p === 1 ? "none" : notch(0, el.offsetWidth, el.offsetHeight);
}

type Controller = { leaveTo: (href: string) => void; arrive: () => void; preview: (i: number) => void };

/**
 * The site menu. The header's button opens it: a taillight-red sheet and the dark panel wipe in from the
 * button's side with the R's ">" notch as their edge, leaving a thin red frame. Big numbered links rise
 * out of masks; hovering one cuts the preview screen to a film from that part of the site.
 * Links close the menu and glide to their section; links to another page keep the panel up as a
 * curtain until the new page is in. The header CTA uses the same curtain from other pages.
 */
export default function SiteMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const open = useMenu((s) => s.open);
  const armed = useMenu((s) => s.armed);
  const warm = useMenu((s) => s.warm);
  const canPreview = useMedia(PREVIEW);
  const reduced = useMedia(REDUCED);

  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const lineGlowRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGCircleElement>(null);
  const curtainRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const ctl = useRef<Controller | null>(null);
  const pathRef = useRef(pathname);
  const routerRef = useRef(router);

  const [hover, setHover] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const current = currentIndex(pathname);
  const preview = shown ?? (current >= 0 ? current : 0);
  // Loading: once the page has settled the previews' posters load (warm), so the screen shows a picture
  // even when the menu is opened without a hover (touch); the films themselves load on intent (armed:
  // hover, focus or press of the menu button), the one for the page we are on first.
  const ready = armed || warm;
  const media = ready && canPreview;

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => afterSettle(() => useMenu.getState().prewarm(), 2500), []);

  useEffect(() => {
    const el = clockRef.current!;
    const tick = () => (el.textContent = ukTime.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    const sheet = sheetRef.current!;
    const panel = panelRef.current!;
    const body = bodyRef.current!;
    const foot = footRef.current!;
    const screen = screenRef.current!;
    const curtainLabel = curtainRef.current!;
    const html = document.documentElement;
    const isReduced = () => matchMedia(REDUCED).matches;

    let state: "closed" | "opening" | "open" | "closing" = "closed";
    let mode: "menu" | "curtain" = "menu";
    let tl: gsap.core.Timeline | null = null;
    let lenisWasStopped = false;
    let inerted: Element[] = [];
    let pendingId: string | null = null; // section to land on once the next page is in
    let waiting = false; // covered, waiting for the route to change
    let fallback = 0;
    let focusAfter: "button" | "none" = "button";
    let z = 1;
    let shownLayer = -1;

    // ---- The cover: one progress value drives the red sheet and the dark panel. ----
    // The sheet leads by a taillight streak that is widest early in the move and melts into the red
    // frame as the panel lands, so the red reads as a light passing, not a red screen.
    // The header's two groups (wordmark, actions) turn paper the moment the panel's edge passes them,
    // so nothing goes paper-on-paper over a light section or ink-on-ink over the panel.
    let cover = 0;
    let covered = "";
    let geo = { W: 0, H: 0, d: 0, f: 0, lead: 0, groups: [] as { name: string; cx: number; cy: number }[] };
    const measure = () => {
      const W = root.clientWidth;
      const H = root.clientHeight;
      const groups = [...document.querySelectorAll<HTMLElement>("header [data-cover]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.dataset.cover!, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      });
      geo = { W, H, d: notchDepth(W, H), f: panel.offsetLeft, lead: Math.min(120, Math.max(32, W * 0.07)), groups };
    };
    const setCovered = (names: string[]) => {
      const s = names.join(" ");
      if (s === covered) return;
      covered = s;
      if (s) html.dataset.menuCover = s;
      else delete html.dataset.menuCover;
    };
    const paintCover = (p: number, header = true) => {
      cover = p;
      const { W, H, d, f, lead } = geo;
      const xs = W + 2 - p * (W + d + 4); // the sheet's notch corners, in viewport px
      const xp = xs + lead * 4 * p * (1 - p); // the panel trails by the streak
      const hp = (H - 2 * f) / 2;
      sheet.style.clipPath = p >= 1 ? "none" : notchAt(xs, W, H, d);
      panel.style.clipPath = p >= 1 ? "none" : notchAt(xp - f, W - 2 * f, H - 2 * f, d);
      if (!header) return;
      setCovered(
        geo.groups
          .filter((g) => p >= 1 || xp + d * Math.min(1, Math.max(0, Math.min(g.cy - f, H - f - g.cy) / hp)) < g.cx)
          .map((g) => g.name),
      );
    };
    const coverTo = (to: number, vars: gsap.TweenVars) => {
      const st = { p: cover };
      paintCover(st.p); // clip before the first frame (the root turns visible right away)
      return gsap.to(st, { p: to, ...vars, onUpdate: () => paintCover(st.p) });
    };

    // Scroll lock, and everything but the header and the menu becomes inert while it is open.
    const lock = () => {
      const lenis = getLenis();
      lenisWasStopped = !!lenis?.isStopped;
      lenis?.stop();
      html.style.scrollbarGutter = "stable";
      html.style.overflow = "hidden";
      inerted = [...document.body.children].filter(
        (el) => el !== root && !SKIP_INERT.has(el.tagName) && !el.hasAttribute("inert"),
      );
      inerted.forEach((el) => el.setAttribute("inert", ""));
    };
    const unlock = () => {
      html.style.overflow = "";
      html.style.scrollbarGutter = "";
      inerted.forEach((el) => el.removeAttribute("inert"));
      inerted = [];
      if (!lenisWasStopped) getLenis()?.start();
    };

    const layerOf = (i: number) => screen.querySelector<HTMLElement>(`[data-layer="${i}"]`);

    // Put a preview on top of the screen: a quick notch wipe while the menu is up, instantly otherwise.
    const showLayer = (i: number, animate: boolean) => {
      const layer = layerOf(i);
      if (!layer || i === shownLayer) return;
      shownLayer = i;
      layer.style.zIndex = String(++z);
      layer.style.visibility = "visible";
      // Once a layer covers the screen, hide the ones under it: their edges bled through as a 1px
      // coloured seam at the screen's fractional bottom edge.
      const settle = () => {
        if (shownLayer !== i) return;
        screen.querySelectorAll<HTMLElement>("[data-layer]").forEach((l) => {
          if (l !== layer) l.style.visibility = "hidden";
        });
      };
      const inner = layer.firstElementChild as HTMLElement | null;
      if (inner) gsap.killTweensOf(inner);
      if (!animate || isReduced()) {
        setWiped(layer, 1);
        if (inner) gsap.set(inner, { scale: 1, xPercent: 0 });
        settle();
        return;
      }
      progress.set(layer, 0);
      wipe(layer, 1, { duration: 0.8, ease: "expo.out", onComplete: settle });
      if (inner) gsap.fromTo(inner, { scale: 1.14, xPercent: 3 }, { scale: 1, xPercent: 0, duration: 1.2, ease: "expo.out" });
    };

    const focusSection = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };

    const show = (next: "menu" | "curtain") => {
      tl?.kill();
      if (state === "closed" || state === "closing") lock();
      state = "opening";
      mode = next;
      root.dataset.state = "opening";
      root.dataset.mode = mode;
      html.dataset.menu = "open";
      const reduce = isReduced();

      tl = gsap.timeline({
        onComplete: () => {
          state = "open";
          root.dataset.state = "open";
        },
      });

      // The screen shows the page we are on (or the last hovered link) as soon as it appears.
      if (mode === "menu") {
        shownLayer = -1;
        const first = Number(screen.dataset.preview ?? 0);
        showLayer(first, false);
      }

      measure();
      if (reduce) {
        paintCover(1, false);
        setWiped(screen, 1);
        gsap.set([body, foot], { opacity: 1, y: 0 });
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
        tl.call(() => setCovered(geo.groups.map((g) => g.name)), undefined, 0.12);
      } else {
        gsap.set(root, { opacity: 1 });
        // Fast off the mark from the button's corner, long soft landing on the wordmark side.
        tl.add(coverTo(1, { duration: 0.9, ease: "expo.out" }), 0);
        if (mode === "menu") {
          gsap.set([body, foot], { opacity: 1, y: 0 });
          body.querySelectorAll<HTMLElement>("[data-line]").forEach((line, i) => {
            tl!.fromTo(
              line.querySelectorAll("[data-ch]"),
              { yPercent: 125 },
              { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.022 },
              0.22 + i * 0.055,
            );
          });
          tl.fromTo(
            body.querySelectorAll("[data-meta]"),
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.04 },
            0.45,
          );
          progress.set(screen, 0);
          tl.add(wipe(screen, 1, { duration: 1.05, ease: "expo.out" }), 0.3);
          tl.fromTo(screen.querySelector("[data-zoom]"), { scale: 1.18 }, { scale: 1, duration: 1.5, ease: "expo.out" }, 0.3);
          tl.fromTo(
            foot.querySelectorAll("[data-foot]"),
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.05 },
            0.42,
          );
        }
      }

      if (mode === "menu") root.focus({ preventScroll: true });
    };

    const hide = () => {
      if (state === "closed" || state === "closing") return;
      window.clearTimeout(fallback);
      waiting = false;
      tl?.kill();
      state = "closing";
      root.dataset.state = "closing";
      unlock();
      const button = document.querySelector<HTMLElement>("[data-menu-button]");
      if (focusAfter === "button" && mode === "menu") button?.focus({ preventScroll: true });
      else if (root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      focusAfter = "button";

      const reduce = isReduced();
      measure();
      tl = gsap.timeline({
        onComplete: () => {
          state = "closed";
          root.dataset.state = "closed";
          root.dataset.mode = "";
          paintCover(0);
          delete html.dataset.menu;
          gsap.set(root, { opacity: 1 });
          setHover(null);
          setShown(null);
        },
      });
      if (reduce) {
        tl.to(root, { opacity: 0, duration: 0.25, ease: "power1.in" });
        tl.call(() => setCovered([]), undefined, 0.12);
      } else {
        // The panel pulls back into the button's side: fast at first, a short tail. The header's
        // groups return to the page's tone as the edge uncovers them (paintCover).
        tl.to([body, foot], { opacity: 0, duration: 0.16, ease: "power1.in" }, 0);
        tl.add(coverTo(0, { duration: 0.7, ease: "expo.out" }), 0.03);
      }
    };

    // Glide to a section on this page. Sections can grow as they come into view (lazy media), so the
    // glide retargets in flight when the section moves, and lands exactly on it.
    let stopGlide = () => {};
    const glideTo = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const lenis = getLenis();
      if (!lenis) {
        el.scrollIntoView({ behavior: isReduced() ? "auto" : "smooth" });
        return;
      }
      stopGlide();
      const DURATION = 1.4;
      const t0 = performance.now();
      const at = () => el.getBoundingClientRect().top + window.scrollY;
      let target = at();
      const off = lenis.on("scroll", () => {
        const now = at();
        if (Math.abs(now - target) < 2) return;
        target = now;
        const left = Math.max(0.4, DURATION - (performance.now() - t0) / 1000);
        lenis.scrollTo(el, { duration: left, onComplete: stop });
      });
      const timer = window.setTimeout(() => stop(), (DURATION + 1.5) * 1000);
      const stop = () => {
        off();
        window.clearTimeout(timer);
      };
      stopGlide = stop;
      lenis.scrollTo(el, { duration: DURATION, onComplete: stop });
    };

    // Jump (no animation) to a section of a page that has just mounted. Its pins, spacers and media
    // settle over the first frames, so wait until the section stops moving, then keep it pinned for a
    // moment while the panel pulls away (unless the visitor scrolls).
    const landOn = (id: string, done: () => void) => {
      const jump = (el: HTMLElement) => {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(el, { immediate: true, force: true });
        else window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
      };
      let last = NaN;
      let still = 0;
      let frames = 0;
      const settle = () => {
        const el = document.getElementById(id);
        const y = el ? el.getBoundingClientRect().top + window.scrollY : NaN;
        still = el && Math.abs(y - last) < 1 ? still + 1 : 0;
        last = y;
        if (!(el && still >= 10) && ++frames < 150) return void requestAnimationFrame(settle);
        if (!el) return done();
        ScrollTrigger.refresh();
        jump(el);
        focusSection(id);
        done();
        // Hold the landing for a short while after the reveal.
        const until = performance.now() + 1200;
        let held = true;
        const release = () => {
          held = false;
          window.removeEventListener("wheel", release);
          window.removeEventListener("touchstart", release);
          window.removeEventListener("keydown", release);
        };
        window.addEventListener("wheel", release, { passive: true });
        window.addEventListener("touchstart", release, { passive: true });
        window.addEventListener("keydown", release);
        const hold = () => {
          if (!held) return;
          if (performance.now() > until) return release();
          if (Math.abs(el.getBoundingClientRect().top) > 2) jump(el);
          requestAnimationFrame(hold);
        };
        requestAnimationFrame(hold);
      };
      requestAnimationFrame(settle);
    };

    // The new page is in: land on the section (behind the panel), then reveal it.
    const arrive = () => {
      if (state === "closed" || state === "closing") return;
      window.clearTimeout(fallback);
      const id = pendingId;
      pendingId = null;
      waiting = false;
      const reveal = () => {
        focusAfter = "none";
        if (useMenu.getState().open) useMenu.getState().setOpen(false);
        else hide();
      };
      if (id) landOn(id, reveal);
      else requestAnimationFrame(() => requestAnimationFrame(reveal));
    };

    // Leaving this page: stop its video downloads (the hero film alone is ~10 MB), so on a slow connection the
    // next page's code and data are not stuck behind them. Only attributes change; React still owns the nodes.
    const freeBandwidth = () => {
      stopAllStreams(); // HLS films (hls.js keeps fetching segments until destroyed)
      document.querySelectorAll("video").forEach((v) => {
        v.pause();
        v.preload = "none";
        v.removeAttribute("src");
        v.querySelectorAll("source").forEach((src) => src.removeAttribute("src"));
        v.load();
      });
    };

    const leaveTo = (href: string) => {
      const url = new URL(href, window.location.href);
      const id = url.hash.slice(1);
      const here = pathRef.current;

      if (url.pathname === here) {
        // Same page: close, and glide to the section (Home glides back to the top).
        const target = id || (here === "/" ? "top" : "");
        focusAfter = "none";
        if (useMenu.getState().open) useMenu.getState().setOpen(false);
        else hide();
        if (target) {
          glideTo(target);
          focusSection(target);
          window.history.replaceState(window.history.state, "", id ? `${here}#${id}` : here);
        }
        return;
      }

      // Another page: keep the panel up as a curtain, change the route, reveal once the page is in.
      if (waiting) return;
      pendingId = id || null;
      const item = MENU_ITEMS.find((m) => m.href === href);
      curtainLabel.textContent = item?.label ?? "";
      const go = () => {
        waiting = true;
        freeBandwidth();
        routerRef.current.push(href, { scroll: !id });
        // On a slow connection the client-side page change can stall; never fall back to the old page.
        // If the route has not changed after 5 s, load the new page directly (the curtain stays up).
        fallback = window.setTimeout(() => {
          if (pathRef.current === here) window.location.assign(href);
          else arrive();
        }, 5000);
      };
      if (state === "open" || state === "opening") {
        gsap.to([body, foot], { opacity: 0, duration: 0.2, ease: "power2.in" });
        go();
      } else {
        show("curtain");
        tl!.call(go);
      }
    };

    ctl.current = {
      leaveTo,
      arrive: () => {
        if (waiting || useMenu.getState().open) arrive();
      },
      preview: (i) => {
        // Animate the cut once the screen itself is in (the open timeline runs ~1.8 s in total).
        if (state === "opening" || state === "open") showLayer(i, state === "open" || (tl?.time() ?? 0) > 0.7);
      },
    };

    const unsub = useMenu.subscribe((s, prev) => {
      if (s.open !== prev.open) {
        if (s.open) show("menu");
        else if (!waiting) hide();
      }
      if (s.go && s.go !== prev.go) leaveTo(s.go.href);
    });

    // Esc closes; Tab stays inside the header and the panel.
    const onKey = (e: KeyboardEvent) => {
      if (state !== "open" && state !== "opening") return;
      if (e.key === "Escape") {
        e.preventDefault();
        useMenu.getState().setOpen(false);
        return;
      }
      if (e.key !== "Tab" || mode !== "menu") return;
      const header = document.querySelector("header");
      const items = [
        ...(header ? header.querySelectorAll<HTMLElement>(FOCUSABLE) : []),
        ...root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (document.activeElement === root && !e.shiftKey) {
        // Just opened (focus is on the dialog): Tab goes to the first link.
        e.preventDefault();
        root.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      } else if (e.shiftKey && i <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (i === -1 || i === items.length - 1)) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // The wordmark goes home through the menu while it is open (so the panel closes the right way).
    const onHeaderClick = (e: globalThis.MouseEvent) => {
      if (state !== "open" && state !== "opening") return;
      const a = (e.target as Element).closest?.('header a[href="/"]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      leaveTo("/");
    };
    document.addEventListener("click", onHeaderClick, true);

    return () => {
      stopGlide();
      unsub();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onHeaderClick, true);
      window.clearTimeout(fallback);
      tl?.kill();
      if (state !== "closed") {
        unlock();
        delete html.dataset.menu;
        delete html.dataset.menuCover;
      }
      ctl.current = null;
    };
  }, []);

  // Route changed (a menu link, the CTA, or the browser's back button while the menu is up).
  useEffect(() => {
    pathRef.current = pathname;
    ctl.current?.arrive();
  }, [pathname]);

  useEffect(() => {
    if (media) ctl.current?.preview(preview);
  }, [preview, media]);

  const onLink = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ctl.current?.leaveTo(href);
  };

  // The signal line: from the hovered word into the monitor, drawn like the home page's racing line.
  useEffect(() => {
    const paths = [lineRef.current!, lineGlowRef.current!];
    const tip = tipRef.current!;
    gsap.killTweensOf([...paths, tip]);
    if (hover === null || !canPreview) {
      gsap.to([...paths, tip], { opacity: 0, duration: 0.3, ease: "power2.out" });
      return;
    }
    const word = bodyRef.current!.querySelectorAll<HTMLElement>("[data-line]")[hover];
    const link = word.parentElement!;
    const screen = screenRef.current!;
    const monitor = screen.parentElement!;
    // offset* ignore the hover nudge (a CSS translate), so add it: clamp(8px, 1.1vw, 20px).
    const nudge = Math.min(20, Math.max(8, window.innerWidth * 0.011));
    const nav = link.offsetParent as HTMLElement; // the nav; its offsetParent is the body grid
    // Start past the word (and past "You are here" on the current page's link).
    const here = link.querySelector<HTMLElement>("[data-here]");
    const end = here ? here.offsetLeft + here.offsetWidth : word.offsetLeft + word.offsetWidth;
    const sx = nav.offsetLeft + link.offsetLeft + end + nudge + (here ? 16 : 26);
    const sy = nav.offsetTop + link.offsetTop + word.offsetTop + word.offsetHeight * 0.52;
    const ex = monitor.offsetLeft + screen.offsetLeft;
    // Land near the word's height (pulled a little toward the screen's middle), so the curve stays gentle
    // even for the bottom link, where the hop to the screen is short.
    const top = monitor.offsetTop + screen.offsetTop;
    const mid = top + screen.offsetHeight * 0.5;
    const ey = Math.min(top + screen.offsetHeight - 28, Math.max(top + 28, mid + (sy - mid) * 0.8));
    const dx = Math.max(24, ex - sx);
    const d = `M${sx} ${sy} C${sx + dx * 0.6} ${sy} ${ex - dx * 0.6} ${ey} ${ex} ${ey}`;
    paths.forEach((p) => p.setAttribute("d", d));
    tip.setAttribute("cx", String(sx));
    tip.setAttribute("cy", String(sy));
    const len = paths[0].getTotalLength();
    gsap.set(paths, { opacity: 1, strokeDasharray: len, strokeDashoffset: len });
    gsap.to(paths, { strokeDashoffset: 0, duration: reduced ? 0 : 0.8, ease: "expo.out", delay: reduced ? 0 : 0.08 });
    gsap.fromTo(tip, { opacity: 0, attr: { r: 0 } }, { opacity: 1, attr: { r: 3.5 }, duration: 0.4, ease: "back.out(3)" });
  }, [hover, canPreview, reduced]);

  const enter = (i: number) => {
    setHover(i);
    setShown(i);
  };

  const active = hover ?? -1;
  const item = MENU_ITEMS[preview];

  return (
    <div
      ref={rootRef}
      id={MENU_ID}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      tabIndex={-1}
      data-state="closed"
    >
      <div ref={sheetRef} className={styles.sheet} aria-hidden="true" />
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.sweep} aria-hidden="true" />

        <div ref={bodyRef} className={styles.body}>
          <svg className={styles.signal} aria-hidden="true">
            <path ref={lineGlowRef} className={styles.signalGlow} />
            <path ref={lineRef} className={styles.signalCore} />
            <circle ref={tipRef} className={styles.signalTip} r="3.5" />
          </svg>
          <nav className={styles.nav} aria-label="Site">
            <p className={`t-label ${styles.kicker}`} data-meta>
              Index <span aria-hidden="true">·</span> {COUNT}
            </p>
            <ul className={styles.list} data-no-roll data-hover={hover !== null || undefined} onPointerLeave={() => setHover(null)}>
              {MENU_ITEMS.map((m, i) => (
                <li
                  key={m.href}
                  className={styles.item}
                  data-active={active === i || undefined}
                  data-current={current === i || undefined}
                >
                  <Link
                    href={m.href}
                    className={styles.link}
                    aria-current={current === i ? "page" : undefined}
                    onClick={onLink(m.href)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
                    onFocus={(e) => e.currentTarget.matches(":focus-visible") && enter(i)}
                    onBlur={() => setHover(null)}
                  >
                    <span className={styles.slot} aria-hidden="true" data-meta>
                      <span className={styles.slotIn}>
                        <span>{pad2(i + 1)}</span>
                        <span className={styles.chev} />
                      </span>
                    </span>
                    <span className={styles.word} aria-hidden="true" data-line>
                      {[...m.label.toUpperCase()].map((ch, k) => (
                        <span key={k} className={styles.ch} style={{ "--i": k } as CSSProperties} data-ch>
                          {ch}
                        </span>
                      ))}
                    </span>
                    <span className="sr-only">{m.label}</span>
                    {current === i && (
                      <span className={`t-label ${styles.here}`} aria-hidden="true" data-meta data-here>
                        You are here
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <figure className={styles.monitor} aria-hidden="true">
            {media && (
              <div className={styles.glow}>
                {MENU_ITEMS.map((m, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.label} src={glowSrc(m.media)} alt="" data-on={i === preview || undefined} decoding="async" fetchPriority="low" />
                ))}
              </div>
            )}
            <figcaption className={`t-label ${styles.cap}`} data-meta>
              <span key={preview} className={styles.capIn}>
                <span className={styles.capNum}>
                  {pad2(preview + 1)} / {COUNT}
                </span>
                <span>{item.note}</span>
              </span>
            </figcaption>
            <div ref={screenRef} className={styles.screen} data-preview={preview}>
              <div className={styles.zoom} data-zoom>
                {ready && !canPreview && (
                  // Phones and tablets: the film of the page we are on plays (one loop, only while open).
                  <ServiceMedia
                    spec={item.media}
                    play={open && !reduced}
                    preload={armed ? "auto" : "none"}
                    className={`${styles.media} ${styles.mobileMedia}`}
                    sizes="100vw"
                  />
                )}
                {media &&
                  MENU_ITEMS.map((m, i) => (
                    <div key={m.label} className={styles.layer} data-layer={i}>
                      <div className={styles.layerIn}>
                        <ServiceMedia
                          spec={m.media}
                          play={open && i === preview && !reduced}
                          preload={!armed ? "none" : i === preview ? "auto" : "metadata"}
                          className={styles.media}
                          sizes="40vw"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <p className={`t-label ${styles.credit}`} data-meta>
              <span key={preview} className={styles.capIn}>
                <span className={styles.rec} />
                {item.credit}
              </span>
            </p>
          </figure>
        </div>

        {/* Shown only while the panel is a curtain between pages (the header CTA from another page). */}
        <p className={`t-label ${styles.curtain}`} aria-hidden="true">
          <span className={styles.curtainChev} />
          <span ref={curtainRef} />
        </p>

        <div ref={footRef} className={styles.foot}>
          <div className={styles.footCol} data-foot>
            <a href={`mailto:${CONTACT.email}`} className={styles.footLink}>
              {CONTACT.email}
            </a>
            <a href={`tel:${CONTACT.phoneHref}`} className={styles.footLink}>
              {CONTACT.phone}
            </a>
          </div>
          <div className={`${styles.footCol} ${styles.social}`} data-foot>
            {SOCIAL.map((s) => (
              <a key={s.label} href={s.href} className={`t-label ${styles.footSocial}`} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ))}
          </div>
          <p className={`${styles.footCol} ${styles.legal}`} data-foot>
            © 2026 DISRUPT · {CONTACT.location}
            <span className={styles.clock}>
              <span className={styles.dot} aria-hidden="true" />
              <span ref={clockRef} /> UK
            </span>
          </p>
        </div>

        {/* The X lives in the header, outside this modal dialog, so screen readers get a close control
            inside it too. Hidden until it has keyboard focus (last stop in the panel). */}
        <button type="button" className={`t-label ${styles.close}`} onClick={() => useMenu.getState().setOpen(false)} data-no-roll>
          Close menu <span aria-hidden="true">· Esc</span>
        </button>
      </div>
    </div>
  );
}
