import { create } from "zustand";

// Shared state of the Work section. The film stage (one <video>/<img> per project) lives in
// app/work/layout.tsx, so the same playing element carries on from the roster into the case hero.
export type StageMode = "index" | "hero";
export type StageLook = "gl" | "css";

/** How much of a project's stage media may load: 1 poster/still, 2 + the loop's first data, 3 + the whole loop. */
export type PrimeLevel = 1 | 2 | 3;

type StageState = {
  mode: StageMode;
  /** Project whose media is shown on the stage (and plays, unless reduced motion). */
  active: string | null;
  /** Neighbours worth preloading. */
  warm: string[];
  /** Last project opened from the roster; the roster comes back to this row. */
  last: string | null;
  /** True while coming back from a case page (the roster plays the fly-through in reverse). */
  returning: boolean;
  /** "gl": the roster's canvas covers the stage; "css": the stage itself is the dim ambient light. */
  look: StageLook;
  /**
   * Projects whose stage media may start loading before they are active or warm (the work grid primes them
   * at idle, and on hover / focus / press of a tile). Levels only ever go up, so nothing is unloaded.
   */
  primed: Record<string, PrimeLevel>;
  setLook: (look: StageLook) => void;
  setActive: (slug: string | null, warm?: string[]) => void;
  setMode: (mode: StageMode, slug?: string) => void;
  setLast: (slug: string | null, returning?: boolean) => void;
  prime: (slugs: string | string[], level: PrimeLevel) => void;
};

export const useStage = create<StageState>((set) => ({
  mode: "index",
  active: null,
  warm: [],
  last: null,
  returning: false,
  look: "css",
  primed: {},
  setLook: (look) => set({ look }),
  setActive: (slug, warm = []) => set({ active: slug, warm }),
  setMode: (mode, slug) => set((s) => ({ mode, active: slug ?? s.active })),
  setLast: (slug, returning = false) => set({ last: slug, returning }),
  prime: (slugs, level) =>
    set((s) => {
      const up = (Array.isArray(slugs) ? slugs : [slugs]).filter((slug) => (s.primed[slug] ?? 0) < level);
      if (!up.length) return s;
      const primed = { ...s.primed };
      for (const slug of up) primed[slug] = level;
      return { primed };
    }),
}));

// The stage's media elements, by slug (read by the roster's WebGL layer as textures).
const media = new Map<string, HTMLVideoElement | HTMLImageElement>();
export const registerMedia = (slug: string, el: HTMLVideoElement | HTMLImageElement | null) => {
  if (el) media.set(slug, el);
  else media.delete(slug);
};
export const getMedia = (slug: string) => media.get(slug) ?? null;
