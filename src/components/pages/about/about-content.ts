import { MEDIA } from "@/content/projects";
import { STILLS, type StudioStill } from "@/components/studio/studio-content";
import alpine from "@/components/brands/logos/alpine.webp";
import bmw from "@/components/brands/logos/bmw.webp";
import hyundai from "@/components/brands/logos/hyundai.webp";
import mclaren from "@/components/brands/logos/mclaren.webp";
import mcmurtry from "@/components/brands/logos/mcmurtry.webp";
import nascar from "@/components/brands/logos/nascar.webp";
import renault from "@/components/brands/logos/renault.webp";
import zeekr from "@/components/brands/logos/zeekr.webp";

// About page content. The statement, the two paragraphs, LEAD and FACTS come from the home page's
// studio-content.ts (approved by Adil); everything written here is a placeholder until Adil confirms it.
// Rules: never name the studio's owner (still open with Adil), never invent clients, numbers or awards.

// ---------- Pictures (the client's own CGI stills) ----------

/** One still from the home studio set, so captions and alt text stay in one place. */
function pickStill(slug: string, n: number): StudioStill {
  const s = STILLS.find((x) => x.slug === slug && x.n === n);
  if (!s) throw new Error(`About: no studio still ${slug} #${n}`);
  return s;
}

export type AboutPicture = {
  still: StudioStill;
  /** Blurred placeholder key in components/work/lqip.ts. */
  lqip: string;
  /** Intrinsic size of the 1600 px file. */
  w: number;
  h: number;
};

// Hero: the McLaren endurance car in the white studio (the Services page already uses the Zeekr arch still).
export const HERO_PICTURE: AboutPicture = { still: pickStill("mclaren-endurance", 1), lqip: "mclaren-endurance/01", w: 1600, h: 900 };
// Studio block: the McMurtry from behind in the dark, its red lights the only colour.
export const SIDE_PICTURE: AboutPicture = { still: pickStill("mcmurtry", 5), lqip: "mcmurtry/05", w: 1600, h: 1819 };

const file = (s: StudioStill, w: 800 | 1600 | 3200, ext: "avif" | "webp") =>
  `${MEDIA}/work/${s.slug}/stills/${String(s.n).padStart(2, "0")}-${w}.${ext}`;

/** srcset for a still; the hero also offers the 3200 px file for wide, sharp screens. */
export const stillSet = (s: StudioStill, ext: "avif" | "webp", big = false) =>
  (big ? ([800, 1600, 3200] as const) : ([800, 1600] as const)).map((w) => `${file(s, w, ext)} ${w}w`).join(", ");

export const stillSrc = (s: StudioStill) => file(s, 1600, "webp");

// ---------- How we work ----------

// CONFIRM WITH ADIL: three principles, drawn from the approved copy (real-world precision, CGI freedom,
// every frame considered). One short line each.
export const PRINCIPLES: { title: string; line: string }[] = [
  { title: "Real-world precision", line: "We light and frame every car the way a real film crew would." },
  { title: "Creative freedom", line: "CGI lets the car go anywhere, in any light, at any time of day." },
  { title: "Every frame checked", line: "Nothing leaves the studio until every detail holds up." },
];

// ---------- Brands ----------

// The client's own logo files (white on transparent, DISRUPT ASSETS/BRAND LOGOS, 2026-10-21), the same set
// as the home page's "Trusted by" row. `k` sizes each mark by its shape so a long wordmark and a square
// badge look about the same weight: height falls with the square root of the width/height ratio, and `o`
// nudges a few marks by eye.
type Logo = { name: string; src: string; w: number; h: number; k: number };
function logo(name: string, img: { src: string; width: number; height: number }, o = 1): Logo {
  return { name, src: img.src, w: img.width, h: img.height, k: o / Math.sqrt(img.width / img.height) };
}

export const LOGOS: Logo[] = [
  logo("McLaren", mclaren, 1.04),
  logo("Alpine", alpine, 1.2),
  logo("Zeekr", zeekr, 1.04),
  logo("BMW", bmw, 0.92),
  logo("NASCAR", nascar, 0.92),
  logo("Renault", renault, 1.04),
  logo("McMurtry", mcmurtry, 1.18),
  logo("Hyundai", hyundai, 0.96),
];

// ---------- Contact ----------

// CONFIRM WITH ADIL: the closing prompt.
export const CTA = {
  ask: "Have a project in mind?",
  link: "Start a project",
};
