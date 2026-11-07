import type { CaseData } from "@/content/cases";
import { MEDIA } from "@/content/projects";
import rhythmJson from "./rhythm-frames.json";

/**
 * Film template knobs that cases.ts does not carry, so each film page reads as its own:
 *  - shotsTitle:  the "In this shot" chapter heading, written from what is on screen in that film.
 *  - framesTitle: the frames rhythm heading.
 * Both are draft headings. // CONFIRM WITH ADIL
 */
type FilmVariant = { shotsTitle: string; framesTitle: string };

const VARIANTS: Record<string, FilmVariant> = {
  "audi-rs5-estate": { shotsTitle: "Studio to cliff road", framesTitle: "Up close" },
  "mclaren-endurance": { shotsTitle: "Light box to sunset", framesTitle: "Ember and dusk" },
  "audi-f1": { shotsTitle: "Ice, lasers, track", framesTitle: "Red on graphite" },
  cupra: { shotsTitle: "Through the blast", framesTitle: "Lime and fire" },
  "audi-rebirth": { shotsTitle: "Hangar to city", framesTitle: "Light signatures" },
  alpine: { shotsTitle: "Built in light", framesTitle: "Workshop to hologram" },
  nascar: { shotsTitle: "The closing run", framesTitle: "Into the run" },
};

export function filmVariant(data: CaseData): FilmVariant {
  return VARIANTS[data.slug] ?? { shotsTitle: "Shot by shot", framesTitle: "From the film" };
}

/** A frame for the frames rhythm: a moment that is not in the shot list (rhythm-frames.json). */
export type RhythmFrame = { n: number; at: number; play: number; title: string; w: number; h: number };

type RhythmJson = { frames: Record<string, { at: number; play: number; title: string; w?: number; h?: number }[]> };
const RHYTHM = (rhythmJson as unknown as RhythmJson).frames;

export function rhythmFor(data: CaseData): RhythmFrame[] {
  return (RHYTHM[data.slug] ?? []).map((f, i) => ({
    n: i + 1,
    at: f.at,
    play: f.play,
    title: f.title,
    w: f.w ?? 1600,
    h: f.h ?? Math.round(1600 / data.aspect),
  }));
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const rhythmSrc = (slug: string, n: number, w: 800 | 1600, fmt: "avif" | "webp") =>
  `${MEDIA}/work/${slug}/rhythm/${pad2(n)}${w === 800 ? "-800" : ""}.${fmt}`;

/** srcSet strings for a rhythm frame (same shape as frameSet in content/cases). */
export const rhythmSet = (slug: string, n: number) => ({
  avif: `${rhythmSrc(slug, n, 800, "avif")} 800w, ${rhythmSrc(slug, n, 1600, "avif")} 1600w`,
  webp: `${rhythmSrc(slug, n, 800, "webp")} 800w, ${rhythmSrc(slug, n, 1600, "webp")} 1600w`,
  src: rhythmSrc(slug, n, 1600, "webp"),
});
