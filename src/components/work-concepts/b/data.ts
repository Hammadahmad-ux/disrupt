import { MEDIA, PROJECTS, loopSources, still, type Project } from "@/content/projects";
import alpine from "@/components/brands/logos/alpine.webp";
import mclaren from "@/components/brands/logos/mclaren.webp";
import mcmurtry from "@/components/brands/logos/mcmurtry.webp";
import nascar from "@/components/brands/logos/nascar.webp";
import zeekr from "@/components/brands/logos/zeekr.webp";

// PIT WALL (work concept B). One print per project: a frame where the car is clearly visible, at the
// frame's own aspect. Films: grabbed from the 4K masters; stills: the studio's own stills.
// Media: web/public/media/work-index/b/<slug>.{avif,webp} (+ -800). Built from the masters with ffmpeg + sharp.

type Logo = { src: string; width: number; height: number };

export type Print = Project & {
  n: string; // wall number, 01..09
  brand: string;
  car: string; // what the car is, for people who know it by shape  [CONFIRM WITH ADIL]
  tint: string; // the car's own colour: strip light, tower stripe, spill fallback
  w: number;
  h: number;
  logo?: Logo;
  /** Stills projects flick through these on hover (slide projector) instead of a film loop. */
  flick?: string[];
  /**
   * Hover film (our own clips, cut from the masters):
   * "matched" starts on the print's exact frame, so the still simply starts to move, then loops;
   * "lands" plays the seconds before the print's frame once and stops on it;
   * "own" is a loop that cross-fades in. None: the site's shared 6 s loop.
   */
  clip?: "matched" | "lands" | "own";
};

type Extra = Pick<Print, "brand" | "car" | "tint" | "w" | "h" | "logo" | "flick" | "clip">;

const EXTRA: Record<string, Extra> = {
  "audi-rs5-estate": { brand: "Audi", car: "RS 5 Avant", tint: "#e0282f", w: 16, h: 9, clip: "matched" },
  "mclaren-endurance": { brand: "McLaren", car: "MCL-HY hypercar", tint: "#ff8a1c", w: 16, h: 9, logo: mclaren, clip: "own" },
  "zeekr-launch": {
    brand: "Zeekr",
    car: "Zeekr 9X",
    tint: "#e8692e",
    w: 16,
    h: 9,
    logo: zeekr,
    flick: [7, 2, 4, 6].map((i) => still("zeekr-launch", i)),
  },
  "audi-f1": { brand: "Audi", car: "2026 F1 car", tint: "#e3122d", w: 16, h: 9, clip: "matched" },
  alpine: { brand: "Alpine", car: "A390", tint: "#7356ff", w: 5, h: 2, logo: alpine, clip: "lands" },
  cupra: { brand: "CUPRA", car: "Formula E car", tint: "#b9e23c", w: 16, h: 9, clip: "lands" },
  mcmurtry: {
    brand: "McMurtry",
    car: "Spéirling Pure",
    tint: "#36a874",
    w: 4,
    h: 3,
    logo: mcmurtry,
    flick: [2, 5, 3].map((i) => still("mcmurtry", i)),
  },
  "audi-rebirth": { brand: "Audi", car: "RS e-tron GT", tint: "#d2a465", w: 16, h: 9, clip: "matched" },
  nascar: { brand: "NASCAR", car: "Ford Mustang", tint: "#ec8a34", w: 16, h: 9, logo: nascar },
};

// Wall order: the ultra-wide Alpine hangs in the middle as the centrepiece.
const ORDER = [
  "audi-rs5-estate",
  "mclaren-endurance",
  "zeekr-launch",
  "audi-f1",
  "alpine",
  "cupra",
  "mcmurtry",
  "audi-rebirth",
  "nascar",
];

export const PRINTS: Print[] = ORDER.map((slug, i) => {
  const p = PROJECTS.find((x) => x.slug === slug)!;
  return { ...p, ...EXTRA[slug], n: String(i + 1).padStart(2, "0") };
});

export const BRANDS = [...new Set(PRINTS.map((p) => p.brand))];

export const cover = (slug: string, small = false) => {
  const s = small ? "-800" : "";
  return { avif: `${MEDIA}/work-index/b/${slug}${s}.avif`, webp: `${MEDIA}/work-index/b/${slug}${s}.webp` };
};

/** Sources for the hover film (none for stills projects). */
export const filmSources = (p: Print) =>
  p.type !== "film"
    ? []
    : p.clip
      ? [{ src: `${MEDIA}/work-index/b/${p.slug}.mp4`, type: "video/mp4" }]
      : loopSources(p.slug);

export const kindLabel = (p: Print) => (p.type === "stills" ? "CGI stills" : p.kind);
