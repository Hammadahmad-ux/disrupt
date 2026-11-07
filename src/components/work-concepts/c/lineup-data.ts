import { MEDIA, PROJECTS, type Project } from "@/content/projects";
import { CAR_BOX, type CarBox } from "./car-boxes";

// LINEUP (work concept C): every project is a car parked in its own bay. The car is a local cut-out
// (Apple Vision, scripts/media/build-work-lineup.cjs) of the frame where its shape reads best; the same
// frame is the "scene" that opens behind it, registered to the pixel by CAR_BOX.
export const LINEUP_MEDIA = `${MEDIA}/work-index/lineup`;

type Look = {
  w: number; // car length as a share of its bay's width (3/4 views run shorter so all cars read the same size)
  view: string; // for alt text
  runtime?: string; // full film length (films-audit.md)
};

const LOOK: Record<string, Look> = {
  "audi-rs5-estate": { w: 0.8, view: "side view", runtime: "0:32" },
  "mclaren-endurance": { w: 0.86, view: "side view", runtime: "1:11" },
  "zeekr-launch": { w: 0.78, view: "side view" },
  "audi-f1": { w: 0.86, view: "three-quarter view", runtime: "0:50" },
  cupra: { w: 0.86, view: "side view", runtime: "0:56" },
  "audi-rebirth": { w: 0.84, view: "side view", runtime: "1:08" },
  mcmurtry: { w: 0.64, view: "three-quarter view" },
  alpine: { w: 0.8, view: "hologram side view", runtime: "0:15" },
  nascar: { w: 0.82, view: "side view", runtime: "2:09" },
};

export type LineupCar = Project & {
  n: string; // bay number, "01"
  box: CarBox;
  w: number;
  view: string;
  format: string; // "CGI film · 0:32" / "CGI stills · 7 stills"
};

export const LINEUP: LineupCar[] = PROJECTS.map((p, i) => {
  const look = LOOK[p.slug];
  const tail = p.type === "film" ? look.runtime : p.stills ? `${p.stills} stills` : undefined;
  return {
    ...p,
    n: String(i + 1).padStart(2, "0"),
    box: CAR_BOX[p.slug],
    w: look.w,
    view: look.view,
    format: tail ? `${p.kind} · ${tail}` : p.kind,
  };
});

export const carSet = (slug: string, ext: "avif" | "webp") =>
  `${LINEUP_MEDIA}/${slug}-car-600.${ext} 600w, ${LINEUP_MEDIA}/${slug}-car-1000.${ext} 1000w`;
export const carSrc = (slug: string) => `${LINEUP_MEDIA}/${slug}-car-1000.webp`;

export const sceneSet = (slug: string, ext: "avif" | "webp") =>
  `${LINEUP_MEDIA}/${slug}-scene-900.${ext} 900w, ${LINEUP_MEDIA}/${slug}-scene-1600.${ext} 1600w`;
export const sceneSrc = (slug: string) => `${LINEUP_MEDIA}/${slug}-scene-1600.webp`;
