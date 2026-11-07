"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MEDIA, PROJECTS, loopSources, poster, still, type Project } from "@/content/projects";
import { getLenis } from "@/components/providers/lenis-ref";
import { CASE_PAGES_LINKED } from "@/content/site";
import { lqipBg } from "@/components/work/lqip";
import { afterSettle } from "@/components/work/network";
import DriveCar from "./DriveCar";
import { LEVEL_DEG, TYRE_R } from "./drive-geometry";
import styles from "./drive.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Speed lines behind the car: vertical position and length (% of their box), drift rate, strength,
// and "hot" lines (2px with a soft glow) for the few that read as light trails off the taillights.
const STREAKS = [
  { top: 8, w: 18, k: 1.6, o: 0.35 },
  { top: 15, w: 38, k: 1.05, o: 0.6 },
  { top: 22, w: 14, k: 1.9, o: 0.35 },
  { top: 29, w: 46, k: 0.9, o: 0.95, hot: true },
  { top: 36, w: 24, k: 1.45, o: 0.5 },
  { top: 43, w: 32, k: 1.2, o: 0.7 },
  { top: 50, w: 52, k: 0.82, o: 0.9, hot: true },
  { top: 57, w: 20, k: 1.7, o: 0.45 },
  { top: 64, w: 36, k: 1.12, o: 0.75 },
  { top: 71, w: 16, k: 1.8, o: 0.4 },
  { top: 78, w: 28, k: 1.3, o: 0.6 },
  { top: 85, w: 12, k: 2.0, o: 0.3 },
];

const CARD_SIZES = "(max-width: 900px) 92vw, 34vw";
const avif = (webp: string) => webp.replace(/\.webp$/, ".avif");

