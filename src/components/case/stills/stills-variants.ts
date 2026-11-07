import type { CaseData, CaseStill } from "@/content/cases";

/**
 * Stills template knobs that cases.ts does not carry (kept here so the foundation stays frozen).
 * Together with layout.order / strobe / loupe / accent / surface they keep Zeekr and McMurtry apart:
 *  - grid:      "bleed" (singles run edge to edge, pairs sit level) or "inset" (singles alternate sides
 *               with the caption in the free columns, pairs are staggered).
 *  - flipSpec:  spec list on the left, intro on the right.
 *  - stripFrom: the light-box strip opens on the first still or on the key still.
 *  - note:      the draft "what to look for" line under the loupe still. // CONFIRM WITH ADIL
 */
export type StillsVariant = {
  grid: "bleed" | "inset";
  flipSpec: boolean;
  stripFrom: "first" | "key";
  note: string;
};

const VARIANTS: Record<string, StillsVariant> = {
  "zeekr-launch": {
    grid: "bleed",
    flipSpec: false,
    stripFrom: "first",
    // CONFIRM WITH ADIL: written only from what is on screen in still 01.
    note: "Hold over the grille, the lamps or the marble wall behind to see the render at full size.",
  },
  mcmurtry: {
    grid: "inset",
    flipSpec: true,
    stripFrom: "key",
    // CONFIRM WITH ADIL: written only from what is on screen in still 04.
    note: "Both cars on the desert circuit. Hold over the bodywork, the wheels or the track surface to see the render at full size.",
  },
};

/** The knobs for a stills project; a new project alternates between the two looks by its position. */
export function variantFor(data: CaseData): StillsVariant {
  return (
    VARIANTS[data.slug] ?? {
      grid: data.index % 2 ? "inset" : "bleed",
      flipSpec: data.index % 2 === 1,
      stripFrom: data.index % 2 ? "key" : "first",
      note: "Hold anywhere on the frame to see it at full size.", // CONFIRM WITH ADIL
    }
  );
}

/** Hero strobe stills (last = key still), safe for any number of stills. */
export function strobeFor(data: CaseData): number[] {
  const n = data.stills.length;
  const given = (data.layout.strobe ?? []).filter((x) => x >= 1 && x <= n);
  if (given.length) return given;
  if (n >= 3) return [2, 3, 1].map((x) => Math.min(x, n));
  return n ? [n] : [];
}

/** The film stage shows still 01 on arrival; the strobe only makes sense in the hero if it lands elsewhere. */
export function strobeInHero(data: CaseData): boolean {
  const seq = strobeFor(data);
  return seq.length > 0 && seq[seq.length - 1] !== 1;
}

/** The still shown full bleed for "hold to inspect". */
export function loupeFor(data: CaseData): CaseStill | null {
  const n = data.layout.loupe ?? 1;
  return data.stills.find((s) => s.n === n) ?? data.stills[0] ?? null;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** "8000 × 4500": the client's master size, as the strip's edge marking. */
export const masterLabel = (s: CaseStill) => `${s.masterW} × ${s.masterH}`;
