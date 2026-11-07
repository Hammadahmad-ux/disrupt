import { MEDIA } from "@/content/projects";

// Copy and stills for the home "Studio" section. All copy is a placeholder until Adil confirms it.

// CONFIRM WITH ADIL: the award line stays hidden until Adil confirms the award, year and wording.
export const SHOW_AWARD = false;

// Client wording (Adil, 2026-10-23).
// Two sentences, each split into phrases that never break inside (clean line breaks on small screens).
export const STATEMENT: [string[], string[]] = [
  ["Every frame", "considered."],
  ["Every detail", "perfect."],
];

// Client wording (Adil, 2026-10-23): two short paragraphs.
export const ABOUT = [
  "DISRUPT is a UK-based creative studio specialising in high-end automotive CGI, films and still imagery.",
  "Every project is approached with the precision of a real-world production and the creative freedom of CGI.",
];

// CONFIRM WITH ADIL: who leads the studio (the award version only shows when SHOW_AWARD is true).
export const LEAD = SHOW_AWARD
  ? "Led by a 2024 International Motor Film Awards winner"
  : "Led by an automotive film director";

// CONFIRM WITH ADIL: facts row. "Selected work" names brands from the supplied project folders only.
export const FACTS: { label: string; value: string }[] = [
  { label: "Based in", value: "United Kingdom" },
  { label: "We make", value: "CGI films and stills" },
  { label: "Selected work", value: "Audi, McLaren, Zeekr, McMurtry" },
];

export type StudioStill = {
  slug: string;
  n: number;
  /** Intrinsic size of the 800 px rendition (from stills/NN.json). */
  iw: number;
  ih: number;
  /** Frame aspect (width / height). Stills are cropped with object-fit when it differs from the file. */
  ar: number;
  pos?: string; // object-position for crops
  /** Slate-style caption above the still: project, then what the shot is. */
  project: string;
  view: string;
  alt: string;
  /** Desktop placement, in % of the field width (x, w) and vw from the field top (t) or bottom (b). */
  d: { x: number; w: number; t?: number; b?: number; speed: number };
  /** Mobile: column, width in % of the column, alignment. */
  m: { col: "a" | "b"; w: number; align?: "start" | "end" };
};

const R = 16 / 9;

// Order matters on mobile (read top to bottom inside each column).
export const STILLS: StudioStill[] = [
  // ---------- top band ----------
  {
    slug: "zeekr-launch", n: 2, iw: 800, ih: 450, ar: 3 / 2,
    project: "Zeekr", view: "Overhead",
    alt: "CGI still: a dark Zeekr SUV seen from above on a pink, mirror-like floor",
    d: { x: 7, w: 25, t: 14, speed: 0.16 },
    m: { col: "b", w: 100 },
  },
  {
    slug: "mclaren-endurance", n: 1, iw: 800, ih: 450, ar: R,
    project: "McLaren Endurance", view: "Studio",
    alt: "CGI still: the orange McLaren endurance race car side-on in a white studio",
    d: { x: 49, w: 41, t: 9, speed: 0.07 },
    m: { col: "a", w: 100 },
  },
  {
    slug: "mcmurtry", n: 5, iw: 800, ih: 910, ar: 800 / 910,
    project: "McMurtry", view: "Rear",
    alt: "CGI still: the green McMurtry fan car from behind, lit in the dark",
    d: { x: 36, w: 9.5, t: 35, speed: 0.3 },
    m: { col: "a", w: 62, align: "end" },
  },
  {
    slug: "zeekr-launch", n: 4, iw: 800, ih: 450, ar: 4 / 5, pos: "50% 50%",
    project: "Zeekr", view: "Key visual",
    alt: "CGI still: the Zeekr SUV under a red arch, standing in still water at sunset",
    d: { x: 85, w: 11, t: 37.5, speed: 0.22 },
    m: { col: "b", w: 74, align: "end" },
  },
  {
    slug: "mcmurtry", n: 2, iw: 800, ih: 498, ar: 800 / 498,
    project: "McMurtry", view: "Overhead",
    alt: "CGI still: the McMurtry fan car seen from above, cornering past red and white kerbs",
    d: { x: 3, w: 11, t: 41, speed: 0.27 },
    m: { col: "b", w: 82, align: "start" },
  },
  // ---------- bottom band ----------
  {
    slug: "zeekr-launch", n: 6, iw: 800, ih: 450, ar: R,
    project: "Zeekr", view: "Monaco",
    alt: "CGI still: the Zeekr SUV on a platform in a rooftop pool above Monaco harbour",
    d: { x: 6, w: 38, b: 38, speed: 0.08 },
    m: { col: "a", w: 100 },
  },
  {
    slug: "mclaren-endurance", n: 3, iw: 800, ih: 450, ar: 4 / 3,
    project: "McLaren Endurance", view: "Top view",
    alt: "CGI still: the McLaren race car seen from directly above on a white floor",
    d: { x: 53, w: 14, b: 50, speed: 0.2 },
    m: { col: "b", w: 100 },
  },
  {
    slug: "mcmurtry", n: 3, iw: 800, ih: 599, ar: 800 / 599,
    project: "McMurtry", view: "Track",
    alt: "CGI still: two McMurtry fan cars racing out of a corner on a sunny track",
    d: { x: 70, w: 25, b: 20, speed: 0.12 },
    m: { col: "a", w: 88, align: "end" },
  },
  {
    slug: "zeekr-launch", n: 3, iw: 800, ih: 450, ar: 4 / 5, pos: "50% 50%",
    project: "Zeekr", view: "Rear",
    alt: "CGI still: the Zeekr SUV from behind on a terrace by the sea",
    d: { x: 3, w: 10.5, b: 3, speed: 0.26 },
    m: { col: "b", w: 70, align: "start" },
  },
  {
    slug: "zeekr-launch", n: 7, iw: 800, ih: 450, ar: 2.39, pos: "50% 62%",
    project: "Zeekr", view: "Villa",
    alt: "CGI still: the Zeekr SUV in profile beside a villa pool",
    d: { x: 24, w: 32, b: 7, speed: 0.16 },
    m: { col: "a", w: 100 },
  },
  {
    slug: "mcmurtry", n: 1, iw: 800, ih: 558, ar: 800 / 558,
    project: "McMurtry", view: "Cockpit",
    alt: "CGI still: inside the McMurtry cockpit, green bodywork and a race steering wheel",
    d: { x: 86, w: 13, b: 56, speed: 0.1 },
    m: { col: "b", w: 86, align: "end" },
  },
  {
    slug: "mclaren-endurance", n: 4, iw: 800, ih: 450, ar: R,
    project: "McLaren Endurance", view: "Sunset",
    alt: "CGI still: the McLaren and a rival endurance car racing at sunset",
    d: { x: 63, w: 19, b: 4, speed: 0.2 },
    m: { col: "a", w: 100 },
  },
];

const file = (s: StudioStill, w: 800 | 1600, ext: "avif" | "webp") =>
  `${MEDIA}/work/${s.slug}/stills/${String(s.n).padStart(2, "0")}-${w}.${ext}`;

export const srcSet = (s: StudioStill, ext: "avif" | "webp") =>
  `${file(s, 800, ext)} 800w, ${file(s, 1600, ext)} 1600w`;

export const fallbackSrc = (s: StudioStill) => file(s, 800, "webp");

/** Rendered width: the desktop % of the viewport, or the mobile column share (two columns, 16 px gutters). */
export const sizes = (s: StudioStill) =>
  `(min-width: 900px) ${s.d.w}vw, calc((100vw - 44px) / 2 * ${s.m.w / 100})`;
