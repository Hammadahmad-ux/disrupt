import { create } from "zustand";

// The lights-down film player (LightsDownPlayer, mounted once per film case by CaseShell).
// Open it from anywhere on the page with openFilm() (optionally from a timecode). play() is called
// right here, inside the click, so the browser lets the film start with sound.
type FilmPlayerState = {
  open: boolean;
  /** Bumped on every open, so the player can restart its intro even when already mounted. */
  token: number;
  show: () => void;
  hide: () => void;
};

export const useFilmPlayer = create<FilmPlayerState>((set) => ({
  open: false,
  token: 0,
  show: () => set((s) => ({ open: true, token: s.token + 1 })),
  hide: () => set({ open: false }),
}));

let film: HTMLVideoElement | null = null;
let posterFor: ((at: number) => string | undefined) | null = null;
export const registerFilmVideo = (el: HTMLVideoElement | null) => {
  film = el;
};
/** The player tells openFilm which picture to hold while the film buffers at a given time. */
export const registerFilmPoster = (fn: ((at: number) => string | undefined) | null) => {
  posterFor = fn;
};

/**
 * Intent to play (pointer over, or focus on, a play control): fetch the film's header now, so the first
 * frame comes sooner after the click. Only the metadata; the film itself still loads on play.
 */
export function warmFilm() {
  const v = film;
  if (v && v.preload === "none") v.preload = "metadata";
}

/**
 * Open the full film with sound. `at`: start time in seconds (default: from the start). `poster`: the picture
 * to hold while the film buffers (the frame that was clicked); by default the player picks the hero poster or
 * the shot frame for `at`.
 */
export function openFilm(opts: { at?: number; poster?: string } = {}) {
  const v = film;
  if (v) {
    const at = Math.max(0, opts.at ?? 0);
    // The poster shows until the film has a frame at `at`.
    const p = opts.poster ?? posterFor?.(at);
    if (p && v.getAttribute("poster") !== p) v.poster = p;
    // Opened again at another moment: the element would hold the last frame seen (another shot) while it
    // buffers. Reset it so the poster holds instead (the film's header comes back from the cache; the
    // start time below then becomes the default start position).
    if (p && v.readyState > 0 && Math.abs(v.currentTime - at) > 1.5) v.load();
    v.muted = false;
    try {
      v.currentTime = at;
    } catch {}
    v.play().catch(() => {
      // Sound blocked (no user gesture): start muted, the player shows "Sound off".
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }
  useFilmPlayer.getState().show();
}

export const closeFilm = () => useFilmPlayer.getState().hide();