function CardMedia({ p }: { p: Project }) {
  if (p.type === "film") {
    return (
      <>
        <picture>
          <source type="image/avif" srcSet={`${MEDIA}/work/${p.slug}/poster.avif`} />
          <img
            className={styles.img}
            src={poster(p.slug)}
            alt=""
            width={1280}
            height={Math.round(1280 / p.aspect)}
            loading="lazy"
            decoding="async"
            style={lqipBg(`${p.slug}/poster`)}
          />
        </picture>
        <video className={styles.video} muted loop playsInline preload="none" tabIndex={-1} aria-hidden="true" data-video>
          {loopSources(p.slug).map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      </>
    );
  }
  // Stills: the first two frames crossfade slowly while the project is in front of the car.
  const frames = Math.min(p.stills ?? 1, 2);
  return (
    <>
      {Array.from({ length: frames }, (_, k) => {
        const s800 = still(p.slug, k + 1, 800);
        const s1600 = still(p.slug, k + 1, 1600);
        return (
          <picture key={k} className={k === 1 ? styles.alt : undefined}>
            <source type="image/avif" srcSet={`${avif(s800)} 800w, ${avif(s1600)} 1600w`} sizes={CARD_SIZES} />
            <img
              className={styles.img}
              src={s800}
              srcSet={`${s800} 800w, ${s1600} 1600w`}
              sizes={CARD_SIZES}
              alt=""
              width={800}
              height={Math.round(800 / p.aspect)}
              loading="lazy"
              decoding="async"
              style={lqipBg(`${p.slug}/${String(k + 1).padStart(2, "0")}`)}
            />
          </picture>
        );
      })}
    </>
  );
}

// Project cards link to the case pages only while CASE_PAGES_LINKED is on (content/site.ts).
function Card({ href, className, children, ...rest }: { href: string; className: string; children: ReactNode; "data-card"?: boolean }) {
  return CASE_PAGES_LINKED ? (
    <a href={href} className={className} tabIndex={-1} aria-hidden="true" {...rest}>
      {children}
    </a>
  ) : (
    <span className={className} aria-hidden="true" {...rest}>
      {children}
    </span>
  );
}

function Stop({ p, i }: { p: Project; i: number }) {
  const href = `/work/${p.slug}`; // placeholder case-study pages
  const id = `work-${p.slug}`;
  return (
    <li className={styles.stop} data-stop data-side={i % 2 ? "bottom" : "top"} style={{ "--i": i, "--aspect": p.aspect } as CSSProperties}>
      <article className={styles.item} aria-labelledby={id}>
        <Card href={href} className={styles.card} data-card>
          <span className={styles.tilt} data-tilt>
            <span className={styles.media}>
              <CardMedia p={p} />
            </span>
            <span className={styles.sheenClip}>
              <span className={styles.sheen} data-sheen />
            </span>
            <span className={`t-label ${styles.tag}`}>{p.type === "film" ? "Film" : `Stills · ${pad(p.stills ?? 1)}`}</span>
            {CASE_PAGES_LINKED && (
              <span className={styles.open}>
                <span className={styles.chev} />
              </span>
            )}
          </span>
        </Card>
        <span className={styles.post} aria-hidden="true" />
        <span className={styles.marker} aria-hidden="true">
          <span className={`t-label ${styles.markerNum}`}>{pad(i + 1)}</span>
        </span>
        <div className={styles.meta}>
          <p className={`t-label ${styles.kicker}`}>
            <span className={styles.num}>{pad(i + 1)}</span>
            <span className={styles.rule} aria-hidden="true" />
            <span>{p.kind}</span>
          </p>
          <h3 className={styles.title}>
            {CASE_PAGES_LINKED ? (
              <a id={id} href={href} className={styles.titleLink}>
                {p.title}
              </a>
            ) : (
              <span id={id}>{p.title}</span>
            )}
          </h3>
          <p className={styles.blurb}>{p.blurb}</p>
        </div>
      </article>
    </li>
  );
}

// "Selected work": a pinned (CSS sticky) road. The world slides left with scroll, the client's RS5 drives through it
// (rims turn by the exact distance), projects pass above and below the road. Without JS, with reduced
// motion or on very short screens the same markup is a calm grid with the car shown once (CSS default).
export default function DriveWork() {
  const rootRef = useRef<HTMLElement>(null);
  const count = PROJECTS.length;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference) and (min-height: 540px)", () => {
        root.dataset.drive = "";
        const one = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
        const all = <T extends HTMLElement = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));

        const stage = one("[data-stage]");
        const track = one("[data-track]");
        const ghost = one("[data-ghost]");
        const road = one("[data-road]");
        const ruler = one("[data-ruler]");
        const outroHead = one("[data-outro-head]");
        const outro = one("[data-outro]");
        const rigs = all("[data-rig]");
        const chassis = all("[data-chassis]");
        const rims = all("[data-rim]");
        const blurs = all("[data-rim-blur]");
        const streakBox = one("[data-streaks]");
        const streaks = all("[data-streak]");
        const brake = one("[data-brake]");
        const beam = one("[data-beam]");
        const countEl = one("[data-count]");
        const bar = one("[data-bar]");
        const speedEl = one("[data-speed]");
        const stops = all("[data-stop]");
        const lines = all("[data-line]");
        const touched = [track, ghost, road, ruler, streakBox, brake, beam, bar, ...rigs, ...chassis, ...rims, ...blurs, ...streaks];

        const cols = stops.map((el) => {
          const video = el.querySelector("video");
          const onPlaying = () => video?.setAttribute("data-ready", "");
          video?.addEventListener("playing", onPlaying);
          return {
            el,
            card: el.querySelector<HTMLElement>("[data-card]")!,
            tilt: el.querySelector<HTMLElement>("[data-tilt]")!,
            sheen: el.querySelector<HTMLElement>("[data-sheen]")!,
            imgs: Array.from(el.querySelectorAll("img")),
            video,
            onPlaying,
            center: 0,
            near: false,
            warm: false,
            playing: false,
            fade: 1,
          };
        });

        // Geometry, re-read from the CSS layout on every refresh (resize, fonts, intro end).
        const g = { w: 1, h: 1, carW: 1, carLeft: 0, r: 1, focus: 0, spacing: 1, travel: 1, ratio: 1, exit: 1, len: 1, span: 1, single: false, snaps: [0] };
        const measure = () => {
          g.w = stage.clientWidth;
          g.h = stage.clientHeight;
          const cs = getComputedStyle(stage);
          g.focus = g.w * (parseFloat(cs.getPropertyValue("--focus")) || 0.56);
          g.single = cs.getPropertyValue("--single").trim() === "1";
          g.carW = rigs[0].offsetWidth;
          g.carLeft = rigs[0].offsetLeft;
          g.r = Math.max(1, TYRE_R * g.carW);
          cols.forEach((c) => (c.center = c.el.offsetLeft + c.card.offsetWidth / 2));
          g.spacing = cols.length > 1 ? cols[1].center - cols[0].center : g.w * 0.4;
          const outroCenter = outro.offsetLeft + outroHead.offsetWidth / 2;
          g.travel = Math.max(1, outroCenter - g.w / 2);
          // ~62-70% of a screen of scroll per project; never faster than 1:1.
          g.ratio = Math.max(1, (0.64 * g.h) / g.spacing);
          g.exit = 0.7 * g.h;
          g.len = g.travel * g.ratio + g.exit;
          g.span = streakBox.offsetWidth || g.w * 0.5;
          // Touch snap points (pin progress): the start, each project parked in front of the car, the finish line.
          g.snaps = [0, ...cols.map((c) => clamp(c.center - g.focus, 0, g.travel) * g.ratio), g.travel * g.ratio, g.len].map((y) => y / g.len);
        };

        let pin: ScrollTrigger | undefined;
        // Loops (up to ~1 MB each) wait until the page has settled (the intro is done and the hero film has
        // had a head start) and the road is within a screen and a half; posters and stills load as soon as
        // their project is near the car, so a card always shows its picture while its loop loads.
        let loopsOk = false;
        const coarse = matchMedia("(pointer: coarse)").matches;
        const st = { lastDist: NaN, lastInto: NaN, idle: false, vel: 0, velSlow: 0, nudge: 0, pitch: 0, brake: 0, active: -2, best: -1, speed: -1, speedAt: 0, moving: false, clip: -1 };

        const render = (dt = 16.67) => {
          if (!pin) return;
          const into = pin.scroll() - pin.start;
          const enter = clamp01((into + g.h) / g.h);
          const s = clamp(into, 0, g.len);
          const T = Math.min(s / g.ratio, g.travel);
          const exit = clamp01((s - g.travel * g.ratio) / g.exit);

          // Car: drives in as the section arrives, holds its spot while the world moves, drives off at the end.
          let base = -Math.pow(1 - enter, 2.4) * (g.carLeft + g.carW * 1.15 + 60);
          base += Math.pow(exit, 1.9) * (g.w - g.carLeft + 80);
          const dist = T + base;
          const sec = Math.max(dt, 1) / 1000;
          const inst = Number.isNaN(st.lastDist) ? 0 : clamp((dist - st.lastDist) / sec, -9000, 9000);
          st.lastDist = dist;
          st.vel += (inst - st.vel) * (1 - Math.exp(-dt / 80));
          st.velSlow += (st.vel - st.velSlow) * (1 - Math.exp(-dt / 340));
          const accel = st.vel - st.velSlow;

          // Eases a touch forward when pushed, drops back when braking (only while the world is moving).
          const push = s > 0 && exit === 0 ? clamp(st.vel * (g.single ? 0.008 : 0.014), -22, 46) : 0;
          st.nudge += (push - st.nudge) * (1 - Math.exp(-dt / 260));
          const carX = base + st.nudge;
          const roll = T + carX;
          const deg = (roll / (2 * Math.PI * g.r)) * 360;

          st.pitch += (clamp(-accel * 0.00035, -0.45, 0.45) - st.pitch) * (1 - Math.exp(-dt / 160));
          // Only a real slow-down lights the brakes; wheel and trackpad jitter stay under the threshold.
          const braking = st.velSlow > 120 ? clamp01((st.velSlow - st.vel - 180) / 600) : 0;
          const brakeT = Math.max(braking, clamp01(-st.vel / 420));
          st.brake += (brakeT - st.brake) * (1 - Math.exp(-dt / (brakeT > st.brake ? 60 : 260)));

          // Parked and settled: nothing on screen changes, so skip the DOM writes until the next scroll.
          const settled =
            into === st.lastInto &&
            Math.abs(st.vel) < 0.5 &&
            Math.abs(st.velSlow) < 0.5 &&
            Math.abs(st.nudge - push) < 0.05 &&
            Math.abs(st.pitch) < 0.002 &&
            Math.abs(st.brake - brakeT) < 0.002;
          st.lastInto = into;
          if (settled && st.idle) return;
          st.idle = settled;

          const speed = Math.abs(st.vel);
          const ang = speed / g.r / 60; // radians per 60 Hz frame
          const blur = clamp01((ang - 0.22) / 0.45);

          track.style.transform = `translate3d(${-T}px,0,0)`;
          ghost.style.transform = `translate3d(${-T * 0.3}px,0,0)`;
          ruler.style.transform = `translate3d(${-(roll % 120)}px,0,0)`;
          const clip = Math.round((1 - Math.pow(enter, 0.8)) * 1000) / 10;
          if (clip !== st.clip) {
            st.clip = clip;
            road.style.clipPath = clip > 0 ? `inset(0 ${clip}% 0 0)` : "";
          }
          for (const r of rigs) r.style.transform = `translate3d(${carX}px,0,0)`;
          for (const c of chassis) c.style.transform = `rotate(${LEVEL_DEG + st.pitch}deg)`;
          for (const r of rims) r.style.transform = `rotate(${deg}deg)`;
          for (const b of blurs) {
            b.style.transform = `rotate(${deg * 0.5}deg)`;
            b.style.opacity = String(blur);
          }
          streakBox.style.opacity = String(smooth(260, 1900, speed) * (st.vel < 0 ? 0.4 : 1));
          const span = g.span;
          streaks.forEach((el, i) => {
            el.style.transform = `translate3d(${-((((roll * STREAKS[i].k) % span) + span) % span)}px,0,0)`;
          });
          brake.style.opacity = String(0.32 + st.brake * 0.68);
          brake.style.transform = `scale(${1 + st.brake * 0.5})`;
          beam.style.opacity = String(enter);
          // As the car leaves, the passed projects fade so only "All work" is left when the stage lets go.
          const fade = Math.round((1 - smooth(0.05, 0.6, exit)) * 100) / 100;
          for (const c of cols) {
            if (c.fade === fade) continue;
            c.fade = fade;
            c.el.style.opacity = fade < 1 ? String(fade) : "";
          }
          bar.style.transform = `scaleX(${T / g.travel})`;

          const moving = T > 24;
          if (moving !== st.moving) {
            st.moving = moving;
            stage.toggleAttribute("data-moving", moving);
          }

          const now = performance.now();
          const mph = Math.min(199, Math.round(speed * 0.036));
          if (mph !== st.speed && (settled || now - st.speedAt > 70)) {
            st.speed = mph;
            st.speedAt = now;
            speedEl.textContent = String(mph).padStart(3, "0");
          }

          // Projects: nearest to the headlights is "active"; cards bend like glass as they pass.
          let best = 0;
          let bestD = Infinity;
          const tiltV = clamp(-st.vel * 0.0028, -7, 7);
          // At most two loops play at once: the two films nearest the headlights.
          let near1 = Infinity;
          let near2 = Infinity;
          for (const c of cols) {
            if (!c.video) continue;
            const an = Math.abs((c.center - T - g.focus) / g.w);
            if (an < near1) {
              near2 = near1;
              near1 = an;
            } else if (an < near2) near2 = an;
          }
          cols.forEach((c, i) => {
            const x = c.center - T - g.focus;
            const n = x / g.w;
            const an = Math.abs(n);
            if (Math.abs(x) < bestD) {
              bestD = Math.abs(x);
              best = i;
            }
            if (!c.near && an < 1.7) {
              c.near = true;
              c.imgs.forEach((img) => (img.loading = "eager"));
            }
            if (c.near && loopsOk && !c.warm && c.video) {
              c.warm = true;
              c.video.preload = "auto";
            }
            if (c.video) {
              const play = an <= near2 && an < (g.single ? 0.5 : 0.62) && enter > 0.4 && exit < 0.9;
              if (play !== c.playing) {
                c.playing = play;
                if (play) c.video.play().catch(() => undefined);
                else c.video.pause();
              }
            }
            if (an < 1.5) {
              const ry = clamp(-n * (g.single ? 26 : 20) + tiltV, -30, 30);
              const sc = 1 - Math.min(an, 1) * 0.06;
              c.tilt.style.transform = `rotateY(${ry}deg) scale(${sc})`;
              c.sheen.style.transform = `translate3d(${clamp(-n * 90, -100, 100)}%,0,0)`;
            }
          });
          const active = bestD < g.spacing * 0.6 && enter > 0.3 ? best : -1;
          if (active !== st.active) {
            if (st.active >= 0) stops[st.active].removeAttribute("data-active");
            if (active >= 0) stops[active].setAttribute("data-active", "");
            st.active = active;
          }
          if (best !== st.best) {
            st.best = best;
            countEl.textContent = pad(best + 1);
          }
        };

        // The stage is CSS sticky (see drive.module.css); the section gets the drive's scroll length as
        // height. Set before every refresh so all triggers below measure the final page.
        const setLength = () => {
          measure();
          root.style.setProperty("--drive-len", `${Math.round(g.len)}px`);
        };
        setLength();
        ScrollTrigger.addEventListener("refreshInit", setLength);

        pin = ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: () => `+=${Math.round(g.len)}`,
          invalidateOnRefresh: true,
          onToggle: (self) => stage.toggleAttribute("data-pinned", self.isActive),
          onRefresh: (self) => {
            pin = self;
            st.lastDist = NaN;
            st.idle = false;
            render();
          },
          // Touch screens with one project at a time: a flick parks the car in front of the next project.
          ...(coarse
            ? {
                snap: {
                  snapTo: (value: number, self?: ScrollTrigger) => {
                    if (!g.single) return value;
                    const cur = self?.progress ?? value;
                    const dir = self?.direction ?? 0;
                    let best = g.snaps[0];
                    for (const p of g.snaps) if (Math.abs(p - value) < Math.abs(best - value)) best = p;
                    if (dir > 0 && best < cur - 1e-3) best = g.snaps.find((p) => p >= cur - 1e-3) ?? best;
                    if (dir < 0 && best > cur + 1e-3) best = [...g.snaps].reverse().find((p) => p <= cur + 1e-3) ?? best;
                    return best;
                  },
                  duration: { min: 0.3, max: 0.8 },
                  delay: 0.08,
                  ease: "power2.inOut",
                  inertia: true,
                },
              }
            : {}),
        });

        let ticking = false;
        const tick = (_time: number, dtMs: number) => render(Math.min(dtMs, 64));
        const startTick = () => {
          if (ticking) return;
          ticking = true;
          st.lastDist = NaN;
          st.idle = false;
          gsap.ticker.add(tick);
        };
        const stopTick = () => {
          if (ticking) gsap.ticker.remove(tick);
          ticking = false;
          cols.forEach((c) => {
            if (c.playing) c.video?.pause();
            c.playing = false;
          });
        };
        ScrollTrigger.create({
          trigger: root,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? startTick() : stopTick()),
        });

        // Allow the loops once the page has settled and the road is a screen and a half away (or closer).
        let calm = false;
        let close = false;
        const allowLoops = () => {
          if (loopsOk || !calm || !close) return;
          loopsOk = true;
          st.idle = false;
          render();
        };
        const cancelSettle = afterSettle(
          () => {
            calm = true;
            allowLoops();
          },
          1200,
          true,
        );
        const near = new IntersectionObserver(
          ([e]) => {
            if (!e.isIntersecting) return;
            close = true;
            near.disconnect();
            allowLoops();
          },
          { rootMargin: "0px 0px 150% 0px" },
        );
        near.observe(root);

        // Heading lines rise out of their masks as the section arrives.
        gsap.from(lines, {
          yPercent: 112,
          duration: 1.3,
          ease: "expo.out",
          stagger: 0.09,
          scrollTrigger: { trigger: root, start: "top 72%", once: true },
        });

        // Keyboard: focusing a project (or the end link) drives the road to it instead of scrolling the stage.
        const onFocus = (e: FocusEvent) => {
          const t = e.target as HTMLElement;
          const stop = t.closest<HTMLElement>("[data-stop]");
          let target: number;
          if (stop) target = cols[stops.indexOf(stop)].center - g.focus;
          else if (t.closest("[data-outro]")) target = g.travel;
          else return;
          if (!pin) return;
          const y = pin.start + clamp(target, 0, g.travel) * g.ratio + 1;
          stage.scrollLeft = 0;
          const lenis = getLenis();
          if (lenis) lenis.scrollTo(y, { duration: 0.9 });
          else window.scrollTo({ top: y });
        };
        root.addEventListener("focusin", onFocus);

        return () => {
          stopTick();
          near.disconnect();
          cancelSettle();
          root.removeEventListener("focusin", onFocus);
          ScrollTrigger.removeEventListener("refreshInit", setLength);
          root.style.removeProperty("--drive-len");
          delete root.dataset.drive;
          stage.removeAttribute("data-pinned");
          stage.removeAttribute("data-moving");
          for (const el of touched) {
            el.style.transform = "";
            el.style.opacity = "";
            el.style.clipPath = "";
          }
          cols.forEach((c) => {
            c.tilt.style.transform = "";
            c.sheen.style.transform = "";
            c.el.removeAttribute("data-active");
            c.el.style.opacity = "";
            c.video?.removeEventListener("playing", c.onPlaying);
          });
        };
      });

      mm.add("(prefers-reduced-motion: no-preference) and (max-height: 539px)", () => {
        const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video[data-video]"));
        const onPlaying = (e: Event) => (e.currentTarget as HTMLVideoElement).setAttribute("data-ready", "");
        const io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              const v = e.target as HTMLVideoElement;
              if (e.isIntersecting) {
                v.preload = "auto";
                v.play().catch(() => undefined);
              } else v.pause();
            }
          },
          { rootMargin: "10% 0px" },
        );
        videos.forEach((v) => {
          v.addEventListener("playing", onPlaying);
          io.observe(v);
        });
        return () => {
          io.disconnect();
          videos.forEach((v) => {
            v.pause();
            v.removeEventListener("playing", onPlaying);
          });
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="work" className={styles.section} aria-labelledby="work-title" style={{ "--count": count } as CSSProperties}>
      <div className={styles.stage} data-stage>
        <p className={styles.ghost} aria-hidden="true" data-ghost>
          Selected work
        </p>

        <div className={styles.road} aria-hidden="true" data-road>
          <span className={styles.roadLine} />
          <span className={styles.ruler} data-ruler />
        </div>

        <div className={`${styles.rig} ${styles.reflection}`} aria-hidden="true" data-rig>
          <DriveCar reflection />
        </div>

        <div className={styles.track} data-track>
          <header className={styles.intro}>
            <div className={styles.introHead}>
              <p className={`t-label ${styles.eyebrow}`}>
                <span>Selected work</span>
                <span className={styles.dim}>({pad(count)})</span>
              </p>
              {/* Client wording (WEBSITE WORDING AMMENDS.pdf, 2026-10-21). */}
              <h2 id="work-title" className={styles.heading}>
                <span className="sr-only">Selected work: </span>
                <span className={styles.line}>
                  <span data-line>Imagined.</span>
                </span>
                <span className={styles.line}>
                  <span data-line>Crafted.</span>
                </span>
                <span className={styles.line}>
                  <span data-line>Rendered.</span>
                </span>
              </h2>
            </div>
            <div className={styles.introFoot}>
              <p className={styles.lede}>From the first spark to the final frame, we create compelling CGI and motion for brands and storytellers.</p>
              <p className={`t-label ${styles.cue}`} aria-hidden="true">
                Scroll to drive
                <span className={styles.cueArrow} />
              </p>
            </div>
          </header>

          <ol className={styles.list}>
            {PROJECTS.map((p, i) => (
              <Stop key={p.slug} p={p} i={i} />
            ))}
          </ol>

          <div className={styles.outro} data-outro>
            <span className={styles.finish} aria-hidden="true" />
            <div className={styles.outroHead} data-outro-head>
              <p className={`t-label ${styles.outroLabel}`}>
                <span>End of the road</span>
                <span className={styles.dim}>
                  {pad(count)} / {pad(count)}
                </span>
              </p>
              {/* A plain link (full page load) on purpose until home → /work client navigation is tested. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/work" className={styles.allWork}>
                <span>All work</span>
                <span className={styles.allArrow} aria-hidden="true">
                  <span className={styles.chev} />
                </span>
              </a>
            </div>
            <p className={styles.outroFoot}>Every project, with the full films and stills.</p>
          </div>
        </div>

        <div className={styles.rig} aria-hidden="true" data-rig>
          <div className={styles.streaks} data-streaks>
            {STREAKS.map((s, i) => (
              <span key={i} className={s.hot ? `${styles.streak} ${styles.hot}` : styles.streak} data-streak style={{ top: `${s.top}%`, width: `${s.w}%`, opacity: s.o }} />
            ))}
          </div>
          <span className={styles.beam} data-beam />
          <span className={styles.shadow} />
          <DriveCar />
          <span className={styles.tail} data-brake />
        </div>

        <div className={styles.hud} aria-hidden="true">
          <p className={`t-label ${styles.speed}`}>
            <span className={styles.speedDot} />
            <span data-speed>000</span>
            <span className={styles.dim}>mph</span>
          </p>
          <div className={styles.counter}>
            <p className="t-label">
              <span data-count>01</span>
              <span className={styles.dim}> / {pad(count)}</span>
            </p>
            <span className={styles.bar}>
              <span data-bar />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
